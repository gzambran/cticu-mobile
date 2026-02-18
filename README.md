# CTICU Mobile

A React Native (Expo) app for managing ICU physician schedules. Supports schedule viewing, shift swaps, swing shift tracking, and unavailability management.

## Tech Stack

- React Native 0.79 / Expo 53
- Expo Router v5
- Zustand + React Context
- TypeScript

## Development

```bash
npm start        # Start dev server
npm run ios      # Run on iOS
npm run lint     # Lint
```

## Build & Release

```bash
make ship        # Full release: bump build, build locally, submit to App Store, cleanup
make ios-release # Build only
make ios-submit  # Submit latest build
make bump        # Bump build number
make clean       # Remove .ipa files
```

Requires `jq` (`brew install jq`).
