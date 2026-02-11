import type { Doctor } from '../types';

interface DoctorSelectorProps {
  doctors: Doctor[];
  onSelect: (slug: string) => void;
  onAddNew: () => void;
}

export default function DoctorSelector({ doctors, onSelect, onAddNew }: DoctorSelectorProps) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 28px)' }}>
      <div className="text-center px-4 pt-2 pb-2 shrink-0">
        <p className="text-[13px] font-semibold text-gray-700 tracking-wide mb-0.5">
          RESTORE Health &amp; Care
        </p>
        <p className="text-[10px] text-gray-400">Select your profile</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 min-h-0">
        <div className="space-y-1.5">
          {doctors.map((doctor) => (
            <button
              key={doctor.slug}
              onClick={() => onSelect(doctor.slug)}
              className="
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                bg-gray-50 border border-gray-100
                hover:bg-emerald-50 hover:border-emerald-200
                active:bg-emerald-100
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30
                group
              "
            >
              <div
                className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[13px] font-semibold"
                style={{ backgroundColor: doctor.colour }}
              >
                {doctor.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[13px] text-gray-700 font-medium truncate group-hover:text-emerald-700 transition-colors">
                {doctor.name}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-auto text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 pb-3 shrink-0">
        <button
          onClick={onAddNew}
          className="
            w-full py-2 rounded-xl
            border border-dashed border-gray-300
            text-[12px] text-gray-500 font-medium
            hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50
            active:bg-emerald-100/50
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30
          "
        >
          + Add Doctor
        </button>
      </div>
    </div>
  );
}
