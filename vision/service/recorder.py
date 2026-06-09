import os
import subprocess
import threading
import time
from glob import glob

import ulid
from loguru import logger

from config.config import Config
from database.db import insert_segment
from service.net import clock_plausible
from service.state import VisionStatus

# A bad device (dead node, or a metadata-only node that isn't a video capture
# device) makes ffmpeg exit within a second or two. If ffmpeg is still alive
# after this grace window we treat the candidate as good and commit to it.
STARTUP_GRACE_SEC = 3.0


def _crop_dims(crop: str) -> tuple[int, int]:
    w, h = crop.split(":")[:2]
    return int(w), int(h)


def _v4l2_name(idx: int) -> str:
    try:
        with open(f"/sys/class/video4linux/video{idx}/name") as f:
            return f.read().strip()
    except OSError:
        return ""


def discover_devices(cfg: Config) -> list[tuple[str, bool, str]]:
    """Ordered capture candidates as (device, stereo, name). An explicit DEVICE
    overrides discovery. Otherwise we enumerate /dev/video*, putting name-matched
    (ZED) nodes first and using their stereo geometry; remaining cameras follow
    as generic fallbacks (no stereo crop) when ALLOW_ANY_CAMERA is set."""
    if cfg.device:
        return [(cfg.device, True, "explicit")] if os.path.exists(cfg.device) else []

    indices = []
    for path in glob("/sys/class/video4linux/video*"):
        try:
            indices.append(int(path.rsplit("video", 1)[1]))
        except ValueError:
            continue
    indices.sort()

    match = cfg.camera_match.lower()
    zed: list[tuple[str, bool, str]] = []
    other: list[tuple[str, bool, str]] = []
    for idx in indices:
        dev = f"/dev/video{idx}"
        name = _v4l2_name(idx)
        if match and match in name.lower():
            zed.append((dev, True, name))
        else:
            other.append((dev, False, name))

    return zed + other if cfg.allow_any_camera else zed


def _input_args(cfg: Config, source: str, stereo: bool) -> list[str]:
    if cfg.capture_backend == "test":
        # Synthetic source paced to realtime (-re) so segments finalize and
        # upload on the same cadence as a real camera. Sized like the ZED so
        # the stereo crop path is exercised too.
        return [
            "-re", "-f", "lavfi",
            "-i", f"testsrc2=size={cfg.capture_size}:rate={cfg.capture_fps}",
        ]
    if cfg.capture_backend == "avfoundation":
        return [
            "-f", "avfoundation", "-framerate", str(cfg.capture_fps),
            "-i", f"{source}:none",
        ]
    # v4l2
    if stereo:
        # ZED side-by-side frame: fix the capture format/size and crop the left
        # eye.
        return [
            "-f", "v4l2",
            "-input_format", cfg.capture_format,
            "-video_size", cfg.capture_size,
            "-framerate", str(cfg.capture_fps),
            "-i", source,
        ]
    # Unknown fallback camera: let the device negotiate its native format.
    return ["-f", "v4l2", "-i", source]


def _build_cmd(
    cfg: Config, run_dir: str, source: str, stereo: bool
) -> tuple[list[str], str]:
    seg_pattern = os.path.join(run_dir, "seg_%05d.ts")
    list_path = os.path.join(run_dir, "segments.csv")
    input_args = _input_args(cfg, source, stereo)
    # stereo -> crop the left eye; otherwise scale to 720p (even width).
    vf = f"crop={cfg.crop},fps={cfg.fps}" if stereo else f"fps={cfg.fps},scale=-2:720"

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning", "-nostdin",
        "-progress", "pipe:1", "-nostats",
        *input_args,
        "-filter:v", vf,
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


