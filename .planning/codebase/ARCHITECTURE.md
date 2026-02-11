# Architecture

**Analysis Date:** 2026-02-11

## Pattern Overview

**Overall:** Multi-layered Electron desktop application with React frontend, real-time timer engine, and Convex backend (serverless database).

**Key Characteristics:**
- Electron main process manages window lifecycle, tray, and IPC
- React frontend with hooks for state management and UI rendering
- Pure timer engine (`TimerEngine` class) independent of React
- Convex provides data persistence and real-time sync
- Dual entry points: main timer widget and history window
- Offline-first design with localStorage fallback
- CSS-in-JSX using Tailwind for styling

## Layers

**Electron (Main Process):**
- Purpose: Manage native windows, system tray, and cross-platform lifecycle
- Location: `electron/main.ts`, `electron/preload.ts`
- Contains: Window creation, IPC handlers, tray menu, desktop integration
- Depends on: Electron APIs
- Used by: React renderer processes via IPC bridge
- Responsibilities: Enforce always-on-top, handle window resizing, manage history window, detect timer state for tray

**Preload Bridge:**
- Purpose: Securely expose Electron APIs to renderer context
- Location: `electron/preload.ts`
- Contains: `electronAPI` object with typed IPC methods
- Exposes: Window control, position tracking, navigation, quit notifications
- Consumed by: React components via `window.electronAPI`

**React Renderer (Frontend):**
- Purpose: Render UI and manage timer state transitions
- Location: `src/main.tsx` (entry), `src/App.tsx` (root), components in `src/components/`
- Contains: UI components, hooks, state management
- Depends on: React, Convex SDK, electron preload API
- Used by: Electron main process (loads HTML)

**State Management Layer:**
- Purpose: Coordinate timer logic, UI state, and data persistence
- Key files:
  - `src/hooks/useTimer.ts`: Widget state machine and timer control
  - `src/hooks/useConvexData.ts`: Backend data queries and mutations, offline handling
- Patterns: React hooks with refs for closure captures, lazy engine initialization

**Timer Engine (Business Logic):**
- Purpose: Pure timer countdown logic independent of React
- Location: `src/lib/timer-engine.ts`
- Contains: Timer state (`idle|running|paused|overtime`), elapsed/remaining calculations, phase transitions
- Depends on: `Date.now()` for accuracy, optional callbacks
- Used by: `useTimer` hook to drive state updates
- Responsibilities: Tick tocking, pause/resume tracking, pause-time exclusion from duration

**UI Components Layer:**
- Purpose: Render specific UI states and handle user input
- Location: `src/components/`
- Organized by: Widget state (Running, Paused, Approval, Settings, etc.)
- Components:
  - `TimerWidget.tsx`: Root widget orchestrator (3 screens: idle/setup, running, approval)
  - `TimerDisplay.tsx`: Shows elapsed time and consultation details
  - `TimerControls.tsx`: Pause/Resume/Stop buttons
  - `NewTimerForm.tsx`: Appointment type and duration selection
  - `ApprovalScreen.tsx`: Review and save consultation record
  - `SettingsView.tsx`: Sound, thresholds, appointment types
  - `MinimisedWidget.tsx`: Collapsed timer bar
  - `HistoryView.tsx`: Consultation history and stats
  - `CustomTitleBar.tsx`: Window title and minimize button

**Utility Libraries:**
- Purpose: Pure functions for color, sound, and calculations
- Location: `src/lib/`
- Files:
  - `colour-calculator.ts`: Phase-based interpolation (green→yellow→red→deep-red)
  - `sound.ts`: Audio playback (chime types)
  - `timer-engine.test.ts`, `colour-calculator.test.ts`: Vitest tests

**Types & Constants:**
- Purpose: Centralized type definitions and hardcoded defaults
- Location: `src/types/index.ts`
- Contains: `TimerState`, `TimerPhase`, `WidgetState`, `Consultation`, `TimerSettings`, `AppointmentType`
- Provides: `DOCTOR` (hardcoded MVP identity), `STATE_HEIGHTS`, `APPOINTMENT_TYPE_OPTIONS`

**Convex Backend:**
- Purpose: Serverless backend for data persistence and real-time sync
- Location: `convex/`
- Contains:
  - `schema.ts`: Table definitions (consultations, appointmentTypes, timerSettings)
  - `consultations.ts`: Save and query consultation records
  - `appointmentTypes.ts`: List, seed, and manage appointment types
  - `settings.ts`: Per-user timer preferences
- Accessed via: Convex React hooks (`useQuery`, `useMutation`)

## Data Flow

**Timer Start → Completion:**

