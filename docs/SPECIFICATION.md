# RESTORE Consultation Timer — Claude Code Build Specification

## Document Purpose

This is the complete build specification for Claude Code. It contains everything needed to build the RESTORE Consultation Timer desktop application from scratch. Follow this document sequentially.

---

## 1. Project Overview

### What We're Building

A cross-platform desktop consultation timer for a GP (General Practitioner) medical practice called RESTORE Health and Care in George, South Africa. The timer helps doctors manage consultation time by counting down from a target duration, with visual colour cues and subtle audio alerts.

### Key Characteristics

- **Always-on-top floating widget** — stays visible over other applications
- **Minimisable** — doctor can collapse it when not needed
- **Cross-platform** — must work on both Windows and macOS
- **Connects to Convex backend** — logs consultation data for integration with the larger RESTORE Operations Hub app
- **Not a standalone tool** — this is a component of a broader practice management ecosystem

### Who Uses It

- **Primary user:** The doctor (GP) during patient consultations
- **Secondary viewer:** Practice owner/CEO who reviews consultation history and analytics
- **Future users:** Associate doctors (Year 2+), practice manager

---

## 2. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Desktop framework | **Electron** | Cross-platform (Windows + macOS), free/open-source, React-compatible |
| Frontend | **React + TypeScript** | Matches the RESTORE Hub stack, Claude Code knows it well |
| Styling | **Tailwind CSS** | Fast to build, consistent with Hub |
| Backend/Database | **Convex** | Real-time sync, TypeScript-first, shared with RESTORE Hub |
| Audio | **Web Audio API** | Built into Electron/Chromium, no extra dependencies |
| Build tool | **Vite** | Fast dev server, good Electron integration |
| Electron build | **electron-builder** | Cross-platform packaging for Windows (.exe) and macOS (.dmg) |

### Project Structure

```
restore-consultation-timer/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Preload script for IPC
│   └── tray.ts              # System tray integration
├── src/
│   ├── App.tsx              # Main React app
│   ├── main.tsx             # React entry point
│   ├── components/
│   │   ├── TimerWidget.tsx       # The floating timer display
│   │   ├── TimerControls.tsx     # Start/Pause/Resume/Stop buttons
│   │   ├── NewTimerForm.tsx      # Patient name + consultation type selector
│   │   ├── TimerDisplay.tsx      # Countdown display with colour transitions
│   │   ├── ApprovalScreen.tsx    # Post-stop review & save screen
│   │   ├── HistoryView.tsx       # Full consultation history
│   │   ├── HistoryTable.tsx      # Sortable/filterable table of past consultations
│   │   ├── SettingsView.tsx      # App settings
│   │   └── MinimisedWidget.tsx   # Collapsed view showing just time + colour
│   ├── hooks/
│   │   ├── useTimer.ts           # Core timer logic
│   │   ├── useAudio.ts           # Sound alert management
│   │   └── useConvex.ts          # Convex integration hooks
│   ├── lib/
│   │   ├── timer-engine.ts       # Pure timer logic (no React deps)
│   │   ├── colour-calculator.ts  # Green→Yellow→Red gradient logic
│   │   └── sound.ts              # Audio alert generation
│   ├── convex/
│   │   ├── schema.ts             # Convex database schema
│   │   ├── consultations.ts      # Consultation mutations & queries
│   │   └── settings.ts           # User settings
│   └── types/
│       └── index.ts              # TypeScript types
├── assets/
│   └── icon.png                  # App icon (stethoscope or RESTORE logo)
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
├── electron-builder.yml
└── convex.json
```

---

## 3. Convex Schema

