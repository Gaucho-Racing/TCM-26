import time
from urllib.parse import urlparse

import ulid
from loguru import logger

from config.config import Config
from database.db import claim_batch, pending_count, rollback_batch
from service.heartbeat import send_batch
from service.state import ShelterStatus, State
from service.upload import upload


def run_batch(cfg: Config, s3, trigger: str, status: ShelterStatus) -> bool:
    """Claim one batch, upload it, log throughout. Rolls back on failure.
    Returns True on successful upload, False otherwise. Updates `status`
    so the heartbeat thread reflects the current phase."""
    claim_id = int(time.time() * 1000)
    batch_id = ulid.make()
    try:
        status.set(state=State.CLAIMING)
        logger.debug(f"[{batch_id}] claiming batch (trigger={trigger})")
        t0 = time.monotonic()
        df = claim_batch(cfg.pg_uri, claim_id, cfg.batch_size)
        claim_s = round(time.monotonic() - t0, 3)

        if df.is_empty():
            logger.debug(f"[{batch_id}] race: nothing claimed (claim_s={claim_s})")
            return False

        est_mb = round(df.estimated_size() / 1_048_576, 2)
        logger.info(
            f"[{batch_id}] claimed {len(df)} rows in {claim_s}s "
            f"({est_mb} MB, trigger={trigger})"
        )

        status.set(state=State.UPLOADING)
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
        send_batch(
            cfg,
            rows=len(df),
            compressed_bytes=head["ContentLength"],
            upload_ms=int(upload_s * 1000),
            claim_ms=int(claim_s * 1000),
            ratio_x100=int(ratio * 100),
            trigger=trigger,
        )
        return True
    except Exception as e:
        logger.error(f"[{batch_id}] batch failed: {e}")
        try:
            affected = rollback_batch(cfg.pg_uri, claim_id)
            logger.info(f"[{batch_id}] rolled back {affected} rows")
        except Exception as roll_err:
            logger.error(f"[{batch_id}] rollback failed: {roll_err}")
        return False


def _next_trigger(pending: int, elapsed: float, cfg: Config) -> str | None:
    """Return 'size' / 'age' if a claim should fire now, else None."""
    if pending >= cfg.batch_size:
        return "size"
    if pending > 0 and elapsed >= cfg.max_batch_age:
        return "age"
    return None


def start_runner(cfg: Config, s3, status: ShelterStatus) -> None:
    """Drain any existing backlog, then poll-and-batch by size or age."""
    initial_pending = pending_count(cfg.pg_uri)
    status.set(pending=initial_pending)
    if initial_pending > 0:
        logger.info(f"startup: {initial_pending} unsynced rows pending, draining")
        run_batch(cfg, s3, "startup", status)

    last_batch_done = time.monotonic()
    while True:
        try:
            elapsed = round(time.monotonic() - last_batch_done, 3)
            pending = pending_count(cfg.pg_uri)
            status.set(pending=pending)
            trigger = _next_trigger(pending, elapsed, cfg)
            if trigger is None:
                status.set(state=State.IDLE)
                logger.debug(
                    f"waiting: pending={pending}/{cfg.batch_size} "
                    f"elapsed={elapsed}s/{cfg.max_batch_age}s"
                )
                time.sleep(cfg.idle_sleep)
                continue

            ok = run_batch(cfg, s3, trigger, status)
            if ok:
                last_batch_done = time.monotonic()
            else:
                status.set(state=State.ERROR)
                time.sleep(cfg.error_backoff)
        except Exception as e:
            status.set(state=State.ERROR)
            logger.error(f"loop iteration failed: {e}")
            time.sleep(cfg.error_backoff)
