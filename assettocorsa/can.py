import ctypes
import struct

# --- CAN struct definitions ---
class Split(ctypes.Structure):
    _pack_ = 1
    _fields_ = [
        ("ID", ctypes.c_uint32),
        ("bus", ctypes.c_uint8),
        ("length", ctypes.c_uint8),
        ("data", ctypes.c_uint8 * 64)
    ]

class Combined(ctypes.Union):
    _fields_ = [
        ("buffer", ctypes.c_uint16 * 35),
        ("split", Split)
    ]

class CAN(ctypes.Structure):
    _fields_ = [("combined", Combined)]

def print_can_message(frame):
    print("CAN Message:")
    print(f"ID: 0x{frame.combined.split.ID:X}")
    print(f"Bus: {frame.combined.split.bus}")
    print(f"Length: {frame.combined.split.length}")
    print("Data: ", end="")

    for i in range(frame.combined.split.length):
        print(f"{frame.combined.split.data[i]:02X}", end=" ")

    print("\n")
# -----------------------------
# Message ID 0x001
# Fields: speed_kmh, rpm, gear, fuel_level, fuel_per_lap, throttle, brake, steering_angle
def pack_msg_0x001(speed_kmh, rpm, gear, fuel_level, fuel_per_lap, throttle, brake, steering_angle):
    msg = CAN()
    msg.combined.split.ID = 0x001
    msg.combined.split.bus = 0
    
    # pack floats and integers
    # < = little endian
    # f = float, H = uint16, b = int8
    # Convert and clamp: rpm (uint16: 0-65535), gear (int8: -128 to 127)
    rpm_clamped = max(0, min(65535, int(rpm)))
    gear_clamped = max(-1, min(127, int(gear)))  # -1 for reverse, 0 for neutral
    struct.pack_into("<fHbfffff", msg.combined.split.data, 0,
                     speed_kmh, rpm_clamped, gear_clamped, fuel_level, fuel_per_lap,
                     throttle, brake, steering_angle)
    msg.combined.split.length = 4 + 2 + 1 + 4 + 4 + 4 + 4 + 4  # sum of sizes
    return msg

# -----------------------------
# Message ID 0x002
# Fields: tyre_pressure_fl, tyre_pressure_fr, tyre_pressure_rl, tyre_pressure_rr,
#         tyre_temp_fl, tyre_temp_fr, tyre_temp_rl, tyre_temp_rr,
#         brake_temp_fl, brake_temp_fr, brake_temp_rl, brake_temp_rr
def pack_msg_0x002(tp_fl, tp_fr, tp_rl, tp_rr,
                    tt_fl, tt_fr, tt_rl, tt_rr,
                    bt_fl, bt_fr, bt_rl, bt_rr):
    msg = CAN()
    msg.combined.split.ID = 0x002
    msg.combined.split.bus = 0
    
    struct.pack_into("<ffffffffffff", msg.combined.split.data, 0,
                     tp_fl, tp_fr, tp_rl, tp_rr,
                     tt_fl, tt_fr, tt_rl, tt_rr,
                     bt_fl, bt_fr, bt_rl, bt_rr)
    
    msg.combined.split.length = 12 * 4  # 12 floats
    return msg

# -----------------------------
# Message ID 0x003
# Fields: g_force_x, g_force_y, g_force_z
def pack_msg_0x003(gx, gy, gz):
    msg = CAN()
    msg.combined.split.ID = 0x003
    msg.combined.split.bus = 0
    struct.pack_into("<fff", msg.combined.split.data, 0, gx, gy, gz)
    msg.combined.split.length = 3*4
    return msg

