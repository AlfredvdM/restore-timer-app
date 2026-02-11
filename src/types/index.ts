// ──────────────────────────────────────────────
// RESTORE Timer — Core Types
// ──────────────────────────────────────────────

/** Doctor profile */
export interface Doctor {
  slug: string;
  name: string;
  colour: string;
}

/** Widget UI states (superset of timer states — includes setup, approval, minimised, settings, doctorSelect) */
export type WidgetState = 'idle' | 'setup' | 'running' | 'paused' | 'overtime' | 'approval' | 'minimised' | 'settings' | 'doctorSelect';

/** Window heights for each widget state */
export const STATE_HEIGHTS: Record<WidgetState, number> = {
  idle: 175,
  setup: 350,
  running: 230,
  paused: 230,
  overtime: 230,
  approval: 490,
  minimised: 40,
  settings: 520,
  doctorSelect: 280,
};

/** Fallback appointment types used when Convex is offline or loading */
export const APPOINTMENT_TYPE_OPTIONS: Array<{ name: string; code: string; defaultMinutes: number }> = [
  { name: 'Standard Consultation', code: 'standard', defaultMinutes: 15 },
  { name: 'Long Consultation', code: 'long', defaultMinutes: 30 },
  { name: 'Follow-Up', code: 'follow_up', defaultMinutes: 10 },
  { name: 'Telephone Consultation', code: 'telephone', defaultMinutes: 5 },
  { name: 'Procedure', code: 'procedure', defaultMinutes: 20 },
  { name: 'Custom', code: 'custom', defaultMinutes: 15 },
];

/** Timer lifecycle states */
export type TimerState = 'idle' | 'running' | 'paused' | 'overtime';

/** Colour phase based on elapsed percentage */
export type TimerPhase = 'green' | 'yellow' | 'red' | 'overtime';

/** Snapshot of the timer at a given moment (emitted on every tick) */
export interface TimerSnapshot {
  state: TimerState;
  /** Total seconds the timer was configured for */
  totalDurationSeconds: number;
  /** Seconds elapsed (excluding paused time) */
  elapsedSeconds: number;
  /** Seconds remaining (0 when overtime) */
  remainingSeconds: number;
  /** Seconds spent in overtime (0 when not overtime) */
  overtimeSeconds: number;
  /** Total seconds the timer has been paused */
  pausedDurationSeconds: number;
  /** 0‑1+ percentage of elapsed / total (can exceed 1 in overtime) */
  percentComplete: number;
  /** Current colour phase */
  phase: TimerPhase;
}

/** Callbacks the timer engine invokes */
export interface TimerCallbacks {
  /** Fired every ~1 s with the current snapshot */
  onTick?: (remaining: number, elapsed: number, percentComplete: number) => void;
  /** Fired when the colour phase changes */
  onThresholdChange?: (phase: TimerPhase) => void;
  /** Fired once when the countdown reaches 0 */
  onOvertime?: () => void;
  /** Fired when stop() is called — delivers the final snapshot */
  onComplete?: (snapshot: TimerSnapshot) => void;
}

/** Options for constructing a TimerEngine */
export interface TimerEngineOptions {
  callbacks?: TimerCallbacks;
  /** Percentage (0‑1) at which green→yellow transition begins (default 0.6) */
  yellowThreshold?: number;
  /** Percentage (0‑1) at which yellow→red transition begins (default 0.9) */
  redThreshold?: number;
  /** Tick interval in ms — mainly for testing (default 1000) */
  tickIntervalMs?: number;
}

/** Return type of the colour calculator */
export interface ColourResult {
  background: string;
  text: string;
}

/** Appointment type as stored in Convex */
export interface AppointmentType {
  name: string;
  code: string;
  defaultDurationMinutes: number;
  colour?: string;
  isActive: boolean;
  sortOrder: number;
}

/** Consultation record as stored in Convex */
export interface Consultation {
  doctorId: string;
  doctorName: string;
  patientName?: string;
  appointmentType: string;
  targetDurationSeconds: number;
  actualDurationSeconds: number;
  wentOvertime: boolean;
  overtimeSeconds?: number;
  pausedDurationSeconds: number;
  consultationDate: string;
  startedAt: number;
  completedAt: number;
  notes?: string;
  status: 'completed' | 'cancelled';
}

/** Per-user timer settings */
export interface TimerSettings {
  userId: string;
  soundEnabled: boolean;
  soundVolume: number;
  chimeType?: string;
  yellowThreshold: number;
  redThreshold: number;
  alwaysOnTop: boolean;
  defaultAppointmentType?: string;
  windowPosition?: { x: number; y: number };
}
