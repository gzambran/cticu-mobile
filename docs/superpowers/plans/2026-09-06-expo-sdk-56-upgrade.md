# Expo SDK 53 → 56 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get cticu-mobile building and shipping again on Xcode 26.6 by upgrading Expo SDK 53 → 56, without regressing scheduling behaviour doctors depend on.

**Architecture:** Upgrade one SDK version at a time (53→54→55→56, as Expo requires). Before touching any dependency, build a characterization test suite that pins current behaviour of the app's pure logic, so each SDK bump has a differential oracle. Because SDK 54 and 55 still carry the broken `fmt`, a temporary Podfile config plugin disables `fmt`'s consteval checks — this is migration scaffolding that gets deleted at SDK 56, where RN 0.85 ships a fixed `fmt`.

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19.2, Expo Router v56, TypeScript 5.8, Jest (`jest-expo`), EAS local builds via `Makefile`.

**Spec:** No separate spec document. Requirements were settled in conversation on 2026-09-06 and are captured verbatim in Global Constraints below.

## Background

Build #24 failed on 2026-09-06 with `call to consteval function 'fmt::basic_format_string<...>' is not a constant expression`, entirely inside `ios/Pods/fmt/include/fmt/format-inl.h` (lines 59, 60, 1387, 1391, 1394). No application code appears in the failure.

