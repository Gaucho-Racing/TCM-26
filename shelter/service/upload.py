import polars as pl
import ulid

from config.config import Config


def upload(df: pl.DataFrame, cfg: Config, batch_id: ulid.ULID) -> str:
    # Per-vehicle subdir so two cars on the same tcm class can run
    # concurrently without colliding (and IAM/analytics can scope per
    # vehicle later without rewriting the prefix scheme).
    prefix = cfg.s3_uri.rstrip("/")
    key = f"{prefix}/{cfg.vehicle_id}/{batch_id.prefixed('batch')}.parquet"
    df.write_parquet(
        key,
        compression="zstd",
        compression_level=3,
        statistics=True,
        storage_options={
            "aws_region": cfg.s3_region,
            "aws_access_key_id": cfg.aws_access_key_id,
            "aws_secret_access_key": cfg.aws_secret_access_key,
        },
    )
    return key
