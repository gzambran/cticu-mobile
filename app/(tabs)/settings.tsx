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
    } catch {
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
            } catch {
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
        {/* ACCOUNT Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ACCOUNT</Text>
          
          <View style={styles.cardContent}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="person-circle-outline" size={20} color="#007AFF" />
                <Text style={styles.settingText}>Username</Text>
              </View>
              <Text style={styles.settingValue}>{user?.username || 'Unknown'}</Text>
            </View>
            
            <View style={styles.divider} />
            
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
            
            <View style={styles.divider} />
            
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
        </View>

        {/* PREFERENCES Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PREFERENCES</Text>
          
          <View style={styles.cardContent}>
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
            
            <View style={styles.divider} />
            
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
        </View>

        {/* MORE Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MORE</Text>
          
          <View style={styles.cardContent}>
            <TouchableOpacity style={styles.settingRow} onPress={handleClearCache}>
              <View style={styles.settingInfo}>
                <Ionicons name="trash-outline" size={20} color="#007AFF" />
                <Text style={styles.settingText}>Clear Cache</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity style={styles.settingRow} onPress={handleOpenWeb}>
              <View style={styles.settingInfo}>
                <Ionicons name="globe-outline" size={20} color="#007AFF" />
                <Text style={styles.settingText}>View on Web</Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Version at the bottom - Apple style */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.1.1</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardContent: {
    paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingText: {
    fontSize: 17,
    color: '#000',
  },
  settingValue: {
    fontSize: 17,
    color: '#8E8E93',
    fontWeight: 'normal',
    flex: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginLeft: 48,
  },
  doctorPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 8,
    maxWidth: 120,
  },
  versionContainer: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 13,
    color: '#8E8E93',
  },
});