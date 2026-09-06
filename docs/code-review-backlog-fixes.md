# Review of `backlog-fixes` (e690b7e..2eece17)

Scope: the ten fixes in `docs/fix-brief.md`, traced against the original findings in
`docs/code-review-2026-09-06.md` (4-12, 14) and `docs/code-review-followup.md` (A), and
cross-checked against `cticu-backend` where a claim depends on server behaviour
(`routes/api/index.js`, `routes/api/user.js`, `routes/auth.js`, `config/middleware.js`,
`routes/api/shift-change-requests.js`). `npx tsc --noEmit`, `expo lint` and `npm test`
(71 tests) are clean.

Counts: 0 Critical, 1 Important, 2 Minor.

---

## Important

### 1. The Requests tab focus reload never fires; finding 7 is unchanged

`app/(tabs)/requests.tsx:48-55`, `node_modules/@react-navigation/core/lib/module/useFocusEffect.js`
(effect deps `[effect, navigation]`, focus listener calls the captured `effect`).

The focus callback is memoised on `[user?.username]` and guards on `!loading &&
!refreshing`. `loading` is `true` on the first render (`useState(true)`, line 26), the
tab is lazily mounted with `user` already set, so `user?.username` never changes and the
memoised callback keeps the first render's `loading === true` for the life of the
screen. `useFocusEffect` binds its `focus` listener to that same callback, so every
focus evaluates `!true` and skips `loadData(true)`. The `eslint-disable` on line 53 is
what hides the missing deps.

**Concrete failure** (identical to finding 7)
1. Tap Requests once; it loads. Tap Schedule.
2. Remove one of your dates on the web admin.
3. Tap Requests. The removed date is still listed. Pull-to-refresh or a force-quit is
   still the only way to see the real list.

The pattern was copied from `app/(tabs)/swap.tsx:134-142`, which has the same dead
closure (pre-existing since `01b3bfa`). It goes unnoticed there because
`app/(tabs)/_layout.tsx:26-36` re-fetches badges, and therefore `pendingRequests`, on
every pathname change; `unavailability` has no equivalent fallback.

**Severity: Important.** Same rating as the finding it claims to fix; the fix is a no-op.
Fix: keep the callback stable but read in-flight state from a ref (or an
`isFirstFocusRef` that skips only the mount focus), not from the closure. Adding
`loading`/`refreshing` to the deps is not the fix: `useFocusEffect` re-runs immediately
when the callback identity changes while focused, so the mount load's `loading -> false`
would trigger a second fetch on the spot. Correct `swap.tsx` the same way while there.

---

## Minor

### 2. Finding A is fixed; finding 14 is not, and cannot be fixed from the mobile side

`services/auth.ts:281-289, 308-322`; `cticu-backend/routes/api/index.js:18`
(`requireAuthOrToken`), `config/middleware.js` (`requireTokenAuth`: `req.user =
jwt.verify(token)`), `routes/api/user.js:11-13` (`res.json(req.user)`),
`routes/auth.js:89-97` (claims minted at login).

The mobile app authenticates with a Bearer token, so `/api/user` returns the decoded
JWT: `username`, `role`, `fullName`, `doctorCode` as they were at login, plus
`iat`/`exp`. The database is never consulted on that path. Caching that body therefore
repopulates a missing record after a reinstall (finding A: verified, the 200 branch
writes `user_info` before `checkAuthStatus` calls `getUser()`), but it can never carry a
role or `doctorCode` change made after login. The new tests pass because they mock the
body as already fresh.

**Concrete failure** (identical to finding 14): admin corrects a doctor's `doctor_code`
on the backend; the doctor force-quits and relaunches; `isOwnCalendar`, badge
involvement, swap filtering and the admin segment still use the old value until sign
out / sign in.

The unreachable, 5xx, non-JSON-200 and empty-body paths all leave `user_info` untouched
(traced; the only write is inside `cacheUserFromResponse` after `response.ok`, and the
only delete is `logout()` on a definitive 401). Return values are unchanged in every
branch.

**Severity: Minor.** Same rating as the original. No regression, but the group 1 report's
"closes finding 14" claim is wrong. Closing it needs `routes/api/user.js` to query
`users` by `req.user.username` for token auth, the same as the session branch already
does; the mobile change is then sufficient as written. (The backend's `requireAdmin`
also trusts the JWT `role` for 30 days, so a demotion is not enforced server-side either;
pre-existing and out of scope here.)

### 3. Schedule invalidation can leave an offline cold launch with an empty calendar

`services/api.ts:262, 288, 314` (call sites), `:459-471` (`invalidateSchedulesCache`);
`components/CalendarView.tsx:220-295` (`loadData`), `services/api.ts:119-139`
(`fetchWithCache` fallback).

A successful create, approve or deny removes every `schedules_*` key and nothing
re-fetches until the Schedule tab is focused or the app is foregrounded. Foreground
refreshes with no cache keep the in-memory grid (`loadData` only sets
`serverUnreachable`), so the exposure is limited to a cold launch.

**Concrete failure**
1. Online, create a swap request (any user) or approve one (admin). All `schedules_*`
   keys are gone.
