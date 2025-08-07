import DoctorPickerModal from '@/components/DoctorPickerModal';
import PasswordChangeModal from '@/components/PasswordChangeModal';
import { useAuth } from '@/contexts/AuthContext';
import { useDoctors } from '@/contexts/DoctorsContext';
import { useFilter } from '@/contexts/FilterContext';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuth();
  const { defaultDoctor, setDefaultDoctor } = useFilter();
  const { doctors } = useDoctors();
  const [firstDayMonday, setFirstDayMonday] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const firstDay = await AsyncStorage.getItem('first_day_monday');
      if (firstDay !== null) {
        setFirstDayMonday(JSON.parse(firstDay));
      }
    } catch (error) {
      // Settings load error - use defaults
    }
  };

  const toggleFirstDay = async (value: boolean) => {
    setFirstDayMonday(value);
    await AsyncStorage.setItem('first_day_monday', JSON.stringify(value));
  };

  const handleSelectDefaultDoctor = async (doctor: string) => {
    await setDefaultDoctor(doctor || 'All');
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached schedule data. You will need an internet connection to reload.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.clearCache();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const handleOpenWeb = () => {
    Linking.openURL('https://cticu.zambrano.nyc');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarBackground, { height: insets.top }]} />
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="person-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.settingText}>Username</Text>
            </View>
            <Text style={styles.settingValue}>{user?.username || 'Unknown'}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.settingRow} 
            onPress={() => setPasswordModalVisible(true)}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="key-outline" size={20} color="#007AFF" />
              <Text style={styles.settingText}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingRow} 
            onPress={handleSignOut}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
              <Text style={[styles.settingText, { color: '#FF3B30' }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              <Text style={styles.settingText}>Start Week on Monday</Text>
            </View>
            <Switch
              value={firstDayMonday}
              onValueChange={toggleFirstDay}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor="#f4f3f4"
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="person-outline" size={20} color="#007AFF" />
              <Text style={styles.settingText}>Default Calendar View</Text>
            </View>
            <DoctorPickerModal
              selectedDoctor={defaultDoctor}
              onSelectDoctor={(doctor) => handleSelectDefaultDoctor(doctor || 'All')}
              doctors={doctors}
              includeAllOption={true}
              triggerStyle={styles.doctorPickerTrigger}
              triggerTextStyle={styles.settingValue}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA</Text>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleClearCache}>
            <View style={styles.settingInfo}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.settingText, { color: '#FF3B30' }]}>Clear Cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WEB</Text>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleOpenWeb}>
            <View style={styles.settingInfo}>
              <Ionicons name="globe-outline" size={20} color="#007AFF" />
              <Text style={styles.settingText}>View on Web</Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Version</Text>
            <Text style={styles.settingValue}>1.1.0</Text>
          </View>
        </View>
      </ScrollView>

      <PasswordChangeModal 
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  statusBarBackground: {
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 35,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 17,
    color: '#000',
  },
  settingValue: {
    fontSize: 17,
    color: '#8E8E93',
    fontWeight: 'normal',
  },
  doctorPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 8,
  },
});