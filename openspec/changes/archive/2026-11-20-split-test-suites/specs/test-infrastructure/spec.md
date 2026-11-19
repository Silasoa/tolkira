# Spec Delta

## ADDED Requirements

### Requirement: Organize render unit tests by flow

The render unit suite SHALL be split into focused files that each cover one
report flow or the renderer module that owns it. A file SHOULD stay below 800
lines; a larger file SHALL cover exactly one coherent flow and SHALL state that
flow in its file header.

#### Scenario: Render flow has one owner

- **WHEN** a reader looks for the tests of the report shell, outlines, hooks,
  rules, triage, matrix, diagnostics, source strip, open state or empty runs
- **THEN** each flow has one named test file
- **AND** a failure in that flow points at that file

#### Scenario: Large test file

- **WHEN** a render test file is longer than 800 lines
- **THEN** its header states the single flow it covers
- **AND** the change tasks record the exception

### Requirement: Organize browser tests by user journey

The browser report suite SHALL be split by user journey instead of one report
spec. The journey set SHALL cover the core report, search and filters, triage,
attachments, clipboard, hooks, outlines, diagnostics, rules, empty runs,
keyboard, no-JS, responsive layout and performance. Moving a test SHALL move
its enclosing `test.describe` wrapper and every block-level modifier
(`test.use`, `test.slow`, `test.setTimeout`) with it.

#### Scenario: Journey lookup

- **WHEN** a reader looks for the browser test of triage, attachments, search,
  keyboard or no-JS
- **THEN** a spec named for that journey contains the test
- **AND** the test title still describes the user-visible behaviour

#### Scenario: Block-level fixture survives

- **WHEN** the `without scripting` tests move to `no-js.spec.ts`
- **THEN** the file contains `test.use({ javaScriptEnabled: false })` around
  all four tests
- **AND** the performance test keeps `test.slow()` and its own budgets
- **AND** the no-JS block in `parity-metadata.spec.ts` stays in place with its
  `test.use` wrapper intact

#### Scenario: Every original test survives

- **WHEN** the original report spec is compared with the split specs
- **THEN** every original test title appears exactly once in the
  project-excluded definition multiset
- **AND** the 273 per-project runs match the baseline

### Requirement: Preserve assertion inventory

Moving a test SHALL NOT delete, skip, merge away or weaken an existing
assertion. The static assertion inventory SHALL be preserved except for the
two named moves in the change tasks. No matcher SHALL be loosened.

#### Scenario: Assertion inventory

- **WHEN** the old render suite and browser report spec are compared with the
  split files
- **THEN** the render suite stays at 485 static `expect(` lines: 484 in the
  ten split files plus 1 in `test/render-helpers.ts`
- **AND** the browser report spec has 466 static `expect(` lines before; after,
  the split spec files contain 417 and the shared `writeReport` helper contains
  1, for 418 across the moved suite
