import os
import subprocess
import threading
import time

import ulid
from loguru import logger

from config.config import Config
from database.db import insert_segment
from service.net import clock_plausible
from service.state import VisionStatus


def _crop_dims(crop: str) -> tuple[int, int]:
    w, h = crop.split(":")[:2]
    return int(w), int(h)


def _build_cmd(cfg: Config, run_dir: str) -> tuple[list[str], str]:
    seg_pattern = os.path.join(run_dir, "seg_%05d.ts")
    list_path = os.path.join(run_dir, "segments.csv")
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning", "-nostdin",
        "-f", "v4l2",
        "-input_format", cfg.capture_format,
        "-video_size", cfg.capture_size,
        "-framerate", str(cfg.capture_fps),
        "-i", cfg.device,
        "-filter:v", f"crop={cfg.crop},fps={cfg.fps}",
        "-c:v", "libx264",
        "-preset", cfg.x264_preset,
        "-b:v", cfg.bitrate,
        "-maxrate", cfg.maxrate,
        "-bufsize", cfg.bufsize,
        # Pin a keyframe at each segment boundary so every segment starts
        # independently seekable and runs ~segment_time (the first GOP with
        # B-frames runs a bit long — harmless, we record each segment's true
        # duration from the csv and HLS carries per-segment EXTINF). -g adds a
        # mid-segment keyframe for snappier scrubbing.
        "-force_key_frames", f"expr:gte(t,n_forced*{cfg.segment_time})",
        "-g", str(cfg.fps * 2),
        "-pix_fmt", "yuv420p",
        "-f", "segment",
        "-segment_time", str(cfg.segment_time),
        "-segment_format", "mpegts",
        "-reset_timestamps", "1",
        "-segment_list", list_path,
        "-segment_list_type", "csv",
        seg_pattern,
    ]
    return cmd, list_path


def _drain_stderr(proc: subprocess.Popen) -> None:
    for line in iter(proc.stderr.readline, b""):
        logger.warning(f"ffmpeg: {line.decode(errors='replace').rstrip()}")


def _consume_segments(
    cfg: Config, run_dir: str, list_path: str, proc: subprocess.Popen, status: VisionStatus
) -> None:
    """Tail ffmpeg's segment list. Each line (filename,start,end in stream
    seconds) is written when a segment is finalized. We anchor stream-time 0
    to wall-clock using the first finalized segment — anchor = now - end —
    which absorbs camera/pipeline startup latency. Per-segment offsets come
    from ffmpeg's own timestamps, so dropped frames never desync the
    timeline (no constant-fps assumption)."""
    width, height = _crop_dims(cfg.crop)
    anchor_us: int | None = None

    while not os.path.exists(list_path):
        if proc.poll() is not None:
            return
        time.sleep(0.25)

    with open(list_path) as f:
        while True:
            line = f.readline()
            if not line:
                if proc.poll() is not None:
                    return
                time.sleep(0.25)
                continue
            parts = line.strip().split(",")
            if len(parts) != 3:
                continue
            name, start_s, end_s = parts
            start = float(start_s)
            end = float(end_s)
            now_us = int(time.time() * 1_000_000)
            if anchor_us is None:
                anchor_us = now_us - int(end * 1_000_000)
                if not clock_plausible():
                    logger.warning(
                        "system clock implausible at anchor; video timestamps "
                        "will be wrong until NTP/RTC syncs"
                    )
            path = os.path.join(run_dir, os.path.basename(name))
            try:
                size = os.path.getsize(path)
            except OSError:
                logger.warning(f"segment vanished before stat: {path}")
                continue
            insert_segment(
                cfg.pg_uri,
                seg_id=str(ulid.make()),
                vehicle_id=cfg.vehicle_id,
                start_ts=anchor_us + int(start * 1_000_000),
                duration_ms=int((end - start) * 1000),
                width=width,
                height=height,
                fps=cfg.fps,
                codec="h264",
                local_path=path,
                size_bytes=size,
            )
            logger.debug(f"recorded segment {os.path.basename(path)} ({size} B)")


def start_recorder(cfg: Config, status: VisionStatus) -> None:
    def run() -> None:
        while True:
            run_dir = os.path.join(cfg.output_dir, f"run_{ulid.make()}")
            os.makedirs(run_dir, exist_ok=True)
            cmd, list_path = _build_cmd(cfg, run_dir)
            logger.info(f"starting capture: {cfg.device} -> {run_dir}")
            try:
                proc = subprocess.Popen(
                    cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE
                )
                status.set(recording=True)
                threading.Thread(
                    target=_drain_stderr, args=(proc,), daemon=True
                ).start()
                _consume_segments(cfg, run_dir, list_path, proc, status)
                rc = proc.wait()
                logger.error(f"ffmpeg exited (rc={rc}); restarting after backoff")
            except Exception as e:
                logger.error(f"recorder failed: {e}")
            finally:
                status.set(recording=False)
            time.sleep(cfg.error_backoff)

    threading.Thread(target=run, daemon=True, name="vision-recorder").start()
