import { formatDate, parseDate } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RequestManagementCardProps {
  doctor: string;
  unavailableDates: string[];
  onAddDates: (doctor: string, dates: string[]) => Promise<void>;
  onRemoveDate: (doctor: string, date: string) => Promise<void>;
  minDate: Date;
  showHeader?: boolean;
}

export default function RequestManagementCard({
  doctor,
  unavailableDates,
  onAddDates,
  onRemoveDate,
  minDate,
  showHeader = false,
}: RequestManagementCardProps) {
  const insets = useSafeAreaInsets();
  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(minDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Filter dates to only show future dates
  const futureDates = unavailableDates.filter(dateStr => {
    const date = parseDate(dateStr);
    return date >= minDate;
  }).sort();

  const handleAddDates = async () => {
    if (startDate > endDate) {
      Alert.alert('Invalid Date Range', 'Start date must be before end date');
      return;
    }

    // Generate all dates in range
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    await onAddDates(doctor, dates);
    
    // Reset dates
    setStartDate(minDate);
    setEndDate(minDate);
  };

  const handleRemoveDate = (dateStr: string) => {
    Alert.alert(
      'Remove Date',
      `Remove ${parseDate(dateStr).toLocaleDateString()} from requests?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => onRemoveDate(doctor, dateStr)
        },
      ]
    );
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    // Always hide picker on Android after any interaction
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    
    if (selectedDate) {
      setStartDate(selectedDate);
      // Always set end date to match start date for easier selection
      setEndDate(selectedDate);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    // Always hide picker on Android after any interaction
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const renderIOSDatePicker = (
    show: boolean,
    setShow: (value: boolean) => void,
    value: Date,
    onChange: (event: any, selectedDate?: Date) => void,
    title: string
  ) => {
    return (
      <Modal
        visible={show}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            onPress={() => setShow(false)}
            activeOpacity={1}
          />
          <View style={[
            styles.pickerContainer,
            { paddingBottom: Math.max(insets.bottom, 20) }
          ]}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={styles.pickerCancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>{title}</Text>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={styles.pickerDoneButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={value}
              mode="date"
              display="spinner"
              onChange={onChange}
              minimumDate={minDate}
              style={styles.picker}
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <View style={styles.card}>
        {showHeader && (
          <View style={styles.header}>
            <Text style={styles.doctorName}>{doctor}</Text>
            <Text style={styles.requestCount}>
              {futureDates.length} upcoming request{futureDates.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.dateSection}>
            <Text style={styles.sectionTitle}>Add New Dates</Text>
            
            <View style={styles.dateRow}>
              <View style={styles.dateInput}>
                <Text style={styles.dateLabel}>START DATE</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {startDate.toLocaleDateString()}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              </View>

              <View style={styles.dateInput}>
                <Text style={styles.dateLabel}>END DATE</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {endDate.toLocaleDateString()}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddDates}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.addButtonText}>Add Dates</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.currentDates}>
            <Text style={styles.sectionTitle}>Upcoming Requests</Text>
            {futureDates.length === 0 ? (
              <Text style={styles.emptyState}>No upcoming requests</Text>
            ) : (
              <View style={styles.datesList}>
                {futureDates.map(dateStr => {
                  const date = parseDate(dateStr);
                  return (
                    <View key={dateStr} style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>
                        {date.toLocaleDateString()}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveDate(dateStr)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close" size={18} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Render date pickers based on platform */}
      {Platform.OS === 'ios' ? (
        <>
          {renderIOSDatePicker(
            showStartPicker,
            setShowStartPicker,
            startDate,
            onStartDateChange,
            'Select Start Date'
          )}
          {renderIOSDatePicker(
            showEndPicker,
            setShowEndPicker,
            endDate,
            onEndDateChange,
            'Select End Date'
          )}
        </>
      ) : (
        <>
          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={onStartDateChange}
              minimumDate={minDate}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={onEndDateChange}
              minimumDate={minDate}
            />
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  requestCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  content: {
    // Content container
  },
  dateSection: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  dateButtonText: {
    fontSize: 17,
    color: '#000',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  currentDates: {
    padding: 16,
  },
  emptyState: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  datesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    gap: 8,
  },
  dateBadgeText: {
    fontSize: 14,
    color: '#000',
  },
  // Modal and picker styles for iOS - updated to slide from bottom
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end', // Changed from 'center' to 'flex-end'
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,  // Changed from borderRadius to only top corners
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 }, // Changed shadow to come from top
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  pickerCancelButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  pickerDoneButton: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  picker: {
    height: 216,
  },
});