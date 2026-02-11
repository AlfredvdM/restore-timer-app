# Codebase Concerns

**Analysis Date:** 2026-02-11

## Tech Debt

**Hardcoded Single Doctor Identity:**
- Issue: `DOCTOR` constant is hardcoded in `src/types/index.ts` with only "Dr Annetjie van der Nest" (userId: "dr-annetjie")
- Files: `src/types/index.ts` (line 6), `src/hooks/useConvexData.ts` (line 4), `src/components/TimerWidget.tsx` (line 4)
- Impact: Application is locked to a single user. Multi-user support will require significant refactoring throughout the codebase
- Fix approach: Implement authentication/identity system (OAuth, JWT, or similar) and replace all hardcoded DOCTOR references with context-based identity lookup

**Offline Queue Not Thread-Safe:**
- Issue: `pendingSaves` ref in `useConvexData.ts` (lines 126-134) uses `localStorage` for offline queue, but mutations don't check for concurrent updates
- Files: `src/hooks/useConvexData.ts` (lines 136-161)
- Impact: If multiple saves happen while offline, there's a risk of data loss if localStorage read/write cycles overlap
- Fix approach: Implement a proper queue with atomic writes (indexed DB or local database) instead of JSON stringification

**No Input Validation in Convex Functions:**
- Issue: Mutation handlers accept values without range validation. Thresholds, volumes, and durations could be invalid
- Files: `convex/consultations.ts`, `convex/settings.ts`
- Impact: Invalid data (negative durations, threshold > 100%) could be persisted to database
- Fix approach: Add validation guards in Convex mutation handlers before insertion

**Type Casting in useConvexData:**
- Issue: Line 188 in `src/hooks/useConvexData.ts` uses `as any` when calling `upsertTypeMutation`
- Files: `src/hooks/useConvexData.ts` (line 188, 199, 209)
- Impact: Bypasses type safety, could cause runtime errors if Convex schema changes
- Fix approach: Create proper TypeScript types for Convex payload shapes and remove `as any` casts

**Silent Offline Failures:**
- Issue: Error handlers silently ignore offline errors with no user feedback or logging
- Files: `src/hooks/useConvexData.ts` (lines 169-170, 190-191, 212-213)
- Impact: Settings changes or appointment type updates may fail silently without user awareness
- Fix approach: Implement error logging and show toast/notification on mutation failures

## Known Bugs

**Window Position Not Validated on Multiple Displays:**
- Symptoms: Window could appear off-screen when user has multiple displays or unplugs display after saving position
- Files: `electron/main.ts` (lines 222-228), `src/components/TimerWidget.tsx` (lines 56-65)
- Trigger: Save window position on multi-display setup, then disconnect secondary display
- Workaround: Reposition window by dragging or use tray menu

**IPC Listener Cleanup Incomplete:**
- Symptoms: Event listeners may accumulate on rapid state changes
- Files: `src/components/TimerWidget.tsx` (lines 77-81, 107-110, 147-149)
- Cause: Listeners registered via `onWindowMoved`, `onNavigate`, `onRequestSaveAndQuit` use `ipcRenderer.on()` which doesn't guarantee cleanup
- Workaround: None currently

**Pause Time Not Recalculated on Resume if Already Overtime:**
- Symptoms: If timer is paused in overtime then resumed, remaining logic may not update correctly
- Files: `src/lib/timer-engine.ts` (lines 76-87)
- Cause: `resume()` restores state based on `remainingSeconds <= 0` check, but doesn't account for the fact that new time may have elapsed during pause
- Workaround: Don't pause while in overtime

## Security Considerations

**No Authentication/Authorization:**
- Risk: Any user can save consultation records under Dr Annetjie's identity. No role-based access control
- Files: `src/hooks/useConvexData.ts`, `convex/consultations.ts`, `electron/main.ts`
- Current mitigation: Desktop app is single-user by design; data is protected by machine access
- Recommendations:
  - If multi-user support is added, implement Convex auth module
  - Add user identity verification in all Convex mutations
  - Implement row-level security (RLS) in Convex

**Consultation Data Exposed in localStorage:**
- Risk: Offline queue stores consultation payloads in plain text in localStorage (`restore-timer-pending-saves`)
- Files: `src/hooks/useConvexData.ts` (lines 29, 142, 153)
- Current mitigation: Desktop app with OS-level file permissions; healthcare data doesn't contain PII in most cases (patient name is optional)
- Recommendations:
  - Use IndexedDB with encryption (e.g., `sql.js` or better)
  - Clear queue after successful sync
  - Implement auto-clear on app close

