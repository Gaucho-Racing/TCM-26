import logging
import sys
from importlib.metadata import PackageNotFoundError, version

import boto3
from loguru import logger

from config.config import Config, load
from service.runner import start_runner


try:
    VERSION = version("shelter")
except PackageNotFoundError:
    VERSION = "dev"


def print_banner(cfg: Config) -> None:
    print("\033[1;95mEPIC SHELTER\033[0m")
    print(f"\033[1;35mRunning v{VERSION} [ENV: {cfg.env}]\033[0m")
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
        f"shelter starting (vehicle_id={cfg.vehicle_id}, batch_size={cfg.batch_size}, "
        f"max_batch_age={cfg.max_batch_age}, s3_uri={cfg.s3_uri}, "
        f"idle_sleep={cfg.idle_sleep})"
    )

    s3 = boto3.client(
        "s3",
        region_name=cfg.s3_region,
        aws_access_key_id=cfg.aws_access_key_id,
        aws_secret_access_key=cfg.aws_secret_access_key,
    )

    start_runner(cfg, s3)


if __name__ == "__main__":
    main()
