# Technology Stack

**Analysis Date:** 2026-02-11

## Languages

**Primary:**
- TypeScript 5.0.3 - Frontend (React), backend (Convex), and desktop (Electron)

**Secondary:**
- JavaScript - Configuration files and Node scripts

## Runtime

**Environment:**
- Node.js (via npm)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React 18.0.0 - UI framework for web and Electron renderer process
- Convex 1.31.7 - Backend-as-a-service platform for data storage, real-time queries, and mutations

**Desktop:**
- Electron 33.0.0 - Desktop application framework with window management, IPC, tray support
- Vite 6.4.1 - Build tool and dev server
- vite-plugin-electron 0.28.0 - Electron integration with Vite
- vite-plugin-electron-renderer 0.14.0 - Renderer process build optimization
- electron-builder 25.0.0 - Cross-platform app packaging and building

**Styling:**
- Tailwind CSS 3.4.4 - Utility-first CSS framework
- PostCSS 8.4.38 - CSS processing pipeline
- Autoprefixer 10.4.19 - CSS vendor prefix automation

**Testing:**
- Vitest 4.0.18 - Unit and integration test runner
- TypeScript compiler tests

## Key Dependencies

**Critical:**
- convex 1.31.7 - Provides database, real-time queries, mutations, and API backend
- react 18.0.0 - UI rendering and state management
- electron 33.0.0 - Desktop application runtime with window management APIs

**Infrastructure:**
- @vitejs/plugin-react 4.2.1 - React Fast Refresh and JSX support
- tailwindcss 3.4.4 - CSS utility generation
- vite-plugin-electron - Electron main/preload process build configuration

## Window Management (New)

**Electron APIs:**
- `BrowserWindow` - Main and history window creation with configurable size, position, and resizing
- `ipcMain` / `ipcRenderer` - Inter-process communication for window control commands
- `screen` - Display detection for position validation and screen bounds checking

**Window Resizing Features:**
- Dynamic minimum window size constraints per UI state (`STATE_MIN_WIDTHS`, `STATE_MIN_HEIGHTS` in `src/types/index.ts`)
- Position persistence stored in Convex `timerSettings.windowPosition`
- State-specific sizing:
  - `minimised`: 200x40 px (locked to prevent user resize)
  - `idle`: 280x175 px
  - `setup`: 280x350 px
  - `running`/`paused`/`overtime`: 280x230 px
  - `approval`: 280x490 px
  - `settings`: 280x520 px
  - `doctorSelect`: 280x280 px (dynamic height based on doctor count)
- Minimise-to-bar functionality with max-size lock

**IPC Window Commands:**
- `set-window-size` - Set exact window dimensions
- `set-window-min-size` - Set minimum constraints
- `set-window-position` - Restore saved position with validation
- `minimise-to-bar` - Lock to 200x40 with maximum bounds
- `restore-from-bar` - Unlock and restore to previous state size
- `set-always-on-top` - Toggle floating window mode
- `window-moved` (event) - Broadcast position changes for persistence

## Configuration

**Environment:**
- `.env.local` - Convex deployment configuration
- Variables required:
  - `CONVEX_DEPLOYMENT` - Convex development deployment ID
  - `VITE_CONVEX_URL` - Backend API endpoint (Convex Cloud)
  - `VITE_CONVEX_SITE_URL` - Hosting URL for Convex site

**Build:**
- `vite.config.mts` - Vite configuration with React and Electron plugins
- `vitest.config.mts` - Test configuration (includes `src/**/*.test.ts`)
- `tsconfig.json` - TypeScript compiler configuration (ESNext target, strict mode enabled)
- `tailwind.config.js` - Tailwind CSS content paths
- `postcss.config.js` - PostCSS plugins for Tailwind

**Electron Builder:**
- `package.json` `build` section - Cross-platform distribution configuration
  - macOS: DMG installer with app icon
  - Windows: NSIS installer with uninstaller customization
  - App ID: `co.za.restorecare.timer`

**Electron Main Process:**
- `electron/main.ts` - Window creation, IPC handlers, tray menu, position validation
- `electron/preload.ts` - Secure context bridge exposing window control APIs

## Platform Requirements

**Development:**
- Node.js runtime
- npm package manager
- TypeScript support (tsc compilation)
- Convex account and project access

**Production:**
- macOS 10.13+ (DMG distribution)
- Windows 7+ (NSIS installer)
- Standalone executable (no additional runtimes required after installation)

---

*Stack analysis: 2026-02-11*