**Window Position Data in Convex:**
- Risk: Window position (x, y coordinates) is stored in Convex database without encryption
- Files: `src/components/TimerWidget.tsx` (lines 67-81), `convex/settings.ts`
- Current mitigation: Position data is innocuous
- Recommendations: Not critical, but consider whether screen coordinates reveal sensitive information about practice layout

**No Rate Limiting on Mutations:**
- Risk: Convex functions have no rate limiting. Malicious requests could spam database writes
- Files: `convex/consultations.ts`, `convex/settings.ts`, `convex/appointmentTypes.ts`
- Current mitigation: Single desktop app limits practical abuse
- Recommendations: Add rate limiting to Convex mutations if multi-user

## Performance Bottlenecks

**All Consultations Fetched Then Filtered Client-Side:**
- Problem: `getConsultations` in `convex/consultations.ts` (line 54) calls `.collect()` on potentially thousands of records, then filters in-memory
- Files: `convex/consultations.ts` (lines 54-75), `src/components/HistoryTable.tsx` (lines 97-102)
- Cause: Convex queries don't support OR conditions efficiently; filtering by date range and type requires post-fetch filtering
- Impact: History view will be slow with > 1000 consultations; memory usage grows with database size
- Improvement path:
  - Add compound indexes for (doctorId, appointmentType, consultationDate)
  - Implement pagination at Convex level instead of client-side
  - Cache consultation count to estimate page counts

**SettingsView Component Re-renders on Every Keystroke:**
- Problem: Threshold inputs (lines 138-178 in `SettingsView.tsx`) update local state on every keystroke, causing full component re-renders
- Files: `src/components/SettingsView.tsx` (lines 113-122)
- Cause: `useEffect` dependencies re-sync after mutations; no debouncing on input
- Impact: Minor; component is small and infrequently used
- Improvement path: Debounce threshold inputs (300ms) before calling `onUpdateSetting`

**Color Calculation Not Memoized:**
- Problem: `getTimerColour()` called on every tick (1000ms) even if percentComplete hasn't crossed a threshold
- Files: `src/hooks/useTimer.ts` (line 118), `src/lib/colour-calculator.ts`
- Cause: No memoization of color result
- Impact: Negligible (colour calc is fast); component re-renders regardless due to tick updates
- Improvement path: Memoize colour result, only update when percentComplete crosses threshold boundaries

**Timer Engine Creates New setInterval on Every Resume:**
- Problem: `resume()` creates a new `setInterval` (line 86 in `timer-engine.ts`) each time, potentially creating duplicate ticks
- Files: `src/lib/timer-engine.ts` (lines 76-87)
- Cause: `clearInterval()` call may not fire synchronously before new interval is created
- Impact: Minimal in practice; tick frequency is low (1000ms)
- Improvement path: Add `clearInterval` guard before creating new interval

## Fragile Areas

**Timer State Machine:**
- Files: `src/lib/timer-engine.ts`, `src/hooks/useTimer.ts`
- Why fragile: Complex state transitions across running/paused/overtime/approval states. Multiple refs and callbacks make flow hard to trace
- Safe modification:
  - Add comprehensive snapshot tests for all state transitions
  - Use state machine library (e.g., `xstate`) if modifying timer logic
  - Test pause → overtime → resume edge case thoroughly
- Test coverage:
  - Basic start/stop covered in `timer-engine.test.ts`
  - Missing: pause/overtime interaction, rapid pause/resume cycles, threshold callbacks under load

**Electron Main Process IPC:**
- Files: `electron/main.ts`, `electron/preload.ts`
- Why fragile: IPC channels are string-based with no schema validation. Window state (mainWindow, historyWindow) stored in module-level vars
- Safe modification:
  - Add type-safe IPC wrapper (e.g., `electron-rpc`)
  - Use `weakRef` for window references to prevent memory leaks
  - Test window close scenarios (already crashed once in manual testing)
- Test coverage: Not testable without E2E framework

**Colour Calculator Threshold Logic:**
- Files: `src/lib/colour-calculator.ts` (lines 55-74)
- Why fragile: Nested ternaries with floating-point interpolation. Small threshold changes create discontinuities
- Safe modification:
  - Add property-based tests (e.g., `quickcheck`) to verify colour continuity across thresholds
  - Tests exist but don't cover edge cases like `yellowThreshold >= redThreshold`
- Test coverage: Good coverage in `colour-calculator.test.ts`, but missing edge case: invalid thresholds (yellow > red)

