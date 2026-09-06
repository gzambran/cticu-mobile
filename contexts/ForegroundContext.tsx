import { createContext } from 'react';

// Signals app-foreground transitions (AppState -> 'active') to descendants that need
// to react to them (silent calendar refresh, doctors-list retry, etc). The Provider
// itself lives in app/(tabs)/_layout.tsx, which owns the AppState subscription; this
// module only holds the context object so it can be imported from either side
// without a circular dependency between _layout.tsx and any of its own providers.
export interface ForegroundContextType {
  lastForegroundTime: Date;
  isComingFromBackground: boolean;
}

export const ForegroundContext = createContext<ForegroundContextType>({
  lastForegroundTime: new Date(),
  isComingFromBackground: false,
});
