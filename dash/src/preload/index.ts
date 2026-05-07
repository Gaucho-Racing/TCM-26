// Preload script. Currently a no-op — the renderer talks to gr26 ingest
// directly over WebSocket and doesn't need any privileged main-process IPC.
// Add an `electron.contextBridge.exposeInMainWorld(...)` here later if the
// renderer needs OS-level access (e.g., reading files, GPIO, etc).
export {};
