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
  
  const censusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const casesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUnitCensus(details.unitCensus || '');
    setCases(details.cases || '');
  }, [details.unitCensus, details.cases]);

  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  const dayNum = date.getDate();

  const handleCensusChange = (text: string) => {
    setUnitCensus(text);
    
    if (censusDebounceRef.current) {
      clearTimeout(censusDebounceRef.current);
    }
    
    censusDebounceRef.current = setTimeout(() => {
      onUpdateDetails(text, cases);
    }, 500);
  };

  const handleCasesChange = (text: string) => {
    setCases(text);
    
    if (casesDebounceRef.current) {
      clearTimeout(casesDebounceRef.current);
    }
    
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
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>THIRD ATTENDING</Text>
          <DoctorPickerModal
            selectedDoctor={currentDoctor}
            onSelectDoctor={(doctor) => onUpdateDoctor(doctor || '')}
            doctors={doctors}
            includeNoneOption={true}
            placeholder="Select doctor"
            triggerStyle={styles.doctorPicker}
            triggerTextStyle={styles.doctorPickerText}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>UNIT CENSUS AT 7A</Text>
          <TextInput
            style={styles.textInput}
            value={unitCensus}
            onChangeText={handleCensusChange}
            placeholder="Enter census"
            placeholderTextColor="#C7C7CC"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>CASES</Text>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    gap: 16,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
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
  textInput: {
    fontSize: 17,
    color: '#000',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
});