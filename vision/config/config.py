import os
from dataclasses import dataclass
from urllib.parse import quote


@dataclass(frozen=True)
class Config:
    env: str
    pg_uri: str
    vehicle_id: str

    s3_uri: str
    s3_region: str
    aws_access_key_id: str
    aws_secret_access_key: str

    # Capture / encode. The on-car camera is a USB (UVC) ZED 2i in HD720: the
    # camera exposes a single side-by-side frame (2*1280 x 720), so we crop
    # the left eye and software-encode it (the Orin Nano has no NVENC).
    #
    # device empty -> auto-discover by matching camera_match against v4l2
    # device names across /dev/video* (the ZED 2i exposes multiple nodes,
    # only one of which is the actual capture node). A non-empty device pins
    # that node and skips discovery. No fallback to non-ZED cameras.
    device: str
    camera_match: str
    # capture_backend: v4l2 (on-car), test (lavfi synthetic source — runs
    # anywhere, exercises the full encode/segment/upload path), or avfoundation
    # (native Mac webcam when running the service outside Docker).
    capture_backend: str
    av_device: str
    capture_size: str
    capture_format: str
    capture_fps: int
    crop: str
    fps: int
    bitrate: str
    maxrate: str
    bufsize: str
    x264_preset: str
    segment_time: int
    output_dir: str

    # Upload. upload_enabled=false pauses S3 uploads entirely (the local
    # budget still evicts oldest segments so disk stays bounded); recording
    # continues regardless.
    upload_enabled: bool
    upload_batch: int
    max_local_bytes: int
    idle_sleep: float
    error_backoff: float
    startup_delay: float

    log_level: str
    virtual_can_port: int
    heartbeat_interval: float


_ENV_LOG_LEVEL = {"DEV": "DEBUG", "PROD": "INFO"}


def _env(name: str, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if val is None:
        raise RuntimeError(f"missing required env var: {name}")
    return val


def load() -> Config:
    env = _env("ENV", "PROD")
    return Config(
        env=env,
        pg_uri=(
            f"postgresql://{quote(_env('DATABASE_USER'), safe='')}"
            f":{quote(_env('DATABASE_PASSWORD'), safe='')}"
            f"@{_env('DATABASE_HOST')}:{_env('DATABASE_PORT', '5432')}"
            f"/{_env('DATABASE_NAME')}"
        ),
        vehicle_id=_env("VEHICLE_ID"),
        s3_uri=_env("S3_URI"),
        s3_region=_env("S3_REGION", "us-west-2"),
        aws_access_key_id=_env("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=_env("AWS_SECRET_ACCESS_KEY"),
        device=_env("DEVICE", ""),
        camera_match=_env("CAMERA_MATCH", "ZED 2i"),
        capture_backend=_env("CAPTURE_BACKEND", "v4l2"),
        av_device=_env("AV_DEVICE", "0"),
        capture_size=_env("CAPTURE_SIZE", "2560x720"),
        capture_format=_env("CAPTURE_FORMAT", "yuyv422"),
        capture_fps=int(_env("CAPTURE_FPS", "30")),
        crop=_env("CROP", "1280:720:0:0"),
        fps=int(_env("FPS", "30")),
        bitrate=_env("BITRATE", "5M"),
        # maxrate/bufsize cap the VBR spikes on high-motion segments so
        # segment size (and per-segment upload time) stays bounded.
        maxrate=_env("MAXRATE", _env("BITRATE", "5M")),
        bufsize=_env("BUFSIZE", "10M"),
        x264_preset=_env("X264_PRESET", "veryfast"),
        segment_time=int(_env("SEGMENT_TIME", "4")),
        output_dir=_env("OUTPUT_DIR", "/data"),
        upload_enabled=_env("UPLOAD_ENABLED", "true").lower()
        in ("1", "true", "yes", "on"),
        upload_batch=int(_env("UPLOAD_BATCH", "32")),
        max_local_bytes=int(_env("MAX_LOCAL_BYTES", str(100 * 1024**3))),
        idle_sleep=float(_env("IDLE_SLEEP", "30")),
        error_backoff=float(_env("ERROR_BACKOFF", "60")),
        startup_delay=float(_env("STARTUP_DELAY", "10")),
        log_level=_ENV_LOG_LEVEL.get(env.upper(), "INFO"),
        virtual_can_port=int(_env("VIRTUAL_CAN_PORT", "8100")),
        heartbeat_interval=float(_env("HEARTBEAT_INTERVAL", "5")),
    )