This schema is designed to integrate with the broader RESTORE Operations Hub. The Hub will read from these same tables for analytics and scorecard data.

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Consultation log — the core data this app produces
  consultations: defineTable({
    doctorId: v.string(),           // User ID of the doctor
    doctorName: v.string(),         // Display name
    patientName: v.optional(v.string()), // Optional — patient name
    appointmentType: v.string(),    // "standard", "long", "follow_up", "telephone", "procedure", "custom"
    targetDurationSeconds: v.number(), // What the timer was set to
    actualDurationSeconds: v.number(), // How long the consultation actually took
    wentOvertime: v.boolean(),      // Did it exceed target?
    overtimeSeconds: v.optional(v.number()), // How much over (0 if under)
    pausedDurationSeconds: v.number(), // Total time spent paused
    consultationDate: v.string(),   // ISO date string (YYYY-MM-DD)
    startedAt: v.number(),          // Unix timestamp ms — when timer started
    completedAt: v.number(),        // Unix timestamp ms — when timer stopped
    notes: v.optional(v.string()),  // Optional notes from approval screen
    status: v.union(
      v.literal("completed"),       // Normal completion
      v.literal("cancelled")        // Timer was cancelled without saving
    ),
  })
    .index("by_doctor", ["doctorId", "consultationDate"])
    .index("by_date", ["consultationDate"])
    .index("by_doctor_and_type", ["doctorId", "appointmentType"]),

  // Appointment type definitions — configurable by the practice
  appointmentTypes: defineTable({
    name: v.string(),               // Display name: "Standard Consultation"
    code: v.string(),               // Internal code: "standard"
    defaultDurationMinutes: v.number(), // Default countdown duration
    colour: v.optional(v.string()), // Optional UI colour for the type
    isActive: v.boolean(),          // Can be deactivated without deletion
    sortOrder: v.number(),          // Display order in the selector
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  // User settings for the timer app
  timerSettings: defineTable({
    userId: v.string(),
    soundEnabled: v.boolean(),      // Master sound toggle
    soundVolume: v.number(),        // 0.0 to 1.0
    yellowThreshold: v.number(),    // Percentage (default 0.6 = 60%)
    redThreshold: v.number(),       // Percentage (default 0.9 = 90%)
    alwaysOnTop: v.boolean(),       // Window stays on top
    defaultAppointmentType: v.optional(v.string()), // Default selection
    windowPosition: v.optional(v.object({  // Remember window position
      x: v.number(),
      y: v.number(),
    })),
  })
    .index("by_user", ["userId"]),
});
```

### Seed Data — Appointment Types

Create these on first run:

| Name | Code | Default Duration (min) | Sort Order |
|------|------|----------------------|------------|
| Standard Consultation | `standard` | 15 | 1 |
| Long Consultation | `long` | 30 | 2 |
| Follow-Up | `follow_up` | 10 | 3 |
| Telephone Consultation | `telephone` | 5 | 4 |
| Procedure | `procedure` | 20 | 5 |
| Custom | `custom` | — (user types) | 6 |

When the doctor selects "Custom", a number input appears where they type the duration in minutes.

---

## 4. Feature Specifications

### 4.1 The Floating Widget (Main Window)

**Window Properties:**
- Default size: 320px wide × variable height (compact)
- Always on top (configurable in settings)
- Frameless window with custom title bar (drag handle)
- Rounded corners
- Semi-transparent when idle (opacity ~0.9)
- Resizable: No
- Minimise button collapses to a tiny bar showing only: time remaining + colour indicator

**States:**

1. **Idle State** — No timer running
   - Shows: RESTORE logo/name, "New Consultation" button
   - Compact appearance

2. **Setup State** — Configuring a new timer
   - Patient name input (optional, placeholder: "Patient name (optional)")
   - Appointment type dropdown (Standard, Long, Follow-Up, Telephone, Procedure, Custom)
   - When type selected: shows the default duration with option to override
   - When "Custom" selected: shows editable minutes input field
   - "Start Timer" button (prominent, green)
   - "Cancel" button (subtle)

3. **Running State** — Timer counting down
   - Large countdown display: MM:SS format
   - Colour of the entire widget background transitions based on time remaining
   - Patient name displayed (small, above timer)
   - Appointment type displayed (small, below timer)
   - Controls: Pause button, Stop button
   - Small "target" indicator showing original duration

4. **Paused State** — Timer paused
   - Timer display freezes
   - Pulsing "PAUSED" indicator (subtle)
   - Controls: Resume button, Stop button
   - Background colour stays at whatever colour it was when paused

5. **Overtime State** — Timer has reached 00:00
   - Timer counts UP from 00:00 showing +MM:SS
   - Background is solid red
   - Subtle sound plays once when hitting 00:00
   - Controls remain: Pause, Stop

6. **Approval State** — Timer stopped, reviewing before save
   - Shows summary:
     - Patient name (if entered)
     - Appointment type
     - Target duration
     - Actual duration
     - Overtime amount (if any) — highlighted in red
     - Time paused (if any)
   - Optional notes text field
   - "Save" button (prominent, green) — saves to Convex
   - "Discard" button (subtle, red text) — discards without saving
   - "Back" button — returns to Running/Paused state (timer resumes)

7. **Minimised State** — Collapsed widget
   - Thin horizontal bar: ~200px × 40px
   - Shows: MM:SS countdown + coloured dot indicator
   - Click to expand back to full widget
   - Still always-on-top

### 4.2 Colour Transition System

The widget background colour smoothly transitions based on elapsed time as a percentage of target duration.

```
Percentage of time elapsed:
0% ────────── 60% ──────── 90% ──────── 100% ────────→
   GREEN          YELLOW         RED         SOLID RED
   #22C55E        #EAB308        #EF4444     #DC2626
