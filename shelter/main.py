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
    log.info("shelter starting", vehicle_id=cfg.vehicle_id, batch_size=cfg.batch_size)

    while True:
        batch_id = int(time.time() * 1000)
        batch_ulid = ulid.make()
        try:
            df = claim_batch(cfg.pg_uri, batch_id, cfg.batch_size)
            if df.is_empty():
                time.sleep(cfg.idle_sleep_s)
                continue
            key = upload(df, cfg, batch_ulid)
            log.info("uploaded", rows=len(df), key=key, batch_id=batch_id, batch_ulid=str(batch_ulid))
        except Exception as e:
            log.error("batch failed, rolling back", batch_id=batch_id, batch_ulid=str(batch_ulid), error=str(e))
            try:
                affected = rollback_batch(cfg.pg_uri, batch_id)
                log.info("rolled back", batch_id=batch_id, rows=affected)
            except Exception as roll_err:
                log.error("rollback failed", batch_id=batch_id, error=str(roll_err))
            time.sleep(cfg.error_backoff_s)


if __name__ == "__main__":
    main()
