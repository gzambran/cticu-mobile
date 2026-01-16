import SwingShiftCard from '@/components/SwingShiftCard';
import { useDoctors } from '@/contexts/DoctorsContext';
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SwingDetails {
  [date: string]: {
    unitCensus?: string;
    cases?: string;
  };
}

export default function SwingShiftsScreen() {
  const insets = useSafeAreaInsets();
  const { doctors, refreshDoctors } = useDoctors();
  const [schedules, setSchedules] = useState<Schedule>({});
  const [swingDetails, setSwingDetails] = useState<SwingDetails>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const scrollViewRef = React.useRef<KeyboardAwareScrollViewRef>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Initial load - scroll to today's date or next swing shift
    if (!loading && !hasScrolledToToday) {
      scrollToRelevantDate();
      setHasScrolledToToday(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Calculate date range - previous quarter through end of next quarter
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const currentQuarter = Math.floor(currentMonth / 3);

      // Start date is beginning of previous quarter
      const prevQuarter = (currentQuarter - 1 + 4) % 4;
      const prevQuarterYear = currentQuarter === 0 ? currentYear - 1 : currentYear;
      const prevQuarterStartMonth = prevQuarter * 3;
      const startDate = new Date(prevQuarterYear, prevQuarterStartMonth, 1);

      // End date is end of next quarter
      const nextQuarter = (currentQuarter + 1) % 4;
      const nextQuarterYear = nextQuarter === 0 ? currentYear + 1 : currentYear;
      const quarterEndMonth = (nextQuarter * 3) + 2;
      const endDate = new Date(nextQuarterYear, quarterEndMonth + 1, 0);

      const startStr = formatDate(startDate);
      const endStr = formatDate(endDate);

      // Load data - doctors are now coming from context
      const [schedulesResponse, swingDetailsResponse] = await Promise.all([
        authService.authenticatedFetch(`/api/schedules?startDate=${startStr}&endDate=${endStr}`),
        authService.authenticatedFetch(`/api/swing-shift-details?startDate=${startStr}&endDate=${endStr}`),
      ]);

      if (!schedulesResponse.ok || !swingDetailsResponse.ok) {
        throw new Error('Failed to load data');
      }

      const schedulesData = await schedulesResponse.json();
      const swingDetailsData = await swingDetailsResponse.json();

      setSchedules(schedulesData);
      setSwingDetails(swingDetailsData);

      // If refresh, also refresh doctors
      if (isRefresh) {
        await refreshDoctors();
      }
    } catch {
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
    } catch {
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
    } catch {
      Alert.alert('Error', 'Failed to update swing shift details.');
    }
  };

  const scrollToRelevantDate = () => {
    const swingDates = getSwingShiftDatesForMonth(currentMonth);
    const today = new Date();
    
    // Find the target date
    let targetIndex = -1;
    
    // If viewing current month, find today or next swing shift
    if (today.getMonth() === currentMonth.getMonth() && 
        today.getFullYear() === currentMonth.getFullYear()) {
      
      // First, try to find today's date if it's a swing shift day
      const todayFormatted = formatDate(today);
      targetIndex = swingDates.findIndex(date => formatDate(date) === todayFormatted);
      
      // If today isn't a swing shift day or not found, find the next upcoming one
      if (targetIndex === -1) {
        targetIndex = swingDates.findIndex(date => date >= today);
      }
    }
    
    // If still not found or viewing a different month, default to first date
    if (targetIndex === -1) {
      targetIndex = 0;
    }
    
    if (targetIndex !== -1 && scrollViewRef.current) {
      const estimatedCardHeight = 280;
      const scrollPosition = Math.max(0, targetIndex * estimatedCardHeight - 50);
      
      // Use requestAnimationFrame for smooth instant positioning
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({
          y: scrollPosition,
          animated: false  // KEY CHANGE: No animation for instant jump
        });
      });
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    const isAlreadyCurrentMonth = today.getMonth() === currentMonth.getMonth() && 
                                  today.getFullYear() === currentMonth.getFullYear();
    
    if (!isAlreadyCurrentMonth) {
      // If changing months, use a subtle fade effect
      setCurrentMonth(today);
      // The useEffect will handle the scroll
    } else {
      // If already on current month, just scroll to today instantly
      scrollToRelevantDate();
    }
  };

  // Update the useEffect for currentMonth to use instant scrolling:
  useEffect(() => {
    // Handle month navigation
    if (!loading && scrollViewRef.current) {
      const today = new Date();
      const isCurrentMonth = today.getMonth() === currentMonth.getMonth() && 
                            today.getFullYear() === currentMonth.getFullYear();
      
      // Use requestAnimationFrame instead of setTimeout for better performance
      requestAnimationFrame(() => {
        if (isCurrentMonth) {
          // If navigating to current month, scroll to today/next swing shift instantly
          scrollToRelevantDate();
        } else {
          // For other months, scroll to top instantly
          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  // Calculate navigation bounds (previous quarter start to next quarter end)
  const getNavigationBounds = () => {
    const today = new Date();
    const currentMonthIndex = today.getMonth();
    const currentYear = today.getFullYear();
    const currentQuarter = Math.floor(currentMonthIndex / 3);

    // Min: First month of previous quarter
    const prevQuarter = (currentQuarter - 1 + 4) % 4;
    const prevQuarterYear = currentQuarter === 0 ? currentYear - 1 : currentYear;
    const minMonth = new Date(prevQuarterYear, prevQuarter * 3, 1);

    // Max: Last month of next quarter
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = nextQuarter === 0 ? currentYear + 1 : currentYear;
    const maxMonth = new Date(nextQuarterYear, (nextQuarter * 3) + 2, 1);

    return { minMonth, maxMonth };
  };

  const canNavigate = (direction: 'prev' | 'next') => {
    const { minMonth, maxMonth } = getNavigationBounds();
    if (direction === 'prev') {
      return currentMonth.getFullYear() > minMonth.getFullYear() ||
        (currentMonth.getFullYear() === minMonth.getFullYear() &&
         currentMonth.getMonth() > minMonth.getMonth());
    } else {
      return currentMonth.getFullYear() < maxMonth.getFullYear() ||
        (currentMonth.getFullYear() === maxMonth.getFullYear() &&
         currentMonth.getMonth() < maxMonth.getMonth());
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (!canNavigate(direction)) return;

    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentMonth(newDate);
    // Scroll will be handled by useEffect
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
          <TouchableOpacity
            onPress={() => navigateMonth('prev')}
            style={styles.navButton}
            disabled={!canNavigate('prev')}
          >
            <Ionicons name="chevron-back" size={24} color={canNavigate('prev') ? '#007AFF' : '#C7C7CC'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={jumpToToday} style={styles.monthButton}>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigateMonth('next')}
            style={styles.navButton}
            disabled={!canNavigate('next')}
          >
            <Ionicons name="chevron-forward" size={24} color={canNavigate('next') ? '#007AFF' : '#C7C7CC'} />
          </TouchableOpacity>
        </View>
      </View>
      
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        bottomOffset={120}
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
      </KeyboardAwareScrollView>
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
    height: 56,
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