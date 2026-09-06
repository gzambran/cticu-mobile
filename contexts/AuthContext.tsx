import authService, { NetworkError } from '@/services/auth';
import useNotificationStore from '@/stores/notificationStore';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  signIn: (username: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // authService clears the stored token the moment the server rejects it. Without
  // this the context would keep reporting a signed-in user, and every screen would
  // quietly fall back to cached data instead of prompting a fresh sign-in.
  useEffect(() => {
    authService.setSessionRejectedHandler(() => {
      setUser(null);
      setIsAuthenticated(false);
    });
    return () => authService.setSessionRejectedHandler(null);
  }, []);

  useEffect(() => {
    // Handle navigation based on auth state
    const inLoginScreen = segments[0] === 'login';
    
    if (!isLoading) {
      if (!isAuthenticated && !inLoginScreen) {
        // Redirect to login if not authenticated
        router.replace('/login');
      } else if (isAuthenticated && inLoginScreen) {
        // Redirect to tabs if authenticated
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, segments, isLoading]);

  const checkAuthStatus = async () => {
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        const userInfo = await authService.getUser();
        setUser(userInfo);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (username: string, password: string): Promise<boolean> => {
    try {
      const success = await authService.login(username, password);
      if (success) {
        const userInfo = await authService.getUser();
        setUser(userInfo);
        setIsAuthenticated(true);
      }
      return success;
    } catch (error) {
      // Re-throw network errors so the UI can handle them appropriately
      if (error instanceof NetworkError) {
        throw error;
      }
      
      // Log auth errors in development
      if (__DEV__ && error instanceof Error) {
        console.error('Sign in error:', error.message);
      }
      
      return false;
    }
  };

  const signOut = async () => {
    try {
      await authService.logout();
      // The useEffect will handle navigation
    } catch (error) {
      if (__DEV__ && error instanceof Error) {
        console.error('Sign out error:', error.message);
      }
      // Even if logout fails, clear local state below anyway
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      // seenRequestStates and pendingRequests are in-memory only and otherwise
      // outlive the session: a pending request involving the next signed-in user
      // would inherit whatever the previous user had already seen (or not) on a
      // shared device.
      useNotificationStore.getState().resetStore();
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}