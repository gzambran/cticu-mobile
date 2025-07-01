import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface FilterContextType {
  // Calendar screen filter
  selectedDoctorCalendar: string | undefined;
  setSelectedDoctorCalendar: (doctor: string | undefined) => void;
  
  // Requests screen filter
  selectedDoctorRequests: string | undefined;
  setSelectedDoctorRequests: (doctor: string | undefined) => void;
  
  // Default doctor setting
  defaultDoctor: string;
  setDefaultDoctor: (doctor: string) => Promise<void>;
  
  // Legacy support (will be removed)
  selectedDoctor: string | undefined;
  setSelectedDoctor: (doctor: string | undefined) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedDoctorCalendar, setSelectedDoctorCalendar] = useState<string | undefined>();
  const [selectedDoctorRequests, setSelectedDoctorRequests] = useState<string | undefined>();
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
          // Set default for both screens initially
          setSelectedDoctorCalendar(savedDefault);
          setSelectedDoctorRequests(savedDefault);
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
    // Don't automatically update current filters when default changes
    // Users can manually set each screen to their preference
  };

  if (isLoading) {
    return null; // Or a loading component
  }

  return (
    <FilterContext.Provider value={{
      selectedDoctorCalendar,
      setSelectedDoctorCalendar,
      selectedDoctorRequests,
      setSelectedDoctorRequests,
      defaultDoctor,
      setDefaultDoctor,
      // Legacy support - maps to calendar for backward compatibility
      selectedDoctor: selectedDoctorCalendar,
      setSelectedDoctor: setSelectedDoctorCalendar,
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