import type {
  TimerState,
  TimerPhase,
  TimerSnapshot,
  TimerCallbacks,
  TimerEngineOptions,
} from '../types';

/**
 * Pure timer engine — no React or UI dependencies.
 *
 * Uses Date.now() for accuracy (setInterval is only for scheduling ticks).
 * Paused time is excluded from actual duration calculations.
 * When the countdown reaches 0 the timer switches to counting UP (overtime).
 */
export class TimerEngine {
  // ── Configuration ────────────────────────────
  private callbacks: TimerCallbacks;
  private yellowThreshold: number;
  private redThreshold: number;
  private tickIntervalMs: number;

  // ── State ────────────────────────────────────
  private _state: TimerState = 'idle';
  private totalDurationSeconds = 0;

  /** Epoch ms when start() was called */
  private startTime = 0;
  /** Epoch ms when pause() was last called */
  private pauseTime = 0;
  /** Cumulative ms spent paused */
  private totalPausedMs = 0;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastPhase: TimerPhase = 'green';
  private overtimeFired = false;

  constructor(options: TimerEngineOptions = {}) {
    this.callbacks = options.callbacks ?? {};
    this.yellowThreshold = options.yellowThreshold ?? 0.6;
    this.redThreshold = options.redThreshold ?? 0.9;
    this.tickIntervalMs = options.tickIntervalMs ?? 1000;
  }

  // ── Public API ───────────────────────────────

  get state(): TimerState {
    return this._state;
  }

  /** Start a countdown of `durationSeconds`. Resets any prior state. */
  start(durationSeconds: number): void {
    if (durationSeconds <= 0) throw new Error('Duration must be positive');
    this.cleanup();

    this.totalDurationSeconds = durationSeconds;
    this.startTime = Date.now();
    this.pauseTime = 0;
    this.totalPausedMs = 0;
    this.lastPhase = 'green';
    this.overtimeFired = false;
    this._state = 'running';

    this.tick(); // immediate first tick
    this.intervalId = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  /** Pause the timer — records the pause timestamp. */
  pause(): void {
    if (this._state !== 'running' && this._state !== 'overtime') return;
    this.pauseTime = Date.now();
    this._state = 'paused';
    this.clearInterval();
  }

  /** Resume from paused — adds paused duration to the total. */
  resume(): void {
    if (this._state !== 'paused') return;
    this.totalPausedMs += Date.now() - this.pauseTime;
    this.pauseTime = 0;
    // Restore the correct state based on elapsed time
    const snap = this.buildSnapshot();
    this._state = snap.remainingSeconds <= 0 ? 'overtime' : 'running';

    this.tick();
    this.intervalId = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  /** Stop the timer and emit onComplete with the final snapshot. */
  stop(): TimerSnapshot {
    // If paused, account for the final paused stretch
    if (this._state === 'paused' && this.pauseTime > 0) {
      this.totalPausedMs += Date.now() - this.pauseTime;
      this.pauseTime = 0;
    }
    const snapshot = this.buildSnapshot();
    this.cleanup();
    this._state = 'idle';
    this.callbacks.onComplete?.(snapshot);
    return snapshot;
  }

  /** Reset to idle without emitting onComplete. */
  reset(): void {
    this.cleanup();
    this._state = 'idle';
    this.totalDurationSeconds = 0;
    this.startTime = 0;
    this.pauseTime = 0;
    this.totalPausedMs = 0;
    this.lastPhase = 'green';
    this.overtimeFired = false;
  }

  /** Get a readonly snapshot of the current timer state. */
  getSnapshot(): TimerSnapshot {
    return this.buildSnapshot();
  }

  /** Update thresholds at runtime (e.g. from settings changes). */
  setThresholds(yellow: number, red: number): void {
    this.yellowThreshold = yellow;
    this.redThreshold = red;
  }

  /** Replace callbacks (useful when React re‑renders). */
  setCallbacks(cb: TimerCallbacks): void {
    this.callbacks = cb;
  }

  // ── Internals ────────────────────────────────

  private tick(): void {
    if (this._state === 'idle' || this._state === 'paused') return;

    const snap = this.buildSnapshot();

    // Detect overtime transition
    if (snap.remainingSeconds <= 0 && !this.overtimeFired) {
      this.overtimeFired = true;
      this._state = 'overtime';
      this.callbacks.onOvertime?.();
    } else if (snap.remainingSeconds <= 0) {
      this._state = 'overtime';
    }

    // Detect phase change
    const phase = snap.phase;
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      this.callbacks.onThresholdChange?.(phase);
    }

    this.callbacks.onTick?.(snap.remainingSeconds, snap.elapsedSeconds, snap.percentComplete);
  }

  private buildSnapshot(): TimerSnapshot {
    const now = Date.now();
    let pausedMs = this.totalPausedMs;

    // If currently paused, include the ongoing pause stretch
    if (this._state === 'paused' && this.pauseTime > 0) {
      pausedMs += now - this.pauseTime;
    }

    const elapsedMs = this.startTime > 0 ? now - this.startTime - pausedMs : 0;
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const remainingSeconds = Math.max(0, this.totalDurationSeconds - elapsedSeconds);
    const overtimeSeconds = elapsedSeconds > this.totalDurationSeconds
      ? elapsedSeconds - this.totalDurationSeconds
      : 0;
    const percentComplete = this.totalDurationSeconds > 0
      ? elapsedSeconds / this.totalDurationSeconds
      : 0;

    const phase = this.computePhase(percentComplete);

    return {
      state: this._state,
      totalDurationSeconds: this.totalDurationSeconds,
      elapsedSeconds,
      remainingSeconds,
      overtimeSeconds,
      pausedDurationSeconds: Math.floor(pausedMs / 1000),
      percentComplete,
      phase,
    };
  }

  private computePhase(percentComplete: number): TimerPhase {
    if (percentComplete >= 1) return 'overtime';
    if (percentComplete >= this.redThreshold) return 'red';
    if (percentComplete >= this.yellowThreshold) return 'yellow';
    return 'green';
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private cleanup(): void {
    this.clearInterval();
  }
}
