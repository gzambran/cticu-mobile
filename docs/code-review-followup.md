# CTICU Mobile follow-up review

Scope: `main` at `d802caa` (1.4.0, build 26). Full trace of the session, calendar-anchoring and reachability changes landed since `a9df0e5`, cross-checked against `cticu-backend` (`config/middleware.js`, `routes/auth.js`, `routes/api/user.js`, `routes/api/schedules.js`, `routes/api/unavailability.js`). Findings 4-14 of `docs/code-review-2026-09-06.md` are not repeated; none of them was found to be more severe than rated. `npm test` (56 tests), `tsc --noEmit` and `expo lint` are clean.

Counts: 0 Critical, 1 Important, 3 Minor. No regressions found in the fixes for findings 1-3.

---

## Important

### A. A reinstalled app opens signed in with no user record; foreground refresh is never wired and vacation dates are filed under an empty doctor code

`services/auth.ts:266-293` (`isAuthenticated` checks only the token), `contexts/AuthContext.tsx:60-74` (`checkAuthStatus` accepts `authenticated === true` with `getUser()` returning `null`), `app/(tabs)/_layout.tsx:36-83` (every effect gated on `if (user)`), `app/(tabs)/requests.tsx:157` (`userDoctor = user?.doctorCode || ''`), `cticu-backend/routes/api/unavailability.js:33-46` (POST inserts whatever `doctor` string it is given).

The token lives in the iOS Keychain (expo-secure-store), which survives deleting the app; `user_info` lives in AsyncStorage, which does not. After a delete-and-reinstall the app therefore has a valid token and no user. `isAuthenticated()` asks `/api/user`, gets 200, returns `true`; `checkAuthStatus` stores `user = null` and navigates to the tabs. Nothing checks that a user record came with the session. This is pre-existing (the old `isAuthenticated` returned `response.ok`, the same outcome) and not introduced by the fixes, but it is not in the 14.

**Concrete failure**
1. Delete the app from the home screen, reinstall from the App Store, open it. It lands on the Schedule tab, not the login screen. Settings shows Username "Unknown".
2. `TabLayout` skips the AppState subscription and the badge fetch because `user` is null. `ForegroundContext.lastForegroundTime` never updates, so `CalendarView`'s foreground effect runs once at mount and never again: no silent refresh on foreground, no auto-navigation on date change, no badge updates. The calendar keeps showing whatever it loaded at launch, with no banner, for as long as the app stays warm.
3. Requests tab: `userDoctor` is `''`. Tap Add Dates. The POST body is `{doctor: "", dates: [...]}`, the backend inserts rows with `doctor_name = ''`, the app alerts "N dates added successfully!" and lists them under Upcoming Requests (because `unavailability['']` now contains them). The admin's scheduler, keyed by real doctor codes, never sees them.
4. Recovery is Settings > Sign Out and sign in again. Nothing prompts the user to do that.

**Severity: Important.** A real, repeatable user action (reinstalling to "fix" the app) yields a session that never refreshes and silently misfiles vacation requests. Downgraded from Critical because the trigger is uncommon, the Username row is a visible tell, and Sign Out recovers. The one-line guard is in `checkAuthStatus`: treat `authenticated && !userInfo` as not authenticated (or take the user from the `/api/user` body, which also closes finding 14).

---

## Minor

### B. The shared reachability signal is only updated by `fetchWithCache` and the Requests screen, so Settings and Requests can show the wrong banner in either direction until the next foreground

`services/api.ts:100` and `:127` (the only writes to the store inside the api layer, both in `fetchWithCache`), `services/api.ts:227-242` (`getShiftChangeRequests` never touches it), `services/api.ts:269-339` (approve/deny/acknowledge/create likewise), `stores/notificationStore.ts:68-137` (badge fetch reports only `badgesFetchFailed`), `app/(tabs)/settings.tsx:41-42,214` (banner and Clear Saved Data driven by the store), `app/(tabs)/requests.tsx:164` (banner driven by the store).