Cause: Xcode updated to 26.6 / Apple clang 21.0.0 on 2026-09-05 at 10:52, one day after the last successful build (#23, 2026-09-04 15:26). Apple clang 21 enforces stricter C++20 `consteval` rules that `fmt` 11.0.2 — pinned transitively by RN 0.79.6 — does not satisfy. Expo SDK 55 is still affected; SDK 56 (RN 0.85) ships `fmt` 12.1.0 and builds cleanly.

## What tests can and cannot catch here

Be honest about this when reporting progress:

**Tests will catch:** regressions in date math, calendar cell layout, badge/notification logic, and cache-key construction — the pure logic that React 19.2, Hermes v1, and dependency bumps could silently change.

**Tests will NOT catch:** native build failures, `Ionicons` name renames (typecheck catches those), navigation rendering, keyboard behaviour, or the date-picker legibility bug that started all this. Those require the manual device smoke test in every build task. Do not report an SDK step as verified on a green test run alone.

## Global Constraints

- Upgrade exactly one SDK major at a time: 53 → 54 → 55 → 56. Never skip.
- Xcode 26.6 / Apple clang 21.0.0 is the only Xcode installed. SDK 56 requires Xcode 26.4+; this satisfies it.
- Node v26.8.1 installed; SDK 56 requires ≥ 20.19.4. Satisfied.
- New Architecture is already enabled (`app.json` → `"newArchEnabled": true`). SDK 55+ requires it. Do not disable.
- `ios/` and `android/` are gitignored and untracked — they are prebuild output. Never commit them; delete them before each build.
- Commit messages: simple one-line, no attribution or `Co-Authored-By` footer.
- All work happens on branch `sdk-56-upgrade`. Do not commit to `main`.
- Build with `make ios-release` (build only). Do NOT run `make ship` until Task 8 — `ship` bumps the build number and uploads to App Store Connect.
- `app.json` currently contains two uncommitted/preexisting changes to preserve: `"userInterfaceStyle": "light"` (the dark-mode fix) and `"buildNumber": "24"` (bumped by the failed ship).

## File Structure

**Created:**
- `jest.config.js` — Jest configuration (`jest-expo` preset, `@/` alias mapping)
- `__tests__/utils/date.test.ts` — characterization tests for date helpers
- `__tests__/stores/notificationStore.test.ts` — characterization tests for badge logic
- `plugins/withFmtConstevalFix.js` — temporary Expo config plugin; deleted in Task 8

**Modified:**
- `package.json` — test scripts, devDependencies, then SDK dependency bumps in Tasks 5–7
- `app.json` — plugin registration (Task 4), removal (Task 8)
- `app/_layout.tsx:2`, `components/CalendarView.tsx:5`, `components/SwapRequestForm.tsx:5`, `app/(tabs)/swap.tsx:9` — React Navigation import migration (Task 7)

---

### Task 1: Branch and preserve the pending dark-mode fix

**Files:**
- Modify: `app.json` (already modified in working tree — commit as-is)

**Interfaces:**
- Produces: branch `sdk-56-upgrade` containing the `userInterfaceStyle: "light"` fix, which every later task builds on.

- [ ] **Step 1: Confirm the working tree state**

```bash
cd /Users/gzambran/GitHub/cticu-mobile
git status --short
```

Expected: exactly one modified file, ` M app.json`.

- [ ] **Step 2: Confirm the two intended app.json values are present**

```bash
grep -n 'userInterfaceStyle\|buildNumber' app.json
```

Expected: `"userInterfaceStyle": "light",` and `"buildNumber": "24",`.

- [ ] **Step 3: Create the working branch**

```bash
git checkout -b sdk-56-upgrade
```

- [ ] **Step 4: Commit the fix**

```bash
git add app.json
git commit -m "Force light appearance so native date picker stays legible in dark mode"
```

---

### Task 2: Test infrastructure and date helper characterization tests

**Files:**
- Create: `jest.config.js`
- Create: `__tests__/utils/date.test.ts`
- Modify: `package.json` (scripts + devDependencies)

**Interfaces:**
- Consumes: `@/utils/date` exports `formatDate(date: Date): string`, `parseDate(dateStr: string): Date`, `getCalendarDays(year: number, month: number, firstDayMonday?: boolean): (Date | null)[]`, `isToday(date: Date): boolean`, `getMultiMonthBounds(year: number, month: number, monthCount?: number): { start: string; end: string }`
- Produces: `npm test` runs the suite; later tasks use it as the regression gate.

- [ ] **Step 1: Install the test toolchain**

```bash
npx expo install --dev jest-expo jest @types/jest
```

- [ ] **Step 2: Create `jest.config.js`**

```js
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
};
```

- [ ] **Step 3: Add test scripts to `package.json`**

Add to the `"scripts"` block:

```json
    "test": "jest",
    "test:watch": "jest --watch"
```

- [ ] **Step 4: Write the failing test file**

Create `__tests__/utils/date.test.ts`:

```ts
import {
  formatDate,
  getCalendarDays,
  getMultiMonthBounds,
  isToday,
  parseDate,
} from '@/utils/date';

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 9, 15))).toBe('2026-10-15');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseDate', () => {
  it('parses YYYY-MM-DD into a local-time date, not UTC', () => {
    const parsed = parseDate('2026-10-15');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9);
    expect(parsed.getDate()).toBe(15);
  });

  it('round-trips with formatDate', () => {
    expect(formatDate(parseDate('2026-10-15'))).toBe('2026-10-15');
  });
});

describe('getCalendarDays', () => {
  it('always returns 42 cells', () => {
    expect(getCalendarDays(2026, 9)).toHaveLength(42);
  });

  it('pads leading nulls up to the starting weekday, Sunday-first', () => {
    // 1 Oct 2026 is a Thursday, getDay() === 4
    const days = getCalendarDays(2026, 9);
    expect(days.slice(0, 4)).toEqual([null, null, null, null]);
    expect(formatDate(days[4] as Date)).toBe('2026-10-01');
  });

  it('includes every day of the month', () => {
    const days = getCalendarDays(2026, 9).filter(Boolean) as Date[];
    expect(days).toHaveLength(31);
    expect(formatDate(days[30])).toBe('2026-10-31');
  });

  it('shifts the padding when the week starts on Monday', () => {
    // 1 Feb 2026 is a Sunday, so Monday-first pushes it to the 7th cell
    const days = getCalendarDays(2026, 1, true);
    expect(days.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(formatDate(days[6] as Date)).toBe('2026-02-01');
  });
});

describe('isToday', () => {
  it('is true for now', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('is false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isToday(tomorrow)).toBe(false);
  });
});

describe('getMultiMonthBounds', () => {
  it('spans the first of the month to the last day of the final month', () => {
    expect(getMultiMonthBounds(2026, 9, 4)).toEqual({
      start: '2026-10-01',
      end: '2027-01-31',
    });
  });

  it('defaults to a four-month window', () => {
    expect(getMultiMonthBounds(2026, 9)).toEqual({
      start: '2026-10-01',
      end: '2027-01-31',
    });
  });
});
```

- [ ] **Step 5: Run the tests**

```bash
npm test -- __tests__/utils/date.test.ts
```

Expected: all pass. These are characterization tests against working code — a failure here means the config is wrong, not the app. Fix the config until green.

- [ ] **Step 6: Commit**

```bash
git add jest.config.js package.json package-lock.json __tests__/utils/date.test.ts
git commit -m "Add jest setup and characterization tests for date helpers"
```

---

### Task 3: Characterization tests for badge logic

**Files:**
- Create: `__tests__/stores/notificationStore.test.ts`

**Interfaces:**
- Consumes: `@/stores/notificationStore` default export (Zustand store) with `fetchAndUpdateBadges(username: string, role: string, doctorCode?: string): Promise<void>`, `markRequestAsSeen(requestId: number, status: string): void`, `markAllRequestsAsSeen(): void`, `resetStore(): void`, and state fields `swapBadgeCount: number`, `pendingRequests: ShiftChangeRequest[]`
- Consumes: `@/services/api` default export with `getShiftChangeRequests()`

This is the most intricate logic in the app and `CLAUDE.md` flags it as CRITICAL: admin badges are a work queue that persists until requests are actioned; user badges are unseen-update indicators keyed by `"requestId-status"`. These tests pin that distinction so an SDK bump cannot quietly change it.

- [ ] **Step 1: Write the test file**

Create `__tests__/stores/notificationStore.test.ts`:

```ts
import api from '@/services/api';
import useNotificationStore from '@/stores/notificationStore';

jest.mock('@/services/api', () => ({
  __esModule: true,
  default: { getShiftChangeRequests: jest.fn() },
}));

const mockedApi = api as unknown as {
  getShiftChangeRequests: jest.Mock;
};

const makeRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: 'pending',
  requester_username: 'someone-else',
  shifts: [],
  ...overrides,
});

beforeEach(() => {
  useNotificationStore.getState().resetStore();
  jest.clearAllMocks();
});

describe('admin badges behave as a work queue', () => {
  it('counts only pending requests', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'pending' }),
      makeRequest({ id: 2, status: 'approved' }),
      makeRequest({ id: 3, status: 'pending' }),
    ]);

    await useNotificationStore.getState().fetchAndUpdateBadges('admin-user', 'admin');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(2);
  });

  it('ignores seen-state entirely, so the badge persists until actioned', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'pending' }),
    ]);

    useNotificationStore.getState().markRequestAsSeen(1, 'pending');
    await useNotificationStore.getState().fetchAndUpdateBadges('admin-user', 'admin');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
  });
});

describe('regular user badges behave as unseen-update indicators', () => {
  it('does not badge the requester for their own pending request', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'pending', requester_username: 'gz' }),
    ]);

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
  });

  it.each(['approved', 'denied'])(
    'badges the requester once their request is %s',
    async (status) => {
      mockedApi.getShiftChangeRequests.mockResolvedValue([
        makeRequest({ id: 1, status, requester_username: 'gz' }),
      ]);

      await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

      expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
    }
  );

  it.each(['pending', 'approved', 'denied'])(
    'badges an involved doctor when the status is %s',
    async (status) => {
      mockedApi.getShiftChangeRequests.mockResolvedValue([
        makeRequest({
          id: 1,
          status,
          requester_username: 'someone-else',
          shifts: [{ from_doctor: 'GZ', to_doctor: 'XX' }],
        }),
      ]);

      await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

      expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
    }
  );

  it('does not badge a doctor who is uninvolved and not the requester', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({
        id: 1,
        status: 'pending',
        requester_username: 'someone-else',
        shifts: [{ from_doctor: 'AA', to_doctor: 'BB' }],
      }),
    ]);

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
  });

  it('suppresses the badge once that exact request and status is seen', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'approved', requester_username: 'gz' }),
    ]);

    useNotificationStore.getState().markRequestAsSeen(1, 'approved');
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
  });

  it('re-badges when the status moves on from the seen one', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'denied', requester_username: 'gz' }),
    ]);

    useNotificationStore.getState().markRequestAsSeen(1, 'approved');
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(1);
  });

  it('markAllRequestsAsSeen silences badges at their current statuses', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue([
      makeRequest({ id: 1, status: 'approved', requester_username: 'gz' }),
    ]);

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');
    expect(useNotificationStore.getState().swapBadgeCount).toBe(1);

    useNotificationStore.getState().markAllRequestsAsSeen();
    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');
    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
  });
});

describe('failure handling', () => {
  it('zeroes the badge when the request fetch rejects', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedApi.getShiftChangeRequests.mockRejectedValue(new Error('network'));

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
    consoleError.mockRestore();
  });

  it('zeroes the badge and clears the cache on a non-array response', async () => {
    mockedApi.getShiftChangeRequests.mockResolvedValue(null);

    await useNotificationStore.getState().fetchAndUpdateBadges('gz', 'user', 'GZ');

    expect(useNotificationStore.getState().swapBadgeCount).toBe(0);
    expect(useNotificationStore.getState().pendingRequests).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npm test -- __tests__/stores/notificationStore.test.ts
```

Expected: all pass. If any fail, the test encodes a wrong assumption about current behaviour — read `stores/notificationStore.ts` and correct the test to match what the code does today. Do NOT change the store; these tests exist to capture current behaviour, not to improve it.

- [ ] **Step 3: Run the whole suite and record the baseline**

```bash
npm test
```

Expected: all green. Note the total test count — every later task must keep this number passing.

- [ ] **Step 4: Commit**

```bash
git add __tests__/stores/notificationStore.test.ts
git commit -m "Add characterization tests for admin and user badge logic"
```

---

### Task 4: Temporary fmt consteval workaround, verified against SDK 53

**Files:**
- Create: `plugins/withFmtConstevalFix.js`
- Modify: `app.json` (register plugin)

**Interfaces:**
- Produces: a buildable app on Xcode 26.6 while still on SDK 53. This both validates the workaround and gives a running SDK 53 baseline to smoke-test against, so later regressions can be attributed to the SDK bump rather than to the compiler.

This plugin is scaffolding with a defined end: Task 8 deletes it.

- [ ] **Step 1: Create the config plugin**

Create `plugins/withFmtConstevalFix.js`:

```js
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Apple clang 21 (Xcode 26.4+) rejects fmt 11.0.2's FMT_STRING consteval checks,
// which breaks every Expo SDK up to and including 55. Disabling FMT_USE_CONSTEVAL
// moves fmt's format-string validation from compile time to runtime; the affected
// format strings live inside React Native's own vendored code.
// SDK 56 ships fmt 12.1.0 and does not need this. Delete this plugin then.
const PATCH_MARKER = 'FMT_USE_CONSTEVAL=0';

const PATCH = `
    # Temporary: fmt 11.0.2 vs Apple clang 21. Remove on Expo SDK 56.
    installer.pods_project.targets.each do |fmt_target|
      fmt_target.build_configurations.each do |fmt_config|
        defs = fmt_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        fmt_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs + ['FMT_USE_CONSTEVAL=0']
      end
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (innerConfig) => {
      const podfilePath = path.join(
        innerConfig.modRequest.platformProjectRoot,
        'Podfile'
      );
      const contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(PATCH_MARKER)) {
        return innerConfig;
      }

      const anchor = 'post_install do |installer|';
      if (!contents.includes(anchor)) {
        throw new Error(
          'withFmtConstevalFix: could not find post_install hook in Podfile'
        );
      }

      fs.writeFileSync(
        podfilePath,
        contents.replace(anchor, anchor + '\n' + PATCH)
      );
      return innerConfig;
    },
  ]);
};
```

- [ ] **Step 2: Register the plugin in `app.json`**

In the `"plugins"` array, add `"./plugins/withFmtConstevalFix"` as the last entry:

```json
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      "expo-secure-store",
      "expo-font",
      "./plugins/withFmtConstevalFix"
    ],
