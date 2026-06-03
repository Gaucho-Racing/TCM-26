import polars as pl


GR26_MESSAGE_SCHEMA = pl.Schema(
    {
        "timestamp": pl.Int64,
        "vehicle_id": pl.Utf8,
        "topic": pl.Utf8,
        "data": pl.Binary,
        "source_node": pl.Utf8,
        "target_node": pl.Utf8,
    }
)
