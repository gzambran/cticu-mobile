# Review of `2eece17~1..HEAD` (excluding `docs/`)

Scope: commits `2eece17`, `3c6032f`, `c732026`, `8ece435`; four files, 76 lines. Each
change traced end to end through `app/(tabs)/swap.tsx`, `app/(tabs)/requests.tsx`,
`services/api.ts`, `__tests__/services/api.test.ts`, and cross-checked against
`cticu-backend/routes/api/shift-change-requests.js` and `routes/api/schedules.js`,
`node_modules/@react-navigation/core/lib/module/useFocusEffect.js`, and
`node_modules/react-native/Libraries/Components/RefreshControl/RefreshControl.js`.
`npm test` (71 tests) and `npx tsc --noEmit` are clean.

Counts: 0 Critical, 0 Important, 2 Minor.

---

## Minor

### 1. The in-flight guard swallows user-initiated reloads, so a completed action can leave the list stale

`app/(tabs)/swap.tsx:86-89` (guard), `:165`, `:181`, `:204`, `:231` (post-mutation
reloads), `:400` (pull-to-refresh); `app/(tabs)/requests.tsx:64-67` (guard), `:115`,
`:140` (post-mutation reloads), `:210` (pull-to-refresh).

`isLoadingRef` short-circuits every call, not just the silent focus reload it was added
for. `CalendarView.tsx:316-322` (`handleManualRefresh`) treats the same ref
differently: a user-initiated load clears the guard and proceeds. The two new guards
have no such override, so a post-mutation `loadRequests()` / `loadData()` returns
without fetching whenever any earlier load is still in flight, and the earlier load's
response, which the server produced before the mutation, is what ends up on screen.

The precondition is a load whose response arrives after the mutation completes. The
silent focus reload makes this easier to hit than before, because it fires on every
tab switch with no visible indication that a request is outstanding.

**Concrete failure** (Swap, any user, slow link of roughly a second or more)
1. Pull to refresh on the Swap tab. The spinner is showing; the `GET
   /api/shift-change-requests` it sent is in flight.
2. Tap Dismiss on an approved request visible below the spinner. `acknowledge` POSTs,
   succeeds, and `handleAcknowledge` calls `loadRequests()` (`swap.tsx:181`), which
   returns at line 87 because the pull's load is still marked in flight.
3. The pull's response lands. It was produced before the acknowledge, so
   `pendingRequests` still contains the request. The dismissed card stays on screen
   with a live Dismiss button. Tapping it again succeeds (the backend acknowledge is
   idempotent, `shift-change-requests.js:239`) and the second reload is not swallowed.

The same sequence on Requests (`requests.tsx:115`) shows "3 dates added successfully!"
with none of the three dates listed; the add is persisted (`unavailability.js:38`,
`ON CONFLICT DO NOTHING`), so a second attempt looks like it worked the first time.
For an admin approve, the swallowed reload leaves the approved request in the Admin
View with Approve/Deny buttons, and a second Approve returns 404 from
`shift-change-requests.js:281`, surfacing as "Failed to approve shift swap".

A pull-to-refresh started while a silent focus load is in flight is also swallowed:
`loadRequests(true)` returns before `setRefreshing(true)`, and
`RefreshControl.js:186-195` then forces the native control closed on the next update
because the JS prop never changed. The spinner snaps shut with no fetch of its own; the
outstanding silent load still lands, so this part is cosmetic.

The ref cannot get stuck set: `finally` resets it on every path past the guard,
`fetchAndUpdateBadges` swallows its own errors (`notificationStore.ts:135-138`), a 401
in `authenticatedFetch` signs the user out and unmounts the tabs
(`auth.ts:239-243`, `AuthContext.tsx:38-59`), and `fetch` has no path that never
settles short of the platform request timeout.

**Severity: Minor.** Needs an in-flight load older than the mutation, which on a
normal link means acting within a few hundred milliseconds of a pull or tab switch.
The mutation itself is persisted in every case, retrying is harmless on Swap dismiss
and Requests, and the Swap tab self-corrects on the next tab switch through the badge
fetch in `_layout.tsx:26-36`. Fix: let user-initiated calls (`isRefresh`, and the
post-mutation calls) clear the guard and proceed, as `CalendarView.handleManualRefresh`
does, and reserve the short-circuit for `isSilent`.

