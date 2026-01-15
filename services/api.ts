import AsyncStorage from '@react-native-async-storage/async-storage';
import { Holidays, Schedule, ShiftChange, ShiftChangeRequest, ShiftType, Unavailability, UserEvents } from '../types';
import authService, { AuthError, NetworkError } from './auth';

const CACHE_DURATION = 3600000 * 4; // 4 hours for multi-month data

// Custom API error
export class ApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

class ApiService {
  private async fetchWithCache<T>(
    key: string,
    url: string,
    forceRefresh = false
  ): Promise<T> {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { data, timestamp }: CachedData<T> = JSON.parse(cached);
          // Check if cache is still valid
          if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
          }
        }
      } catch (error) {
        // Cache read error - continue to fetch from API
        if (__DEV__) {
          console.error('Cache read error:', error);
        }
      }
    }

    // Fetch from API with authentication
    try {
      const response = await authService.authenticatedFetch(url);

      if (!response.ok) {
        throw new ApiError(`Request failed with status: ${response.status}`, response.status);
      }

      const data: T = await response.json();

      // Cache the response
      try {
        await AsyncStorage.setItem(
          key,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          } as CachedData<T>)
        );
      } catch (cacheError) {
        // Cache write error - non-critical, continue
        if (__DEV__) {
          console.error('Cache write error:', cacheError);
        }
      }

      return data;
    } catch (error) {
      // Handle specific error types
      if (error instanceof AuthError || error instanceof NetworkError) {
        // For auth/network errors, try to return cached data if available
        const cachedData = await this.getCachedData<T>(key);
        if (cachedData) {
          return cachedData;
        }
        throw error;
      }

      if (error instanceof ApiError) {
        throw error;
      }

      // Unknown error
      throw new ApiError('An unexpected error occurred while fetching data');
    }
  }

  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { data }: CachedData<T> = JSON.parse(cached);
        return data;
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Cache fallback error:', error);
      }
    }
    return null;
  }

  async getDoctors(forceRefresh = false): Promise<string[]> {
    return this.fetchWithCache<string[]>(
      'doctors',
      `/api/doctors`,
      forceRefresh
    );
  }

  async getSchedules(
    startDate: string, 
    endDate: string, 
    forceRefresh = false,
    shiftTypes?: ShiftType[]
  ): Promise<Schedule> {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ApiError('Invalid date format. Expected YYYY-MM-DD');
    }

    // Build URL with optional shift types filter
    let url = `/api/schedules?startDate=${startDate}&endDate=${endDate}`;
    if (shiftTypes && shiftTypes.length > 0) {
      url += `&shiftTypes=${shiftTypes.join(',')}`;
    }

    // Include shift types in cache key if filtering
    const cacheKey = shiftTypes && shiftTypes.length > 0
      ? `schedules_${startDate}_${endDate}_${shiftTypes.join(',')}`
      : `schedules_${startDate}_${endDate}`;
      
    return this.fetchWithCache<Schedule>(
      cacheKey,
      url,
      forceRefresh
    );
  }

  async getUnavailability(forceRefresh = false): Promise<Unavailability> {
    return this.fetchWithCache<Unavailability>(
      'unavailability',
      `/api/unavailability`,
      forceRefresh
    );
  }

  async getHolidays(startDate: string, endDate: string, forceRefresh = false): Promise<Holidays> {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ApiError('Invalid date format. Expected YYYY-MM-DD');
    }

    const cacheKey = `holidays_${startDate}_${endDate}`;
    return this.fetchWithCache<Holidays>(
      cacheKey,
      `/api/holidays?startDate=${startDate}&endDate=${endDate}`,
      forceRefresh
    );
  }

  // Shift Change Request Methods (no caching for these as they need to be real-time)
  async getShiftChangeRequests(): Promise<ShiftChangeRequest[]> {
    try {
      const response = await authService.authenticatedFetch('/api/shift-change-requests');
      
      if (!response.ok) {
        throw new ApiError(`Request failed with status: ${response.status}`, response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to fetch shift change requests');
    }
  }

  async createShiftChangeRequest(shifts: ShiftChange[], notes?: string): Promise<void> {
    try {
      const response = await authService.authenticatedFetch('/api/shift-change-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shifts, notes }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.error || `Request failed with status: ${response.status}`,
          response.status
        );
      }
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to create shift change request');
    }
  }

  async approveShiftChangeRequest(requestId: number): Promise<void> {
    try {
      const response = await authService.authenticatedFetch(
        `/api/shift-change-requests/${requestId}/approve`,
        {
          method: 'PUT',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.error || `Request failed with status: ${response.status}`,
          response.status
        );
      }
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to approve shift change request');
    }
  }

  async denyShiftChangeRequest(requestId: number): Promise<void> {
    try {
      const response = await authService.authenticatedFetch(
        `/api/shift-change-requests/${requestId}/deny`,
        {
          method: 'PUT',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.error || `Request failed with status: ${response.status}`,
          response.status
        );
      }
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to deny shift change request');
    }
  }

  async acknowledgeShiftChangeRequest(requestId: number): Promise<void> {
    try {
      const response = await authService.authenticatedFetch(
        `/api/shift-change-requests/${requestId}/acknowledge`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.error || `Request failed with status: ${response.status}`,
          response.status
        );
      }
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to acknowledge shift change request');
    }
  }

  // User Events Methods
  async getUserEvents(startDate: string, endDate: string, forceRefresh = false): Promise<UserEvents> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ApiError('Invalid date format. Expected YYYY-MM-DD');
    }

    const cacheKey = `userEvents_${startDate}_${endDate}`;
    return this.fetchWithCache<UserEvents>(
      cacheKey,
      `/api/user-events?startDate=${startDate}&endDate=${endDate}`,
      forceRefresh
    );
  }

  async createUserEvent(date: string, title: string): Promise<{ id: number }> {
    try {
      const response = await authService.authenticatedFetch('/api/user-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date, title }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.error || `Request failed with status: ${response.status}`,
          response.status
        );
      }

      const data = await response.json();
      await this.invalidateUserEventsCache();
      return data;
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to create user event');
    }
  }

  async updateUserEvent(eventId: number, title: string): Promise<void> {
    try {
      const response = await authService.authenticatedFetch(`/api/user-events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.error || `Request failed with status: ${response.status}`,
          response.status
        );
      }

      await this.invalidateUserEventsCache();
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to update user event');
    }
  }

  async deleteUserEvent(eventId: number): Promise<void> {
    try {
      const response = await authService.authenticatedFetch(`/api/user-events/${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.error || `Request failed with status: ${response.status}`,
          response.status
        );
      }

      await this.invalidateUserEventsCache();
    } catch (error) {
      if (error instanceof AuthError || error instanceof NetworkError || error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to delete user event');
    }
  }

  private async invalidateUserEventsCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userEventKeys = keys.filter(key => key.startsWith('userEvents_'));
      if (userEventKeys.length > 0) {
        await AsyncStorage.multiRemove(userEventKeys);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to invalidate user events cache:', error);
      }
    }
  }

  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith('doctors') ||
        key.startsWith('schedules_') ||
        key.startsWith('unavailability') ||
        key.startsWith('holidays_') ||
        key.startsWith('userEvents_')
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Clear cache error:', error);
      }
      throw new ApiError('Failed to clear cache');
    }
  }

  // Helper method to check if data is available offline
  async hasOfflineData(): Promise<boolean> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys.some(key =>
        key.startsWith('doctors') ||
        key.startsWith('schedules_') ||
        key.startsWith('unavailability') ||
        key.startsWith('holidays_') ||
        key.startsWith('userEvents_')
      );
    } catch {
      return false;
    }
  }
}

export default new ApiService();