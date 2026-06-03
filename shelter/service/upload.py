import polars as pl
import ulid

from config.config import Config


def upload(df: pl.DataFrame, cfg: Config, batch_id: ulid.ULID) -> str:
    prefix = cfg.s3_uri.rstrip("/")
    key = f"{prefix}/{batch_id.prefixed('batch')}.parquet"
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
