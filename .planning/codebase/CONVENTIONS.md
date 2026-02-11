# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (`TimerWidget.tsx`, `TimerDisplay.tsx`, `CustomTitleBar.tsx`)
- TypeScript utility/library files: kebab-case with `.ts` extension (`timer-engine.ts`, `colour-calculator.ts`)
- Hook files: kebab-case with `.ts` extension (`useTimer.ts`, `useConvexData.ts`)
- Test files: Same name as source + `.test.ts` suffix (`timer-engine.test.ts`, `colour-calculator.test.ts`)

**Functions:**
- React components: PascalCase (exported as default) — `export default function TimerWidget() {}`
- Utility functions: camelCase — `formatTime()`, `getTimerColour()`, `formatDuration()`
- Helper functions (private): camelCase — `playGentleBell()`, `buildSnapshot()`, `computePhase()`
- Hook functions: camelCase with `use` prefix — `useTimer()`, `useConvexData()`, `useDoctorContext()`
- Event handlers: camelCase with `handle` prefix — `handleStart()`, `handleSave()`, `handleClose()`, `handleMove()`

**Variables:**
- Constants (exported): SCREAMING_SNAKE_CASE for truly immutable globals and state constraints — `STATE_MIN_HEIGHTS`, `STATE_MIN_WIDTHS`, `APPOINTMENT_TYPE_OPTIONS`, `CHIME_OPTIONS`
- Local state/variables: camelCase — `widgetState`, `remainingSeconds`, `displayTime`, `manageOpen`, `editingId`
- React state setters: camelCase with `set` prefix — `setWidgetState()`, `setConsultation()`, `setShowSettings()`
- Refs: camelCase with `Ref` suffix — `engineRef`, `optionsRef`, `stateRef`, `scrollRef`, `preSettingsSizeRef`, `preMinimiseState`, `chimePlayed`
- Conditional state: Descriptive boolean names — `showAddDoctor`, `showSettings`, `needsDoctorSelect`, `isColoured`, `isTimerActive`

**Types:**
- Type definitions (interfaces/types): PascalCase — `WidgetState`, `TimerState`, `TimerSnapshot`, `ColourResult`, `ConsultationInfo`, `UseTimerReturn`
- Props interfaces: PascalCase with `Props` suffix — `TimerDisplayProps`, `CustomTitleBarProps`, `SettingsViewProps`, `MinimisedWidgetProps`
- Type discriminants: lowercase with hyphens — `'idle' | 'setup' | 'running' | 'paused' | 'overtime' | 'approval' | 'minimised' | 'settings' | 'doctorSelect'`

## Code Style

**Formatting:**
- Tailwind CSS for all component styling — no CSS-in-JS or separate `.css` files for components
- Inline style objects for dynamic values or browser-specific properties: `style={{ backgroundColor: phaseColour }}`, `style={{ WebkitAppRegion: 'drag' }}`
- camelCase property names in inline styles: `WebkitAppRegion`, `fontVariantNumeric`
- Template literals for multiline className strings with conditional logic
- Long className strings formatted across multiple lines with consistent indentation

**Linting:**
- TypeScript strict mode for type safety (`"strict": true` in `tsconfig.json`)
- No ESLint configuration — code style enforced manually
- Implicit `any` types prevented by TypeScript strict mode

**Tailwind Utilities:**
- Flexbox primary layout system: `flex`, `flex-col`, `flex-1`, `items-center`, `justify-between`, `gap-2`, `shrink-0`
- Custom sizing: `w-full`, `h-screen`, `h-10`, `px-3`, `py-2.5` — fractional values used (e.g., `py-2.5` for 10px)
- Rounded corners: `rounded-full`, `rounded-xl`, `rounded-lg`, `rounded-md`
- Colour system: emerald (primary actions), gray (neutral/disabled), red/yellow/amber (warnings)
- Text sizing: `text-sm`, `text-[11px]`, `text-[10px]` — arbitrary pixel values in brackets for non-standard sizes
- Overflow handling: `overflow: hidden` on window containers, `overflow-y-auto` on scrollable sections with `flex-1`
- Responsive prefixes (sm:, md:, etc.) supported but not heavily used in current codebase

## Import Organization

**Order:**
1. External packages (React, convex, third-party): `import { useState, useEffect } from 'react'`
2. Convex API and types: `import { useMutation } from 'convex/react'`, `import { api } from '../../convex/_generated/api'`
3. Project utilities and types: `import { getTimerColour } from '../lib/colour-calculator'`
4. Custom hooks and context: `import { useDoctorContext } from '../contexts/DoctorContext'`, `import { useTimer } from '../hooks/useTimer'`
5. Components: `import CustomTitleBar from './CustomTitleBar'`
6. Type-only imports: `import type { WidgetState } from '../types'`

**Path Aliases:**
- No path aliases configured — all imports use relative paths (`../`, `./`)
- Three-level up imports common in nested components: `import { STATE_MIN_HEIGHTS } from '../types'`

**Type imports:**
- `type` keyword used for pure type imports: `import type { WidgetState } from '../types'`
- Mixed imports allowed when value and type both needed: `import { useState } from 'react'`

