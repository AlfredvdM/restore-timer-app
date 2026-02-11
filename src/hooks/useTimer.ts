import { useRef, useState, useCallback, useEffect } from 'react';
import { TimerEngine } from '../lib/timer-engine';
import { getTimerColour } from '../lib/colour-calculator';
import { playChime } from '../lib/sound';
import type { ChimeType } from '../lib/sound';
import type { WidgetState, TimerSnapshot, ColourResult } from '../types';

// ── Consultation metadata persisted through the flow ─────────
export interface ConsultationInfo {
  patientName: string;
  appointmentType: string;     // display name e.g. "Standard Consultation"
  appointmentTypeCode: string; // code e.g. "standard"
  targetDurationSeconds: number;
  startedAt: number;           // epoch ms
}

// ── Hook return type ─────────────────────────────────────────
export interface UseTimerReturn {
  widgetState: WidgetState;

  // Timer data (safe defaults when idle/setup)
  remainingSeconds: number;
  elapsedSeconds: number;
  percentComplete: number;
  overtimeSeconds: number;
  pausedSeconds: number;
  currentColour: ColourResult;
  displayTime: string;

  // Consultation metadata
  consultation: ConsultationInfo | null;
  // Snapshot captured when entering approval (engine is paused, not stopped)
  approvalSnapshot: TimerSnapshot | null;

