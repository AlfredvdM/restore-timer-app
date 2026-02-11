# Codebase Structure

**Analysis Date:** 2026-02-11

## Directory Layout

```
restore-timer/
├── electron/               # Electron main process
├── src/                    # React renderer source
├── convex/                 # Convex backend functions and schema
├── build/                  # Asset files (icons)
├── dist/                   # Built React assets (generated)
├── dist-electron/          # Built Electron main process (generated)
├── scripts/                # Build and utility scripts
├── index.html              # Main window entry HTML
├── history.html            # History window entry HTML
├── package.json            # Dependencies, build scripts
├── vite.config.mts         # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── vitest.config.mts       # Test runner configuration
└── .planning/              # GSD planning directory
```

## Directory Purposes

**`electron/`:**
- Purpose: Electron main process and preload bridge
- Contains: TypeScript files for native desktop integration
- Key files:
  - `main.ts` (599 lines): Window creation, tray, IPC handlers, icon generation
  - `preload.ts` (32 lines): Context bridge exposing `electronAPI` to renderer

**`src/`:**
- Purpose: React application source code
- Contains: Components, hooks, libraries, types
- Structure: Organized by layer (components, hooks, lib, types)

**`src/components/`:**
- Purpose: React UI components
- Contains: State machine views and presentational components
- Key files (13 total):
  - `TimerWidget.tsx` (377 lines): Main orchestrator, handles all state transitions
  - `TimerDisplay.tsx`: Shows elapsed time, patient name, appointment type
  - `TimerControls.tsx`: Pause, Resume, Stop buttons
  - `NewTimerForm.tsx`: Form to select appointment type and duration
  - `ApprovalScreen.tsx`: Review consultation before saving
  - `SettingsView.tsx`: User preferences (sound, thresholds, appointment types)
  - `MinimisedWidget.tsx`: Collapsed timer bar
  - `HistoryView.tsx`: Consultation history and daily stats
  - `HistoryTable.tsx`: Table of consultation records
  - `CustomTitleBar.tsx`: Window title bar with minimize button
  - `OfflineIndicator.tsx`: Offline status badge

**`src/hooks/`:**
- Purpose: React hooks for state and data logic
- Contains: 2 hooks (both well-scoped)
  - `useTimer.ts` (314 lines): Complete timer widget state machine, engine control
  - `useConvexData.ts`: Convex queries/mutations, offline detection, pending saves

**`src/lib/`:**
- Purpose: Pure utility functions and business logic
- Contains: Framework-independent modules
  - `timer-engine.ts` (200+ lines): `TimerEngine` class, countdown logic, phase calculation
  - `timer-engine.test.ts`: Vitest tests for timer accuracy
  - `colour-calculator.ts` (82 lines): Color interpolation (green→yellow→red→overtime)
  - `colour-calculator.test.ts`: Vitest tests for color phases
  - `sound.ts`: Audio playback utilities

**`src/types/`:**
- Purpose: TypeScript type definitions and constants
- Contains:
  - `index.ts` (127 lines): All shared types (`TimerState`, `TimerPhase`, `WidgetState`, `Consultation`, `TimerSettings`, `AppointmentType`), hardcoded `DOCTOR`, state heights, appointment defaults
  - `electron.d.ts`: Window type definitions for `electronAPI`
  - `vite-env.d.ts`: Vite-provided type definitions

**`convex/`:**
- Purpose: Serverless backend implementation
- Contains: Database schema and mutations/queries
  - `schema.ts` (55 lines): Table definitions (consultations, appointmentTypes, timerSettings)
  - `consultations.ts`: Mutation to save consultation, query to list and aggregate
  - `appointmentTypes.ts`: Seed types, query active, toggle status, reorder
  - `settings.ts`: Get/create default settings, update individual settings, save window position
  - `_generated/`: Auto-generated types and API client (do not edit)

**`build/`:**
- Purpose: Static assets for application icon
- Contains: `.icns` (macOS), `.ico` (Windows), `.png` files

**`dist/` and `dist-electron/`:**
- Purpose: Build output directories (generated)
- Created by: `npm run build` (Vite for React, Vite plugins for Electron)
- Consumed by: Production app and electron-builder

**`scripts/`:**
- Purpose: Build and utility scripts
- Contains: TypeScript/shell scripts for setup, build, testing

## Key File Locations

**Entry Points:**
- `index.html`: Loads main React app (`src/main.tsx`)
- `history.html`: Loads history app (`src/history.tsx`)
- `electron/main.ts`: Electron entry point (configured in `vite.config.mts`)
- `electron/preload.ts`: Preload bridge (configured in `vite.config.mts`)

**Configuration:**
- `vite.config.mts`: Build config for React + Electron + multiple entry points
- `electron-builder` config in `package.json` (`build` key): DMG (macOS), NSIS (Windows)
- `tailwind.config.js`: Tailwind CSS (no custom config, uses defaults)
- `tsconfig.json`: TypeScript (ES2020, module resolution for paths)
- `vitest.config.mts`: Test runner (minimal config)
- `.env.local`: Convex URL and secrets (not committed)

