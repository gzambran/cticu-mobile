# CTICU Mobile App - Context for Claude

## Key Architecture Decisions

### Badge Behavior (Critical Context)
**Admins and regular users have intentionally different badge experiences:**

- **Admin badges** = Count of pending requests that need action. Never clears until requests are approved/denied. This is a "work queue" indicator.
- **User badges** = Count of unseen updates. Clears when they view the swap screen. This is a "notification" indicator.

This was a deliberate design choice because admins are decision-makers while users are notification consumers.

### No Polling
Removed 60-second interval refresh that was causing badge flickering and battery drain. Updates now happen only on:
- App foreground
- Push notification received  
- Manual action (create/approve/deny/pull-to-refresh)

### Push Notifications
- Physical device + development build required (not Expo Go)
- Token registration happens on login via AuthContext
- Notifications trigger navigation to relevant screen

## Project Structure

```
cticu-mobile/
├── app/(tabs)/          # Tab screens with badge display
│   ├── swap.tsx         # Shift swaps - main badge logic here
│   └── _layout.tsx      # Tab bar with badge rendering
├── stores/
│   └── notificationStore.ts  # Zustand store for badge state
├── services/
│   └── pushNotifications.ts  # Push handler, token management
└── contexts/
    └── AuthContext.tsx  # Handles push token registration on login
```

## State Management
- **Schedule data**: React Query + AsyncStorage caching
- **Badge/notification state**: Zustand (notificationStore)
- **Auth/user context**: React Context
- **Filters**: React Context


## Backend Integration
- Shift change requests API filters by role (admins see all pending, users see their own)
- Push notifications sent via expo-server-sdk when requests are created/approved/denied
- Push tokens stored in database per user/device