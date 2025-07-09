import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DoctorPickerModal from './DoctorPickerModal';

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
  const [unitCensus, setUnitCensus] = useState(details.unitCensus || '');
  const [cases, setCases] = useState(details.cases || '');
  
  // Use ReturnType<typeof setTimeout> for React Native compatibility
  const censusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const casesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update local state when props change (e.g., after pull-to-refresh)
  useEffect(() => {
    setUnitCensus(details.unitCensus || '');
    setCases(details.cases || '');
  }, [details.unitCensus, details.cases]);

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

  return (
    <View style={styles.card}>
      <View style={styles.dateSection}>
        <Text style={styles.dateText}>{dayName} {monthName} {dayNum}</Text>
      </View>
      
      <View style={styles.fieldsContainer}>
        <View style={styles.doctorField}>
          <Text style={styles.fieldLabel}>Third Attending</Text>
          <DoctorPickerModal
            selectedDoctor={currentDoctor}
            onSelectDoctor={(doctor) => onUpdateDoctor(doctor || '')}
            doctors={doctors}
            includeNoneOption={true}
            placeholder="Select doctor"
            triggerStyle={styles.doctorSelector}
            triggerTextStyle={styles.doctorText}
          />
        </View>

        <View style={styles.inputField}>
          <Text style={styles.fieldLabel}>Unit Census at 7a</Text>
          <TextInput
            style={styles.textInput}
            value={unitCensus}
            onChangeText={handleCensusChange}
            placeholder="Enter census"
            placeholderTextColor="#C7C7CC"
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
    fontWeight: 'normal',
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 15,
    color: '#000',
  },
});