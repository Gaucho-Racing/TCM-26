from pyaccsharedmemory import accSharedMemory
import time
from datetime import datetime
from can import *

#####
import socket
UDP_IP = "127.0.0.1"
UDP_PORT = 8000
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((UDP_IP, UDP_PORT))
#####


asm = accSharedMemory()

print("Listening for Telemetry...")
try:
    while True:
        sm = asm.read_shared_memory()
        if sm is None:
            time.sleep(0.05)
            continue

        # --- Message 0x001 ---
        msg_0x001 = pack_msg_0x001(
            sm.Physics.speed_kmh,
            sm.Physics.rpm,
            sm.Physics.gear,
            sm.Physics.fuel,
            sm.Graphics.fuel_per_lap,
            sm.Physics.gas,
            sm.Physics.brake,
            sm.Physics.steer_angle
        )
        print_can_message(msg_0x001)
        # sock.sendto(ctypes.string_at(ctypes.byref(msg_0x001), ctypes.sizeof(msg_0x001)), (UDP_IP, UDP_PORT))

        # --- Message 0x002 ---
        msg_0x002 = pack_msg_0x002(
            sm.Physics.wheel_pressure.front_left,
            sm.Physics.wheel_pressure.front_right,
            sm.Physics.wheel_pressure.rear_left,
            sm.Physics.wheel_pressure.rear_right,
            sm.Physics.tyre_core_temp.front_left,
            sm.Physics.tyre_core_temp.front_right,
            sm.Physics.tyre_core_temp.rear_left,
            sm.Physics.tyre_core_temp.rear_right,
            sm.Physics.brake_temp.front_left,
            sm.Physics.brake_temp.front_right,
            sm.Physics.brake_temp.rear_left,
            sm.Physics.brake_temp.rear_right
        )
        print_can_message(msg_0x002)

        # --- Message 0x003 ---
        msg_0x003 = pack_msg_0x003(
            sm.Physics.g_force.x,
            sm.Physics.g_force.y,
            sm.Physics.g_force.z
        )
        print_can_message(msg_0x003)

        # --- Message 0x010 ---
        msg_0x010 = pack_msg_0x010(
            sm.Graphics.tc_level,
            sm.Graphics.abs_level,
            1 if sm.Graphics.is_in_pit_lane else 0,
            sm.Graphics.fuel_estimated_laps,
            sm.Graphics.current_tyre_set,
            sm.Graphics.delta_lap_time,
            sm.Graphics.exhaust_temp
        )
        print_can_message(msg_0x010)

        # --- Message 0x012 ---
        msg_0x012 = pack_msg_0x012(
            sm.Graphics.gap_ahead,
            sm.Graphics.gap_behind,
            sm.Graphics.flag.value if hasattr(sm.Graphics.flag, 'value') else int(sm.Graphics.flag),
            sm.Graphics.penalty.value if hasattr(sm.Graphics.penalty, 'value') else int(sm.Graphics.penalty),
            1 if sm.Physics.pit_limiter_on else 0,
            sm.Graphics.session_type.value if hasattr(sm.Graphics.session_type, 'value') else int(sm.Graphics.session_type)
        )
        print_can_message(msg_0x012)

        # --- Message 0x055 ---
        msg_0x055 = pack_msg_0x055(
            sm.Physics.car_damage.front,
            sm.Physics.car_damage.rear,
            sm.Physics.car_damage.left,
            sm.Physics.car_damage.right,
            sm.Physics.car_damage.center
        )
        print_can_message(msg_0x055)

        # --- Message 0x088 ---
        # track_status is a string field, not useful for CAN - use 0 as placeholder
        msg_0x088 = pack_msg_0x088(
            sm.Graphics.rain_intensity.value if hasattr(sm.Graphics.rain_intensity, 'value') else 0,
            sm.Graphics.track_grip_status.value if hasattr(sm.Graphics.track_grip_status, 'value') else 0,
            0,  # track_status is a string, skip it
            sm.Graphics.wind_speed,
            sm.Graphics.wind_direction
        )
        print_can_message(msg_0x088)

        # --- Message 0x099 ---
        msg_0x099 = pack_msg_0x099(
            sm.Graphics.position,
            sm.Graphics.completed_lap,
            sm.Graphics.current_time,
            sm.Graphics.last_time,
            sm.Graphics.best_time,
            sm.Graphics.estimated_lap_time,
            sm.Graphics.current_sector_index,
            sm.Graphics.session_time_left
        )
        print_can_message(msg_0x099)

        # --- Optional: small sleep to avoid 100% CPU ---
        time.sleep(0.05)

except KeyboardInterrupt:
    pass

finally:
    asm.close()