```

**Implementation:**
- Use CSS transitions or interpolation for smooth colour changes
- The transition should be continuous/gradual, not sudden jumps
- Entire widget background changes colour
- Text colour should remain readable against each background (white text works for all three)

**Colour values:**
| Phase | Time Elapsed | Background | Text |
|-------|-------------|------------|------|
| Green | 0% – 60% | Gradient from `#22C55E` → `#84CC16` | White |
| Yellow | 60% – 90% | Gradient from `#84CC16` → `#EAB308` → `#F59E0B` | White |
| Red | 90% – 100% | Gradient from `#F59E0B` → `#EF4444` | White |
| Overtime | >100% | Solid `#DC2626` | White |

### 4.3 Sound Alert

- **When:** A single subtle sound plays when the timer hits 00:00 (transition to overtime)
- **Sound type:** A soft, short chime or gentle "ding" — NOT alarming. The doctor is with a patient. Generate this programmatically using Web Audio API (sine wave, ~800Hz, 200ms duration with fade-out) rather than including a sound file.
- **Configurable:** Can be toggled on/off in settings. Volume adjustable.
- **No repeating:** Sound plays ONCE. No ongoing alerts or beeping.

### 4.4 Timer Controls Flow

```
[Idle] → Click "New Consultation"
  ↓
[Setup] → Enter patient name (optional) + Select type + Confirm duration
  ↓ Click "Start Timer"
[Running] → Timer counts down, colours change
  ↓ Click "Pause"          ↓ Click "Stop"
[Paused]                  [Approval]
  ↓ Click "Resume"          ↓ Click "Save"     ↓ Click "Discard"
[Running]                  [Idle] (saved)       [Idle] (not saved)
                            ↓ Click "Back"
                           [Running] (resumes)
```

### 4.5 Consultation History View

A separate window/panel that shows all past consultations. Accessible via a "History" button or menu item.

**Layout:** Full window (not the floating widget — opens as a standard window)

**Features:**
- **Table view** with columns:
  - Date & Time (formatted nicely: "Fri 7 Feb 2026, 14:30")
  - Patient Name (or "—" if not entered)
  - Appointment Type
  - Target Duration (MM:SS)
  - Actual Duration (MM:SS)
  - Status (on time / overtime — with colour coding)
  - Overtime Amount (if applicable)
- **Sortable** by any column (click column header)
- **Filterable** by:
  - Date range (date picker)
  - Appointment type (dropdown)
  - Doctor (dropdown — for multi-doctor future)
  - Status: All / On Time / Overtime
- **Summary stats** at the top:
  - Total consultations today
  - Average consultation duration
  - Percentage on time vs overtime
  - Most common appointment type
- **Export:** Button to export filtered data as CSV
- **Clean, professional UI** — this is also where the practice owner reviews performance

### 4.6 Settings

Accessible via gear icon or menu.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Sound enabled | Toggle | On | Play chime at overtime |
| Sound volume | Slider | 50% | Alert volume |
| Always on top | Toggle | On | Float above other windows |
| Green → Yellow threshold | Number | 60% | When to start transitioning to yellow |
| Yellow → Red threshold | Number | 90% | When to start transitioning to red |
| Default appointment type | Dropdown | Standard | Pre-selected type for new timers |
| Manage appointment types | Button | — | Opens sub-view to add/edit/deactivate types |

**Manage Appointment Types** sub-view:
- List of all appointment types
- Add new type: name + default duration
- Edit existing: change name, duration, sort order
- Deactivate (not delete): toggle active/inactive
- Cannot delete types that have consultation history (data integrity)

---

## 5. Electron Configuration

### Main Process (`electron/main.ts`)

```
Key behaviours:
- Create frameless BrowserWindow with:
  - alwaysOnTop: true (configurable)
  - frame: false
  - transparent: false
  - resizable: false
  - width: 320, height: 400
  - skipTaskbar: false (should appear in taskbar)
  - titleBarStyle: 'hidden' (macOS)
- Remember window position between sessions (save to Convex timerSettings)
- System tray icon with context menu:
  - Show/Hide Timer
  - New Consultation
  - History
  - Settings
  - Quit
- IPC channels for:
  - Window minimize/restore
  - Window drag (custom title bar)
  - Always-on-top toggle
```