1. User clicks "New Consultation" → `goToSetup()` changes `widgetState` to `setup`
2. Form submission → `startTimer()` initializes `TimerEngine.start()` and sets `widgetState` to `running`
3. Engine ticks every 1s → fires `onTick` callback → `setRemainingSeconds`, `setPercentComplete`
4. Color phase callback syncs color state → UI rerenders with new background
5. When countdown hits zero → `onOvertime` fires → sound plays, state becomes `overtime`
6. User clicks Stop → pauses engine, captures snapshot, enters `approval` state
7. User clicks Save → `save()` stops engine, returns final `TimerSnapshot`, calls `saveConsultationData` mutation
8. Convex mutation persists to database, state returns to `idle`

**Offline Handling:**

- `useConvexData` tracks online/offline via mutation failure grace period (3s)
- Consultation saves queued to localStorage if offline (key: `restore-timer-pending-saves`)
- On reconnect, pending saves are retried
- Fallback appointment types provided if Convex unavailable

**Window State Management:**

- `TimerWidget` tracks `widgetState` and adjusts window height via `electronAPI.setWindowSize()`
- Height mapping: `STATE_HEIGHTS[state]` (e.g., idle=175px, running=230px, settings=520px)
- Position saved to Convex after user moves window (500ms debounce)
- Always-on-top setting applied on mount

**History Window:**

- Separate React root in `history.html`
- `HistoryApp` → `HistoryView` renders consultation table and stats
- Queries `getTodayStats` (aggregated data for current doctor)

## State Management

**Widget State Machine (useTimer):**
```
idle ← setup ← cancelled
↓         ↓
setup → running → stop → approval → save → idle
            ↓              ↓
          paused ←— resume
            ↓
          overtime
```

**Vertical minimise/restore:**
```
any state → minimised → restore to previous state
```

**Consultation Info:**
- Immutable during timer lifecycle
- Captured at `startTimer()`: patient name, appointment type, duration, start timestamp
- Passed to approval and used for saving

**Engine State (TimerEngine):**
- Separate from widget state
- Tracks: `running|paused|overtime|idle`
- Engine persists in memory to allow "Back" from approval (paused, not stopped)

## Key Abstractions

**TimerEngine:**
- Pure, framework-agnostic countdown engine
- State: start time, pause timestamps, paused duration, total requested duration
- Accuracy: Uses `Date.now()` not `setInterval` for elapsed calculation
- Callbacks: `onTick`, `onThresholdChange`, `onOvertime`, `onComplete`
- Example usage: `engine.start(900); engine.pause(); engine.getSnapshot().remainingSeconds`

**TimerPhase:**
- Represents color state based on `percentComplete` and thresholds
- Values: `green|yellow|red|overtime`
- Drives CSS background color via `getTimerColour()` interpolation

**ConsultationInfo:**
- Data captured when timer starts
- Contains: patient name, appointment type (code and display name), target duration, start timestamp
- Persisted when saved, used to generate summary in approval

**WidgetState:**
- UI state superset (timer + setup/approval/settings/minimised)
- Values: `idle|setup|running|paused|overtime|approval|minimised|settings`
- Drives which component renders and window dimensions

## Entry Points

**Main Window:**
- Location: `src/main.tsx`
- Triggers: App launch (Electron loads `index.html`)
- Responsibilities: Create Convex client, wrap in ConvexProvider, render `App`
- `App.tsx` renders `TimerWidget`

**History Window:**
- Location: `src/history.tsx`
- Triggers: User clicks History in tray or settings
- Responsibilities: Create separate React root, render `HistoryApp`
- `electron/main.ts` creates second BrowserWindow, loads `history.html`

**Electron Main:**
- Location: `electron/main.ts`
- Triggers: App start (before any renderer)
- Responsibilities: Create main window, history window factory, tray, set up IPC, handle window lifecycle

## Error Handling

**Strategy:** Graceful degradation with offline fallback

**Patterns:**
- `useConvexData` catches mutation errors, queues offline, retries
- Component errors don't crash app (React StrictMode)
- Missing Convex data → use `FALLBACK_TYPES` and default settings
- Timer engine errors: throw if duration ≤ 0 (precondition check)
- IPC sends are fire-and-forget with catch for window destruction

## Cross-Cutting Concerns

**Logging:** `console.log/error` in development, can be replaced with Sentry/Convex logging

**Validation:**
- TypeScript types enforce structure
- Convex schema validates server-side
- Form submission validates appointment type and duration exist

**Authentication:**
- MVP hardcodes `DOCTOR = { userId: "dr-annetjie", doctorName: "Dr Annetjie van der Nest" }`
- All data scoped to this user ID
- Future: Replace with real identity provider

**Time Zone:**
- `consultationDate` stored as ISO string (date part, time part ignored)
- Used for grouping history by date
- All times in local timezone (app runs locally)

---

*Architecture analysis: 2026-02-11*
