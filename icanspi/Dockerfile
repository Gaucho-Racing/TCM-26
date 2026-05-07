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

# libjetgpio — userspace GPIO/SPI driver for Jetson. Pinned to a SHA on
# `main` so upstream changes don't silently break our build. Upstream
# only tags releases occasionally (latest tag at time of writing is
# v1.2); the SHA gives us a precise pin to whatever's current.
ARG JETGPIO_REF=c69401c4a798aa4ecd058696509dd01011a8976b
# JETGPIO's default `make` target runs ./get_chip_id which mmap's
# /dev/mem at build time to detect the Jetson model — that won't work
# inside Docker. Sidestep it by calling the per-model target directly
# (orin/orinagx/nano/xavier) and installing the resulting .so by hand.
# Override at build time:  --build-arg JETSON_MODEL=orinagx
ARG JETSON_MODEL=orin
RUN git clone https://github.com/Rubberazer/JETGPIO.git /tmp/jetgpio \
  && cd /tmp/jetgpio \
  && git checkout "${JETGPIO_REF}" \
  && make "${JETSON_MODEL}" \
  && install -m 0755 libjetgpio.so /usr/lib/ \
  && install -m 0644 jetgpio.h /usr/include/ \
  && ldconfig

WORKDIR /app
COPY . ./
RUN make

# ──────────────────────────────────────────────────────────────────
FROM --platform=linux/arm64 debian:bookworm-slim

# kmod provides modprobe — libjetgpio shells out to it during init to
# make sure the spidev kernel module is loaded. Without it you get
# `sh: 1: modprobe: not found` from the lib at startup. Loading the
# module also requires /lib/modules to be available; mount it from the
# host in docker-compose with:
#   volumes: ['/lib/modules:/lib/modules:ro']
RUN apt-get update && apt-get install -y --no-install-recommends \
    kmod \
  && rm -rf /var/lib/apt/lists/*

# Bring over libjetgpio.so so the runtime image doesn't need build-essential.
COPY --from=builder /usr/lib/libjetgpio.so /usr/lib/
RUN ldconfig

COPY --from=builder /app/icanspi /usr/local/bin/icanspi

# stdbuf -oL forces line-buffered stdout so init prints reach
# `docker compose logs` immediately. Without it C's stdout is fully
# buffered when not on a TTY (which `docker compose up -d` doesn't
# allocate), and you'd see nothing until the 4KB buffer fills — which
# never happens for icanspi's small init output. coreutils provides
# stdbuf and is already in the base image.
ENTRYPOINT ["stdbuf", "-oL", "/usr/local/bin/icanspi"]
