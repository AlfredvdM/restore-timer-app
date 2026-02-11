interface MinimisedWidgetProps {
  displayTime: string;
  phaseColour: string;
  onExpand: () => void;
}

export default function MinimisedWidget({ displayTime, phaseColour, onExpand }: MinimisedWidgetProps) {
  return (
    <div
      onClick={onExpand}
      className="
        h-10 w-full flex items-center justify-between px-3
        bg-gray-900 cursor-pointer select-none
        hover:bg-gray-800 transition-colors duration-150
      "
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Colour indicator dot */}
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: phaseColour }}
        />
        {/* Time */}
        <span
          className="text-sm font-mono font-semibold text-white tracking-wider"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {displayTime}
        </span>
      </div>

      {/* Expand hint */}
      <span className="text-[10px] text-gray-500">Click to expand</span>
    </div>
  );
}