2. Press Home without returning to Schedule. iOS evicts the app hours later.
3. Open the app in a no-signal part of the hospital. `isAuthenticated()` returns `true`
   (NetworkError branch), the calendar's forced mount fetch fails, `getCachedData`
   finds no key, `loadData` throws, and the grid renders empty under the "No internet
   connection" banner. Holidays and the doctors list still render because their keys
   survive.

`cticu-backend/routes/api/shift-change-requests.js:290` is the only write to
`schedules` and it is in `approve`; create and deny change nothing the calendar
reads, so invalidating on them (as the brief asked) widens the window to every user's
most common action for no correctness gain.

**Severity: Minor.** Visible failure rather than a silent wrong one, self-corrects on the
next successful fetch, and the sequence needs eviction between the mutation and an
offline launch. Suggested: after a successful mutation, re-fetch and re-cache the
current window instead of only deleting, or limit invalidation to `approve`.

---

## Verified correct

Traced end to end; no failure sequence found.

- **4, calendar focus reload** (`CalendarView.tsx:72-77, 114-120, 297-299`). The `[]`
  callback is stable, so it fires only on focus transitions; `loadDataRef` is assigned
  during render, before any effect, so the mount focus calls a real `loadData`. Mount
  ordering is focus effect (fetches, sets `isRefreshingRef`), foreground effect
  (skipped by the guard), month effect (`loadData()` returns early, records
  `lastLoadedMonth`): one fetch, the same as before, when the foreground effect did it.
  A focus arriving while a foreground refresh is in flight is skipped, but that refresh
  covers the same window. No loop. The admin sequence from finding 4 (approve, tap
  Schedule) now shows the new assignment. The finding's second sequence (a swap approved
  on another device, older cached window merged over fresher state on month navigation)
  is unchanged; the brief scoped that out.
- **6, events on filter switch** (`CalendarView.tsx:84-87, 192-207`). `prevIsOwnCalendarRef`
  is seeded from the mount value, so an own-calendar mount does not double-fetch; the
  transition fetch is forced and merged. Month navigation while own does not re-fire.
  Finding 6's sequence now shows the existing event and takes the update branch.
- **11, doctors retry** (`DoctorsContext.tsx:18-21, 46-55`, `_layout.tsx:76-80`). Both
  `ForegroundContext` consumers (`DoctorsProvider`, `CalendarView`) are inside the
  Provider. `FilterProvider` returns `null` until its AsyncStorage read completes, so
  `DoctorsProvider` now mounts one read later than before; harmless. The retry effect
  closes over the current render's `doctors`/`loading`, skips only its mount run, and
  falls back to the `doctors` cache offline.
- **5, swap form auto-collapse** (`swap.tsx:54-77, 89-97, 144-159`). The AppState
  `active` path calls `fetchAndUpdateBadges` directly and never `loadRequests`, so it
  can no longer touch `showCreateForm`; `SwapRequestForm` stays mounted with its typed
  state through Control Center and notifications. No stuck state: the toggle at
  `swap.tsx:391` is always available. One cosmetic edge: `fetchAndUpdateBadges` swallows
  failures, so a first load that fails decides on the store's empty
  `pendingRequests` and leaves the form open for a user who would otherwise see it
  collapsed. The post-submit `setShowCreateForm(false)` runs after the form has already
  cleared itself.
- **10, resetStore on sign-out** (`AuthContext.tsx:101-119`). `router.replace('/login')`
  unmounts `(tabs)`, so `hasDecidedInitialCollapseRef`, `DoctorsProvider` and screen
  state all start fresh for the next user. A badge fetch already in flight at sign-out
  can write the old user's `pendingRequests` after the reset, but no screen is mounted
  to read it and the next user's first fetch replaces it. `userEvents_*` cache keys and
  `default_doctor_filter` survive sign-out; pre-existing, not introduced here.
- **12, login status handling** (`auth.ts:86-90`, `AuthContext.tsx:88-90`,
  `login.tsx:37-38`). 403/429 now reach the "Trouble Connecting" alert; 401 still
  returns `false`. The backend login route returns only 200, 401 or 500.
- **8, `keyboardShouldPersistTaps`** (`CalendarView.tsx:683`, `SwapRequestForm.tsx:243`).
  Set on both inner `ScrollView`s named in the finding.
- **9, month grouping** (`SwapRequestForm.tsx:114`). `parseDate` is local-time;
  `2026-10-01` groups under October. Test covers the boundary date.

---

## Verdict

**Safe to build and submit. Nothing here is worse than what it replaced.**

Eight of the ten items are fixed as specified with no regressions. Two are not fixed:
the Requests focus reload (1) is dead code, leaving finding 7 exactly as it was, and
the user-record refresh (2) closes finding A but cannot close finding 14 without a
backend change, because `/api/user` returns login-time JWT claims. Neither makes
anything worse. The one new behaviour (3) trades a stale-but-present offline calendar for
an empty-with-banner one in a narrow eviction sequence; that is a visible failure rather
than a silent wrong schedule, so it is not a reason to hold the build.

Item 1 is small enough to land before building: replace the closed-over `loading` /
`refreshing` guard with a ref in `requests.tsx` and `swap.tsx`. Item 2 needs a change in
`cticu-backend/routes/api/user.js` and can follow independently.
