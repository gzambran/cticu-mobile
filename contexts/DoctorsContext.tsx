import authService from '@/services/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

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

  const loadDoctors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authService.authenticatedFetch('/api/doctors');
      if (!response.ok) {
        throw new Error('Failed to load doctors');
      }
      
      const data = await response.json();
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

  const refreshDoctors = async () => {
    await loadDoctors();
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