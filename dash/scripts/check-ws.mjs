#!/usr/bin/env node

import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

const wsUrl = process.env.TELEMETRY_WS_URL ?? "ws://localhost:8001/gr26/live";
const timeoutMs = Number(process.env.TELEMETRY_WS_TIMEOUT_MS ?? "4000");

const parsed = new URL(wsUrl);
const isSecure = parsed.protocol === "wss:";
if (!isSecure && parsed.protocol !== "ws:") {
  console.error(`Unsupported protocol for ${wsUrl}`);
  process.exit(1);
}

const port = Number(parsed.port || (isSecure ? 443 : 80));
const host = parsed.hostname;
const path = `${parsed.pathname}${parsed.search}`;
const key = crypto.randomBytes(16).toString("base64");

const request = [
  `GET ${path} HTTP/1.1`,
  `Host: ${host}:${port}`,
  "Upgrade: websocket",
  "Connection: Upgrade",
  `Sec-WebSocket-Key: ${key}`,
  "Sec-WebSocket-Version: 13",
  "",
  "",
].join("\r\n");

let settled = false;
const complete = (ok, message) => {
  if (settled) return;
  settled = true;
  if (ok) {
    console.log(message);
    process.exit(0);
  } else {
    console.error(message);
    process.exit(1);
  }
};

const socket = isSecure
  ? tls.connect({ host, port, rejectUnauthorized: false })
  : net.createConnection({ host, port });

const timeout = setTimeout(() => {
  socket.destroy();
  complete(false, `Timed out after ${timeoutMs}ms connecting to ${wsUrl}`);
}, timeoutMs);

socket.on("connect", () => {
  socket.write(request);
});

socket.on("data", (chunk) => {
  const response = chunk.toString("utf8");
  if (response.startsWith("HTTP/1.1 101") || response.startsWith("HTTP/1.0 101")) {
    clearTimeout(timeout);
    socket.end();
    complete(true, `WebSocket reachable at ${wsUrl}`);
  } else if (response.startsWith("HTTP/1.1") || response.startsWith("HTTP/1.0")) {
    clearTimeout(timeout);
    socket.end();
    complete(false, `WebSocket handshake rejected by ${wsUrl}: ${response.split("\r\n")[0]}`);
  }
});

socket.on("error", (error) => {
  clearTimeout(timeout);
  const reason = error.message || error.code || "unknown socket error";
  complete(false, `Failed to connect to ${wsUrl}: ${reason}`);
});
