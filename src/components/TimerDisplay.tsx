import type { WidgetState } from '../types';

interface TimerDisplayProps {
  state: WidgetState;
  displayTime: string;
  patientName: string;
  appointmentType: string;
  targetLabel: string;
}

export default function TimerDisplay({
  state,
  displayTime,
  patientName,
  appointmentType,
  targetLabel,
}: TimerDisplayProps) {
  const isOvertime = state === 'overtime';
  const isPaused = state === 'paused';

  return (
    <div className="flex flex-col items-center justify-center px-4 py-3 relative">
      {/* Patient name */}
      {patientName && (
        <p className="text-sm font-medium text-white/90 tracking-wide mb-1 truncate max-w-[280px]">
          {patientName}
        </p>
      )}

      {/* Countdown */}
      <div className="relative">
        <p
          className={`
            font-mono font-bold tracking-wider text-white leading-none
            ${isOvertime ? 'text-[52px]' : 'text-[56px]'}
          `}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {isOvertime && <span className="text-[36px] text-white/80 align-top mr-0.5">+</span>}
          {displayTime}
        </p>

        {/* Paused overlay */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold tracking-[0.25em] uppercase text-white/80 bg-black/20 px-3 py-1 rounded-full animate-pulse">
              Paused
            </span>
          </div>
        )}
      </div>

      {/* Appointment type + target */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs text-white/70">{appointmentType}</span>
        <span className="text-white/30">&#183;</span>
        <span className="text-[11px] text-white/50">{targetLabel}</span>
      </div>
    </div>
  );
}
