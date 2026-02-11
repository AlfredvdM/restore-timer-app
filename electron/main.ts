import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  dialog,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let historyWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isTimerRunning = false;
let isQuitting = false;

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];

// Set app name for dock/taskbar display
app.name = "RESTORE Timer";

// ── Icon Generation ─────────────────────────────────────

function drawPixel(
  buf: Buffer,
  size: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= size || iy < 0 || iy >= size) return;
  const idx = (iy * size + ix) * 4;
  const na = Math.min(255, Math.round(a));
  if (na === 0) return;
  // Alpha-blend: new layer over existing
  const ea = buf[idx + 3];
  if (ea === 0 || na === 255) {
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = na;
  } else {
    const frac = na / 255;
    const inv = 1 - frac;
    buf[idx] = Math.round(r * frac + buf[idx] * inv);
    buf[idx + 1] = Math.round(g * frac + buf[idx + 1] * inv);
    buf[idx + 2] = Math.round(b * frac + buf[idx + 2] * inv);
    buf[idx + 3] = Math.min(255, Math.round(na + ea * inv));
  }
}

function drawRing(
  buf: Buffer,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  r: number,
  g: number,
  b: number,
) {
  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= inner - 0.5 && dist <= outer + 0.5) {
        let alpha = 255;
        if (dist < inner) alpha = Math.round((1 - (inner - dist)) * 255);
        else if (dist > outer)
          alpha = Math.round((1 - (dist - outer)) * 255);
        drawPixel(buf, size, x, y, r, g, b, alpha);
      }
    }
  }
}

function fillCircle(
  buf: Buffer,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius + 0.5) {
        const alpha =
          dist <= radius
            ? 255
            : Math.round((1 - (dist - radius)) * 255);
        drawPixel(buf, size, x, y, r, g, b, alpha);
      }
    }
  }
}

function drawLine(
  buf: Buffer,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
  r: number,
  g: number,
  b: number,
) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 3);
  const half = thickness / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    for (let oy = -Math.ceil(half); oy <= Math.ceil(half); oy++) {
      for (let ox = -Math.ceil(half); ox <= Math.ceil(half); ox++) {
        const d = Math.sqrt(ox * ox + oy * oy);
        if (d <= half + 0.5) {
          const alpha =
            d <= half ? 255 : Math.round((1 - (d - half)) * 255);
          drawPixel(
            buf,
            size,
            Math.round(px + ox),
            Math.round(py + oy),
            r,
            g,
            b,
            alpha,
          );
        }
      }
    }
  }
}

function createTrayIcon(): Electron.NativeImage {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2 + 1;

  // Clock face ring
  drawRing(buf, size, cx, cy, 11, 2.5, 0, 0, 0);
  // Hour hand (~10 o'clock)
  drawLine(buf, size, cx, cy, cx - 3.5, cy - 5, 2.5, 0, 0, 0);
  // Minute hand (~12 o'clock)
  drawLine(buf, size, cx, cy, cx + 1.5, cy - 8, 2, 0, 0, 0);
  // Stopwatch nub at top
  drawLine(buf, size, cx, cy - 11.5, cx, cy - 14, 2.5, 0, 0, 0);
  // Center dot
  fillCircle(buf, size, cx, cy, 1.5, 0, 0, 0);

  const img = nativeImage.createFromBitmap(buf, {
    width: size,
    height: size,
  });
  if (process.platform === "darwin") {
    img.setTemplateImage(true);
  }
  return img;
}

