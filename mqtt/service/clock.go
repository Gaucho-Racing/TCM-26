package service

import "time"

// minValidTime mirrors Mapache/gr26/service/message.go minValidProducedAt.
// A Jetson with a dead RTC and no internet boots to 1970/1971 — anything
// before this date is pre-clock garbage. Keep the two cutoffs in lockstep.
var minValidTime = time.Date(2003, 10, 31, 0, 0, 0, 0, time.UTC)

// clockCheckInterval is the cadence runClockWatcher polls ClockPlausible
// at. Lives here next to the threshold rather than in tcm_state.go.
const clockCheckInterval = 30 * time.Second

// ClockPlausible reports whether the local clock is at or after minValidTime.
// Read by runClockWatcher (which publishes the result into state) and by
// the 0x200 status publisher via state.snapshot().
func ClockPlausible() bool {
	return !time.Now().Before(minValidTime)
}
