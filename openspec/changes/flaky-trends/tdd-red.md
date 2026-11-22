# TDD Red — flaky-trends

## Red record

Added tests only: `test/history.test.ts`, `test/render-trends.test.ts`,
`test/cli-history.test.ts`, `test/e2e/trends.spec.ts`, `test/e2e/print.spec.ts`.
Fixtures are written at runtime into temp directories.

Commands:

- `npx vitest run test/history.test.ts test/render-trends.test.ts test/cli-history.test.ts`
- `npx playwright test test/e2e/trends.spec.ts --project=chromium`
- `npx playwright test test/e2e/print.spec.ts --project=chromium`

Result: 17 new tests fail, no existing test fails. Full `npx vitest run`:
17 failed, 1130 passed, 4 skipped. Existing e2e stays green (trends 3/3,
print 12/12).

## Failures and why they are correct

- History (12). `buildHistoryRun(...).flaky` is `undefined`; a present `flaky`
  is dropped on read; negative, fractional, above-attempted and
  `total - skipped = 0` counts are accepted; the id ignores the count. The
  field, its validation and its hash input do not exist yet.
- Trends (4). The last numeric headers are `Skipped, Total, Pass rate,
  Duration`; rows end at Duration; `trends.flaky`, `trends.flakyShare` and
  `trends.flakeNote` are absent from en/de. The columns, note and keys do not
  exist yet.
- CLI (1). The `--history` sidecar entry has no `flaky` key.
- E2E trends (Chromium). The 40-scenario, two-run fixture renders two rows but
  no `Flaky` columnheader; share `5%`/`0%`, 390/320/200% and overflow checks
  follow.
- E2E print (Chromium, A4, German). Trends is visible, but
  `de['trends.flaky']` is undefined, so the header, hiding and no-split checks
  cannot pass.

## Implementer notes

Three existing assertions must be updated by the implementer (Red did not
weaken them): the exact aggregate-key list in `test/history.test.ts`, the
sidecar-key list in `test/cli-history.test.ts`, and the old
`trends.tableHint` text in `test/render-trends.test.ts`.

Summary, CI and email are guarded: a new summary test requires no `flaky`
property, and the existing flaky-visibility byte-equality test for JSON, CI
and email stays green.

Not covered: full browser matrix, host pins and visual review (tasks 4.1/4.2).
