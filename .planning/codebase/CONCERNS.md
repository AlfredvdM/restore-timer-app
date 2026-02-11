# Codebase Concerns

**Analysis Date:** 2026-02-11

## Window Resize Management (CRITICAL - New Resize Feature)

**Multiple setWindowMinSize calls during state transitions:**
- Issue: The application makes many `setWindowMinSize()` calls across different components without coordinating when sizes actually change. In `TimerWidget.tsx` (lines 64-199), `SettingsView.tsx` (lines 134-141), and individual button handlers, resize requests may queue or conflict.
- Files: `src/components/TimerWidget.tsx`, `src/components/SettingsView.tsx`, `electron/main.ts` (lines 531-562)
- Impact: If user manually resizes window while app is sending sizing commands, the constraints may get out of sync. Multiple rapid state changes (e.g., navigating settings → idle → settings again) could cause jank or unexpected window behavior.
- Fix approach: Debounce resize requests, or implement a single "pending resize" queue in the main process to serialize setMinimumSize calls.

**Window position restoration not validated:**
- Issue: When exiting Settings, `preSettingsSizeRef` (line 340-344 in `TimerWidget.tsx`) calls `setWindowSize()` with saved dimensions, but there's no validation that those dimensions are still valid for the current screen or window constraints.
- Files: `src/components/TimerWidget.tsx` (lines 340-345)
- Impact: If user unplugs an external monitor or resolution changes while settings panel is open, restoring the saved size could place the window off-screen or exceed new maximum bounds.
- Fix approach: Validate restored dimensions against current screen bounds before applying, similar to `isPositionOnScreen()` in `electron/main.ts`.

**Minimised bar state transitions may leave max-size lock active:**
- Issue: `minimiseToBar()` in `electron/main.ts` (lines 579-588) sets `setMaximumSize(600, 40)` to lock the minimised bar, but `restoreFromBar()` (lines 591-605) removes this lock with `setMaximumSize(0, 0)`. If a state transition happens between these two calls or if `restoreFromBar()` is never reached, the max-size lock persists.
- Files: `electron/main.ts` (lines 579-605), `src/components/TimerWidget.tsx` (lines 189-198)
- Impact: User could get stuck with window locked to 600px width if error occurs during restore, or if navigation changes during minimisation.
- Fix approach: Track minimisation state in main process and ensure cleanup in all exit paths.

**Settings window resize logic doesn't account for content height:**
- Issue: `SettingsView.tsx` (line 137-140) hardcodes `setWindowMinSize(280, 700)` when manage section opens, but the actual content can be taller if user has many appointment types. The scroll area only uses `overflow-y-auto` on `flex-1`, which may not handle all edge cases.
- Files: `src/components/SettingsView.tsx` (lines 133-141)
- Impact: With many appointment types (e.g., 15+), content may overflow the 700px minimum, forcing user to resize manually.
- Fix approach: Calculate actual required height based on appointment type count or use CSS dynamic height with proper container.

**Doctor selector height calculation assumes fixed sizes:**
- Issue: In `TimerWidget.tsx` (lines 68-71), doctor selector height is calculated as `138 + allDoctors.length * 52`, assuming exact pixel heights for header (50px) and each row (52px). If CSS padding/margins change slightly, the calculation becomes wrong.
- Files: `src/components/TimerWidget.tsx` (lines 68-71), `src/types/index.ts` (line 25: `STATE_MIN_HEIGHTS.doctorSelect: 280`)
- Impact: When opening doctor selector with many doctors, the window may be taller than necessary or scroll content might be clipped.
- Fix approach: Measure actual content height dynamically using `useEffect` + `useRef` to query the DOM, instead of hardcoding pixel math.

