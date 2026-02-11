import type { Doctor } from '../types';

interface DoctorBadgeProps {
  doctor: Doctor;
  clickable: boolean;
  onClick?: () => void;
}

export default function DoctorBadge({ doctor, clickable, onClick }: DoctorBadgeProps) {
  const content = (
    <>
      {/* Coloured dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: doctor.colour }}
      />
      <span className="text-[11px] text-gray-500 font-medium truncate">
        {doctor.name}
      </span>
      {clickable && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-300 shrink-0"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
    </>
  );

  if (clickable) {
    return (
      <button
        onClick={onClick}
        className="
          inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
          bg-gray-50 border border-gray-100
          hover:bg-gray-100 hover:border-gray-200
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-emerald-500/30
          max-w-full
        "
        title="Switch doctor"
      >
        {content}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 max-w-full">
      {content}
    </span>
  );
}
