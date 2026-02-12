import type { WidgetState } from '../types';

interface TimerControlsProps {
  state: WidgetState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function TimerControls({
  state,
  onPause,
  onResume,
  onStop,
}: TimerControlsProps) {
  if (state === 'running' || state === 'overtime') {
    return (
      <div className="flex gap-1.5 px-3 pb-1.5">
        <button
          onClick={onPause}
          className="
            flex-1 py-1.5 rounded-xl
            bg-white/20 hover:bg-white/30 active:bg-white/40
            text-white text-sm font-medium
            transition-colors duration-150 backdrop-blur-sm
          "
        >
          Pause
        </button>
        <button
          onClick={onStop}
          className="
            flex-1 py-1.5 rounded-xl
            bg-white/20 hover:bg-white/30 active:bg-white/40
            text-white text-sm font-medium
            transition-colors duration-150 backdrop-blur-sm
          "
        >
          Stop
        </button>
      </div>
    );
  }

  if (state === 'paused') {
    return (
      <div className="flex gap-1.5 px-3 pb-1.5">
        <button
          onClick={onResume}
          className="
            flex-1 py-1.5 rounded-xl
            bg-white/25 hover:bg-white/35 active:bg-white/45
            text-white text-sm font-semibold
            transition-colors duration-150 backdrop-blur-sm
          "
        >
          Resume
        </button>
        <button
          onClick={onStop}
          className="
            flex-1 py-1.5 rounded-xl
            bg-white/15 hover:bg-white/25 active:bg-white/35
            text-white/80 text-sm font-medium
            transition-colors duration-150 backdrop-blur-sm
          "
        >
          Stop
        </button>
      </div>
    );
  }

  return null;
}