  // Actions
  goToSetup: () => void;
  startTimer: (info: {
    patientName: string;
    typeCode: string;
    typeName: string;
    durationMinutes: number;
  }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;          // Running/Overtime → Approval (pauses engine)
  save: () => TimerSnapshot;  // Approval → Idle (fully stops engine, returns final data)
  discard: () => void;        // Approval → Idle (fully stops engine, no save)
  goBack: () => void;         // Approval → Running/Overtime (resumes engine)
  cancelSetup: () => void;
  minimise: () => void;       // Any timer state → Minimised bar
  restoreFromMinimised: () => void; // Minimised → previous state
}

const IDLE_COLOUR: ColourResult = { background: '#FFFFFF', text: '#1F2937' };

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface UseTimerOptions {
  soundEnabled?: boolean;
  soundVolume?: number;
  chimeType?: string;
  yellowThreshold?: number;
  redThreshold?: number;
}

export function useTimer(options?: UseTimerOptions): UseTimerReturn {
  const engineRef = useRef<TimerEngine | null>(null);

  // Keep options in a ref so callbacks always see the latest values
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── React state ────────────────────────────────
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [percentComplete, setPercentComplete] = useState(0);
  const [overtimeSeconds, setOvertimeSeconds] = useState(0);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const [currentColour, setCurrentColour] = useState<ColourResult>(IDLE_COLOUR);
  const [consultation, setConsultation] = useState<ConsultationInfo | null>(null);
  const [approvalSnapshot, setApprovalSnapshot] = useState<TimerSnapshot | null>(null);

  // Track whether the overtime chime has fired for this timer session
  const chimePlayed = useRef(false);

  // Track the state before minimising so we can restore it
  const preMinimiseState = useRef<WidgetState>('idle');

  // ── Lazy-init the engine ───────────────────────
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new TimerEngine();
    }
    return engineRef.current;
  }, []);

  // Keep a ref to widgetState so callbacks don't go stale
  const stateRef = useRef(widgetState);
  stateRef.current = widgetState;

  // ── Wire engine callbacks (run once) ───────────
  useEffect(() => {
    const engine = getEngine();
    engine.setCallbacks({
      onTick: (_remaining, _elapsed, pct) => {
        const snap = engine.getSnapshot();
        const opts = optionsRef.current;
        setRemainingSeconds(snap.remainingSeconds);
        setElapsedSeconds(snap.elapsedSeconds);
        setPercentComplete(snap.percentComplete);
        setOvertimeSeconds(snap.overtimeSeconds);
        setPausedSeconds(snap.pausedDurationSeconds);
        setCurrentColour(getTimerColour(pct, opts?.yellowThreshold, opts?.redThreshold));

        // Sync widget state → overtime when engine transitions
        if (snap.state === 'overtime' && stateRef.current === 'running') {
          setWidgetState('overtime');
        }
      },
      onOvertime: () => {
        setWidgetState('overtime');
        if (!chimePlayed.current) {
          chimePlayed.current = true;
          const opts = optionsRef.current;
          if (opts?.soundEnabled !== false) {
            playChime(opts?.soundVolume ?? 0.5, (opts?.chimeType as ChimeType) ?? 'gentle-bell');
          }
        }
      },
    });
  }, [getEngine]);

  // ── Sync engine thresholds when options change ─
  useEffect(() => {
    if (engineRef.current && options) {
      const yellow = options.yellowThreshold ?? 0.6;
      const red = options.redThreshold ?? 0.9;
      engineRef.current.setThresholds(yellow, red);
    }
  }, [options?.yellowThreshold, options?.redThreshold]);

  // ── Cleanup on unmount ─────────────────────────
  useEffect(() => {
    return () => engineRef.current?.reset();
  }, []);

  // ── Actions ────────────────────────────────────

  const goToSetup = useCallback(() => {
    setWidgetState('setup');
    setCurrentColour(IDLE_COLOUR);
  }, []);

  const cancelSetup = useCallback(() => {
    setWidgetState('idle');
    setCurrentColour(IDLE_COLOUR);
  }, []);

  const startTimer = useCallback(
    (info: {
      patientName: string;
      typeCode: string;
      typeName: string;
      durationMinutes: number;
    }) => {
      const durationSeconds = info.durationMinutes * 60;
      const engine = getEngine();

      chimePlayed.current = false;

      setConsultation({
        patientName: info.patientName,
        appointmentType: info.typeName,
        appointmentTypeCode: info.typeCode,
        targetDurationSeconds: durationSeconds,
        startedAt: Date.now(),
      });
      setApprovalSnapshot(null);

      engine.start(durationSeconds);
      setWidgetState('running');
      setCurrentColour(getTimerColour(0, options?.yellowThreshold, options?.redThreshold));
    },
    [getEngine, options?.yellowThreshold, options?.redThreshold],
  );

  const pause = useCallback(() => {
    getEngine().pause();
    setWidgetState('paused');
  }, [getEngine]);

  const resume = useCallback(() => {
    getEngine().resume();
    const snap = getEngine().getSnapshot();
    setWidgetState(snap.remainingSeconds <= 0 ? 'overtime' : 'running');
  }, [getEngine]);

  /**
   * "Stop" in the UI sense — pauses the engine and enters approval.
   * The engine is NOT destroyed so the user can click "Back" to resume.
   */
  const stop = useCallback(() => {
    const engine = getEngine();
    // Pause engine (keeps it alive for potential "Back" resume)
    if (engine.state === 'running' || engine.state === 'overtime') {
      engine.pause();
    }
    const snap = engine.getSnapshot();
    setApprovalSnapshot(snap);
    setWidgetState('approval');
    setCurrentColour(IDLE_COLOUR);
  }, [getEngine]);

  /**
   * Save — fully stop the engine and return the final snapshot for persistence.
   */
  const save = useCallback((): TimerSnapshot => {
    const engine = getEngine();
    const snapshot = engine.stop();
    setWidgetState('idle');
    setConsultation(null);
    setApprovalSnapshot(null);
    setRemainingSeconds(0);
    setElapsedSeconds(0);
    setPercentComplete(0);
    setOvertimeSeconds(0);
    setPausedSeconds(0);
    setCurrentColour(IDLE_COLOUR);
    chimePlayed.current = false;
    return snapshot;
  }, [getEngine]);

  const discard = useCallback(() => {
    getEngine().reset();
    setWidgetState('idle');
    setConsultation(null);
    setApprovalSnapshot(null);
    setRemainingSeconds(0);
    setElapsedSeconds(0);
    setPercentComplete(0);
    setOvertimeSeconds(0);
    setPausedSeconds(0);
    setCurrentColour(IDLE_COLOUR);
    chimePlayed.current = false;
  }, [getEngine]);

  const goBack = useCallback(() => {
    const engine = getEngine();
    engine.resume();
    const snap = engine.getSnapshot();
    const nextState = snap.remainingSeconds <= 0 ? 'overtime' : 'running';
    setWidgetState(nextState);
    setApprovalSnapshot(null);
    setCurrentColour(getTimerColour(snap.percentComplete, options?.yellowThreshold, options?.redThreshold));
  }, [getEngine, options?.yellowThreshold, options?.redThreshold]);

  const minimise = useCallback(() => {
    preMinimiseState.current = widgetState;
    setWidgetState('minimised');
  }, [widgetState]);

  const restoreFromMinimised = useCallback(() => {
    const prev = preMinimiseState.current;
    setWidgetState(prev);
    // Re-apply colour if we were in a coloured state
    if (prev === 'running' || prev === 'paused' || prev === 'overtime') {
      const snap = getEngine().getSnapshot();
      setCurrentColour(getTimerColour(snap.percentComplete, options?.yellowThreshold, options?.redThreshold));
    }
  }, [getEngine, options?.yellowThreshold, options?.redThreshold]);

  // ── Display time ───────────────────────────────
  const displayTime = (() => {
    if (widgetState === 'idle' || widgetState === 'setup') return '00:00';
    if (widgetState === 'overtime') return formatTime(overtimeSeconds);
    if (widgetState === 'approval' && approvalSnapshot) {
      // In approval, show what the timer was showing when stopped
      if (approvalSnapshot.overtimeSeconds > 0) {
        return formatTime(approvalSnapshot.overtimeSeconds);
      }
      return formatTime(approvalSnapshot.remainingSeconds);
    }
    return formatTime(remainingSeconds);
  })();

  return {
    widgetState,
    remainingSeconds,
    elapsedSeconds,
    percentComplete,
    overtimeSeconds,
    pausedSeconds,
    currentColour,
    displayTime,
    consultation,
    approvalSnapshot,
    goToSetup,
    startTimer,
    pause,
    resume,
    stop,
    save,
    discard,
    goBack,
    cancelSetup,
    minimise,
    restoreFromMinimised,
  };
}