- **AND** the 49 inline report-creation checks (47 `expect(code).toBe(0)` plus
  the diagnostic test's `expect(undefinedCode)` and `expect(ambiguousCode)`)
  collapse into the helper's one check
- **AND** the ANSI expected string changes value in place, so its count is
  unchanged
- **AND** the 417 figure covers only the moved report-spec assertions; the 14
  touched browser specs total 472 because `responsive.spec.ts` already had 55
  viewport assertions
- **AND** no matcher changes from a strong form to a weaker one
- **AND** a reviewer verifies every moved assertion

#### Scenario: Documented data change

- **WHEN** a shared fixture unification changes a literal expectation
- **THEN** the change tasks record the old value, the new value and the reason
- **AND** the test still asserts the same behaviour class

### Requirement: Preserve test counts and titles

The collected unit and browser test totals SHALL equal the baseline, unless the
difference is justified in the change tasks. The sorted browser title multiset
SHALL be compared over the 91 definitions with the project excluded and the
describe chain included; the 273 per-project entries SHALL be checked
separately. Platform-conditional pass and skip counts SHALL NOT be used as the
parity rule.

#### Scenario: Test count parity

- **WHEN** the split is complete
- **THEN** the collected unit total (659) equals the baseline recorded before
  the split
- **AND** the 91 browser definition titles appear exactly once each in the
  project-excluded multiset
- **AND** the 273 per-project runs contain each definition once per project
- **AND** unit files rise from 38 to 47
- **AND** any difference has a written reason in the change tasks

#### Scenario: Platform skip is not a regression

- **WHEN** the same commit runs on Windows, Linux or macOS
- **THEN** the collected total is compared, not the platform-specific
  passed/skipped split
- **AND** the conditional skips already in the suite are named in the tasks

### Requirement: Keep the characterization baseline

The committed render characterization hashes and golden HTML files SHALL stay
unchanged, and a checkout-line-ending mismatch SHALL be diagnosed instead of
re-recorded.

#### Scenario: Characterization unchanged

- **WHEN** the split is complete in an LF checkout
- **THEN** the eight committed characterization hashes and both golden HTML
  files are unchanged
- **AND** `git diff` shows no change in `test/render-characterization.test.ts`
  or `test/fixtures/render-golden/*.html`
- **AND** a CRLF checkout is diagnosed with `git ls-files --eol` and
  `core.autocrlf`, never re-recorded

### Requirement: Share fixture paths

Fixture paths in the touched suites SHALL use `test/fixtures.ts`.

#### Scenario: Fixture helper

- **WHEN** a moved test needs a Messages, legacy, JUnit or Playwright fixture
- **THEN** it imports the matching helper from `test/fixtures.ts`
- **AND** no moved test builds the path with `new URL('./fixtures/...')`

### Requirement: Share report creation

In the moved browser tests, standard single-report creation SHALL use the
shared `writeReport`/`removeReport` helper. A moved test that builds several
reports or a multi-folder attachment setup MAY keep its own directory but SHALL
still use the shared report creation for each standard report it opens.

#### Scenario: One report helper

- **WHEN** a moved browser test creates one HTML report from unchanged or
  locally modified input
- **THEN** it calls `writeReport` and cleans up through `removeReport`
- **AND** no moved spec repeats `mkdtemp` plus `runCli`

### Requirement: Share clipboard stubs

Clipboard access in the browser suite SHALL use one shared helper instead of
per-spec `navigator.clipboard` stubs.

#### Scenario: One clipboard stub

- **WHEN** a browser test needs a clipboard writer, a failing clipboard or the
  copied text
- **THEN** it imports `stubClipboard`, `stubClipboardFailure` or `readClipboard`
  from the shared e2e helper
- **AND** no spec defines its own `navigator.clipboard` stub
- **AND** the failing stub keeps the `document.execCommand` fallback

### Requirement: Share the ANSI payload

The hostile terminal payload SHALL have one shared source for the unit and
browser tests.

#### Scenario: One ANSI payload

- **WHEN** the unit stripping test and the browser copy test need hostile
  terminal input
- **THEN** both import `test/ansi-payload.ts`
- **AND** both assert the shared visible text and their forbidden escape
  families
- **AND** the visible-sample change is recorded in the change tasks

### Requirement: Keep the gate and runtime

The change SHALL keep `npm run hygiene`, `npm run check` and
`npm run test:e2e` green. Runtime SHALL be recorded on the same machine and
worker count, using wall clock and the sum of per-test durations; a >20 %
increase SHALL be investigated. Runtime is informational and SHALL NOT replace
the in-test `performance.spec.ts` budgets. CI wall-clock time is informational
only.

#### Scenario: Gate is green

- **WHEN** the change is handed over
- **THEN** hygiene, typecheck, lint, unit tests, build and the browser suite
  pass
- **AND** the collected unit and browser totals are recorded in `tasks.md`

#### Scenario: Runtime compared

- **WHEN** the browser suite finishes on the baseline machine
- **THEN** the wall clock and the per-test duration sum are compared with the
  baseline runtime
- **AND** the machine, OS, core count, worker count, Node and Playwright
  versions and exact command are recorded with both numbers
- **AND** an increase above 20 % is investigated and explained
- **AND** the 1,000-row `performance.spec.ts` budgets remain the hard guard
