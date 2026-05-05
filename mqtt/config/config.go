package config

import (
	"os"

	cmap "github.com/orcaman/concurrent-map/v2"
)

var Version = "2.0.0"
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

var LastSucessfulPublish = cmap.ConcurrentMap[string, uint64]{}
var PublishInterval = os.Getenv("PUBLISH_INTERVAL")
var PublishIntervalInt int

var PingInterval = os.Getenv("PING_INTERVAL")
