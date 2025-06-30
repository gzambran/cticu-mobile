import CalendarView from '@/components/CalendarView';
import { useFilter } from '@/contexts/FilterContext';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

export default function MainScreen() {
  const router = useRouter();
  const { selectedDoctor, setSelectedDoctor } = useFilter();

  return (
    <SafeAreaView style={styles.container}>
      <CalendarView 
        selectedDoctor={selectedDoctor} 
        onSelectDoctor={setSelectedDoctor}
        onSettingsPress={() => router.push('/settings')}
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