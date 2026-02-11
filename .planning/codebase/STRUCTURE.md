# Codebase Structure

**Analysis Date:** 2026-02-11

## Directory Layout

```
restore-timer/
├── electron/                    # Electron main process and preload
│   ├── main.ts                 # Main process: window creation, IPC handlers, tray
│   └── preload.ts              # Preload bridge: safe IPC API exposure
├── src/                        # React renderer process
│   ├── main.tsx                # Main window entry point
│   ├── App.tsx                 # Root component wrapper
│   ├── HistoryApp.tsx          # History window root (separate Convex provider)
│   ├── history.tsx             # History window entry point (separate Vite entry)
│   ├── components/             # UI components organized by feature
│   │   ├── TimerWidget.tsx     # Root widget orchestrator (498 lines, master component)
│   │   ├── TimerDisplay.tsx    # Display elapsed time and details
│   │   ├── TimerControls.tsx   # Pause/Resume/Stop buttons
│   │   ├── NewTimerForm.tsx    # Appointment type and duration selection
│   │   ├── ApprovalScreen.tsx  # Review and save consultation record
│   │   ├── SettingsView.tsx    # Sound, thresholds, appointment types (large component)
│   │   ├── MinimisedWidget.tsx # Collapsed timer bar (40px height)
│   │   ├── HistoryView.tsx     # Consultation history and stats
│   │   ├── HistoryTable.tsx    # Consultation records table
│   │   ├── DoctorSetup.tsx     # Initial doctor profile creation
│   │   ├── DoctorSelector.tsx  # Doctor selection from list
│   │   ├── DoctorBadge.tsx     # Doctor name/colour display badge
│   │   ├── CustomTitleBar.tsx  # Window title and minimize button
│   │   └── OfflineIndicator.tsx # Offline status badge
│   ├── contexts/               # React Context providers
│   │   └── DoctorContext.tsx   # Global doctor selection + session detection
│   ├── hooks/                  # Custom React hooks
│   │   ├── useTimer.ts         # Timer state machine and engine wrapper (314 lines)
│   │   └── useConvexData.ts    # Convex query/mutation wrapper, offline handling
│   ├── lib/                    # Pure utility functions and business logic
│   │   ├── timer-engine.ts     # Countdown state machine (300+ lines)
│   │   ├── timer-engine.test.ts # Unit tests for timer engine
│   │   ├── colour-calculator.ts # Phase-based RGB colour interpolation
│   │   ├── colour-calculator.test.ts # Unit tests for colour calculator
│   │   └── sound.ts            # Audio playback (chime types)
│   ├── types/                  # Type definitions and constants
│   │   ├── index.ts            # Core types, STATE_MIN_HEIGHTS/WIDTHS, appointment options
│   │   ├── electron.d.ts       # electronAPI interface declaration
│   │   └── vite-env.d.ts       # Vite environment types
├── convex/                     # Serverless backend (Convex)
│   ├── schema.ts               # Database schema (tables, indexes)
│   ├── doctors.ts              # Doctor CRUD, migration
│   ├── consultations.ts        # Consultation save/query
│   ├── appointmentTypes.ts     # Appointment type management
│   ├── settings.ts             # User settings (sound, thresholds, position)
│   └── _generated/             # Auto-generated types and API
│       ├── api.d.ts            # API function signatures
│       ├── dataModel.d.ts      # Database model types
│       └── server.d.ts         # Server utilities
├── build/                      # Build assets (icons)
│   ├── icon.icns              # macOS icon
│   ├── icon.ico               # Windows icon
│   └── icon.png               # General PNG icon
├── dist/                       # Vite build output (HTML, JS, CSS) — GENERATED
├── dist-electron/              # Electron main process build output — GENERATED
├── release/                    # Packaged app builds (macOS .dmg, Windows .exe) — GENERATED
├── .planning/
│   └── codebase/               # Codebase analysis documents
│       ├── ARCHITECTURE.md     # Architecture and layers, data flow, window resizing
│       └── STRUCTURE.md        # This file, directory purposes and file locations
├── index.html                  # Main window HTML
├── history.html                # History window HTML
├── vite.config.mts             # Vite build config (dual entry points: main + history)
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies, build scripts, electron-builder config
├── tailwind.config.js          # Tailwind CSS config
├── postcss.config.js           # PostCSS config
├── vitest.config.mts           # Vitest test runner config
├── .env.local                  # Convex deployment URL (local)
└── .gitignore                  # Git ignore rules
```