**Settings Persistence:**
- Files: `src/components/SettingsView.tsx`, `src/hooks/useConvexData.ts`
- Why fragile: Settings mutations can fail silently. UI state may diverge from server state
- Safe modification:
  - Implement optimistic updates with rollback on failure
  - Show confirmation/error toast for every setting change
  - Sync settings on app startup
- Test coverage: None

**Offline Queue Sync:**
- Files: `src/hooks/useConvexData.ts` (lines 148-161)
- Why fragile: Queue flushes without retry logic. If flush fails, items are lost
- Safe modification:
  - Implement exponential backoff retry
  - Max retries with warning before discard
  - Persist retry count
- Test coverage: None

## Scaling Limits

**Single Doctor Hardcoded:**
- Current capacity: 1 user
- Limit: Architecture assumes one identity per deployment
- Scaling path: Implement authentication → multi-user support → role-based access control

**Convex Database No Sharding:**
- Current capacity: Convex free tier handles ~10K consultations comfortably
- Limit: At 100+ consultations per day, history queries will slow down within 1-2 months
- Scaling path: Implement server-side pagination, add archival logic, use Convex enterprise plan

**Electron Window Size Fixed:**
- Current capacity: Single floating window
- Limit: Cannot open multiple consultation timers simultaneously
- Scaling path: Refactor to allow multiple timer windows or tabbed interface if multi-doctor needed

**localStorage Queue Size:**
- Current capacity: ~1MB (typical browser limit)
- Limit: At ~500 bytes per consultation, queue holds ~2000 pending saves before filling
- Scaling path: Switch to IndexedDB with size management

## Dependencies at Risk

**Convex SDK 1.31.7:**
- Risk: Pinned to old patch version; security updates may not be applied
- Impact: Missing bugfixes and security patches available in newer Convex versions
- Migration plan: Update to `convex@latest` with regression testing (test offline queue, data sync)

**Electron 33.0.0:**
- Risk: No automatic security updates; requires manual npm update
- Impact: Known CVEs may affect security if disclosed
- Migration plan: Adopt `electron@latest` on quarterly basis; test window positioning and IPC

**React 18.0.0:**
- Risk: Minor version specified with `^`, allows patch updates; missing updates due to yarn/npm resolution
- Impact: Missing bugfixes in React
- Migration plan: Ensure `npm audit` passes; consider React 19 migration if codebase has time

## Missing Critical Features

**No Data Export:**
- Problem: Consultation history is locked in Convex database; no way to export for compliance/audit
- Blocks: GDPR right to data portability, backup/restore scenarios
- Priority: Medium (compliance blocker for regulated healthcare)

**No Consultation Notes Storage:**
- Problem: Approval screen accepts notes but they're optional and may be lost if sync fails
- Blocks: Clinical documentation completeness
- Priority: Medium

**No Multi-Device Sync:**
- Problem: If user loses device or switches laptops, all local offline queue is lost
- Blocks: Data continuity across hardware
- Priority: Low (single-user MVP acceptable)

**No Audit Log:**
- Problem: No record of who made changes to settings or appointment types
- Blocks: Practice compliance, troubleshooting
- Priority: Low (MVP acceptable)

## Test Coverage Gaps

**useTimer Hook Not Tested:**
- What's not tested: Complex state transitions, approval snapshot behavior, minimise/restore flow
- Files: `src/hooks/useTimer.ts` (315 lines)
- Risk: State machine bugs could go undetected until production; approval screen behavior uncertain
- Priority: High

**useConvexData Hook Not Tested:**
- What's not tested: Offline detection grace period, pending saves queue logic, settings sync
- Files: `src/hooks/useConvexData.ts` (230 lines)
- Risk: Offline queue could have data loss bugs; sync race conditions undetected
- Priority: High

**Component Integration Not Tested:**
- What's not tested: TimerWidget state transitions, IPC event handling, window resize logic
- Files: `src/components/TimerWidget.tsx` (377 lines)
- Risk: Electron integration bugs, race conditions on state changes
- Priority: Medium

**Convex Functions Not Tested:**
- What's not tested: Mutation validation, query filtering, edge cases (negative durations, invalid dates)
- Files: `convex/consultations.ts`, `convex/settings.ts`, `convex/appointmentTypes.ts`
- Risk: Invalid data could be persisted; filtering logic may have bugs
- Priority: Medium

**HistoryTable Pagination Not Tested:**
- What's not tested: Page transitions, sort stability, filter combinations
- Files: `src/components/HistoryTable.tsx` (456 lines)
- Risk: Off-by-one errors, data inconsistencies across pages
- Priority: Low (pagination happens client-side, limited complexity)

---

*Concerns audit: 2026-02-11*
