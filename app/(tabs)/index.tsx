import CalendarView from '@/components/CalendarView';
import { useFilter } from '@/contexts/FilterContext';
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

export default function ScheduleScreen() {
  const { selectedDoctorCalendar, setSelectedDoctorCalendar } = useFilter();

  return (
    <SafeAreaView style={styles.container}>
      <CalendarView 
        selectedDoctor={selectedDoctorCalendar} 
        onSelectDoctor={setSelectedDoctorCalendar}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
});