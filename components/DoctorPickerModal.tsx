import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DoctorPickerModalProps {
  selectedDoctor?: string;
  onSelectDoctor: (doctor?: string) => void;
  doctors: readonly string[];
  title?: string;
  includeAllOption?: boolean;
  includeNoneOption?: boolean;
  placeholder?: string;
  triggerStyle?: any;
  triggerTextStyle?: any;
}

export default function DoctorPickerModal({
  selectedDoctor,
  onSelectDoctor,
  doctors,
  title = 'Select Doctor',
  includeAllOption = false,
  includeNoneOption = false,
  placeholder = 'Select doctor',
  triggerStyle,
  triggerTextStyle,
}: DoctorPickerModalProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (modalVisible) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      fadeAnim.setValue(0);
      slideAnim.setValue(300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

  // Build options list
  const options: { value: string; display: string }[] = [];
  
  if (includeAllOption) {
    options.push({ value: '', display: 'All' });
  }
  
  if (includeNoneOption) {
    options.push({ value: '', display: 'None' });
  }
  
  options.push(...doctors.map(d => ({ value: d, display: d })));

  const handleClose = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
    });
  };

  const handleSelect = (value: string) => {
    onSelectDoctor(value || undefined);
    handleClose();
  };

  const getDisplayText = () => {
    if (!selectedDoctor) {
      if (includeAllOption) return 'All';
      if (includeNoneOption) return placeholder;
      return placeholder;
    }
    return selectedDoctor;
  };

  const isSelected = (optionValue: string) => {
    if (!selectedDoctor && optionValue === '') return true;
    return optionValue === selectedDoctor;
  };

  // Determine if we should show placeholder styling
  const isPlaceholder = !selectedDoctor && (includeNoneOption || (!includeAllOption && !selectedDoctor));

  // Determine the chevron color - simplified logic
  const getChevronColor = () => {
    // Special case: Schedule header passes blue color for filter
    if (triggerTextStyle?.color === '#007AFF') {
      return '#007AFF';
    }
    
    // Default: iOS standard gray chevron for all other contexts
    // This matches iOS Settings, forms, and standard UI patterns
    return '#C7C7CC';
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.defaultTrigger, triggerStyle]}
        onPress={() => setModalVisible(true)}
      >
        {/* Only show filter icon if specifically requested and using default styles */}
        {includeAllOption && !triggerStyle && (
          <Ionicons name="filter" size={18} color="#007AFF" />
        )}
        
        <Text style={[
          styles.defaultTriggerText,
          triggerTextStyle,
          isPlaceholder && styles.placeholderText
        ]}>
          {getDisplayText()}
        </Text>
        
        {/* Chevron: gray by default, blue only for header filters */}
        <Ionicons 
          name={triggerStyle ? "chevron-forward" : "chevron-down"} 
          size={triggerStyle ? 20 : 14} 
          color={getChevronColor()} 
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        onRequestClose={handleClose}
      >
        <Animated.View 
          style={[styles.modalOverlay, { opacity: fadeAnim }]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={handleClose}
          />
          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={handleClose}
                style={styles.headerButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{title}</Text>
              <View style={styles.headerButton} />
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value || 'empty'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text style={[
                    styles.optionText,
                    isSelected(item.value) && styles.selectedOption
                  ]}>
                    {item.display}
                  </Text>
                  {isSelected(item.value) && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
            />
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Minimal default styles - only structure, no visual design
  defaultTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // NO background color
    // NO border radius
    // NO padding (let parent decide)
  },
  defaultTriggerText: {
    fontSize: 17,
    color: '#000',
    flex: 1,
    // NO font weight (let parent decide)
  },
  placeholderText: {
    color: '#C7C7CC',
  },
  
  // Modal styles (these are fine as they're internal to the component)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerButton: {
    minWidth: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  list: {
    backgroundColor: 'white',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
  },
  optionText: {
    fontSize: 16,
    color: '#000',
  },
  selectedOption: {
    color: '#007AFF',
    fontWeight: '500',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginLeft: 20,
  },
});