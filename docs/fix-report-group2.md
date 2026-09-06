# Group 2 fix report — items 5, 7, 8, 9, 10, 12

Branch: `backlog-fixes`. Six commits, one per item, on top of the already-landed Group 1
work (`52854e3`).

## Item 5 — Stop the swap form discarding typed input

`app/(tabs)/swap.tsx`

The old `useEffect` re-ran `setShowCreateForm(!userHasAnyInvolvement)` on every change
to `pendingRequests`, which gets a fresh array reference from every badge fetch,
including the ones AppState triggers on any `active` transition (Control Center, a
notification, an incoming call). That unmounted `SwapRequestForm` — and everything
typed into it — for any user with prior swap involvement.

Fix: removed the reactive effect entirely. The collapse decision is now made exactly
once, inside `loadRequests`, guarded by a `hasDecidedInitialCollapseRef`. The first time
the screen's own load completes, it reads `useNotificationStore.getState().pendingRequests`
directly (not the possibly-stale value closed over by the render) and sets
`showCreateForm` once. Every later call to `loadRequests` — pull-to-refresh, the
focus-triggered refresh, the badge-clearing focus effect — updates `pendingRequests` and
badge counts as before, but never touches `showCreateForm` again for the life of the
mounted screen.

Consequence, matching the brief's intent: an expanded form with typed content is never
unmounted by a background refresh, even if the user's involvement genuinely changes
while they're typing (e.g. a new request naming them arrives mid-edit). The tradeoff is
that a user who starts with no involvement (form open by default) and later gains
involvement without ever touching the form will not see it auto-collapse on a later
visit unless the screen remounts. That's the explicitly stated tradeoff in the brief
("decided once when the screen loads").

No test added — this is a focus/effect timing behavior the brief classifies as UI
wiring, and exercising it meaningfully would require mounting the full screen with
navigation and store mocks.

## Item 7 — Reload the Requests tab on focus

`app/(tabs)/requests.tsx`

Added a `useFocusEffect` mirroring the pattern already used in `swap.tsx`: on focus, if
not already loading/refreshing, call `loadData(true)`. `unavailability` is not cached at
all, so this was pure in-memory staleness — the tab never re-fetched after the initial
mount, so vacation-date changes made elsewhere (web admin, another device) never
appeared until a pull-to-refresh or a force-quit.

## Item 8 — Nested scroll views still swallow the first tap

- `components/CalendarView.tsx`: added `keyboardShouldPersistTaps="handled"` to the
  horizontal detail pager `ScrollView` (line ~676) that contains the event title field
  and Save/Update/Cancel buttons.
- `components/SwapRequestForm.tsx`: added the same prop to the shift-chip list
  `ScrollView` that sits above the notes field.

Both are inner `ScrollView`s beneath an already-fixed outer `KeyboardAwareScrollView`;
RN's tap capture runs per `ScrollView`, so each nested one needed the prop set
independently.

## Item 9 — Group swap-form shifts by their real month

`components/SwapRequestForm.tsx`

`groupShiftsByMonth` used `new Date(date)` on a `YYYY-MM-DD` string, which parses as UTC
and reads as the previous month in US time zones for any 1st-of-month date — the chip
text itself was already correct because it used `parseDate`. Changed the grouping key to
use `parseDate` as well (already imported in the file).

Added a regression test in `__tests__/utils/date.test.ts` asserting
`parseDate('2026-10-01').getMonth() === 9`, documenting the exact boundary case the fix
guards against (this specific date was the reproduction case in the finding; other dates
in the month don't cross a month boundary when shifted a day backward, so they don't
surface the bug).

## Item 10 — Reset badge state on sign-out

`contexts/AuthContext.tsx`

`seenRequestStates` and `pendingRequests` in `stores/notificationStore.ts` are in-memory
only and `resetStore` was never called anywhere. Restructured `signOut` to a
try/catch/finally so the local-state cleanup (previously duplicated in both the success
and failure paths) runs once, and added `useNotificationStore.getState().resetStore()`
to that `finally` block.