## Error Handling

**Patterns:**
- Validation at entry points: `if (durationSeconds <= 0) throw new Error('Duration must be positive')`
- Guards as no-ops: Pause/resume on wrong states return early without throwing — `if (this._state !== 'running' && ...) return;`
- Try-catch blocks wrap async operations (mutations, API calls): `try { await createDoctor(...) } catch (err) { setError(...) }`
- Error state stored in component state: `const [error, setError] = useState('')` — displayed inline to user
- Convex mutations wrapped with `.catch(() => {})` for graceful offline failure: `updateWindowPositionMutation(...).catch(() => {})`
- User-facing error messages via optional chaining: `err?.message ?? 'Failed to create profile'`

## Logging

**Framework:** `console` (no logging library configured)

**Patterns:**
- Minimal logging in production code — intentionally omitted for clean UI
- Comments used instead to explain logic (see section headers with `// ──` separator pattern)
- Test files use Vitest time utilities (`vi.advanceTimersByTime()`) instead of logging
- No sensitive data logging (patient names, personal details never logged to console)

## Comments

**When to Comment:**
- Section headers using `// ── Name ────` separator pattern to divide logical blocks — organizes code visually
- Algorithm explanations — colour interpolation logic in `src/lib/colour-calculator.ts` includes detailed band descriptions
- State machine transitions — timer engine explains phase and state transitions
- Non-obvious calculations — elapsed/remaining calculations with time accounting explanations
- Business logic justifications — e.g., TimerWidget.tsx lines 68-71 explaining dynamic sizing calculation for doctor selector

**JSDoc/TSDoc:**
- Detailed JSDoc for public functions with parameter descriptions and units
- Constructor comments in TimerEngine provide context for private state
- Example from `colour-calculator.ts`: documents percentElapsed range (0-1+), thresholds, and return type

## Function Design

**Size:**
- Handlers tend to be compact (2-10 lines) — `handleClose()`, `commitYellow()`
- Complex logic extracted to utility functions or hooks: `formatTime()`, `getTimerColour()`, `buildSnapshot()`
- Component render bodies kept under 30 lines by splitting into multiple state-dependent conditional returns
- Hooks use focused callbacks with single responsibilities: `pause()`, `resume()`, `startTimer()`, `minimise()`

**Parameters:**
- Prefer object parameters for multiple related values — `onStart({ patientName, typeCode, durationMinutes })`
- Destructuring in function signatures: `({ activeDoctor, allDoctors, isLoading }) => { ... }`
- Optional parameters use `?` suffix in types: `soundEnabled?: boolean`, `onDeleteProfile?: () => void`

**Return Values:**
- Explicit return types on all public functions
- Snapshots and immutable data returns from engines — `getSnapshot(): TimerSnapshot`
- Void functions for state mutations — `pause(): void`, `setCallbacks(cb): void`
- Custom return type interfaces for hooks — `UseTimerReturn` includes state and all actions

## Module Design

**Exports:**
- React components: Default export (`export default function TimerWidget() {}`)
- Utility functions: Named exports (`export function getTimerColour(...) {}`)
- Type definitions: Named exports (`export interface TimerSnapshot { ... }`)
- Classes: Named exports (`export class TimerEngine { ... }`)

**Barrel Files:**
- Single centralized types file: `src/types/index.ts` (includes `STATE_MIN_HEIGHTS`, `STATE_MIN_WIDTHS`, all state types)
- No barrel files for components or utilities
- Direct imports from source files — `import { useTimer } from '../hooks/useTimer'`, `import TimerWidget from './TimerWidget'`

## CSS-in-Tailwind Pattern (Window Resizing)

**Responsive sizing approach:**
- Entire UI uses `min-h-screen` or `h-screen` with `overflow: hidden` to prevent content scrolling
- Scrollable containers explicitly use `overflow-y-auto` with `flex-1` to fill available space
- Window resizing controlled via electron API calls, NOT CSS media queries
- Minimum height/width thresholds stored as constants in `src/types/index.ts`: `STATE_MIN_HEIGHTS` and `STATE_MIN_WIDTHS` by widget state

**Layout stability during resize:**
- `flex-col` primary for vertical layouts — ensures content stacks predictably
- `flex-1` used to fill remaining space without exceeding container bounds
- `shrink-0` used to prevent items from shrinking below minimum size (buttons, labels, headers)
- `gap-` utilities for consistent spacing that doesn't break under resize operations
- No hardcoded min-width/max-width on components — window size management delegates to electron layer via API calls
- Dynamic minimum heights calculated based on content: see TimerWidget.tsx lines 68-71 for doctor selector dynamic sizing

**Window resize integration pattern:**
- Component uses `useEffect` to watch state changes (e.g., `needsDoctorSelect`, `showAddDoctor`, `timer.widgetState`)
- Calls `window.electronAPI?.setWindowMinSize(width, height)` to constraint window size
- Special handlers for transitions: `window.electronAPI?.minimiseToBar()` and `window.electronAPI?.restoreFromBar()`
- Settings panel expands window via `window.electronAPI?.setWindowMinSize(280, 700)` when manage section opens

---

*Convention analysis: 2026-02-11*
