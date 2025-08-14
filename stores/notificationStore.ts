import api from '@/services/api';
import { ShiftChangeRequest } from '@/types';
import { create } from 'zustand';

interface NotificationState {
  // Badge counts
  swapBadgeCount: number;
  requestsBadgeCount: number;
  
  // Track seen request+status combinations (for regular users only)
  // Format: "requestId-status" e.g., "123-pending", "123-approved"
  seenRequestStates: Set<string>;
  
  // Pending requests cache
  pendingRequests: ShiftChangeRequest[];
  
  // Actions
  updateSwapBadgeCount: (count: number) => void;
  updateRequestsBadgeCount: (count: number) => void;
  markRequestAsSeen: (requestId: number, status: string) => void;
  markAllRequestsAsSeen: () => void;
  fetchAndUpdateBadges: (username: string, role: string, doctorCode?: string) => Promise<void>;
  clearBadges: () => void;
  resetStore: () => void;
}

const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  swapBadgeCount: 0,
  requestsBadgeCount: 0,
  seenRequestStates: new Set(),
  pendingRequests: [],
  
  // Update badge counts
  updateSwapBadgeCount: (count) => set({ swapBadgeCount: count }),
  updateRequestsBadgeCount: (count) => set({ requestsBadgeCount: count }),
  
  // Mark specific request+status as seen (only matters for regular users)
  markRequestAsSeen: (requestId: number, status: string) => {
    const { seenRequestStates } = get();
    const newSeenStates = new Set(seenRequestStates);
    newSeenStates.add(`${requestId}-${status}`);
    set({ seenRequestStates: newSeenStates });
  },
  
  // Mark all current requests as seen with their current status (for regular users)
  markAllRequestsAsSeen: () => {
    const { pendingRequests } = get();
    const newSeenStates = new Set<string>();
    
    // Mark each request as seen with its current status
    pendingRequests.forEach(req => {
      newSeenStates.add(`${req.id}-${req.status}`);
    });
    
    set({ seenRequestStates: newSeenStates });
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
        // ADMIN LOGIC: Badge shows count of pending requests needing action
        // Badge only clears when requests are actually approved/denied
        const pendingCount = requests.filter(req => req.status === 'pending').length;
        set({ swapBadgeCount: pendingCount });
        
      } else {
        // REGULAR USER LOGIC: Badge shows count of unseen updates
        // Badge clears when they view the swap screen
        const { seenRequestStates } = get();
        
        // Filter for all requests where user should see a badge
        const unseenRequests = requests.filter(req => {
          // Create a key for this request's current state
          const requestStateKey = `${req.id}-${req.status}`;
          
          // Skip if this exact state has been seen
          if (seenRequestStates.has(requestStateKey)) {
            return false;
          }
          
          // Check if user should see a badge for this request:
          
          // 1. User is the requester and status is approved/denied
          // (Requesters don't see badges for their own pending requests)
          if (req.requester_username === username) {
            if (req.status === 'approved' || req.status === 'denied') {
              return true;
            }
            // Skip if requester and still pending
            return false;
          }
          
          // 2. User is involved in the swap (as FROM or TO doctor)
          // Show badge for ALL statuses (pending, approved, denied) when involved
          if (doctorCode) {
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
      seenRequestStates: new Set(),
      pendingRequests: []
    });
  },
}));

export default useNotificationStore;