This covers the sign-out path — the primary shared-device scenario the finding
describes (one user finishes and taps Sign Out for the next). It does **not** address
the separate consequence the finding also calls out: a pending request involving the
user re-badges on every cold launch and can't be dismissed, because the seen-set isn't
persisted across launches at all. Persisting `seenRequestStates` (e.g. to AsyncStorage)
is a larger change — it changes what "seen" means across app restarts and interacts
with the admin-vs-user badge semantics — so per the brief's guidance I left it out of
scope and am noting it here rather than expanding the change.

Added two tests to `__tests__/stores/notificationStore.test.ts`:
- `resetStore` clears counts, `pendingRequests`, `seenRequestStates`, and
  `badgesFetchFailed`.
- After `resetStore`, a request whose current state was previously marked seen re-badges
  on the next fetch (the actual user-visible behavior the reset exists to produce for
  the next signed-in user on a shared device).

## Item 12 — Stop login blaming the password for unexpected statuses

`services/auth.ts`

`login()`'s fallback branch (any status that's not 2xx, 401, or 5xx — e.g. Cloudflare
403 for a WAF rule, or 429 for rate limiting) threw `AuthError`, which `AuthContext`
turns into `return false`, which `login.tsx` renders as "Invalid username or password".
Changed that branch to throw `NetworkError` with the same message already used for the
5xx case, so it takes the existing "Trouble Connecting / Please try again later" path
instead (`AuthContext.signIn` already special-cases `NetworkError` by rethrowing it, and
`login.tsx`'s catch block already shows that copy — no changes needed in either file).

Added four tests to `__tests__/services/auth.test.ts`: a 401 still resolves `false`
(credentials genuinely wrong), and 5xx/403/429 all reject with `NetworkError` rather
than resolving `false` or throwing `AuthError`.

## Verification

```
npx tsc --noEmit   → clean
npm run lint       → clean (expo lint, no warnings)
npm test           → 4 suites, 71/71 tests passing (64 baseline + 7 added)
```

Test breakdown of the 7 added: 1 in `date.test.ts` (item 9), 2 in
`notificationStore.test.ts` (item 10), 4 in `auth.test.ts` (item 12). No existing
assertion was weakened; two test-file changes (`makeRequest` in
`notificationStore.test.ts`) added a `submitted_at` field and a type annotation purely
to satisfy `ShiftChangeRequest`'s required field under `tsc --noEmit`'s stricter
checking in the new `setState` call — no behavioral change to existing tests.

## Self-review notes

- Re-read the full diff commit-by-commit after finishing. `components/SwapRequestForm.tsx`
  needed two independent hunks (item 8's `keyboardShouldPersistTaps` prop and item 9's
  `parseDate` fix) split across two commits — did this by temporarily reverting one hunk,
  committing the other, then reapplying, and confirmed with `git diff --cached` before
  each commit that only the intended hunk was staged.
- Checked that `swap.tsx`'s other two `useFocusEffect`s (badge-clearing, data-refresh)
  are untouched and still call `fetchAndUpdateBadges`/`loadRequests` as before — only the
  auto-collapse effect was removed.
- Confirmed `pendingRequests` from the store selector is still used elsewhere in
  `swap.tsx` (`filteredRequests`, `renderRequest`) — only the now-removed effect's
  dependency on it was the problem, not the selector itself.
- Verified the `signOut` try/catch/finally restructuring in `AuthContext.tsx` preserves
  the original behavior on both success and failure (state is always cleared), and
  didn't silently swallow the dev-mode error log.

## Concerns

- None blocking. The one deliberate scope limit (item 10's seen-set not persisting
  across cold launches) is called out above and was pre-approved by the brief's own
  wording ("implement the sign-out reset and note the rest in your report").
