import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doctor } from '../types';

const STORAGE_KEY = 'restore-active-doctor';

interface DoctorContextValue {
  activeDoctor: Doctor | null;
  allDoctors: Doctor[];
  isLoading: boolean;
  selectDoctor: (slug: string) => void;
  clearDoctor: () => void;
}

const DoctorContext = createContext<DoctorContextValue | null>(null);

export function useDoctorContext() {
  const ctx = useContext(DoctorContext);
  if (!ctx) throw new Error('useDoctorContext must be used within DoctorProvider');
  return ctx;
}

export function DoctorProvider({ children }: { children: ReactNode }) {
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);
  const rawDoctors = useQuery(api.doctors.getAllDoctors);
  const migrateMutation = useMutation(api.doctors.migrateExistingDoctor);

  const allDoctors: Doctor[] = (rawDoctors ?? []).map((d) => ({
    slug: d.slug,
    name: d.name,
    colour: d.colour,
  }));

  const isLoading = rawDoctors === undefined;

  // Run migration on mount (idempotent)
  useEffect(() => {
    migrateMutation().catch(() => {});
  }, [migrateMutation]);

  // On mount: restore doctor from localStorage only if the process was already running
  // (hide-to-tray keeps the same React tree, so activeDoctor persists in state).
  // For cold starts we always show the selector — we detect cold start by checking
  // a sessionStorage flag that only survives within the same browser session / Electron process.
  useEffect(() => {
    if (isLoading || allDoctors.length === 0) return;

    const wasRunning = sessionStorage.getItem('restore-session-alive');
    if (wasRunning) {
      const savedSlug = localStorage.getItem(STORAGE_KEY);
      if (savedSlug) {
        const doctor = allDoctors.find((d) => d.slug === savedSlug);
        if (doctor && !activeDoctor) {
          setActiveDoctor(doctor);
        }
      }
    }
    // Mark this session as alive for subsequent show/hide cycles
    sessionStorage.setItem('restore-session-alive', '1');
  }, [isLoading, allDoctors.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectDoctor = useCallback(
    (slug: string) => {
      const doctor = allDoctors.find((d) => d.slug === slug);
      if (doctor) {
        setActiveDoctor(doctor);
        localStorage.setItem(STORAGE_KEY, slug);
      }
    },
    [allDoctors],
  );

  const clearDoctor = useCallback(() => {
    setActiveDoctor(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <DoctorContext.Provider value={{ activeDoctor, allDoctors, isLoading, selectDoctor, clearDoctor }}>
      {children}
    </DoctorContext.Provider>
  );
}