**Stuck false**
1. Backend restarts while the user foregrounds on Schedule: the silent refresh gets a 502, `backendReachable` becomes `false`, banner on Schedule.
2. Backend is back five seconds later. Tap Swap: badge fetch succeeds, no banner (it reads `badgesFetchFailed`). Tap Settings: "Server down - Some features unavailable" and Clear Saved Data is greyed out. Tap Requests (already mounted, so no reload): same banner. Back on Schedule: still bannered, because month navigation inside the loaded window makes no request.
3. Clears on the next background/foreground (the calendar's forced silent refresh) or a pull-to-refresh.

**Stuck true**
1. App open on Swap. Backend goes down. Pull to refresh: Swap shows "Server down" via `badgesFetchFailed`.
2. Tap Settings: no banner, Clear Saved Data enabled, because nothing on that path wrote to the store. Tap Clear. The cache the outage was supposed to protect is gone; the next calendar load outside the in-memory range throws and shows an empty grid with a banner.

**Severity: Minor.** Wrong banner and a guard that does not guard, but both self-correct on the next foreground and neither shows wrong shift data.

### C. The calendar's in-memory merge never removes a day, so a day whose shifts were all cleared (or a deleted holiday) survives pull-to-refresh until relaunch

`components/CalendarView.tsx:212-213` (`setSchedules(prev => ({...prev, ...schedulesData}))`, same for holidays), `:217` (user events on load), `cticu-backend/routes/api/schedules.js:37-46` (a day with no rows is absent from the response, not present-and-empty), `:133` (clearing an assignment deletes the row).

The spread replaces a day wholesale when the server still returns that day, so a single reassignment or removal on a day that keeps other shifts is fine. A day that ends up with no rows is simply missing from the response and the stale entry from `prev` stays. The AsyncStorage cache is correct (written wholesale per key); only React state is wrong.

**Concrete failure**
1. Doctor views October; Oct 15 shows 5C: A, 5W: B, Night: C.
2. Admin clears all three on Oct 15 (or deletes a holiday on the web).
3. Doctor pulls to refresh. Oct 15 still shows A, B, C; the holiday text still renders. Force-quit and relaunch is the only fix. `handleDeleteEvent` at `:424` replaces rather than merges, so an event deleted on this device disappears correctly; one deleted elsewhere does not.

**Severity: Minor.** Shows stale shift data after an explicit refresh, but requires every shift on a day to be removed, which is not a normal scheduling operation.

### D. A month rollover on foreground loads the old window, and the `isRefreshingRef` guard swallows the load for the new month

`components/CalendarView.tsx:100-132` (foreground effect: `setCurrentDate(startOfMonth(today))` then `loadData(false, true)` with the pre-rollover `year`/`month` closure), `:135-145` (month effect calls `loadData()` and records `lastLoadedMonth` for the new month), `:175-181` (`loadData` returns immediately when `isRefreshingRef.current` is set; only `navigateMonth` and `handleManualRefresh` clear it first).

The foreground effect sets the ref synchronously before the re-render, so the month effect's `loadData()` is a no-op while `setLastLoadedMonth` still runs. Pre-existing; `startOfMonth` did not change the sequence.

**Concrete failure**
1. Evening of Sep 30, doctor is looking at November (window Nov-Feb) and backgrounds the app.
2. Morning of Oct 1, foreground. The grid jumps to October. The silent refresh fetches Nov-Feb. October's cells come from whenever Sep-Dec was last in state (launch or the last foreground while viewing September). No banner, no indicator. `lastLoadedMonth` is October, so navigating to Nov/Dec/Jan does not reload either.
3. Corrects on the next foreground (which refreshes Oct-Jan) or a pull-to-refresh.

**Severity: Minor.** Staleness is bounded to one foreground cycle and the data shown is usually hours old, not days; but it is the one path found where the month a doctor is looking at is not the month that was just refreshed.

---

## Checked and cleared

Traced end to end and not reportable; listed so they are not re-investigated.

- **Expired JWT hitting change-password first.** `sessionExpiryOn401: false` means a 401 `{error: "Invalid token"}` there shows an "Invalid token" alert rather than ending the session. The next request from any other screen (tab change triggers a badge fetch, foreground triggers a refresh) gets the same 401 with the default option, clears the token, fires the handler and redirects. Self-heals on any navigation; not a stuck state.
- **Concurrent 401s on foreground** (badge fetch, schedules, holidays in parallel). `logout()` and the handler are idempotent; `fetchWithCache` serves cache on the `AuthError` but the redirect happens regardless.
- **Handler registration order.** `checkAuthStatus` is kicked off before `setSessionRejectedHandler` runs, but the fetch cannot resolve before the second effect completes in the same commit, and the return value covers it anyway.
- **Offline use of a token the server would reject.** The JWT has no server-side revocation (`jwt.verify` only, no DB lookup), so "server would reject" means only 30-day expiry or secret rotation. Offline, the app serves cache under the expo-network "No internet connection" banner; the next successful reach gets a 401 and ends the session. Working as designed.
- **Non-401 4xx from `/api/user` on cold launch** (Cloudflare 403/429). Lands on login with the token left in place; login then reports bad credentials. That is finding 12's shape, not a new one, and no rate-limit rule was found to make it concrete.
- **`startOfMonth` / `addMonths`.** Nothing reads `currentDate.getDate()`; `getMultiMonthBounds` and the header use year/month only. The only `setDate` in the tree is on a local copy in `RequestManagementCard.tsx:56`.
- **Login-screen double `router.replace`** (login.tsx and the auth effect). Pre-existing and harmless.

---

## Verdict

**Nothing here warrants another build before the next planned release.**

The three fixes shipped in build 26 hold: no path was found where the app believes it is signed in after a definitive 401, where a session that the server rejects keeps working once the server is reachable, or where the calendar lands on the wrong month. The reachability signal can lag (B) but always corrects on the next foreground.

The only Important finding (A) is pre-existing, needs a delete-and-reinstall to trigger, has a visible tell in Settings and a Sign Out recovery, and is a one-line guard in `checkAuthStatus`. It belongs in the next release alongside finding 14, not in an emergency build. C and D show stale data only in narrow sequences and are bounded by a relaunch or a foreground cycle respectively.
