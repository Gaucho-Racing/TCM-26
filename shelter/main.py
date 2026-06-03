import logging
import sys
import time

import structlog
import ulid

from config.config import load
from database.db import claim_batch, rollback_batch
from service.upload import upload


def configure_logging(level: str) -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level)
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ]
    )


def main() -> None:
    cfg = load()
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

    while True:
        claim_id = int(time.time() * 1000)
        batch_id = ulid.make()
        ctx = log.bind(claim_id=claim_id, batch_id=str(batch_id))
        try:
            ctx.debug("claiming batch", limit=cfg.batch_size)
            t0 = time.monotonic()
            df = claim_batch(cfg.pg_uri, claim_id, cfg.batch_size)
            claim_s = round(time.monotonic() - t0, 3)

            if df.is_empty():
                ctx.debug("no unsynced rows, idling", claim_s=claim_s)
                time.sleep(cfg.idle_sleep_s)
                continue

            est_mb = round(df.estimated_size() / 1_048_576, 2)
            ctx.info("claimed", rows=len(df), claim_s=claim_s, est_mb=est_mb)

            t1 = time.monotonic()
            key = upload(df, cfg, batch_id)
            upload_s = round(time.monotonic() - t1, 3)
            ctx.info("uploaded", rows=len(df), key=key, upload_s=upload_s, total_s=round(claim_s + upload_s, 3))
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
