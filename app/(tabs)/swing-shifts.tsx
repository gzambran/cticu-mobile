import SwingShiftCard from '@/components/SwingShiftCard';
import authService from '@/services/auth';
import { Schedule } from '@/types';
import { formatDate } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface SwingDetails {
  [date: string]: {
    unitCensus?: string;
    cases?: string;
  };
}

export default function SwingShiftsScreen() {
  const [doctors, setDoctors] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<Schedule>({});
  const [swingDetails, setSwingDetails] = useState<SwingDetails>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Calculate date range
      const today = new Date();
      const currentMonthStart = today.getMonth();
      const currentYear = today.getFullYear();
      
      const startDate = new Date(currentYear, currentMonthStart, 1);
      
      // End date is end of next quarter
      const currentQuarter = Math.floor(currentMonthStart / 3);
      const nextQuarter = (currentQuarter + 1) % 4;
      const nextQuarterYear = nextQuarter === 0 ? currentYear + 1 : currentYear;
      const quarterEndMonth = (nextQuarter * 3) + 2;
      const endDate = new Date(nextQuarterYear, quarterEndMonth + 1, 0);
      
      const startStr = formatDate(startDate);
      const endStr = formatDate(endDate);

      // Load all data
      const [doctorsResponse, schedulesResponse, swingDetailsResponse] = await Promise.all([
        authService.authenticatedFetch('/api/doctors'),
        authService.authenticatedFetch(`/api/schedules?startDate=${startStr}&endDate=${endStr}`),
        authService.authenticatedFetch(`/api/swing-shift-details?startDate=${startStr}&endDate=${endStr}`),
      ]);

      if (!doctorsResponse.ok || !schedulesResponse.ok || !swingDetailsResponse.ok) {
        throw new Error('Failed to load data');
      }

      const doctorsData = await doctorsResponse.json();
      const schedulesData = await schedulesResponse.json();
      const swingDetailsData = await swingDetailsResponse.json();

      setDoctors(doctorsData);
      setSchedules(schedulesData);
      setSwingDetails(swingDetailsData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getSwingShiftDatesForMonth = (month: Date): Date[] => {
    const dates: Date[] = [];
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, monthIndex, day);
      const dayOfWeek = date.getDay();
      // Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4
      if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        dates.push(date);
      }
    }
    
    return dates;
  };

  const handleUpdateSwingSchedule = async (date: string, doctor: string) => {
    try {
      const response = await authService.authenticatedFetch('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, shift: 'Swing', doctor }),
      });

      if (!response.ok) {
        throw new Error('Failed to update schedule');
      }

      // Update local state
      setSchedules(prev => ({
        ...prev,
        [date]: {
          ...prev[date],
          Swing: doctor,
        },
      }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update swing shift. Please try again.');
      // Reload to revert the change
      await loadData();
    }
  };

  const handleUpdateSwingDetails = async (date: string, unitCensus: string, cases: string) => {
    try {
      const response = await authService.authenticatedFetch('/api/swing-shift-details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, unitCensus, cases }),
      });

      if (!response.ok) {
        throw new Error('Failed to update details');
      }

      // Update local state
      setSwingDetails(prev => ({
        ...prev,
        [date]: { unitCensus, cases },
      }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update swing shift details.');
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentMonth(newDate);
  };

  const jumpToToday = () => {
    setCurrentMonth(new Date());
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

  const swingDates = getSwingShiftDatesForMonth(currentMonth);
  const monthTitle = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.monthNavigation}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={jumpToToday} style={styles.monthButton}>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#007AFF"
          />
        }
      >
        {swingDates.map((date) => (
          <SwingShiftCard
            key={formatDate(date)}
            date={date}
            doctors={doctors}
            currentDoctor={schedules[formatDate(date)]?.Swing}
            details={swingDetails[formatDate(date)] || {}}
            onUpdateDoctor={(doctor) => handleUpdateSwingSchedule(formatDate(date), doctor)}
            onUpdateDetails={(unitCensus, cases) => 
              handleUpdateSwingDetails(formatDate(date), unitCensus, cases)
            }
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthButton: {
    padding: 4,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    minWidth: 150,
    textAlign: 'center',
  },
});