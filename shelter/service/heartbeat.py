import socket
import struct
import threading
import time

from loguru import logger

from config.config import Config
from service.state import ShelterStatus

# CAN IDs (nodeID=0x04 tcm, targetID=0x00)
#   (nodeID << 20) | (msgID << 8) | targetID
SHELTER_HEARTBEAT_CAN_ID = 0x00421000  # msgID=0x210
SHELTER_BATCH_CAN_ID = 0x00421100      # msgID=0x211

# Wire format expected by mqtt's ListenCAN (icanspi-compatible, 72 bytes):
#   [0:4]    canID         u32 LE
#   [4]      bus           u8   (0xFF for virtual)
#   [5]      length        u8
#   [6:6+L]  payload
#   [...]    zero-padded to 72 bytes
PACKET_SIZE = 72

# String trigger names used in runner.py mapped to the u8 codes on the wire.
TRIGGER_CODES: dict[str, int] = {"size": 0, "age": 1, "startup": 2}


def _build_packet(can_id: int, payload: bytes) -> bytes:
    buf = bytearray(PACKET_SIZE)
    struct.pack_into("<I", buf, 0, can_id)
    buf[4] = 0xFF
    buf[5] = len(payload)
    buf[6 : 6 + len(payload)] = payload
    return bytes(buf)


def _send(sock: socket.socket, port: int, can_id: int, payload: bytes) -> None:
    try:
        sock.sendto(_build_packet(can_id, payload), ("127.0.0.1", port))
    except Exception as e:
        logger.error(f"can-out send failed for canID=0x{can_id:08x}: {e}")


# Module-level socket reused across one-shot sends (batch events, etc).
# UDP is stateless so this is safe and avoids per-call socket churn.
_oneshot_sock: socket.socket | None = None


def _get_oneshot_sock() -> socket.socket:
    global _oneshot_sock
    if _oneshot_sock is None:
        _oneshot_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    return _oneshot_sock


def send_batch(
    cfg: Config,
    *,
    rows: int,
    compressed_bytes: int,
    upload_ms: int,
    claim_ms: int,
    ratio_x100: int,
    trigger: str,
) -> None:
    """One-shot tcm_shelter_batch (0x211) — fired after each successful upload."""
    payload = struct.pack(
        "<IIHHHBB",
        rows & 0xFFFFFFFF,
        compressed_bytes & 0xFFFFFFFF,
        min(max(upload_ms, 0), 0xFFFF),
        min(max(claim_ms, 0), 0xFFFF),
        min(max(ratio_x100, 0), 0xFFFF),
        TRIGGER_CODES.get(trigger, 0xFF),
        0,  # reserved
    )
    _send(_get_oneshot_sock(), cfg.virtual_can_port, SHELTER_BATCH_CAN_ID, payload)


def start_heartbeat(cfg: Config, status: ShelterStatus) -> None:
    """Spawn a daemon thread that emits tcm_shelter_heartbeat (0x210) every
    cfg.heartbeat_interval seconds."""
    def run() -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        logger.info(
            f"heartbeat thread started: interval={cfg.heartbeat_interval}s -> "
            f"udp/{cfg.virtual_can_port}"
        )
        while True:
            state, pending = status.snapshot()
            payload = struct.pack("<BI3x", int(state) & 0xFF, pending & 0xFFFFFFFF)
            _send(sock, cfg.virtual_can_port, SHELTER_HEARTBEAT_CAN_ID, payload)
            time.sleep(cfg.heartbeat_interval)

    threading.Thread(target=run, daemon=True, name="shelter-heartbeat").start()
