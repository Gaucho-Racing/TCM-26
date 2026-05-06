package service

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"mqtt/config"
	"mqtt/mqtt"
	"mqtt/utils"
	"net"
	"strconv"
	"time"
)

var nodeIDMap = map[byte]string{
	0x00: "all",
	0x01: "debugger",
	0x02: "ecu",
	0x03: "bcu",
	0x04: "tcm",
	0x05: "dash_panel",
	0x08: "gr_inverter",
	0x0C: "charging_sdc",
	0x0D: "fan_controller_1",
	0x0E: "fan_controller_2",
	0x0F: "fan_controller_3",
	0x10: "tire_temp_fl",
	0x11: "tire_temp_fr",
	0x12: "tire_temp_rl",
	0x13: "tire_temp_rr",
	0x14: "suspension_fl",
	0x15: "suspension_fr",
	0x16: "suspension_rl",
	0x17: "suspension_rr",
	0x18: "inboard_floor_fl",
	0x19: "inboard_floor_fr",
	0x1A: "inboard_floor_rl",
	0x1B: "inboard_floor_rr",
	0x1C: "brake_temp_fl",
	0x1D: "brake_temp_fr",
	0x1E: "brake_temp_rl",
	0x1F: "brake_temp_rr",
	0x20: "dgps",
}

func PublishData(canID uint32, nodeID uint8, messageID uint16, targetID uint8, data []byte) {
	source := nodeIDMap[nodeID]
	target := nodeIDMap[targetID]

	if source == "" {
		source = "unknown"
	}
	if target == "" {
		target = "unknown"
	}

	topic := fmt.Sprintf("gr26/%s/%s/0x%03x", config.VehicleID, source, messageID)
	timestamp := uint64(time.Now().UnixMicro())

	// Queue the database write
	QueueDBWrite(int(timestamp), config.VehicleID, topic, data, source, target)

	buf := new(bytes.Buffer)
	binary.Write(buf, binary.BigEndian, timestamp)
	binary.Write(buf, binary.BigEndian, config.VehicleUploadKey)
	buf.Write(data)

	// Check if we should publish to MQTT
	canIDString := fmt.Sprintf("%d", canID)
	lastSent, ok := config.LastSucessfulPublish.Get(canIDString)
	shouldPublish := false
	if ok {
		// Publish interval in milliseconds (convert to microseconds)
		if timestamp-lastSent > uint64(config.PublishIntervalInt*1000) {
			shouldPublish = true
		}
	} else {
		shouldPublish = true
	}
	if shouldPublish {
		// Update timestamp BEFORE publishing to prevent race condition
		config.LastSucessfulPublish.Set(canIDString, timestamp)
		mqtt.Publish(topic, 1, true, buf.Bytes())
	}
}

func ListenCAN(port string) {
	shouldLog := false
	if config.Env == "DEV" {
		shouldLog = true
	}

	portInt, err := strconv.Atoi(port)
	if err != nil {
		utils.SugarLogger.Fatalf("[CAN] Failed to convert port to int: %v", err)
	}
	addr := net.UDPAddr{
		Port: portInt,
		IP:   net.ParseIP("0.0.0.0"),
	}
	conn, err := net.ListenUDP("udp", &addr)
	if err != nil {
		utils.SugarLogger.Fatalf("[CAN] Failed to create UDP connection: %v", err)
	}
	defer conn.Close()

	for {
		buffer := make([]byte, 1024)
		n, remoteAddr, err := conn.ReadFromUDP(buffer)
		if err != nil {
			utils.SugarLogger.Errorf("[CAN] Error reading from UDP: %v", err)
			continue
		}
		if shouldLog {
			utils.SugarLogger.Infof("[CAN] Received %d bytes from %s", n, remoteAddr.String())
		}

		if n < 72 {
			utils.SugarLogger.Infof("[CAN] Invalid packet size: expected at least 72 bytes, got %d", n)
			continue
		}

		// Debug print the raw canID bytes
		canIDBytes := buffer[0:4]
		canIDStr := make([]string, len(canIDBytes))
		for i, b := range canIDBytes {
			canIDStr[i] = fmt.Sprintf("0x%02x", b)
		}
		if shouldLog {
			utils.SugarLogger.Infof("[CAN] Raw CAN ID bytes: %v", canIDStr)
		}

		// Splits canID bytes into hex digits/4 bits
		canID := binary.LittleEndian.Uint32(buffer[0:4])
		if shouldLog {
			utils.SugarLogger.Infof("[CAN] CAN ID: %d (0x%08x)", canID, canID)
		}
		nodeID := uint8((canID >> 20) & 0xFF)
		msgID := uint16((canID >> 8) & 0xFFF)
		targetID := uint8(canID & 0xFF)

		if shouldLog {
			utils.SugarLogger.Infof("[CAN] Msg ID: %d (0x%03x)", msgID, msgID)
			utils.SugarLogger.Infof("[CAN] Node ID: %d (0x%02x)", nodeID, nodeID)
			utils.SugarLogger.Infof("[CAN] Target ID: %d (0x%02x)", targetID, targetID)
		}

		bus := buffer[4] // unused
		// The C struct CAN has a uint16_t length field at offset 6 (not 5):
		// the compiler inserts a padding byte at offset 5 to satisfy uint16
		// alignment after the uint8_t bus at offset 4. Payload starts at
		// offset 8.
		length := binary.LittleEndian.Uint16(buffer[6:8])
		if length > 64 {
			length = 64
		}
		if int(length)+8 > n {
			utils.SugarLogger.Infof("[CAN] Payload length %d exceeds packet size %d, skipping", length, n)
			continue
		}
		payload := buffer[8 : length+8]

		if shouldLog {
			utils.SugarLogger.Infof("[CAN] Bus: %d", bus)
			utils.SugarLogger.Infof("[CAN] Length: %d", length)
		}
		payloadStr := make([]string, len(payload))
		for i, b := range payload {
			payloadStr[i] = fmt.Sprintf("0x%02x", b)
		}
		if shouldLog {
			utils.SugarLogger.Infof("[CAN] Payload: %v", payloadStr)
		}

		go PublishData(canID, nodeID, msgID, targetID, payload)
	}
}
