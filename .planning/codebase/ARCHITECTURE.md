# Architecture

**Analysis Date:** 2026-02-11

## Pattern Overview

**Overall:** Electron + React desktop application with layered architecture separating main process (Node.js), preload bridge (IPC), and renderer process (React UI).

**Key Characteristics:**
- Custom frameless window with drag-enabled title bar
- IPC-based main/renderer communication for window management
- State-driven UI that dynamically resizes window based on widget state
- Convex backend for data persistence and real-time sync
- Doctor-scoped consultation tracking with colour-coded timer phases
- Advanced window resizing architecture: state-driven dimensions, minimised bar mode, position persistence

## Layers

**Electron Main Process:**
- Location: `electron/main.ts`
- Purpose: Window lifecycle, tray integration, file I/O, OS-level events, IPC request handling
- Contains: Icon generation, window creation, system tray menu, IPC listeners for window operations
- Depends on: Electron API, Node.js fs/path modules
- Used by: Preload layer (via IPC), OS events
- Key Responsibilities: Enforce window bounds, validate window positions, manage tray updates, handle window show/hide

**Preload Bridge:**
- Location: `electron/preload.ts`
- Purpose: Safe IPC abstraction exposing electronAPI to renderer context with context isolation
- Contains: Context-isolated electronAPI object with send/invoke/on methods
- Depends on: Electron ipcRenderer, context isolation
- Used by: React components (via window.electronAPI)
- Methods exposed: Window control (minimize, restore, close), sizing (setWindowSize, setWindowMinSize, minimiseToBar, restoreFromBar), positioning (setWindowPosition, getWindowPosition), navigation (onNavigate, onWindowMoved), state notifications (setTimerRunning, setActiveDoctor)

**React UI Layer (Renderer Process):**
- Location: `src/components/*.tsx`, `src/hooks/`, `src/contexts/`
- Purpose: User interface, timer logic, state management, Convex integration, window resize orchestration
- Contains: Components, hooks, context providers, business logic, window dimension calculations
- Depends on: React, Convex, electronAPI
- Used by: Browser DOM, window events
- Key Responsibilities: Drive window resizing via widget state, persist window position to Convex, listen to window move events, manage doctor/timer state

**Timer Engine:**
- Location: `src/lib/timer-engine.ts`
- Purpose: Pure countdown logic independent of React/UI
- Contains: State machine (idle/running/paused/overtime), elapsed/remaining calculations, callbacks
- Depends on: Native Date API, type definitions only
- Used by: `useTimer` hook
- Testable: Unit tests in `src/lib/timer-engine.test.ts`

**Data Layer:**
- Location: `convex/` (backend), `src/hooks/useConvexData.ts` (client)
- Purpose: Persistent consultation history, appointment types, user settings, window position storage
- Contains: Schema definitions, mutation/query handlers
- Depends on: Convex backend
- Used by: React components for data fetch/mutations
- Window Position Persistence: Stored via `settings.updateWindowPosition()` mutation with userId and x/y coordinates

## Data Flow

**Window Resizing (Core Architecture - State-Driven):**

1. **State Change Trigger** (React)
   - `useTimer` hook detects widget state change (idle → setup, running, approval, minimised, doctorSelect, settings)
   - Component renders with appropriate content size requirements
   - Example: entering 'setup' state requires 280x350 minimum, 'running' requires 280x230

2. **Size Calculation & Communication** (React → IPC)
   - `TimerWidget.tsx` `useEffect` watches `timer.widgetState`
   - Maps state to minimum dimensions from constants in `src/types/index.ts`:
     - `STATE_MIN_WIDTHS`: idle=280, setup=280, running=280, approval=280, minimised=200, settings=280, doctorSelect=280
     - `STATE_MIN_HEIGHTS`: idle=175, setup=350, running=230, approval=490, minimised=40, settings=520, doctorSelect=280
   - Three resize patterns:
     - **Normal state transitions (line 196-197):** Calls `window.electronAPI?.setWindowMinSize(width, height)`
     - **Minimised transition (line 191):** Calls `window.electronAPI?.minimiseToBar()`
     - **Restore from minimised (line 194):** Calls `window.electronAPI?.restoreFromBar(width, height)`
     - **Settings pre-save (line 123, 411):** Saves current size to ref, restores on close (line 342)
   - Doctor selector handles dynamic height: `Math.max(STATE_MIN_HEIGHTS.doctorSelect, Math.min(400, contentHeight))` capped at 400px with scrolling

