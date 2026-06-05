FROM --platform=$BUILDPLATFORM golang:1.23-alpine AS builder

RUN apk --no-cache add ca-certificates
RUN apk add --no-cache tzdata

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY . ./
ARG TARGETOS
ARG TARGETARCH
# BUILD_TIME (RFC3339) is injected as the floor for the local-clock
# plausibility check. When unset it resolves to an empty string, which
# utils.parseBuildTime detects and replaces with its hardcoded fallback.
ARG BUILD_TIME
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -ldflags "-X 'mqtt/config.BuildTime=${BUILD_TIME}'" -o /tcm_mqtt

##
## Deploy
##
FROM python:3.12-slim-bullseye

# Install jetson-stats for resource monitoring
RUN python3 -m pip install --upgrade pip
RUN python3 -m pip install -U jetson-stats

WORKDIR /

COPY --from=builder /tcm_mqtt /tcm_mqtt
COPY scripts /scripts

COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
ENV TZ=UTC

ENTRYPOINT ["/tcm_mqtt"]
