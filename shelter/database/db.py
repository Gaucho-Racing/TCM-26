import adbc_driver_postgresql.dbapi as adbc
import polars as pl


CLAIM_SQL = """
WITH batch AS (
    UPDATE gr26_message
       SET synced = $1
     WHERE ctid IN (
         SELECT ctid FROM gr26_message
          WHERE synced = 0
          ORDER BY timestamp
          LIMIT $2
          FOR UPDATE SKIP LOCKED
     )
    RETURNING timestamp, vehicle_id, topic, data, source_node, target_node
)
SELECT * FROM batch;
"""

ROLLBACK_SQL = "UPDATE gr26_message SET synced = 0 WHERE synced = $1"


def claim_batch(conn_uri: str, batch_id: int, batch_size: int) -> pl.DataFrame:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(CLAIM_SQL, (batch_id, batch_size))
        table = cur.fetch_arrow_table()
        conn.commit()
        return pl.from_arrow(table)


def rollback_batch(conn_uri: str, batch_id: int) -> int:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(ROLLBACK_SQL, (batch_id,))
        affected = cur.rowcount
        conn.commit()
        return affected
