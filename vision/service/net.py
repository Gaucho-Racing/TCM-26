import socket
import time


def internet_up(host: str = "8.8.8.8", port: int = 53, timeout: float = 2.0) -> bool:
    """Mirror the relay's connectivity probe (mqtt/service/tcm_state.go): a
    TCP dial to Google DNS."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def clock_plausible() -> bool:
    """Mirror the relay's clock check (mqtt/service/clock.go): system time
    must be past 2003-10-31 to be trusted. Video timestamps are only
    meaningful once the clock is real."""
    return time.time() >= 1067558400  # 2003-10-31T00:00:00Z
