import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Minimal stand-ins for the real error classes rather than requiring the actual
// auth module — that module pulls in expo-secure-store, which these tests have no
// need to exercise. api.ts's instanceof checks work against whatever module is
// resolved for '@/services/auth' / './auth', so this mock is sufficient as long as
// it's the only one loaded for that path in this test run.
jest.mock('@/services/auth', () => {
  class AuthError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.name = 'AuthError';
      this.code = code;
    }
  }
  class NetworkError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NetworkError';
    }
  }
  return {
    __esModule: true,
    AuthError,
    NetworkError,
    default: { authenticatedFetch: jest.fn() },
  };
});

import api, { ApiError, isUnreachableError } from '@/services/api';
import authService, { AuthError, NetworkError } from '@/services/auth';
import useConnectivityStore from '@/stores/connectivityStore';

const mockedFetch = authService.authenticatedFetch as jest.Mock;

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
});

const errorResponse = (status: number) => ({
  ok: false,
  status,
  json: async () => ({}),
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  api.resetServedStaleCache();
  useConnectivityStore.getState().setBackendReachable(true);
});

describe('isUnreachableError', () => {
  it('is true for a NetworkError', () => {
    expect(isUnreachableError(new NetworkError('down'))).toBe(true);
  });

  it('is true for a 5xx ApiError (the Cloudflare-fronted "backend stopped" case)', () => {
    expect(isUnreachableError(new ApiError('bad gateway', 502))).toBe(true);
  });

  it('is false for a 4xx ApiError — a real client-error bug must stay loud', () => {
    expect(isUnreachableError(new ApiError('not found', 404))).toBe(false);
  });

  it('is false for an ApiError with no status code', () => {
    expect(isUnreachableError(new ApiError('unexpected'))).toBe(false);
  });

  it('is false for an unrelated error', () => {
    expect(isUnreachableError(new Error('boom'))).toBe(false);
  });
});

describe('fetchWithCache: 5xx treated as unreachable', () => {
  it('falls back to cache on a 5xx, marking it stale-served and the backend unreachable', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse(['Dr. A']));
    await api.getDoctors(true);
    expect(api.didServeStaleCache()).toBe(false);

    mockedFetch.mockResolvedValueOnce(errorResponse(502));
    const result = await api.getDoctors(true);

    expect(result).toEqual(['Dr. A']);
    expect(api.didServeStaleCache()).toBe(true);
    expect(api.isBackendReachable()).toBe(false);
  });

  it('rethrows a 5xx when nothing is cached, and still flips reachability', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(503));

    await expect(api.getDoctors(true)).rejects.toBeInstanceOf(ApiError);
    expect(api.didServeStaleCache()).toBe(false);
    expect(api.isBackendReachable()).toBe(false);
  });

  it('rethrows a genuine 4xx without falling back or touching reachability', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(404));

    await expect(api.getDoctors(true)).rejects.toBeInstanceOf(ApiError);
    expect(api.didServeStaleCache()).toBe(false);
    expect(api.isBackendReachable()).toBe(true);
  });
});

describe('fetchWithCache: AuthError is not a connectivity problem', () => {
  it('falls back to cache on AuthError but does not mark it as stale-served or unreachable', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse(['Dr. A']));
    await api.getDoctors(true);

    mockedFetch.mockRejectedValueOnce(new AuthError('Session expired', 'SESSION_EXPIRED'));
    const result = await api.getDoctors(true);

    expect(result).toEqual(['Dr. A']);
    expect(api.didServeStaleCache()).toBe(false);
    expect(api.isBackendReachable()).toBe(true);
  });

  it('rethrows AuthError when nothing is cached, without touching reachability', async () => {
    mockedFetch.mockRejectedValueOnce(new AuthError('Session expired', 'SESSION_EXPIRED'));

    await expect(api.getDoctors(true)).rejects.toBeInstanceOf(AuthError);
    expect(api.isBackendReachable()).toBe(true);
  });
});

describe('fetchWithCache: distinguishing "no request made" from "request succeeded"', () => {
  it('sets didFetchSucceed on a genuine live success', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse(['Dr. A']));
    await api.getDoctors(true);

    expect(api.didFetchSucceed()).toBe(true);
  });

  it('leaves didFetchSucceed and didServeStaleCache both false on a fresh-cache hit', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse(['Dr. A']));
    await api.getDoctors(true);
    api.resetServedStaleCache();

    // forceRefresh=false with a cache written moments ago should short-circuit
    // before any request is made.
    const cached = await api.getDoctors(false);

    expect(cached).toEqual(['Dr. A']);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(api.didFetchSucceed()).toBe(false);
    expect(api.didServeStaleCache()).toBe(false);
  });
});

describe('shift-change mutations invalidate the schedule cache', () => {
  const seedScheduleCaches = async () => {
    // Two overlapping windows, each with its own key and its own freshness clock —
    // exactly the layout described in finding 4. Both must be dropped on a mutation
    // rather than left to expire on their own schedules.
    await AsyncStorage.setItem(
      'schedules_2026-08-01_2026-11-30',
      JSON.stringify({ data: { '2026-10-15': { '5C': 'A' } }, timestamp: Date.now() })
    );
    await AsyncStorage.setItem(
      'schedules_2026-09-01_2026-12-31',
      JSON.stringify({ data: { '2026-10-15': { '5C': 'A' } }, timestamp: Date.now() })
    );
    // A differently-prefixed key must survive the invalidation.
    await AsyncStorage.setItem(
      'doctors',
      JSON.stringify({ data: ['Dr. A'], timestamp: Date.now() })
    );
  };

  const remainingKeys = async () => [...(await AsyncStorage.getAllKeys())].sort();

  it('clears every schedules_* key on approve', async () => {
    await seedScheduleCaches();
    mockedFetch.mockResolvedValueOnce(okResponse({}));

    await api.approveShiftChangeRequest(1);

    expect(await remainingKeys()).toEqual(['doctors']);
  });

  it('clears every schedules_* key on deny', async () => {
    await seedScheduleCaches();
    mockedFetch.mockResolvedValueOnce(okResponse({}));

    await api.denyShiftChangeRequest(1);

    expect(await remainingKeys()).toEqual(['doctors']);
  });

  it('clears every schedules_* key on create', async () => {
    await seedScheduleCaches();
    mockedFetch.mockResolvedValueOnce(okResponse({}));

    await api.createShiftChangeRequest([
      { date: '2026-10-15', shiftType: '5C', from_doctor: 'A', to_doctor: 'B' } as any,
    ]);

    expect(await remainingKeys()).toEqual(['doctors']);
  });

  it('does not touch the cache when the mutation fails', async () => {
    await seedScheduleCaches();
    mockedFetch.mockResolvedValueOnce(errorResponse(400));

    await expect(api.approveShiftChangeRequest(1)).rejects.toThrow();

    expect(await remainingKeys()).toEqual(
      ['doctors', 'schedules_2026-08-01_2026-11-30', 'schedules_2026-09-01_2026-12-31'].sort()
    );
  });
});
