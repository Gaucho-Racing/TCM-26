from enum import IntEnum
from threading import Lock


class State(IntEnum):
    IDLE = 0
    CLAIMING = 1
    UPLOADING = 2
    ERROR = 3


class ShelterStatus:
    """Thread-safe view of shelter's current phase and queue depth, shared
    between the runner loop (writer) and the heartbeat thread (reader)."""

    def __init__(self) -> None:
        self.state: State = State.IDLE
        self.pending: int = 0
        self._lock = Lock()

    def set(self, *, state: State | None = None, pending: int | None = None) -> None:
        with self._lock:
            if state is not None:
                self.state = state
            if pending is not None:
                self.pending = pending

    def snapshot(self) -> tuple[State, int]:
        with self._lock:
            return self.state, self.pending
