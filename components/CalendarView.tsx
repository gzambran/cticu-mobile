import { ForegroundContext } from '@/app/(tabs)/_layout';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useContext, useEffect, useRef, useState } from 'react';
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
import { useDoctors } from '../contexts/DoctorsContext';
import api, { ApiError } from '../services/api';
import { AuthError, NetworkError } from '../services/auth';
import { Holidays, Schedule, SHIFT_COLORS, ShiftType } from '../types';
import { formatDate, getCalendarDays, getMultiMonthBounds } from '../utils/date';
import DayCell from './DayCell';
import DoctorPickerModal from './DoctorPickerModal';
import OfflineIndicator from './OfflineIndicator';

interface CalendarViewProps {
  selectedDoctor?: string;
  onSelectDoctor: (doctor: string | undefined) => void;
  onSettingsPress?: () => void;
}

export default function CalendarView({ selectedDoctor, onSelectDoctor, onSettingsPress }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule>({});
  const [holidays, setHolidays] = useState<Holidays>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isOffline, setIsOffline] = useState(false);
  const [firstDayMonday, setFirstDayMonday] = useState(false);
  const [lastLoadedMonth, setLastLoadedMonth] = useState<{ year: number; month: number } | null>(null);
  const { doctors } = useDoctors();
  
  // Track if we're already refreshing to prevent duplicate refreshes
  const isRefreshingRef = useRef(false);
  const lastKnownDateRef = useRef(new Date().toDateString());
  
  // Get foreground context
  const { lastForegroundTime } = useContext(ForegroundContext);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const calendarDays = getCalendarDays(year, month, firstDayMonday);

  // Reload settings when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadSettings();
    }, [])
  );

  // Handle foreground events from context
  useEffect(() => {
    const today = new Date();
    const todayString = today.toDateString();
    
    // Check if the date has changed
    const dateChanged = todayString !== lastKnownDateRef.current;
    
    if (dateChanged) {
      lastKnownDateRef.current = todayString;
      
      // Check if we need to navigate to current month
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Auto-navigate to current month if the month has actually changed
      if (currentDate.getMonth() !== currentMonth || currentDate.getFullYear() !== currentYear) {
        setCurrentDate(today);
      }
      
      // Always update selected date to today if viewing current month
      const viewingCurrentMonth = currentDate.getMonth() === currentMonth && 
                                 currentDate.getFullYear() === currentYear;
      if (viewingCurrentMonth) {
        setSelectedDate(today);
      }
    }
    
    // Refresh data when coming to foreground (unless already refreshing)
    if (!isRefreshingRef.current) {
      loadData(false, true); // silent refresh
    }
  }, [lastForegroundTime]); // Triggered when foreground time updates

  // Handle month navigation
  useEffect(() => {
    // Only reload data if we've navigated outside our loaded range
    const needsReload = !lastLoadedMonth || 
      currentDate.getFullYear() !== lastLoadedMonth.year ||
      currentDate.getMonth() < lastLoadedMonth.month ||
      currentDate.getMonth() > lastLoadedMonth.month + 3;
    
    if (needsReload) {
      loadData();
      setLastLoadedMonth({ year, month });
    }
    
    // Update selected date when navigating months
    const today = new Date();
    const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
    
    if (isCurrentMonth) {
      setSelectedDate(today);
    } else if (selectedDate) {
      // Clear selection if date is not in the current month view
      const selectedMonth = selectedDate.getMonth();
      const selectedYear = selectedDate.getFullYear();
      if (selectedMonth !== month || selectedYear !== year) {
        setSelectedDate(null);
      }
    }
  }, [currentDate]);

  const loadSettings = async () => {
    try {
      const firstDay = await AsyncStorage.getItem('first_day_monday');
      if (firstDay !== null) {
        setFirstDayMonday(JSON.parse(firstDay));
      }
    } catch (error) {
      // Settings load error - use defaults
    }
  };

  const loadData = async (isRefresh = false, isSilent = false) => {
    // Prevent duplicate refreshes
    if (isRefreshingRef.current) {
      return;
    }
    
    isRefreshingRef.current = true;
    
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setLoading(true);
    }
    
    setIsOffline(false);

    try {
      // Load current month + next 3 months (4 months total)
      const { start, end } = getMultiMonthBounds(year, month, 4);
      
      const [schedulesData, holidaysData] = await Promise.all([
        api.getSchedules(start, end, isRefresh || isSilent),
        api.getHolidays(start, end, isRefresh || isSilent),
      ]);

      // Merge with existing data to build up cache over time
      setSchedules(prev => ({ ...prev, ...schedulesData }));
      setHolidays(prev => ({ ...prev, ...holidaysData }));
    } catch (error) {
      setIsOffline(true);
      
      // Only show alerts for user-initiated refreshes
      if (!isSilent) {
        if (error instanceof NetworkError) {
          Alert.alert('Connection Error', error.message, [{ text: 'OK' }]);
        } else if (error instanceof AuthError && error.code === 'SESSION_EXPIRED') {
          Alert.alert('Session Expired', 'Your session has expired. Please sign in again.', [{ text: 'OK' }]);
        } else if (error instanceof ApiError) {
          Alert.alert('Error', 'Unable to load schedule data. Please try again later.', [{ text: 'OK' }]);
        } else if (__DEV__ && error instanceof Error) {
          console.error('Error loading data:', error.message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      isRefreshingRef.current = false;
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    // Cancel any in-progress refresh if user is navigating
    if (isRefreshingRef.current) {
      isRefreshingRef.current = false;
    }
    
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentDate(newDate);
  };

  const jumpToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleManualRefresh = () => {
    // Cancel any in-progress silent refresh and do a user-initiated refresh
    if (isRefreshingRef.current) {
      isRefreshingRef.current = false;
    }
    loadData(true);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <DoctorPickerModal
        selectedDoctor={selectedDoctor}
        onSelectDoctor={onSelectDoctor}
        doctors={doctors}
        includeAllOption={true}
        triggerStyle={styles.doctorFilterButton}
        triggerTextStyle={styles.doctorFilterText}
      />
      
      <View style={styles.monthNavigation}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={jumpToToday} style={styles.monthButton}>
          <Text style={styles.headerTitle}>
            {currentDate.toLocaleDateString('en-US', { month: 'short' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      {onSettingsPress && (
        <TouchableOpacity onPress={onSettingsPress} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderWeekDays = () => {
    const weekDays = firstDayMonday 
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    return (
      <View style={styles.weekDaysContainer}>
        {weekDays.map((day, index) => (
          <View key={index} style={styles.weekDayCell}>
            <Text style={styles.weekDayText}>{day}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderCalendar = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      );
    }

    return (
      <View style={styles.calendarGrid}>
        {calendarDays.map((date, index) => (
          <DayCell
            key={index}
            date={date}
            schedule={date ? schedules[formatDate(date)] : undefined}
            holiday={date ? holidays[formatDate(date)] : undefined}
            selectedDoctor={selectedDoctor}
            isSelected={!!(date && selectedDate && formatDate(date) === formatDate(selectedDate))}
            onPress={() => date && setSelectedDate(date)}
          />
        ))}
      </View>
    );
  };

  const renderSelectedDateInfo = () => {
    if (!selectedDate) {
      return (
        <View style={styles.selectedDateContainer}>
          <Text style={styles.noSelectionText}>Select a date to view details</Text>
        </View>
      );
    }

    const dateStr = formatDate(selectedDate);
    const daySchedule = schedules[dateStr];
    const holiday = holidays[dateStr];
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const fullDate = selectedDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric' 
    });

    // Define the correct shift order
    const shiftOrder: ShiftType[] = ['5C', '5W', 'Night', 'Swing'];
    
    // Get shifts in the correct order
    const shifts: [ShiftType, string][] = [];
    if (daySchedule) {
      shiftOrder.forEach(shiftType => {
        if (daySchedule[shiftType]) {
          shifts.push([shiftType, daySchedule[shiftType]]);
        }
      });
    }

    return (
      <View style={styles.selectedDateContainer}>
        <View style={styles.selectedDateHeader}>
          <View style={styles.dayDateRow}>
            <Text style={styles.selectedDateDay}>{dayName}</Text>
            <Text style={styles.selectedDateFull}>{fullDate}</Text>
            {holiday && (
              <Text style={styles.holidayTextInline}>{holiday}</Text>
            )}
          </View>
        </View>
        
        {shifts.length > 0 ? (
          <View style={styles.shiftsInfo}>
            {shifts.map(([shift, doctor]) => (
              <View key={shift} style={styles.shiftRow}>
                <View style={styles.shiftTypeContainer}>
                  <View style={[styles.shiftDot, { backgroundColor: SHIFT_COLORS[shift] }]} />
                  <Text style={styles.shiftType}>{shift}</Text>
                </View>
                <Text style={styles.doctorName}>
                  {doctor}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noShiftsText}>No shifts scheduled</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {isOffline && <OfflineIndicator />}
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleManualRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {renderHeader()}
        {renderWeekDays()}
        {renderCalendar()}
        {renderSelectedDateInfo()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  doctorFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    maxWidth: 100,
  },
  doctorFilterText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
    flex: 0,
    minWidth: 30,
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
  settingsButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    width: 50,
    textAlign: 'center',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingTop: 8,
    paddingBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDateContainer: {
    backgroundColor: 'white',
    padding: 16,
    minHeight: 120,
  },
  selectedDateHeader: {
    marginBottom: 12,
  },
  dayDateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  selectedDateDay: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  selectedDateFull: {
    fontSize: 18,
    color: '#8E8E93',
  },
  holidayTextInline: {
    fontSize: 15,
    color: '#FF6347',
    fontWeight: '500',
  },
  shiftsInfo: {
    gap: 12,
  },
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  shiftTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  shiftType: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  doctorName: {
    fontSize: 15,
    color: '#3C3C43',
  },
  noShiftsText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  noSelectionText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 30,
  },
});