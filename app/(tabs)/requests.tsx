import DoctorFilter from '@/components/DoctorFilter';
import RequestManagementCard from '@/components/RequestManagementCard';
import { useFilter } from '@/contexts/FilterContext';
import authService from '@/services/auth';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface Unavailability {
  [doctor: string]: string[];
}

export default function RequestsScreen() {
  const [doctors, setDoctors] = useState<string[]>([]);
  const [unavailability, setUnavailability] = useState<Unavailability>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { selectedDoctorRequests, setSelectedDoctorRequests } = useFilter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [doctorsResponse, unavailabilityResponse] = await Promise.all([
        authService.authenticatedFetch('/api/doctors'),
        authService.authenticatedFetch('/api/unavailability'),
      ]);

      if (!doctorsResponse.ok || !unavailabilityResponse.ok) {
        throw new Error('Failed to load data');
      }

      const doctorsData = await doctorsResponse.json();
      const unavailabilityData = await unavailabilityResponse.json();

      setDoctors(doctorsData);
      setUnavailability(unavailabilityData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddDates = async (doctor: string, dates: string[]) => {
    try {
      const response = await authService.authenticatedFetch('/api/unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor, dates }),
      });

      if (!response.ok) {
        throw new Error('Failed to add dates');
      }

      await loadData();
      Alert.alert('Success', `${dates.length} dates added successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save dates. Please try again.');
    }
  };

  const handleRemoveDate = async (doctor: string, date: string) => {
    try {
      const response = await authService.authenticatedFetch('/api/unavailability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor, date }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove date');
      }

      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to remove date. Please try again.');
    }
  };

  const getUpcomingQuarterStart = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const currentQuarter = Math.floor(currentMonth / 3);
    let nextQuarter = currentQuarter + 1;
    let year = currentYear;
    
    if (nextQuarter > 3) {
      nextQuarter = 0;
      year = currentYear + 1;
    }
    
    const firstMonthOfNextQuarter = nextQuarter * 3;
    return new Date(year, firstMonthOfNextQuarter, 1);
  };

  const getQuarterName = (date: Date) => {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const year = date.getFullYear();
    return `Q${quarter} ${year}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  const upcomingQuarterStart = getUpcomingQuarterStart();
  const quarterName = getQuarterName(upcomingQuarterStart);

  // Get doctors to display based on filter
  const displayDoctors = selectedDoctorRequests ? [selectedDoctorRequests] : doctors;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <DoctorFilter
          selectedDoctor={selectedDoctorRequests}
          onSelectDoctor={setSelectedDoctorRequests}
        />
        <Text style={styles.quarterLabel}>{quarterName} requests</Text>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#007AFF"
          />
        }
      >
        {displayDoctors.map((doctor) => (
          <RequestManagementCard
            key={doctor}
            doctor={doctor}
            unavailableDates={unavailability[doctor] || []}
            onAddDates={handleAddDates}
            onRemoveDate={handleRemoveDate}
            minDate={upcomingQuarterStart}
            showHeader={!selectedDoctorRequests} // Only show header in "All Doctors" view
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  scrollView: {
    flex: 1,
  },
  quarterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
});