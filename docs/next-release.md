# Next release backlog

Work queued after 1.4.0 (build 25). Findings 1-14 come from a code review of `main` at
`a9df0e5`; the full write-up with reproduction steps for each is in the review report
(regenerate it or see the notes below — the reviewer's scratch workspace is gitignored).

## Critical

**1. Any 401 signs the user out while the UI stays signed in.**
`services/auth.ts:210-213`, `contexts/AuthContext.tsx`, `services/api.ts:123-138`

`authenticatedFetch` treats every 401 as session expiry and calls `logout()`, deleting the
token, but `AuthContext` is never told — `isAuthenticated` stays true and no redirect
happens. Every later request then throws `AuthError('Not authenticated')`, which
`fetchWithCache` answers by returning cached data with no age limit and no banner. A
mistyped current password in Change Password is enough to trigger it, because the backend
returns 401 for a wrong password. The user reads an unbounded-age schedule with nothing on
screen indicating it, until they sign out or force-quit.

**2. Cold launch without a connection lands on a login wall.**
`services/auth.ts:240-253`, `contexts/AuthContext.tsx:34-63`

`isAuthenticated()` decides by making a live request, so being offline or getting a 502
both read as "not authenticated" and redirect to login. The cached schedule is unreachable
from there. This defeats the purpose of the cache in the exact situation it exists for: a
phone with no signal, opening an app iOS has evicted from memory.

## Important

**3. Month navigation skips or sticks.** `components/CalendarView.tsx:250-266`
`setMonth` is called on a date still carrying its day-of-month, so asking for "one month
on" from Oct 31 asks for "Nov 31" and rolls into Dec 1. Only fires when the day number is
absent from the destination month — 11 days in the next 13 months, first on 2026-10-31.
Fix by setting the day to 1 before shifting the month, in `navigateMonth`, `jumpToToday`,
and the initial `useState`.

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
