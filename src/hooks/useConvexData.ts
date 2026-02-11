import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { DOCTOR, APPOINTMENT_TYPE_OPTIONS } from '../types';
import type { TimerSettings } from '../types';

interface ConvexAppointmentType {
  name: string;
  code: string;
  defaultDurationMinutes: number;
  colour?: string;
  isActive: boolean;
  sortOrder: number;
}

interface SavePayload {
  doctorId: string;
  doctorName: string;
  patientName?: string;
  appointmentType: string;
  targetDurationSeconds: number;
  actualDurationSeconds: number;
  pausedDurationSeconds: number;
  notes?: string;
  startedAt: number;
  completedAt: number;
}

const STORAGE_KEY = 'restore-timer-pending-saves';
const OFFLINE_GRACE_MS = 3000;

/** Fallback types mapped to the Convex shape */
const FALLBACK_TYPES: ConvexAppointmentType[] = APPOINTMENT_TYPE_OPTIONS.map((t, i) => ({
  name: t.name,
  code: t.code,
  defaultDurationMinutes: t.defaultMinutes,
  isActive: true,
  sortOrder: i + 1,
}));

const DEFAULT_SETTINGS: TimerSettings = {
  userId: DOCTOR.userId,
  soundEnabled: true,
  soundVolume: 0.5,
  yellowThreshold: 0.6,
  redThreshold: 0.9,
  alwaysOnTop: true,
  defaultAppointmentType: 'standard',
};

export function useConvexData() {
  // ── Queries ────────────────────────────────────
  const convexTypes = useQuery(api.appointmentTypes.getActiveAppointmentTypes);
  const convexSettings = useQuery(api.settings.getSettings, { userId: DOCTOR.userId });

  // ── All appointment types (including inactive, for settings) ──
  const convexAllTypes = useQuery(api.appointmentTypes.getAllAppointmentTypes);

  // ── Mutations ──────────────────────────────────
  const seedMutation = useMutation(api.appointmentTypes.seedAppointmentTypes);
  const ensureSettingsMutation = useMutation(api.settings.getOrCreateDefaultSettings);
  const saveMutation = useMutation(api.consultations.saveConsultation);
  const updateSettingMutation = useMutation(api.settings.updateSetting);
  const upsertTypeMutation = useMutation(api.appointmentTypes.upsertAppointmentType);
  const toggleTypeMutation = useMutation(api.appointmentTypes.toggleAppointmentTypeActive);
  const reorderTypesMutation = useMutation(api.appointmentTypes.reorderAppointmentTypes);

  // ── Seed data on mount ─────────────────────────
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      seedMutation().catch(() => {});
      ensureSettingsMutation({ userId: DOCTOR.userId }).catch(() => {});
    }
  }, [seedMutation, ensureSettingsMutation]);

  // ── Offline detection ──────────────────────────
  const [isOffline, setIsOffline] = useState(false);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    // If queries return data, we're online
    if (convexTypes !== undefined) {
      setIsOffline(false);
      return;
    }

    // If still undefined after grace period, treat as offline
    const elapsed = Date.now() - mountTime.current;
    if (elapsed > OFFLINE_GRACE_MS) {
      setIsOffline(true);
      return;
    }

    // Wait for the grace period to elapse
    const timer = setTimeout(() => {
      if (convexTypes === undefined) {
        setIsOffline(true);
      }
    }, OFFLINE_GRACE_MS - elapsed);

    return () => clearTimeout(timer);
  }, [convexTypes]);

  // ── Resolved values ────────────────────────────
  const appointmentTypes: ConvexAppointmentType[] = convexTypes ?? FALLBACK_TYPES;

  const settings: TimerSettings = convexSettings
    ? {
        userId: convexSettings.userId,
        soundEnabled: convexSettings.soundEnabled,
        soundVolume: convexSettings.soundVolume,
        chimeType: convexSettings.chimeType ?? 'gentle-bell',
        yellowThreshold: convexSettings.yellowThreshold,
        redThreshold: convexSettings.redThreshold,
        alwaysOnTop: convexSettings.alwaysOnTop,
        defaultAppointmentType: convexSettings.defaultAppointmentType,
        windowPosition: convexSettings.windowPosition,
      }
    : DEFAULT_SETTINGS;

  const settingsLoaded = convexSettings !== undefined;

  // ── Offline queue ──────────────────────────────
  const pendingSaves = useRef<SavePayload[]>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch {
        return [];
      }
    })(),
  );

  const saveConsultationData = useCallback(
    async (payload: SavePayload) => {
      try {
        await saveMutation(payload);
      } catch {
        pendingSaves.current.push(payload);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingSaves.current));
      }
    },
    [saveMutation],
  );

  // Flush queue when back online
  useEffect(() => {
    if (!isOffline && pendingSaves.current.length > 0) {
      const queue = [...pendingSaves.current];
      pendingSaves.current = [];
      localStorage.removeItem(STORAGE_KEY);
      queue.forEach((p) =>
        saveMutation(p).catch(() => {
          pendingSaves.current.push(p);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingSaves.current));
        }),
      );
    }
  }, [isOffline, saveMutation]);

  // ── Settings mutations (save on change) ────────
  const updateSetting = useCallback(
    async (field: string, value: boolean | number | string) => {
      try {
        await updateSettingMutation({ userId: DOCTOR.userId, field, value });
      } catch {
        // Offline — silently ignore, settings will sync when back
      }
    },
    [updateSettingMutation],
  );

  const allAppointmentTypes = convexAllTypes ?? [];

  const upsertAppointmentType = useCallback(
    async (data: {
      id?: string;
      name: string;
      code: string;
      defaultDurationMinutes: number;
      colour?: string;
      isActive: boolean;
      sortOrder: number;
    }) => {
      try {
        await upsertTypeMutation(data as any);
      } catch {
        // ignore offline
      }
    },
    [upsertTypeMutation],
  );

  const toggleAppointmentType = useCallback(
    async (id: string) => {
      try {
        await toggleTypeMutation({ id } as any);
      } catch {
        // ignore offline
      }
    },
    [toggleTypeMutation],
  );

  const reorderAppointmentTypes = useCallback(
    async (orderedIds: string[]) => {
      try {
        await reorderTypesMutation({ orderedIds } as any);
      } catch {
        // ignore offline
      }
    },
    [reorderTypesMutation],
  );

  return {
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
  };
}
