import math
import socket
import struct
import sys
import time

from pyaccsharedmemory import accSharedMemory

# CAN protocol constants
NODE_ID = 0x40
TARGET_ID = 0xFF
BUS = 0x00
CAN_FRAME_SIZE = 70  # 4 (CAN ID) + 1 (bus) + 1 (length) + 64 (payload, zero-padded)

# Message IDs
MSG_PHYSICS = 0x001
MSG_TIRES = 0x002
MSG_FUEL_LAP = 0x003
MSG_ENVIRONMENT = 0x004
MSG_STATUS = 0x005

# Default destination
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
POLL_INTERVAL = 0.1


def safe_float(val, default=0.0) -> float:
    """Convert to float, return default if None or NaN."""
    if val is None:
        return default
    f = float(val)
    if math.isnan(f) or math.isinf(f):
        return default
    return f


def safe_int(val, default=0) -> int:
    """Convert to int, return default if None."""
    if val is None:
        return default
    return int(val)


def safe_uint8(val, default=0) -> int:
    """Convert to uint8 [0, 255], clamped."""
    return max(0, min(255, safe_int(val, default)))


def safe_uint16(val, default=0) -> int:
    """Convert to uint16 [0, 65535], clamped."""
    return max(0, min(65535, safe_int(val, default)))


def enum_to_uint8(val, default=0) -> int:
    """Convert enum to uint8 via .value, fallback to default."""
    if val is None:
        return default
    if hasattr(val, 'value'):
        return safe_uint8(val.value, default)
    return safe_uint8(val, default)


def encode_can_id(node_id, msg_id, target_id):
    """Encode CAN ID matching Go decoder: nodeID<<20 | msgID<<8 | targetID."""
    return (node_id << 20) | (msg_id << 8) | target_id


def build_can_frame(msg_id, payload):
    """Build a 70-byte CAN frame: <IBB + payload zero-padded to 64 bytes."""
    can_id = encode_can_id(NODE_ID, msg_id, TARGET_ID)
    length = len(payload)
    header = struct.pack('<IBB', can_id, BUS, length)
    padded_payload = payload + b'\x00' * (64 - length)
    frame = header + padded_payload
    assert len(frame) == CAN_FRAME_SIZE, f"Frame size {len(frame)} != {CAN_FRAME_SIZE}"
    return frame


def pack_physics(sm):
    """MSG 0x001 — Physics (33 bytes): <ffBfffff"""
    return struct.pack('<ffBfffff',
        safe_float(sm.Physics.speed_kmh),
        safe_float(sm.Physics.rpm),
        safe_uint8(sm.Physics.gear),
        safe_float(sm.Physics.gas),
        safe_float(sm.Physics.brake),
        safe_float(sm.Physics.steer_angle),
        safe_float(sm.Physics.g_force.x),
        safe_float(sm.Physics.g_force.y),
        safe_float(sm.Physics.g_force.z),
    )


def pack_tires(sm):
    """MSG 0x002 — Tires (48 bytes): <12f"""
    return struct.pack('<12f',
        safe_float(sm.Physics.wheel_pressure.front_left),
        safe_float(sm.Physics.wheel_pressure.front_right),
        safe_float(sm.Physics.wheel_pressure.rear_left),
        safe_float(sm.Physics.wheel_pressure.rear_right),
        safe_float(sm.Physics.tyre_core_temp.front_left),
        safe_float(sm.Physics.tyre_core_temp.front_right),
        safe_float(sm.Physics.tyre_core_temp.rear_left),
        safe_float(sm.Physics.tyre_core_temp.rear_right),
        safe_float(sm.Physics.brake_temp.front_left),
        safe_float(sm.Physics.brake_temp.front_right),
        safe_float(sm.Physics.brake_temp.rear_left),
        safe_float(sm.Physics.brake_temp.rear_right),
    )


def pack_fuel_lap(sm):
    """MSG 0x003 — Fuel/Lap (36 bytes): <fffiiiiHBBf"""
    return struct.pack('<fffiiiiHBBf',
        safe_float(sm.Physics.fuel),
        safe_float(sm.Graphics.fuel_per_lap),
        safe_float(sm.Graphics.fuel_estimated_laps),
        safe_int(sm.Graphics.current_time),
        safe_int(sm.Graphics.last_time),
        safe_int(sm.Graphics.best_time),
        safe_int(sm.Graphics.estimated_lap_time),
        safe_uint16(sm.Graphics.completed_lap),
        safe_uint8(sm.Graphics.current_sector_index),
        safe_uint8(sm.Graphics.position),
        safe_float(sm.Graphics.session_time_left),
    )


def pack_environment(sm):
    """MSG 0x004 — Environment (15 bytes): <BBBfff"""
    return struct.pack('<BBBfff',
        enum_to_uint8(sm.Graphics.rain_intensity),
        enum_to_uint8(sm.Graphics.track_grip_status),
        safe_uint8(sm.Graphics.track_status),
        safe_float(sm.Graphics.wind_speed),
        safe_float(sm.Graphics.wind_direction),
        safe_float(sm.Graphics.exhaust_temp),
    )


def pack_status(sm):
    """MSG 0x005 — Status (40 bytes): <fffffiiBBBBBBBBi"""
    return struct.pack('<fffffiiBBBBBBBBi',
        safe_float(sm.Physics.car_damage.front),
        safe_float(sm.Physics.car_damage.rear),
        safe_float(sm.Physics.car_damage.left),
        safe_float(sm.Physics.car_damage.right),
        safe_float(sm.Physics.car_damage.center),
        safe_int(sm.Graphics.gap_ahead),
        safe_int(sm.Graphics.gap_behind),
        enum_to_uint8(sm.Graphics.flag),
        enum_to_uint8(sm.Graphics.penalty),
        safe_uint8(sm.Physics.pit_limiter_on),
        safe_uint8(sm.Graphics.tc_level),
        safe_uint8(sm.Graphics.abs_level),
        safe_uint8(sm.Graphics.is_in_pit_lane),
        enum_to_uint8(sm.Graphics.session_type),
        safe_uint8(sm.Graphics.current_tyre_set),
        safe_int(sm.Graphics.delta_lap_time),
    )


MESSAGES = [
    (MSG_PHYSICS, pack_physics),
    (MSG_TIRES, pack_tires),
    (MSG_FUEL_LAP, pack_fuel_lap),
    (MSG_ENVIRONMENT, pack_environment),
    (MSG_STATUS, pack_status),
]


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_HOST
    port = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PORT
    dest = (host, port)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    asm = accSharedMemory()

    print(f"Sending CAN frames to {host}:{port}")

    try:
        while True:
            sm = asm.read_shared_memory()
            if sm is not None:
                for msg_id, pack_fn in MESSAGES:
                    try:
                        payload = pack_fn(sm)
                        frame = build_can_frame(msg_id, payload)
                        sock.sendto(frame, dest)
                    except Exception as e:
                        print(f"Error packing msg 0x{msg_id:03x}: {e}")
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        sock.close()
        asm.close()


if __name__ == "__main__":
    main()
