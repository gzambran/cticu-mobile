import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface FilterContextType {
  selectedDoctor: string | undefined;
  setSelectedDoctor: (doctor: string | undefined) => void;
  defaultDoctor: string;
  setDefaultDoctor: (doctor: string) => Promise<void>;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedDoctor, setSelectedDoctor] = useState<string | undefined>();
  const [defaultDoctor, setDefaultDoctorState] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDefaultDoctor();
  }, []);

  const loadDefaultDoctor = async () => {
    try {
      const savedDefault = await AsyncStorage.getItem('default_doctor_filter');
      if (savedDefault) {
        setDefaultDoctorState(savedDefault);
        if (savedDefault !== 'All') {
          setSelectedDoctor(savedDefault);
        }
      }
    } catch (error) {
      // Error loading settings, use default
    } finally {
      setIsLoading(false);
    }
  };

  const setDefaultDoctor = async (doctor: string) => {
    setDefaultDoctorState(doctor);
    await AsyncStorage.setItem('default_doctor_filter', doctor);
    // Immediately apply the new default to the current filter
    setSelectedDoctor(doctor === 'All' ? undefined : doctor);
  };

  if (isLoading) {
    return null; // Or a loading component
  }

  return (
    <FilterContext.Provider value={{
      selectedDoctor,
      setSelectedDoctor,
      defaultDoctor,
      setDefaultDoctor,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}