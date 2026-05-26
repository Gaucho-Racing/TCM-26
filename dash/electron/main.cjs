const { app, BrowserWindow } = require("electron");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:3000";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 600,
    minWidth: 1200,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: require("path").join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.loadURL(APP_URL);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
