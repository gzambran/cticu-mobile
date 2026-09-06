import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import authService, { NetworkError } from '@/services/auth';

const mockedSecureStore = SecureStore as unknown as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const response = (status: number) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => '',
  json: async () => ({}),
});

beforeEach(() => {
  jest.clearAllMocks();
  authService.setSessionRejectedHandler(null);
  mockedSecureStore.getItemAsync.mockResolvedValue('stored-token');
  global.fetch = jest.fn();
});

afterEach(() => {
  authService.setSessionRejectedHandler(null);
});

describe('isAuthenticated keeps a stored session unless the server rejects it', () => {
  it('is false when no token is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    await expect(authService.isAuthenticated()).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('is true when the server confirms the token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response(200));

    await expect(authService.isAuthenticated()).resolves.toBe(true);
  });

  it('stays true when the device is offline, so cached data remains reachable', async () => {
    // React Native surfaces a failed connection as exactly this TypeError, which
    // authenticatedFetch converts into a NetworkError.
    (global.fetch as jest.Mock).mockRejectedValue(
      new TypeError('Network request failed')
    );

    await expect(authService.isAuthenticated()).resolves.toBe(true);
  });

  it('stays true when the backend returns 5xx, which is not a verdict on the session', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response(502));

    await expect(authService.isAuthenticated()).resolves.toBe(true);
  });

  it('is false when the server rejects the token with 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response(401));

    await expect(authService.isAuthenticated()).resolves.toBe(false);
  });
});

describe('a rejected session is announced so the UI cannot keep showing signed in', () => {
  it('notifies the handler and clears the stored token on a 401', async () => {
    const onRejected = jest.fn();
    authService.setSessionRejectedHandler(onRejected);
    (global.fetch as jest.Mock).mockResolvedValue(response(401));

    await authService.isAuthenticated();

    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('does not notify when the backend is merely unreachable', async () => {
    const onRejected = jest.fn();
    authService.setSessionRejectedHandler(onRejected);
    (global.fetch as jest.Mock).mockRejectedValue(
      new TypeError('Network request failed')
    );

    await authService.isAuthenticated();

    expect(onRejected).not.toHaveBeenCalled();
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('does not notify on a 5xx', async () => {
    const onRejected = jest.fn();
    authService.setSessionRejectedHandler(onRejected);
    (global.fetch as jest.Mock).mockResolvedValue(response(502));

    await authService.isAuthenticated();

    expect(onRejected).not.toHaveBeenCalled();
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

describe('isAuthenticated refreshes the cached user from a successful response', () => {
  it('stores the returned body as the cached user', async () => {
    const freshUser = { username: 'doc', role: 'admin', doctorCode: 'ZZ' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(freshUser),
      json: async () => freshUser,
    });

    await expect(authService.isAuthenticated()).resolves.toBe(true);
    await expect(authService.getUser()).resolves.toEqual(freshUser);
  });

  it('leaves the cached user untouched when the backend is unreachable', async () => {
    await AsyncStorage.setItem('user_info', JSON.stringify({ username: 'doc', role: 'user' }));

    (global.fetch as jest.Mock).mockRejectedValue(
      new TypeError('Network request failed')
    );

    await expect(authService.isAuthenticated()).resolves.toBe(true);
    await expect(authService.getUser()).resolves.toEqual({ username: 'doc', role: 'user' });
  });

  it('leaves the cached user untouched on a 5xx', async () => {
    await AsyncStorage.setItem('user_info', JSON.stringify({ username: 'doc', role: 'user' }));

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '',
      json: async () => ({}),
    });

    await expect(authService.isAuthenticated()).resolves.toBe(true);
    await expect(authService.getUser()).resolves.toEqual({ username: 'doc', role: 'user' });
  });

  it('does not throw when the successful response body is not valid JSON', async () => {
    await AsyncStorage.setItem('user_info', JSON.stringify({ username: 'doc', role: 'user' }));

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'not json',
      json: async () => ({}),
    });

    await expect(authService.isAuthenticated()).resolves.toBe(true);
    // A malformed body must not wipe the existing cached record.
    await expect(authService.getUser()).resolves.toEqual({ username: 'doc', role: 'user' });
  });
});

describe('login only blames the password for a genuine 401', () => {
  it('resolves false on a real credential rejection', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response(401));

    await expect(authService.login('doc', 'wrong-password')).resolves.toBe(false);
  });

  it('raises a NetworkError, not a credential failure, on a 5xx', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response(502));

    await expect(authService.login('doc', 'correct-password')).rejects.toBeInstanceOf(
      NetworkError
    );
  });

  it('raises a NetworkError, not a credential failure, on a Cloudflare 403', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response(403));

    await expect(authService.login('doc', 'correct-password')).rejects.toBeInstanceOf(
      NetworkError
    );
  });

  it('raises a NetworkError, not a credential failure, on a 429 rate limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response(429));

    await expect(authService.login('doc', 'correct-password')).rejects.toBeInstanceOf(
      NetworkError
    );
  });
});

describe('a wrong current password does not end the session', () => {
  it('surfaces the server message instead of signing the user out', async () => {
    const onRejected = jest.fn();
    authService.setSessionRejectedHandler(onRejected);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Current password is incorrect' }),
      json: async () => ({ error: 'Current password is incorrect' }),
    });

    await expect(
      authService.changePassword('wrong-current', 'new-password')
    ).rejects.toThrow('Current password is incorrect');

    expect(onRejected).not.toHaveBeenCalled();
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