## Directory Purposes

**electron/:**
- Purpose: Electron main process code and preload bridge
- Contains: Window management, IPC handlers, tray menu, OS integration, icon generation
- Key files:
  - `main.ts` (662 lines) - createWindow(), createHistoryWindow(), createTray(), IPC listeners
  - `preload.ts` (40 lines) - contextBridge.exposeInMainWorld('electronAPI', {...})
- Responsibilities:
  - Window lifecycle (create, show/hide, close, minimize, restore)
  - IPC message handling (window resizing, positioning, state notifications)
  - Tray menu with dynamic items based on timer state
  - Window position validation and bounds checking
  - Icon generation (clock icon for tray, app icon for dock/taskbar)

**src/:**
- Purpose: React renderer process source code
- Contains: UI components, state management hooks, business logic utilities, type definitions
- Key files:
  - `main.tsx` - Entry point, creates Convex client, renders App
  - `App.tsx` - Root component that wraps TimerWidget in DoctorProvider
  - `HistoryApp.tsx` - Separate root for history window with own Convex provider
  - `history.tsx` - History window entry point (separate Vite bundle)
- Responsibilities: Render UI, manage timer state, persist data via Convex, drive window resizing

**src/components/:**
- Purpose: Reusable and feature-specific React UI components
- Contains: Stateless and stateful components rendering different widget states and UIs
- Key files (14 total):
  - `TimerWidget.tsx` (498 lines) - Master orchestrator component, manages all widget states (idle, setup, running, paused, approval, minimised, settings, doctorSelect)
  - `SettingsView.tsx` (27473 bytes) - Large settings panel with sound, thresholds, appointment type management
  - `HistoryTable.tsx` (18627 bytes) - Consultation records table with sorting/filtering
  - `HistoryView.tsx` (5305 bytes) - History window root with stats aggregation
  - `ApprovalScreen.tsx` (4362 bytes) - Save/discard consultation with duration summary
  - `DoctorSetup.tsx` (3338 bytes) - Initial doctor profile creation form
  - `DoctorSelector.tsx` (2892 bytes) - Doctor selection from list, add new doctor
  - `NewTimerForm.tsx` (5067 bytes) - Form for selecting appointment type and duration
  - `CustomTitleBar.tsx` (2231 bytes) - Custom window title bar with close/minimize buttons
  - `TimerDisplay.tsx` (1914 bytes) - Shows elapsed time, patient name, appointment type, target
  - `DoctorBadge.tsx` (1554 bytes) - Doctor name and colour badge display
  - `TimerControls.tsx` (1829 bytes) - Pause/Resume/Stop buttons for running state
  - `MinimisedWidget.tsx` (1169 bytes) - Collapsed timer bar showing time with expand button
  - `OfflineIndicator.tsx` (388 bytes) - Small offline status badge

**src/contexts/:**
- Purpose: React Context providers for global application state
- Contains: Doctor selection provider with localStorage and sessionStorage persistence
- Key file:
  - `DoctorContext.tsx` (87 lines) - DoctorProvider with useQuery to load doctors, selectDoctor(), clearDoctor()
- Responsibilities:
  - Load all doctors from Convex backend
  - Persist selected doctor to localStorage
  - Detect session type: cold-start (clear selection) vs hide-to-tray (preserve selection) via sessionStorage
  - Provide selectedDoctor to all descendant components via Context

**src/hooks/:**
- Purpose: Reusable React hooks encapsulating business logic
- Contains: Timer state machine, Convex data fetching, offline handling
- Key files:
  - `useTimer.ts` (314 lines) - Timer engine wrapper, manages widget state transitions (idle → setup → running → approval → idle), handles minimise/restore, lazy-inits engine
  - `useConvexData.ts` - Convex query/mutation wrapper, tracks online/offline, queues pending saves, provides fallback data
- Responsibilities:
  - Hide complexity of timer engine from components
  - Manage widget state machine with callbacks for transitions
  - Sync backend queries and mutations
  - Handle offline scenarios gracefully

