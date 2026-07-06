import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EVENT_DOT_COLOR, SHIFT_COLORS, ShiftType } from '../types';
import { isToday } from '../utils/date';

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
  hasEvent?: boolean;
  eventIndicatorText?: string;
  onPress: () => void;
}

export default function DayCell({
  date,
  schedule,
  holiday,
  selectedDoctor,
  isSelected,
  hasEvent,
  eventIndicatorText,
  onPress,
}: DayCellProps) {
  if (!date) {
    return <View style={styles.emptyCell} />;
  }

  const dayNumber = date.getDate();
  const isCurrentDay = isToday(date);

  // If a doctor is selected, find ALL their shifts for this day
  const doctorShifts: { type: ShiftType; label: string }[] = [];
  if (selectedDoctor && schedule) {
    // Define the order we want to display shifts
    const shiftOrder: ShiftType[] = ['5C', '5W', 'Swing', 'Night'];
    
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
            {hasEvent && (
              eventIndicatorText ? (
                <Text style={[styles.eventIndicatorText, { marginTop: 2 }]}>{eventIndicatorText}</Text>
              ) : (
                <View style={[styles.eventDot, { marginTop: 2 }]} />
              )
            )}
          </View>
        ) : (
          hasEvent && (
            <View style={styles.dotsContainer}>
              {eventIndicatorText ? (
                <Text style={styles.eventIndicatorText}>{eventIndicatorText}</Text>
              ) : (
                <View style={styles.eventDot} />
              )}
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
  dotsContainer: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EVENT_DOT_COLOR,
  },
  eventIndicatorText: {
    fontSize: 9,
    fontWeight: '700',
    color: EVENT_DOT_COLOR,
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