# -----------------------------
# Message ID 0x010
# Fields: tc_level, abs_level, is_in_pit_lane, fuel_estimated_laps, current_tyre_set, delta_lap_time, exhaust_temp
def pack_msg_0x010(tc_level, abs_level, is_in_pit_lane, fuel_estimated_laps, current_tyre_set,
                   delta_lap_time, exhaust_temp):
    msg = CAN()
    msg.combined.split.ID = 0x010
    msg.combined.split.bus = 0
    # Convert and clamp integer fields: B = uint8 (0-255)
    clamp_u8 = lambda v: max(0, min(255, int(v)))
    struct.pack_into("<BBB B B ff", msg.combined.split.data, 0,
                     clamp_u8(tc_level), clamp_u8(abs_level), clamp_u8(is_in_pit_lane), 
                     clamp_u8(fuel_estimated_laps), clamp_u8(current_tyre_set),
                     delta_lap_time, exhaust_temp)
    msg.combined.split.length = 1+1+1 +1+1 +4+4
    return msg

# -----------------------------
# Message ID 0x012
# Fields: gap_ahead, gap_behind, flag_status, penalty, pit_limiter_on, session_type
def pack_msg_0x012(gap_ahead, gap_behind, flag_status, penalty, pit_limiter_on, session_type):
    msg = CAN()
    msg.combined.split.ID = 0x012
    msg.combined.split.bus = 0
    # Convert and clamp integer fields: B = uint8 (0-255)
    clamp_u8 = lambda v: max(0, min(255, int(v)))
    struct.pack_into("<ffBBBB", msg.combined.split.data, 0,
                     gap_ahead, gap_behind, clamp_u8(flag_status), clamp_u8(penalty), 
                     clamp_u8(pit_limiter_on), clamp_u8(session_type))
    msg.combined.split.length = 4+4+1+1+1+1
    return msg

# -----------------------------
# Message ID 0x055
# Fields: car_damage_front, car_damage_rear, car_damage_left, car_damage_right, car_damage_center
def pack_msg_0x055(f, r, l, rr, c):
    msg = CAN()
    msg.combined.split.ID = 0x055
    msg.combined.split.bus = 0
    struct.pack_into("<fffff", msg.combined.split.data, 0, f, r, l, rr, c)
    msg.combined.split.length = 5*4
    return msg

# -----------------------------
# Message ID 0x088
# Fields: rain_intensity, track_grip_status, track_status, wind_speed, wind_direction
def pack_msg_0x088(rain_intensity, track_grip_status, track_status, wind_speed, wind_direction):
    msg = CAN()
    msg.combined.split.ID = 0x088
    msg.combined.split.bus = 0
    # Convert and clamp integer fields: B = uint8 (0-255)
    clamp_u8 = lambda v: max(0, min(255, int(v)))
    struct.pack_into("<fBBff", msg.combined.split.data, 0,
                     rain_intensity, clamp_u8(track_grip_status), clamp_u8(track_status), 
                     wind_speed, wind_direction)
    msg.combined.split.length = 4+1+1+4+4
    return msg

# -----------------------------
# Message ID 0x099
# Fields: position, completed_lap, current_lap_time, last_lap_time, best_lap_time,
#         estimated_lap_time, current_sector, session_time_left
def pack_msg_0x099(position, completed_lap, current_lap_time, last_lap_time, best_lap_time,
                    estimated_lap_time, current_sector, session_time_left):
    msg = CAN()
    msg.combined.split.ID = 0x099
    msg.combined.split.bus = 0
    # Convert and clamp integer fields: B = uint8 (0-255), H = uint16 (0-65535)
    clamp_u8 = lambda v: max(0, min(255, int(v)))
    clamp_u16 = lambda v: max(0, min(65535, int(v)))
    struct.pack_into("<BHffffBf", msg.combined.split.data, 0,
                     clamp_u8(position), clamp_u16(completed_lap), current_lap_time, last_lap_time,
                     best_lap_time, estimated_lap_time, clamp_u8(current_sector), session_time_left)
    msg.combined.split.length = 1+2 +4*5 +1 +4  # sums to 26 bytes
    return msg
