import { useState } from 'react';

interface ClearHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  doctorName: string | null; // null = all doctors
  consultationCount: number;
}

export default function ClearHistoryDialog({
  isOpen,
  onClose,
  onConfirm,
  doctorName,
  consultationCount,
}: ClearHistoryDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  if (!isOpen) return null;

  const canConfirm = confirmText === 'DELETE' && !clearing;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setClearing(true);
    try {
      await onConfirm();
      setConfirmText('');
      onClose();
    } finally {
      setClearing(false);
    }
  };

  const handleClose = () => {
    if (clearing) return;
    setConfirmText('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-[380px] p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-1">
            Clear All History
          </h3>
          <p className="text-[13px] text-gray-500 leading-relaxed">
            This will permanently delete{' '}
            <span className="font-semibold text-gray-700">
              {consultationCount} consultation{consultationCount !== 1 ? 's' : ''}
            </span>
            {doctorName ? (
              <> for <span className="font-semibold text-gray-700">{doctorName}</span></>
            ) : (
              <> across all doctors</>
            )}
            . This action cannot be undone.
          </p>
        </div>

        {/* Confirm input */}
        <div>
          <label className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-1.5 block">
            Type DELETE to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={clearing}
            className="w-full text-[13px] text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-gray-50/50 placeholder:text-gray-300 disabled:opacity-50"
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleClose}
            disabled={clearing}
            className="flex-1 text-[13px] font-medium text-gray-600 hover:bg-gray-100 rounded-xl py-2.5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {clearing ? 'Clearing...' : 'Clear History'}
          </button>
        </div>
      </div>
    </div>
  );
}
