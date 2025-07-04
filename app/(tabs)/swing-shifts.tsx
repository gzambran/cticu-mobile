import SwingShiftCard from '@/components/SwingShiftCard';
import authService from '@/services/auth';
import { Schedule } from '@/types';
import { formatDate } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SwingDetails {
  [date: string]: {
    unitCensus?: string;
    cases?: string;
  };
}

export default function SwingShiftsScreen() {
  const insets = useSafeAreaInsets();
  const [doctors, setDoctors] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<Schedule>({});
  const [swingDetails, setSwingDetails] = useState<SwingDetails>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Initial load - scroll to today's date or next swing shift
    if (!loading && !hasScrolledToToday) {
      scrollToRelevantDate();
      setHasScrolledToToday(true);
    }
  }, [loading]);

  useEffect(() => {
    // Handle month navigation
    if (!loading && scrollViewRef.current) {
      const today = new Date();
      const isCurrentMonth = today.getMonth() === currentMonth.getMonth() && 
                            today.getFullYear() === currentMonth.getFullYear();
      
      // Small delay to ensure the new month's content is rendered
      setTimeout(() => {
        if (isCurrentMonth) {
          // If navigating to current month, scroll to today/next swing shift
          scrollToRelevantDate();
        } else {
          // For other months, scroll to top
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }
      }, 100);
    }
  }, [currentMonth]);

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

  const getTargetDate = (): Date => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // If today is a swing shift day (Mon-Thu) and in current month
    if (dayOfWeek >= 1 && dayOfWeek <= 4 && 
        today.getMonth() === currentMonth.getMonth() && 
        today.getFullYear() === currentMonth.getFullYear()) {
      return today;
    }
    
    // Otherwise, find the next swing shift day
    const targetDate = new Date(today);
    
    // If we're viewing a different month, start from beginning of that month
    if (today.getMonth() !== currentMonth.getMonth() || 
        today.getFullYear() !== currentMonth.getFullYear()) {
      return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    }
    
    // Find next Monday-Thursday
    while (targetDate.getDay() === 0 || targetDate.getDay() === 5 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    return targetDate;
  };

  const scrollToRelevantDate = () => {
    const swingDates = getSwingShiftDatesForMonth(currentMonth);
    const targetDate = getTargetDate();
    
    // Find the index of the target date
    const targetIndex = swingDates.findIndex(date => 
      formatDate(date) === formatDate(targetDate)
    );
    
    if (targetIndex !== -1 && scrollViewRef.current) {
      // Estimate the position (each card is roughly 200px in height)
      const estimatedCardHeight = 200;
      const scrollPosition = targetIndex * estimatedCardHeight;
      
      // Delay to ensure layout is complete
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: scrollPosition,
          animated: true
        });
      }, 100);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentMonth(newDate);
    // Scroll will be handled by useEffect
  };

  const jumpToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    // Trigger scroll after state update
    setTimeout(() => {
      setHasScrolledToToday(false);
    }, 50);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  const swingDates = getSwingShiftDatesForMonth(currentMonth);
  const monthTitle = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarBackground, { height: insets.top }]} />
      <StatusBar style="dark" />
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
        ref={scrollViewRef}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  statusBarBackground: {
    backgroundColor: '#fff',
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