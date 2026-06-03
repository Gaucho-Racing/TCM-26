import logging
import sys
import time
from importlib.metadata import PackageNotFoundError, version
from urllib.parse import urlparse

import boto3
import ulid
from loguru import logger

from config.config import Config, load
from database.db import claim_batch, pending_count, rollback_batch
from service.upload import upload


try:
    VERSION = version("shelter")
except PackageNotFoundError:
    VERSION = "dev"


def print_banner(cfg: Config) -> None:
    print("\033[1;95mEPIC SHELTER\033[0m")
    print(f"\033[1;35mRunning v{VERSION} [ENV: {cfg.env}]\033[0m")
    print()


def configure_logging(level: str) -> None:
    logger.remove()
    logger.add(sys.stdout, level=level)
    for noisy in ("boto3", "botocore", "urllib3", "s3transfer"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def main() -> None:
    cfg = load()
    print_banner(cfg)
    configure_logging(cfg.log_level)
    logger.info(
        f"shelter starting (vehicle_id={cfg.vehicle_id}, batch_size={cfg.batch_size}, "
        f"max_batch_age_s={cfg.max_batch_age_s}, s3_uri={cfg.s3_uri}, "
        f"idle_sleep_s={cfg.idle_sleep_s})"
    )

    s3 = boto3.client(
        "s3",
        region_name=cfg.s3_region,
        aws_access_key_id=cfg.aws_access_key_id,
        aws_secret_access_key=cfg.aws_secret_access_key,
    )

    # Make startup behave as if max_batch_age_s already elapsed, so we drain
    # any backlog immediately on first iteration instead of waiting a full
    # max_batch_age_s window.
    last_batch_done = time.monotonic() - cfg.max_batch_age_s
    while True:
        elapsed = round(time.monotonic() - last_batch_done, 3)
        pending = pending_count(cfg.pg_uri, cfg.batch_size)
        size_ready = pending >= cfg.batch_size
        age_ready = pending > 0 and elapsed >= cfg.max_batch_age_s
        if not (size_ready or age_ready):
            logger.debug(
                f"waiting: pending={pending}/{cfg.batch_size} elapsed={elapsed}s/{cfg.max_batch_age_s}s"
            )
            time.sleep(cfg.idle_sleep_s)
            continue

        claim_id = int(time.time() * 1000)
        batch_id = ulid.make()
        trigger = "size" if size_ready else "age"
        try:
            logger.debug(
                f"[{batch_id}] claiming batch "
                f"(trigger={trigger}, pending={pending}, elapsed={elapsed}s)"
            )
            t0 = time.monotonic()
            df = claim_batch(cfg.pg_uri, claim_id, cfg.batch_size)
            claim_s = round(time.monotonic() - t0, 3)

            if df.is_empty():
                # Pending was > 0 a moment ago but someone else (or SKIP LOCKED)
                # cleared it. Reset the age clock and loop.
                logger.debug(f"[{batch_id}] race: nothing claimed (claim_s={claim_s})")
                last_batch_done = time.monotonic()
                continue

            est_mb = round(df.estimated_size() / 1_048_576, 2)
            logger.info(
                f"[{batch_id}] claimed {len(df)} rows in {claim_s}s "
                f"({est_mb} MB, trigger={trigger}, elapsed={elapsed}s)"
            )

            t1 = time.monotonic()
            key = upload(df, cfg, batch_id)
            upload_s = round(time.monotonic() - t1, 3)

            parsed = urlparse(key)
            head = s3.head_object(Bucket=parsed.netloc, Key=parsed.path.lstrip("/"))
            compressed_mb = round(head["ContentLength"] / 1_048_576, 2)
            ratio = round(est_mb / compressed_mb, 2) if compressed_mb > 0 else 0
            upload_mbps = round(compressed_mb / upload_s, 2) if upload_s > 0 else 0

            logger.info(
                f"[{batch_id}] uploaded -> {key} "
                f"({compressed_mb} MB compressed, {ratio}x ratio, {upload_mbps} MB/s, "
                f"upload_s={upload_s}, total_s={round(claim_s + upload_s, 3)})"
            )
            last_batch_done = time.monotonic()
        except Exception as e:
            logger.error(f"[{batch_id}] batch failed, rolling back: {e}")
            try:
                affected = rollback_batch(cfg.pg_uri, claim_id)
                logger.info(f"[{batch_id}] rolled back {affected} rows")
            except Exception as roll_err:
                logger.error(f"[{batch_id}] rollback failed: {roll_err}")
            time.sleep(cfg.error_backoff_s)


if __name__ == "__main__":
    main()
