package service

import (
	"encoding/binary"
	"fmt"
	"mqtt/config"
	"mqtt/database"
	"mqtt/model"
	"mqtt/mqtt"
	"mqtt/utils"
	"net"
	"time"
)

// Bit positions in TCM Status status_bits byte.
const (
	tcmStatusConnectionOK = 1 << 0 // generic internet (DNS reachable)
	tcmStatusMQTTOK       = 1 << 1 // cloud broker connected
	tcmStatusMapacheOK    = 1 << 2 // cloud Mapache responding (fresh pong)
	tcmStatusClockOK      = 1 << 3 // local clock past 2003-10-31 (RTC/NTP synced)
)

// internetCheckTarget is a TCP target we dial to verify general internet
// connectivity. 8.8.8.8:53 is Google Public DNS — well-known, low-latency,
// and reachable via TCP from anywhere with an open egress path. We don't
// actually do DNS — just opening the socket is enough to know the LTE/wifi
// link is up and routing to the public internet.
const internetCheckTarget = "8.8.8.8:53"

// mapachePongFreshness is the freshness window for the most recent pong
// before we flip tcm_mapache_ok off. Derived from the configured
// PING_INTERVAL: 2× interval allows a single missed ping, +5s slack
// covers jitter and round-trip variance. At the default 5s ping cadence
// this resolves to 15s.
func mapachePongFreshness() time.Duration {
	return config.PingInterval*2 + 5*time.Second
}

func hasInternet() bool {
	conn, err := net.DialTimeout("tcp", internetCheckTarget, 2*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// InitializeTCMStatus publishes a TCM Status (0x200) message every 5s
// summarizing on-vehicle connectivity for the dash and cloud.
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
	var lastPing model.Ping
	database.DB.Where("latency > 0").Order("ping DESC").First(&lastPing)

	// `latency` is stored in microseconds; the TCM Status field is ms.
	latencyMs := uint16(0)
	if lastPing.Latency > 0 {
		ms := lastPing.Latency / 1000
		if ms > 65535 {
			ms = 65535
		}
		latencyMs = uint16(ms)
	}

	mapacheOK := false
	if lastPing.Ping > 0 {
		pongAge := time.Now().UnixMicro() - int64(lastPing.Ping)
		mapacheOK = pongAge >= 0 && pongAge < mapachePongFreshness().Microseconds()
	}

	var statusBits byte
	if hasInternet() {
		statusBits |= tcmStatusConnectionOK
	}
	if mqtt.CloudClient != nil && mqtt.CloudClient.IsConnected() {
		statusBits |= tcmStatusMQTTOK
	}
	if mapacheOK {
		statusBits |= tcmStatusMapacheOK
	}
	if ClockPlausible() {
		statusBits |= tcmStatusClockOK
	}

	// TCM Status payload layout (8 bytes):
	//   [0]    status_bits
	//   [1:3]  mapache_ping (u16, ms, little-endian)
	//   [3:8]  reserved
	dataPayload := make([]byte, 8)
	dataPayload[0] = statusBits
	binary.LittleEndian.PutUint16(dataPayload[1:3], latencyMs)

	micros := time.Now().UnixMicro()
	tsBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(tsBytes, uint64(micros))
	keyBytes := make([]byte, 2)
	binary.BigEndian.PutUint16(keyBytes, config.VehicleUploadKey)

	payload := append(tsBytes, keyBytes...)
	payload = append(payload, dataPayload...)

	topic := fmt.Sprintf("gr26/%s/tcm/0x200", config.VehicleID)
	mqtt.Publish(topic, 0, false, payload)
	utils.SugarLogger.Debugf("[TCM] published status: bits=%08b latency=%dms", statusBits, latencyMs)
}
