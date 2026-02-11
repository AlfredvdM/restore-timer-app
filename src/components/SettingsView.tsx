import { useState, useRef, useEffect } from 'react';
import { playChime, CHIME_OPTIONS } from '../lib/sound';
import type { ChimeType } from '../lib/sound';

interface SettingsViewProps {
  settings: {
    soundEnabled: boolean;
    soundVolume: number;
    chimeType?: string;
    yellowThreshold: number;
    redThreshold: number;
    alwaysOnTop: boolean;
    defaultAppointmentType?: string;
  };
  appointmentTypes: Array<{
    _id: string;
    name: string;
    code: string;
    defaultDurationMinutes: number;
    isActive: boolean;
    sortOrder: number;
  }>;
  activeAppointmentTypes: Array<{
    name: string;
    code: string;
    defaultDurationMinutes: number;
  }>;
  onUpdateSetting: (field: string, value: boolean | number | string) => void;
  onUpsertType: (data: {
    id?: string;
    name: string;
    code: string;
    defaultDurationMinutes: number;
    colour?: string;
    isActive: boolean;
    sortOrder: number;
  }) => void;
  onToggleType: (id: string) => void;
  onReorderTypes: (orderedIds: string[]) => void;
  doctorName?: string;
  onSwitchDoctor?: () => void;
  onDeleteProfile?: () => void;
  onDone: () => void;
}

