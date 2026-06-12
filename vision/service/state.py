from enum import IntEnum
from threading import Lock


class UploadState(IntEnum):
    IDLE = 0
    UPLOADING = 1
    GATED = 2
    ERROR = 3


class VisionStatus:
    """Thread-safe view shared between the recorder thread, the uploader loop,
    and the heartbeat thread."""

    def __init__(self) -> None:
        self.recording: bool = False
        self.upload: UploadState = UploadState.IDLE
        self.pending: int = 0
        self._lock = Lock()

    def set(
        self,
        *,
        recording: bool | None = None,
        upload: UploadState | None = None,
        pending: int | None = None,
    ) -> None:
        with self._lock:
            if recording is not None:
                self.recording = recording
            if upload is not None:
                self.upload = upload
            if pending is not None:
                self.pending = pending

    def snapshot(self) -> tuple[bool, UploadState, int]:
        with self._lock:
            return self.recording, self.upload, self.pending
