# Group 1 fix report — session and calendar data

Branch: `backlog-fixes`. Four commits, one per item, on top of `e690b7e`.

## A + 14. Refresh the user record from the server on every launch

**Commit:** `92d2c27` — Refresh cached user record from /api/user on every launch

**Change:** `services/auth.ts`. `isAuthenticated()` now calls a new private
`cacheUserFromResponse(response)` immediately after a successful (`response.ok`)
`/api/user` fetch, before returning `true`. That helper reads the response body,
parses it as JSON, and — only if parsing succeeds and the result is an object —
writes it to `AsyncStorage` under the same `user_info` key `login()` and `getUser()`
already use. Verified against the backend (`cticu-backend/routes/api/user.js`):
token-auth requests hit `res.json(req.user)`, i.e. the JWT payload
(`username`, `role`, `fullName`, `doctorCode`, plus `iat`/`exp`), which is a superset
of what `login()` stores — no shape mismatch.

Unreachable and 5xx responses never reach `cacheUserFromResponse` (the function
returns before that branch), so the cached user is left completely untouched in
those cases — no clearing, no overwrite. A malformed or empty body (parse failure)
is caught and logged in dev only; the existing cached user is likewise left alone.
`isAuthenticated()`'s return value is unchanged in every branch — only a genuine 401
still ends the session.

Did not touch `checkAuthStatus`'s `authenticated && userInfo` gating as instructed;
`isAuthenticated()` populating the user before `checkAuthStatus` calls `getUser()`
is what closes finding A (reinstall: valid Keychain token, no AsyncStorage record —
the first `/api/user` call during `checkAuthStatus` now populates it) without adding
a guard that could spuriously sign someone out on a transient AsyncStorage read
failure.

**Tests added** (`__tests__/services/auth.test.ts`, 4 new):
- stores the returned body as the cached user on a successful response
- leaves the cached user untouched when the backend is unreachable
- leaves the cached user untouched on a 5xx
- does not throw, and does not wipe the existing cached user, when the successful
  response body is not valid JSON

All 9 pre-existing `isAuthenticated`/`authenticatedFetch` tests still pass unchanged.

## 4. Invalidate schedule caches on swap mutations; reload calendar on focus

**Commit:** `e3e59cd` — Invalidate schedule cache on swap mutations and reload
calendar on focus

**Change 1 — `services/api.ts`:** added a private `invalidateSchedulesCache()`
(mirrors the existing `invalidateUserEventsCache()` pattern: lists all
`AsyncStorage` keys, removes every one prefixed `schedules_`). Called after a
successful response in `createShiftChangeRequest`, `approveShiftChangeRequest`,
and `denyShiftChangeRequest` — matching the brief's explicit list, even though only
approve actually mutates the `schedules` table server-side (create/deny don't, per
`cticu-backend/routes/api/shift-change-requests.js`). Not called on
`acknowledgeShiftChangeRequest`, which never touches schedules. Failures inside the
invalidation are caught and logged, never thrown — a cache-clear problem must not
turn into a failed swap action.

