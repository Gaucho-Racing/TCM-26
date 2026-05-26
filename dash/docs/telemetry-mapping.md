# GR-Screen Live Telemetry Mapping

This document defines how live `gr26` ingest signals map into `GR-Screen`'s `TelemetryData` model.

## WebSocket Source

- URL: `ws://localhost:8001/gr26/live`
- Query params (production default):
  - `vehicle_id=gr26`
  - `signals=<comma-separated signal names>`
  - `rate=30`

## Canonical GR-Screen Model

Target type: `types/telemetry.ts` `TelemetryData`.

## Signal-to-Field Mapping

| GR-Screen field | Live source signal(s) | Conversion / notes | Default if missing |
| --- | --- | --- | --- |
| `speed` | `ecu_vehicle_speed` | Live feed is MPH in current dash. Convert to km/h for GR-Screen UI: `mph * 1.60934`. | `0` |
| `maxSpeed` | config constant | Set dashboard max speed bound from config (`70` by default). | `70` |
| `stateOfCharge.accumulator` | `ecu_accumulator_soc` | Percent 0-100. Clamp to `[0, 100]`. | `0` |
| `stateOfCharge.glv` | `ecu_glv_soc` | Percent 0-100. Clamp to `[0, 100]`. | `0` |
| `ecuState` | `ecu_ecu_state` | Translate numeric ECU state bit/enum to `IDLE`, `READY`, `RUNNING`, `ERROR`, `CHARGING`. Unknown -> `ERROR`. | `"IDLE"` |
| `maxCellTemp` | `ecu_max_cell_temp` | Celsius passthrough. | `0` |
| `motorTemp` | `inverter_motor_temp` (preferred), fallback synthetic | If unavailable in signal list, derive placeholder from `maxCellTemp` for continuity until source is added. | `maxCellTemp` |
| `inverterTemp` | `inverter_inverter_temp` (preferred), fallback synthetic | If unavailable, derive placeholder from `maxCellTemp`. | `maxCellTemp - 5` |
| `ecuDelay` | local derived | `now - lastMessageTimestamp` seconds (rounded). | `0` |
| `glvVoltage` | `ecu_glv_voltage` (preferred), fallback synthetic | If absent, estimate from GLV SoC for display continuity. | `12.0` |
| `brakeCheck` | `ecu_relay_states` + safety flags | Decode relay/safety state. If decode unavailable, show `"OK"` when connected, `"CHECK"` when stale/disconnected. | `"CHECK"` |
| `debugVersion` | config constant | Build/runtime identifier. | `"live-ws-v1"` |
| `debugMessage` | local derived | Connectivity summary (connected/stale/reconnecting). | `"No data"` |
| `debugFDMessage` | local derived | Last raw message summary for quick diagnosis. | `"No message"` |

## Known Live Signals Used

Primary subset mirrored from the current TCM-26 dash:

- `ecu_ecu_state`
- `ecu_power_level`
- `ecu_torque_map`
- `ecu_vehicle_speed`
- `ecu_accumulator_soc`
- `ecu_glv_soc`
- `ecu_max_cell_temp`
- `ecu_relay_states`
- `inverter_motor_rpm`
- `tcm_connection_ok`
- `tcm_mqtt_ok`
- `tcm_epic_shelter_ok`
- `tcm_camera_ok`
- `tcm_mapache_ping`
- `tcm_cache_size`

Additional preferred signals (if available from ingest):

- `ecu_glv_voltage`
- `inverter_motor_temp`
- `inverter_inverter_temp`

## ECU State Translation (proposed default)

The live value can be numeric/bitfield depending on upstream parsing. Current adapter default:

- `0` -> `IDLE`
- `1` -> `READY`
- `2` -> `RUNNING`
- `3` -> `CHARGING`
- any other value -> `ERROR`

If upstream emits strings, values are normalized to uppercase and matched directly when possible.

## Freshness and Fault Semantics

- Data is considered **stale** if no valid signal update arrives for `> 2.5s`.
- On stale/disconnect:
  - keep last valid numeric values to avoid UI flicker,
  - force `debugMessage` to stale/reconnect status,
  - set `brakeCheck` to `"CHECK"`.

## Validation Checklist

- Verify vehicle speed conversion with known MPH test values.
- Verify ECU state transitions across all expected values.
- Verify SoC clamping at low/high boundaries.
- Verify stale behavior with ingest stopped.
- Verify reconnect behavior after ingest restarts.