**State-based min-size doesn't account for content overflow:**
- Issue: `STATE_MIN_WIDTHS` and `STATE_MIN_HEIGHTS` in `src/types/index.ts` (lines 16-42) are static constants that don't adapt to content. For example, if a consultation note text is very long, the approval screen (min height 490) might be too small.
- Files: `src/types/index.ts`, `src/components/TimerWidget.tsx` (lines 197)
- Impact: User may need to manually resize to see all content in certain states.
- Fix approach: Measure content in render and update min-height dynamically, or use CSS `min-content` sizing where applicable.

**Settings section expand/collapse causes window flicker:**
- Issue: In `SettingsView.tsx` (lines 134-141), opening the manage appointment types section immediately calls `setWindowMinSize(280, 700)`, but the DOM re-render that adds the expanded content may take a moment, causing a visible resize lag.
- Files: `src/components/SettingsView.tsx` (lines 134-141)
- Impact: Visible jank when toggling the manage section — window may resize, then content appears.
- Fix approach: Measure the expanded section height first (via a hidden container or animation callback) before calling setWindowMinSize.

## Event Listener Cleanup

**Incomplete cleanup of electron IPC listeners:**
- Issue: In `TimerWidget.tsx`, three `useEffect` hooks (lines 83-98, 115-144, 147-180) use `removeAllListeners()` to clean up when dependencies change, but `removeAllListeners()` removes ALL listeners for a channel, not just the one registered by that hook. If other hooks or external code register listeners on the same channel, they'll be unregistered too.
- Files: `src/components/TimerWidget.tsx` (lines 96, 142, 178)
- Impact: If future code adds another listener to 'window-moved', 'navigate', or 'request-save-and-quit', it could be accidentally removed when the first hook re-runs.
- Fix approach: Use a named handler reference and `window.electronAPI.removeListener()` (implement in preload), or use a global listener registry.

**Window-moved handler creates a new closure on every re-render:**
- Issue: In `TimerWidget.tsx` (lines 83-98), `onWindowMoved()` is called with a new `handler` function every time the effect runs (when `updateWindowPositionMutation` or `activeDoctor` changes). Each call may create a new internal listener in the IPC system.
- Files: `src/components/TimerWidget.tsx` (lines 83-98)
- Impact: Over time (e.g., switching doctors multiple times), accumulated listeners could cause memory leaks or duplicate position saves.
- Fix approach: Use a persistent callback in the preload layer, or ensure the IPC layer deduplicates handlers by reference.

## Memory Leaks

**Timeout in main process window-moved handler not always cleared:**
- Issue: In `electron/main.ts` (lines 290-300), `moveTimeout` is declared inside the listener. If the window is closed while a timeout is pending, the timeout may keep running briefly and try to reference a destroyed window.
- Files: `electron/main.ts` (lines 290-300)
- Impact: Potential memory leak on quit (brief) and spurious "mainWindow is null" errors in logs.
- Fix approach: Clear all timeouts in the 'closed' event handler (line 327).

**Offline grace-period timer not cancelled if component unmounts:**
- Issue: In `useConvexData.ts` (lines 85-107), a setTimeout is created to detect offline state, but if the component unmounts before the grace period elapses and the setTimeout is never returned from the effect, the timer will still execute.
- Files: `src/hooks/useConvexData.ts` (lines 100-106)
- Impact: Calling setIsOffline after unmount will trigger a React state-update warning.
- Fix approach: Add a mounted ref or ensure the cleanup function always returns the clearTimeout callback (appears to already be handled at line 106).

**Engine interval may not clear on rapid state changes:**
- Issue: In `src/lib/timer-engine.ts`, the `intervalId` is cleared in the `cleanup()` method (lines 197-206), which is called in `reset()`, `stop()`, and when starting a new timer (line 54). However, if the engine is used across multiple components or re-mounts, the interval could theoretically be left running if cleanup is skipped.
- Files: `src/lib/timer-engine.ts` (lines 34, 52-66, 197-206)
- Impact: If timer hook unmounts without calling cleanup, the interval tick would continue, consuming CPU.
- Fix approach: Add a destructor/cleanup to `useTimer` hook's cleanup function to ensure `engineRef.current?.reset()` is always called (it already does at line 149, so this is well-handled).

