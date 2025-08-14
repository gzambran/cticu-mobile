# CTICU Mobile App - Context for Claude

## Key Architecture Decisions

### Badge Behavior (Critical Context)
**Admins and regular users have intentionally different badge experiences:**

- **Admin badges** = Count of pending requests that need action. Never clears until requests are approved/denied. This is a "work queue" indicator.
- **User badges** = Count of unseen updates. Clears when they view the swap screen. This is a "notification" indicator.

This was a deliberate design choice because admins are decision-makers while users are notification consumers.

### Badge Implementation Details
- **Badge state tracking**: Uses `seenRequestStates: Set<string>` to track "requestId-status" combinations (e.g., "123-pending", "123-approved")
- **When badges appear for regular users**:
  - Requester sees badge when their swap is approved/denied (NOT when pending)
  - Involved users (from_doctor/to_doctor) see badges for ALL states (pending, approved, denied)
- **Badge refresh triggers**:
  - App launch/login
  - App foreground/background
  - Tab navigation (any tab switch)
  - Manual actions (create/approve/deny swaps)
  - Navigating to swap screen
- **No polling or push notifications** - Updates happen through natural app usage

### Calendar Behavior
- Today's date is automatically selected when viewing the current month
- Selected date clears when navigating to other months
- Returning to current month re-selects today's date

## Project Structure

```
cticu-mobile/
├── app/(tabs)/          # Tab screens with badge display
│   ├── swap.tsx         # Shift swaps - main badge logic here
│   └── _layout.tsx      # Tab bar with badge rendering & tab navigation checks
├── stores/
│   └── notificationStore.ts  # Zustand store for badge state (tracks request+status combos)
├── services/
│   └── api.ts           # API calls for shift change requests
└── contexts/
    └── AuthContext.tsx  # Handles authentication
```

## State Management
- **Schedule data**: React Query + AsyncStorage caching
- **Badge/notification state**: Zustand (notificationStore)
- **Auth/user context**: React Context
- **Filters**: React Context

## Backend Integration
- Shift change requests API filters by role (admins see all pending, users see their own)
- Backend no longer sends push notifications (removed from approve/deny endpoints)
- Users must be in app or refresh to see badge updates