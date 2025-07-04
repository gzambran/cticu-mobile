import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';
import { Holidays, Schedule, Unavailability } from '../types';
import authService, { AuthError, NetworkError } from './auth';

const API_BASE_URL = config.API_BASE_URL;
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

  async getSchedules(startDate: string, endDate: string, forceRefresh = false): Promise<Schedule> {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ApiError('Invalid date format. Expected YYYY-MM-DD');
    }

    const cacheKey = `schedules_${startDate}_${endDate}`;
    return this.fetchWithCache<Schedule>(
      cacheKey,
      `/api/schedules?startDate=${startDate}&endDate=${endDate}`,
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

  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.startsWith('doctors') || 
        key.startsWith('schedules_') || 
        key.startsWith('unavailability') || 
        key.startsWith('holidays_')
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
        key.startsWith('holidays_')
      );
    } catch {
      return false;
    }
  }
}

export default new ApiService();