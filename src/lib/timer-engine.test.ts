import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerEngine } from './timer-engine';
import type { TimerPhase, TimerSnapshot } from '../types';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

/** Advance Date.now() by `ms` milliseconds and flush pending timers. */
function advance(ms: number) {
  vi.advanceTimersByTime(ms);
}

// ─────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────

describe('TimerEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Construction & defaults ──────────────────

  it('starts in idle state', () => {
    const engine = new TimerEngine();
    expect(engine.state).toBe('idle');
  });

  it('throws when starting with 0 or negative duration', () => {
    const engine = new TimerEngine();
    expect(() => engine.start(0)).toThrow('Duration must be positive');
    expect(() => engine.start(-5)).toThrow('Duration must be positive');
  });

  // ── Basic start / tick ───────────────────────

  it('transitions to running on start()', () => {
    const engine = new TimerEngine();
    engine.start(60);
    expect(engine.state).toBe('running');
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
    // Immediate tick (t=0)
    expect(ticks.length).toBe(1);
    expect(ticks[0].remaining).toBe(10);
    expect(ticks[0].elapsed).toBe(0);

    advance(3000);
    // t=0 + 3 interval ticks = 4 total
    const last = ticks[ticks.length - 1];
    expect(last.elapsed).toBe(3);
    expect(last.remaining).toBe(7);
    expect(last.pct).toBeCloseTo(0.3);
  });

  // ── Pause / Resume ──────────────────────────

  it('pauses and resumes correctly', () => {
    const engine = new TimerEngine();
    engine.start(60);

    advance(5000); // 5 s elapsed
    engine.pause();
    expect(engine.state).toBe('paused');

    // Time passes while paused — should NOT count
    advance(10_000);

    engine.resume();
    expect(engine.state).toBe('running');

    advance(5000); // another 5 s running

    const snap = engine.getSnapshot();
    // Total running time = 5 + 5 = 10 s
    expect(snap.elapsedSeconds).toBe(10);
    expect(snap.remainingSeconds).toBe(50);
    // Paused for 10 s
    expect(snap.pausedDurationSeconds).toBe(10);
  });

  it('excludes paused time from elapsed on stop()', () => {
    const engine = new TimerEngine();
    engine.start(60);

    advance(10_000); // 10 s running
    engine.pause();
    advance(20_000); // 20 s paused
    engine.resume();
    advance(5000);   // 5 s running

    const snap = engine.stop();
    expect(snap.elapsedSeconds).toBe(15); // 10 + 5
    expect(snap.pausedDurationSeconds).toBe(20);
  });

  // ── Overtime ─────────────────────────────────

  it('switches to overtime when countdown reaches 0', () => {
    let overtimeFired = false;
    const engine = new TimerEngine({
      callbacks: { onOvertime: () => { overtimeFired = true; } },
    });

    engine.start(5);
    advance(5000);
    expect(engine.state).toBe('overtime');
    expect(overtimeFired).toBe(true);
  });

  it('counts up during overtime', () => {
    const engine = new TimerEngine();
    engine.start(5);
    advance(8000); // 3 s into overtime

    const snap = engine.getSnapshot();
    expect(snap.state).toBe('overtime');
    expect(snap.remainingSeconds).toBe(0);
    expect(snap.overtimeSeconds).toBe(3);
    expect(snap.elapsedSeconds).toBe(8);
    expect(snap.percentComplete).toBeCloseTo(1.6);
  });

  it('fires onOvertime exactly once', () => {
    let count = 0;
    const engine = new TimerEngine({
      callbacks: { onOvertime: () => { count++; } },
    });

    engine.start(3);
    advance(6000); // well past overtime
    expect(count).toBe(1);
  });

  // ── Phase / threshold detection ──────────────

  it('detects phase transitions at correct thresholds', () => {
    const phases: TimerPhase[] = [];
    const engine = new TimerEngine({
      yellowThreshold: 0.5,
      redThreshold: 0.8,
      callbacks: { onThresholdChange: (p) => phases.push(p) },
    });

    engine.start(10);
    // At t=0 phase is green (no change event yet — it's the default)
    advance(5000); // 50% → yellow
    advance(3000); // 80% → red
    advance(2000); // 100% → overtime

    expect(phases).toEqual(['yellow', 'red', 'overtime']);
  });

  // ── Stop / Complete ──────────────────────────

  it('fires onComplete with final snapshot on stop()', () => {
    let result: TimerSnapshot | null = null;
    const engine = new TimerEngine({
      callbacks: { onComplete: (s) => { result = s; } },
    });

    engine.start(30);
    advance(10_000);
    engine.stop();

    expect(result).not.toBeNull();
    expect(result!.elapsedSeconds).toBe(10);
    expect(result!.totalDurationSeconds).toBe(30);
  });

  it('returns to idle after stop()', () => {
    const engine = new TimerEngine();
    engine.start(10);
    advance(3000);
    engine.stop();
    expect(engine.state).toBe('idle');
  });

  // ── Reset ────────────────────────────────────

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

    const snap = engine.getSnapshot();
    expect(snap.elapsedSeconds).toBe(0);
    expect(snap.totalDurationSeconds).toBe(0);
  });

  // ── Edge cases ───────────────────────────────

  it('pause() is a no-op when idle', () => {
    const engine = new TimerEngine();
    engine.pause(); // should not throw
    expect(engine.state).toBe('idle');
  });

  it('resume() is a no-op when not paused', () => {
    const engine = new TimerEngine();
    engine.start(10);
    engine.resume(); // already running — no-op
    expect(engine.state).toBe('running');
  });

  it('can be restarted after stop()', () => {
    const engine = new TimerEngine();
    engine.start(10);
    advance(5000);
    engine.stop();

    engine.start(20);
    expect(engine.state).toBe('running');
    advance(3000);
    const snap = engine.getSnapshot();
    expect(snap.elapsedSeconds).toBe(3);
    expect(snap.totalDurationSeconds).toBe(20);
  });

  it('pause during overtime preserves state correctly', () => {
    const engine = new TimerEngine();
    engine.start(5);
    advance(8000); // 3 s overtime

    engine.pause();
    expect(engine.state).toBe('paused');
    advance(5000); // paused for 5 s

    engine.resume();
    expect(engine.state).toBe('overtime');
    advance(2000); // 2 more seconds overtime

    const snap = engine.getSnapshot();
    expect(snap.overtimeSeconds).toBe(5); // 3 + 2
    expect(snap.pausedDurationSeconds).toBe(5);
  });

  // ── setThresholds at runtime ─────────────────

  it('setThresholds changes phase boundaries', () => {
    const engine = new TimerEngine({ yellowThreshold: 0.6, redThreshold: 0.9 });
    engine.start(100);
    advance(50_000); // 50%

    let snap = engine.getSnapshot();
    expect(snap.phase).toBe('green'); // still under 60%

    engine.setThresholds(0.4, 0.8);
    advance(1000);
    snap = engine.getSnapshot();
    expect(snap.phase).toBe('yellow'); // now 51% > 40%
  });

  // ── stop() while paused accounts for paused time ──

  it('stop() while paused accounts for ongoing pause', () => {
    const engine = new TimerEngine();
    engine.start(60);
    advance(10_000);
    engine.pause();
    advance(5000); // paused for 5 s

    const snap = engine.stop(); // stop while still paused
    expect(snap.elapsedSeconds).toBe(10);
    expect(snap.pausedDurationSeconds).toBe(5);
  });
});