function createAppIcon(): Electron.NativeImage {
  const size = 256;
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;

  // Background circle (emerald)
  fillCircle(buf, size, cx, cy, 110, 5, 150, 105);
  // White clock face
  fillCircle(buf, size, cx, cy, 80, 255, 255, 255);
  // Clock ring (darker emerald)
  drawRing(buf, size, cx, cy, 80, 7, 4, 120, 87);

  // Hour marks at 12, 3, 6, 9
  drawLine(buf, size, cx, cy - 70, cx, cy - 56, 5, 4, 120, 87);
  drawLine(buf, size, cx + 70, cy, cx + 56, cy, 5, 4, 120, 87);
  drawLine(buf, size, cx, cy + 70, cx, cy + 56, 5, 4, 120, 87);
  drawLine(buf, size, cx - 70, cy, cx - 56, cy, 5, 4, 120, 87);

  // Hour hand (~10 o'clock)
  drawLine(buf, size, cx, cy, cx - 20, cy - 36, 8, 5, 150, 105);
  // Minute hand (~12 o'clock / slightly right)
  drawLine(buf, size, cx, cy, cx + 12, cy - 56, 6, 5, 150, 105);
  // Center dot
  fillCircle(buf, size, cx, cy, 8, 5, 150, 105);
  // Stopwatch nub
  drawLine(buf, size, cx, cy - 82, cx, cy - 100, 8, 4, 120, 87);
  fillCircle(buf, size, cx, cy - 103, 9, 4, 120, 87);

  return nativeImage.createFromBitmap(buf, {
    width: size,
    height: size,
  });
}

// ── Window Position Helpers ─────────────────────────────

function isPositionOnScreen(x: number, y: number): boolean {
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const { x: dx, y: dy, width, height } = display.workArea;
    return x >= dx && x < dx + width && y >= dy && y < dy + height;
  });
}

function getCentredPosition(): { x: number; y: number } {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: Math.round((width - 320) / 2),
    y: Math.round((height - 220) / 2),
  };
}

// ── Window Creation ─────────────────────────────────────

