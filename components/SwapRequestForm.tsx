import api from '@/services/api';
import { Schedule, ShiftChange, ShiftType } from '@/types';
import { formatDate, parseDate } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DoctorPickerModal from './DoctorPickerModal';

interface SwapRow {
  id: number;
  fromDoctor?: string;
  toDoctor?: string;
  selectedShifts: { date: string; shift: ShiftType }[];
}

interface SwapRequestFormProps {
  onSubmit: (shifts: ShiftChange[], notes?: string) => Promise<void>;
  doctors: string[];
  currentUser?: { username: string; fullName?: string };
}

export default function SwapRequestForm({
  onSubmit,
  doctors,
  currentUser,
}: SwapRequestFormProps) {
  const [swapRows, setSwapRows] = useState<SwapRow[]>([{ id: 1, selectedShifts: [] }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<Schedule>({});
  const [, setLoadingSchedules] = useState(false);

  useEffect(() => {
    loadCurrentAndNextQuarterSchedules();
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSwapRows([{ id: 1, selectedShifts: [] }]);
        setNotes('');
      };
    }, [])
  );

  const loadCurrentAndNextQuarterSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      const currentQuarter = Math.floor(currentMonth / 3);
      const quarterStartMonth = currentQuarter * 3;
      
      const startDate = new Date(currentYear, quarterStartMonth, 1);
      
      let nextQuarter = currentQuarter + 1;
      let nextQuarterYear = currentYear;
      if (nextQuarter > 3) {
        nextQuarter = 0;
        nextQuarterYear = currentYear + 1;
      }
      
      const nextQuarterEndMonth = (nextQuarter * 3) + 2;
      const endDate = new Date(nextQuarterYear, nextQuarterEndMonth + 1, 0);
      
      const schedulesData = await api.getSchedules(
        formatDate(startDate),
        formatDate(endDate),
        false,
        ['5C', '5W', 'Night'] as any
      );
      setSchedules(schedulesData);
    } catch {
      Alert.alert('Error', 'Failed to load schedules');
    } finally {
      setLoadingSchedules(false);
    }
  };

  const getDoctorShifts = (doctorName: string): { date: string; shift: ShiftType }[] => {
    const shifts: { date: string; shift: ShiftType }[] = [];
    
    Object.entries(schedules).forEach(([date, daySchedule]) => {
      Object.entries(daySchedule).forEach(([shiftType, assignedDoctor]) => {
        if (assignedDoctor === doctorName) {
          shifts.push({ date, shift: shiftType as ShiftType });
        }
      });
    });
    
    return shifts.sort((a, b) => a.date.localeCompare(b.date));
  };

  const groupShiftsByMonth = (shifts: { date: string; shift: ShiftType }[]) => {
    const grouped = new Map<string, { month: number; year: number; shifts: { date: string; shift: ShiftType }[] }>();
    
    shifts.forEach(({ date, shift }) => {
      const d = new Date(date);
      const month = d.getMonth();
      const year = d.getFullYear();
      const key = `${year}-${month}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, { month, year, shifts: [] });
      }
      grouped.get(key)!.shifts.push({ date, shift });
    });
    
    return Array.from(grouped.values());
  };

  const addSwapRow = () => {
    const newId = Math.max(...swapRows.map(r => r.id)) + 1;
    setSwapRows([...swapRows, { id: newId, selectedShifts: [] }]);
  };

  const removeSwapRow = (id: number) => {
    if (swapRows.length > 1) {
      setSwapRows(swapRows.filter(row => row.id !== id));
    }
  };

  const updateSwapRow = (id: number, updates: Partial<SwapRow>) => {
    setSwapRows(swapRows.map(row => 
      row.id === id ? { ...row, ...updates } : row
    ));
  };

  const toggleShiftSelection = (rowId: number, date: string, shift: ShiftType) => {
    const row = swapRows.find(r => r.id === rowId);
    if (!row) return;

    const isSelected = row.selectedShifts.some(
      s => s.date === date && s.shift === shift
    );

    if (isSelected) {
      updateSwapRow(rowId, {
        selectedShifts: row.selectedShifts.filter(
          s => !(s.date === date && s.shift === shift)
        ),
      });
    } else {
      updateSwapRow(rowId, {
        selectedShifts: [...row.selectedShifts, { date, shift }],
      });
    }
  };

  const handleSubmit = async () => {
    const validSwaps = swapRows.filter(
      row => row.fromDoctor && row.toDoctor && row.selectedShifts.length > 0
    );

    if (validSwaps.length === 0) {
      Alert.alert('Error', 'Please complete at least one swap');
      return;
    }

    const shifts: ShiftChange[] = [];
    validSwaps.forEach(row => {
      row.selectedShifts.forEach(({ date, shift }) => {
        shifts.push({
          date,
          shift_type: shift,
          from_doctor: row.fromDoctor!,
          to_doctor: row.toDoctor!,
        });
      });
    });

    setLoading(true);
    try {
      await onSubmit(shifts, notes || undefined);
      setSwapRows([{ id: 1, selectedShifts: [] }]);
      setNotes('');
    } catch {
      Alert.alert('Error', 'Failed to submit swap request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {swapRows.map((row, index) => {
        const availableShifts = row.fromDoctor ? getDoctorShifts(row.fromDoctor) : [];
        
        return (
          <View key={row.id} style={styles.swapRow}>
            {swapRows.length > 1 && (
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => removeSwapRow(row.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            )}

            <View style={styles.doctorField}>
              <Text style={styles.fieldLabel}>FROM</Text>
              <DoctorPickerModal
                selectedDoctor={row.fromDoctor}
                onSelectDoctor={(doctor) => updateSwapRow(row.id, { 
                  fromDoctor: doctor,
                  selectedShifts: []
                })}
                doctors={doctors}
                includeAllOption={false}
                triggerStyle={styles.doctorPicker}
                triggerTextStyle={styles.doctorPickerText}
              />
            </View>

            {row.fromDoctor && availableShifts.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>SELECT SHIFTS</Text>
                <ScrollView 
                  style={styles.shiftsContainer}
                  horizontal={false}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {groupShiftsByMonth(availableShifts).map(({ month, year, shifts }) => (
                    <View key={`${year}-${month}`} style={styles.monthGroup}>
                      <Text style={styles.monthHeader}>
                        {new Date(year, month).toLocaleDateString('en-US', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </Text>
                      <View style={styles.shiftsList}>
                        {shifts.map(({ date, shift }) => {
                          const isSelected = row.selectedShifts.some(
                            s => s.date === date && s.shift === shift
                          );
                          return (
                            <TouchableOpacity
                              key={`${date}-${shift}`}
                              style={[styles.shiftOption, isSelected && styles.shiftSelected]}
                              onPress={() => toggleShiftSelection(row.id, date, shift)}
                            >
                              <Text style={[styles.shiftText, isSelected && styles.shiftTextSelected]}>
                                {parseDate(date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })} - {shift}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.doctorField}>
              <Text style={styles.fieldLabel}>TO</Text>
              <DoctorPickerModal
                selectedDoctor={row.toDoctor}
                onSelectDoctor={(doctor) => updateSwapRow(row.id, { toDoctor: doctor })}
                doctors={doctors.filter(d => d !== row.fromDoctor)}
                includeAllOption={false}
                triggerStyle={styles.doctorPicker}
                triggerTextStyle={styles.doctorPickerText}
              />
            </View>

            {index < swapRows.length - 1 && <View style={styles.divider} />}
          </View>
        );
      })}

      <TouchableOpacity style={styles.addButton} onPress={addSwapRow}>
        <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
        <Text style={styles.addButtonText}>Add Another Swap</Text>
      </TouchableOpacity>

      <View style={styles.notesField}>
        <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any additional information..."
          multiline
          maxLength={200}
        />
        <Text style={styles.charCount}>{notes.length}/200</Text>
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="white" />
            <Text style={styles.submitButtonText}>Submit Request</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  swapRow: {
    position: 'relative',
    marginBottom: 16,
  },
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 1,
    padding: 4,
  },
  doctorField: {
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  doctorPicker: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  doctorPickerText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000',
  },
  shiftsContainer: {
    maxHeight: 180,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
  },
  monthGroup: {
    marginBottom: 16,
  },
  monthHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  shiftsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shiftOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C6C6C8',
    backgroundColor: 'white',
  },
  shiftSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  shiftText: {
    fontSize: 14,
    color: '#000',
  },
  shiftTextSelected: {
    color: 'white',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginTop: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  notesField: {
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 15,
  },
  charCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
});