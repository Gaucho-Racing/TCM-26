import adbc_driver_postgresql.dbapi as adbc
import polars as pl


CLAIM_SQL = """
WITH claim AS (
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
SELECT * FROM claim;
"""

ROLLBACK_SQL = """
WITH rolled AS (
    UPDATE gr26_message SET synced = 0 WHERE synced = $1 RETURNING 1
)
SELECT COUNT(*) FROM rolled;
"""


def claim_batch(conn_uri: str, claim_id: int, batch_size: int) -> pl.DataFrame:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(CLAIM_SQL, (claim_id, batch_size))
        table = cur.fetch_arrow_table()
        conn.commit()
        return pl.from_arrow(table)


def rollback_batch(conn_uri: str, claim_id: int) -> int:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(ROLLBACK_SQL, (claim_id,))
        (count,) = cur.fetchone()
        conn.commit()
        return int(count)
