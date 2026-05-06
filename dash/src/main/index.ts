import { app, BrowserWindow, globalShortcut } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

// The driver display is 1600x600. In production we run kiosk + fullscreen
// (no chrome, no escape) so a stray hand on the wheel can't kill the dash.
// In dev we use a normal resizable window so it's actually usable.
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 600,
    kiosk: !isDev,
    frame: isDev,
    fullscreen: !isDev,
    resizable: isDev,
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

  // No menu bar in production — driver shouldn't see it.
  if (!isDev) {
    win.setMenu(null);
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  // Block common keyboard shortcuts that would close the app or break out of
  // kiosk mode in production. Devtools stays available in dev.
  if (!isDev) {
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