3. **IPC Routing & Handler Execution** (Main Process)
   - Preload methods map to ipcMain listeners:
     - `setWindowMinSize(minW, minH)` → `ipcMain.on('set-window-min-size', handler)`
     - `minimiseToBar()` → `ipcMain.on('minimise-to-bar', handler)`
     - `restoreFromBar(w, h)` → `ipcMain.on('restore-from-bar', handler)`
     - `setWindowSize(w, h)` → `ipcMain.on('set-window-size', handler)`
     - `setWindowPosition(x, y)` → `ipcMain.on('set-window-position', handler)`

4. **Main Process Window Bounds Management** (electron/main.ts)
   - **set-window-min-size handler (lines 542-563):**
     ```typescript
     mainWindow.setMinimumSize(minW, minH);
     const [currentW, currentH] = mainWindow.getSize();
     if (currentW < minW || currentH < minH) {
       mainWindow.setBounds({
         x: currentX,
         y: currentY,
         width: Math.max(currentW, minW),
         height: Math.max(currentH, minH),
       }, true); // animate: true
     }
     ```
     - Sets minimum allowed dimensions
     - Grows window if current size is smaller than new minimum
     - Preserves current position (x, y unchanged)

   - **minimise-to-bar handler (lines 579-589):**
     ```typescript
     mainWindow.setMinimumSize(200, 40);
     mainWindow.setMaximumSize(600, 40);
     mainWindow.setBounds({ x: currentX, y: currentY, width: 200, height: 40 }, true);
     ```
     - Locks exact 200x40 dimensions by setting max-size equal to min-size
     - Prevents user from expanding beyond bar height
     - Preserves x position so bar stays in place horizontally

   - **restore-from-bar handler (lines 591-605):**
     ```typescript
     mainWindow.setMaximumSize(0, 0); // Remove lock
     mainWindow.setMinimumSize(280, height);
     mainWindow.setBounds({ x: currentX, y: currentY, width, height }, true);
     ```
     - Removes max-size lock (0, 0 means unlimited)
     - Restores to requested dimensions
     - Re-applies minimum size constraints

   - **set-window-size handler (lines 531-540):**
     ```typescript
     mainWindow.setMinimumSize(width, height);
     mainWindow.setBounds({ x: currentX, y: currentY, width, height }, true);
     ```
     - Direct dimension setter (used for restoring from settings)

   - **set-window-position handler (lines 566-577):**
     ```typescript
     if (isPositionOnScreen(x, y)) {
       mainWindow.setPosition(Math.round(x), Math.round(y));
     } else {
       const pos = getCentredPosition();
       mainWindow.setPosition(pos.x, pos.y);
     }
     ```
     - Validates position against all displays' work areas
     - If off-screen, re-centres on primary display (320x175 window)

5. **Position Persistence via Events** (Electron → Convex)
   - **Window move event listener (lines 291-300):**
     ```typescript
     mainWindow.on('moved', () => {
       if (moveTimeout) clearTimeout(moveTimeout);
       moveTimeout = setTimeout(() => {
         const [x, y] = mainWindow.getPosition();
         mainWindow.webContents.send('window-moved', { x, y });
       }, 500); // Debounced
     });
     ```
     - Fires when user drags window
     - 500ms debounce prevents excessive updates during drag
     - Sends position to renderer via IPC

   - **Renderer listener in TimerWidget (lines 83-98):**
     ```typescript
     const handler = (position: { x: number; y: number }) => {
       updateWindowPositionMutation({
         userId: slug,
         x: position.x,
         y: position.y,
       }).catch(() => {});
     };
     window.electronAPI?.onWindowMoved(handler);
     ```
     - Async mutation to persist position per doctor
     - Silently fails if offline (cached by Convex)

   - **Position restore on startup (src/components/TimerWidget.tsx):**
     - Settings loaded via `useConvexData()` hook
     - Not explicitly restored to window (main process does cold-start positioning)
     - Could be enhanced to restore from Convex if desired

**Consultation Lifecycle:**

1. **Timer Start** (UI)
   - User selects appointment type, patient name, duration in `NewTimerForm`
   - `handleStart()` calls `timer.startTimer()` with `{ patientName, typeCode, typeName, durationMinutes }`

2. **Timer Running** (Engine Tick)
   - `TimerEngine` increments every 1000ms via `setInterval`
   - Calculates percent-complete = (elapsed - paused) / total
   - Phase (green/yellow/red/overtime) determined by thresholds
   - `onTick` callback updates React state: remainingSeconds, elapsedSeconds, percentComplete, overtimeSeconds