```

- [ ] **Step 3: Clear stale native output**

```bash
rm -rf ios android
```

- [ ] **Step 4: Build and verify the workaround actually works**

```bash
make ios-release
```

Expected: build succeeds and produces an `.ipa`. This is the step that validates the plugin — it is unverified until this passes.

If it still fails with the same `consteval` error, the fallback is to force the `fmt` pod to C++17 instead. Replace the body of `PATCH` with:

```ruby
    installer.pods_project.targets.each do |fmt_target|
      if fmt_target.name == 'fmt'
        fmt_target.build_configurations.each do |fmt_config|
          fmt_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
```

and change `PATCH_MARKER` to `"CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'"`. Rerun this step.

If neither works, STOP and report — do not attempt a third variation without discussion.

- [ ] **Step 5: Install on device and record the baseline behaviour**

Install the `.ipa` on the iPhone and walk the smoke test, noting anything already odd so it is not later blamed on the SDK upgrade:

- Log in
- Schedule tab: calendar renders, today is highlighted, month navigation works, shift colours correct
- Filters apply and persist
- Swap tab: requests list loads, badge count matches expectation
- Requests tab: **start and end date pickers open and the spinner is legible** (the original bug — confirm the `userInterfaceStyle: light` fix worked)
- Swing shifts tab renders
- Settings: user info shown, logout works
- Airplane mode: cached schedule still displays

- [ ] **Step 6: Commit**

```bash
git add plugins/withFmtConstevalFix.js app.json
git commit -m "Add temporary fmt consteval workaround for Xcode 26 builds"
```

---

### Task 5: Upgrade to Expo SDK 54

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: app on SDK 54 / RN 0.81, tests green, device build verified.

Known SDK 54 notes: minimum Xcode 16.1 (satisfied), minimum Node 20.19.4 (satisfied), `@expo/vector-icons` icon families updated to newer `react-native-vector-icons` — renamed or removed icons surface as typecheck errors.

- [ ] **Step 1: Bump the SDK**

```bash
npx expo install expo@^54.0.0
npx expo install --fix
```

- [ ] **Step 2: Check for dependency issues**

```bash
npx expo-doctor
```

Record any warnings. `react-native-keyboard-controller` is the third-party dep most likely to need a manual version bump — it is not an Expo-managed package, so `--fix` will not move it. If doctor flags it, install the version matching this RN release:

```bash
npm install react-native-keyboard-controller@latest
```

- [ ] **Step 3: Typecheck for renamed icons and API changes**

```bash
npx tsc --noEmit
```

Expected: clean. The app uses these `Ionicons` names — a rename shows up here as a type error: `add`, `add-circle-outline`, `calendar`, `calendar-outline`, `checkmark`, `chevron-back`, `chevron-forward`, `close`, `cloud-offline-outline`, `create-outline`, `filter`, `globe-outline`, `key-outline`, `log-out-outline`, `open-outline`, `pencil`, `person-circle-outline`, `person-outline`, `send`, `settings`, `settings-outline`, `swap-horizontal`, `trash-outline`.

Fix any reported name by picking the closest current Ionicons equivalent.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

- [ ] **Step 5: Run the test suite**

```bash
npm test
```

Expected: same count green as the Task 3 baseline. Any failure is a real behaviour change from RN 0.81 — investigate before continuing, do not adjust the test to pass.

- [ ] **Step 6: Clean native output and build**

```bash
rm -rf ios android
make ios-release
```

Expected: build succeeds (the fmt plugin from Task 4 is carrying this).

- [ ] **Step 7: Install on device and smoke test**

Walk the same checklist as Task 4 Step 5. Compare against the baseline notes.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json
git commit -m "Upgrade to Expo SDK 54"
```

