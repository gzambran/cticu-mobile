# ICU Scheduler Mobile App

A React Native/Expo mobile app for viewing ICU doctor schedules.

## Features

- 🔐 Secure login with session management
- 📅 Monthly calendar view with Apple Calendar-style UI
- 🔴 Color-coded shifts (5W, 5C, Night, Swing)
- 👨‍⚕️ Filter by doctor
- ⭐ Holiday indicators
- 📱 Offline support with cached data
- 🔄 Pull-to-refresh
- 🔒 Session stored securely with Expo SecureStore

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on iOS/Android:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Or scan QR code with Expo Go app

## Architecture

- **Framework**: Expo SDK 53
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based)
- **State Management**: React Query + AsyncStorage
- **Styling**: React Native StyleSheet (iOS-native patterns)
- **API**: REST API at https://cticu.zambrano.nyc
- **Authentication**: Session-based with secure storage

## Project Structure

```
cticu-mobile/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Schedule screen
│   │   └── explore.tsx    # Settings screen
│   ├── login.tsx          # Login screen
│   └── _layout.tsx        # Root layout with auth
├── components/            # React components
│   ├── CalendarView.tsx   # Main calendar grid
│   ├── DayCell.tsx        # Individual day cell
│   ├── DayDetailModal.tsx # Day detail view
│   ├── DoctorFilter.tsx   # Doctor filter dropdown
│   └── OfflineIndicator.tsx
├── services/              # API services
│   ├── api.ts            # API client with caching
│   └── auth.ts           # Authentication service
├── types/                 # TypeScript types
│   └── index.ts
└── utils/                 # Utility functions
    └── date.ts           # Date helpers
```

## Shift Types

- **5W** (Day Week) - Light Pink
- **5C** (Day Call) - Plum  
- **Night** - Sky Blue
- **Swing** (Mon-Thu only) - Pale Green

## Offline Support

The app caches all viewed schedule data using AsyncStorage. When offline:
- Previously viewed months are available
- An offline indicator appears
- Uncached months show "Internet connection required"