def _log_progress(proc: subprocess.Popen, cfg: Config) -> None:
    """Parse ffmpeg's -progress stream and emit a throttled health line. The
    headline is `speed`: < 1.0x means software encode can't keep up with the
    camera in realtime and capture frames are being dropped — the one-glance
    on-car check that 720p@{fps} fits the Orin Nano's CPU alongside the dash."""
    fields: dict[str, str] = {}
    last_log = 0.0
    for raw in iter(proc.stdout.readline, b""):
        key, _, val = raw.decode(errors="replace").strip().partition("=")
        if not _:
            continue
        fields[key] = val
        if key != "progress":
            continue
        now = time.monotonic()
        if val != "end" and now - last_log < 10:
            continue
        last_log = now
        speed = fields.get("speed", "?")
        behind = ""
        try:
            if float(speed.rstrip("x")) < 0.97:
                behind = "  <-- BEHIND REALTIME (dropping capture frames)"
        except ValueError:
            pass
        logger.info(
            f"encode: speed={speed} fps={fields.get('fps', '?')}/{cfg.fps} "
            f"frame={fields.get('frame', '?')} drop={fields.get('drop_frames', '0')} "
            f"dup={fields.get('dup_frames', '0')}{behind}"
        )


def _consume_segments(
    cfg: Config,
    run_dir: str,
    list_path: str,
    proc: subprocess.Popen,
    status: VisionStatus,
    width: int,
    height: int,
) -> None:
    """Tail ffmpeg's segment list. Each line (filename,start,end in stream
    seconds) is written when a segment is finalized. We anchor stream-time 0
    to wall-clock using the first finalized segment — anchor = now - end —
    which absorbs camera/pipeline startup latency. Per-segment offsets come
    from ffmpeg's own timestamps, so dropped frames never desync the
    timeline (no constant-fps assumption)."""
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


def _run_candidate(
    cfg: Config, device: str, stereo: bool, name: str, status: VisionStatus
) -> bool:
    """Start ffmpeg on one device. Returns True if it started and we ran it to
    exit (caller should re-discover), False if it failed startup (try next)."""
    run_dir = os.path.join(cfg.output_dir, f"run_{ulid.make()}")
    os.makedirs(run_dir, exist_ok=True)
    cmd, list_path = _build_cmd(cfg, run_dir, device, stereo)
    mode = "stereo left-eye crop" if stereo else f"generic 720p ({name or 'unknown'})"
    logger.info(f"trying capture: {cfg.capture_backend}:{device} [{mode}]")

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception as e:
        logger.error(f"spawn failed for {device}: {e}")
        return False

    threading.Thread(
        target=_drain_stderr, args=(proc,), daemon=True, name="vision-ffmpeg-stderr"
    ).start()

    time.sleep(STARTUP_GRACE_SEC)
    if proc.poll() is not None:
        logger.warning(
            f"{device} failed to start (rc={proc.returncode}); trying next candidate"
        )
        return False

    logger.info(f"capturing from {cfg.capture_backend}:{device} [{mode}] -> {run_dir}")
    status.set(recording=True)
    threading.Thread(
        target=_log_progress, args=(proc, cfg), daemon=True, name="vision-ffmpeg-progress"
    ).start()
    width, height = _crop_dims(cfg.crop) if stereo else (0, 720)
    try:
        _consume_segments(cfg, run_dir, list_path, proc, status, width, height)
        rc = proc.wait()
        logger.error(f"ffmpeg exited (rc={rc}); re-discovering after backoff")
    finally:
        status.set(recording=False)
    return True


def start_recorder(cfg: Config, status: VisionStatus) -> None:
    def run() -> None:
        while True:
            if cfg.capture_backend == "v4l2":
                candidates = discover_devices(cfg)
                if not candidates:
                    logger.warning(
                        f"no camera found (device='{cfg.device}', match='{cfg.camera_match}', "
                        f"allow_any={cfg.allow_any_camera}); retrying in {cfg.error_backoff}s"
                    )
                    time.sleep(cfg.error_backoff)
                    continue
            elif cfg.capture_backend == "test":
                candidates = [("testsrc2", True, "test pattern")]
            elif cfg.capture_backend == "avfoundation":
                candidates = [(cfg.av_device, False, f"avfoundation:{cfg.av_device}")]
            else:
                logger.error(f"unknown CAPTURE_BACKEND '{cfg.capture_backend}'")
                time.sleep(cfg.error_backoff)
                continue

            started = False
            for device, stereo, name in candidates:
                if _run_candidate(cfg, device, stereo, name, status):
                    started = True
                    break

            if not started:
                logger.warning(
                    f"no candidate started ({len(candidates)} tried); "
                    f"retrying in {cfg.error_backoff}s"
                )
            time.sleep(cfg.error_backoff)

    threading.Thread(target=run, daemon=True, name="vision-recorder").start()
