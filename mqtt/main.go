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
	//   curl http://localhost:6063/debug/pprof/goroutine?debug=2
	//
	// That dumps every goroutine's stack trace and tells us exactly what's
	// blocked (paho channel, log write, mutex, etc.) instead of guessing.
	// Bound to localhost only — host networking, no need to expose.
	// Picked 6063 (not the conventional 6060) to avoid colliding with
	// other Jetson services that may already grab 6060 at boot.
	go func() {
		addr := "localhost:6063"
		if err := http.ListenAndServe(addr, nil); err != nil {
			utils.SugarLogger.Warnf("[pprof] listener on %s exited: %v", addr, err)
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
