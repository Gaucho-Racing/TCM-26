package service

import (
	"encoding/binary"
	"fmt"
	"mqtt/config"
	"mqtt/database"
	"mqtt/model"
	"mqtt/mqtt"
	"mqtt/utils"
	"time"
)

// Bit positions in TCM Status status_bits byte (matches GRCAN.CANdo).
const (
	tcmStatusConnectionOK = 1 << 0 // generic connection bit
	tcmStatusMQTTOK       = 1 << 1 // cloud broker reachable
	tcmStatusEpicShelter  = 1 << 2 // unused for now
	tcmStatusCamera       = 1 << 3 // unused for now
)

// Treat the cloud connection as healthy if a pong was received within
// this window. Anything older means cloud is stale or down.
const cloudPongFreshness = 30 * time.Second

// InitializeTCMStatus publishes a TCM Status (0x029) message every 5s
// summarizing cloud broker connectivity for the dash.
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

	pongAgeOK := false
	if lastPing.Ping > 0 {
		pongAge := time.Now().UnixMicro() - int64(lastPing.Ping)
		pongAgeOK = pongAge >= 0 && pongAge < cloudPongFreshness.Microseconds()
	}

	var statusBits byte
	if mqtt.CloudClient != nil && mqtt.CloudClient.IsConnected() {
		statusBits |= tcmStatusMQTTOK
	}
	if pongAgeOK {
		statusBits |= tcmStatusConnectionOK
	}

	// TCM Status payload layout (8 bytes per GRCAN.CANdo):
	//   [0]    status_bits
	//   [1:3]  mapache_ping (u16, ms, little-endian)
	//   [3:7]  cache_size   (u32, little-endian, unused for now)
	//   [7]    reserved
	dataPayload := make([]byte, 8)
	dataPayload[0] = statusBits
	binary.LittleEndian.PutUint16(dataPayload[1:3], latencyMs)
	binary.LittleEndian.PutUint32(dataPayload[3:7], 0)

	micros := time.Now().UnixMicro()
	tsBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(tsBytes, uint64(micros))
	keyBytes := make([]byte, 2)
	binary.BigEndian.PutUint16(keyBytes, config.VehicleUploadKey)

	payload := append(tsBytes, keyBytes...)
	payload = append(payload, dataPayload...)

	topic := fmt.Sprintf("gr26/%s/tcm/0x029", config.VehicleID)
	mqtt.Publish(topic, 0, false, payload)
	utils.SugarLogger.Debugf("[TCM] published status: bits=%08b latency=%dms", statusBits, latencyMs)
}
