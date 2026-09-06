import { ForegroundContext } from '@/contexts/ForegroundContext';
import api from '@/services/api';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface DoctorsContextType {
  doctors: string[];
  loading: boolean;
  error: string | null;
  refreshDoctors: () => Promise<void>;
}

const DoctorsContext = createContext<DoctorsContextType | undefined>(undefined);

export function DoctorsProvider({ children }: { children: React.ReactNode }) {
  const [doctors, setDoctors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastForegroundTime } = useContext(ForegroundContext);
  // Skips the retry effect's first run, which fires on mount with the context's
  // initial lastForegroundTime rather than a real foreground transition.
  const isFirstForegroundRef = useRef(true);

  const loadDoctors = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getDoctors(forceRefresh);
      setDoctors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load doctors');
      // Fallback to empty array on error
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  // A failed load leaves every doctor picker empty for the rest of the session —
  // nothing else here calls refreshDoctors. Retry automatically the next time the
  // app comes to the foreground, as long as the list is still empty.
  useEffect(() => {
    if (isFirstForegroundRef.current) {
      isFirstForegroundRef.current = false;
      return;
    }
    if (doctors.length === 0 && !loading) {
      loadDoctors(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastForegroundTime]);

  const refreshDoctors = async () => {
    await loadDoctors(true); // Force refresh when manually requested
  };

  return (
    <DoctorsContext.Provider value={{ doctors, loading, error, refreshDoctors }}>
      {children}
    </DoctorsContext.Provider>
  );
}

export function useDoctors() {
  const context = useContext(DoctorsContext);
  if (context === undefined) {
    throw new Error('useDoctors must be used within a DoctorsProvider');
  }
  return context;
}