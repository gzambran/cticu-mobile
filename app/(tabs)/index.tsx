import CalendarView from '@/components/CalendarView';
import { useFilter } from '@/contexts/FilterContext';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ScheduleScreen() {
  const { selectedDoctorCalendar, setSelectedDoctorCalendar } = useFilter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <CalendarView 
        selectedDoctor={selectedDoctorCalendar} 
        onSelectDoctor={setSelectedDoctorCalendar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});