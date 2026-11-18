# TDD-Red — clarify-run-presentation

Date: 2026-11-19
Worker: TDD-Red (issue #25, spec approved by the coordinator before this step).

## Scope

Tests and fixtures only. No `src/`, docs or config changes. No commit.

## Files

Created:

- `test/fixtures/playwright/skipped-no-steps.json`
- `test/fixtures/playwright/two-files.json`
- `test/fixtures/playwright/error-locations.json`
- `test/fixtures/messages/run-ratio.ndjson`
- `test/fixtures/messages/run-ratio.feature`
- `test/fixtures/messages/skipped-only.ndjson`
- `test/fixtures/messages/skipped-only.feature`
- `test/render-counts.test.ts`
- `openspec/changes/clarify-run-presentation/tdd-red.md`

Changed:

- `test/playwright.test.ts` — new fixtures and three tests (skipped summary,
  two-file source labels, one location per error).
- `test/render.test.ts` — pinned assertions moved to the new contract:
  `Run environment`, `N scenarios with results`, `1 unexecuted`,
  `Scenario time`. No existing test deleted or widened.
- `test/e2e/report.spec.ts` — same header/meta updates; new ratio and
  multi-file browser tests. Empty-run `.healthTop` and `0 / 0` assertions stay.

## Fixtures

- `skipped-no-steps.json`: one project, one spec file, one passed, one failed
  and one statically skipped test with `results: []`. The adapter synthesizes
  its skipped step.
- `two-files.json`: one project (`chromium`) whose feature spans
  `sample-a.spec.ts` and `sample-b.spec.ts`. File A has one passing test;
  file B has one passing test and one failing test, so the triage row exists
  and carries a source title.
- `error-locations.json`: one project, six tests:
  1. expected failure whose message ends with `at tests/a.spec.ts:44:81` and
     whose location matches;
  2. location in the middle of the message;
  3. backslash-separated message path (`tests\c.spec.ts:20:2`);
  4. two errors with different locations;
  5. location with file and line but no column, message without a path;
  6. location `tests/g.spec.ts:1` while the message only contains
     `tests/g.spec.ts:12`.
- `run-ratio.ndjson`: one feature with 1 passed, 1 failed and 1 skipped.
- `skipped-only.ndjson`: one feature with only a skipped result.

All new fixture paths are relative. No machine path, token or personal data is
stored.

## Tests and red reasons

### New unit/browser tests

- `test/playwright.test.ts` › `counts a statically skipped test without steps
  as a reported skip`
  - Current result: PASS. This is a deliberate regression guard: the adapter
    already synthesizes a skipped step and the summary already reports
    `executed: true`, `status: "skipped"`, `counts.scenarios.total: 3` and
    `counts.scenarios.skipped: 1`. The change keeps D1 (no schema change), so
    this test must stay green through implementation.
- `test/playwright.test.ts` › `labels a feature sourced from two spec files
  with a file count`
  - RED: feature row is `sample-a.spec.ts`, expected `2 spec files`. Current
    `featureShape` uses the first scenario URI; the triage title and matrix use
    the same arbitrary first file.
- `test/playwright.test.ts` › `includes each Playwright error location at most
  once`
  - RED: the expected-failure description contains
    `at tests/a.spec.ts:44:81` twice, count 2 instead of 1. `errorText` appends
    the location unconditionally even when the message already ends with it.
    Later assertions cover mid-sentence, backslash, two errors, line-only and
    the `:1` vs `:12` token boundary.
- `test/render-counts.test.ts` › `computes the pass ratio over attempted
  scenarios`
  - RED: `.meta` still says `3 executed scenarios`; the header health computes
    over all results rather than attempted scenarios. Expected `50%`,
    `1 / 2 attempted`, feature `1 passed of 2 attempted · 1 failed, 1 skipped`,
    Details `1 / 2 attempted`, skipped pill and skipped bar segment.
- `test/render-counts.test.ts` › `shows no ratio when every reported scenario
  is skipped`
  - RED: Report health is `0%`, `0 / 1`, `0 / 1 passed`; expected
    `No scenarios attempted` in Report and Details, no percentage or fraction,
    a screen-reader note with `not pass attempts`, and the skipped pill.
- `test/render-counts.test.ts` › `keeps 0% and 0 / 0 for an empty run`
  - Current result: PASS. Guard for the unchanged empty-run contract
    (`0%`, `0 / 0`, `.healthTop` present).
- `test/render-counts.test.ts` › `names reported results and unexecuted rows in
  the header`
  - RED: `.meta` still says `2 executed scenarios`; expected
    `2 scenarios with results` plus `1 unexecuted` for `empty-statuses.ndjson`,
    and no unexecuted label when every row has a result.
- `test/render-counts.test.ts` › `labels the environment, run time and scenario
  time`
  - RED: Details still renders `Cucumber environment`, matrix header
    `Duration`, run row `Duration`; expected `Run environment`, `Scenario
    time`, `Test time`, the exact sum sentence and the header title
    `Sum of the final attempt per scenario and run hooks`.
- `test/e2e/report.spec.ts` › `computes the attempted scenario ratio for a run
  with a skip`
  - RED: header strong is `33.3%`, expected `50%`. Also asserts `1 / 2
    attempted`, `3 scenarios with results`, no `executed scenario` in
    `.meta`, feature counts, skipped pill, skipped bar segment and the Details
    ratio/note.
- `test/e2e/report.spec.ts` › `labels a feature from two spec files at every
  width`
  - RED: `.featureUri` is `sample-a.spec.ts`, expected `2 spec files`.
    Asserts the triage `title`, the matrix `.matrixUri`, no arbitrary file,
    row source visible at 1440/1024 and hidden at 768/390/320, matrix visible
    at 768/390/320.

### Updated pinned assertions (same tests, new contract)

- `test/render.test.ts` › `renders the simple report and analysis view`
  - `Cucumber environment` → `Run environment`, plus a negative assertion.
  - `2 executed scenarios` → `2 scenarios with results`.
- `test/render.test.ts` › `renders a feature by status matrix in Details`
  - matrix header `Duration` → `Scenario time`.
- `test/render.test.ts` › `shows only present status columns in the matrix`
  - matrix header `Duration` → `Scenario time`.
- `test/render.test.ts` › `renders an empty run as 0 / 0 without triage and
  with a blank row`
  - `0 executed scenarios` → `0 scenarios with results`.
- `test/render.test.ts` › `keeps a blank row visible and searchable in a mixed
  run`
  - `1 executed scenario` → `1 scenario with results` plus `1 unexecuted`.
- `test/render.test.ts` › `shows 0 scenarios and muted zero cells for an
  all-unexecuted source`
  - matrix header `Duration` → `Scenario time`.
- `test/e2e/report.spec.ts` empty run, mixed blank row, mixed statuses and
  no-scenarios tests
  - `.runHead .meta` now expects `N scenarios with results` and
    `1 unexecuted`; no bare `getByText` that can match the live region or
    source cards.

## RED confirmation

Command:

```text
npx vitest run test/render.test.ts test/playwright.test.ts test/render-counts.test.ts
```

Result:

```text
Test Files  3 failed (3)
     Tests  12 failed | 120 passed | 1 skipped (133)
```

Failed tests:

1. `labels a feature sourced from two spec files with a file count`
   — expected `['2 spec files']`, received `['sample-a.spec.ts']`.
2. `includes each Playwright error location at most once`
   — expected 1 occurrence of `at tests/a.spec.ts:44:81`, received 2.
3. `computes the pass ratio over attempted scenarios`
   — `.meta` contains `3 executed scenarios`, expected `3 scenarios with
   results`.
4. `shows no ratio when every reported scenario is skipped`
   — health contains `0%` and `0 / 1 passed`, expected
   `No scenarios attempted`.
5. `names reported results and unexecuted rows in the header`
   — `.meta` contains `2 executed scenarios`.
6. `labels the environment, run time and scenario time`
   — Details contains `Cucumber environment` and `Duration`.
7. `renders the simple report and analysis view`
   — contains `Cucumber environment`, expected `Run environment`.
8. `renders a feature by status matrix in Details`
   — matrix header is `Duration`, expected `Scenario time`.
9. `shows only present status columns in the matrix`
   — matrix header is `Duration`.
10. `renders an empty run as 0 / 0 without triage and with a blank row`
    — contains `0 executed scenarios`.
11. `keeps a blank row visible and searchable in a mixed run`
    — contains `1 executed scenario`, expected `1 scenario with results`.
12. `shows 0 scenarios and muted zero cells for an all-unexecuted source`
    — matrix header is `Duration`.

Command:

```text
npx playwright test test/e2e/report.spec.ts -g "run presentation|scenario ratio|two spec files" --project=chromium
```

Result:

```text
2 failed
  computes the attempted scenario ratio for a run with a skip
  labels a feature from two spec files at every width
```

First failure in each:

- ratio test: `toEqual("50%")` received `33.3%`;
- multi-file test: `toEqual("2 spec files")` received `sample-a.spec.ts`.

Command (updated pinned e2e assertions only):

```text
npx playwright test test/e2e/report.spec.ts -g "renders an empty run without outcomes|keeps a blank row searchable|mixed-status run|renders the empty state when there are no scenarios" --project=chromium
```

Result:

```text
4 failed
```

Each fails on the old `.meta` string (`N executed scenarios`) instead of the
new `N scenarios with results` text; no other assertion was reached.

## Static checks

```text
npm run typecheck        PASS
npx oxlint test/render-counts.test.ts test/playwright.test.ts test/render.test.ts test/e2e/report.spec.ts
                         PASS (no findings)
```

## Notes for the implementer

- The two guard tests above are expected green before implementation; do not
  weaken them. Everything else fails on the new contract, not on fixture
  loading or syntax.
- The single-file Playwright path assertion runs after the multi-file
  assertions in the same test; it is not reached yet. Current renderer already
  shows `sample.spec.ts` for `real-run.json` because each project feature has
  exactly one displayed URI, so the implementation must keep that branch.
- `test-results/` output from the targeted browser run is generated test
  output; it is not part of this change.
