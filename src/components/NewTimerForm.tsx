import { useState } from 'react';

interface AppointmentTypeOption {
  name: string;
  code: string;
  defaultDurationMinutes: number;
}

interface NewTimerFormProps {
  appointmentTypes: AppointmentTypeOption[];
  defaultTypeCode?: string;
  onStart: (data: { patientName: string; typeCode: string; durationMinutes: number }) => void;
  onCancel: () => void;
}

export default function NewTimerForm({ appointmentTypes, defaultTypeCode, onStart, onCancel }: NewTimerFormProps) {
  const [patientName, setPatientName] = useState('');
  const [selectedType, setSelectedType] = useState(defaultTypeCode ?? 'standard');
  const [customMinutes, setCustomMinutes] = useState(15);

  const selectedOption = appointmentTypes.find((t) => t.code === selectedType);
  const isCustom = selectedType === 'custom';
  const durationMinutes = isCustom ? customMinutes : (selectedOption?.defaultDurationMinutes ?? 15);

  const handleStart = () => {
    onStart({
      patientName: patientName.trim(),
      typeCode: selectedType,
      durationMinutes,
    });
  };

  return (
    <div className="px-4 pb-4 flex flex-col gap-3">
      {/* Patient name */}
      <div>
        <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium block mb-1">
          Patient
        </label>
        <input
          type="text"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder="Patient name (optional)"
          className="
            w-full px-3 py-2 rounded-lg
            bg-gray-50 border border-gray-200
            text-sm text-gray-800 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            transition-all duration-150
          "
        />
      </div>

      {/* Appointment type */}
      <div>
        <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium block mb-1">
          Type
        </label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="
            w-full px-3 py-2 rounded-lg
            bg-gray-50 border border-gray-200
            text-sm text-gray-800
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            transition-all duration-150 appearance-none
            bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')]
            bg-no-repeat bg-[position:right_12px_center]
          "
        >
          {appointmentTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}{t.code !== 'custom' ? ` (${t.defaultDurationMinutes} min)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Duration */}
      <div>
        <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium block mb-1">
          Duration
        </label>
        {isCustom ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={customMinutes}
              onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value) || 1))}
              className="
                w-20 px-3 py-2 rounded-lg text-center
                bg-gray-50 border border-gray-200
                text-sm text-gray-800 font-mono
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                transition-all duration-150
              "
            />
            <span className="text-sm text-gray-500">minutes</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <span className="text-sm font-mono text-gray-700 font-medium">
              {String(durationMinutes).padStart(2, '0')}:00
            </span>
            <span className="text-xs text-gray-400">({durationMinutes} min)</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleStart}
          className="
            flex-1 py-2.5 rounded-xl
            bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800
            text-white text-sm font-medium
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-emerald-500/40
          "
        >
          Start Timer
        </button>
        <button
          onClick={onCancel}
          className="
            px-4 py-2.5 rounded-xl
            text-gray-500 hover:text-gray-700 hover:bg-gray-100
            text-sm font-medium
            transition-colors duration-150
          "
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
