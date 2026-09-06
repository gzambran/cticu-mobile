# Next release backlog

Findings 1-14 come from a code review of `main` at `a9df0e5`; the full write-up with
reproduction steps is in `docs/code-review-2026-09-06.md`.

Numbering follows that report, so gaps mean the item is already done.

## On main, awaiting release

Shipped in neither 1.4.0 (build 25) nor any earlier build. Verified on device.

- **Findings 1 and 2 — session handling.** `isAuthenticated()` distinguishes the server
  rejecting a session from the app being unable to ask: a 401 ends it, while offline or a
  5xx keeps it so the app opens on cached data instead of a login wall. `authService`
  announces a genuine rejection and `AuthContext` clears its state, so the UI can no
  longer show a signed-in user whose token has been wiped. `authenticatedFetch` takes
  `sessionExpiryOn401`, which change-password opts out of — the backend returns 401 for a
  wrong current password, so a typo previously destroyed the session. Covered by
  `__tests__/services/auth.test.ts`.

- **Finding 14 — stale role and doctor code.** Closed in the backend: `GET /api/user`
  reads the users table for token auth rather than echoing the JWT's login-time claims
  (`cticu-backend` commit `b510100`, deployed 2026-09-06). The mobile side already
  refreshes its cached user from that endpoint on every launch, so no app change was
  needed.

- **Finding 3 — month navigation.** `currentDate` is anchored to the 1st via
  `startOfMonth`, and navigation uses `addMonths`, so shifting from the 31st can no
  longer overflow into the wrong month. Covered by `__tests__/utils/date.test.ts`.

## Important

**A. A reinstalled app opens signed in with no user record.** `contexts/AuthContext.tsx:60-74`

The token lives in the iOS Keychain and survives deleting the app; `user_info` lives in
AsyncStorage and does not. After a reinstall the app has a valid token and no user, and
`checkAuthStatus` accepts that. Foreground refresh and badge updates never wire up because
every effect in `app/(tabs)/_layout.tsx` is gated on `user`, and the Requests tab files
vacation dates under an empty doctor code, which the scheduler never sees. Settings showing
Username "Unknown" is the only tell; Sign Out recovers.

Fix by taking the user from the `/api/user` response `isAuthenticated()` already fetches
and discards, which also closes finding 14. Guarding on `authenticated && !userInfo`
instead would sign users out on any transient AsyncStorage read failure, since `getUser()`
returns null on error.

**4. Overlapping range caches overwrite newer schedule data.** Approving a swap invalidates
none of them.

**5. The swap form discards typed input** when the app flickers through `inactive`, for any
user with prior swap involvement.

**6. Switching the calendar filter to your own doctor does not load your events** — existing
events are invisible and the form offers to create over them.

**7. The Requests tab loads only on mount**, never on focus or foreground, so it shows stale
vacation data.

## Minor

8. Two nested `ScrollView`s still swallow the first tap while the keyboard is open.
9. Swap form groups 1st-of-month shifts under the previous month in US time zones.
10. Badge state is in-memory only and never reset on sign-out.
11. A doctors-list failure is permanent and silent for the session.
12. Login reports any non-401, non-5xx status as "Invalid username or password".
13. Vacation-request date pickers freeze their minimum on first render and drift across a
    quarter boundary.
14. Cached user info (role, doctorCode) is never refreshed after login.

## Carried over

**`CalendarView` user-event save/delete handle only `NetworkError`, not 5xx.** The one known
instance of the connectivity-misclassification bug left unfixed in 1.4.0. Saving a personal
calendar event while the backend is down shows a generic failure rather than the
"Couldn't Save" alert used everywhere else.

**Expo SDK 53 → 56 upgrade.** Tasks 5-8 of
`docs/superpowers/plans/2026-09-06-expo-sdk-56-upgrade.md`. Tasks 1-4 shipped in 1.4.0. The
40 characterization tests are the safety net for it. Task 8 deletes
`plugins/withFmtConstevalFix.js`, which exists only because fmt 11.0.2 cannot compile under
Apple clang 21; SDK 56 ships fmt 12.1.0 and needs no workaround.
