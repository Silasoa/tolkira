# Tasks

## 1. TDD-Red

- [x] 1.1 Add `test/model-summary-cross-check.test.ts` over representative
  Messages, legacy JSON and JUnit fixtures.
- [x] 1.2 Assert equal features/scenarios/attachments/duration counts and
  per-scenario status, executed flag, attempt, tags and step/hook statuses.
- [x] 1.3 Confirm the cross-check and the existing model/summary suites are
  green before the refactor (characterization baseline).

## 2. Implementer

- [x] 2.1 Add `src/report/index-run.ts` with features, scenario tree, pickles,
  test cases, latest attempts, results, attachments, hooks, run hooks and
  diagnostics.
- [x] 2.2 Move `buildReportModel` onto the index without changing its output.
- [x] 2.3 Move `summarizeEnvelopes` onto the index without changing its output.
- [x] 2.4 Re-run model, summary and cross-check suites; add no weakened tests.
- [x] 2.5 Run `npm run check`.

## 3. Handover

- [x] 3.1 Commit and push the slice; report commit, tests, behavior
  differences and deferred items.
- [x] 3.2 Leave archive, tag and publish to the coordinator/user.