---

### Task 6: Upgrade to Expo SDK 55

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: app on SDK 55 / RN 0.83, tests green, device build verified.

Known SDK 55 notes: New Architecture is mandatory (already enabled). `expo-av` is removed — this project does not use it, so no migration needed. Reanimated moves v3 → v4; this project has **zero direct `react-native-reanimated` imports** (it is a transitive dependency of `expo-router` and `react-native-keyboard-controller`), so no animation code should need rewriting.

- [ ] **Step 1: Bump the SDK**

```bash
npx expo install expo@^55.0.0
npx expo install --fix
```

- [ ] **Step 2: Confirm New Architecture is still on**

```bash
grep -n newArchEnabled app.json
```

Expected: `"newArchEnabled": true`.

- [ ] **Step 3: Check for dependency issues**

```bash
npx expo-doctor
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Lint**

```bash
npm run lint
```

- [ ] **Step 6: Run the test suite**

```bash
npm test
```

Expected: same count green as baseline.

- [ ] **Step 7: Clean native output and build**

```bash
rm -rf ios android
make ios-release
```

Expected: build succeeds via the fmt plugin. SDK 55 still ships the affected fmt, so removing the plugin here would reproduce the original failure.

- [ ] **Step 8: Install on device and smoke test**

Walk the checklist. Pay extra attention to keyboard behaviour on the login screen and swap request form — Reanimated v4 and `react-native-keyboard-controller` interact here.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json
git commit -m "Upgrade to Expo SDK 55"
```

