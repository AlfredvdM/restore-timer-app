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

## Authentication & Identity

**Auth Provider:**
- None - custom single-user implementation
- Approach: Hardcoded `DOCTOR` user object in `src/types/index.ts`
  - All consultation saves include fixed `doctorId` and `doctorName`
  - Settings keyed by `userId` (hardcoded per deployment)

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

## Convex Database Schema

**Tables:**

1. **consultations** - Core consultation records
   - Indexes: `by_doctor`, `by_date`, `by_doctor_and_type`
   - Fields: doctorId, doctorName, patientName, appointmentType, targetDurationSeconds, actualDurationSeconds, overtimeSeconds, pausedDurationSeconds, consultationDate, startedAt, completedAt, notes, status
   - Location: `convex/consultations.ts`

2. **appointmentTypes** - Configurable appointment type definitions
   - Indexes: `by_code`, `by_active`
   - Fields: name, code, defaultDurationMinutes, colour, isActive, sortOrder
   - Location: `convex/appointmentTypes.ts`

3. **timerSettings** - User settings for timer app
   - Indexes: `by_user`
   - Fields: userId, soundEnabled, soundVolume, chimeType, yellowThreshold, redThreshold, alwaysOnTop, defaultAppointmentType, windowPosition
   - Location: `convex/settings.ts`

## Convex API Functions

**Mutations (write operations):**
- `api.consultations.saveConsultation` - Store completed consultation
- `api.appointmentTypes.seedAppointmentTypes` - Initialize default appointment types
- `api.appointmentTypes.upsertAppointmentType` - Create or update appointment type
- `api.appointmentTypes.toggleAppointmentTypeActive` - Enable/disable appointment type
- `api.appointmentTypes.reorderAppointmentTypes` - Update sort order
- `api.settings.updateSetting` - Update single setting field
- `api.settings.saveSettings` - Replace all user settings
- `api.settings.getOrCreateDefaultSettings` - Initialize settings if missing

**Queries (read operations):**
- `api.appointmentTypes.getActiveAppointmentTypes` - Fetch enabled types only
- `api.appointmentTypes.getAllAppointmentTypes` - Fetch all types (including inactive)
- `api.settings.getSettings` - Fetch user settings by userId
- `api.consultations.getConsultations` - Query consultations with filters (doctorId, date range, type)
- `api.consultations.getTodayStats` - Calculate daily statistics (count, average duration, % on-time)

---

*Integration audit: 2026-02-11*
