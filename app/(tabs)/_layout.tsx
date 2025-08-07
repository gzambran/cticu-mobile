import { useAuth } from '@/contexts/AuthContext';
import useNotificationStore from '@/stores/notificationStore';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';

export default function TabLayout() {
  const { user } = useAuth();
  
  // Get badge counts from the store
  const swapBadgeCount = useNotificationStore(state => state.swapBadgeCount);
  const requestsBadgeCount = useNotificationStore(state => state.requestsBadgeCount);
  const fetchAndUpdateBadges = useNotificationStore(state => state.fetchAndUpdateBadges);
  
  // Fetch badges on mount and when app comes to foreground
  useEffect(() => {
    if (user) {
      // Initial fetch when component mounts
      fetchAndUpdateBadges(user.username, user.role);
      
      // Handle app state changes - refresh when app comes to foreground
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          // App has come to the foreground
          fetchAndUpdateBadges(user.username, user.role);
        }
      });
      
      return () => {
        subscription.remove();
      };
    }
  }, [user?.username, user?.role]); // Only re-run if user changes

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',  // iOS blue for active items
        tabBarInactiveTintColor: '#8E8E93', // iOS system gray for inactive
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',        // Clean white background
          borderTopColor: '#E5E5EA',        // Light gray border (iOS system separator color)
          borderTopWidth: 0.5,              // Hairline border
          elevation: 0,                      // Remove Android shadow
          shadowOpacity: 0,                  // Remove iOS shadow for cleaner look
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Schedule',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="swing-shifts"
        options={{
          title: 'Swing',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-buoy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          title: 'Swap',
          headerShown: false,
          tabBarBadge: swapBadgeCount > 0 ? swapBadgeCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          headerShown: false,
          tabBarBadge: requestsBadgeCount > 0 ? requestsBadgeCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}