# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (`TimerWidget.tsx`, `TimerDisplay.tsx`)
- TypeScript utility/library files: kebab-case with `.ts` extension (`timer-engine.ts`, `colour-calculator.ts`)
- Hook files: kebab-case with `.ts` extension (`useTimer.ts`, `useConvexData.ts`)
- Test files: Same name as source + `.test.ts` suffix (`timer-engine.test.ts`)

**Functions:**
- React components: PascalCase (exported as default) — `export default function TimerWidget() {}`
- Utility functions: camelCase — `formatTime()`, `clamp01()`, `getTimerColour()`
- Helper functions (private): camelCase — `playGentleBell()`, `buildSnapshot()`, `computePhase()`
- Hook functions: camelCase with `use` prefix — `useTimer()`, `useConvexData()`

**Variables:**
- Constants (exported): SCREAMING_SNAKE_CASE for truly immutable globals — `DOCTOR`, `STORAGE_KEY`, `OFFLINE_GRACE_MS`
- Constants (exported type/config): PascalCase or snake_case depending on usage — `STATE_HEIGHTS`, `APPOINTMENT_TYPE_OPTIONS`, `CHIME_OPTIONS`
- Local state/variables: camelCase — `widgetState`, `remainingSeconds`, `ticks`, `audioCtx`
- React state setters: camelCase with `set` prefix — `setWidgetState()`, `setConsultation()`

**Types:**
- Type definitions (interfaces/types): PascalCase — `WidgetState`, `TimerState`, `TimerSnapshot`, `ColourResult`
- Type discriminants: lowercase with hyphens — `'idle' | 'setup' | 'running'`
- Generic types: PascalCase — `RGB`, `TimerCallbacks`

## Code Style

**Formatting:**
- No dedicated formatter configured (no `.prettierrc` or ESLint rules found)
- Manually formatted code consistently uses 2-space indentation
- Template literals used for multiline strings, especially in Tailwind className definitions
- Long strings (className) span multiple lines with consistent indentation alignment

**Linting:**
- No ESLint config file present (no `.eslintrc*` found)
- Code relies on TypeScript strict mode for type safety (`strict: true` in `tsconfig.json`)
- Implicit `any` types prevented by TypeScript strict mode

**TypeScript Strict Mode:**
- All files compiled with `"strict": true`
- `"forceConsistentCasingInFileNames": true`
- No implicit `any` values allowed
- Explicit type annotations required for interfaces and function signatures

## Import Organization

**Order:**
1. External packages (React, convex, third-party)
2. Internal type imports (`import type { ... } from '../types'`)
3. Internal utility/lib imports (`from '../lib/...'` or `from '../hooks/...'`)
4. Component imports (`from './...'` or `from './components/...'`)

**Example from `TimerWidget.tsx`:**
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { STATE_HEIGHTS, DOCTOR } from '../types';
import { useTimer } from '../hooks/useTimer';
import { useConvexData } from '../hooks/useConvexData';
import CustomTitleBar from './CustomTitleBar';
import TimerDisplay from './TimerDisplay';
// ... more components
```

**Path Aliases:**
- No path aliases configured; relative imports used throughout
- Convex API auto-generated at `convex/_generated/api`
- Relative paths like `'../../convex/_generated/api'` and `'../types'` common

## Error Handling

**Patterns:**
- Validation at entry points: `if (durationSeconds <= 0) throw new Error('Duration must be positive')`
- Guards as no-ops: Pause/resume on wrong states return early without throwing — `if (this._state !== 'running' && ...) return;`
- Convex mutations wrapped with `.catch(() => {})` for graceful failure (offline scenarios) — `seedMutation().catch(() => {})`
- State snapshots validated before use (null checks in JSX) — `{approvalSnapshot && ...}`

**Example from `timer-engine.ts`:**
```typescript
start(durationSeconds: number): void {
  if (durationSeconds <= 0) throw new Error('Duration must be positive');
  this.cleanup();
  // ... rest of logic
}
```

## Logging

**Framework:** No logger imported; uses native `console` where logging needed

**Patterns:**
- Minimal logging in production code
- Test files use `vi.advanceTimersByTime()` from Vitest for time-based testing instead of logging
- No explicit logging calls in business logic (`timer-engine.ts`, `colour-calculator.ts`)

## Comments

**When to Comment:**
- Algorithm explanations — color interpolation logic in `colour-calculator.ts` includes detailed band explanations
- State machine transitions — comments in `timer-engine.ts` explain phase and state transitions
- Non-obvious calculations — timer elapsed/remaining calculations with time accounting comments
- JSDoc for public APIs

**JSDoc/TSDoc:**
- Used for public functions and utility exports
- Detailed parameter descriptions with units where applicable

**Example from `colour-calculator.ts`:**
```typescript
/**
 * Returns the interpolated background and text colours for the timer widget.
 *
 * @param percentElapsed  0‑1+ value (can exceed 1 in overtime)
 * @param yellowThreshold fraction (default 0.6) where green→yellow begins
 * @param redThreshold    fraction (default 0.9) where yellow→red begins
 */