**Change 2 — `components/CalendarView.tsx`:** added a `useFocusEffect` that does a
silent forced refresh (`loadData(false, true)`) when the Schedule tab regains
focus, guarded by the existing `isRefreshingRef`. Found and fixed a staleness bug
while implementing this: `useFocusEffect` requires a referentially stable callback
to avoid re-firing on every render while already focused (confirmed by reading
`@react-navigation/core`'s implementation — its outer effect deps are
`[effect, navigation]`, so a callback that changes identity while the screen is
still focused re-invokes immediately). A `useCallback(..., [])` is stable, but then
its closure over `loadData` would forever be the version from the very first
render, with stale `year`/`month`/`isOwnCalendar`. Fixed via a `loadDataRef` that
is reassigned to the latest `loadData` on every render (a plain assignment during
render, not inside an effect, so it's set before any effect fires); the focus
callback calls `loadDataRef.current?.(...)` instead of closing over `loadData`
directly.

This also closes the "overlapping window" case from the finding: clearing the
`schedules_*` keys means any window, however it gets fetched next, can no longer
serve a pre-swap cached value; the focus reload is the mechanism that guarantees a
"next fetch" actually happens when a user returns to the tab instead of navigating
months.

**Tests added** (`__tests__/services/api.test.ts`, 4 new): seed two overlapping
`schedules_*` cache keys plus an unrelated `doctors` key, then assert approve/deny/
create each remove only the `schedules_*` keys, and that a failed mutation (4xx)
leaves the cache untouched. Focus-effect wiring itself is UI wiring per the brief
and isn't unit tested.

## 6. Load personal events when the doctor filter changes

**Commit:** `4b84c8f` — Load personal events when the doctor filter switches to
yourself

**Change:** `components/CalendarView.tsx`. Added a dedicated `useEffect` keyed on
`[isOwnCalendar, year, month]` that detects the specific "just switched to
yourself" transition via a `prevIsOwnCalendarRef` (initialized to the first
render's `isOwnCalendar`, so it doesn't double-fetch if the calendar already opens
on the user's own filter). On that transition only, it force-fetches
`api.getUserEvents` for the currently displayed 4-month window and merges the
result into `userEvents` state. A fetch failure is swallowed (best-effort backfill;
the next focus/foreground/month-navigation reload will retry). This is additive —
it doesn't change the existing `loadData` fetch-on-load behavior, so no risk to the
"note the overlapping-window problem, don't redesign the cache layer" instruction.

No new test: this is UI wiring (an effect reacting to a prop/derived value), and
the underlying data-merge logic it calls (`setUserEvents(prev => ({...prev,
...events}))`) is identical to the existing pattern used elsewhere in the same
file, already exercised implicitly by the component's existing behavior.

## 11. Retry the doctors list when it is empty

**Commit:** `1811938` — Retry doctors list on foreground when empty

**Change:** Using `ForegroundContext` required restructuring how it's shared, to
avoid a circular import. `DoctorsContext.tsx` needs to import `ForegroundContext`
to read `lastForegroundTime`, but `ForegroundContext` previously lived in
`app/(tabs)/_layout.tsx`, which itself imports `DoctorsProvider` from
`DoctorsContext.tsx` — a genuine import cycle (`_layout.tsx` → `DoctorsContext.tsx`
→ `_layout.tsx`) that I judged too risky to leave to bundler luck, especially since
I can't run an iOS build to confirm Metro resolves it correctly. So:

- Extracted the context object (not its Provider, which still lives in
  `_layout.tsx` and still owns the `AppState` subscription) into a new
  `contexts/ForegroundContext.tsx`.
- Updated `CalendarView.tsx`'s existing import of `ForegroundContext` to the new
  path (was previously importing it from `_layout.tsx`).
- Reordered the provider nesting in `_layout.tsx` so `DoctorsProvider` is now
  inside `ForegroundContext.Provider` (previously outside/above it) — necessary
  because a context consumer only sees a Provider's value if it's a descendant of
  it; otherwise it would silently read the static default value forever. Confirmed
  no other consumer needs the opposite ordering (`FilterContext` doesn't use
  `useDoctors`; every `useDoctors()` call site — `settings.tsx`, `swap.tsx`,
  `CalendarView.tsx` — is a descendant of `<Tabs>`, which stays inside
  `DoctorsProvider` either way).
- `DoctorsContext.tsx`: added a `useEffect` keyed on `lastForegroundTime` that
  retries (`loadDoctors(true)`) when `doctors.length === 0 && !loading`. Skips its
  own first invocation via an `isFirstForegroundRef` flag, since that first run
  fires on mount with the Provider's initial value, not a real foreground
  transition. No new UI (no banner, no retry button), per the brief.

No new test: this is a context wiring change (an effect reacting to a context
value), same UI-wiring category as the focus effects above, and the project has no
React component/context test infrastructure (`@testing-library/react-native` is not
installed) — adding one would be a heavier lift than the brief's "without heavy
mocking" scope allows for this pass.

## Verification

```
npx tsc --noEmit   → clean
npm run lint       → clean (expo lint)
npm test           → 4 suites, 64 tests passed (56 original + 8 new)
```

Ran all three after every commit, not just at the end.

## Self-review findings

- Caught and fixed the `useFocusEffect` stale-closure bug described under item 4
  before committing (the ref-forwarding pattern) — this was introduced and fixed
  within this pass, not left in the final diff.
- Split what would have been one over-large commit for item 4/6 into the correct
  two commits: the `loadDataRef` staleness fix belongs to item 4 (it's part of
  making the item-4 focus effect correct) and was amended into that commit; the
  `prevIsOwnCalendarRef`/events-backfill effect is item 6 and is its own commit.
- Double-checked the provider-reorder in `_layout.tsx` doesn't strand any consumer:
  grepped every `useDoctors()` call site and confirmed all remain descendants of
  `DoctorsProvider` under the new nesting.
- Confirmed via the backend source (`cticu-backend/routes/api/user.js`,
  `routes/auth.js`) that `/api/user`'s response shape for token auth
  (`res.json(req.user)`, the JWT payload) matches what `login()` already stores, so
  caching it under the same key introduces no shape drift for existing readers
  (`isOwnCalendar`, badge involvement checks, admin segment control, etc. all read
  `username`/`role`/`doctorCode`, all present).
- Verified the schedule-cache invalidation list against the backend
  (`shift-change-requests.js`): only `approve` actually updates the `schedules`
  table; `deny` and `create` don't. Followed the brief's explicit instruction to
  invalidate on all three anyway (deny/create are cheap, safe over-invalidations,
  and the brief calls them out by name), rather than second-guessing it down to
  just `approve`.

## Concerns

- **Item 4's focus reload always forces a fresh fetch** (`isRefresh=false,
  isSilent=true` still passes `forceRefresh=true` into `getSchedules`/
  `getHolidays`/`getUserEvents`, same as the existing foreground effect). This
  means every tab switch back to Schedule now costs a live network round-trip
  instead of a cache hit, on top of the existing foreground-triggered one. This
  matches the existing foreground-effect's behavior exactly (same call), so it's
  consistent with prior art rather than a new pattern, but it does mean more
  network chatter than before. Given the app's correctness priority over battery/
  data usage, and that this is exactly what the brief asked for, I left it as is
  rather than trying to thread a "was there actually a mutation" signal through to
  the focus effect (that would be the "larger redesign" the brief said not to
  attempt).
- **Item 11's retry is a single attempt per foreground**, not a backoff loop — if
  the backend is down for an extended stretch, every foreground during that
  stretch does trigger one retry each, but only while the list is still empty (it
  stops retrying once one succeeds). This matches "retry on foreground" as
  specified; no additional debouncing was requested for a single blip use case.
- Did not touch Group 2 items or anything in their scope (`swap.tsx`,
  `SwapRequestForm.tsx`, `requests.tsx`, `notificationStore.ts`'s `resetStore`
  wiring, `login.tsx`/`services/auth.ts`'s `login()`). `services/auth.ts` and
  `services/api.ts` were touched, but only in the `isAuthenticated`/schedule-cache
  areas relevant to Group 1; the Group 2 sections of those same files
  (`login()`'s status-code handling for item 12) are untouched.