## Settings Data Consistency

**Offline mutation errors silently ignored without user feedback:**
- Issue: In `useConvexData.ts`, mutations for `updateSetting()` (lines 171-177), `upsertAppointmentType()` (lines 192-198), and others use try/catch but only silently ignore errors with no indication to user that the change failed to sync.
- Files: `src/hooks/useConvexData.ts` (lines 167-220)
- Impact: User may believe a setting change (e.g., sound volume, colour threshold) was saved, but it only exists in localStorage and will revert on next cold start if still offline.
- Fix approach: Track failed mutations and show a subtle "unsaved" indicator, or queue them like consultation saves.

**Consultation saves queue in localStorage without max size limit:**
- Issue: In `useConvexData.ts` (lines 129-137, 139-149), pending saves are appended to a localStorage array without any size cap. If user is offline and saves many consultations, the queue could grow large and hit localStorage size limits.
- Files: `src/hooks/useConvexData.ts` (lines 139-149)
- Impact: On older browsers or devices with small localStorage (often 5-10MB), a long queue of consultations could cause localStorage quota exceeded errors.
- Fix approach: Implement a maximum queue size (e.g., 100 items) with oldest-first eviction, or implement proper IndexedDB-based queueing.

## Fragile Resize Sequences

**Switching doctors with settings panel open:**
- Issue: If user clicks "Switch Doctor" while the settings panel is open, the `preSettingsSizeRef` may be set but never used (the settings state gets cleared). On next settings open with a different doctor, the old size could be restored.
- Files: `src/components/TimerWidget.tsx` (lines 323-326, 338-346)
- Impact: Window might resize incorrectly when switching doctors and re-opening settings.
- Fix approach: Clear `preSettingsSizeRef` when clearDoctor is called.

**Approval screen may be taller than minimum on small screens:**
- Issue: On a laptop with screen height < 620px, the approval screen (min height 490) plus title bar (28px) might exceed the visible area, forcing user to scroll or manually resize.
- Files: `src/types/index.ts` (line 22: `STATE_MIN_HEIGHTS.approval: 490`)
- Impact: Poor UX on smaller screens.
- Fix approach: Set max-height for the approval content area and allow scrolling instead.

**Window position not restored if monitor plugged in/out:**
- Issue: Saved window position (from Convex) may be outside the work area if it was saved on an external monitor that's no longer connected. The app doesn't validate or adjust the position.
- Files: `src/components/TimerWidget.tsx` (lines 83-98), `electron/main.ts` (lines 223-229)
- Impact: Window could open off-screen.
- Fix approach: This is actually handled by `isPositionOnScreen()` in main.ts, but only in `set-window-position` IPC handler. Ensure it's called when restoring from Convex storage.

## Type Safety Issues

**Unsafe type casting in mutations:**
- Issue: In `useConvexData.ts`, mutations like `upsertTypeMutation()` and `reorderTypesMutation()` use `as any` (lines 192, 214), bypassing TypeScript validation of the payload shape.
- Files: `src/hooks/useConvexData.ts` (lines 192, 203, 214)
- Impact: Runtime errors if the mutation signature changes or if the caller passes wrong data.
- Fix approach: Define proper payload types and remove `as any`.

