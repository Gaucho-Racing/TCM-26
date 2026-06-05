package service

import (
	"mqtt/utils"
	"time"
)

// minValidTime mirrors Mapache/gr26/service/message.go minValidProducedAt.
// A Jetson with a dead RTC and no internet boots to 1970/1971 — anything
// before this date is pre-clock garbage. Keep the two cutoffs in lockstep.
var minValidTime = time.Date(2003, 10, 31, 0, 0, 0, 0, time.UTC)

const clockCheckInterval = 30 * time.Second

// ClockPlausible reports whether the local clock is at or after minValidTime.
// Used by publishTCMStatus to set tcm_clock_ok and by the periodic logger.
func ClockPlausible() bool {
	return !time.Now().Before(minValidTime)
}

// InitializeClockStatus logs [CLK] on state transitions only (bad → recovered
// and back) so the log isn't spammed every tick while the clock stays bad.
func InitializeClockStatus() {
	go func() {
		ticker := time.NewTicker(clockCheckInterval)
		defer ticker.Stop()
		wasPlausible := true
		for range ticker.C {
			ok := ClockPlausible()
			if !ok && wasPlausible {
				utils.SugarLogger.Errorf("[CLK] system clock implausible: now=%s floor=%s (RTC not set / no NTP sync?)",
					time.Now().Format(time.RFC3339), minValidTime.Format(time.RFC3339))
			} else if ok && !wasPlausible {
				utils.SugarLogger.Infof("[CLK] system clock recovered: now=%s", time.Now().Format(time.RFC3339))
			}
			wasPlausible = ok
		}
	}()
}
