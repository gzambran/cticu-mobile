import api from '@/services/api';
import { ShiftChangeRequest } from '@/types';
import { create } from 'zustand';

interface NotificationState {
  // Badge counts
  swapBadgeCount: number;
  requestsBadgeCount: number;
  
  // Seen request tracking (for regular users only)
  seenRequestIds: Set<number>;
  
  // Pending requests cache
  pendingRequests: ShiftChangeRequest[];
  
  // Actions
  updateSwapBadgeCount: (count: number) => void;
  updateRequestsBadgeCount: (count: number) => void;
  markRequestAsSeen: (requestId: number) => void;
  markAllRequestsAsSeen: () => void;
  fetchAndUpdateBadges: (username: string, role: string) => Promise<void>;
  clearBadges: () => void;
  resetStore: () => void;
}

const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  swapBadgeCount: 0,
  requestsBadgeCount: 0,
  seenRequestIds: new Set(),
  pendingRequests: [],
  
  // Update badge counts
  updateSwapBadgeCount: (count) => set({ swapBadgeCount: count }),
  updateRequestsBadgeCount: (count) => set({ requestsBadgeCount: count }),
  
  // Mark request as seen (only matters for regular users)
  markRequestAsSeen: (requestId) => {
    const { seenRequestIds } = get();
    const newSeenIds = new Set(seenRequestIds);
    newSeenIds.add(requestId);
    set({ seenRequestIds: newSeenIds });
  },
  
  // Mark all current requests as seen (for regular users)
  markAllRequestsAsSeen: () => {
    const { pendingRequests } = get();
    const currentIds = new Set(pendingRequests.map(req => req.id));
    set({ seenRequestIds: currentIds });
  },
  
  // Fetch and update badges based on user role
  fetchAndUpdateBadges: async (username: string, role: string) => {
    try {
      const requests = await api.getShiftChangeRequests();
      
      if (!requests || !Array.isArray(requests)) {
        console.log('No requests returned from API');
        set({ 
          swapBadgeCount: 0,
          pendingRequests: []
        });
        return;
      }
      
      set({ pendingRequests: requests });
      
      if (role === 'admin') {
        // ADMIN LOGIC: Badge always shows count of pending requests
        // Badge only clears when requests are actually approved/denied
        const pendingCount = requests.filter(req => req.status === 'pending').length;
        set({ swapBadgeCount: pendingCount });
        
      } else {
        // REGULAR USER LOGIC: Badge shows unseen updates
        // Badge clears when they view the swap screen
        const { seenRequestIds } = get();
        
        // Count their own approved/denied requests they haven't seen
        const unseenOwnRequests = requests.filter(
          req => req.requester_username === username && 
                 (req.status === 'approved' || req.status === 'denied') &&
                 !seenRequestIds.has(req.id)
        );
        
        // Count incoming swap requests (pending requests where they're the recipient)
        const unseenIncomingSwaps = requests.filter(
          req => req.status === 'pending' &&
                 req.shifts.some((shift: any) => 
                   shift.to_doctor === username || 
                   shift.to_doctor?.toLowerCase() === username.toLowerCase()
                 ) &&
                 !seenRequestIds.has(req.id)
        );
        
        const totalUnseen = unseenOwnRequests.length + unseenIncomingSwaps.length;
        set({ swapBadgeCount: totalUnseen });
      }
    } catch (error) {
      console.error('Error fetching requests for badges:', error);
      set({ swapBadgeCount: 0 });
    }
  },
  
  // Clear all badges (used on logout)
  clearBadges: () => {
    set({ 
      swapBadgeCount: 0,
      requestsBadgeCount: 0
    });
  },
  
  // Reset store (on logout)
  resetStore: () => {
    set({
      swapBadgeCount: 0,
      requestsBadgeCount: 0,
      seenRequestIds: new Set(),
      pendingRequests: []
    });
  },
}));

export default useNotificationStore;