### Preload Script (`electron/preload.ts`)

Expose safe APIs via contextBridge:
- `window.electronAPI.minimizeWindow()`
- `window.electronAPI.restoreWindow()`
- `window.electronAPI.setAlwaysOnTop(boolean)`
- `window.electronAPI.getWindowPosition()`
- `window.electronAPI.openHistoryWindow()`
- `window.electronAPI.closeApp()`
- `window.electronAPI.setWindowSize(width, height)`

### Window Sizing

The window height should adjust based on state:
| State | Approximate Height |
|-------|--------------------|
| Idle | 120px |
| Setup | 300px |
| Running | 220px |
| Paused | 220px |
| Approval | 400px |
| Minimised | 40px |

Use `win.setSize()` via IPC when state changes. Animate if possible.

---

## 6. Convex Functions

### Mutations

```typescript
// consultations.ts

// Save a completed consultation
export const saveConsultation = mutation({
  args: {
    doctorId: v.string(),
    doctorName: v.string(),
    patientName: v.optional(v.string()),
    appointmentType: v.string(),
    targetDurationSeconds: v.number(),
    actualDurationSeconds: v.number(),
    pausedDurationSeconds: v.number(),
    notes: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const wentOvertime = args.actualDurationSeconds > args.targetDurationSeconds;
    const overtimeSeconds = wentOvertime
      ? args.actualDurationSeconds - args.targetDurationSeconds
      : 0;

    return await ctx.db.insert("consultations", {
      ...args,
      wentOvertime,
      overtimeSeconds,
      consultationDate: new Date(args.startedAt).toISOString().split('T')[0],
      status: "completed",
    });
  },
});

// Save user settings
export const saveSettings = mutation({ ... });

// Create/update appointment types
export const upsertAppointmentType = mutation({ ... });
export const toggleAppointmentTypeActive = mutation({ ... });
```

### Queries

```typescript
// Get consultation history with filters
export const getConsultations = query({
  args: {
    doctorId: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    appointmentType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Query with filters, return sorted by date descending
  },
});

// Get today's summary stats
export const getTodayStats = query({
  args: { doctorId: v.string() },
  handler: async (ctx, args) => {
    // Return: total consultations, avg duration, % on time, etc.
  },
});

// Get active appointment types
export const getAppointmentTypes = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("appointmentTypes")
      .withIndex("by_active", q => q.eq("isActive", true))
      .collect();
  },
});

// Get user settings
export const getSettings = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => { ... },
});
```

---

## 7. UI/UX Design Guidelines

### Visual Language

- **Rounded corners** on the widget (border-radius: 16px)
- **Clean, minimal** — no clutter. The doctor glances at this, they don't study it
- **Large timer text** — the countdown should be readable from arm's length (at least 48px font)
- **Tailwind colour palette** — use Tailwind's built-in greens, yellows, reds
- **Dark text on light backgrounds** for setup/approval states
- **White text on coloured backgrounds** during countdown

### Typography

- Timer display: Monospace font (e.g., `font-mono` in Tailwind) — numbers shouldn't shift width
- Patient name: 14px, medium weight
- Appointment type: 12px, regular weight
- Labels: 11px, muted colour

### Custom Title Bar

Since the window is frameless, implement a custom drag area:
- Thin bar at top of widget (~28px)
- Draggable (use `-webkit-app-region: drag`)
- Contains: minimise button (left), close button (right)
- Subtle, doesn't distract from the timer

### Animations

- Colour transitions: CSS `transition: background-color 1s ease`
- State changes: Subtle fade transitions (150ms)
- Minimise/restore: Smooth height animation
- Button hover states: Subtle scale or opacity change
- NO flashy animations — this is a medical tool

---

## 8. Build Sequence for Claude Code

Follow this exact order. Test each phase before moving to the next.

### Phase 1: Project Scaffolding
1. Initialise project with Vite + React + TypeScript
2. Add Electron with electron-builder
3. Configure Tailwind CSS
4. Set up Convex (init, schema, deploy)
5. Create basic Electron window (frameless, always-on-top)
6. Verify: App opens on both platforms, shows "Hello World"

