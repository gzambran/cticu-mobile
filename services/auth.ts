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

  // Called when the server definitively rejects the stored session. Clearing the
  // token here without telling anyone leaves the UI believing it is still signed
  // in, which strands the user on screens that silently serve cached data.
  private onSessionRejected: (() => void) | null = null;

  setSessionRejectedHandler(handler: (() => void) | null): void {
    this.onSessionRejected = handler;
  }

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

      // A 5xx means the backend is down, not that the credentials are wrong. It
      // arrives as a completed HTTP exchange rather than a failed connection, so it
      // must be raised as a NetworkError explicitly — otherwise it falls through to
      // AuthContext's catch-all and the user is told their password is invalid.
      if (response.status >= 500) {
        throw new NetworkError('Cannot connect to server. Please check your internet connection.');
      }

      // Anything else (e.g. Cloudflare returning 403 for a WAF/bot rule, or 429 for
      // rate limiting) is not a verdict on the credentials either — only a genuine
      // 401 means the password was wrong. Reported the same way as unreachable so
      // the user is not sent off to reset a password that was correct.
      throw new NetworkError('Cannot connect to server. Please check your internet connection.');
    } catch (error) {
      // Type-safe error handling
      if (error instanceof AuthError) {
        throw error;
      }

      // A NetworkError raised above must pass through untouched. It is also an
      // Error, so without this it falls into the generic branch below and is
      // rewrapped as an AuthError — which the caller reads as bad credentials.
      if (error instanceof NetworkError) {
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
      const response = await this.authenticatedFetch(
        '/api/user/change-password',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        // A 401 here means the typed current password was wrong, not that the
        // session ended. Handled below so a typo does not sign the user out.
        { sessionExpiryOn401: false }
      );

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

      // A 5xx means the backend is down, not that anything is wrong with the
      // password. Check before parsing: the proxy returns a non-JSON body in that
      // case, so parsing first would fail and report a misleading auth error.
      if (response.status >= 500) {
        throw new NetworkError('Cannot connect to server. Please check your internet connection.');
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
      
      // Same passthrough as login: a NetworkError raised above is also an Error, so
      // without this it gets rewrapped below as an auth failure.
      if (error instanceof NetworkError) {
        throw error;
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

  // `sessionExpiryOn401` exists because 401 is overloaded: it is the session being
  // rejected for most endpoints, but /api/user/change-password also returns 401 to
  // mean "the current password you typed is wrong". Callers that expect the second
  // meaning opt out, so a typo cannot sign the user out.
  async authenticatedFetch(
    url: string,
    options: RequestInit = {},
    { sessionExpiryOn401 = true }: { sessionExpiryOn401?: boolean } = {}
  ): Promise<Response> {
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

      // If unauthorized, clear token and throw. A 401 is the server definitively
      // rejecting the session, so the UI must be told — otherwise it keeps
      // rendering as signed in while every later request fails.
      if (response.status === 401 && sessionExpiryOn401) {
        await this.logout();
        this.onSessionRejected?.();
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

      // Verify the token against the server when we can reach it. Being unable to
      // ask is not the same as being told no: on a cold launch with no signal, or
      // while the backend is down, the stored session stands and the app runs on
      // cached data. Only a definitive rejection ends the session — a 401 is
      // handled inside authenticatedFetch, which clears the token and notifies.
      this.authToken = token;
      const response = await this.authenticatedFetch('/api/user');

      if (response.ok) {
        // A live response is the only time there is a body to refresh the cached
        // user from. This keeps role/doctorCode current on every launch (finding
        // 14) and repopulates a missing user record after a reinstall, where the
        // Keychain token survives but AsyncStorage does not (finding A).
        await this.cacheUserFromResponse(response);
        return true;
      }

      // A 5xx is the backend failing to answer, not a verdict on the session.
      return response.status >= 500;
    } catch (error) {
      if (error instanceof NetworkError) {
        return true;
      }
      // Anything else, including the AuthError raised for a 401, means the session
      // is genuinely unusable.
      return false;
    }
  }

  // Best-effort refresh of the cached user record from a successful /api/user
  // response. Unreachable/5xx callers never reach here, so there is no body to
  // parse in those cases — the cached user must be left exactly as it was, not
  // cleared, since it is the only record the rest of the app has.
  private async cacheUserFromResponse(response: Response): Promise<void> {
    try {
      const text = await response.text();
      if (!text) return;

      const data = JSON.parse(text);
      if (data && typeof data === 'object') {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error caching user info:', error);
      }
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