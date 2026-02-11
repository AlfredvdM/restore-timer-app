import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useDoctorContext } from '../contexts/DoctorContext';
import HistoryTable from './HistoryTable';

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'amber' | 'red' | 'slate';
}) {
  const accentColor = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-500',
    slate: 'text-gray-700',
  }[accent ?? 'slate'];

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 px-4 py-3.5 flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium truncate">
        {label}
      </span>
      <span className={`text-[22px] font-semibold leading-tight ${accentColor} font-mono tabular-nums`}>
        {value}
      </span>
      {sub && (
        <span className="text-[11px] text-gray-400 truncate">{sub}</span>
      )}
    </div>
  );
}

export default function HistoryView() {
  const { activeDoctor, allDoctors } = useDoctorContext();
  const [selectedDoctorSlug, setSelectedDoctorSlug] = useState<string | 'all'>(
    activeDoctor?.slug ?? 'all',
  );

  const statsDoctor = selectedDoctorSlug === 'all' ? null : selectedDoctorSlug;

  const stats = useQuery(
    api.consultations.getTodayStats,
    statsDoctor ? { doctorId: statsDoctor } : 'skip',
  );

  const loading = statsDoctor ? stats === undefined : false;
  const displayName =
    selectedDoctorSlug === 'all'
      ? 'All Doctors'
      : allDoctors.find((d) => d.slug === selectedDoctorSlug)?.name ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
              Consultation History
            </h1>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {displayName} &middot; RESTORE Health &amp; Care
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Doctor filter */}
            <select
              value={selectedDoctorSlug}
              onChange={(e) => setSelectedDoctorSlug(e.target.value)}
              className="text-[13px] text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-gray-50/50"
            >
              {allDoctors.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
              <option value="all">All Doctors</option>
            </select>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
        </div>
      </header>

      {/* Stats Bar — only shown when a specific doctor is selected */}
      {statsDoctor && (
        <div className="px-6 pt-5 pb-1 shrink-0">
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Today's Consultations"
              value={loading ? '—' : String(stats!.totalConsultations)}
              accent="slate"
            />
            <StatCard
              label="Avg. Duration"
              value={loading ? '—' : formatDuration(stats!.averageDurationSeconds)}
              accent="slate"
            />
            <StatCard
              label="On Time"
              value={loading ? '—' : `${stats!.percentOnTime}%`}
              sub={loading ? undefined : `${100 - stats!.percentOnTime}% overtime`}
              accent={
                loading
                  ? 'slate'
                  : stats!.percentOnTime >= 70
                    ? 'emerald'
                    : stats!.percentOnTime >= 40
                      ? 'amber'
                      : 'red'
              }
            />
            <StatCard
              label="Most Used Type"
              value={
                loading
                  ? '—'
                  : stats!.mostUsedAppointmentType
                    ? stats!.mostUsedAppointmentType
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c: string) => c.toUpperCase())
                    : 'None'
              }
              accent="slate"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 px-6 py-4 min-h-0">
        <HistoryTable
          doctorSlug={selectedDoctorSlug === 'all' ? null : selectedDoctorSlug}
          showDoctorColumn={selectedDoctorSlug === 'all'}
        />
      </div>
    </div>
  );
}