**Electron API is optional (?) in type definition:**
- Issue: `window.electronAPI` is defined as optional in `electron.d.ts` (line 24), but the app unconditionally calls it throughout without null checks (e.g., `window.electronAPI?.setWindowMinSize()`). If the preload fails to inject it, the app will silently fail.
- Files: `src/types/electron.d.ts`, entire codebase uses `window.electronAPI?.`
- Impact: If preload script fails to load, the app won't alert the user — all window sizing will silently fail.
- Fix approach: Either make it non-optional (assert it's always present), or add explicit null checks with error handling at startup.

## Performance Concerns

**Doctor context re-fetches all doctors on every mount:**
- Issue: In `DoctorContext.tsx` (line 26), `useQuery(api.doctors.getAllDoctors)` is called unconditionally on every component that uses the context. Multiple components may cause duplicate requests.
- Files: `src/contexts/DoctorContext.tsx` (lines 26-33)
- Impact: If many components subscribe to the context, multiple fetch requests could overload the server.
- Fix approach: This is already mitigated by Convex's caching, but add explicit documentation or verify cache headers.

**Every timer tick updates React state:**
- Issue: In `useTimer.ts` (lines 110-124), the `onTick` callback updates 8 separate React state variables on every 1-second interval. React batches these, but it's still causing a full re-render cycle every second.
- Files: `src/hooks/useTimer.ts` (lines 107-136)
- Impact: Continuous re-renders may cause frame drops on low-end devices or slow down other UI interactions.
- Fix approach: Combine state into a single object, or use a state reducer to batch updates.

**No debouncing on window resize from user:**
- Issue: Browser window resize events could fire many times per second if user drags the corner, but the app doesn't debounce calls back to the main process to update stored position.
- Files: `src/components/TimerWidget.tsx` (lines 83-98) — this only handles 'moved', not user-initiated resizes
- Impact: If user drags window border to resize, position updates may queue up and cause lag.
- Fix approach: Add a debounce utility or use Electron's built-in resize event with a debounced handler.

## Edge Cases Not Handled

**No validation of initial window size on startup:**
- Issue: When the app launches, there's no check whether the saved window position/size is still valid for the current display configuration.
- Files: `src/components/TimerWidget.tsx` (lines 83-98), `electron/main.ts` (lines 241-288)
- Impact: First launch on different hardware could show window off-screen.
- Fix approach: Validate saved position against current displays before restoring.

## Existing Concerns (From Previous Analysis)

### Tech Debt

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

**Silent Offline Failures:**
- Issue: Error handlers silently ignore offline errors with no user feedback or logging
- Files: `src/hooks/useConvexData.ts` (lines 169-170, 190-191, 212-213)
- Impact: Settings changes or appointment type updates may fail silently without user awareness
- Fix approach: Implement error logging and show toast/notification on mutation failures

### Security Considerations

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

### Performance Bottlenecks

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

**Window Resize Sequences:**
- Files: `src/components/TimerWidget.tsx` (lines 64-199), `src/components/SettingsView.tsx` (lines 134-141), `electron/main.ts` (lines 531-605)
- Why fragile: Multiple `setWindowMinSize()` calls without coordination. State transitions can leave window in inconsistent size state. Manual resize conflicts with app-initiated resizes.
- Safe modification:
  - Centralize all resize requests through a single queue
  - Add validation before applying sizes
  - Test rapid state transitions
  - Verify behavior on multi-monitor setups
- Test coverage: None (resize logic not tested at all)

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

**Window Resizing Logic Untested (NEW):**
- What's not tested: All the `setWindowMinSize()` sequences, state transitions, edge cases around window sizing, resize conflicts
- Files: `src/components/TimerWidget.tsx` (lines 64-199), `src/components/SettingsView.tsx` (lines 134-141), `electron/main.ts` (lines 531-605)
- Risk: Any refactoring of resize logic could silently break UI state without detection. Bugs in resize sequences won't be caught.
- Priority: High

**Electron IPC Listener Lifecycle Untested (NEW):**
- What's not tested: Cleanup of listeners, multiple re-registrations, listener collision, handler deduplication
- Files: `src/components/TimerWidget.tsx` (lines 83-180), `electron/main.ts` (lines 500-627)
- Risk: Memory leaks or duplicate handlers could be introduced without detection.
- Priority: High

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
- What's not tested: TimerWidget state transitions, IPC event handling
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