**src/lib/:**
- Purpose: Pure utility functions and testable business logic (no React or Electron dependencies)
- Contains: Timer engine (state machine), colour calculator, sound playback
- Key files:
  - `timer-engine.ts` (300+ lines) - Pure countdown logic, no framework dependencies, testable
  - `timer-engine.test.ts` - Vitest unit tests for timer accuracy, pause handling, phase transitions
  - `colour-calculator.ts` (82 lines) - RGB interpolation for phase colours (green → yellow → red → deep red)
  - `colour-calculator.test.ts` - Unit tests for colour phase calculations
  - `sound.ts` - Audio playback utilities (chime types)
- Responsibilities:
  - Provide reusable business logic
  - Enable testing without React/Electron setup
  - Keep timer and colour logic framework-independent

**src/types/:**
- Purpose: TypeScript type definitions and shared constants
- Contains: Core types (TimerState, WidgetState, Consultation, etc.), window dimension maps, appointment type options
- Key files:
  - `index.ts` (148 lines) - All shared types, `STATE_MIN_HEIGHTS` map (idle: 175, setup: 350, running: 230, etc.), `STATE_MIN_WIDTHS` map, `APPOINTMENT_TYPE_OPTIONS` array, `DOCTOR` object
  - `electron.d.ts` (27 lines) - ElectronAPI interface merged into Window global, safe with contextIsolation
  - `vite-env.d.ts` - Vite environment variable types
- Responsibilities:
  - Centralize type definitions for consistency
  - Define window dimension constants used by TimerWidget for resizing
  - Provide fallback appointment types for offline mode

**convex/:**
- Purpose: Serverless backend schema, queries, and mutations
- Contains: Database schema definitions and API functions
- Key files:
  - `schema.ts` (55 lines) - Table definitions: doctors (slug, name, colour), consultations (timing, patient, appointment, duration), appointmentTypes (name, code, duration, active, sortOrder), timerSettings (per-user preferences, window position)
  - `doctors.ts` - Doctor CRUD operations, migration logic, getAllDoctors() query, deleteDoctor() mutation
  - `consultations.ts` - saveConsultation() mutation, getTodayStats() aggregation, listConsultations() query
  - `appointmentTypes.ts` - getActiveAppointmentTypes() query, seedDefaultAppointmentTypes() mutation, toggleAppointmentType(), reorderAppointmentTypes()
  - `settings.ts` - getSettingsForUser() query with auto-create default, updateWindowPosition() mutation for position persistence
  - `_generated/` - Auto-generated type-safe API stubs (do not edit, regenerated by Convex)
- Responsibilities:
  - Define data schema and relationships
  - Provide queries and mutations for React components
  - Handle server-side validation and authorization
  - Store consultation history, doctor profiles, settings, window positions

**build/:**
- Purpose: Static asset files for application branding
- Contains: Application icons for different platforms
  - `icon.icns` - macOS app icon (used by electron-builder)
  - `icon.ico` - Windows app icon (used by electron-builder)
  - `icon.png` - General PNG icon (used by Electron app)
- Responsibilities:
  - Provide assets for DMG installer, Windows installer, dock/taskbar display

**dist/:**
- Purpose: Vite production build output for renderer process (HTML, JavaScript, CSS)
- Generated: Yes, by `npm run build` (Vite compiles React)
- Committed: No, in .gitignore
- Consumed by: Electron main process loads `dist/index.html` in production, electron-builder packages assets
- Contains: main.html, history.html, assets/ folder with JS/CSS bundles

**dist-electron/:**
- Purpose: Compiled Electron main process (JavaScript)
- Generated: Yes, by `npm run build` (vite-plugin-electron compiles TypeScript)
- Committed: No, in .gitignore
- Consumed by: Electron app loader (package.json "main" field points to dist-electron/main.js)
- Contains: main.js (compiled from electron/main.ts)

**.planning/codebase/:**
- Purpose: GSD codebase analysis and planning documents
- Contains: ARCHITECTURE.md (data flow, layers, window resizing logic), STRUCTURE.md (this file)
- Generated: Yes, by `/gsd:map-codebase` command
- Committed: Yes, for future reference and consistency with future Claude instances
- Used by: `/gsd:plan-phase` loads these to understand codebase before creating implementation plans

## Key File Locations

