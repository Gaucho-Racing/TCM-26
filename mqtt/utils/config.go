package utils

import (
	"mqtt/config"
	"strconv"
)

func VerifyConfig() {
	if config.VehicleID == "" {
		SugarLogger.Fatalln("VEHICLE_ID is not set")
	}
	key, err := strconv.Atoi(config.VehicleUploadKeyString)
	if err != nil {
		SugarLogger.Fatalln("VEHICLE_UPLOAD_KEY is not a number")
	}
	if key < 0 || key > 65535 {
		SugarLogger.Fatalln("VEHICLE_UPLOAD_KEY is not a valid unsigned 16-bit integer")
	}
	config.VehicleUploadKey = uint16(key)

	config.LocalPublishIntervalInt = parseIntervalMs(config.LocalPublishInterval, 20, "LOCAL_PUBLISH_INTERVAL")
	config.CloudPublishIntervalInt = parseIntervalMs(config.CloudPublishInterval, 100, "CLOUD_PUBLISH_INTERVAL")

	SugarLogger.Infof("Vehicle ID: %s", config.VehicleID)
	SugarLogger.Infof("Vehicle Upload Key: %d", config.VehicleUploadKey)
	SugarLogger.Infof("Local Publish Interval: %dms", config.LocalPublishIntervalInt)
	SugarLogger.Infof("Cloud Publish Interval: %dms", config.CloudPublishIntervalInt)
}

func parseIntervalMs(raw string, fallback int, name string) int {
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		SugarLogger.Errorf("%s is not a number, using %dms: %v", name, fallback, err)
		return fallback
	}
	return v
}
