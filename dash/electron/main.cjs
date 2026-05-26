const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");
const { fork } = require("child_process");

const APP_HOST = process.env.APP_HOST || "127.0.0.1";
const APP_PORT = process.env.APP_PORT || "3000";
const APP_URL = process.env.APP_URL;

let serverProcess = null;

function getRuntimeDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "runtime");
  }
  return path.join(__dirname, "runtime");
}

function startBundledServer() {
  const runtimeDir = getRuntimeDir();
  const serverEntry = path.join(runtimeDir, "server.js");
  serverProcess = fork(serverEntry, [], {
    cwd: runtimeDir,
    env: {
      ...process.env,
      HOSTNAME: APP_HOST,
      PORT: APP_PORT,
      NODE_ENV: "production",
    },
    stdio: "inherit",
  });

  serverProcess.on("exit", () => {
    serverProcess = null;
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not start within ${timeoutMs}ms: ${url}`));
          return;
        }
        setTimeout(tryConnect, 250);
      });
    };
    tryConnect();
  });
}

function createWindow(url) {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 600,
    minWidth: 1200,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.loadURL(url);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(async () => {
  const url = APP_URL || `http://${APP_HOST}:${APP_PORT}`;

  if (!APP_URL) {
    startBundledServer();
    await waitForServer(url);
  }

  createWindow(url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(url);
    }
  });
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
