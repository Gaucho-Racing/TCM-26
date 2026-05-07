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

	mq "github.com/eclipse/paho.mqtt.golang"
)

func InitializePings() {
	SubscribePong()
	go func() {
		for {
			PublishPing()
			time.Sleep(config.PingInterval)
		}
	}()
	go func() {
		warnAfter := config.PingInterval * 2
		for {
			lastPing := FindLastSuccessfulPing()
			ageMs := time.Now().UnixMilli() - int64(lastPing.Ping)
			if ageMs > warnAfter.Milliseconds() {
				utils.SugarLogger.Warnf("Last successful ping was %.2fs ago", float64(ageMs)/1000)
			}
			time.Sleep(2345 * time.Millisecond)
		}
	}()
}

func SubscribePong() {
	topic := fmt.Sprintf("gr26/%s/tcm/pong", config.VehicleID)
	mqtt.Subscribe(topic, func(client mq.Client, msg mq.Message) {
		ping := binary.BigEndian.Uint64(msg.Payload()[:8])
		pong := binary.BigEndian.Uint64(msg.Payload()[8:])
		received := time.Now().UnixMicro()
		uploadLatency := time.Now().UnixMicro() - int64(ping)
		rtt := received - int64(ping)

		go UpdatePong(int(ping), int(pong), int(uploadLatency))
		utils.SugarLogger.Infof("[MQ] Received pong in %d ms", rtt/1000)
	})
}

func PublishPing() {
	topic := fmt.Sprintf("gr26/%s/tcm/ping", config.VehicleID)
	micros := time.Now().UnixMicro()
	go CreatePing(int(micros))
	microsBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(microsBytes, uint64(micros))
	uploadKey := make([]byte, 2)
	binary.BigEndian.PutUint16(uploadKey, config.VehicleUploadKey)
	payload := append(microsBytes, uploadKey...)
	mqtt.Publish(topic, 0, false, payload)
}

func CreatePing(ping int) {
	result := database.DB.Create(&model.Ping{
		VehicleID: config.VehicleID,
		Ping:      ping,
	})
	if result.Error != nil {
		utils.SugarLogger.Errorln("Failed to create ping:", result.Error)
	}
}

func UpdatePong(ping int, pong int, latency int) {
	result := database.DB.Model(&model.Ping{}).Where("ping = ?", ping).Update("pong", pong).Update("latency", latency)
	if result.Error != nil {
		utils.SugarLogger.Errorln("Failed to update pong:", result.Error)
	}
}

func FindLastSuccessfulPing() model.Ping {
	var ping model.Ping
	database.DB.Where("latency > 0").Order("ping DESC").First(&ping)
	return ping
}
