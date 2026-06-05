package utils

import (
	"mqtt/config"
	"strconv"
	"time"
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
	pingMs := parseIntervalMs(config.PingIntervalRaw, 5000, "PING_INTERVAL")
	config.PingInterval = time.Duration(pingMs) * time.Millisecond

	config.MinValidTime = parseBuildTime(config.BuildTime)

	SugarLogger.Infof("Vehicle ID: %s", config.VehicleID)
	SugarLogger.Infof("Vehicle Upload Key: %d", config.VehicleUploadKey)
	SugarLogger.Infof("Local Publish Interval: %dms", config.LocalPublishIntervalInt)
	SugarLogger.Infof("Cloud Publish Interval: %dms", config.CloudPublishIntervalInt)
	SugarLogger.Infof("Ping Interval: %s", config.PingInterval)
	SugarLogger.Infof("Clock floor (build time): %s", config.MinValidTime)
}

// parseBuildTime parses the RFC3339 build time into a time.Time. A bad or
// missing ldflag must not brick the service, so on failure we fall back to a
// conservative hardcoded floor rather than Fatalln.
func parseBuildTime(raw string) time.Time {
	const fallback = "2026-01-01T00:00:00Z"
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		SugarLogger.Errorf("BuildTime %q is not RFC3339, using %s: %v", raw, fallback, err)
		t, _ = time.Parse(time.RFC3339, fallback)
	}
	return t
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
