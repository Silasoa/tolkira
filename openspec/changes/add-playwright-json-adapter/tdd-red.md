# TDD-Red — Playwright JSON adapter

Status: RED confirmed on 2026-11-18. No `src/` or `docs/` change is part of
this handoff. This worker did not commit; the coordinator may commit the suite
separately.

## Command and result

```text
npx vitest run test/input-detect.test.ts test/playwright.test.ts test/model-summary-cross-check.test.ts
Test Files  3 failed (3)
Tests       27 failed | 75 passed | 1 skipped (103)
```

The failures are all the missing Playwright branch: the loader still answers
`Unsupported input` for the fixtures, and `detectInput` still maps Playwright
shapes to `json-validation`/`junit-validation`. There are no fixture syntax
errors: every fixture parses, and the existing 75 tests in those files stay
green. The one skipped test is the symlink case, skipped on Windows only; it
runs on Linux and macOS.

`npx tsc --noEmit` currently fails only because `InputDecision` has no
`playwright` member yet (six assignments in `test/input-detect.test.ts`). That
is the expected Red type error.

`npx playwright test test/e2e/report.spec.ts -g "Playwright JSON"
--project=chromium` fails with exit code 1 instead of 0 for the new e2e case,
also because the input is unsupported.

## Files added or changed

Added:

- `test/playwright.test.ts`
- `test/fixtures/playwright/real-run.json`
- `test/fixtures/playwright/nested-describes.json`
- `test/fixtures/playwright/statuses.json`
- `test/fixtures/playwright/steps.json`
- `test/fixtures/playwright/output.json`
- `test/fixtures/playwright/errors.json`
- `test/fixtures/playwright/empty.json`
- `test/fixtures/playwright/malformed-suites.json`
- `test/fixtures/playwright/malformed-specs.json`
- `test/fixtures/playwright/malformed-results.json`
- `test/fixtures/playwright/malformed-attachment.json`
- `test/fixtures/playwright/attachments/note-file.txt`
- `test/fixtures/playwright/attachments/error-context.md`
- `test/fixtures/playwright/PROVENANCE.md`
- `openspec/changes/add-playwright-json-adapter/tdd-red.md`

Changed:

- `test/fixtures.ts` — `playwrightFixture(name)`.
- `test/input-detect.test.ts` — Playwright decision-table and precedence cases.
- `test/model-summary-cross-check.test.ts` — Playwright real-run and status
  fixture cases, loaded through `loadEnvelopes`.
- `test/e2e/report.spec.ts` — one small browser case for the real-run fixture.

## Red tests and reasons

### `test/input-detect.test.ts` — 6 failures

All fail with `expected 'json-validation' to be 'playwright'` (or
`'junit-validation'` for the XML extension case):

- `selects Playwright for a Playwright JSON report`
- `accepts Playwright JSON with a BOM and leading whitespace`
- `selects Playwright for run-level errors without suites`
- `routes a non-array suites value to Playwright validation`
- `Playwright content wins over a Messages extension`
- `Playwright content wins over an XML extension`

The non-Playwright cases stay green: `{suites:[]}` without `stats`,
`{config:{},suites:[]}` without `stats`, a non-object `config`, malformed JSON,
legacy arrays, Messages and JUnit.

### `test/playwright.test.ts` — 19 failures, 1 skipped

Every failure is currently `Unsupported input: ...` except the malformed/CLI
and size cases, which fail on the expected error text or exit path:

- `maps projects, hierarchy, tags, statuses and attempts from a real run`
- `lists one feature per input and project with the loader prefix`
- `renders the Playwright producer version in the HTML`
- `keeps nested describes in the rule path and strips tags from titles`
- `maps status edge cases without silently passing them`
- `uses step errors for step status and keeps other steps passed`
- `embeds inline and safe path attachments with declared content types`
- `renders a markdown error context as readable plain text`
- `maps stdout and stderr entries to attachments without rendering HTML`
- `accepts an empty Playwright run with zero scenarios`
- `renders run-level errors as a failed Playwright feature`
- `rejects malformed Playwright shapes with a file-specific error`
  (`Unsupported input` instead of `Invalid Playwright JSON`)
- `normalizes absolute error locations to relative paths`
- `embeds an absolute attachment path inside the process working directory`
- `skips missing, outside-tree and non-regular attachment paths`
- `rejects a path attachment above the size limit before writing output`
  (`Unsupported input` instead of the 50 MB rejection)
- `deduplicates a Playwright file passed twice or through its directory`
- `merges Playwright with Cucumber and JUnit inputs with stable unique ids`
- `exits non-zero and writes no output for a malformed Playwright file`
  (`Unsupported input` instead of the Playwright-specific error)

Skipped on Windows: `skips symlinked attachment paths`. It is not skipped on
Linux/macOS and should stay in the suite.

### `test/model-summary-cross-check.test.ts` — 2 failures

- `agrees on counts and status for playwright/real-run`
- `agrees on counts and status for playwright/statuses`

Both fail with `Unsupported input` for the fixture path. Once the adapter
lands, these check that the report model and the machine summary agree on
counts, statuses, attempts, durations, tags, steps and hooks.

### `test/e2e/report.spec.ts` — 1 failure

- `renders a Playwright JSON report in the browser` — CLI exits 1, expected 0.

## Fixture assumptions

- The raw run is `.tmp/pw-smoke2/report.json` (Playwright 1.65.0, projects
  `alpha` and `beta`). The raw file is not in the repo. `real-run.json` is a
  sanitized copy: absolute paths became fixture-relative, stack traces and
  ANSI escapes were removed, and the config block keeps only fields the
  adapter can read.
