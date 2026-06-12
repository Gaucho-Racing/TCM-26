import socket
import struct
import threading
import time

from loguru import logger

from config.config import Config
from service.state import VisionStatus

# CAN IDs (nodeID=0x04 tcm, targetID=0x00): (nodeID << 20) | (msgID << 8) | targetID.
# Follows shelter's 0x210/0x211; vision takes the next free msgID.
VISION_HEARTBEAT_CAN_ID = 0x00421200  # msgID=0x212

# icanspi-compatible wire format expected by mqtt's ListenCAN (72 bytes):
#   [0:4] canID u32 LE, [4] bus u8 (0xFF virtual), [5] length u8, [6:] payload.
PACKET_SIZE = 72


def _build_packet(can_id: int, payload: bytes) -> bytes:
    buf = bytearray(PACKET_SIZE)
    struct.pack_into("<I", buf, 0, can_id)
    buf[4] = 0xFF
    buf[5] = len(payload)
    buf[6 : 6 + len(payload)] = payload
    return bytes(buf)


def start_heartbeat(cfg: Config, status: VisionStatus) -> None:
    """Emit tcm_vision_heartbeat (0x212) every cfg.heartbeat_interval seconds.
    Payload (8 bytes): recording u8, upload_state u8, pending u32."""
    def run() -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        logger.info(
            f"heartbeat thread started: interval={cfg.heartbeat_interval}s -> "
            f"udp/{cfg.virtual_can_port}"
        )
        while True:
            recording, upload, pending = status.snapshot()
            payload = struct.pack(
                "<BBI2x",
                1 if recording else 0,
                int(upload) & 0xFF,
                pending & 0xFFFFFFFF,
            )
            try:
                sock.sendto(
                    _build_packet(VISION_HEARTBEAT_CAN_ID, payload),
                    ("127.0.0.1", cfg.virtual_can_port),
                )
            except Exception as e:
                logger.error(f"heartbeat send failed: {e}")
            time.sleep(cfg.heartbeat_interval)

    threading.Thread(target=run, daemon=True, name="vision-heartbeat").start()
