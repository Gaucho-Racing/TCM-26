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
    batch_size: int
    max_batch_age: float
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
        # URL-encode user/password since either may contain reserved URI
        # chars (e.g. '@' in our prod password). Without this, the first
        # '@' in the password gets parsed as the host delimiter and adbc
        # tries to resolve garbage as a hostname.
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
        batch_size=int(_env("BATCH_SIZE", "100000")),
        max_batch_age=float(_env("MAX_BATCH_AGE", "300")),
        idle_sleep=float(_env("IDLE_SLEEP", "30")),
        error_backoff=float(_env("ERROR_BACKOFF", "60")),
        startup_delay=float(_env("STARTUP_DELAY", "10")),
        log_level=_ENV_LOG_LEVEL.get(env.upper(), "INFO"),
        virtual_can_port=int(_env("VIRTUAL_CAN_PORT", "8100")),
        heartbeat_interval=float(_env("HEARTBEAT_INTERVAL", "5")),
    )
