import adbc_driver_postgresql.dbapi as adbc

from model.segment import Segment


# Mirrors the gr26_message store-and-forward pattern: synced = 0 is pending,
# synced = <claim_id> is claimed/uploaded. Owned by this service rather than
# the Go relay's AutoMigrate since vision is the only writer.
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS gr26_video_segment (
    id          TEXT PRIMARY KEY,
    vehicle_id  TEXT   NOT NULL,
    start_ts    BIGINT NOT NULL,
    duration_ms INTEGER NOT NULL,
    width       INTEGER NOT NULL,
    height      INTEGER NOT NULL,
    fps         INTEGER NOT NULL,
    codec       TEXT   NOT NULL,
    local_path  TEXT,
    size_bytes  BIGINT NOT NULL,
    s3_key      TEXT,
    synced      BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gr26_video_segment_unsynced_ts
    ON gr26_video_segment (start_ts) WHERE synced = 0;
"""

INSERT_SQL = """
INSERT INTO gr26_video_segment
    (id, vehicle_id, start_ts, duration_ms, width, height, fps, codec,
     local_path, size_bytes, synced)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
ON CONFLICT (id) DO NOTHING;
"""

CLAIM_SQL = """
WITH claim AS (
    UPDATE gr26_video_segment
       SET synced = $1
     WHERE ctid IN (
         SELECT ctid FROM gr26_video_segment
          WHERE synced = 0
          ORDER BY start_ts
          LIMIT $2
          FOR UPDATE SKIP LOCKED
     )
    RETURNING id, start_ts, duration_ms, local_path, size_bytes
)
SELECT * FROM claim ORDER BY start_ts;
"""

SET_UPLOADED_SQL = (
    "UPDATE gr26_video_segment SET s3_key = $2, local_path = NULL WHERE id = $1;"
)
ROLLBACK_SQL = "UPDATE gr26_video_segment SET synced = 0 WHERE id = $1;"
PENDING_COUNT_SQL = "SELECT COUNT(*) FROM gr26_video_segment WHERE synced = 0;"
PENDING_BYTES_SQL = (
    "SELECT COALESCE(SUM(size_bytes), 0) FROM gr26_video_segment WHERE synced = 0;"
)
OLDEST_PENDING_SQL = """
SELECT id, local_path, size_bytes
  FROM gr26_video_segment
 WHERE synced = 0
 ORDER BY start_ts ASC;
"""
DELETE_SQL = "DELETE FROM gr26_video_segment WHERE id = $1;"


def ensure_schema(conn_uri: str) -> None:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        for stmt in filter(str.strip, SCHEMA_SQL.split(";")):
            cur.execute(stmt)
        conn.commit()


def insert_segment(
    conn_uri: str,
    *,
    seg_id: str,
    vehicle_id: str,
    start_ts: int,
    duration_ms: int,
    width: int,
    height: int,
    fps: int,
    codec: str,
    local_path: str,
    size_bytes: int,
) -> None:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(
            INSERT_SQL,
            (
                seg_id,
                vehicle_id,
                start_ts,
                duration_ms,
                width,
                height,
                fps,
                codec,
                local_path,
                size_bytes,
            ),
        )
        conn.commit()


def claim_segments(conn_uri: str, claim_id: int, limit: int) -> list[Segment]:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(CLAIM_SQL, (claim_id, limit))
        rows = cur.fetchall()
        conn.commit()
        return [
            Segment(
                id=r[0],
                start_ts=int(r[1]),
                duration_ms=int(r[2]),
                local_path=r[3],
                size_bytes=int(r[4]),
            )
            for r in rows
        ]


def set_uploaded(conn_uri: str, seg_id: str, s3_key: str) -> None:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(SET_UPLOADED_SQL, (seg_id, s3_key))
        conn.commit()


def rollback_segment(conn_uri: str, seg_id: str) -> None:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(ROLLBACK_SQL, (seg_id,))
        conn.commit()


def pending_count(conn_uri: str) -> int:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(PENDING_COUNT_SQL)
        (count,) = cur.fetchone()
        return int(count)


def pending_bytes(conn_uri: str) -> int:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(PENDING_BYTES_SQL)
        (total,) = cur.fetchone()
        return int(total)


def oldest_pending(conn_uri: str) -> list[tuple[str, str | None, int]]:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(OLDEST_PENDING_SQL)
        return [(r[0], r[1], int(r[2])) for r in cur.fetchall()]


def delete_segment(conn_uri: str, seg_id: str) -> None:
    with adbc.connect(conn_uri) as conn:
        cur = conn.cursor()
        cur.execute(DELETE_SQL, (seg_id,))
        conn.commit()
