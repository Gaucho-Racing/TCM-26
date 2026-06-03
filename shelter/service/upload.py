from datetime import datetime, UTC

import polars as pl

from config.config import Config


def upload(df: pl.DataFrame, cfg: Config, batch_id: int) -> str:
    now = datetime.now(UTC)
    key = (
        f"s3://{cfg.s3_bucket}/vehicle_id={cfg.vehicle_id}"
        f"/date={now:%Y-%m-%d}/hour={now:%H}"
        f"/batch={batch_id}.parquet"
    )
    df.write_parquet(
        key,
        compression="zstd",
        compression_level=3,
        statistics=True,
        row_group_size=100_000,
        storage_options={
            "aws_region": cfg.s3_region,
            "aws_access_key_id": cfg.aws_access_key_id,
            "aws_secret_access_key": cfg.aws_secret_access_key,
        },
    )
    return key
