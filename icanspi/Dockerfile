# icanspi is the SPI ↔ UDP bridge that runs on the Jetson and forwards
# CAN frames received from the STM32 over SPI into the mqtt service.
# It depends on libjetgpio, which is Jetson-specific (uses /dev/mem to
# mmap the GPIO/SPI register region), so this image is arm64-only.
#
# Run with:
#   docker run --privileged --network host ghcr.io/gaucho-racing/tcm-26/icanspi:latest
# `--privileged` (or explicit `--device=/dev/mem --device=/dev/spidev1.0`)
# is required for libjetgpio to mmap the hardware. `--network host` keeps
# the UDP socket on the same interface as the mqtt container.

FROM --platform=linux/arm64 debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# libjetgpio — userspace GPIO/SPI driver for Jetson. Pinned to a tag so
# upstream changes don't silently break our build.
ARG JETGPIO_REF=v1.4
RUN git clone --depth 1 --branch "${JETGPIO_REF}" \
    https://github.com/Rubberazer/JETGPIO.git /tmp/jetgpio \
  && cd /tmp/jetgpio \
  && make \
  && make install

WORKDIR /app
COPY . ./
RUN make

# ──────────────────────────────────────────────────────────────────
FROM --platform=linux/arm64 debian:bookworm-slim

# Bring over libjetgpio.so so the runtime image doesn't need build-essential.
COPY --from=builder /usr/lib/libjetgpio.so /usr/lib/
RUN ldconfig

COPY --from=builder /app/icanspi /usr/local/bin/icanspi

ENTRYPOINT ["/usr/local/bin/icanspi"]
