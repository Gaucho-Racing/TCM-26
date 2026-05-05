package main

import (
	"tcm/config"
	"tcm/database"
	"tcm/mqtt"
	"tcm/service"
	"tcm/utils"
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

	service.ListenCAN(config.CANPort)
}