**Core Logic:**
- `src/hooks/useTimer.ts`: Timer state machine and engine control
- `src/lib/timer-engine.ts`: Pure countdown engine
- `src/components/TimerWidget.tsx`: Main UI orchestrator
- `convex/schema.ts`: Data model definitions
- `electron/main.ts`: Window and tray lifecycle

**Testing:**
- `src/lib/timer-engine.test.ts`: Timer accuracy tests
- `src/lib/colour-calculator.test.ts`: Color phase tests
- Run with: `npm test` or `npm run test:watch`

## Naming Conventions

**Files:**
- React components: PascalCase (`TimerWidget.tsx`, `NewTimerForm.tsx`)
- Utility functions: camelCase (`colour-calculator.ts`, `sound.ts`)
- Types: PascalCase (`types/index.ts`)
- Tests: Append `.test.ts` to source (`timer-engine.test.ts`)

**Directories:**
- Feature directories: plural, lowercase (`components`, `hooks`, `lib`, `types`)
- Convex functions: descriptive camelCase (no directories, flat structure)

**Type Names:**
- Hook return types: `Use[Feature]Return` (e.g., `UseTimerReturn`)
- Hook options: `Use[Feature]Options` (e.g., `UseTimerOptions`)
- Component props: `[Component]Props` (not used in codebase, inline props)
- Interfaces: PascalCase (`TimerEngine`, `Consultation`, `TimerSettings`)
- Types: PascalCase (`WidgetState`, `TimerState`, `TimerPhase`)

**Functions:**
- React hooks: `use[Feature]` (e.g., `useTimer`, `useConvexData`)
- Utility functions: camelCase (`getTimerColour`, `formatTime`, `playChime`)
- Engine methods: camelCase (`start`, `pause`, `resume`, `stop`, `reset`)

## Where to Add New Code

**New Feature (e.g., new timer state screen):**
- Primary code: `src/components/[FeatureName].tsx`
- State management: Add case to `useTimer.ts` widget state machine
- Tests: `src/lib/[feature].test.ts` if pure logic
- Types: Add to `src/types/index.ts` if shared types

**New Component/Module:**
- Presentational UI: `src/components/[ComponentName].tsx`
- State hook: `src/hooks/use[Feature].ts`
- Pure logic: `src/lib/[feature].ts`
- Tests: `src/lib/[feature].test.ts`

**Backend Changes (Convex):**
- Data model: Update table in `convex/schema.ts`
- Mutations/queries: Add to `convex/[table-name].ts`
- Type definitions: Update `src/types/index.ts` after regenerating Convex types

**Utilities:**
- Shared helpers: `src/lib/[utility].ts` (e.g., `sound.ts`, `colour-calculator.ts`)
- Constants: Add to `src/types/index.ts` (e.g., `STATE_HEIGHTS`, `APPOINTMENT_TYPE_OPTIONS`)
- Types: Centralized in `src/types/index.ts`

**New Electron Feature (window control, IPC):**
- Main process: `electron/main.ts` (add IPC handler or window method)
- Preload bridge: `electron/preload.ts` (expose API to renderer)
- React usage: Call via `window.electronAPI.[method]()`

## Special Directories

**`.planning/`:**
- Purpose: GSD (Get Shit Done) planning documents
- Subdirectories: `codebase/` (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Not committed initially, created by GSD mapper
- Committed: Yes, for team reference

**`convex/_generated/`:**
- Purpose: Auto-generated types and API client
- Generated: By `convex dev` or `convex deploy`
- Committed: Yes (safe to commit, generated from schema)
- Should not edit: Regenerates on Convex schema changes

**`dist/` and `dist-electron/`:**
- Purpose: Build output
- Generated: By `npm run build`
- Committed: No (in .gitignore)
- Consumed by: `electron-builder` for DMG/NSIS creation

**`release/`:**
- Purpose: Built app installers and disk images
- Generated: By `npm run build:mac` or `npm run build:win`
- Committed: No
- Contains: `.dmg`, `.exe`, `.nsis` artifacts

## Module Organization

**Circular Dependencies:**
- None detected; dependency graph is acyclic:
  - Components → Hooks → Engine/Utils
  - Hooks → Convex/Types
  - Engine/Utils → Types only
  - No bidirectional imports

**Barrel Files:**
- None used (flat imports preferred)
- Import directly: `import { useTimer } from '../hooks/useTimer'` (not re-exported)

**Code Splitting (Vite):**
- Main entry: `index.html` → `src/main.tsx` → builds to `dist/assets/main-[hash].js`
- History entry: `history.html` → `src/history.tsx` → builds to `dist/assets/history-[hash].js`
- Lazy components: Not used (app is small enough)
- Convex client: Bundled per entry point

---

*Structure analysis: 2026-02-11*
