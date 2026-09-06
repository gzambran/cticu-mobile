# Fix brief — backlog pass after 1.4.0 (build 26)

Ten items agreed with Giancarlos. Full reproduction steps for each live in
`docs/code-review-2026-09-06.md` (findings numbered 4-14) and
`docs/code-review-followup.md` (findings lettered A-D). **Read the relevant finding
before implementing it** — the numbering below matches those reports.

Deliberately out of scope, decided and not to be revisited: findings 13 (quarter
boundary), B (banner sync), C (cleared-day merge), D (month rollover). All are rare and
self-correcting. Do not fix them; do not report them as gaps.

## Group 1 — session and calendar data

### A + 14. Refresh the user record from the server on every launch

`isAuthenticated()` already fetches `/api/user` and throws the body away. Use it: parse the
response and store it as the cached user, so role and `doctorCode` are refreshed on every
launch rather than frozen at login (finding 14), and a reinstall — which leaves a valid
token in the Keychain but no user in AsyncStorage — repopulates the user instead of
entering the app with `user === null` (finding A).

Do NOT instead guard `checkAuthStatus` on `authenticated && !userInfo`. `getUser()` returns
`null` on a transient AsyncStorage read failure too, so that guard would sign people out
spuriously.

Keep the existing semantics from the last pass intact: offline or a 5xx still returns
`true` and keeps the session; only a definitive 401 ends it. When the backend is
unreachable there is no body to parse, so the cached user must be left alone rather than
cleared.

### 4. Invalidate schedule caches when a swap changes the schedule, and reload the calendar on focus

Two separate causes, both needed:

- Approving, denying, or creating a shift-change request does not invalidate any
  `schedules_*` cache key. It must. Clear the schedule cache keys on those mutations.
- `CalendarView` has no focus effect, so switching back to the Schedule tab never reloads.
  Add one, consistent with how `swap.tsx` already uses `useFocusEffect`.

Note the overlapping-window problem described in the finding: windows starting at different
months are separate keys with independent freshness, so an older window can be merged over
newer state. Clearing the keys on mutation is what addresses this; do not attempt a larger
redesign of the cache layout in this pass.

### 6. Load personal events when the doctor filter changes

Events are only fetched when `isOwnCalendar` is true at load time, and the reload effect
depends only on `currentDate`. Switching the filter to yourself therefore shows no events
until some other cause triggers a reload. Make the reload react to the selected doctor as
well.

### 11. Retry the doctors list when it is empty

`DoctorsContext` loads once on mount. On failure it sets `error` and an empty array, and
nothing anywhere reads `error` or calls `refreshDoctors` — so a single failed load leaves
every doctor picker empty for the whole session and swaps cannot be created.

Retry on app foreground when the list is empty. The app already has `ForegroundContext`;
use it. No new UI — do not add an error banner or retry button.

## Group 2 — swap, requests, and messaging

### 5. Stop the swap form discarding typed input

The collapse effect depends on `pendingRequests`, and every badge fetch stores a new array
reference, so any AppState `active` transition — a notification, Control Center — re-runs
it, collapses the form, and unmounts it along with everything typed.

The auto-collapse should reflect a genuine change in whether the user has swap involvement,
not the identity of a freshly fetched array. Ensure that an in-progress form is never
unmounted by a background refresh.

### 7. Reload the Requests tab on focus

It loads only in `useEffect(..., [])`, and tabs stay mounted, so changes made elsewhere
never appear. Add a focus-based reload, consistent with `swap.tsx`.

### 8. Nested scroll views still swallow the first tap

`keyboardShouldPersistTaps` was added to the four outer `KeyboardAwareScrollView`s, but
React Native's capture runs per `ScrollView` and two inner ones still default to `never`:
the calendar's horizontal detail pager containing the event title field and Save button,
and the swap form's shift-chip list above the notes field. Set it on those.

### 9. Group swap-form shifts by their real month

`new Date("2026-10-01")` parses as UTC and reads as September in US time zones, so a shift
on the 1st is grouped under the previous month's heading. The chip text is already correct
because it uses `parseDate`. Use the same local-time parsing for the grouping key.

### 10. Reset badge state on sign-out

`seenRequestStates` and `pendingRequests` are in-memory only. Two consequences: a pending
request involving the user re-badges on every cold launch and cannot be dismissed, and on a
shared device one user inherits the other's seen-set.

`notificationStore` already has `resetStore`. Call it on sign-out. Consider whether the
seen-set should persist across launches so a viewed pending request stays viewed — if you
judge that a larger change, implement the sign-out reset and note the rest in your report
rather than expanding scope.

### 12. Stop login blaming the password for unexpected statuses

A non-401, non-5xx response — Cloudflare returning 403 or 429 — currently reports "Invalid
username or password", so a user may go and reset a password that was correct. Only a
genuine 401 should say the credentials are wrong. Anything else should use the existing
"Trouble Connecting" treatment.

## Constraints

- Branch `backlog-fixes`, already created. Simple one-line commit messages, no attribution
  footer. Commit each item separately so they can be reviewed and reverted independently.
- `npx tsc --noEmit`, `npm run lint`, and `npm test` must all pass. The suite is 56 tests.
- Add tests where the logic is testable without heavy mocking — the date parsing in 9, the
  store reset in 10, the auth changes in A/14. UI wiring (focus effects, scroll props) does
  not need tests. Do not weaken an existing assertion to make something pass.
- User-facing copy: plain language, no jargon. Never the words "server", "cache", "status
  code", "network error". Existing strings are "No internet connection", "Server down -
  Some features unavailable", "Couldn't Save / Try again later", "Trouble Connecting /
  Please try again later" — reuse them rather than inventing new ones.
- Do NOT run an iOS build, `expo prebuild`, or `pod install`. Do not touch
  `plugins/withFmtConstevalFix.js` or `app.json`.
