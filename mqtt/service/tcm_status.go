package service

import (
	"encoding/binary"
	"fmt"
	"mqtt/config"
	"mqtt/mqtt"
	"mqtt/utils"
	"time"
)

// Bit positions in TCM Status status_bits byte.
const (
	tcmStatusConnectionOK = 1 << 0 // generic internet (DNS reachable)
	tcmStatusMQTTOK       = 1 << 1 // cloud broker connected
	tcmStatusMapacheOK    = 1 << 2 // cloud Mapache responding (fresh pong)
	tcmStatusClockOK      = 1 << 3 // local clock is plausible (RTC/NTP synced)
)

// mapachePongFreshness is the freshness window for the most recent pong
// before we flip tcm_mapache_ok off. Derived from PING_INTERVAL: 2×
// allows a single missed ping, +5s slack covers jitter and RTT
// variance. At the default 5s cadence this resolves to 15s.
func mapachePongFreshness() time.Duration {
	return config.PingInterval*2 + 5*time.Second
}

// InitializeTCMStatus publishes a TCM Status (0x200) message every 5s
// summarizing on-vehicle connectivity for the dash and cloud. The
// publish path itself does no I/O — every bit comes from the shared
// tcmState, populated by the connectivity watchers in tcm_state.go
// and by SubscribePong in ping.go.
func InitializeTCMStatus() {
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			publishTCMStatus()
		}
	}()
}

func publishTCMStatus() {
	inet, mqttOK, clock, lastPongAt, lastPongRTT := state.snapshot()

	mapacheOK := !lastPongAt.IsZero() && time.Since(lastPongAt) < mapachePongFreshness()

	var statusBits byte
	if inet {
		statusBits |= tcmStatusConnectionOK
	}
	if mqttOK {
		statusBits |= tcmStatusMQTTOK
	}
	if mapacheOK {
		statusBits |= tcmStatusMapacheOK
	}
	if clock {
		statusBits |= tcmStatusClockOK
	}

	// TCM Status payload layout (8 bytes):
	//   [0]    status_bits
	//   [1:3]  mapache_ping (u16, ms, little-endian)
	//   [3:8]  reserved
	dataPayload := make([]byte, 8)
	dataPayload[0] = statusBits
	binary.LittleEndian.PutUint16(dataPayload[1:3], lastPongRTT)

	micros := time.Now().UnixMicro()
	tsBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(tsBytes, uint64(micros))
	keyBytes := make([]byte, 2)
	binary.BigEndian.PutUint16(keyBytes, config.VehicleUploadKey)

	payload := append(tsBytes, keyBytes...)
	payload = append(payload, dataPayload...)

	topic := fmt.Sprintf("gr26/%s/tcm/0x200", config.VehicleID)
	mqtt.Publish(topic, 0, false, payload)
	utils.SugarLogger.Debugf("[TCM] published status: bits=%08b latency=%dms", statusBits, lastPongRTT)
}
