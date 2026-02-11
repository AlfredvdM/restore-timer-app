import { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { STATE_HEIGHTS, DOCTOR } from '../types';
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

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function TimerWidget() {
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
  } = useConvexData();

  const [showSettings, setShowSettings] = useState(false);

  const timer = useTimer({
    soundEnabled: settings.soundEnabled,
    soundVolume: settings.soundVolume,
    chimeType: settings.chimeType,
    yellowThreshold: settings.yellowThreshold,
    redThreshold: settings.redThreshold,
  });

  const updateWindowPositionMutation = useMutation(api.settings.updateWindowPosition);

  // ── Apply always-on-top from settings ───────────
  useEffect(() => {
    if (settings.alwaysOnTop !== undefined) {
      window.electronAPI?.setAlwaysOnTop(settings.alwaysOnTop);
    }
  }, [settings.alwaysOnTop]);

  // ── Save window position when moved (debounced to Convex) ──
  useEffect(() => {
    const handler = (position: { x: number; y: number }) => {
      updateWindowPositionMutation({
        userId: DOCTOR.userId,
        x: position.x,
        y: position.y,
      }).catch(() => {});
    };

    window.electronAPI?.onWindowMoved(handler);
    return () => {
      window.electronAPI?.removeAllListeners('window-moved');
    };
  }, [updateWindowPositionMutation]);

  // ── Notify main process of timer running state ──
  useEffect(() => {
    const isRunning =
      timer.widgetState === 'running' ||
      timer.widgetState === 'paused' ||
      timer.widgetState === 'overtime';
    window.electronAPI?.setTimerRunning(isRunning);
  }, [timer.widgetState]);

  // ── Handle tray menu navigation ─────────────────
  useEffect(() => {
    const handler = (target: string) => {
      if (target === 'new-consultation') {
        if (timer.widgetState === 'idle') {
          timer.goToSetup();
        }
      } else if (target === 'settings') {
        if (timer.widgetState === 'idle') {
          window.electronAPI?.setWindowSize(320, STATE_HEIGHTS.settings);
          setShowSettings(true);
        }
      }
    };

    window.electronAPI?.onNavigate(handler);
    return () => {
      window.electronAPI?.removeAllListeners('navigate');
    };
  }, [timer.widgetState, timer.goToSetup]);

  // ── Handle save-and-quit request ────────────────
  useEffect(() => {
    const handler = async () => {
      if (
        timer.widgetState === 'running' ||
        timer.widgetState === 'paused' ||
        timer.widgetState === 'overtime'
      ) {
        // Stop the timer and save
        timer.stop();
        // Trigger save with the approval snapshot
        const consultationData = timer.consultation;
        const snapshot = timer.save();

        if (consultationData) {
          await saveConsultationData({
            doctorId: DOCTOR.userId,
            doctorName: DOCTOR.doctorName,
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
      // Quit after saving
      window.electronAPI?.closeApp();
    };

    window.electronAPI?.onRequestSaveAndQuit(handler);
    return () => {
      window.electronAPI?.removeAllListeners('request-save-and-quit');
    };
  }, [timer, saveConsultationData]);

  // ── Resize window on state change ──────────────────────
  useEffect(() => {
    const state = timer.widgetState;
    if (state === 'minimised') {
      window.electronAPI?.setWindowSize(200, STATE_HEIGHTS.minimised);
    } else {
      window.electronAPI?.setWindowSize(320, STATE_HEIGHTS[state]);
    }
  }, [timer.widgetState]);

  // ── Computed ───────────────────────────────────────────
  const isColoured =
    timer.widgetState === 'running' ||
    timer.widgetState === 'paused' ||
    timer.widgetState === 'overtime';

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

    if (consultationData) {
      await saveConsultationData({
        doctorId: DOCTOR.userId,
        doctorName: DOCTOR.doctorName,
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

  // Target label for display
  const targetMinutes = timer.consultation
    ? Math.round(timer.consultation.targetDurationSeconds / 60)
    : 0;

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
          onDone={() => {
            setShowSettings(false);
            window.electronAPI?.setWindowSize(320, STATE_HEIGHTS.idle);
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
          <div className="text-center mb-2">
            <p className="text-[13px] font-semibold text-gray-700 tracking-wide mb-0.5">
              RESTORE Health &amp; Care
            </p>
            <p className="text-[10px] text-gray-400">Consultation Timer</p>
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
                window.electronAPI?.setWindowSize(320, STATE_HEIGHTS.settings);
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
        <div className="flex-1 flex flex-col">
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
