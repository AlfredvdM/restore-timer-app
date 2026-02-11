import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface DoctorSetupProps {
  hasDoctors: boolean;
  onCreated: (slug: string) => void;
  onCancel: () => void;
}

export default function DoctorSetup({ hasDoctors, onCreated, onCancel }: DoctorSetupProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const createDoctor = useMutation(api.doctors.createDoctor);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError('');
    try {
      await createDoctor({ name: trimmed });
      // Generate slug the same way as the backend
      const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      onCreated(slug);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-4 pb-3">
      <div className="text-center mb-3">
        <p className="text-[13px] font-semibold text-gray-700 tracking-wide mb-0.5">
          RESTORE Health &amp; Care
        </p>
        <p className="text-[10px] text-gray-400">Create your doctor profile</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="mb-3">
          <label className="block text-[11px] text-gray-500 font-medium mb-1 uppercase tracking-wider">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Dr Jane Smith"'
            autoFocus
            className="
              w-full px-3 py-2.5 rounded-xl
              bg-gray-50 border border-gray-200
              text-[13px] text-gray-800 placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
              transition-all duration-150
            "
          />
          {error && (
            <p className="text-[11px] text-red-500 mt-1">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="
            w-full py-2.5 rounded-xl
            bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800
            text-white text-sm font-medium
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-emerald-500/40
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {saving ? 'Creating...' : 'Create Profile'}
        </button>

        {hasDoctors && (
          <button
            type="button"
            onClick={onCancel}
            className="
              mt-2 w-full py-1.5
              text-[12px] text-gray-400 font-medium
              hover:text-gray-600
              transition-colors duration-150
              focus:outline-none
            "
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
