package config

import (
	"os"

	cmap "github.com/orcaman/concurrent-map/v2"
)

var Version = "1.0.3"
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

// Per-CAN-ID publish throttles, in milliseconds. We track local and cloud
// independently so the on-vehicle dash can run high-rate while the cellular
// uplink stays modest.
var LocalPublishInterval = os.Getenv("LOCAL_PUBLISH_INTERVAL")
var LocalPublishIntervalInt int
var CloudPublishInterval = os.Getenv("CLOUD_PUBLISH_INTERVAL")
var CloudPublishIntervalInt int

var LastLocalPublish = cmap.ConcurrentMap[string, uint64]{}
var LastCloudPublish = cmap.ConcurrentMap[string, uint64]{}

var PingInterval = os.Getenv("PING_INTERVAL")
