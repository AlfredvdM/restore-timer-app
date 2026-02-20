import { useState, useMemo } from 'react';

interface MiniCalendarProps {
  selectedDate: string; // "YYYY-MM-DD"
  datesWithData: string[];
  onSelectDate: (date: string) => void;
  loading?: boolean;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function MiniCalendar({
  selectedDate,
  datesWithData,
  onSelectDate,
  loading,
}: MiniCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toISODate(today), [today]);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const dataSet = useMemo(() => new Set(datesWithData), [datesWithData]);

  // Can't navigate past current month
  const canGoForward =
    viewMonth.year < today.getFullYear() ||
    (viewMonth.year === today.getFullYear() && viewMonth.month < today.getMonth());

  const prevMonth = () => {
    setViewMonth((v) => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: v.month - 1 };
    });
  };

  const nextMonth = () => {
    if (!canGoForward) return;
    setViewMonth((v) => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: v.month + 1 };
    });
  };

  const goToToday = () => {
    setViewMonth({ year: today.getFullYear(), month: today.getMonth() });
    onSelectDate(todayStr);
  };

  // Build calendar grid
  const cells = useMemo(() => {
    const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
    // getDay() returns 0=Sun, we want Mon=0
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();

    const grid: { date: Date; dateStr: string; inMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewMonth.year, viewMonth.month, -i);
      grid.push({ date: d, dateStr: toISODate(d), inMonth: false });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewMonth.year, viewMonth.month, day);
      grid.push({ date: d, dateStr: toISODate(d), inMonth: true });
    }

    // Next month padding to fill 6 rows max
    const remaining = 7 - (grid.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(viewMonth.year, viewMonth.month + 1, i);
        grid.push({ date: d, dateStr: toISODate(d), inMonth: false });
      }
    }

    return grid;
  }, [viewMonth]);

  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const isViewingCurrentMonth = isSameMonth(
    new Date(viewMonth.year, viewMonth.month, 1),
    today,
  );

  return (
    <div className="w-[260px] shrink-0 bg-white rounded-xl border border-gray-200/80 p-4 flex flex-col gap-3 select-none h-fit">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[13px] font-semibold text-gray-700">{monthLabel}</span>
        <button
          onClick={nextMonth}
          disabled={!canGoForward}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day of week header */}
      <div className="grid grid-cols-7 gap-0">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-[10px] uppercase text-gray-400 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((cell) => {
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;
          const hasData = dataSet.has(cell.dateStr);
          const isFuture = cell.date > today && !isToday;

          return (
            <button
              key={cell.dateStr}
              onClick={() => {
                if (cell.inMonth && !isFuture) {
                  onSelectDate(cell.dateStr);
                }
              }}
              disabled={!cell.inMonth || isFuture}
              className={`
                aspect-square flex flex-col items-center justify-center rounded-lg text-[12px] relative transition-colors
                ${isSelected
                  ? 'bg-emerald-600 text-white font-semibold'
                  : isToday
                    ? 'ring-1 ring-emerald-400 font-medium text-emerald-700'
                    : !cell.inMonth
                      ? 'text-gray-300 cursor-default'
                      : isFuture
                        ? 'text-gray-300 cursor-default'
                        : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              {cell.date.getDate()}
              {/* Data dot */}
              {hasData && !isSelected && cell.inMonth && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
              )}
              {hasData && isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white/70" />
              )}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      {!isViewingCurrentMonth && (
        <button
          onClick={goToToday}
          className="text-[12px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg py-1.5 transition-colors"
        >
          Today
        </button>
      )}

      {loading && (
        <div className="text-[11px] text-gray-400 text-center">Loading dates...</div>
      )}
    </div>
  );
}
