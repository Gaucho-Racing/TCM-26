from dataclasses import dataclass


@dataclass(frozen=True)
class Segment:
    """A finalized video segment claimed for upload. start_ts is absolute
    unix microseconds, matching gr26_message.timestamp so the dashboard can
    align video to CAN data on the same clock."""

    id: str
    start_ts: int
    duration_ms: int
    local_path: str
    size_bytes: int
