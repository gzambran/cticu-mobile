import api from '@/services/api';
import { Schedule, ShiftChange, ShiftType } from '@/types';
import { formatDate } from '@/utils/date';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DoctorPickerModal from './DoctorPickerModal';

interface SwapRow {
  id: number;
  fromDoctor?: string;
  toDoctor?: string;
  selectedShifts: { date: string; shift: ShiftType }[];
}

interface SwapRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (shifts: ShiftChange[], notes?: string) => Promise<void>;
  doctors: string[];
  currentUser?: { username: string; fullName?: string };
}

export default function SwapRequestModal({
  visible,
  onClose,
  onSubmit,
  doctors,
  currentUser,
}: SwapRequestModalProps) {
  const insets = useSafeAreaInsets();
  const [swapRows, setSwapRows] = useState<SwapRow[]>([{ id: 1, selectedShifts: [] }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<Schedule>({});
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCurrentQuarterSchedules();
    }
  }, [visible]);

  const loadCurrentQuarterSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      const currentQuarter = Math.floor(currentMonth / 3);
      const quarterStartMonth = currentQuarter * 3;
      const quarterEndMonth = quarterStartMonth + 2;
      
      const startDate = new Date(currentYear, quarterStartMonth, 1);
      const endDate = new Date(currentYear, quarterEndMonth + 1, 0);
      
      const schedulesData = await api.getSchedules(
        formatDate(startDate),
        formatDate(endDate)
      );
      setSchedules(schedulesData);
    } catch (error) {
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
    // Validate
    const validSwaps = swapRows.filter(
      row => row.fromDoctor && row.toDoctor && row.selectedShifts.length > 0
    );

    if (validSwaps.length === 0) {
      Alert.alert('Error', 'Please complete at least one swap');
      return;
    }

    // Build shift changes
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
      // Reset form
      setSwapRows([{ id: 1, selectedShifts: [] }]);
      setNotes('');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit swap request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Swap Request</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={loading}>
            <Text style={[styles.submitButton, loading && styles.disabledButton]}>
              Submit
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {swapRows.map((row, index) => {
            const availableShifts = row.fromDoctor ? getDoctorShifts(row.fromDoctor) : [];
            
            return (
              <View key={row.id} style={styles.swapRow}>
                <View style={styles.swapHeader}>
                  <Text style={styles.swapTitle}>Swap {index + 1}</Text>
                  {swapRows.length > 1 && (
                    <TouchableOpacity onPress={() => removeSwapRow(row.id)}>
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>From:</Text>
                  <DoctorPickerModal
                    selectedDoctor={row.fromDoctor}
                    onSelectDoctor={(doctor) => updateSwapRow(row.id, { 
                      fromDoctor: doctor,
                      selectedShifts: [] // Reset shifts when doctor changes
                    })}
                    doctors={doctors}
                    includeAllOption={false}
                  />
                </View>

                {row.fromDoctor && availableShifts.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Select Shifts:</Text>
                    <View style={styles.shiftsList}>
                      {availableShifts.map(({ date, shift }) => {
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
                              {new Date(date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })} - {shift}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>To:</Text>
                  <DoctorPickerModal
                    selectedDoctor={row.toDoctor}
                    onSelectDoctor={(doctor) => updateSwapRow(row.id, { toDoctor: doctor })}
                    doctors={doctors.filter(d => d !== row.fromDoctor)}
                    includeAllOption={false}
                  />
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addButton} onPress={addSwapRow}>
            <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
            <Text style={styles.addButtonText}>Add Another Swap</Text>
          </TouchableOpacity>

          <View style={styles.notesField}>
            <Text style={styles.fieldLabel}>Notes (optional):</Text>
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
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  submitButton: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledButton: {
    color: '#C7C7CC',
  },
  content: {
    flex: 1,
  },
  swapRow: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  swapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  swapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 8,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  notesField: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
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
});