**Entry Points:**
- `src/main.tsx` (13 lines) - Main window React entry: creates Convex client, renders App component
- `src/history.tsx` - History window React entry: separate Convex provider, renders HistoryApp component
- `electron/main.ts` (662 lines) - Electron main process entry: creates windows, sets up IPC, manages tray
- `index.html` - Main window HTML file (loads main.tsx bundle)
- `history.html` - History window HTML file (loads history.tsx bundle)

**Configuration:**
- `vite.config.mts` (28 lines) - Vite build config: React plugin, electron plugin, dual entry points (main + history)
- `tsconfig.json` (20 lines) - TypeScript config: ESNext target, DOM + DOM.Iterable lib, strict mode, jsx: react-jsx
- `package.json` (74 lines) - Dependencies (react, convex, electron, electron-builder), build scripts, app metadata (name, version, productName), electron-builder config (DMG for macOS, NSIS for Windows)
- `tailwind.config.js` (2 lines) - Tailwind CSS: uses defaults, no custom theme
- `postcss.config.js` (3 lines) - PostCSS: autoprefixer, tailwindcss plugins
- `vitest.config.mts` (4 lines) - Vitest test runner: minimal config
- `.env.local` (1 line, not committed) - Convex deployment URL

**Core Logic:**
- `src/hooks/useTimer.ts` (314 lines) - Complete timer widget state machine, engine wrapper, minimise/restore logic
- `src/lib/timer-engine.ts` (300+ lines) - Pure countdown state machine, isolated from React/Electron
- `src/components/TimerWidget.tsx` (498 lines) - Master orchestrator managing all widget states and window resizing coordination
- `src/contexts/DoctorContext.tsx` (87 lines) - Global doctor selection with session detection
- `src/hooks/useConvexData.ts` - Backend data sync, offline handling, pending saves queue
- `src/types/index.ts` (148 lines) - All shared types and dimension constants (STATE_MIN_HEIGHTS, STATE_MIN_WIDTHS)
- `convex/schema.ts` (55 lines) - Database table definitions
- `electron/main.ts` (662 lines) - Window lifecycle, IPC handlers, window position validation, tray menu

**Testing:**
- `src/lib/timer-engine.test.ts` - Timer accuracy tests using Vitest
- `src/lib/colour-calculator.test.ts` - Colour phase calculation tests
- Run with: `npm run test` or `npm run test:watch`

## Naming Conventions

**Files:**
- React components: PascalCase suffix `.tsx` (e.g., `TimerWidget.tsx`, `CustomTitleBar.tsx`, `DoctorSetup.tsx`)
- Hooks: camelCase prefix `use`, suffix `.ts` (e.g., `useTimer.ts`, `useConvexData.ts`)
- Utils/lib: camelCase hyphenated, suffix `.ts` (e.g., `timer-engine.ts`, `colour-calculator.ts`, `sound.ts`)
- Types: camelCase, suffix `.d.ts` for declarations (e.g., `electron.d.ts`, `vite-env.d.ts`)
- Tests: Same name as source + `.test.ts` suffix (e.g., `timer-engine.test.ts`, `colour-calculator.test.ts`)
- Directories: lowercase plural (e.g., `components/`, `hooks/`, `lib/`, `types/`)

**Exports:**
- Component exports: Default export (e.g., `export default function TimerWidget() {...}`)
- Hook exports: Named export (e.g., `export function useTimer(...) {...}`)
- Type exports: Named exports (e.g., `export interface TimerState {...}`, `export type WidgetState = ...`)
- Constant exports: Named exports (e.g., `export const STATE_MIN_HEIGHTS = {...}`)

**Imports:**
- React imports: `import { useState, useEffect } from 'react'`
- Convex imports: `import { useMutation, useQuery } from 'convex/react'` and `import { api } from '../../convex/_generated/api'`
- Electron types: `import type { ElectronAPI } from '../types/electron'`
- Relative imports: Use `../` for parent directory navigation, prefer explicit over barrel files
- No barrel files: Direct imports preferred (e.g., `from '../hooks/useTimer'` not `from '../hooks'`)

## Where to Add New Code

**New Widget State (e.g., new consultation mode):**
1. Add state name to `WidgetState` type in `src/types/index.ts`
2. Add dimensions to `STATE_MIN_HEIGHTS` and `STATE_MIN_WIDTHS` in `src/types/index.ts`
3. Create component: `src/components/[StateName].tsx`
4. Add transition logic to `useTimer.ts` action callbacks
5. Add rendering case in `TimerWidget.tsx` JSX
6. IPC window resize call automatically fires via useEffect watching `timer.widgetState`

