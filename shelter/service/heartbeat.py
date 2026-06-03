import socket
import struct
import threading
import time

from loguru import logger

from config.config import Config
from service.state import ShelterStatus

# CAN ID for tcm_shelter_heartbeat: nodeID=0x04 (tcm), msgID=0x210, targetID=0x00.
#   (0x04 << 20) | (0x210 << 8) | 0x00 = 0x00421000
SHELTER_CAN_ID = 0x00421000

# Wire format expected by mqtt's ListenCAN (icanspi-compatible, 72 bytes):
#   [0:4]    canID         u32 LE
#   [4]      bus           u8   (0xFF for virtual)
#   [5]      length        u8
#   [6:6+L]  payload
#   [...]    zero-padded to 72 bytes
PACKET_SIZE = 72


def _build_packet(state: int, pending: int) -> bytes:
    buf = bytearray(PACKET_SIZE)
    struct.pack_into("<I", buf, 0, SHELTER_CAN_ID)
    buf[4] = 0xFF
    buf[5] = 8
    buf[6] = state & 0xFF
    struct.pack_into("<I", buf, 7, pending & 0xFFFFFFFF)
    # bytes [11:14] are reserved in the payload, [14:72] is the wire padding.
    return bytes(buf)


def start_heartbeat(cfg: Config, status: ShelterStatus) -> None:
    """Spawn a daemon thread that emits tcm_shelter_heartbeat every
    cfg.heartbeat_interval seconds to the configured virtual CAN endpoint."""
    def run() -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Always loopback — shelter and tcm-mqtt share the host network namespace.
        addr = ("127.0.0.1", cfg.virtual_can_port)
        logger.info(
            f"heartbeat thread started: interval={cfg.heartbeat_interval}s -> "
            f"udp/{cfg.virtual_can_port}"
        )
        while True:
            state, pending = status.snapshot()
            packet = _build_packet(int(state), pending)
            try:
                sock.sendto(packet, addr)
            except Exception as e:
                logger.error(f"heartbeat send failed: {e}")
            time.sleep(cfg.heartbeat_interval)

    threading.Thread(target=run, daemon=True, name="shelter-heartbeat").start()
