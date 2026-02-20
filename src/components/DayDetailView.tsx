import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface DayDetailViewProps {
  date: string; // "YYYY-MM-DD"
  doctorSlug: string | null; // null = all doctors
  showDoctorName: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatClockTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatTypeName(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function DayDetailView({ date, doctorSlug, showDoctorName }: DayDetailViewProps) {
  const doctorConsultations = useQuery(
    api.consultations.getConsultations,
    doctorSlug
      ? { doctorId: doctorSlug, startDate: date, endDate: date }
      : 'skip',
  );

  const allConsultations = useQuery(
    api.consultations.getAllConsultations,
    !doctorSlug
      ? { startDate: date, endDate: date }
      : 'skip',
  );

  const consultations = doctorSlug ? doctorConsultations : allConsultations;
  const loading = consultations === undefined;

  const sorted = useMemo(() => {
    if (!consultations) return [];
    return [...consultations].sort((a, b) => b.completedAt - a.completedAt);
  }, [consultations]);

  // CSV export for the day
  const exportCSV = () => {
    const headers = [
      'Time',
      ...(showDoctorName ? ['Doctor'] : []),
      'Patient Name',
      'Appointment Type',
      'Target (mm:ss)',
      'Actual (mm:ss)',
      'Status',
      'Overtime (mm:ss)',
    ];

    const rows = sorted.map((c) => [
      formatClockTime(c.completedAt),
      ...(showDoctorName ? [c.doctorName] : []),
      c.patientName || '—',
      formatTypeName(c.appointmentType),
      formatTime(c.targetDurationSeconds),
      formatTime(c.actualDurationSeconds),
      c.wentOvertime ? 'Overtime' : 'On Time',
      c.overtimeSeconds ? formatTime(c.overtimeSeconds) : '—',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restore-consultations-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-800">
            {formatDateHeader(date)}
          </h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {loading ? '...' : `${sorted.length} consultation${sorted.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={loading || sorted.length === 0}
          className="
            inline-flex items-center gap-1.5 text-[12px] font-medium
            text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200
            rounded-lg px-3 py-1.5 transition-colors duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30
          "
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5 overflow-auto">
        {loading ? (
          // Skeleton cards
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200/80 px-4 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-32" />
                <div className="h-5 bg-gray-100 rounded-full animate-pulse w-16" />
              </div>
              <div className="h-3.5 bg-gray-100 rounded animate-pulse w-48 mb-1.5" />
              <div className="h-3.5 bg-gray-100 rounded animate-pulse w-40" />
            </div>
          ))
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-gray-300">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-[13px]">No consultations on this day</span>
          </div>
        ) : (
          sorted.map((c) => (
            <div
              key={c._id}
              className="bg-white rounded-xl border border-gray-200/80 px-4 py-3.5 hover:border-gray-300/80 transition-colors"
            >
              {/* Top row: patient + status */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-medium text-gray-800 truncate">
                    {c.patientName || <span className="text-gray-400 italic">No patient name</span>}
                  </span>
                  {showDoctorName && (
                    <span className="text-[11px] text-gray-400 truncate">
                      &middot; {c.doctorName}
                    </span>
                  )}
                </div>
                {c.wentOvertime ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Overtime
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    On Time
                  </span>
                )}
              </div>

              {/* Detail row: type + time */}
              <div className="flex items-center gap-2 text-[12px] text-gray-500 mb-1">
                <span className="text-gray-400">{formatTypeName(c.appointmentType)}</span>
                <span className="text-gray-300">|</span>
                <span className="font-mono tabular-nums">
                  {formatClockTime(c.startedAt)} — {formatClockTime(c.completedAt)}
                </span>
              </div>

              {/* Duration row */}
              <div className="flex items-center gap-3 text-[12px]">
                <span className="text-gray-500 font-mono tabular-nums">
                  Target: {formatTime(c.targetDurationSeconds)}
                </span>
                <span className="text-gray-700 font-mono tabular-nums font-medium">
                  Actual: {formatTime(c.actualDurationSeconds)}
                </span>
                {c.overtimeSeconds && c.overtimeSeconds > 0 && (
                  <span className="text-red-500 font-mono tabular-nums font-medium">
                    +{formatTime(c.overtimeSeconds)} over
                  </span>
                )}
              </div>

              {/* Notes */}
              {c.notes && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[12px] italic text-gray-500 leading-relaxed">{c.notes}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
