import logging
import sys
from importlib.metadata import PackageNotFoundError, version

import boto3
from loguru import logger

from config.config import Config, load
from database.db import ensure_schema
from service.heartbeat import start_heartbeat
from service.recorder import start_recorder
from service.uploader import start_uploader
from service.state import VisionStatus


try:
    VERSION = version("vision")
except PackageNotFoundError:
    VERSION = "dev"


def print_banner(cfg: Config) -> None:
    print("\033[1;96mVISION\033[0m")
    print(f"\033[1;36mRunning v{VERSION} [ENV: {cfg.env}]\033[0m")
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
        f"vision starting (vehicle_id={cfg.vehicle_id}, device={cfg.device}, "
        f"{cfg.crop}@{cfg.fps}fps {cfg.bitrate}, segment_time={cfg.segment_time}s, "
        f"s3_uri={cfg.s3_uri}, upload_ifaces={cfg.upload_ifaces})"
    )

    ensure_schema(cfg.pg_uri)

    s3 = boto3.client(
        "s3",
        region_name=cfg.s3_region,
        aws_access_key_id=cfg.aws_access_key_id,
        aws_secret_access_key=cfg.aws_secret_access_key,
    )

    status = VisionStatus()
    start_heartbeat(cfg, status)
    start_recorder(cfg, status)
    start_uploader(cfg, s3, status)


if __name__ == "__main__":
    main()
