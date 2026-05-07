package main

import (
	"net/http"
	_ "net/http/pprof"

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

	// Background pprof server for diagnosing wedges. When the service goes
	// silent, run from another shell on the Jetson:
	//
	//   curl http://localhost:6060/debug/pprof/goroutine?debug=2
	//
	// That dumps every goroutine's stack trace and tells us exactly what's
	// blocked (paho channel, log write, mutex, etc.) instead of guessing.
	// Listening on localhost only — host networking, no need to expose.
	go func() {
		if err := http.ListenAndServe("localhost:6060", nil); err != nil {
			utils.SugarLogger.Warnf("[pprof] listener exited: %v", err)
		}
	}()

	utils.VerifyConfig()
	database.InitializeDB()
	database.InitializeMap()
	service.InitDBQueue()
	mqtt.InitializeMQTT()

	service.InitializePings()
	service.InitializeResourceQuery()
	service.InitializeTCMStatus()

	service.ListenCAN(config.CANPort)
}