**New Feature (e.g., timer notifications):**
- Primary UI: `src/components/` for components
- State logic: `src/hooks/useTimer.ts` or `src/hooks/use[Feature].ts`
- Business logic: `src/lib/[feature].ts` (pure, testable)
- Types: Add to `src/types/index.ts` if shared
- Tests: `src/lib/[feature].test.ts` for pure logic
- Backend: `convex/[table].ts` if data persistence needed

**New Electron Integration (window control, IPC):**
1. Add handler to `electron/main.ts`: `ipcMain.on('new-command', handler)`
2. Expose API in `electron/preload.ts`: Add method to electronAPI object
3. Add types in `src/types/electron.d.ts`: Declare method in ElectronAPI interface
4. Call from React: `window.electronAPI?.newCommand(...)`

**New Backend Feature (new data, new queries):**
1. Update `convex/schema.ts`: Add/modify table definition
2. Create `convex/[feature].ts`: Add query and mutation functions
3. Update `src/types/index.ts`: Add TypeScript types to match schema
4. Call from React: Use `useQuery(api.[feature].query)` and `useMutation(api.[feature].mutation)`
5. Handle offline in `useConvexData.ts` if needed

**Window Resizing Changes (state-based dimensions):**
1. Update `STATE_MIN_HEIGHTS[state]` or `STATE_MIN_WIDTHS[state]` in `src/types/index.ts`
2. Coordinate with component rendering: Ensure component content fits in dimensions
3. Test resizing: Transition to state should trigger IPC call to main process
4. Position handling: For special cases, add custom resize logic in `TimerWidget.tsx` useEffect before/after state transition

**Tests:**
- Pure logic: `src/lib/[feature].test.ts` using Vitest
- React hooks: Can be tested in component integration tests (not currently done)
- Components: Currently not unit tested, rely on manual testing

## Special Directories

**dist/ (Build Output - Generated):**
- Purpose: Vite production build of renderer process
- Generated: Yes, by `npm run build`
- Committed: No, in .gitignore
- Consumed by: Electron main process in production loads `dist/index.html`
- Contains: index.html, history.html, assets/ folder with JS/CSS bundles

**dist-electron/ (Build Output - Generated):**
- Purpose: Compiled Electron main process (TypeScript → JavaScript)
- Generated: Yes, by `npm run build` (vite-plugin-electron)
- Committed: No, in .gitignore
- Consumed by: Electron app loader (package.json "main" field: "dist-electron/main.js")
- Contains: main.js (compiled from electron/main.ts)

**node_modules/ (Dependencies):**
- Purpose: Installed npm packages
- Generated: Yes, by `npm install` (creates ~400MB directory)
- Committed: No, in .gitignore
- Size: ~400MB with all dependencies

**convex/_generated/ (Auto-Generated Types):**
- Purpose: Type-safe API stubs generated by Convex CLI from schema
- Generated: Yes, by `convex dev` or `convex deploy` (automatic)
- Committed: Yes (safe, consistently regenerated from schema)
- Consumed by: React components via `import { api } from '../../convex/_generated/api'`
- Should not edit: Regenerated automatically when schema changes

**.planning/codebase/ (GSD Analysis Documents):**
- Purpose: Codebase mapping documents for GSD orchestrator and future Claude instances
- Generated: Yes, by `/gsd:map-codebase` command
- Committed: Yes, for team reference and future Claude context
- Files: ARCHITECTURE.md (design, data flow, window resizing), STRUCTURE.md (this file)
- Used by: `/gsd:plan-phase` loads these to understand codebase before creating implementation plans

**release/ (Packaged Applications):**
- Purpose: Distributable app packages (.dmg for macOS, .exe for Windows)
- Generated: Yes, by `npm run build:mac` or `npm run build:win`
- Committed: No, in .gitignore
- Size: ~100-200MB per platform
- Created by: electron-builder from dist/ and dist-electron/

**build/ (Asset Files):**
- Purpose: Application icons and branding assets
- Generated: No, committed as source files
- Contains: icon.icns (macOS), icon.ico (Windows), icon.png (generic)
- Used by: Electron builder config in package.json, app icon initialization in main.ts

---

*Structure analysis: 2026-02-11*
