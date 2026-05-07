import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadConfig, saveConfig, type DashConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
// Kiosk mode is only meaningful on the Jetson (Linux). When a packaged
// build is run on macOS/Windows it's almost certainly a team member
// inspecting it on a desktop, so a windowed app with normal Cmd+Q
// behavior is what they actually want. Override with DASH_KIOSK=1 if
// you ever do want kiosk on a non-Linux box.
const kioskMode = process.env.DASH_KIOSK === '1' || (!isDev && process.platform === 'linux');

// Register IPC handlers for the renderer to read/write the runtime config
// file. Wiring this up before the window opens guarantees the renderer's
// initial dashConfig.get() call always finds a handler.
ipcMain.handle('dash-config:get', async () => loadConfig());
ipcMain.handle('dash-config:set', async (_event, next: DashConfig) => saveConfig(next));

// The driver display is 1600x600. In kiosk we run fullscreen with no
// chrome and no escape so a stray hand on the wheel can't kill the dash.
// Outside kiosk (dev, or a packaged build on Mac/Win) we use a normal
// resizable window so it's actually usable.
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 600,
    kiosk: kioskMode,
    frame: !kioskMode,
    fullscreen: kioskMode,
    resizable: !kioskMode,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Strip the menu bar in kiosk only — leave it on Mac/Win so Cmd+Q etc
  // still work the way users expect.
  if (kioskMode) {
    win.setMenu(null);
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  // Block common keyboard shortcuts that would close the app or break
  // out of kiosk mode. Only do this in actual kiosk mode — never on a
  // dev box or on Mac/Win where the user wants Cmd+Q to work.
  if (kioskMode) {
    const blocked = [
      'CommandOrControl+Q',
      'CommandOrControl+W',
      'CommandOrControl+R',
      'CommandOrControl+Shift+I',
      'F11',
      'Alt+F4',
    ];
    for (const accel of blocked) {
      globalShortcut.register(accel, () => {
        // swallow
      });
    }
  }

  // Re-create window if it gets closed somehow (it shouldn't in kiosk mode).
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Auto-restart the renderer if it crashes — driver should never see a blank
  // screen for long.
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] renderer gone:', details.reason);
    win.reload();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// On macOS dev, quit on close like a normal app. On Linux/Windows kiosk, we
// never want to quit — but window-all-closed shouldn't fire there anyway
// because the kiosk window can't be closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