3. **Phase-Based Colour** (UI Rendering)
   - `useTimer` calls `getTimerColour(percentComplete, yellowThreshold, redThreshold)` from `src/lib/colour-calculator.ts`
   - Returns `{ background: string, text: string }`
   - Background gradient transitions via CSS `transition: background-color 1s ease`
   - Examples: green (#10B981) at 0%, yellow (#F59E0B) at 60%, red (#EF4444) at 90%+

4. **Stop & Save** (Approval → Persistence)
   - User clicks Stop → `timer.stop()` pauses engine, captures `approvalSnapshot` without destroying engine
   - Enters 'approval' widget state, shows `ApprovalScreen` component
   - User confirms save → `timer.save()` fully stops engine, returns final `TimerSnapshot`
   - `handleSave()` calls `saveConsultationData()` mutation → Convex persists to consultations table

## State Management

**Widget State** (UI container state):
- Single source of truth in `useTimer` hook: `widgetState: WidgetState`
- Types: 'idle' | 'setup' | 'running' | 'paused' | 'overtime' | 'approval' | 'minimised' | 'settings' | 'doctorSelect'
- Location: `src/types/index.ts` line 13
- Drives: component rendering, window dimensions, title bar style, colour background, IPC calls
- Transitions: Orchestrated by action callbacks (goToSetup, startTimer, pause, resume, stop, save, discard, minimise)

**Timer Engine State** (countdown logic):
- Managed by `TimerEngine` class via `_state` private field: 'idle' | 'running' | 'paused' | 'overtime'
- Separate from widget state to enable approval screen (engine paused but not destroyed, widget in 'approval')
- Allows "Back" button to resume timer from exact point

**Doctor Context** (global user selection):
- Location: `src/contexts/DoctorContext.tsx`
- Provides: `activeDoctor` (current doctor), `allDoctors` (list), `selectDoctor(slug)`, `clearDoctor()`
- Persisted: localStorage `restore-active-doctor`, sessionStorage `restore-session-alive`
- Session detection: Cold-start clears selection (shows doctor selector), hide-to-tray preserves selection
- Used by: All features (scopes consultations, settings, appointment types to this doctor)

**Convex Real-time Sync**:
- `useConvexData()` hook subscribes to backend via `useQuery(api.settings.getSettingsForUser(slug))`
- Automatically refetches when `activeDoctor` changes
- Optimistic updates via `useMutation()` (immediate UI update, async backend persistence)
- Offline: Tracks mutation failures, queues saves to localStorage, retries on reconnect

**Window Resize State** (Imperative):
- No local state, all driven by `widgetState` changes
- Pre-settings-size saved to `preSettingsSizeRef` to restore on settings close
- Pre-minimise state saved to `preMinimiseState` in useTimer to restore from minimised

## Key Abstractions

**TimerEngine (Pure Business Logic):**
- Purpose: Countdown state machine independent of React/Electron
- Location: `src/lib/timer-engine.ts`
- Responsibilities: Start, pause, resume, stop, calculate snapshots, fire callbacks
- Testable: Yes, unit tests in `src/lib/timer-engine.test.ts`
- Pattern: Class-based with callbacks (onTick, onOvertime, onComplete), getters for snapshot/state
- Accuracy: Uses Date.now() for elapsed calculation, setInterval only for scheduling ticks
- Pause tracking: Subtracts paused time from elapsed to get actual elapsed duration
- Used by: `useTimer` hook wraps it, React components consume via hook

**useTimer Hook (React Integration):**
- Purpose: Expose TimerEngine to React components with widget state sync
- Location: `src/hooks/useTimer.ts`
- Responsibilities: Lazy-init engine, manage widget state, coordinate approval screen, track minimise/restore
- Returns: Timer data (remainingSeconds, displayTime), consultation info, approval snapshot, actions (goToSetup, startTimer, pause, resume, stop, save, discard, goBack, minimise, restoreFromMinimised)
- Pattern: Custom hook with ref-based engine persistence, state-based visual updates, closure refs for option caching
- Minimise/Restore: Saves previous state in `preMinimiseState` ref, restores on expand

**Colour Calculator (Visual Phase Mapping):**
- Location: `src/lib/colour-calculator.ts`
- Purpose: Map percent-complete to RGB colours and text contrast
- Input: percentComplete (0.0-1.0+), yellowThreshold, redThreshold
- Output: `{ background: string, text: string }`
- Pattern: Pure function, tested in `src/lib/colour-calculator.test.ts`
- Phases: green (0%), yellow (60% threshold), red (90% threshold), overtime (>100%)

**ElectronAPI Type Bridge:**
- Location: `src/types/electron.d.ts`
- Purpose: Type-safe window.electronAPI namespace with context isolation
- Provides: Send methods (minimizeWindow, setWindowSize, setWindowMinSize, minimiseToBar, restoreFromBar, setWindowPosition, closeApp, hideWindow, setAlwaysOnTop), Invoke methods (getWindowPosition), On methods (onWindowMoved, onNavigate, onRequestSaveAndQuit), cleanup (removeAllListeners)
- Pattern: Interface declaration merged into Window global, safe for contextIsolation: true

**DoctorContext Provider:**
- Location: `src/contexts/DoctorContext.tsx`
- Purpose: Global doctor selection state with Convex sync
- Responsibilities: Load all doctors via useQuery, persist selection, session detection for cold-start
- Session detection: Uses `sessionStorage` to track cold-start vs hide-to-tray resume (hide-to-tray preserves state)
- Pattern: React Context + useQuery for backend sync

**MinimumSize State Management:**
- Pattern: Renderer tracks required dimensions for current state, sends to main process, main process enforces via setMinimumSize + setBounds
- Two-way binding: Renderer can request, main process validates and applies
- Example: 'setup' state requires 280x350, 'minimised' requires 200x40
- Dynamic case (doctorSelect): Renderer calculates height based on doctor count, caps at 400px

## Entry Points

**Main Window (Consultation Timer):**
- Location: `src/main.tsx` (React entry), `index.html` (HTML entry)
- Triggers: App launch, show from tray, Electron loads this by default
- Responsibilities: Doctor selection, consultation flow, settings, timer display
- Root component: `TimerWidget` wraps all UI state, uses `useTimer`, `useDoctorContext`, `useConvexData`
- Window creation: `electron/main.ts` createWindow() at app.whenReady()

**History Window:**
- Location: `src/history.tsx` (React entry), `history.html` (HTML entry)
- Triggers: "History" button in tray menu or main window, user clicks "History"
- Responsibilities: Display consultation records in table, show daily stats
- Root component: `HistoryApp` (separate React app, separate Convex provider, separate Vite entry point via vite.config.mts)
- Window creation: `electron/main.ts` createHistoryWindow() on demand, reuses if already open

**Main Process:**
- Location: `electron/main.ts`
- Triggers: Electron app launch (automatic, before any renderer)
- Responsibilities: Create windows, manage tray, handle IPC listeners, icon generation, lifecycle events
- Initialization: `app.whenReady().then(() => { createWindow(); createTray(); })`

## Error Handling

**Strategy:** Defensive with try-catch at mutation boundaries, silent failures in non-critical paths, user confirmation for destructive ops.

**Patterns:**

- **Convex Mutations:** Wrapped in try-catch, `.catch(() => {})` for non-blocking operations (e.g., position save)
  ```typescript
  updateWindowPositionMutation({...}).catch(() => {});
  ```

- **IPC Calls:** No error handling on sender side (send-only), errors in main process non-blocking
  ```typescript
  window.electronAPI?.setWindowMinSize(...); // Fire and forget
  ```

- **Window Position Validation:** If saved position off-screen, re-centre
  ```typescript
  if (isPositionOnScreen(x, y)) {
    mainWindow.setPosition(x, y);
  } else {
    const pos = getCentredPosition();
    mainWindow.setPosition(pos.x, pos.y);
  }
  ```

- **Timer Operations:** Defensive state checks before mutations
  ```typescript
  if (engine.state === 'running' || engine.state === 'overtime') {
    engine.pause();
  }
  ```

## Cross-Cutting Concerns

**Logging:** console.log for development, no structured logging framework. Errors swallowed silently in production catch blocks.

**Validation:**
- Window dimensions: `minWidth: 200, minHeight: 40` enforced at main process
- Appointment duration: positive numbers enforced in form via number input
- Doctor selection: required before starting consultation
- Position: validated against display work areas before applying

**Authentication:** None (localStorage + sessionStorage trusted, no user login needed)

**Window Management Across States:**
- **idle/setup/approval/settings:** Fixed minimum dimensions from STATE_MIN_HEIGHTS/STATE_MIN_WIDTHS, user can resize larger
- **minimised:** Exact 200x40, max-size locked to prevent expansion, preserve x-position for horizontal placement
- **doctorSelect:** Dynamic height based on doctor count (138px base + 52px per doctor, capped at 400px with scrolling)
- **running/paused/overtime:** 280x230 minimum, coloured background transitions smoothly
- Resize animation: Electron `setBounds(..., true)` animates transitions

**Position Persistence:**
- Main process emits `window-moved` after 500ms debounce on user drag
- Renderer listener fires Convex mutation asynchronously
- Persisted per-doctor (scoped by userId in settings table)
- Cold-start: Main process positions at screenWidth - 340, y: 20 as default (top-right corner)
- Cross-screen validation: Checks if position is within any display's workArea before applying

**macOS-Specific Behaviours:**
- Window close → hide to tray (not quit) via preventDefault() and hide()
- Always-on-top uses `'floating'` level for proper stacking (line 276)
- Dock icon generated dynamically if no icon.png file, or loaded from build/icon.png
- Title bar uses native macOS traffic light controls via custom frameless window with custom title bar component

---

*Architecture analysis: 2026-02-11*
