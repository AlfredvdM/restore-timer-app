import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  restoreWindow: () => ipcRenderer.send("restore-window"),
  closeApp: () => ipcRenderer.send("close-app"),
  hideWindow: () => ipcRenderer.send("hide-window"),
  setAlwaysOnTop: (value: boolean) =>
    ipcRenderer.send("set-always-on-top", value),
  setWindowSize: (width: number, height: number) =>
    ipcRenderer.send("set-window-size", width, height),
  setWindowPosition: (x: number, y: number) =>
    ipcRenderer.send("set-window-position", x, y),
  getWindowPosition: () => ipcRenderer.invoke("get-window-position"),
  openHistoryWindow: () => ipcRenderer.send("open-history-window"),
  setTimerRunning: (isRunning: boolean) =>
    ipcRenderer.send("timer-state-changed", isRunning),

  // Main → Renderer listeners
  onWindowMoved: (callback: (position: { x: number; y: number }) => void) => {
    ipcRenderer.on("window-moved", (_event, position) => callback(position));
  },
  onNavigate: (callback: (target: string) => void) => {
    ipcRenderer.on("navigate", (_event, target) => callback(target));
  },
  onRequestSaveAndQuit: (callback: () => void) => {
    ipcRenderer.on("request-save-and-quit", () => callback());
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
