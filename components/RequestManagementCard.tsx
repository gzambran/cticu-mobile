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
    View,
} from 'react-native';

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

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    
    if (selectedDate) {
      setStartDate(selectedDate);
      // Automatically set end date to match start date for better UX
      setEndDate(selectedDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const renderDatePicker = () => {
    if (Platform.OS === 'ios') {
      return (
        <>
          {showStartPicker && (
            <Modal
              animationType="slide"
              transparent={true}
              visible={showStartPicker}
              onRequestClose={() => setShowStartPicker(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowStartPicker(false)}
              >
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                      <Text style={styles.modalCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Select Start Date</Text>
                    <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="spinner"
                    minimumDate={minDate}
                    onChange={handleStartDateChange}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {showEndPicker && (
            <Modal
              animationType="slide"
              transparent={true}
              visible={showEndPicker}
              onRequestClose={() => setShowEndPicker(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowEndPicker(false)}
              >
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                      <Text style={styles.modalCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Select End Date</Text>
                    <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="spinner"
                    minimumDate={startDate}
                    onChange={handleEndDateChange}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          )}
        </>
      );
    } else {
      // Android
      return (
        <>
          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              minimumDate={minDate}
              onChange={handleStartDateChange}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              minimumDate={startDate}
              onChange={handleEndDateChange}
            />
          )}
        </>
      );
    }
  };

  return (
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
              <Text style={styles.dateLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateInput}>
              <Text style={styles.dateLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {endDate.toLocaleDateString()}
                </Text>
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

      {renderDatePicker()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
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
    // No additional styling needed
  },
  dateSection: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  dateButton: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 15,
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
    fontSize: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalCancel: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalDone: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});