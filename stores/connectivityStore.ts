import { create } from 'zustand';

interface ConnectivityState {
  // Reflects the last thing the app actually learned from the network about the
  // backend, independent of any single screen or request batch. Starts optimistic
  // (true) and is only ever changed by services/api.ts when a live fetch resolves
  // one way or the other. A fresh-cache hit makes no request and must leave this
  // unchanged — same rule as the per-batch flags on ApiService.
  backendReachable: boolean;
  setBackendReachable: (reachable: boolean) => void;
}

// Plain booleans on a service object don't trigger React re-renders. Screens like
// Settings make no network calls of their own and would otherwise only see this
// value change on a render triggered by something else. Routing it through Zustand
// makes it observable so a subscribed screen updates as soon as api.ts learns the
// backend is unreachable (or reachable again), not just incidentally.
const useConnectivityStore = create<ConnectivityState>((set) => ({
  backendReachable: true,
  setBackendReachable: (reachable) => set({ backendReachable: reachable }),
}));

export default useConnectivityStore;