### Phase 2: Timer Engine (No UI Yet)
1. Build `timer-engine.ts` — pure TypeScript class
   - `start(durationSeconds)`, `pause()`, `resume()`, `stop()`
   - Emits: `tick` (every second), `threshold` (yellow/red), `overtime`, `complete`
   - Tracks: elapsed, remaining, paused duration, state
2. Build `colour-calculator.ts` — pure function
   - Input: elapsed percentage, thresholds
   - Output: RGB colour value
3. Build `sound.ts` — Web Audio API chime generator
4. Write unit tests for timer engine and colour calculator

### Phase 3: Timer Widget UI
1. Build the custom title bar component
2. Build `TimerDisplay.tsx` — the countdown visualisation
3. Build `TimerControls.tsx` — Start/Pause/Resume/Stop buttons
4. Build `TimerWidget.tsx` — combines display + controls + colour background
5. Implement all widget states (Idle, Running, Paused, Overtime)
6. Implement colour transitions
7. Implement sound alert
8. Test full timer flow manually

### Phase 4: Setup & Approval Flows
1. Build `NewTimerForm.tsx` — patient name + appointment type + duration
2. Connect to Convex `appointmentTypes` query for the dropdown
3. Build `ApprovalScreen.tsx` — post-stop review screen
4. Implement Save/Discard/Back actions
5. Connect Save to Convex `saveConsultation` mutation
6. Test full flow: New → Setup → Running → Stop → Approve → Save

### Phase 5: Minimised State
1. Build `MinimisedWidget.tsx` — compact bar
2. Implement window resize via IPC
3. Implement expand/collapse toggle
4. Test minimise during active timer (should keep counting)

### Phase 6: History Window
1. Build `HistoryView.tsx` — separate Electron window
2. Build `HistoryTable.tsx` — sortable, filterable table
3. Build summary stats component
4. Connect to Convex queries
5. Implement CSV export
6. Test with sample data

### Phase 7: Settings
1. Build `SettingsView.tsx`
2. Implement appointment type management
3. Connect all settings to Convex
4. Implement settings affecting timer behaviour (thresholds, sound, etc.)

### Phase 8: System Tray & Polish
1. Add system tray icon with context menu
2. Remember window position between sessions
3. Add app icon
4. Handle edge cases:
   - What happens if app is closed during active timer?
   - What happens on network disconnect (Convex offline)?
   - What if Convex is unreachable on startup?
5. Test on both Windows and macOS
6. Package with electron-builder for both platforms

---

## 9. Important Implementation Notes

### Timer Accuracy
- Do NOT rely solely on `setInterval` — it drifts
- Store the start timestamp and calculate elapsed time from `Date.now() - startTime`
- Use `setInterval` at 1000ms only for UI updates
- Paused time must be tracked separately: when pausing, record pause timestamp; when resuming, add `(resumeTime - pauseTime)` to total paused duration
- `actualDuration = stopTime - startTime - totalPausedDuration`

### Convex Offline Handling
- If Convex is unreachable, the timer should still work locally
- Queue saves and retry when connection returns
- Show a small "offline" indicator in the widget
- Never lose consultation data due to network issues

### Window Management (Electron)
- Use `BrowserWindow.setAlwaysOnTop(true, 'floating')` on macOS for proper floating
- On Windows, use `BrowserWindow.setAlwaysOnTop(true)`
- Store window position in Convex settings; restore on app launch
- Handle multi-monitor setups — if saved position is off-screen, reset to primary monitor centre

### Security
- Use Electron's context isolation (contextIsolation: true)
- Use preload scripts for all IPC
- No `nodeIntegration: true` in renderer
- Convex handles auth — use Convex Auth or a simple user ID for MVP

### Authentication (MVP)
- For MVP: Simple user selection on app launch (dropdown of configured doctors)
- The doctor selects their name, this sets the `doctorId` for all consultations
- No password for MVP — this is a trusted internal tool
- Future: Integrate with Convex Auth for proper login (aligns with RESTORE Hub auth)

---

## 10. Integration with RESTORE Operations Hub

This timer app writes data to the same Convex backend as the RESTORE Operations Hub. The Hub can then:

1. **Scorecard Integration:** Show average consultation duration on the weekly scorecard
2. **Patient Flow Metrics:** Track consultations per day (from timer data)
3. **Overtime Tracking:** Flag if a doctor consistently runs over → becomes an "Issue" for the weekly meeting
4. **Daily Pulse Check:** Timer data feeds into "How many patients did we see today?"
5. **System Compliance:** If the doctor isn't using the timer, this shows as a gap in the compliance dashboard

### Shared Convex Tables

