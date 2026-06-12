package config

import (
	"os"
	"strings"
	"time"

	cmap "github.com/orcaman/concurrent-map/v2"
)

var Version = "1.10.5"
var Env = os.Getenv("ENV")
var Port = os.Getenv("PORT")

var VehicleID = os.Getenv("VEHICLE_ID")
var VehicleUploadKeyString = os.Getenv("VEHICLE_UPLOAD_KEY")
var VehicleUploadKey uint16

var DatabaseHost = os.Getenv("DATABASE_HOST")
var DatabasePort = os.Getenv("DATABASE_PORT")
var DatabaseUser = os.Getenv("DATABASE_USER")
var DatabasePassword = os.Getenv("DATABASE_PASSWORD")
var DatabaseName = os.Getenv("DATABASE_NAME")

var LocalMQTTHost = os.Getenv("LOCAL_MQTT_HOST")
var LocalMQTTPort = os.Getenv("LOCAL_MQTT_PORT")
var LocalMQTTUser = os.Getenv("LOCAL_MQTT_USER")
var LocalMQTTPassword = os.Getenv("LOCAL_MQTT_PASSWORD")

var CloudMQTTHost = os.Getenv("CLOUD_MQTT_HOST")
var CloudMQTTPort = os.Getenv("CLOUD_MQTT_PORT")
var CloudMQTTUser = os.Getenv("CLOUD_MQTT_USER")
var CloudMQTTPassword = os.Getenv("CLOUD_MQTT_PASSWORD")

var CANPort = os.Getenv("CAN_PORT")

// VirtualCANPorts is a comma-separated list of additional UDP ports to
// listen on for synthetic CAN frames produced by on-tcm software services
// (e.g. shelter). Each port behaves exactly like CANPort downstream —
// same parse, same PublishData dispatch, same MQTT topics — but skips the
// SPI byte-swap since these senders aren't going through the STM32 path.
var VirtualCANPorts = parsePortList(os.Getenv("VIRTUAL_CAN_PORTS"))

func parsePortList(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// Per-CAN-ID publish throttles, in milliseconds. We track local and cloud
// independently so the on-vehicle dash can run high-rate while the cellular
// uplink stays modest.
var LocalPublishInterval = os.Getenv("LOCAL_PUBLISH_INTERVAL")
var LocalPublishIntervalInt int
var CloudPublishInterval = os.Getenv("CLOUD_PUBLISH_INTERVAL")
var CloudPublishIntervalInt int

var LastLocalPublish = cmap.ConcurrentMap[string, uint64]{}
var LastCloudPublish = cmap.ConcurrentMap[string, uint64]{}

// Cloud ping cadence. Raw string from env; parsed into a Duration in
// utils.VerifyConfig at startup. Other config values that derive from
// the cadence (e.g. cloudPongFreshness in service.publishTCMStatus)
// read PingInterval, so changing the env value here automatically
// rescales those derived thresholds.
var PingIntervalRaw = os.Getenv("PING_INTERVAL")
var PingInterval time.Duration
