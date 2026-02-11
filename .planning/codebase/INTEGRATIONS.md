# External Integrations

**Analysis Date:** 2026-02-11

## APIs & External Services

**Convex Backend:**
- Service: Convex (Backend-as-a-service)
- What it's used for: Data persistence, real-time queries, API mutations, and serverless functions
  - SDK/Client: `convex/react` (React hooks: `useQuery`, `useMutation`)
  - API generated: `convex/_generated/api` (auto-generated type-safe client)
  - Auth: Deployment-based (no explicit auth system, single-user per deployment)

## Data Storage

**Databases:**
- Convex (cloud-hosted document database)
  - Connection: `VITE_CONVEX_URL` environment variable (e.g., `https://exciting-gazelle-477.convex.cloud`)
  - Client: `ConvexReactClient` (instantiated in `src/main.tsx`)
  - Schema location: `convex/schema.ts`

**Local Storage:**
- Browser localStorage for offline queue caching
  - Key: `restore-timer-pending-saves` (stores unsaved consultation records during offline periods)
  - Implementation: `src/hooks/useConvexData.ts` (lines 29, 129-143)

**File Storage:**
- Local filesystem only - no external file storage integration
- Icons/build assets stored locally in `build/` directory

**Caching:**
- None - relies on Convex real-time updates and localStorage for offline support

## Window Position Persistence (New)

**Storage Integration:**
- Convex `timerSettings` table stores window position as `{ x: number, y: number }`
- Mutation API: `api.settings.updateWindowPosition(userId, x, y)`
- Position validation via screen bounds checking (`isPositionOnScreen()` in `electron/main.ts`)
- Persistence flow:
  1. Electron main process broadcasts `window-moved` event (debounced 500ms)
  2. React component `TimerWidget.tsx` receives position via `window.electronAPI.onWindowMoved()`
  3. Position saved to Convex via `updateWindowPositionMutation`
  4. Position restored on app launch via stored setting

**File locations:**
- Main process IPC handlers: `electron/main.ts` (lines 290-300, 566-577, 607-613)
- Preload bridge: `electron/preload.ts` (lines 18-19, 27-28)
- React integration: `src/components/TimerWidget.tsx` (lines 82-98, 123, 194)
- Database schema: `convex/schema.ts` (lines 59-63)
- Mutation handler: `convex/settings.ts` (lines 67-85)

## Authentication & Identity

**Auth Provider:**
- None - custom single-user implementation
- Approach: Doctor slug/name used as userId
  - All consultation saves include doctor `slug` as identifier
  - Settings keyed by `userId` (doctor slug per active doctor)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Browser console logs (development)
- No centralized logging service

## CI/CD & Deployment

**Hosting:**
- Electron: Desktop application (distributed via DMG on macOS, NSIS on Windows)
- Convex backend: Cloud-hosted at Convex Cloud (`exciting-gazelle-477.convex.cloud`)
- Static assets: Served from Convex hosting (`VITE_CONVEX_SITE_URL`)

**CI Pipeline:**
- None detected (local build scripts only)

## Environment Configuration

**Required env vars:**
- `CONVEX_DEPLOYMENT` - Local Convex development deployment ID (e.g., `dev:exciting-gazelle-477`)
- `VITE_CONVEX_URL` - Convex backend API endpoint (e.g., `https://exciting-gazelle-477.convex.cloud`)
- `VITE_CONVEX_SITE_URL` - Convex hosting URL (e.g., `https://exciting-gazelle-477.convex.site`)

**Secrets location:**
- `.env.local` file (not committed, development only)
- Production environment variables set via deployment platform

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None - Convex uses real-time subscriptions instead of webhooks

**Electron IPC Callbacks (New):**
- `window-moved` - Main → Renderer event for position changes
- `navigate` - Tray menu commands (new-consultation, settings, switch-doctor)
- `request-save-and-quit` - Pre-quit save handler

## Offline Support

**Implementation:**
- Offline detection: 3-second grace period after mount (`OFFLINE_GRACE_MS` in `src/hooks/useConvexData.ts`)
- Offline queue mechanism:
  - Failed mutations stored in `localStorage` with key `restore-timer-pending-saves`
  - Payloads automatically flushed when online connection restored
  - Located in: `src/hooks/useConvexData.ts` (lines 125-161)

**User impact:**
- Consultations can be recorded offline (stored locally)
- Data syncs to Convex when connection returns
- UI displays offline indicator (`src/components/OfflineIndicator.tsx`)
- Window position NOT saved offline (position mutation fails silently)

## Convex Database Schema

**Tables:**

1. **doctors** - Doctor profiles for the practice
   - Indexes: `by_slug`, `by_active`
   - Fields: slug, name, colour, isActive, createdAt
   - Location: `convex/schema.ts`

2. **consultations** - Core consultation records
   - Indexes: `by_doctor`, `by_date`, `by_doctor_and_type`
   - Fields: doctorId, doctorName, patientName, appointmentType, targetDurationSeconds, actualDurationSeconds, overtimeSeconds, pausedDurationSeconds, consultationDate, startedAt, completedAt, notes, status
   - Location: `convex/consultations.ts`

3. **appointmentTypes** - Configurable appointment type definitions
   - Indexes: `by_code`, `by_active`
   - Fields: name, code, defaultDurationMinutes, colour, isActive, sortOrder
   - Location: `convex/appointmentTypes.ts`

4. **timerSettings** - User settings for timer app (includes window position)
   - Indexes: `by_user`
   - Fields: userId, soundEnabled, soundVolume, chimeType, yellowThreshold, redThreshold, alwaysOnTop, defaultAppointmentType, windowPosition
   - Location: `convex/schema.ts` (lines 49-65), `convex/settings.ts`

## Convex API Functions

**Mutations (write operations):**
- `api.consultations.saveConsultation` - Store completed consultation
- `api.doctors.createDoctor` - Add new doctor profile
- `api.doctors.deleteDoctor` - Remove doctor and related data
- `api.appointmentTypes.seedAppointmentTypes` - Initialize default appointment types
- `api.appointmentTypes.upsertAppointmentType` - Create or update appointment type
- `api.appointmentTypes.toggleAppointmentTypeActive` - Enable/disable appointment type
- `api.appointmentTypes.reorderAppointmentTypes` - Update sort order
- `api.settings.updateSetting` - Update single setting field
- `api.settings.saveSettings` - Replace all user settings
- `api.settings.getOrCreateDefaultSettings` - Initialize settings if missing
- `api.settings.updateWindowPosition` - Persist window coordinates to Convex (NEW)

**Queries (read operations):**
- `api.doctors.getAllDoctors` - Fetch all active doctor profiles
- `api.appointmentTypes.getActiveAppointmentTypes` - Fetch enabled types only
- `api.appointmentTypes.getAllAppointmentTypes` - Fetch all types (including inactive)
- `api.settings.getSettings` - Fetch user settings by userId (includes windowPosition)
- `api.consultations.getConsultations` - Query consultations with filters (doctorId, date range, type)
- `api.consultations.getTodayStats` - Calculate daily statistics (count, average duration, % on-time)

---

*Integration audit: 2026-02-11*
