import api from '@/services/api';
import useNotificationStore from '@/stores/notificationStore';
import { ShiftChangeRequest } from '@/types';

jest.mock('@/services/api', () => ({
  __esModule: true,
  default: { getShiftChangeRequests: jest.fn() },
}));

const mockedApi = api as unknown as {
  getShiftChangeRequests: jest.Mock;
};

const makeRequest = (overrides: Record<string, unknown> = {}): ShiftChangeRequest => ({
  id: 1,
  status: 'pending',
  requester_username: 'someone-else',
  shifts: [],
  submitted_at: '2026-01-01T00:00:00Z',
  ...overrides,
} as ShiftChangeRequest);

beforeEach(() => {
  useNotificationStore.getState().resetStore();
  jest.clearAllMocks();
});

describe('admin badges behave as a work queue', () => {
  it('counts only pending requests', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'pending' }),
      makeRequest({ id: 2, status: 'approved' }),
      makeRequest({ id: 3, status: 'pending' }),
    ]);

    await useNotificationStore.getState().fetchAndUpdateBadges('admin-user', 'admin');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(2);
  });

  it('ignores seen-state entirely, so the badge persists until actioned', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'pending' }),
    ]);

    useNotificationStore.getState().markRequestAsSeen(1, 'pending');
    await useNotificationStore.getState().fetchAndUpdateBadges('admin-user', 'admin');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
  });
});

describe('regular user badges behave as unseen-update indicators', () => {
  it('does not badge the requester for their own pending request', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'pending', requester_username: 'gz' }),
    ]);

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
  });

  it.each(['approved', 'denied'])(
    'badges the requester once their request is %s',
    async (status) => {
      mockedApi.getShiftChangeRequests.mockResolvedValue([
        makeRequest({ id: 1, status, requester_username: 'gz' }),
      ]);

      await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

      expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
    }
  );

  it.each(['pending', 'approved', 'denied'])(
    'badges an involved doctor when the status is %s',
    async (status) => {
      mockedApi.getShiftChangeRequests.mockResolvedValue([
        makeRequest({
          id: 1,
          status,
          requester_username: 'someone-else',
          shifts: [{ from_doctor: 'GZ', to_doctor: 'XX' }],
        }),
      ]);

      await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

      expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
    }
  );

  it('does not badge a doctor who is uninvolved and not the requester', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({
        id: 1,
        status: 'pending',
        requester_username: 'someone-else',
        shifts: [{ from_doctor: 'AA', to_doctor: 'BB' }],
      }),
    ]);

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
  });

  it('suppresses the badge once that exact request and status is seen', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'approved', requester_username: 'gz' }),
    ]);

    useNotificationStore.getState().markRequestAsSeen(1, 'approved');
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
  });

  it('re-badges when the status moves on from the seen one', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'denied', requester_username: 'gz' }),
    ]);

    useNotificationStore.getState().markRequestAsSeen(1, 'approved');
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
  });

  it('markAllRequestsAsSeen silences badges at their current statuses', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'approved', requester_username: 'gz' }),
    ]);

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');
    expect(useNotificationStore.getState().swapBadgeCount).toBe(1);

    useNotificationStore.getState().markAllRequestsAsSeen();
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');
    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
  });
});

describe('resetStore', () => {
  it('clears counts, pending requests, seen state, and the failure flag', () => {
    useNotificationStore.setState({
      swapBadgeCount: 5,
      requestsBadgeCount: 2,
      pendingRequests: [makeRequest()],
      seenRequestStates: new Set(['1-pending']),
      badgesFetchFailed: true,
    });

    useNotificationStore.getState().resetStore();

    const state = useNotificationStore.getState();
    expect(state.swapBadgeCount).toBe(0);
    expect(state.requestsBadgeCount).toBe(0);
    expect(state.pendingRequests).toEqual([]);
    expect(state.seenRequestStates.size).toBe(0);
    expect(state.badgesFetchFailed).toBe(false);
  });

  it('makes a previously-seen request re-badge again, as it should for the next signed-in user', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'approved', requester_username: 'gz' }),
    ]);

    useNotificationStore.getState().markRequestAsSeen(1, 'approved');
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');
    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);

    useNotificationStore.getState().resetStore();
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
  });
});

describe('failure handling', () => {
  it('zeroes the badge when the request fetch rejects', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedApi.getShiftChangeRequests.mockRejectedValue(new Error('network'));

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
    consoleError.mockRestore();
  });

  it('zeroes the badge and clears the cache on a non-array response', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue(null);

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
    expect(useNotificationStore.getState().pendingRequests).toEqual([]);
  });

  it('sets badgesFetchFailed when the request fetch rejects, so a screen with no fetch of its own can still show a banner', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedApi.getShiftChangeRequests.mockRejectedValue(new Error('backend unreachable'));

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().badgesFetchFailed).toBe(true);
    consoleError.mockRestore();
  });

  it('clears badgesFetchFailed on the next successful fetch', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedApi.getShiftChangeRequests.mockRejectedValueOnce(new Error('backend unreachable'));
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');
    expect(useNotificationStore.getState().badgesFetchFailed).toBe(true);

    mockedApi.getShiftChangeRequests.mockResolvedValueOnce([]);
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().badgesFetchFailed).toBe(false);
    consoleError.mockRestore();
  });
});
