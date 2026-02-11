# Testing Patterns

**Analysis Date:** 2026-02-11

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.mts`

**Test Pattern Matcher:**
- Files matching `src/**/*.test.ts` are discovered and executed

**Assertion Library:**
- Vitest built-in `expect()` (compatible with Jest)

**Run Commands:**
```bash
npm test                # Run all tests (if script configured)
npm run build           # Builds TypeScript (tsc) before test
vitest                  # Run tests (if vitest installed globally)
vitest --watch         # Watch mode
```

**Config File (`vitest.config.mts`):**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

## Test File Organization

**Location:**
- Co-located with source files (same directory as the code being tested)

**Naming:**
- Pattern: `[filename].test.ts`
- Examples: `timer-engine.test.ts`, `colour-calculator.test.ts`

**Structure:**
```
src/lib/
├── timer-engine.ts
├── timer-engine.test.ts
├── colour-calculator.ts
└── colour-calculator.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerEngine } from './timer-engine';
import type { TimerPhase, TimerSnapshot } from '../types';

describe('TimerEngine', () => {
  // ── Setup ──────────────────────────────────────
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Test suite 1 ───────────────────────────────
  describe('Construction & defaults', () => {
    it('starts in idle state', () => {
      const engine = new TimerEngine();
      expect(engine.state).toBe('idle');
    });
  });

  // ── Test suite 2 ───────────────────────────────
  describe('Pause / Resume', () => {
    it('pauses and resumes correctly', () => {
      // ... test body
    });
  });
});
```

**Patterns:**
- **Setup**: `beforeEach()` to initialize fake timers or state
- **Teardown**: `afterEach()` to restore real timers
- **Grouping**: Logical subsections use nested `describe()` blocks with section headers (`// ──`)
- **Assertion**: Direct `expect()` calls on return values or state mutations
- **Helper Functions**: Extracted helper (e.g., `function advance(ms)`) for time advancement

## Mocking

**Framework:** Vitest `vi` namespace for time and callback mocking

**Timer Mocking:**
```typescript
// From timer-engine.test.ts
beforeEach(() => {
  vi.useFakeTimers();  // Enable fake timers for deterministic testing
});

afterEach(() => {
  vi.useRealTimers();  // Restore real timers
});

// Helper to advance time synchronously
function advance(ms: number) {
  vi.advanceTimersByTime(ms);
}

// Usage in test:
engine.start(60);
advance(5000);  // Advance 5 seconds
expect(engine.state).toBe('paused');  // Check state after time advance
```

**Callback Spying:**
```typescript
it('fires onOvertime exactly once', () => {
  let count = 0;
  const engine = new TimerEngine({
    callbacks: { onOvertime: () => { count++; } },
  });

  engine.start(3);
  advance(6000);  // Well past overtime
  expect(count).toBe(1);  // Verify callback fired exactly once
});

it('fires onTick with correct remaining/elapsed values', () => {
  const ticks: { remaining: number; elapsed: number; pct: number }[] = [];
  const engine = new TimerEngine({
    callbacks: {
      onTick: (remaining, elapsed, percentComplete) =>
        ticks.push({ remaining, elapsed, pct: percentComplete }),
    },
  });

  engine.start(10);
  expect(ticks.length).toBe(1);
  expect(ticks[0].remaining).toBe(10);
  expect(ticks[0].elapsed).toBe(0);

  advance(3000);
  const last = ticks[ticks.length - 1];
  expect(last.elapsed).toBe(3);
  expect(last.remaining).toBe(7);
});
```

**What to Mock:**
- Timers (always — use `vi.useFakeTimers()` for deterministic testing)
- Callbacks/side effects (track calls with captured variables like count or arrays)
- Time-dependent state (use `vi.advanceTimersByTime()` to control flow)

**What NOT to Mock:**
- Pure utility functions (`colour-calculator.ts` has no mocks)
- Internal class methods (test through public API only)
- Type definitions
- React components (would require React Testing Library, not currently configured)

## Fixtures and Factories

