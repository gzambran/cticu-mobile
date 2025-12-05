import { useAuth } from '@/contexts/AuthContext';
import { DoctorsProvider } from '@/contexts/DoctorsContext';
import { FilterProvider } from '@/contexts/FilterContext';
import useNotificationStore from '@/stores/notificationStore';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import React, { createContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Create a context for foreground events
interface ForegroundContextType {
  lastForegroundTime: Date;
  isComingFromBackground: boolean;
}

export const ForegroundContext = createContext<ForegroundContextType>({
  lastForegroundTime: new Date(),
  isComingFromBackground: false,
});

export default function TabLayout() {
  const { user } = useAuth();
  const pathname = usePathname();
  
  // Get badge counts from the store
  const swapBadgeCount = useNotificationStore(state => state.swapBadgeCount);
  const requestsBadgeCount = useNotificationStore(state => state.requestsBadgeCount);
  const fetchAndUpdateBadges = useNotificationStore(state => state.fetchAndUpdateBadges);
  
  // Foreground context state
  const [lastForegroundTime, setLastForegroundTime] = useState(new Date());
  const [isComingFromBackground, setIsComingFromBackground] = useState(false);
  const lastKnownDateRef = useRef(new Date().toDateString());
  
  // Refresh badges when tab changes
  useEffect(() => {
    if (user && pathname) {
      // Small delay to ensure smooth tab transition
      const timer = setTimeout(() => {
        fetchAndUpdateBadges(user.username, user.role, user.doctorCode);
      }, 100);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user?.username, user?.role, user?.doctorCode]);
  
  // Single AppState handler for all foreground needs
  useEffect(() => {
    if (user) {
      // Initial fetch when component mounts
      fetchAndUpdateBadges(user.username, user.role, user.doctorCode);
      
      // Handle app state changes
      const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          const now = new Date();
          const todayString = now.toDateString();
          
          // Check if date has changed
          const dateChanged = todayString !== lastKnownDateRef.current;
          if (dateChanged) {
            lastKnownDateRef.current = todayString;
          }
          
          // Update foreground context to trigger updates in child components
          setLastForegroundTime(now);
          setIsComingFromBackground(true);
          
          // Reset the flag after a brief moment
          setTimeout(() => setIsComingFromBackground(false), 100);
          
          // Fetch badges
          fetchAndUpdateBadges(user.username, user.role, user.doctorCode);
        }
      });
      
      return () => {
        subscription.remove();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, user?.role, user?.doctorCode]);

  return (
    <DoctorsProvider>
      <FilterProvider>
        <ForegroundContext.Provider value={{ lastForegroundTime, isComingFromBackground }}>
          <Tabs
            screenOptions={{
              tabBarActiveTintColor: '#007AFF',
              tabBarInactiveTintColor: '#8E8E93',
              headerShown: false,
              tabBarStyle: {
                backgroundColor: '#FFFFFF',
                borderTopColor: '#E5E5EA',
                borderTopWidth: 0.5,
                elevation: 0,
                shadowOpacity: 0,
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
        </ForegroundContext.Provider>
      </FilterProvider>
    </DoctorsProvider>
  );
}