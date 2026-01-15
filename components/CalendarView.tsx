import { ForegroundContext } from '@/app/(tabs)/_layout';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useDoctors } from '../contexts/DoctorsContext';
import api, { ApiError } from '../services/api';
import { AuthError, NetworkError } from '../services/auth';
import { EVENT_DOT_COLOR, Holidays, MAX_EVENT_TITLE_LENGTH, Schedule, SHIFT_COLORS, ShiftType, UserEvents } from '../types';
import { formatDate, getCalendarDays, getMultiMonthBounds } from '../utils/date';
import DayCell from './DayCell';
import DoctorPickerModal from './DoctorPickerModal';
import OfflineIndicator from './OfflineIndicator';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CalendarViewProps {
  selectedDoctor?: string;
  onSelectDoctor: (doctor: string | undefined) => void;
  onSettingsPress?: () => void;
}

export default function CalendarView({ selectedDoctor, onSelectDoctor, onSettingsPress }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule>({});
  const [holidays, setHolidays] = useState<Holidays>({});
  const [userEvents, setUserEvents] = useState<UserEvents>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isOffline, setIsOffline] = useState(false);
  const [firstDayMonday, setFirstDayMonday] = useState(false);
  const [lastLoadedMonth, setLastLoadedMonth] = useState<{ year: number; month: number } | null>(null);
  const { doctors } = useDoctors();
  const { user } = useAuth();

  // User event states
  const [detailPage, setDetailPage] = useState(0);
  const [eventTitle, setEventTitle] = useState('');
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const detailScrollRef = useRef<ScrollView>(null);

  // Track if we're already refreshing to prevent duplicate refreshes
  const isRefreshingRef = useRef(false);
  const lastKnownDateRef = useRef(new Date().toDateString());

  // Get foreground context
  const { lastForegroundTime } = useContext(ForegroundContext);

  // Check if viewing own calendar
  const isOwnCalendar = selectedDoctor === user?.doctorCode;

  // Reset form state when selected date changes (but keep current page)
  useEffect(() => {
    setIsEditingEvent(false);
    setEventTitle('');
  }, [selectedDate]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const loadSettings = async () => {
    try {
      const firstDay = await AsyncStorage.getItem('first_day_monday');
      if (firstDay !== null) {
        setFirstDayMonday(JSON.parse(firstDay));
      }
    } catch {
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

      const fetchPromises: Promise<any>[] = [
        api.getSchedules(start, end, isRefresh || isSilent),
        api.getHolidays(start, end, isRefresh || isSilent),
      ];

      // Only fetch user events if viewing own calendar
      if (isOwnCalendar) {
        fetchPromises.push(api.getUserEvents(start, end, isRefresh || isSilent));
      }

      const results = await Promise.all(fetchPromises);
      const [schedulesData, holidaysData] = results;

      // Merge with existing data to build up cache over time
      setSchedules(prev => ({ ...prev, ...schedulesData }));
      setHolidays(prev => ({ ...prev, ...holidaysData }));

      // Update user events if fetched
      if (isOwnCalendar && results[2]) {
        setUserEvents(prev => ({ ...prev, ...results[2] }));
      }
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
        {calendarDays.map((date, index) => {
          const dateStr = date ? formatDate(date) : '';
          return (
            <DayCell
              key={index}
              date={date}
              schedule={date ? schedules[dateStr] : undefined}
              holiday={date ? holidays[dateStr] : undefined}
              selectedDoctor={selectedDoctor}
              isSelected={!!(date && selectedDate && dateStr === formatDate(selectedDate))}
              hasEvent={isOwnCalendar && date ? !!userEvents[dateStr] : undefined}
              onPress={() => date && setSelectedDate(date)}
            />
          );
        })}
      </View>
    );
  };

  // Handle scroll for page indicator
  const handleDetailScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setDetailPage(page);
  }, []);

  // Save event handler
  const handleSaveEvent = async () => {
    if (!selectedDate || !eventTitle.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    setIsSavingEvent(true);
    try {
      const dateStr = formatDate(selectedDate);
      const existingEvent = userEvents[dateStr];

      if (existingEvent && isEditingEvent) {
        await api.updateUserEvent(existingEvent.id, eventTitle.trim());
      } else {
        await api.createUserEvent(dateStr, eventTitle.trim());
      }

      // Refresh user events
      const { start, end } = getMultiMonthBounds(year, month, 4);
      const updatedEvents = await api.getUserEvents(start, end, true);
      setUserEvents(prev => ({ ...prev, ...updatedEvents }));

      setIsEditingEvent(false);
      setEventTitle('');
    } catch (error) {
      if (error instanceof NetworkError) {
        Alert.alert('Connection Error', 'Unable to save. Check your connection.');
      } else if (error instanceof ApiError) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'Failed to save event');
      }
    } finally {
      setIsSavingEvent(false);
    }
  };

  // Delete event handler
  const handleDeleteEvent = async () => {
    if (!selectedDate) return;

    const dateStr = formatDate(selectedDate);
    const existingEvent = userEvents[dateStr];
    if (!existingEvent) return;

    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsSavingEvent(true);
            try {
              await api.deleteUserEvent(existingEvent.id);

              // Refresh user events
              const { start, end } = getMultiMonthBounds(year, month, 4);
              const updatedEvents = await api.getUserEvents(start, end, true);
              setUserEvents(updatedEvents);

              setEventTitle('');
              setIsEditingEvent(false);
            } catch (error) {
              if (error instanceof NetworkError) {
                Alert.alert('Connection Error', 'Unable to delete. Check your connection.');
              } else {
                Alert.alert('Error', 'Failed to delete event');
              }
            } finally {
              setIsSavingEvent(false);
            }
          },
        },
      ]
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
    const currentEvent = userEvents[dateStr];
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

    // Render shifts page (Page 1)
    const renderShiftsPage = () => (
      <View style={[styles.detailPage, { width: SCREEN_WIDTH }]}>
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

    // Render event page (Page 2)
    const renderEventPage = () => {
      const showForm = !currentEvent || isEditingEvent;

      return (
        <View style={[styles.detailPage, styles.eventPage, { width: SCREEN_WIDTH }]}>
          <View style={styles.selectedDateHeader}>
            <View style={styles.dayDateRow}>
              <View style={[styles.eventDotIndicator, { backgroundColor: EVENT_DOT_COLOR }]} />
              <Text style={styles.selectedDateDay}>{dayName}</Text>
              <Text style={styles.selectedDateFull}>{fullDate}</Text>
            </View>
          </View>

          {showForm ? (
            <View style={styles.eventForm}>
              <TextInput
                style={styles.eventInput}
                value={eventTitle}
                onChangeText={setEventTitle}
                maxLength={MAX_EVENT_TITLE_LENGTH}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.charCount}>
                {eventTitle.length}/{MAX_EVENT_TITLE_LENGTH}
              </Text>
              <View style={styles.eventButtons}>
                {isEditingEvent && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setIsEditingEvent(false);
                      setEventTitle(currentEvent?.title || '');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.saveButton, (isSavingEvent || !eventTitle.trim()) && styles.disabledButton]}
                  onPress={handleSaveEvent}
                  disabled={isSavingEvent || !eventTitle.trim()}
                >
                  {isSavingEvent ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {isEditingEvent ? 'Update' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.eventDisplay}>
              <Text style={styles.eventTitle}>{currentEvent.title}</Text>
              <View style={styles.eventActions}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => {
                    setEventTitle(currentEvent.title);
                    setIsEditingEvent(true);
                  }}
                >
                  <Ionicons name="pencil" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleDeleteEvent}
                  disabled={isSavingEvent}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    };

    // If not own calendar, render simple view without swipe
    if (!isOwnCalendar) {
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
    }

    // Render swipeable view for own calendar
    return (
      <View style={styles.swipeableContainer}>
        <ScrollView
          ref={detailScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleDetailScroll}
          scrollEventThrottle={16}
        >
          {renderShiftsPage()}
          {renderEventPage()}
        </ScrollView>

        {/* Pagination dots */}
        <View style={styles.paginationContainer}>
          <View style={[styles.paginationDot, detailPage === 0 && styles.paginationDotActive]} />
          <View style={[styles.paginationDot, detailPage === 1 && styles.paginationDotActive]} />
        </View>
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
  swipeableContainer: {
    backgroundColor: 'white',
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
  // Swipeable detail styles
  detailPage: {
    padding: 16,
  },
  eventPage: {
    paddingTop: 16,
  },
  eventDotIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignSelf: 'center',
  },
  eventForm: {
    gap: 12,
  },
  eventInput: {
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  charCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
  },
  eventButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E5E5EA',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  eventDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    padding: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C6C6C8',
  },
  paginationDotActive: {
    backgroundColor: '#007AFF',
  },
});