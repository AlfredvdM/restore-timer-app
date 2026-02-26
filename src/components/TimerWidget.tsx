import { useState, useEffect, useRef } from 'react';
import { useAuthMutation } from '../hooks/useAuthConvex';
import { api } from '../../convex/_generated/api';
import { STATE_MIN_HEIGHTS, STATE_MIN_WIDTHS } from '../types';
import type { WidgetState } from '../types';
import { useDoctorContext } from '../contexts/DoctorContext';
import { useTimer } from '../hooks/useTimer';
import { useConvexData } from '../hooks/useConvexData';
import CustomTitleBar from './CustomTitleBar';
import TimerDisplay from './TimerDisplay';
import TimerControls from './TimerControls';
import NewTimerForm from './NewTimerForm';
import ApprovalScreen from './ApprovalScreen';
import MinimisedWidget from './MinimisedWidget';
import OfflineIndicator from './OfflineIndicator';
import SettingsView from './SettingsView';
import DoctorSelector from './DoctorSelector';
import DoctorSetup from './DoctorSetup';
import DoctorBadge from './DoctorBadge';

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function TimerWidget() {
  const { activeDoctor, allDoctors, isLoading: doctorsLoading, selectDoctor, clearDoctor } = useDoctorContext();
  const [showAddDoctor, setShowAddDoctor] = useState(false);

  const {
    appointmentTypes,
    allAppointmentTypes,
    settings,
    settingsLoaded,
    isOffline,
    saveConsultationData,
    updateSetting,
    upsertAppointmentType,
    toggleAppointmentType,
    reorderAppointmentTypes,
  } = useConvexData(activeDoctor?.slug ?? null);

  const deleteDoctor = useAuthMutation(api.doctors.deleteDoctor);
  const [showSettings, setShowSettings] = useState(false);

  const timer = useTimer({
    soundEnabled: settings.soundEnabled,
    soundVolume: settings.soundVolume,
    chimeType: settings.chimeType,
    yellowThreshold: settings.yellowThreshold,
    redThreshold: settings.redThreshold,
  });

  const prevStateRef = useRef<WidgetState | null>(null);
  const preSettingsSizeRef = useRef<{ width: number; height: number } | null>(null);
  const updateWindowPositionMutation = useAuthMutation(api.settings.updateWindowPosition);

  // ── Determine if we need to show doctor selection ──
  const needsDoctorSelect = !activeDoctor && !doctorsLoading;
  const noDoctorsExist = needsDoctorSelect && allDoctors.length === 0;

  // ── Resize for doctor selection screen ─────────
  useEffect(() => {
    if (showAddDoctor) {
      window.electronAPI?.setWindowSize(STATE_MIN_WIDTHS.doctorSelect, STATE_MIN_HEIGHTS.doctorSelect);
    } else if (needsDoctorSelect) {
      // 28px title bar + 50px header + 52px per doctor row + 48px "Add Doctor" button + 12px bottom
      const contentHeight = 138 + allDoctors.length * 52;
      // Cap at 400px — the list scrolls beyond that
      window.electronAPI?.setWindowSize(STATE_MIN_WIDTHS.doctorSelect, Math.max(STATE_MIN_HEIGHTS.doctorSelect, Math.min(400, contentHeight)));
    }
  }, [needsDoctorSelect, showAddDoctor, allDoctors.length]);

  // ── Apply always-on-top from settings ───────────
  useEffect(() => {
    if (settings.alwaysOnTop !== undefined) {
      window.electronAPI?.setAlwaysOnTop(settings.alwaysOnTop);
    }
  }, [settings.alwaysOnTop]);

  // ── Save window position when moved (debounced to Convex) ──
  useEffect(() => {
    if (!activeDoctor) return;
    const slug = activeDoctor.slug;
    const handler = (position: { x: number; y: number }) => {
      updateWindowPositionMutation({
        userId: slug,
        x: position.x,
        y: position.y,
      }).catch(() => {});
    };

    window.electronAPI?.onWindowMoved(handler);
    return () => {
      window.electronAPI?.removeAllListeners('window-moved');
    };
  }, [updateWindowPositionMutation, activeDoctor]);

  // ── Notify main process of timer running state ──
  useEffect(() => {
    const isRunning =
      timer.widgetState === 'running' ||
      timer.widgetState === 'paused' ||
      timer.widgetState === 'overtime';
    window.electronAPI?.setTimerRunning(isRunning);
  }, [timer.widgetState]);

  // ── Notify main process of active doctor ──
  useEffect(() => {
    window.electronAPI?.setActiveDoctor(activeDoctor?.name ?? null);
  }, [activeDoctor]);

  // ── Handle tray menu navigation ─────────────────
  useEffect(() => {
    const handler = (target: string) => {
      if (target === 'new-consultation') {
        if (timer.widgetState === 'idle' && activeDoctor) {
          timer.goToSetup();
        }
      } else if (target === 'settings') {
        if (timer.widgetState === 'idle' && activeDoctor) {
          preSettingsSizeRef.current = { width: window.outerWidth, height: window.outerHeight };
          window.electronAPI?.setWindowMinSize(STATE_MIN_WIDTHS.settings, STATE_MIN_HEIGHTS.settings);
          setShowSettings(true);
        }
      } else if (target === 'switch-doctor') {
        const isRunning =
          timer.widgetState === 'running' ||
          timer.widgetState === 'paused' ||
          timer.widgetState === 'overtime';
        if (!isRunning) {
          clearDoctor();
          setShowSettings(false);
          setShowAddDoctor(false);
        }
      }
    };

    window.electronAPI?.onNavigate(handler);
    return () => {
      window.electronAPI?.removeAllListeners('navigate');
    };
  }, [timer.widgetState, timer.goToSetup, activeDoctor, clearDoctor]);

  // ── Handle save-and-quit request ────────────────
  useEffect(() => {
    const handler = async () => {
      if (
        timer.widgetState === 'running' ||
        timer.widgetState === 'paused' ||
        timer.widgetState === 'overtime'
      ) {
        timer.stop();
        const consultationData = timer.consultation;
        const snapshot = timer.save();

        if (consultationData && activeDoctor) {
          await saveConsultationData({
            doctorId: activeDoctor.slug,
            doctorName: activeDoctor.name,
            patientName: consultationData.patientName || undefined,
            appointmentType: consultationData.appointmentType,
            targetDurationSeconds: consultationData.targetDurationSeconds,
            actualDurationSeconds: snapshot.elapsedSeconds,
            pausedDurationSeconds: snapshot.pausedDurationSeconds,
            notes: undefined,
            startedAt: consultationData.startedAt,
            completedAt: Date.now(),
          });
        }
      }
      window.electronAPI?.closeApp();
    };

    window.electronAPI?.onRequestSaveAndQuit(handler);
    return () => {
      window.electronAPI?.removeAllListeners('request-save-and-quit');
    };
  }, [timer, saveConsultationData, activeDoctor]);

  // ── Resize window on state change ──────────────────────
  useEffect(() => {
    if (needsDoctorSelect || showAddDoctor) return; // handled separately
    const state = timer.widgetState;
    const prev = prevStateRef.current;
    prevStateRef.current = state;

    if (state === 'minimised') {
      // Exact size + max-height lock via dedicated handler
      window.electronAPI?.minimiseToBar();
    } else if (prev === 'minimised') {
      // Restoring from minimised — remove max lock, set min
      window.electronAPI?.restoreFromBar(STATE_MIN_WIDTHS[state], STATE_MIN_HEIGHTS[state]);
    } else {
      // Normal state transition — resize to match target state
      window.electronAPI?.setWindowSize(STATE_MIN_WIDTHS[state], STATE_MIN_HEIGHTS[state]);
    }
  }, [timer.widgetState, needsDoctorSelect, showAddDoctor]);

  // ── Computed ───────────────────────────────────────────
  const isColoured =
    timer.widgetState === 'running' ||
    timer.widgetState === 'paused' ||
    timer.widgetState === 'overtime';

  const isTimerActive = isColoured;

  const bg = isColoured ? timer.currentColour.background : '#FFFFFF';

  // ── Event handlers ────────────────────────────────────

  const handleStart = (data: { patientName: string; typeCode: string; durationMinutes: number }) => {
    const typeOption = appointmentTypes.find((t) => t.code === data.typeCode);
    timer.startTimer({
      patientName: data.patientName,
      typeCode: data.typeCode,
      typeName: typeOption?.name ?? data.typeCode,
      durationMinutes: data.durationMinutes,
    });
  };

  const handleSave = async (notes: string) => {
    const consultationData = timer.consultation;
    const snapshot = timer.save();

    if (consultationData && activeDoctor) {
      await saveConsultationData({
        doctorId: activeDoctor.slug,
        doctorName: activeDoctor.name,
        patientName: consultationData.patientName || undefined,
        appointmentType: consultationData.appointmentType,
        targetDurationSeconds: consultationData.targetDurationSeconds,
        actualDurationSeconds: snapshot.elapsedSeconds,
        pausedDurationSeconds: snapshot.pausedDurationSeconds,
        notes: notes || undefined,
        startedAt: consultationData.startedAt,
        completedAt: Date.now(),
      });
    }
  };

  const handleDoctorCreated = (slug: string) => {
    selectDoctor(slug);
    setShowAddDoctor(false);
  };

  // Target label for display
  const targetMinutes = timer.consultation
    ? Math.round(timer.consultation.targetDurationSeconds / 60)
    : 0;

  // ── Loading state ──────────────────────────────────────
  if (doctorsLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col relative overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <CustomTitleBar state="idle" onMinimise={() => {}} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ── Doctor setup (no doctors exist) ────────────────────
  if (noDoctorsExist || (showAddDoctor && !activeDoctor)) {
    return (
      <div className="min-h-screen w-full flex flex-col relative overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <CustomTitleBar state="idle" onMinimise={() => {}} />
        <DoctorSetup
          hasDoctors={allDoctors.length > 0}
          onCreated={handleDoctorCreated}
          onCancel={() => setShowAddDoctor(false)}
        />
      </div>
    );
  }

  // ── Doctor selector ────────────────────────────────────
  if (needsDoctorSelect) {
    return (
      <div className="min-h-screen w-full flex flex-col relative overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <CustomTitleBar state="idle" onMinimise={() => {}} />
        <DoctorSelector
          doctors={allDoctors}
          onSelect={selectDoctor}
          onAddNew={() => setShowAddDoctor(true)}
        />
      </div>
    );
  }

  // ── Minimised state — separate layout ─────────────────
  if (timer.widgetState === 'minimised') {
    return (
      <div className="w-full">
        <MinimisedWidget
          displayTime={timer.displayTime}
          phaseColour={timer.currentColour.background}
          onExpand={timer.restoreFromMinimised}
        />
      </div>
    );
  }

  // ── Settings state — replaces main content ───────────
  if (showSettings) {
    return (
      <div
        className="h-screen w-full flex flex-col relative overflow-hidden rounded-2xl"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <CustomTitleBar state="idle" onMinimise={timer.minimise} />
        <SettingsView
          settings={settings}
          appointmentTypes={allAppointmentTypes}
          activeAppointmentTypes={appointmentTypes}
          onUpdateSetting={updateSetting}
          onUpsertType={upsertAppointmentType}
          onToggleType={toggleAppointmentType}
          onReorderTypes={reorderAppointmentTypes}
          doctorName={activeDoctor!.name}
          onSwitchDoctor={() => {
            preSettingsSizeRef.current = null;
            clearDoctor();
            setShowSettings(false);
          }}
          onDeleteProfile={async () => {
            if (!activeDoctor) return;
            const confirmed = window.confirm(`Delete profile for ${activeDoctor.name}? Their consultation history will be preserved.`);
            if (!confirmed) return;
            const slugToDelete = activeDoctor.slug;
            preSettingsSizeRef.current = null;
            clearDoctor();
            setShowSettings(false);
            try {
              await deleteDoctor({ slug: slugToDelete });
            } catch { /* ignore */ }
          }}
          onDone={() => {
            setShowSettings(false);
            const saved = preSettingsSizeRef.current;
            if (saved) {
              window.electronAPI?.setWindowSize(saved.width, saved.height);
              preSettingsSizeRef.current = null;
            }
            window.electronAPI?.setWindowMinSize(STATE_MIN_WIDTHS.idle, STATE_MIN_HEIGHTS.idle);
          }}
        />
        {isOffline && <OfflineIndicator />}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: bg,
        transition: 'background-color 1s ease',
      }}
    >
      {/* Title bar */}
      <CustomTitleBar state={timer.widgetState} onMinimise={timer.minimise} />

      {/* ── IDLE ─────────────────────────────────────── */}
      {timer.widgetState === 'idle' && (
        <div className="flex-1 flex flex-col justify-center px-4 pb-2">
          <div className="text-center mb-1">
            <p className="text-[13px] font-semibold text-gray-700 tracking-wide mb-0.5">
              RESTORE Health &amp; Care
            </p>
            <p className="text-[10px] text-gray-400">Consultation Timer</p>
          </div>
          {/* Doctor Badge */}
          <div className="flex justify-center mb-2">
            <DoctorBadge
              doctor={activeDoctor!}
              clickable={!isTimerActive}
              onClick={() => {
                clearDoctor();
              }}
            />
          </div>
          <button
            onClick={timer.goToSetup}
            className="
              w-full py-2 rounded-xl
              bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800
              text-white text-sm font-medium
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-emerald-500/40
            "
          >
            New Consultation
          </button>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => window.electronAPI?.openHistoryWindow()}
              className="
                flex-1 py-1 rounded-lg
                text-[11px] text-gray-400 hover:text-gray-600
                hover:bg-gray-100 active:bg-gray-200
                transition-colors duration-150
                focus:outline-none
              "
            >
              History
            </button>
            <button
              onClick={() => {
                preSettingsSizeRef.current = { width: window.outerWidth, height: window.outerHeight };
                window.electronAPI?.setWindowMinSize(STATE_MIN_WIDTHS.settings, STATE_MIN_HEIGHTS.settings);
                setShowSettings(true);
              }}
              className="
                py-1 px-3 rounded-lg
                text-gray-400 hover:text-gray-600
                hover:bg-gray-100 active:bg-gray-200
                transition-colors duration-150
                focus:outline-none
              "
              title="Settings"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── SETUP ────────────────────────────────────── */}
      {timer.widgetState === 'setup' && (
        <div className="flex-1 flex flex-col">
          <div className="px-4 pt-1 pb-2">
            <h2 className="text-sm font-semibold text-gray-800">New Consultation</h2>
          </div>
          <NewTimerForm
            appointmentTypes={appointmentTypes}
            defaultTypeCode={settings.defaultAppointmentType}
            onStart={handleStart}
            onCancel={timer.cancelSetup}
          />
        </div>
      )}

      {/* ── RUNNING / PAUSED / OVERTIME ──────────────── */}
      {isColoured && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            <TimerDisplay
              state={timer.widgetState}
              displayTime={timer.displayTime}
              patientName={timer.consultation?.patientName ?? ''}
              appointmentType={timer.consultation?.appointmentType ?? ''}
              targetLabel={`${targetMinutes} min`}
            />
            <TimerControls
              state={timer.widgetState}
              onPause={timer.pause}
              onResume={timer.resume}
              onStop={timer.stop}
            />
          </div>
        </div>
      )}

      {/* ── APPROVAL ─────────────────────────────────── */}
      {timer.widgetState === 'approval' && timer.approvalSnapshot && (
        <div className="flex-1 flex flex-col">
          <ApprovalScreen
            patientName={timer.consultation?.patientName ?? ''}
            appointmentType={timer.consultation?.appointmentType ?? ''}
            targetDuration={formatDuration(timer.consultation?.targetDurationSeconds ?? 0)}
            actualDuration={formatDuration(timer.approvalSnapshot.elapsedSeconds)}
            overtimeAmount={
              timer.approvalSnapshot.overtimeSeconds > 0
                ? formatDuration(timer.approvalSnapshot.overtimeSeconds)
                : null
            }
            pausedDuration={
              timer.approvalSnapshot.pausedDurationSeconds > 0
                ? formatDuration(timer.approvalSnapshot.pausedDurationSeconds)
                : undefined
            }
            onSave={handleSave}
            onDiscard={timer.discard}
            onBack={timer.goBack}
          />
        </div>
      )}

      {/* ── Offline indicator ────────────────────────── */}
      {isOffline && <OfflineIndicator />}
    </div>
  );
}
