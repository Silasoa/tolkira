# TDD Red — playwright-source-line

Command: `npx vitest run test/playwright-source-line.test.ts`

Initial result: 6 tests, 2 failed, 4 passed. `npx tsc --noEmit` passes.
Follow-up result after the CMP/UXR/SCR reviews: 15 tests, all green (the reviews
added scenario-level, multi-spec, line-less Playwright, JUnit and run-error
coverage).

## Red failures

1. `Playwright source line > shows the spec line in the feature row, matrix and triage`
   - `AssertionError: expected [ 'movie-list.spec.ts', …(2) ] to deeply equal [ 'movie-list.spec.ts:3', …(2) ]`
   - All three surfaces return the bare URI. Correct Red: the adapter already writes
     `spec.line` into the Pickle, but `buildReportModel` never copies
     `pickle.location.line` into `ReportScenario`, and `featureSourceLabel` cannot
     produce a suffix. This is the end-to-end contract (B-035) and must fail until
     the model carries the line.
2. `featureSourceLabel line rule > shows uri:line for one scenario with a positive line`
   - `AssertionError: expected 'features/movie.feature' to be 'features/movie.feature:12'`
   - Correct Red: the helper only groups URIs; the one-URI/one-positive-line rule does
     not exist. Directly pins the unit contract, independent of the adapter.

The direct fixtures used a partial cast to `ReportScenario` because `line` was
not declared yet. The follow-up replaced it with a typed factory, so a `line`
rename fails at compile time.

## Green guards (expected today, must stay green)

- Mixed lines in one URI -> feature URI only; each scenario keeps its own line.
- Missing, zero, and partially absent lines -> no suffix with no trailing colon.
- Two URIs -> `2 spec files`: file count survives.
- Summary keeps `uri: movie-list.spec.ts` and no `line` key; CI markdown shows the
  plain URI and no `:3`; email contains no `movie-list.spec.ts:3`.

These pass before implementation because today's behavior is already the fallback;
they fail if the line suffix is applied unconditionally.

## Follow-up coverage

- Multi-spec Playwright project: each scenario row shows its own `file:line`; the
  feature row and matrix keep `2 spec files`.
- Playwright spec with a missing or zero line: scenario and feature labels stay
  the URI, no `:1`, no trailing colon; the failure text still renders.
- Playwright run error: the pseudo-pickle shows no `:1`; the error text renders.
- JUnit `basic.xml`: all four scenario labels stay line-less; counts and statuses
  (2 passed, 1 failed, 1 skipped) are unchanged.
- Scenario source CSS keeps `overflow-wrap: anywhere` and is never hidden.

## Notes

- `test/fixtures/playwright/real-run.json` and `two-files.json` keep their current
  feature labels (mixed lines / multiple URIs).
- Render goldens were regenerated intentionally for the new scenario source span;
  the JSON, CI and email bytes are unchanged.