function createWindow() {
  const { width: screenWidth } =
    screen.getPrimaryDisplay().workAreaSize;

  // Use file-based icon in production, generated icon in dev
  const iconPath = path.join(__dirname, "..", "build", "icon.png");
  const appIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : createAppIcon();

  mainWindow = new BrowserWindow({
    title: "RESTORE Timer",
    width: 320,
    height: 175,
    x: screenWidth - 340,
    y: 20,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    transparent: true,
    hasShadow: true,
    show: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // macOS: use 'floating' level for proper always-on-top
  if (process.platform === "darwin") {
    mainWindow.setAlwaysOnTop(true, "floating");
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // ── Notify renderer when window moves (for position saving) ──
  let moveTimeout: ReturnType<typeof setTimeout> | null = null;
  mainWindow.on("moved", () => {
    if (!mainWindow) return;
    if (moveTimeout) clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      if (!mainWindow) return;
      const [x, y] = mainWindow.getPosition();
      mainWindow.webContents.send("window-moved", { x, y });
    }, 500);
  });

  // ── macOS: close hides to tray; Cmd+Q sets isQuitting ──
  mainWindow.on("close", (e) => {
    if (isQuitting) {
      // User chose Cmd+Q or Quit from tray — check timer first
      if (isTimerRunning) {
        e.preventDefault();
        showCloseConfirmation();
      }
      return;
    }

    if (process.platform === "darwin") {
      // On macOS, closing window hides to tray
      e.preventDefault();
      mainWindow?.hide();
      return;
    }

    // On other platforms, check timer before closing
    if (isTimerRunning) {
      e.preventDefault();
      showCloseConfirmation();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showCloseConfirmation() {
  if (!mainWindow) return;

  mainWindow.show();
  mainWindow.focus();

  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: "warning",
    title: "Timer is running",
    message: "A consultation timer is currently running.",
    buttons: ["Save and Quit", "Discard and Quit", "Cancel"],
    defaultId: 2,
    cancelId: 2,
  });

  if (choice === 0) {
    // Save and Quit — tell renderer to save, then we'll quit
    mainWindow.webContents.send("request-save-and-quit");
  } else if (choice === 1) {
    // Discard and Quit
    isTimerRunning = false;
    isQuitting = true;
    app.quit();
  }
  // choice === 2: Cancel — do nothing
}

function createHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }

  historyWindow = new BrowserWindow({
    width: 860,
    height: 620,
    minWidth: 640,
    minHeight: 400,
    resizable: true,
    title: "RESTORE — Consultation History",
    show: false,
    backgroundColor: "#f9fafb",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  historyWindow.once("ready-to-show", () => {
    historyWindow?.show();
    historyWindow?.focus();
  });

  if (VITE_DEV_SERVER_URL) {
    const historyUrl =
      VITE_DEV_SERVER_URL.replace(/\/$/, "") + "/history.html";
    historyWindow.loadURL(historyUrl);
  } else {
    historyWindow.loadFile(path.join(__dirname, "../dist/history.html"));
  }

  historyWindow.on("closed", () => {
    historyWindow = null;
  });
}

// ── System Tray ─────────────────────────────────────────

function updateTrayMenu() {
  if (!tray) return;
  const isVisible = mainWindow?.isVisible() ?? false;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? "Hide Timer" : "Show Timer",
      click: () => toggleMainWindow(),
    },
    { type: "separator" },
    {
      label: "New Consultation",
      click: () => {
        showMainWindow();
        mainWindow?.webContents.send("navigate", "new-consultation");
      },
    },
    {
      label: "History",
      click: () => createHistoryWindow(),
    },
    {
      label: "Settings",
      click: () => {
        showMainWindow();
        mainWindow?.webContents.send("navigate", "settings");
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        if (isTimerRunning) {
          showCloseConfirmation();
        } else {
          app.quit();
        }
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function toggleMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
  updateTrayMenu();
}

function showMainWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  updateTrayMenu();
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("RESTORE Timer");
  updateTrayMenu();

  // Click on tray icon toggles window visibility
  tray.on("click", () => {
    toggleMainWindow();
  });
}

// ── IPC Handlers ────────────────────────────────────────

ipcMain.on("minimize-window", () => {
  mainWindow?.minimize();
});

ipcMain.on("restore-window", () => {
  mainWindow?.restore();
  mainWindow?.show();
});

ipcMain.on("close-app", () => {
  isQuitting = true;
  app.quit();
});

ipcMain.on("hide-window", () => {
  mainWindow?.hide();
  updateTrayMenu();
});

ipcMain.on("set-always-on-top", (_event, value: boolean) => {
  if (mainWindow) {
    if (process.platform === "darwin") {
      mainWindow.setAlwaysOnTop(value, "floating");
    } else {
      mainWindow.setAlwaysOnTop(value);
    }
  }
});

ipcMain.on("set-window-size", (_event, width: number, height: number) => {
  if (mainWindow) {
    const [currentX, currentY] = mainWindow.getPosition();
    mainWindow.setBounds(
      { x: currentX, y: currentY, width, height },
      true,
    );
  }
});

ipcMain.on(
  "set-window-position",
  (_event, x: number, y: number) => {
    if (mainWindow) {
      if (isPositionOnScreen(x, y)) {
        mainWindow.setPosition(Math.round(x), Math.round(y));
      } else {
        const pos = getCentredPosition();
        mainWindow.setPosition(pos.x, pos.y);
      }
    }
  },
);

ipcMain.on("minimise-to-bar", () => {
  if (mainWindow) {
    const [currentX, currentY] = mainWindow.getPosition();
    mainWindow.setBounds(
      { x: currentX, y: currentY, width: 200, height: 40 },
      true,
    );
  }
});

ipcMain.on(
  "restore-from-bar",
  (_event, width: number, height: number) => {
    if (mainWindow) {
      const [currentX, currentY] = mainWindow.getPosition();
      mainWindow.setBounds(
        { x: currentX, y: currentY, width, height },
        true,
      );
    }
  },
);

ipcMain.handle("get-window-position", () => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    return { x, y };
  }
  return null;
});

ipcMain.on("open-history-window", () => {
  createHistoryWindow();
});

ipcMain.on("timer-state-changed", (_event, running: boolean) => {
  isTimerRunning = running;
});

// ── App Lifecycle ───────────────────────────────────────

app.whenReady().then(() => {
  // Set dock icon on macOS
  if (process.platform === "darwin") {
    const dockIconPath = path.join(__dirname, "..", "build", "icon.png");
    const dockIcon = fs.existsSync(dockIconPath)
      ? nativeImage.createFromPath(dockIconPath)
      : createAppIcon();
    app.dock.setIcon(dockIcon);
  }

  createWindow();
  createTray();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    showMainWindow();
  } else {
    createWindow();
  }
});