export function getTimerColour(
  percentElapsed: number,
  yellowThreshold = 0.6,
  redThreshold = 0.9,
): ColourResult {
```

**Example from `sound.ts`:**
```typescript
/**
 * Gentle Bell — a warm, round bell strike with natural harmonics.
 * Two layered sine tones with a soft attack and long decay.
 */
function playGentleBell(ctx: AudioContext, volume: number) {
```

## Function Design

**Size:**
- Utility functions kept small (10-30 lines) — `clamp01()`, `lerp()`, `toHex()`
- Business logic split into private methods within classes — `TimerEngine.tick()`, `TimerEngine.buildSnapshot()`
- React hooks use descriptive callbacks with focused responsibility — `pause()`, `resume()`, `startTimer()`

**Parameters:**
- Prefer object parameters for multiple related values — `startTimer({ patientName, typeCode, typeName, durationMinutes })`
- Single scalar parameters for simple values — `pause(): void`, `reset(): void`
- Options objects with optional properties — `UseTimerOptions { soundEnabled?: boolean; soundVolume?: number; ... }`

**Return Values:**
- Explicit return types on all public functions and exports
- Snapshots and immutable data returns from engines — `getSnapshot(): TimerSnapshot`
- Void functions for state mutations — `pause(): void`, `setCallbacks(cb): void`
- Custom return type interfaces for hook return values — `UseTimerReturn { widgetState, actions, ... }`

**Example from `useTimer.ts`:**
```typescript
export interface UseTimerReturn {
  widgetState: WidgetState;
  remainingSeconds: number;
  elapsedSeconds: number;
  // ... more fields
  goToSetup: () => void;
  startTimer: (info: { patientName: string; typeCode: string; ... }) => void;
  pause: () => void;
  // ... more actions
}

export function useTimer(options?: UseTimerOptions): UseTimerReturn {
  // ... implementation
}
```

## Module Design

**Exports:**
- React components: Default export (`export default function TimerWidget() {}`)
- Utility functions: Named exports (`export function getTimerColour(...) {}`)
- Type definitions: Named exports (`export interface TimerSnapshot { ... }`)
- Classes: Named exports (`export class TimerEngine { ... }`)

**Barrel Files:**
- Single centralized types file: `src/types/index.ts`
- No barrel files for components or utilities
- Direct imports from source files — `import { useTimer } from '../hooks/useTimer'`

**Example from `colour-calculator.ts`:**
```typescript
// Named export for utility
export function getTimerColour(
  percentElapsed: number,
  yellowThreshold = 0.6,
  redThreshold = 0.9,
): ColourResult {
  // ...
}
```

**Example from component:**
```typescript
// Default export for React component
export default function TimerDisplay({
  state,
  displayTime,
  // ... props
}: TimerDisplayProps) {
  // ...
}
```

## Whitespace & Structure

**Section Comments:**
- Used to visually organize code into logical sections
- Format: `// ── Section Name ──────────────────────────`
- Used in hooks, classes, and test suites to separate concerns

**Example from `useTimer.ts`:**
```typescript
// ── Consultation metadata persisted through the flow ─────────
export interface ConsultationInfo {
  // ...
}

// ── Hook return type ─────────────────────────────────────────
export interface UseTimerReturn {
  // ...
}

// ── React state ────────────────────────────
const [widgetState, setWidgetState] = useState<WidgetState>('idle');
```

## Pattern Examples

**Immutable snapshots from mutable engines:**
```typescript
// From timer-engine.ts
getSnapshot(): TimerSnapshot {
  return this.buildSnapshot();  // Always creates a fresh copy
}
```

**Private methods clearly marked:**
```typescript
private tick(): void { ... }
private buildSnapshot(): TimerSnapshot { ... }
private computePhase(percentComplete: number): TimerPhase { ... }
private clearInterval(): void { ... }
private cleanup(): void { ... }
```

**Defensive shallow copies for callbacks:**
```typescript
// From useTimer.ts
const optionsRef = useRef(options);
optionsRef.current = options;  // Always ref the latest options
```

---

*Convention analysis: 2026-02-11*
