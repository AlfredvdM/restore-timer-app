import { useState, useMemo, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// ── Types ──────────────────────────────────────────────
interface ConsultationRow {
  _id: string;
  completedAt: number;
  patientName?: string;
  doctorName: string;
  appointmentType: string;
  targetDurationSeconds: number;
  actualDurationSeconds: number;
  wentOvertime: boolean;
  overtimeSeconds?: number;
  consultationDate: string;
  startedAt: number;
  status: string;
}

type SortField =
  | 'completedAt'
  | 'patientName'
  | 'doctorName'
  | 'appointmentType'
  | 'targetDurationSeconds'
  | 'actualDurationSeconds'
  | 'wentOvertime'
  | 'overtimeSeconds';

type SortDir = 'asc' | 'desc';

type StatusFilter = 'all' | 'ontime' | 'overtime';

const PAGE_SIZE = 15;

interface HistoryTableProps {
  doctorSlug: string | null;
  showDoctorColumn: boolean;
}

// ── Helpers ────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = days[d.getDay()];
  const date = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${date} ${month} ${year}, ${hours}:${mins}`;
}

function formatTypeName(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Sort arrow icon ────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-flex flex-col ml-1 -space-y-0.5 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
      <svg width="8" height="5" viewBox="0 0 8 5" className={active && dir === 'asc' ? 'text-emerald-600' : 'text-gray-400'}>
        <path d="M4 0L8 5H0L4 0Z" fill="currentColor" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" className={active && dir === 'desc' ? 'text-emerald-600' : 'text-gray-400'}>
        <path d="M4 5L0 0H8L4 5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

// ── Main Component ─────────────────────────────────────
export default function HistoryTable({ doctorSlug, showDoctorColumn }: HistoryTableProps) {
  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('completedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(0);

  // Convex queries — use the appropriate query based on doctor filter
  const doctorConsultations = useQuery(
    api.consultations.getConsultations,
    doctorSlug
      ? {
          doctorId: doctorSlug,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          appointmentType: typeFilter !== 'all' ? typeFilter : undefined,
        }
      : 'skip',
  );

  const allConsultations = useQuery(
    api.consultations.getAllConsultations,
    !doctorSlug
      ? {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          appointmentType: typeFilter !== 'all' ? typeFilter : undefined,
        }
      : 'skip',
  );

  const rawConsultations = doctorSlug ? doctorConsultations : allConsultations;

  const appointmentTypes = useQuery(api.appointmentTypes.getActiveAppointmentTypes);
  const loading = rawConsultations === undefined;

  // Filter by status (client-side since Convex doesn't index it)
  const filteredData = useMemo(() => {
    if (!rawConsultations) return [];
    let data = [...rawConsultations] as ConsultationRow[];
    if (statusFilter === 'ontime') {
      data = data.filter((c) => !c.wentOvertime);
    } else if (statusFilter === 'overtime') {
      data = data.filter((c) => c.wentOvertime);
    }
    return data;
  }, [rawConsultations, statusFilter]);

  // Sort
  const sortedData = useMemo(() => {
    const data = [...filteredData];
    data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'completedAt':
          cmp = a.completedAt - b.completedAt;
          break;
        case 'patientName':
          cmp = (a.patientName ?? '').localeCompare(b.patientName ?? '');
          break;
        case 'doctorName':
          cmp = a.doctorName.localeCompare(b.doctorName);
          break;
        case 'appointmentType':
          cmp = a.appointmentType.localeCompare(b.appointmentType);
          break;
        case 'targetDurationSeconds':
          cmp = a.targetDurationSeconds - b.targetDurationSeconds;
          break;
        case 'actualDurationSeconds':
          cmp = a.actualDurationSeconds - b.actualDurationSeconds;
          break;
        case 'wentOvertime':
          cmp = Number(a.wentOvertime) - Number(b.wentOvertime);
          break;
        case 'overtimeSeconds':
          cmp = (a.overtimeSeconds ?? 0) - (b.overtimeSeconds ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [filteredData, sortField, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pageData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const resetPage = useCallback(() => setPage(0), []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'completedAt' ? 'desc' : 'asc');
    }
    resetPage();
  };

  // ── CSV Export ─────────────────────────────────────
  const exportCSV = () => {
    const headers = [
      'Date & Time',
      ...(showDoctorColumn ? ['Doctor'] : []),
      'Patient Name',
      'Appointment Type',
      'Target (mm:ss)',
      'Actual (mm:ss)',
      'Status',
      'Overtime (mm:ss)',
    ];

    const rows = sortedData.map((c) => [
      formatDateTime(c.completedAt),
      ...(showDoctorColumn ? [c.doctorName] : []),
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
    a.download = `restore-consultations-${toISODate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Column header helper ──────────────────────────
  const colCount = showDoctorColumn ? 8 : 7;

  const Th = ({
    label,
    field,
    className = '',
  }: {
    label: string;
    field: SortField;
    className?: string;
  }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-3 py-2.5 text-left text-[11px] uppercase tracking-wider text-gray-500 font-semibold cursor-pointer select-none group whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon active={sortField === field} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap shrink-0">
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              resetPage();
            }}
            className="text-[13px] text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-gray-50/50"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              resetPage();
            }}
            className="text-[13px] text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-gray-50/50"
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            resetPage();
          }}
          className="text-[13px] text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-gray-50/50"
        >
          <option value="all">All Types</option>
          {(appointmentTypes ?? []).map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            resetPage();
          }}
          className="text-[13px] text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-gray-50/50"
        >
          <option value="all">All Status</option>
          <option value="ontime">On Time</option>
          <option value="overtime">Overtime</option>
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Count + Export */}
        <span className="text-[12px] text-gray-400">
          {loading ? '...' : `${sortedData.length} consultation${sortedData.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={exportCSV}
          disabled={loading || sortedData.length === 0}
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

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50/80 sticky top-0 z-10">
            <tr>
              <Th label="Date & Time" field="completedAt" className="min-w-[180px]" />
              {showDoctorColumn && <Th label="Doctor" field="doctorName" />}
              <Th label="Patient" field="patientName" />
              <Th label="Type" field="appointmentType" />
              <Th label="Target" field="targetDurationSeconds" />
              <Th label="Actual" field="actualDurationSeconds" />
              <Th label="Status" field="wentOvertime" />
              <Th label="Overtime" field="overtimeSeconds" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: colCount }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
                    </td>
                  ))}
                </tr>
              ))
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-12 text-center text-gray-400 text-sm">
                  No consultations found
                </td>
              </tr>
            ) : (
              pageData.map((c) => (
                <tr
                  key={c._id}
                  className="hover:bg-gray-50/60 transition-colors duration-100"
                >
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                    {formatDateTime(c.completedAt)}
                  </td>
                  {showDoctorColumn && (
                    <td className="px-3 py-2.5 text-gray-600">
                      {c.doctorName}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-gray-700">
                    {c.patientName || (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {formatTypeName(c.appointmentType)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 font-mono tabular-nums">
                    {formatTime(c.targetDurationSeconds)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 font-mono tabular-nums font-medium">
                    {formatTime(c.actualDurationSeconds)}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.wentOvertime ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Overtime
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        On Time
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-gray-500">
                    {c.overtimeSeconds ? (
                      <span className="text-red-500 font-medium">
                        +{formatTime(c.overtimeSeconds)}
                      </span>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-[12px] text-gray-500 shrink-0">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {/* Page number buttons - show at most 5 */}
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => {
                if (totalPages <= 5) return true;
                if (i === 0 || i === totalPages - 1) return true;
                return Math.abs(i - page) <= 1;
              })
              .reduce<(number | 'gap')[]>((acc, curr, idx, arr) => {
                if (idx > 0 && curr - (arr[idx - 1] as number) > 1) {
                  acc.push('gap');
                }
                acc.push(curr);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'gap' ? (
                  <span key={`gap-${idx}`} className="px-1 text-gray-300">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`w-7 h-7 rounded-md text-center transition-colors ${
                      page === item
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {item + 1}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