**Test Data:**
- No dedicated fixture files
- Inline test data created per test or in setup blocks
- Snapshot creation done via engine methods: `engine.getSnapshot()`

**Example from `colour-calculator.test.ts`:**
```typescript
it('returns green (#22c55e) at 0% elapsed', () => {
  const result = getTimerColour(0);
  expect(result.background.toLowerCase()).toBe('#22c55e');
  expect(result.text).toBe('#FFFFFF');
});

it('respects custom yellowThreshold', () => {
  // Yellow at 40% instead of 60%
  const result = getTimerColour(0.4, 0.4, 0.9);
  expect(result.background.toLowerCase()).toBe('#84cc16'); // lime at yellow boundary
});
```

**Location:**
- Test data defined inline within test functions or `beforeEach()` blocks
- No separate `__fixtures__` or `fixtures/` directory

## Coverage

**Requirements:** Not enforced (no coverage threshold in vitest config)

**View Coverage:**
- No coverage reporting configured
- Coverage can be added with: `vitest --coverage` (requires additional dependencies like `@vitest/coverage-v8`)

## Test Types

**Unit Tests:**
- Scope: Individual functions, classes, and their methods
- Approach: Direct invocation with inputs, assertion of outputs or state changes
- Examples:
  - `src/lib/timer-engine.test.ts` — TimerEngine class (27 tests) covering state transitions, pause/resume, overtime, phase detection, snapshots, restarting
  - `src/lib/colour-calculator.test.ts` — Pure colour interpolation function (9 tests) covering boundary colors, interpolation, custom thresholds, edge cases
- Timer-based tests use fake timers to ensure deterministic execution

**Integration Tests:**
- Not present in current codebase
- Would test hook interactions with Convex and multiple components
- Would require React Testing Library or Enzyme

**E2E Tests:**
- Not implemented (Electron app would require specialized runner like Playwright or Cypress)

## Common Patterns

**Async Testing:**
- No async tests currently (timer tests use synchronous fake timers)
- Would use `async/await` with `vi.advanceTimersByTime()` if mixing real async with timer control

**Error Testing:**
```typescript
it('throws when starting with 0 or negative duration', () => {
  const engine = new TimerEngine();
  expect(() => engine.start(0)).toThrow('Duration must be positive');
  expect(() => engine.start(-5)).toThrow('Duration must be positive');
});
```

**State Machine Testing:**
```typescript
it('pauses and resumes correctly', () => {
  const engine = new TimerEngine();
  engine.start(60);

  advance(5000);  // 5 s elapsed
  engine.pause();
  expect(engine.state).toBe('paused');

  advance(10_000);  // Time passes while paused — should NOT count

  engine.resume();
  expect(engine.state).toBe('running');

  advance(5000);  // Another 5 s running

  const snap = engine.getSnapshot();
  expect(snap.elapsedSeconds).toBe(10);  // 5 + 5 (not 20)
  expect(snap.remainingSeconds).toBe(50);
  expect(snap.pausedDurationSeconds).toBe(10);
});
```

**Boundary Value Testing:**
```typescript
it('returns green (#22c55e) at 0% elapsed', () => {
  const result = getTimerColour(0);
  expect(result.background.toLowerCase()).toBe('#22c55e');
});

it('returns lime (#84cc16) at exactly the yellow threshold (60%)', () => {
  const result = getTimerColour(0.6);
  expect(result.background.toLowerCase()).toBe('#84cc16');
});

it('returns deep red (#dc2626) at 100% (overtime)', () => {
  const result = getTimerColour(1.0);
  expect(result.background.toLowerCase()).toBe('#dc2626');
});
```

**Interpolation & Rounding Testing:**
```typescript
it('interpolates in the yellow band', () => {
  const result = getTimerColour(0.75);  // Midpoint of 0.6→0.9
  expect(result.background.toLowerCase()).toBe('#eab308');
});

it('interpolates in the red band', () => {
  const result = getTimerColour(0.95);  // Midpoint of 0.9→1.0
  // Rounding means we accept either value
  const bg = result.background.toLowerCase();
  expect(bg === '#f27127' || bg === '#f27128').toBe(true);
});
```