- `real-run.json` covers nested steps, inline text and PNG attachments, a
  relative path attachment, Markdown error context, expected failure,
  unexpected pass, timedOut, flaky retry, skip and two projects. It has 8
  specs x 2 projects = 16 scenarios: 7 passed, 7 failed, 2 skipped.
- `nested-describes.json` has two files in one project, three describe levels,
  tagged file/describe/spec titles, an `issue` annotation and nested steps
  with a subtitle. Expected: one feature, two scenarios.
- `statuses.json` covers `interrupted`, expected failure from `timedOut`,
  skipped-without-results, non-skipped-without-results, a failed result whose
  step has no error, and known `skip`/`fail` annotations. Expected executed
  counts: 4 total, 2 failed, 1 passed, 1 skipped; the non-skipped no-results
  scenario stays visible with `executed: false` and is not counted.
- `steps.json` covers one failed step with passed siblings and a skipped step.
- `output.json` covers `stdout`/`stderr` `{text}` and `{buffer}` entries.
- `errors.json` has no suites, one run-level error and a config location.
- `empty.json` has no suites and no errors.
- `malformed-*.json` keep valid top-level `config`/`stats` so detection must
  reach the adapter; nested shapes are invalid.
- The path attachment tests build their own reports in temp directories. The
  "inside cwd" case uses the repository fixture file through an absolute path;
  the outside case uses an absolute and a relative path outside both the input
  directory and cwd. The symlink case links to an outside file.
- The 50 MB case creates a sparse `50 MB + 1 byte` file; the adapter must stat
  before reading and reject it, and the CLI must leave no output file.

## What the implementer must not miss

1. **Detection**
   - Playwright if the parsed value is an object with object `config` and
     object `stats`, plus a `suites` array **or** an `errors` array.
   - A non-array `suites` must still reach the adapter and fail with a
     Playwright-specific error, not `Unsupported input`. `malformed-suites`
     is the guard for this.
   - Keep legacy, JUnit and Messages precedence unchanged. Malformed JSON stays
     `json-validation`; `{suites:[]}` and `{config:{},suites:[]}` without
     `stats` stay generic JSON.
2. **Loader**
   - Dispatch Playwright with the loader idPrefix.
   - Feature URI is `playwright://<idPrefix>/<project>`. Do not derive it from
     the file basename; the test only asserts the shared loader prefix and the
     project suffix.
   - One feature per input/project; one pickle and testCase per test/project.
   - Identical content is still deduplicated by the loader; two different
     Playwright files must keep unique IDs and stable order.
3. **Status precedence**
   - `test.status=expected` plus failed/timedOut/interrupted: all step results
     PASSED, error text in the scenario description, tags
     `@expected-failure` and the known annotation tag (`@fail` here).
   - `test.status=unexpected` with a passed result: one synthetic FAILED step,
     tag `@unexpected-pass`, status failed.
   - `test.status=flaky` with a passed final result: passed, attempt from the
     final result (second attempt = 1), tag `@flaky`.
   - Skipped test with no results: a synthetic skipped step, visible and
     counted as skipped. Non-skipped test with no results: an empty started
     attempt, visible, `executed: false`, not passed and not counted.
   - A failed/timedOut result with no step error gets one synthetic failed
     error step. Ordinary steps without an error stay passed; skipped results
     make ordinary steps skipped.
4. **Tags and annotations**
   - Normalize bare spec tags to `@tag`.
   - Strip trailing `@tag` tokens from file, describe and scenario names.
   - Keep known annotation tags (`@skip`, `@fixme`, `@fail`) and put every
     annotation's `type - description` in the scenario description, including
     known ones with a description.
5. **Attachments**
   - Inline base64 bodies keep their declared type and are embedded.
   - Path attachments are safe when the realpath stays inside the input file's
     directory **or** the process cwd. Reject symlinks, missing paths and
     non-regular files. Stat the size before reading and enforce the 50 MB
     per-file/total caps.
   - Normalize `text/markdown` to `text/plain`; no new media type.
   - `stdout`/`stderr` text becomes `text/plain`; `{buffer}` becomes
     `application/octet-stream` and is decoded, never rendered as HTML.
6. **HTML**
   - Producer must render as `Playwright 1.65.0` from `config.version`.
   - Error locations must be relative or basename-only; no absolute local path
     may reach the HTML or summary.
7. **Validation and CLI**
   - Malformed Playwright shapes throw `Invalid Playwright JSON in <file>:
     <path>.` before rendering. The CLI exits 1 and writes no output.
   - Run-level errors with no suites render a failed Playwright feature with
     the message and location as text. Empty runs render zero scenarios.

## Notes and deliberate gaps

- The earlier design sentence that a non-array `suites` remains
  `json-validation` is overridden by the later contract clarification and the
  Red test.
- The symlink test is skipped only on Windows because creating symlinks needs
  developer mode; Linux/macOS CI covers it.
- The total 100 MB attachment cap is not duplicated here; the existing
  sanitizer already enforces it. The per-file path cap and no-partial-output
  behavior are covered.
- Remote attachment URLs have no field in Playwright's JSON attachment shape;
  the existing sanitizer rejection remains the guard.
- No test asserts the Playwright adapter function name or its internal
  envelope layout. Tests use `detectInput`, `loadInputs`/`loadEnvelopes`,
  `summarizeReport`, `renderReport`, `buildReportModel` and the CLI.
