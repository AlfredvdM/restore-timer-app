export interface ElectronAPI {
  minimizeWindow: () => void;
  restoreWindow: () => void;
  closeApp: () => void;
  hideWindow: () => void;
  setAlwaysOnTop: (value: boolean) => void;
  setWindowSize: (width: number, height: number) => void;
  setWindowMinSize: (minW: number, minH: number) => void;
  minimiseToBar: () => void;
  restoreFromBar: (width: number, height: number) => void;
  setWindowPosition: (x: number, y: number) => void;
  getWindowPosition: () => Promise<{ x: number; y: number } | null>;
  openHistoryWindow: () => void;
  setTimerRunning: (isRunning: boolean) => void;
  setActiveDoctor: (name: string | null) => void;
  onWindowMoved: (callback: (position: { x: number; y: number }) => void) => void;
  onNavigate: (callback: (target: string) => void) => void;
  onRequestSaveAndQuit: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