**Edge Case Testing:**
```typescript
it('handles edge case of 0 thresholds without crashing', () => {
  const result = getTimerColour(0.5, 0, 0);
  expect(result.background).toBeTruthy();
  expect(result.text).toBe('#FFFFFF');
});

it('pause() is a no-op when idle', () => {
  const engine = new TimerEngine();
  engine.pause();  // should not throw
  expect(engine.state).toBe('idle');
});

it('reset() returns to idle without emitting onComplete', () => {
  let completeCalled = false;
  const engine = new TimerEngine({
    callbacks: { onComplete: () => { completeCalled = true; } },
  });

  engine.start(10);
  advance(3000);
  engine.reset();

  expect(engine.state).toBe('idle');
  expect(completeCalled).toBe(false);
});
```

**Phase Transition Testing:**
```typescript
it('detects phase transitions at correct thresholds', () => {
  const phases: TimerPhase[] = [];
  const engine = new TimerEngine({
    yellowThreshold: 0.5,
    redThreshold: 0.8,
    callbacks: { onThresholdChange: (p) => phases.push(p) },
  });

  engine.start(10);
  advance(5000);   // 50% → yellow
  advance(3000);   // 80% → red
  advance(2000);   // 100% → overtime

  expect(phases).toEqual(['yellow', 'red', 'overtime']);
});
```

## Current Test Coverage

**Tested Components:**
- `src/lib/timer-engine.ts` — 27 tests covering state transitions, pause/resume, overtime, phase detection, snapshots, restarting
- `src/lib/colour-calculator.ts` — 9 tests covering boundary colors, interpolation, custom thresholds, edge cases

**Untested Components (React layer):**
- `src/hooks/useTimer.ts` — Hook state management, callbacks, lifecycle (requires React Testing Library)
- `src/hooks/useConvexData.ts` — Convex integration, offline scenarios (requires mocking Convex)
- All React components (`src/components/*.tsx`) — No component tests
- Electron main process (`electron/main.ts`) — Not tested
- Window resizing integration (`window.electronAPI?.setWindowMinSize()` calls) — Not tested
- Sound synthesis (`src/lib/sound.ts`) — Not tested

## Test Coverage Gaps

**High-Risk Untested Areas:**
1. **useTimer Hook**: State management, callbacks, lifecycle — critical to timer functionality
2. **Window Resizing**: `setWindowMinSize()`, `restoreFromBar()`, `minimiseToBar()` electron API calls and state transitions
3. **React Components**: TimerWidget, TimerDisplay, SettingsView rendering and interactions
4. **useConvexData Hook**: Convex mutations, offline persistence, settings sync
5. **Electron Integration**: Window position, always-on-top, IPC between renderer and main
6. **Sound Generation**: playChime() and all sound synthesis logic (`src/lib/sound.ts`)

**Priority for Testing:**
1. Add integration tests for window resize behavior (state transitions trigger correct electron API calls)
2. Add React component tests for TimerWidget and critical displays
3. Add hook tests for useTimer state machine (especially minimise/restore transitions)
4. Add integration tests for Convex offline scenarios

## Testing Window Resize Behavior (Future)

**Potential Test Pattern:**
```typescript
// Would require mocking window.electronAPI
it('calls setWindowMinSize when transitioning to settings', () => {
  const setWindowMinSizeMock = vi.fn();
  window.electronAPI = { setWindowMinSize: setWindowMinSizeMock };

  // Mount TimerWidget, trigger settings
  // ...

  expect(setWindowMinSizeMock).toHaveBeenCalledWith(280, 520);
});

it('calls minimiseToBar when state changes to minimised', () => {
  const minimiseToBarMock = vi.fn();
  window.electronAPI = { minimiseToBar: minimiseToBarMock };

  // Mount TimerWidget, trigger minimise
  // ...

  expect(minimiseToBarMock).toHaveBeenCalled();
});
```

---

*Testing analysis: 2026-02-11*
