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
  fetchAndUpdateBadges: (username: string, role: string, doctorCode?: string) => Promise<void>;
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
  fetchAndUpdateBadges: async (username: string, role: string, doctorCode?: string) => {
    try {
      const requests = await api.getShiftChangeRequests();
      
      if (!requests || !Array.isArray(requests)) {
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
        // REGULAR USER LOGIC: Badge shows unseen updates for ANY involvement
        const { seenRequestIds } = get();
        
        // Filter for all requests where user is involved that they haven't seen
        const unseenRequests = requests.filter(req => {
          // Skip if already seen
          if (seenRequestIds.has(req.id)) {
            return false;
          }
          
          // Check if user is involved in any way:
          
          // 1. User is the requester (for approved/denied requests only)
          if (req.requester_username === username && 
              (req.status === 'approved' || req.status === 'denied')) {
            return true;
          }
          
          // 2. User is involved in a pending swap (as FROM or TO doctor)
          // BUT not if they are the requester (don't show badge for own pending requests)
          if (req.status === 'pending' && doctorCode && req.requester_username !== username) {
            // Check if user's doctor code appears as either from_doctor or to_doctor
            const isInvolved = req.shifts.some((shift: any) => 
              shift.from_doctor === doctorCode || 
              shift.to_doctor === doctorCode
            );
            if (isInvolved) {
              return true;
            }
          }
          
          return false;
        });
        
        set({ swapBadgeCount: unseenRequests.length });
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