// ── Toggle Switch ────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-[20px] w-[36px] shrink-0 rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${checked ? 'bg-emerald-500' : 'bg-gray-300'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-[16px] w-[16px] rounded-full
          bg-white shadow-sm transform transition-transform duration-200 ease-in-out
          mt-[2px]
          ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}
        `}
      />
    </button>
  );
}

// ── Section Label ────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-1.5">
      {children}
    </p>
  );
}

// ── Divider ──────────────────────────────────────
function Divider() {
  return <div className="h-px bg-gray-100 my-2.5" />;
}

export default function SettingsView({
  settings,
  appointmentTypes,
  activeAppointmentTypes,
  onUpdateSetting,
  onUpsertType,
  onToggleType,
  onReorderTypes,
  doctorName,
  onSwitchDoctor,
  onDeleteProfile,
  onDone,
}: SettingsViewProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState(15);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState(15);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Local state for threshold inputs — committed on blur/Enter
  const [yellowInput, setYellowInput] = useState(String(Math.round(settings.yellowThreshold * 100)));
  const [redInput, setRedInput] = useState(String(Math.round(settings.redThreshold * 100)));

  // Sync local inputs when settings change externally
  useEffect(() => {
    setYellowInput(String(Math.round(settings.yellowThreshold * 100)));
  }, [settings.yellowThreshold]);
  useEffect(() => {
    setRedInput(String(Math.round(settings.redThreshold * 100)));
  }, [settings.redThreshold]);

  const activeCount = appointmentTypes.filter((t) => t.isActive).length;
  const selectedChime = (settings.chimeType as ChimeType) || 'gentle-bell';

  // Auto-resize window when manage section opens/closes
  useEffect(() => {
    if (manageOpen) {
      // Taller window for expanded appointment types
      window.electronAPI?.setWindowSize(320, 700);
    } else {
      window.electronAPI?.setWindowSize(320, 520);
    }
  }, [manageOpen]);

  // ── Threshold commit helpers ─────────────────
  const commitYellow = () => {
    const parsed = parseInt(yellowInput);
    if (isNaN(parsed)) {
      setYellowInput(String(Math.round(settings.yellowThreshold * 100)));
      return;
    }
    const clamped = Math.max(10, Math.min(89, parsed));
    setYellowInput(String(clamped));
    onUpdateSetting('yellowThreshold', clamped / 100);
    // If red is now <= yellow, bump it
    const currentRed = Math.round(settings.redThreshold * 100);
    if (currentRed <= clamped) {
      const newRed = Math.min(99, clamped + 1);
      setRedInput(String(newRed));
      onUpdateSetting('redThreshold', newRed / 100);
    }
  };

  const commitRed = () => {
    const parsed = parseInt(redInput);
    if (isNaN(parsed)) {
      setRedInput(String(Math.round(settings.redThreshold * 100)));
      return;
    }
    const yellowPctNow = Math.round(settings.yellowThreshold * 100);
    const clamped = Math.max(yellowPctNow + 1, Math.min(99, parsed));
    setRedInput(String(clamped));
    onUpdateSetting('redThreshold', clamped / 100);
  };

  // ── Handlers ─────────────────────────────────
  const handleAddType = () => {
    const trimmed = newName.trim();
    if (!trimmed || newDuration < 1) return;
    const code = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const maxOrder = appointmentTypes.reduce((m, t) => Math.max(m, t.sortOrder), 0);
    onUpsertType({
      name: trimmed,
      code,
      defaultDurationMinutes: newDuration,
      isActive: true,
      sortOrder: maxOrder + 1,
    });
    setNewName('');
    setNewDuration(15);
  };

  const handleSaveEdit = (type: (typeof appointmentTypes)[0]) => {
    const trimmed = editName.trim();
    if (!trimmed || editDuration < 1) return;
    onUpsertType({
      id: type._id,
      name: trimmed,
      code: type.code,
      defaultDurationMinutes: editDuration,
      isActive: type.isActive,
      sortOrder: type.sortOrder,
    });
    setEditingId(null);
  };

  const handleStartEdit = (type: (typeof appointmentTypes)[0]) => {
    setEditingId(type._id);
    setEditName(type.name);
    setEditDuration(type.defaultDurationMinutes);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= appointmentTypes.length) return;
    const ids = appointmentTypes.map((t) => t._id);
    [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
    onReorderTypes(ids);
  };

  const handleToggle = (type: (typeof appointmentTypes)[0]) => {
    if (type.isActive && activeCount <= 1) return;
    onToggleType(type._id);
  };

  // Volume as 0-100 integer for display
  const volumePercent = Math.round(settings.soundVolume * 100);

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 28px)' }}>
      {/* ── Header ──────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-1 pb-2 shrink-0">
        <h2 className="text-sm font-semibold text-gray-800">Settings</h2>
        <button
          onClick={onDone}
          className="
            flex items-center gap-1 px-2.5 py-1 rounded-lg
            text-[12px] font-medium text-emerald-600
            hover:bg-emerald-50 active:bg-emerald-100
            transition-colors duration-150
          "
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Done
        </button>
      </div>

      {/* ── Scrollable Content ──────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-6">

        {/* ── Doctor Profile ────────────────────── */}
        {doctorName && (
          <>
            <SectionLabel>Doctor Profile</SectionLabel>
            <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-[13px] text-gray-700 font-medium">{doctorName}</span>
                <div className="flex items-center gap-1">
                  {onSwitchDoctor && (
                    <button
                      onClick={onSwitchDoctor}
                      className="
                        text-[11px] font-medium text-emerald-600
                        hover:text-emerald-700 hover:bg-emerald-50
                        px-2 py-1 rounded-md
                        transition-colors duration-150
                      "
                    >
                      Switch
                    </button>
                  )}
                  {onDeleteProfile && (
                    <button
                      onClick={onDeleteProfile}
                      className="
                        text-[11px] font-medium text-red-400
                        hover:text-red-600 hover:bg-red-50
                        px-2 py-1 rounded-md
                        transition-colors duration-150
                      "
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
            <Divider />
          </>
        )}

        {/* ── Sound ─────────────────────────────── */}
        <SectionLabel>Sound</SectionLabel>
        <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
          {/* Sound enabled */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-[13px] text-gray-700">Alert chime</span>
            <Toggle
              checked={settings.soundEnabled}
              onChange={(v) => onUpdateSetting('soundEnabled', v)}
            />
          </div>

          {/* Chime type selector */}
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[13px] ${settings.soundEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                Chime sound
              </span>
            </div>
            <div className="flex gap-1.5">
              {CHIME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  disabled={!settings.soundEnabled}
                  onClick={() => {
                    onUpdateSetting('chimeType', opt.id);
                    if (settings.soundEnabled) {
                      playChime(settings.soundVolume, opt.id);
                    }
                  }}
                  className={`
                    flex-1 py-1.5 rounded-lg text-[11px] font-medium
                    transition-all duration-150
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${selectedChime === opt.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Volume */}
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[13px] ${settings.soundEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                Volume
              </span>
              <span className={`text-[11px] font-mono tabular-nums ${settings.soundEnabled ? 'text-gray-500' : 'text-gray-300'}`}>
                {volumePercent}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={volumePercent}
                disabled={!settings.soundEnabled}
                onChange={(e) => onUpdateSetting('soundVolume', parseInt(e.target.value) / 100)}
                className="
                  flex-1 h-[4px] rounded-full appearance-none cursor-pointer
                  bg-gray-200 accent-emerald-500
                  disabled:opacity-40 disabled:cursor-not-allowed
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-[14px]
                  [&::-webkit-slider-thumb]:h-[14px]
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-emerald-500
                  [&::-webkit-slider-thumb]:shadow-sm
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:disabled:cursor-not-allowed
                "
              />
              <button
                disabled={!settings.soundEnabled}
                onClick={() => playChime(settings.soundVolume, selectedChime)}
                className="
                  shrink-0 px-2 py-1 rounded-md
                  text-[11px] font-medium
                  bg-white border border-gray-200 text-gray-600
                  hover:border-emerald-300 hover:text-emerald-600
                  active:bg-emerald-50
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600
                  transition-colors duration-150
                "
                title="Test chime"
              >
                Test
              </button>
            </div>
          </div>
        </div>

        <Divider />

        {/* ── Window ────────────────────────────── */}
        <SectionLabel>Window</SectionLabel>
        <div className="rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-[13px] text-gray-700">Always on top</span>
            <Toggle
              checked={settings.alwaysOnTop}
              onChange={(v) => {
                onUpdateSetting('alwaysOnTop', v);
                window.electronAPI?.setAlwaysOnTop(v);
              }}
            />
          </div>
        </div>

        <Divider />

        {/* ── Colour Thresholds ─────────────────── */}
        <SectionLabel>Colour Thresholds</SectionLabel>
        <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-[13px] text-gray-700">Green → Yellow</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                value={yellowInput}
                onChange={(e) => setYellowInput(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commitYellow}
                onKeyDown={(e) => e.key === 'Enter' && commitYellow()}
                className="
                  w-[44px] px-1.5 py-0.5 rounded-md text-center
                  bg-white border border-gray-200
                  text-[13px] font-mono text-gray-700
                  focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-400
                  transition-all duration-150
                "
              />
              <span className="text-[11px] text-gray-400">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[13px] text-gray-700">Yellow → Red</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                value={redInput}
                onChange={(e) => setRedInput(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commitRed}
                onKeyDown={(e) => e.key === 'Enter' && commitRed()}
                className="
                  w-[44px] px-1.5 py-0.5 rounded-md text-center
                  bg-white border border-gray-200
                  text-[13px] font-mono text-gray-700
                  focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-400
                  transition-all duration-150
                "
              />
              <span className="text-[11px] text-gray-400">%</span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 px-1">
          Percentage of elapsed time before colour shifts
        </p>

        <Divider />

        {/* ── Default Type ──────────────────────── */}
        <SectionLabel>Default Appointment Type</SectionLabel>
        <select
          value={settings.defaultAppointmentType ?? 'standard'}
          onChange={(e) => onUpdateSetting('defaultAppointmentType', e.target.value)}
          className="
            w-full px-3 py-2 rounded-lg
            bg-gray-50 border border-gray-200
            text-[13px] text-gray-700
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            transition-all duration-150 appearance-none
            bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')]
            bg-no-repeat bg-[position:right_12px_center]
          "
        >
          {activeAppointmentTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>

        <Divider />

        {/* ── Manage Appointment Types ──────────── */}
        <button
          onClick={() => setManageOpen(!manageOpen)}
          className="
            w-full flex items-center justify-between px-1 py-1
            text-left group
          "
        >
          <SectionLabel>Manage Appointment Types</SectionLabel>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`
              text-gray-400 transition-transform duration-200
              ${manageOpen ? 'rotate-180' : ''}
            `}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {manageOpen && (
          <div className="space-y-1.5 mt-1">
            {appointmentTypes.map((type, index) => (
              <div
                key={type._id}
                className={`
                  rounded-lg border px-2.5 py-2
                  ${type.isActive
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50/50 border-gray-100 opacity-60'
                  }
                `}
              >
                {editingId === type._id ? (
                  /* ── Editing mode ─────────────── */
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="
                        w-full px-2 py-1 rounded-md
                        bg-gray-50 border border-gray-200
                        text-[12px] text-gray-800
                        focus:outline-none focus:ring-1 focus:ring-emerald-500/30
                      "
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={editDuration}
                        onChange={(e) => setEditDuration(Math.max(1, parseInt(e.target.value) || 1))}
                        className="
                          w-16 px-2 py-1 rounded-md text-center
                          bg-gray-50 border border-gray-200
                          text-[12px] font-mono text-gray-800
                          focus:outline-none focus:ring-1 focus:ring-emerald-500/30
                        "
                      />
                      <span className="text-[11px] text-gray-400">min</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => handleSaveEdit(type)}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-0.5 rounded-md text-[11px] text-gray-400 hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Display mode ─────────────── */
                  <div className="flex items-center gap-1.5">
                    {/* Reorder arrows */}
                    <div className="flex flex-col shrink-0">
                      <button
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-30 disabled:hover:text-gray-300 p-0 leading-none transition-colors"
                        style={{ fontSize: '10px' }}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMove(index, 1)}
                        disabled={index === appointmentTypes.length - 1}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-30 disabled:hover:text-gray-300 p-0 leading-none transition-colors"
                        style={{ fontSize: '10px' }}
                      >
                        ▼
                      </button>
                    </div>

                    {/* Name + duration */}
                    <button
                      onClick={() => handleStartEdit(type)}
                      className="flex-1 text-left min-w-0 group/edit"
                    >
                      <span className="text-[12px] text-gray-700 group-hover/edit:text-emerald-600 transition-colors truncate block">
                        {type.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {type.defaultDurationMinutes} min
                      </span>
                    </button>

                    {/* Active/inactive badge + toggle */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`
                          text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full
                          ${type.isActive
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-gray-100 text-gray-400'
                          }
                        `}
                      >
                        {type.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <Toggle
                        checked={type.isActive}
                        onChange={() => handleToggle(type)}
                        disabled={type.isActive && activeCount <= 1}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* ── Add new type ────────────────── */}
            <div className="rounded-lg border border-dashed border-gray-200 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New type name"
                  className="
                    flex-1 min-w-0 px-2 py-1 rounded-md
                    bg-gray-50 border border-gray-200
                    text-[12px] text-gray-800 placeholder-gray-400
                    focus:outline-none focus:ring-1 focus:ring-emerald-500/30
                  "
                  onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
                />
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="
                    w-12 px-1.5 py-1 rounded-md text-center
                    bg-gray-50 border border-gray-200
                    text-[12px] font-mono text-gray-800
                    focus:outline-none focus:ring-1 focus:ring-emerald-500/30
                  "
                />
                <span className="text-[10px] text-gray-400 shrink-0">min</span>
                <button
                  onClick={handleAddType}
                  disabled={!newName.trim()}
                  className="
                    shrink-0 px-2.5 py-1 rounded-lg
                    bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800
                    text-white text-[11px] font-medium
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-colors duration-150
                  "
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom spacing for scroll comfort */}
        <div className="h-4" />
      </div>
    </div>
  );
}
