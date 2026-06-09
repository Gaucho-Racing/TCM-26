import os
import time
from urllib.parse import urlparse

from loguru import logger

from config.config import Config
from database.db import (
    claim_segments,
    delete_segment,
    oldest_pending,
    pending_bytes,
    pending_count,
    rollback_segment,
    set_uploaded,
)
from model.segment import Segment
from service.net import internet_up, on_unmetered_network
from service.state import UploadState, VisionStatus


def _key_for(cfg: Config, seg: Segment) -> tuple[str, str]:
    """(bucket, key). start_ts prefix keeps the listing time-sortable so the
    cloud manifest builder can stitch segments without reading each file."""
    parsed = urlparse(cfg.s3_uri)
    base = parsed.path.strip("/")
    key = f"{base}/{cfg.vehicle_id}/video/{seg.start_ts}_{seg.id}.ts"
    return parsed.netloc, key


def _upload_one(s3, cfg: Config, seg: Segment) -> str:
    bucket, key = _key_for(cfg, seg)
    s3.upload_file(seg.local_path, bucket, key)
    return f"s3://{bucket}/{key}"


def enforce_local_budget(cfg: Config) -> None:
    """When offline the pending backlog can fill the disk and crash the
    recorder. Past the budget we drop the OLDEST pending segments (file +
    row) to keep recording the present — recent footage matters more than a
    backlog we may never get to upload."""
    total = pending_bytes(cfg.pg_uri)
    if total <= cfg.max_local_bytes:
        return
    logger.warning(
        f"local backlog {total} B over budget {cfg.max_local_bytes} B; dropping oldest"
    )
    for seg_id, path, size in oldest_pending(cfg.pg_uri):
        if total <= cfg.max_local_bytes:
            break
        if path:
            try:
                os.remove(path)
            except OSError:
                pass
        delete_segment(cfg.pg_uri, seg_id)
        total -= size
        logger.warning(f"dropped pending segment {seg_id} ({size} B)")


def run_once(cfg: Config, s3, status: VisionStatus) -> bool:
    if cfg.upload_require_unmetered and not on_unmetered_network(cfg.upload_ifaces):
        status.set(upload=UploadState.GATED)
        logger.info("upload gated: no unmetered network")
        return False
    if not internet_up():
        status.set(upload=UploadState.GATED)
        logger.info("upload gated: no internet")
        return False

    claim_id = int(time.time() * 1000)
    segs = claim_segments(cfg.pg_uri, claim_id, cfg.upload_batch)
    if not segs:
        return False

    status.set(upload=UploadState.UPLOADING)
    t0 = time.monotonic()
    ok = 0
    sent_bytes = 0
    for seg in segs:
        try:
            key = _upload_one(s3, cfg, seg)
            set_uploaded(cfg.pg_uri, seg.id, key)
            if seg.local_path:
                try:
                    os.remove(seg.local_path)
                except OSError:
                    pass
            ok += 1
            sent_bytes += seg.size_bytes
        except Exception as e:
            logger.error(f"segment {seg.id} upload failed: {e}")
            rollback_segment(cfg.pg_uri, seg.id)

    elapsed = round(time.monotonic() - t0, 3)
    mbps = round(sent_bytes / 1_048_576 / elapsed, 2) if elapsed > 0 else 0
    logger.info(
        f"uploaded {ok}/{len(segs)} segments "
        f"({round(sent_bytes / 1_048_576, 2)} MB, {mbps} MB/s, {elapsed}s)"
    )
    return ok > 0


def start_uploader(cfg: Config, s3, status: VisionStatus) -> None:
    if cfg.startup_delay > 0:
        logger.info(f"startup: sleeping {cfg.startup_delay}s before first upload pass")
        time.sleep(cfg.startup_delay)

    while True:
        try:
            enforce_local_budget(cfg)
            pending = pending_count(cfg.pg_uri)
            status.set(pending=pending)
            if pending == 0:
                status.set(upload=UploadState.IDLE)
                time.sleep(cfg.idle_sleep)
                continue

            ok = run_once(cfg, s3, status)
            if not ok:
                time.sleep(cfg.idle_sleep)
        except Exception as e:
            status.set(upload=UploadState.ERROR)
            logger.error(f"uploader loop failed: {e}")
            time.sleep(cfg.error_backoff)
