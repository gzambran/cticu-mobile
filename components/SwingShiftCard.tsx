import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface SwingShiftCardProps {
  date: Date;
  doctors: string[];
  currentDoctor?: string;
  details: {
    unitCensus?: string;
    cases?: string;
  };
  onUpdateDoctor: (doctor: string) => void;
  onUpdateDetails: (unitCensus: string, cases: string) => void;
}

export default function SwingShiftCard({
  date,
  doctors,
  currentDoctor,
  details,
  onUpdateDoctor,
  onUpdateDetails,
}: SwingShiftCardProps) {
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);
  const [unitCensus, setUnitCensus] = useState(details.unitCensus || '');
  const [cases, setCases] = useState(details.cases || '');
  
  // Use ReturnType<typeof setTimeout> for React Native compatibility
  const censusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const casesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  const dayNum = date.getDate();

  const handleCensusChange = (text: string) => {
    setUnitCensus(text);
    
    // Clear existing timeout
    if (censusDebounceRef.current) {
      clearTimeout(censusDebounceRef.current);
    }
    
    // Set new timeout
    censusDebounceRef.current = setTimeout(() => {
      onUpdateDetails(text, cases);
    }, 500);
  };

  const handleCasesChange = (text: string) => {
    setCases(text);
    
    // Clear existing timeout
    if (casesDebounceRef.current) {
      clearTimeout(casesDebounceRef.current);
    }
    
    // Set new timeout
    casesDebounceRef.current = setTimeout(() => {
      onUpdateDetails(unitCensus, text);
    }, 500);
  };

  const renderDoctorPicker = () => (
    <Modal
      visible={showDoctorPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDoctorPicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowDoctorPicker(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Doctor</Text>
            <TouchableOpacity onPress={() => setShowDoctorPicker(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={[{ name: '', display: 'None' }, ...doctors.map(d => ({ name: d, display: d }))]}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.doctorOption}
                onPress={() => {
                  onUpdateDoctor(item.name);
                  setShowDoctorPicker(false);
                }}
              >
                <Text style={[
                  styles.doctorOptionText,
                  item.name === currentDoctor && styles.selectedDoctor
                ]}>
                  {item.display}
                </Text>
                {item.name === currentDoctor && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.card}>
      <View style={styles.dateSection}>
        <Text style={styles.dateText}>{dayName} {monthName} {dayNum}</Text>
      </View>
      
      <View style={styles.fieldsContainer}>
        <TouchableOpacity
          style={styles.doctorField}
          onPress={() => setShowDoctorPicker(true)}
        >
          <Text style={styles.fieldLabel}>Third Attending</Text>
          <View style={styles.doctorSelector}>
            <Text style={[styles.doctorText, !currentDoctor && styles.placeholder]}>
              {currentDoctor || 'Select doctor'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#8E8E93" />
          </View>
        </TouchableOpacity>

        <View style={styles.inputField}>
          <Text style={styles.fieldLabel}>Unit Census at 7a</Text>
          <TextInput
            style={styles.textInput}
            value={unitCensus}
            onChangeText={handleCensusChange}
            placeholder="Enter census"
            placeholderTextColor="#C7C7CC"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputField}>
          <Text style={styles.fieldLabel}>Cases</Text>
          <TextInput
            style={styles.textInput}
            value={cases}
            onChangeText={handleCasesChange}
            placeholder="Enter cases"
            placeholderTextColor="#C7C7CC"
          />
        </View>
      </View>

      {renderDoctorPicker()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dateSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  fieldsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  doctorField: {
    gap: 4,
  },
  inputField: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  doctorSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  doctorText: {
    fontSize: 15,
    color: '#000',
  },
  placeholder: {
    color: '#C7C7CC',
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 15,
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
    maxHeight: '70%',
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
  doctorOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  doctorOptionText: {
    fontSize: 16,
    color: '#000',
  },
  selectedDoctor: {
    color: '#007AFF',
    fontWeight: '500',
  },
});