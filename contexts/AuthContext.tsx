import authService, { NetworkError } from '@/services/auth';
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

  useEffect(() => {
    // Handle navigation based on auth state
    const inTabsScreen = segments[0] === '(tabs)';
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
      setIsAuthenticated(false);
      setUser(null);
      // The useEffect will handle navigation
    } catch (error) {
      if (__DEV__ && error instanceof Error) {
        console.error('Sign out error:', error.message);
      }
      // Even if logout fails, clear local state
      setIsAuthenticated(false);
      setUser(null);
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