import type { WidgetState } from '../types';

interface CustomTitleBarProps {
  state: WidgetState;
  onMinimise: () => void;
}

export default function CustomTitleBar({ state, onMinimise }: CustomTitleBarProps) {
  const isColoured = state === 'running' || state === 'paused' || state === 'overtime';

  const handleClose = () => {
    // On macOS, close button hides to tray; on other platforms it quits
    const isMac = navigator.platform.toLowerCase().includes('mac');
    if (isMac) {
      window.electronAPI?.hideWindow();
    } else {
      window.electronAPI?.closeApp();
    }
  };

  return (
    <div
      className="h-7 flex items-center justify-between px-2 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Minimise */}
      <button
        onClick={onMinimise}
        className={`
          w-[18px] h-[18px] rounded-full flex items-center justify-center
          transition-opacity duration-150 hover:opacity-100 focus:outline-none
          ${isColoured
            ? 'bg-white/20 text-white/70 opacity-80'
            : 'bg-gray-200 text-gray-500 opacity-70 hover:bg-gray-300'
          }
        `}
        style={{ WebkitAppRegion: 'no-drag', fontSize: '11px', lineHeight: 1 } as React.CSSProperties}
        title="Minimise"
      >
        &#8722;
      </button>

      {/* Centre label — only show in idle/setup/approval */}
      {!isColoured && state !== 'minimised' && (
        <span className="text-[10px] tracking-widest uppercase text-gray-400 font-medium">
          Restore
        </span>
      )}
      {isColoured && <span />}

      {/* Close */}
      <button
        onClick={handleClose}
        className={`
          w-[18px] h-[18px] rounded-full flex items-center justify-center
          transition-opacity duration-150 hover:opacity-100 focus:outline-none
          ${isColoured
            ? 'bg-white/20 text-white/70 opacity-80'
            : 'bg-gray-200 text-gray-500 opacity-70 hover:bg-red-400 hover:text-white'
          }
        `}
        style={{ WebkitAppRegion: 'no-drag', fontSize: '12px', lineHeight: 1 } as React.CSSProperties}
        title="Close"
      >
        &#215;
      </button>
    </div>
  );
}
