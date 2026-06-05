package main

import (
	"mqtt/config"
	"mqtt/database"
	"mqtt/mqtt"
	"mqtt/service"
	"mqtt/utils"
)

func main() {
	config.PrintStartupBanner()
	utils.InitializeLogger()
	defer utils.Logger.Sync()

	utils.VerifyConfig()
	database.InitializeDB()
	database.InitializeMap()
	service.InitDBQueue()
	mqtt.InitializeMQTT()

	service.InitializePings()
	service.InitializeResourceQuery()
	// State watchers must start before the publisher so the first
	// publish has live readings rather than zero defaults.
	service.InitializeTCMState()
	service.InitializeTCMStatus()

	// Virtual CAN listeners run in the background; the real icanspi
	// listener blocks main below.
	for _, port := range config.VirtualCANPorts {
		go service.ListenCAN(port, true)
	}
	service.ListenCAN(config.CANPort, false)
}
