import { useState } from 'react';

interface ApprovalScreenProps {
  patientName: string;
  appointmentType: string;
  targetDuration: string;
  actualDuration: string;
  overtimeAmount: string | null;
  pausedDuration?: string;
  onSave: (notes: string) => void;
  onDiscard: () => void;
  onBack: () => void;
}

export default function ApprovalScreen({
  patientName,
  appointmentType,
  targetDuration,
  actualDuration,
  overtimeAmount,
  pausedDuration,
  onSave,
  onDiscard,
  onBack,
}: ApprovalScreenProps) {
  const [notes, setNotes] = useState('');

  return (
    <div className="px-4 pb-4 flex flex-col gap-3">
      {/* Header */}
      <div className="text-center pt-1 pb-2">
        <h2 className="text-sm font-semibold text-gray-800">Consultation Summary</h2>
      </div>

      {/* Summary rows */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
        {patientName && (
          <div className="flex justify-between items-center px-3 py-2.5">
            <span className="text-[11px] uppercase tracking-wider text-gray-400">Patient</span>
            <span className="text-sm font-medium text-gray-800">{patientName}</span>
          </div>
        )}
        <div className="flex justify-between items-center px-3 py-2.5">
          <span className="text-[11px] uppercase tracking-wider text-gray-400">Type</span>
          <span className="text-sm text-gray-700">{appointmentType}</span>
        </div>
        <div className="flex justify-between items-center px-3 py-2.5">
          <span className="text-[11px] uppercase tracking-wider text-gray-400">Target</span>
          <span className="text-sm font-mono text-gray-700">{targetDuration}</span>
        </div>
        <div className="flex justify-between items-center px-3 py-2.5">
          <span className="text-[11px] uppercase tracking-wider text-gray-400">Actual</span>
          <span className="text-sm font-mono font-medium text-gray-800">{actualDuration}</span>
        </div>
        {overtimeAmount && (
          <div className="flex justify-between items-center px-3 py-2.5">
            <span className="text-[11px] uppercase tracking-wider text-red-400">Overtime</span>
            <span className="text-sm font-mono font-semibold text-red-600">+{overtimeAmount}</span>
          </div>
        )}
        {pausedDuration && (
          <div className="flex justify-between items-center px-3 py-2.5">
            <span className="text-[11px] uppercase tracking-wider text-gray-400">Paused</span>
            <span className="text-sm font-mono text-gray-500">{pausedDuration}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium block mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add consultation notes..."
          rows={3}
          className="
            w-full px-3 py-2 rounded-lg resize-none
            bg-gray-50 border border-gray-200
            text-sm text-gray-800 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            transition-all duration-150
          "
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSave(notes)}
          className="
            flex-1 py-2.5 rounded-xl
            bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800
            text-white text-sm font-medium
            transition-colors duration-150
          "
        >
          Save
        </button>
        <button
          onClick={onBack}
          className="
            px-3 py-2.5 rounded-xl
            text-gray-500 hover:text-gray-700 hover:bg-gray-100
            text-sm font-medium
            transition-colors duration-150
          "
        >
          Back
        </button>
        <button
          onClick={onDiscard}
          className="
            px-3 py-2.5 rounded-xl
            text-red-500 hover:text-red-700 hover:bg-red-50
            text-sm font-medium
            transition-colors duration-150
          "
        >
          Discard
        </button>
      </div>
    </div>
  );
}
