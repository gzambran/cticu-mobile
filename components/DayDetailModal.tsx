import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SHIFT_COLORS, ShiftType, Unavailability } from '../types';
import { formatDate } from '../utils/date';

interface DayDetailModalProps {
  visible: boolean;
  date: Date | null;
  schedule?: {
    '5W'?: string;
    '5C'?: string;
    Night?: string;
    Swing?: string;
  };
  holiday?: string;
  unavailability: Unavailability;
  onClose: () => void;
}

export default function DayDetailModal({
  visible,
  date,
  schedule,
  holiday,
  unavailability,
  onClose,
}: DayDetailModalProps) {
  if (!date) return null;

  const dateStr = formatDate(date);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Get unavailable doctors for this date
  const unavailableDoctors = Object.entries(unavailability)
    .filter(([_, dates]) => dates.includes(dateStr))
    .map(([doctor]) => doctor);

  const shifts = schedule ? Object.entries(schedule) as [ShiftType, string][] : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.dayName}>{dayName}</Text>
            <Text style={styles.date}>{fullDate}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {holiday && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Holiday</Text>
              <View style={styles.holidayContainer}>
                <Text style={styles.holidayName}>⭐ {holiday}</Text>
              </View>
            </View>
          )}

          {shifts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shifts</Text>
              {shifts.map(([shift, doctor]) => {
                const isUnavailable = unavailableDoctors.includes(doctor);
                return (
                  <View key={shift} style={styles.shiftRow}>
                    <View style={styles.shiftInfo}>
                      <View
                        style={[
                          styles.shiftIndicator,
                          { backgroundColor: SHIFT_COLORS[shift] },
                        ]}
                      />
                      <Text style={styles.shiftType}>{shift}</Text>
                    </View>
                    <Text style={[
                      styles.doctorName,
                      isUnavailable && styles.unavailableDoctor,
                    ]}>
                      {doctor}
                      {isUnavailable && ' (Unavailable)'}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {unavailableDoctors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Unavailable Doctors</Text>
              {unavailableDoctors.map(doctor => (
                <Text key={doctor} style={styles.unavailableItem}>
                  • {doctor}
                </Text>
              ))}
            </View>
          )}

          {shifts.length === 0 && !holiday && unavailableDoctors.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No shifts scheduled</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  dayName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  date: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  holidayContainer: {
    paddingHorizontal: 20,
  },
  holidayName: {
    fontSize: 17,
    color: '#000',
  },
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  shiftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  shiftType: {
    fontSize: 17,
    color: '#000',
  },
  doctorName: {
    fontSize: 17,
    color: '#3C3C43',
  },
  unavailableDoctor: {
    color: '#FF3B30',
  },
  unavailableItem: {
    fontSize: 17,
    color: '#FF3B30',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 17,
    color: '#8E8E93',
  },
});