The Hub reads FROM these tables (read-only from Hub's perspective):
- `consultations` — for analytics, scorecard, compliance
- `appointmentTypes` — for display/reference

The Hub writes TO these tables:
- `appointmentTypes` — practice manager can configure types from the Hub

The timer writes TO:
- `consultations` — the primary data producer
- `timerSettings` — per-user preferences

The timer reads FROM:
- `appointmentTypes` — to populate the type selector
- `timerSettings` — to load user preferences

---

## 11. Seed Data & First Run

On first launch (or when Convex tables are empty), seed the following:

### Appointment Types
```json
[
  { "name": "Standard Consultation", "code": "standard", "defaultDurationMinutes": 15, "isActive": true, "sortOrder": 1 },
  { "name": "Long Consultation", "code": "long", "defaultDurationMinutes": 30, "isActive": true, "sortOrder": 2 },
  { "name": "Follow-Up", "code": "follow_up", "defaultDurationMinutes": 10, "isActive": true, "sortOrder": 3 },
  { "name": "Telephone Consultation", "code": "telephone", "defaultDurationMinutes": 5, "isActive": true, "sortOrder": 4 },
  { "name": "Procedure", "code": "procedure", "defaultDurationMinutes": 20, "isActive": true, "sortOrder": 5 },
  { "name": "Custom", "code": "custom", "defaultDurationMinutes": 15, "isActive": true, "sortOrder": 6 }
]
```

### Default Timer Settings
```json
{
  "soundEnabled": true,
  "soundVolume": 0.5,
  "yellowThreshold": 0.6,
  "redThreshold": 0.9,
  "alwaysOnTop": true,
  "defaultAppointmentType": "standard"
}
```

### Initial Doctor User (MVP)
```json
{
  "userId": "dr-annetjie",
  "doctorName": "Dr Annetjie van der Nest"
}
```

---

## 12. Testing Checklist

Before considering the app complete, verify:

### Timer Core
- [ ] Timer counts down accurately (verify against real clock over 5+ minutes)
- [ ] Pause freezes timer, resume continues from paused point
- [ ] Actual duration calculation is correct (excludes paused time)
- [ ] Overtime counts up correctly after 00:00
- [ ] Colour transitions are smooth and match thresholds

### UI States
- [ ] Idle → Setup → Running → Paused → Running → Stop → Approval → Save → Idle
- [ ] Idle → Setup → Cancel → Idle
- [ ] Running → Stop → Approval → Discard → Idle
- [ ] Running → Stop → Approval → Back → Running (timer resumes)
- [ ] Minimised widget shows timer and colour correctly
- [ ] Expand from minimised resumes full view

### Data
- [ ] Saved consultations appear in history
- [ ] All fields are populated correctly in Convex
- [ ] History filters work (date, type, status)
- [ ] History sorts work on all columns
- [ ] CSV export contains correct data
- [ ] Summary stats are accurate

### Desktop Behaviour
- [ ] Always-on-top works on Windows
- [ ] Always-on-top works on macOS
- [ ] Window can be dragged via custom title bar
- [ ] Window position is remembered between sessions
- [ ] System tray icon works with all menu items
- [ ] App closes cleanly (no orphan processes)
- [ ] App works while disconnected from internet (timer still functions)

### Sound
- [ ] Chime plays once at overtime (not before, not repeating)
- [ ] Volume setting affects chime volume
- [ ] Sound toggle disables chime completely
- [ ] Sound is subtle and appropriate for a medical setting

### Cross-Platform
- [ ] Builds and runs on macOS (Apple Silicon and Intel)
- [ ] Builds and runs on Windows 10/11
- [ ] No platform-specific crashes or layout issues

---

## 13. Future Enhancements (NOT for initial build)

Document these for awareness, but do NOT build them now:

- **Convex Auth integration** — proper login for multi-doctor support
- **Hub trigger** — receptionist checks patient in on Hub, timer auto-starts on doctor's widget
- **Patient linking** — connect timer to Med EDI patient records
- **Analytics dashboard** — detailed charts (average by day of week, by appointment type, trends)
- **Mobile companion** — React Native version for doctors using tablets
- **Multiple timers** — for practices where a doctor handles multiple patients (e.g., nurse preps next patient)
- **Keyboard shortcuts** — Space to pause/resume, Escape to stop
- **Touch Bar support** — macOS Touch Bar integration

---

*RESTORE Health and Care — "Truly Caring"*
*Consultation Timer v1.0 Specification*
*Last updated: February 2026*
