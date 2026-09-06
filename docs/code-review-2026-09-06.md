# CTICU Mobile latent-bug review

Scope: full read of `services/`, `stores/`, `contexts/`, `utils/`, `app/`, `components/` on `main` at `a9df0e5`, cross-checked against `cticu-backend` where a finding depends on server behaviour. Every finding below has a user-reproducible sequence; candidates that could not be traced to a wrong outcome were dropped.

Counts: 2 Critical, 5 Important, 7 Minor.

---

## Critical

### 1. Any 401 silently signs the user out while the UI stays signed in; a wrong current password is enough to trigger it

`services/auth.ts:210-213` (`authenticatedFetch`), `services/auth.ts:148` (unreachable branch), `contexts/AuthContext.tsx` (never informed), `services/api.ts:123-138` (silent cache fallback).

`authenticatedFetch` treats every 401 as session expiry: it calls `this.logout()` (deleting the token from SecureStore and memory) and throws `AuthError('Session expired')`. Nothing tells `AuthContext`, so `isAuthenticated` stays `true` and no redirect happens. From then on every request throws `AuthError('Not authenticated')`, and `fetchWithCache` answers that error by returning whatever is in AsyncStorage, with no timestamp check, no banner (`servedStaleCache` and `backendReachable` are only touched for unreachable errors), and no alert.

The backend returns 401 for a wrong current password (`cticu-backend/routes/api/user.js:88`), so the branch at `auth.ts:148` that is meant to say "Current password is incorrect" can never run.

**Concrete failure**
1. Settings > Change Password. Mistype the current password. Tap Change Password.
2. Alert says "Session expired" (wrong: the session was fine until this tap).
3. Dismiss the modal. The app looks logged in. Go to Schedule and pull to refresh: the spinner finishes, the calendar shows the cached schedule, no banner. Background and foreground the app: same. Swap tab now shows "Server down - Some features unavailable" (also wrong). Requests tab pull-to-refresh: "Failed to load data. Please try again."
4. This persists until the user manually signs out or force-quits (cold launch goes through `checkAuthStatus`, which does redirect). A doctor can look at a schedule that is hours or days old with nothing on screen saying so.

The same end state is reached by the 30-day JWT expiry (`routes/auth.js:99`) landing while the app is warm: the AppState-triggered `fetchAndUpdateBadges` gets the 401, wipes the token, and the calendar refresh that runs alongside it silently serves cache.

**Severity: Critical.** Trivial to trigger by a typo, misreports the cause twice, and leaves a doctor reading an unbounded-age schedule with no indicator. This is exactly the "wrong schedule and not know it" case.

### 2. Cold launch with no connection or a down backend lands on the login screen; cached data is unreachable

`services/auth.ts:240-253` (`isAuthenticated`), `contexts/AuthContext.tsx:49-63` (`checkAuthStatus`), `contexts/AuthContext.tsx:34-47` (redirect).

`isAuthenticated()` decides by making a live `/api/user` request and returning `response.ok`, with any thrown error also returning `false`. A `NetworkError` (device offline) or a 502 (backend down) therefore reports "not authenticated" even though a valid token is present, and the auth effect redirects to `/login`.

**Concrete failure**
1. Use the app normally so the schedule is cached. Force-quit it.
2. Turn on airplane mode (or wait for a backend deploy/outage). Relaunch.
3. Login screen appears. Enter credentials: "Trouble Connecting". There is no path to the cached schedule.

The whole offline-cache design only works if the app was already running when connectivity was lost. iOS evicts backgrounded apps routinely, so a doctor in a no-signal part of the hospital who opens the app to check tonight's shift gets a login wall.

**Severity: Critical.** Defeats the stated purpose of the cache in the situation it exists for.

---

## Important

### 3. Month navigation skips or sticks on the 29th-31st because it uses `setMonth` on a day-of-month-carrying date

`components/CalendarView.tsx:257-258` (`navigateMonth`), seeded from `useState(new Date())` at `:41`, `jumpToToday` at `:262-266`, and the foreground date-change branch at `:115`.

`newDate.setMonth(m + 1)` on a date whose day does not exist in the target month rolls into the following month. Verified with node: `Aug 31 -> next` yields Oct 1; `Mar 31 -> prev` yields Mar 3 (stays on March); `Jan 30 -> next` yields Mar 2.

**Concrete failure**
1. On Aug 31, open the Schedule tab (current month, `currentDate` = Aug 31).
2. Tap the forward chevron to look at September. The grid renders October; the header reads "Oct". September is unreachable by a single tap; tapping back from October lands on September only because Oct 1 has a valid day in every month.
3. On Mar 31, tap back: the view stays on March. Tap back again: February.

Any day 29-31 of a month adjacent to a shorter month reproduces it. `jumpToToday` and the foreground-date-change path re-seed the day-of-month, so the problem recurs after every "Today" tap.

**Severity: Important.** A doctor reading "next month's" shifts is looking at the month after; the header is a three-letter abbreviation and easy to miss.

