import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SHIFT_COLORS, ShiftType } from '../types';
import { formatDate, isToday } from '../utils/date';

interface DayCellProps {
  date: Date | null;
  schedule?: {
    '5W'?: string;
    '5C'?: string;
    Night?: string;
    Swing?: string;
  };
  holiday?: string;
  selectedDoctor?: string;
  isSelected?: boolean;
  onPress: () => void;
}

export default function DayCell({
  date,
  schedule,
  holiday,
  selectedDoctor,
  isSelected,
  onPress,
}: DayCellProps) {
  if (!date) {
    return <View style={styles.emptyCell} />;
  }

  const dayNumber = date.getDate();
  const isCurrentDay = isToday(date);
  const dateStr = formatDate(date);

  // Check if there's a Swing shift for this date
  const hasSwingShift = schedule?.Swing ? true : false;

  // If a doctor is selected, find ALL their shifts for this day
  const doctorShifts: { type: ShiftType; label: string }[] = [];
  if (selectedDoctor && schedule) {
    // Define the order we want to display shifts
    const shiftOrder: ShiftType[] = ['5C', '5W', 'Night', 'Swing'];
    
    shiftOrder.forEach(shiftType => {
      if (schedule[shiftType] === selectedDoctor) {
        // Convert to abbreviated form
        const label = shiftType === 'Night' ? 'N' : shiftType === 'Swing' ? 'S' : shiftType;
        doctorShifts.push({ type: shiftType, label });
      }
    });
  }

  return (
    <TouchableOpacity 
      style={[
        styles.cell, 
        isSelected && styles.selectedCell
      ]} 
      onPress={onPress}
    >
      <View style={styles.cellContent}>
        <Text style={[
          styles.dayNumber, 
          isCurrentDay && styles.todayNumber,
          isSelected && styles.selectedDayNumber
        ]}>
          {dayNumber}
        </Text>
        
        {holiday && (
          <Text style={styles.holidayStar}>⭐</Text>
        )}

        {selectedDoctor && doctorShifts.length > 0 ? (
          <View style={styles.shiftsContainer}>
            {doctorShifts.map(({ type, label }, index) => (
              <Text 
                key={type}
                style={[
                  styles.shiftLabel,
                  { color: SHIFT_COLORS[type] },
                  index > 0 && styles.additionalShift
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
        ) : (
          hasSwingShift && !selectedDoctor && (
            <View style={styles.swingDotContainer}>
              <View style={[styles.swingDot, { backgroundColor: SHIFT_COLORS.Swing }]} />
            </View>
          )
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 4,
  },
  selectedCell: {
    backgroundColor: '#007AFF15',
    borderRadius: 8,
  },
  cellContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emptyCell: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayNumber: {
    fontSize: 16,
    color: '#000',
  },
  todayNumber: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  selectedDayNumber: {
    color: '#007AFF',
  },
  holidayStar: {
    fontSize: 10,
    position: 'absolute',
    top: -2,
    right: -2,
  },
  swingDotContainer: {
    marginTop: 4,
  },
  swingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  shiftsContainer: {
    marginTop: 2,
    flexDirection: 'column',
    alignItems: 'center',
  },
  shiftLabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 11,
  },
  additionalShift: {
    marginTop: 1,
  },
});