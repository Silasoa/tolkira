# Tasks

## 1. Gate

- [x] 1.1 Validate the spec/design; confirm display-only, no schema/status/input
  adapter change and the two locale keys only.
- [x] 1.2 Confirm the Playwright adapter already emits `@flaky` and the existing
  tag filter remains the only filter.

## 2. TDD-Red

- [x] 2.1 Playwright retry-passed fixture: badge + tagged run count; summary
  status stays passed; JSON/CI/email unchanged.
- [x] 2.2 Cucumber/legacy user `@flaky`; no-flaky fixture; de catalog.
- [x] 2.3 Confirm RED for the missing badge/count; guards stay green.

## 3. Implement

- [x] 3.1 Add `flakyScenarioCount`, the run-meta `N tagged @flaky` item and the
  scenario badge with the pending palette and wrapping.
- [x] 3.2 Add `report.flakySummary`/`report.flakyBadge` en/de; run the i18n
  asset build.
- [x] 3.3 Update `docs/PLAYWRIGHT-JSON.md`, `docs/AGENT-INTERFACE.md`,
  `docs/LIMITATIONS.md`, `docs/CHANGELOG.md` and `docs/BACKLOG.md`; no schema.
- [x] 3.4 Keep JSON/CI/email, statuses, counts, filters and dependencies
  unchanged.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [x] 4.2 Run SCR, CR, DAR, UXR, ILA and CMP; SEC/PCA not triggered beyond the
  existing render checks.
- [x] 4.3 Fix findings; record deferred decisions.
- [x] 4.4 Commit and push; no release.

## 5. Review follow-up

- [x] 5.1 Remove the flaky-only summary `data-status`; assert the existing
  `data-status` on the scenario opening tag instead.
- [x] 5.2 Add a mixed tagged/plain test and document inherited/outline tags and
  the lowercase match; the count is tagged rows, not a flake rate.
- [x] 5.3 Add a real Chromium/Firefox/WebKit E2E check at 1440 and 320 for the
  badge, tagged run count, unchanged status/tag and no overflow.
- [x] 5.4 Move the count out of `.counts` into run metadata, make the badge
  decorative, and update catalogs, docs and the host exception.

## Gate record

- 2026-11-22: focused unit `npx vitest run test/flaky-visibility.test.ts` 7/7;
  focused browser `npx playwright test test/e2e/report.spec.ts -g flaky` 3/3
  (Chromium, Firefox, WebKit) at 1440 and 320; `npm run check` green (71 files,
  1064 passed, 4 skipped); `npm run hygiene` ok (651 files, 263 commits).
- Full `npm run test:e2e`: 358 passed, 8 skipped (the three new flaky checks
  included), across Chromium, Firefox and WebKit.
- Reviews: SCR, CR, DAR, UXR, ILA and CMP PASS after the fixer/recheck rounds.
- Deferred: the movies-app host run had zero tagged scenarios, so the real-run
  fixture plus E2E covers the badge/pill (recorded in DROP-IN-VALIDATION); a
  grouped outline relies on the outline heading for the accessible `@flaky` text
  because row tags are suppressed. No schema, status, filter, JSON, CI or email
  change; the count is a tagged-row count, not a flake rate.