---

### Task 7: Upgrade to Expo SDK 56 and migrate React Navigation imports

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `app/_layout.tsx:2`
- Modify: `components/CalendarView.tsx:5`
- Modify: `components/SwapRequestForm.tsx:5`
- Modify: `app/(tabs)/swap.tsx:9`

**Interfaces:**
- Produces: app on SDK 56 / RN 0.85 / React 19.2, with all `@react-navigation/*` imports rehomed.

Known SDK 56 notes: Expo Router v56 is forked from React Navigation, so application-code imports from `@react-navigation/*` are no longer supported — they move to `expo-router/react-navigation`. The `<Stack>`, `<Tabs>`, and file-based routing patterns themselves are unchanged. The `expo` package no longer depends on `@expo/vector-icons`, so it must become an explicit dependency.

- [ ] **Step 1: Bump the SDK**

```bash
npx expo install expo@^56.0.0
npx expo install --fix
```

- [ ] **Step 2: Add `@expo/vector-icons` as an explicit dependency**

It is used in 9 files and is no longer pulled in by `expo`:

```bash
npx expo install @expo/vector-icons
```

- [ ] **Step 3: Migrate the four React Navigation imports**

In `app/_layout.tsx` line 2, change:

```ts
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
```

to:

```ts
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
```

In `components/CalendarView.tsx` line 5, `components/SwapRequestForm.tsx` line 5, and `app/(tabs)/swap.tsx` line 9, change:

```ts
import { useFocusEffect } from '@react-navigation/native';
```

to:

```ts
import { useFocusEffect } from 'expo-router/react-navigation';
```

Expo also publishes a codemod for this migration; running it is an acceptable substitute for the manual edits, but verify it touched exactly these four files and nothing else.

- [ ] **Step 4: Verify no `@react-navigation` imports remain in app code**

```bash
grep -rn "@react-navigation" --include="*.tsx" --include="*.ts" app components contexts stores services utils
```

Expected: no output.

- [ ] **Step 5: Drop the now-unused direct dependency**

```bash
npm uninstall @react-navigation/native
```

If `expo-doctor` or the build later complains that something still needs it, reinstall it and note why.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. React 19.2 plus the `@types/react` bump is the likeliest source of new errors here.

- [ ] **Step 7: Lint**

```bash
npm run lint
```

- [ ] **Step 8: Run the test suite**

```bash
npm test
```

Expected: same count green as baseline.

- [ ] **Step 9: Clean native output and build**

```bash
rm -rf ios android
make ios-release
```

- [ ] **Step 10: Install on device and smoke test**

Walk the full checklist. Navigation is the highest-risk area in this task — exercise every tab, deep navigation, and back gestures.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json app/_layout.tsx components/CalendarView.tsx components/SwapRequestForm.tsx "app/(tabs)/swap.tsx"
git commit -m "Upgrade to Expo SDK 56 and move navigation imports to expo-router"
```

---

### Task 8: Remove the fmt workaround and confirm a clean SDK 56 build

**Files:**
- Delete: `plugins/withFmtConstevalFix.js`
- Modify: `app.json` (deregister plugin)

**Interfaces:**
- Produces: an app that builds on stock SDK 56 with no local patches — the actual goal of this whole plan.

- [ ] **Step 1: Deregister the plugin in `app.json`**

Remove the `"./plugins/withFmtConstevalFix"` entry from the `"plugins"` array, restoring it to:

```json
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      "expo-secure-store",
      "expo-font"
    ],
```

- [ ] **Step 2: Delete the plugin file**

```bash
rm plugins/withFmtConstevalFix.js
rmdir plugins 2>/dev/null || true
```

- [ ] **Step 3: Confirm the fmt version actually shipped is the fixed one**

```bash
rm -rf ios android
npx expo prebuild --platform ios --clean
grep -n "fmt (" ios/Podfile.lock | head -3
```

Expected: `fmt (12.x)` or newer. If it still reports 11.0.2, the workaround is still required — restore the plugin, stop, and report.

- [ ] **Step 4: Build without the workaround**

```bash
make ios-release
```

Expected: build succeeds. This is the definitive verification that the upgrade solved the original problem rather than the patch masking it.

- [ ] **Step 5: Install on device and run the full smoke test one final time**

Walk the complete checklist from Task 4 Step 5, with particular attention to the date pickers in the Requests tab being legible.

- [ ] **Step 6: Commit**

```bash
git add app.json
git commit -m "Remove fmt consteval workaround now that SDK 56 ships fixed fmt"
```

- [ ] **Step 7: Report before shipping**

Do NOT run `make ship` autonomously. Report to Giancarlos that the branch is ready, summarising: which SDK steps built cleanly, any dependency versions that needed manual pinning, and any smoke-test differences from the SDK 53 baseline. Merging to `main` and shipping is his call.

---

## Rollback

Every task is a single commit on `sdk-56-upgrade`, and `main` is untouched. To abandon at any point:

```bash
git checkout main
rm -rf ios android node_modules
npm install
```

The SDK 53 tree on `main` still will not build on Xcode 26.6. If shipping from `main` becomes urgent mid-migration, cherry-pick the Task 1 and Task 4 commits (the dark-mode fix and the fmt workaround) onto `main` — together they produce a shippable SDK 53 build.