### 2. The two inverted tests pass without checking that the cache was left alone

`__tests__/services/api.test.ts:199-200` (deny), `:211` (create).

Both tests seed two `schedules_*` keys plus `doctors` (`:159-176`) and are named
"leaves the cache alone", but the assertions are `not.toEqual(['doctors'])` and
`length > 1`. Either passes if exactly one of the two schedule keys is removed, and
`length > 1` passes if `doctors` and one schedule key survive. A regression that
reintroduces invalidation on deny or create scoped to a single window, which is the
plausible shape of a future "invalidate only the affected range" change, would go
unnoticed. The precise assertion already exists in the same file at `:220-222` for the
failure-path test and is what these two should use.

**Severity: Minor.** Test-only; the production code they cover is correct today.

---

## Verified correct

Traced end to end; no failure sequence found.

- **Explicit collapse after submit** (`swap.tsx:161-176`, `SwapRequestForm.tsx:188-202`).
  A failed `createShiftChangeRequest` rethrows before `setShowCreateForm(false)`, so
  the form stays open with its rows and notes intact and shows its own alert. On
  success the collapse runs after `await loadRequests()`, and the form's own
  `setSwapRows`/`setNotes`/`setLoading(false)` land on an unmounted component, which
  React 18 tolerates silently. A submission while a background load is in flight
  collapses the form regardless (the `await loadRequests()` returns immediately; see
  finding 1 for the stale list that follows). The toggle at `swap.tsx:408-418` is
  always rendered, so neither stuck-open nor stuck-closed is reachable.
- **Focus reload rewrite** (`swap.tsx:125`, `:155-159`; `requests.tsx:56-58`, `:101`;
  `useFocusEffect.js:20-72`). The `[]` callback registers once and reads the ref at
  call time, so it always reaches the closure from the latest render (current `user`).
  On mount the load effect (`swap.tsx:128`, `requests.tsx:47`) is declared before the
  focus effect and runs first; the focus call is swallowed by the guard, so mount
  still makes exactly one request and `loading` (initially `true`) is cleared by that
  load's `finally`. Every later focus fires the silent reload. Finding 7's sequence
  (remove a date on the web admin, return to the Requests tab) now shows the change.
- **Silent mode** (`swap.tsx:91-97`, `:118-122`; `requests.tsx:69-75`, `:94-98`).
  `loading` and `refreshing` are cleared in `finally` on every path past the guard;
  the guard's early return sets no state, so there is nothing to clear. All
  user-initiated paths still drive their spinner: mount and post-mutation reloads set
  `loading`, pull-to-refresh sets `refreshing`. A silent load that fails still sets
  `loadFailed` (Swap) or `loadFailed`/`backendReachable` (Requests) for the banner.
- **Narrowed invalidation** (`services/api.ts:244-317`, `:456-468`;
  `cticu-backend/routes/api/shift-change-requests.js`, `routes/api/schedules.js:16`).
  `create` (`:10-78`) reads `schedules` for validation and inserts only into
  `shift_change_requests`. `deny` (`:331-372`) updates only `shift_change_requests`.
  `approve` (`:288-293`) holds the only `UPDATE schedules` in the request handlers;
  the other `schedules` writes live in the admin scheduler route (`schedules.js:122`,
  `:133`, `:177`) and are not reachable from the mobile app. `GET /api/schedules`
  selects from `schedules` alone. No triggers or functions are defined anywhere in the
  backend. On the mobile side the only `schedules_*` readers are
  `CalendarView.loadData` and `SwapRequestForm.loadCurrentAndNextQuarterSchedules`;
  focus and foreground reloads pass `forceRefresh`, so the cache is consulted only on
  month navigation and cold launch, which is exactly the window approve still clears.
  `approve` invalidates only after `response.ok`, so a failed approve leaves the cache
  intact (`api.test.ts:214-223`).

---

## Verdict

**Safe as it stands.** All four commits do what they were meant to do and none
regresses the behaviour it replaced. The one runtime finding (1) is a narrow timing
window in which a completed action is not reflected until the next refresh; the data
is never wrong on the server and every affected screen recovers on its own. Finding 2
is test strength only. Both are worth landing before the next build because the fix
for 1 is three lines per screen and the pattern already exists in `CalendarView`, but
neither is a reason to hold it.