### 4. Overlapping range caches with independent freshness overwrite newer schedule data, and swap approval never invalidates any of them

`services/api.ts:192-194` (per-range cache keys), `components/CalendarView.tsx:211` (merge), `components/CalendarView.tsx:134-144` (non-forced reload on navigation), `services/api.ts:269-315` (approve/deny do no invalidation), `components/SwapRequestForm.tsx:78-83` (non-forced load of its own key).

Each 4-month window starting at a different month has its own AsyncStorage key and timestamp. A forced refresh (foreground, pull) only refreshes the window currently viewed; navigating outside the window does a non-forced `loadData()` that serves any other overlapping key from cache if it is under 4 hours old, and the result is merged over state date-by-date. Older cached data therefore overwrites fresher data for the overlapping dates. Separately, approving, denying, or creating a swap does not invalidate any `schedules_*` key, and CalendarView has no focus effect, so it does not reload on tab switch at all.

**Concrete failure (admin)**
1. Swap tab, Admin View, approve a swap that moves an Oct 15 shift from A to B.
2. Tap the Schedule tab. Oct 15 still shows A. Nothing indicates it is stale. (Pull-to-refresh fixes it; nothing prompts the admin to.)

**Concrete failure (any user, fresher data replaced by older)**
1. 09:00, viewing Sep. Tap back to Aug (loads and caches the Aug-Nov window), tap forward to Sep.
2. 09:30, a swap for Oct 15 is approved server-side.
3. 10:00, foreground the app while on Sep. The forced refresh fetches Sep-Dec; Oct 15 is now correct.
4. Tap back to Aug: outside the Sep-Dec window, so `loadData()` runs non-forced and the Aug-Nov key (cached at 09:00, pre-swap) is served and merged over state. Tap forward to Oct: Oct 15 shows the pre-swap assignment again, no banner.

**Concrete failure (swap form)**
1. Open the Swap tab within 4 hours of a previous open. `SwapRequestForm` loads its own schedule key non-forced.
2. Pick a FROM doctor. The "SELECT SHIFTS" list reflects the cached assignment, so a shift that was swapped away since is still offered and one swapped in is missing.

**Severity: Important.** The calendar can show an assignment the user already saw corrected, with no indicator.

### 5. The swap form collapses and discards everything typed whenever the app flickers through `inactive`, for any user with prior swap involvement

`app/(tabs)/swap.tsx:81-101` (collapse effect keyed on `pendingRequests`), `app/(tabs)/_layout.tsx:55-76` (AppState `active` triggers `fetchAndUpdateBadges`), `stores/notificationStore.ts:82` (new array reference on every fetch), `app/(tabs)/swap.tsx:387-393` (form unmounts when collapsed).

Every successful badge fetch stores a fresh array in `pendingRequests`, which re-runs the collapse effect, which calls `setShowCreateForm(!userHasAnyInvolvement)`. For a user who has any request in the list that is `false`, so the form unmounts and `SwapRequestForm`'s local `swapRows` and `notes` state is lost. AppState fires `active` after Control Center, Notification Center, an incoming-call banner, or any system sheet.

**Concrete failure**
1. As a doctor who has at least one request in the list, open the Swap tab and expand "New Swap Request".
2. Select FROM, several shifts across two months, TO, and type notes.
3. Pull down Control Center and dismiss it (or glance at a notification). The form snaps closed; reopening it shows an empty form.

Users with no prior involvement are unaffected, so the bug hits exactly the users who use the feature.

**Severity: Important.** Silent loss of a multi-step form on a routine gesture.

### 6. Switching the calendar filter to your own doctor does not load your events; existing events are invisible and the form offers to create over them

`components/CalendarView.tsx:203-204` (events only requested when `isOwnCalendar` at load time), `components/CalendarView.tsx:134-161` (reload keyed only on `currentDate`), `components/CalendarView.tsx:346` and `:456` (render from `userEvents` state), `components/CalendarView.tsx:375-379` (create vs update decision).

There is no effect on `selectedDoctor`. If the calendar was first loaded with the filter on "All" or another doctor, `userEvents` is `{}` and stays `{}` after the filter changes, until a pull-to-refresh, a foreground, or a navigation outside the loaded window.

**Concrete failure**
1. Default filter "All" (the shipped default). Launch, Schedule tab loads with no events fetched.
2. Change the filter to yourself. No event dots appear on days that have events. Select such a day and swipe to the event page: the create form is shown rather than the existing title.
3. Type a title and Save. `handleSaveEvent` takes the create branch because `existingEvent` is undefined; the backend has `UNIQUE(username, date)` on `user_events` (`config/database.js:157`), so the save is rejected and the alert shows the raw server message.

**Severity: Important.** The personal-events feature appears empty and blocks new entries for users whose default filter is not themselves.

### 7. The Requests tab loads vacation data only on mount and never on focus or foreground

`app/(tabs)/requests.tsx:40-43` (`useEffect([])`), no `useFocusEffect`, and nothing consumes `ForegroundContext` here.

