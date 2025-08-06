import RequestManagementCard from '@/components/RequestManagementCard';
import { useAuth } from '@/contexts/AuthContext';
import authService from '@/services/auth';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [unavailability, setUnavailability] = useState<{ [doctor: string]: string[] }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await authService.authenticatedFetch('/api/unavailability');
      if (!response.ok) {
        throw new Error('Failed to load data');
      }
      const data = await response.json();
      setUnavailability(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddDates = async (doctor: string, dates: string[]) => {
    try {
      const response = await authService.authenticatedFetch('/api/unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor, dates }),
      });

      if (!response.ok) {
        throw new Error('Failed to add dates');
      }

      await loadData();
      Alert.alert('Success', `${dates.length} dates added successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save dates. Please try again.');
    }
  };

  const handleRemoveDate = async (doctor: string, date: string) => {
    try {
      const response = await authService.authenticatedFetch('/api/unavailability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor, date }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove date');
      }

      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to remove date. Please try again.');
    }
  };

  const getUpcomingQuarterStart = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const currentQuarter = Math.floor(currentMonth / 3);
    let nextQuarter = currentQuarter + 1;
    let year = currentYear;
    
    if (nextQuarter > 3) {
      nextQuarter = 0;
      year = currentYear + 1;
    }
    
    const firstMonthOfNextQuarter = nextQuarter * 3;
    return new Date(year, firstMonthOfNextQuarter, 1);
  };

  const getQuarterName = (date: Date) => {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const year = date.getFullYear();
    return `Q${quarter} ${year}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.statusBarBackground, { height: insets.top }]} />
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  const upcomingQuarterStart = getUpcomingQuarterStart();
  const quarterName = getQuarterName(upcomingQuarterStart);
  const userDoctor = user?.fullName || user?.username || '';

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarBackground, { height: insets.top }]} />
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{quarterName} Vacation Requests</Text>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#007AFF"
          />
        }
      >
        <RequestManagementCard
          doctor={userDoctor}
          unavailableDates={unavailability[userDoctor] || []}
          onAddDates={handleAddDates}
          onRemoveDate={handleRemoveDate}
          minDate={upcomingQuarterStart}
        />
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
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
  scrollView: {
    flex: 1,
  },
});