import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import config from '../config';

const API_BASE_URL = config.API_BASE_URL;
const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_info';

// Define custom error types for better error handling
export class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

class AuthService {
  private authToken: string | null = null;

  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const responseText = await response.text();

      if (response.ok) {
        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new AuthError('Invalid response from server');
        }
        
        if (!data.token) {
          throw new AuthError('No authentication token received');
        }
        
        // Store token securely
        this.authToken = data.token;
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
        
        // Store user info
        if (data.user) {
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
        
        return true;
      }

      // Handle specific error responses
      if (response.status === 401) {
        return false; // Invalid credentials
      }

      throw new AuthError(`Login failed with status: ${response.status}`);
    } catch (error) {
      // Type-safe error handling
      if (error instanceof AuthError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message === 'Network request failed') {
        throw new NetworkError('Unable to connect to server. Please check your internet connection.');
      }
      
      if (error instanceof Error) {
        // Log error in development only
        if (__DEV__) {
          console.error('Login error:', error.message);
        }
        throw new AuthError(`Login failed: ${error.message}`);
      }
      
      // Unknown error
      throw new AuthError('An unexpected error occurred during login');
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const response = await this.authenticatedFetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const responseText = await response.text();
      
      if (response.ok) {
        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new AuthError('Invalid response from server');
        }
        
        return data.success === true;
      }

      // Parse error response
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        throw new AuthError('Failed to change password');
      }

      // Handle specific error messages
      if (response.status === 401 && errorData.error === 'Current password is incorrect') {
        throw new AuthError('Current password is incorrect');
      }
      
      if (response.status === 400) {
        throw new AuthError(errorData.error || 'Invalid password');
      }

      throw new AuthError(errorData.error || `Failed with status: ${response.status}`);
    } catch (error) {
      // Re-throw AuthError as is
      if (error instanceof AuthError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message === 'Network request failed') {
        throw new NetworkError('Cannot connect to server. Please check your internet connection.');
      }
      
      // Handle other errors
      if (error instanceof Error) {
        if (__DEV__) {
          console.error('Password change error:', error.message);
        }
        throw new AuthError(`Failed to change password: ${error.message}`);
      }
      
      // Unknown error
      throw new AuthError('An unexpected error occurred');
    }
  }

  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Get stored token if not in memory
    if (!this.authToken) {
      this.authToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    }

    if (!this.authToken) {
      throw new AuthError('Not authenticated');
    }

    // Add token to headers
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.authToken}`,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
      });

      // If unauthorized, clear token and throw
      if (response.status === 401) {
        await this.logout();
        throw new AuthError('Session expired', 'SESSION_EXPIRED');
      }

      return response;
    } catch (error) {
      // Re-throw AuthError as is
      if (error instanceof AuthError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message === 'Network request failed') {
        throw new NetworkError('Cannot connect to server. Please check your internet connection.');
      }
      
      // Handle other errors
      if (error instanceof Error) {
        if (__DEV__) {
          console.error('Fetch error:', error.message);
        }
        throw new Error(`Request failed: ${error.message}`);
      }
      
      // Unknown error
      throw new Error('An unexpected error occurred');
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (!token) return false;

      // Verify token is still valid by making a test request
      this.authToken = token;
      const response = await this.authenticatedFetch('/api/user');
      return response.ok;
    } catch {
      // If any error occurs, consider the user not authenticated
      return false;
    }
  }

  async logout(): Promise<void> {
    this.authToken = null;
    
    // Clear stored credentials
    await Promise.all([
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  }

  async getUser() {
    try {
      const userStr = await AsyncStorage.getItem(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      if (__DEV__) {
        console.error('Error retrieving user:', error);
      }
      return null;
    }
  }

  // Helper method to check if we have a stored token
  async hasStoredToken(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      return !!token;
    } catch {
      return false;
    }
  }
}

export default new AuthService();