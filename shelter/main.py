import logging
import sys
import time
from importlib.metadata import PackageNotFoundError, version
from urllib.parse import urlparse

import boto3
import structlog
import ulid

from config.config import Config, load
from database.db import claim_batch, rollback_batch
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
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level)
    # boto3/botocore/urllib3 are extremely chatty at DEBUG (every event handler,
    # every signing step). Pin them at WARNING so our DEBUG stays useful.
    for noisy in ("boto3", "botocore", "urllib3", "s3transfer"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ]
    )


def main() -> None:
    cfg = load()
    print_banner(cfg)
    configure_logging(cfg.log_level)
    log = structlog.get_logger()
    log.info(
        "shelter starting",
        env=cfg.env,
        vehicle_id=cfg.vehicle_id,
        batch_size=cfg.batch_size,
        s3_uri=cfg.s3_uri,
        idle_sleep_s=cfg.idle_sleep_s,
    )

    s3 = boto3.client(
        "s3",
        region_name=cfg.s3_region,
        aws_access_key_id=cfg.aws_access_key_id,
        aws_secret_access_key=cfg.aws_secret_access_key,
    )

    last_batch_done = time.monotonic()
    while True:
        idle_s = round(time.monotonic() - last_batch_done, 3)
        claim_id = int(time.time() * 1000)
        batch_id = ulid.make()
        ctx = log.bind(claim_id=claim_id, batch_id=str(batch_id))
        try:
            ctx.debug("claiming batch", limit=cfg.batch_size, idle_s=idle_s)
            t0 = time.monotonic()
            df = claim_batch(cfg.pg_uri, claim_id, cfg.batch_size)
            claim_s = round(time.monotonic() - t0, 3)

            if df.is_empty():
                ctx.debug("no unsynced rows, idling", claim_s=claim_s)
                time.sleep(cfg.idle_sleep_s)
                continue

            est_mb = round(df.estimated_size() / 1_048_576, 2)
            ctx.info("claimed", rows=len(df), claim_s=claim_s, est_mb=est_mb, idle_s=idle_s)

            t1 = time.monotonic()
            key = upload(df, cfg, batch_id)
            upload_s = round(time.monotonic() - t1, 3)

            parsed = urlparse(key)
            head = s3.head_object(Bucket=parsed.netloc, Key=parsed.path.lstrip("/"))
            compressed_mb = round(head["ContentLength"] / 1_048_576, 2)
            ratio = round(est_mb / compressed_mb, 2) if compressed_mb > 0 else None
            upload_mbps = round(compressed_mb / upload_s, 2) if upload_s > 0 else None

            ctx.info(
                "uploaded",
                rows=len(df),
                key=key,
                upload_s=upload_s,
                total_s=round(claim_s + upload_s, 3),
                est_mb=est_mb,
                compressed_mb=compressed_mb,
                compression_ratio=ratio,
                upload_mbps=upload_mbps,
            )
            last_batch_done = time.monotonic()
        except Exception as e:
            ctx.error("batch failed, rolling back", error=str(e))
            try:
                affected = rollback_batch(cfg.pg_uri, claim_id)
                ctx.info("rolled back", rows=affected)
            except Exception as roll_err:
                ctx.error("rollback failed", error=str(roll_err))
            time.sleep(cfg.error_backoff_s)


if __name__ == "__main__":
    main()