The recent fix made the banner on this screen follow the shared reachability signal (comment at `:34-36` describes the mount-only load explicitly), but the data path still has the mount-only shape. `unavailability` is not cached, so this is purely in-memory staleness.

**Concrete failure**
1. Visit the Requests tab once. Leave the app running (backgrounded).
2. Remove or add one of your dates on the web admin, or an admin does it for you.
3. Reopen the app and tap the Requests tab. The old list is shown. Adding a date that was already added elsewhere, or trying to remove one already removed, acts on stale state. Pull-to-refresh or a force-quit is the only way to see the real list.

**Severity: Important.** Same shape as the finding the brief called out; the data path was left behind when the banner was fixed.

---

## Minor

### 8. Two nested `ScrollView`s still swallow the first tap while the keyboard is open

`components/CalendarView.tsx:628-635` (horizontal pager containing the event `TextInput` and Save/Update/Cancel buttons), `components/SwapRequestForm.tsx:234-239` (shift chips list, sits above the notes field).

`keyboardShouldPersistTaps` was added to the four outer `KeyboardAwareScrollView`s (commit `40e1249`), but RN's capture logic runs per `ScrollView`, and these inner ones keep the default `never`. Any ancestor `ScrollView` with `never` captures the first touch and dismisses the keyboard.

**Concrete failure**: type an event title, tap Save; the keyboard closes and nothing is saved until a second tap. In the swap form, type notes, scroll up to add one more shift chip; the first tap closes the keyboard instead of selecting.

**Severity: Minor.** Same class as the shipped fix; two taps, no data loss.

### 9. Swap form groups every 1st-of-month shift under the previous month's header in US time zones

`components/SwapRequestForm.tsx:110` (`new Date(date)` on a `YYYY-MM-DD` string).

Verified in node with `TZ=America/New_York`: `new Date("2026-10-01").getMonth()` is 8 (September). The chip text itself uses `parseDate`, so it reads "Oct 1", but it appears under the "SEPTEMBER 2026" heading, and a month consisting only of a 1st shows no heading of its own.

**Severity: Minor.** Wrong grouping; the submitted date is correct.

### 10. Badge state is in-memory only and never reset on sign-out

`stores/notificationStore.ts:12,36` (`seenRequestStates` not persisted), `stores/notificationStore.ts:150` (`resetStore` is never called anywhere; grep confirms).

Every cold launch starts with an empty seen-set, so a pending request that involves the user as from/to doctor re-badges on every launch until the admin resolves it, and it cannot be dismissed (`canDismiss` requires non-pending, `swap.tsx:237`). On a shared device, user B inherits user A's `seenRequestStates` and `pendingRequests`, so a request A already viewed produces no badge for B.

**Severity: Minor.** Recurring false notification; shared-device case is unlikely for this user base.

### 11. Doctors list failure is permanent and silent for the session

`contexts/DoctorsContext.tsx:25-28` (error swallowed into `doctors = []`), `refreshDoctors` is never called by any consumer (grep confirms).

**Concrete failure**: sign in during a brief backend blip (502 on `/api/doctors` with no cache, e.g. first install). Every doctor picker in the app is empty; the swap form cannot be completed; no message and no retry short of sign-out/in or relaunch.

**Severity: Minor.** Narrow window on first install.

### 12. Login reports any non-401, non-5xx status as "Invalid username or password"

`services/auth.ts:77` throws `AuthError` for the remaining statuses; `contexts/AuthContext.tsx:85` turns every `AuthError` into `return false`; `app/login.tsx:35` renders that as invalid credentials.

**Concrete failure**: Cloudflare returns 403 (WAF/bot rule) or 429 (rate limit) for the login POST. The user is told their password is wrong and may go reset it.

**Severity: Minor.** Depends on edge configuration, but the message is definitely wrong when it happens.

### 13. Vacation-request date pickers freeze their minimum on first render and drift across a quarter boundary

`components/RequestManagementCard.tsx:34-35` (`useState(minDate)` captures once), `app/(tabs)/requests.tsx:155` (`minDate` recomputed per render).

**Concrete failure**: open the Requests tab on Sep 30 (start/end default to Oct 1). Leave the app suspended overnight. On Oct 1 the header reads "Q1 2027 Vacation Requests" and the picker minimum is Jan 1, but the start/end fields still show Oct 1. Tap Add Dates: Oct 1 is submitted and then immediately hidden by the `futureDates` filter, so the date the user just added vanishes from "Upcoming Requests".

**Severity: Minor.** Requires the tab to stay mounted across a quarter boundary.

### 14. Cached user info (role, doctorCode) is never refreshed after login

`services/auth.ts:57-59` (written once at login), `services/auth.ts:265-275` (read from AsyncStorage), `/api/user` is called by `isAuthenticated` but its body is discarded.

**Concrete failure**: an admin corrects a doctor's `doctor_code` or promotes someone to admin on the backend. Until that user signs out and back in, `isOwnCalendar`, badge involvement, swap filtering, and the admin segment control all use the old values.

**Severity: Minor.** Rare change, but there is no in-app signal that a re-login is needed.
