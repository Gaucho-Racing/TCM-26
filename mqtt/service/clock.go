package service

import (
	"mqtt/config"
	"mqtt/utils"
	"time"
)

// clockMaxFuture bounds how far past the build floor the clock may read before
// we call it implausible. The lower bound (build time) catches a dead-RTC
// Jetson booting to 1970/1971 before NTP syncs; this generous upper bound
// catches the equally-impossible garbage-high values.
const clockMaxFuture = 20 * 365 * 24 * time.Hour

// clockCheckInterval is how often InitializeClockStatus re-evaluates the clock
// for logging. The 0x029 status bit is recomputed independently on its own
// 5s cadence via ClockPlausible.
const clockCheckInterval = 30 * time.Second

// ClockPlausible reports whether the local system clock is within a believable
// range. The binary can never legitimately run before it was built
// (config.MinValidTime), and a real clock won't be decades into the future.
// Used both by the periodic logger here and by publishTCMStatus to set the
// tcm_clock_ok status bit.
func ClockPlausible() bool {
	now := time.Now()
	return !now.Before(config.MinValidTime) &&
		now.Before(config.MinValidTime.Add(clockMaxFuture))
}

// InitializeClockStatus starts a goroutine that periodically checks the local
// clock and logs a [CLK] error whenever it's implausible. It only logs on state
// transitions to avoid spamming the log every tick while the clock stays bad.
func InitializeClockStatus() {
	go func() {
		ticker := time.NewTicker(clockCheckInterval)
		defer ticker.Stop()

		// Track previous state so we log once on going bad and once on
		// recovery, rather than every tick. Start at true so an
		// already-bad clock at boot logs on the first tick.
		wasPlausible := true
		for range ticker.C {
			func() {
				defer func() {
					if r := recover(); r != nil {
						utils.SugarLogger.Errorf("[CLK] clock check panicked: %v", r)
					}
				}()

				ok := ClockPlausible()
				if !ok && wasPlausible {
					utils.SugarLogger.Errorf(
						"[CLK] system clock implausible: now=%s floor=%s (RTC not set / no NTP sync?)",
						time.Now().Format(time.RFC3339), config.MinValidTime.Format(time.RFC3339))
				} else if ok && !wasPlausible {
					utils.SugarLogger.Infof("[CLK] system clock recovered: now=%s", time.Now().Format(time.RFC3339))
				}
				wasPlausible = ok
			}()
		}
	}()
}
