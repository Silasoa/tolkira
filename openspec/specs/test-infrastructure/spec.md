# test-infrastructure Specification

## Purpose

The test-infrastructure capability defines how the unit and browser suites are
organized: render tests split by report flow, browser tests split by user
journey, shared fixture and helper ownership, and the size rules that keep a
failure pointing at one flow.

## Requirements

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
unchanged unless a change intentionally changes rendered output. Such a change
SHALL record every re-pinned hash and file and the inspected reason for its
diff: a shell re-pin names the exact markup and CSS delta, a content re-pin
names the output rule that corrected the result. The baseline is the current
nine characterization hashes and the two golden HTML files. A
checkout-line-ending mismatch SHALL still be diagnosed instead of re-recorded.

#### Scenario: Intentional re-pin

- **WHEN** a change intentionally changes rendered output
- **THEN** every changed hash and golden file is re-pinned in the same change
- **AND** the change record names the diff and the rule that caused it
- **AND** an unchanged fixture keeps its old hash

#### Scenario: Characterization unchanged

- **WHEN** a change does not intentionally change rendered output
- **THEN** the nine committed characterization hashes and both golden HTML files
  are unchanged
- **AND** `git diff` shows no change in the hash list or
  `test/fixtures/render-golden/*.html`

#### Scenario: Checkout line endings

- **WHEN** the hashes fail in a fresh checkout
- **THEN** a CRLF checkout is diagnosed with `git ls-files --eol` and
  `core.autocrlf`
- **AND** the hashes are never re-recorded to hide the mismatch

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

### Requirement: Run the check gate on Windows

CI SHALL run the full `npm run check` gate on `windows-latest` with Node 22 for
every push and pull request, in addition to the existing Linux and macOS jobs.

#### Scenario: Windows check

- **WHEN** a push or pull request runs CI
- **THEN** a Windows Node 22 job installs with `npm ci`
- **AND** it runs `npm run check`
- **AND** a failure blocks the workflow

#### Scenario: Existing matrix stays

- **WHEN** the Windows job is added
- **THEN** the Linux Node 22/24/26 check matrix, Linux e2e and macOS e2e remain

### Requirement: Gate releases on both operating systems and the tag

A release tag workflow SHALL run `npm run hygiene`, `npm run check` and
`npm run test:e2e` on Linux, and `npm run test:e2e` on macOS, before publish. The
publish job SHALL require both gates, fail on a tag/version mismatch and fail
when the tag commit is not on `origin/main`. A green tag SHALL reach the package
smoke and stage step. This records the prior commits `31dd112` (gates and
checks) and `f448f60` (full main fetch); this change edits no workflow file.

#### Scenario: Tag and version mismatch

- **WHEN** a release tag does not equal `v` plus the `package.json` version
- **THEN** the publish job fails
- **AND** nothing is staged or published

#### Scenario: Tag not on main

- **WHEN** the tagged commit is not an ancestor of `origin/main`
- **THEN** the publish job fails
- **AND** nothing is staged or published

#### Scenario: Staging waits for both gates

- **WHEN** the Linux or macOS gate fails
- **THEN** the publish job does not start
- **AND** no package is staged

#### Scenario: Green tag reaches the package smoke

- **WHEN** both gates are green and the tag matches the version on main
- **THEN** the package is packed and installed
- **AND** the CLI smoke test passes
- **AND** the workflow reaches the `npm stage publish` step

### Requirement: Enforce the maximal strict typecheck in the gate

The check gate SHALL compile the server and test sources with `strict` plus
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
`noUncheckedSideEffectImports`, `noFallthroughCasesInSwitch`,
`allowUnreachableCode: false`, `allowUnusedLabels: false` and
`isolatedModules`. A type error SHALL fail the gate.

#### Scenario: Strict flag violation fails

- **WHEN** an indexed read is used without a guard or default
- **THEN** the typecheck fails
- **AND** the same holds for an explicit `undefined` in an exact optional
  property, a missing `override`, an unused local or parameter, a missing
  return, an unreachable statement and a fallthrough case

### Requirement: Typecheck the browser graph without Node types

The gate SHALL compile the browser graph in a separate program with no Node type
declarations, so a browser module cannot rely on a Node global. A type error in
that program SHALL fail the gate.

#### Scenario: Browser program has no Node globals

- **WHEN** a module reached from the browser entry imports a `node:` module or
  reads `process`
- **THEN** the browser typecheck fails
- **AND** a server module that legitimately uses the DOM still compiles in the
  server program

### Requirement: Enforce the maximal lint set at zero warnings

The gate SHALL run one lint pass with correctness rules as errors, suspicious,
performance and pedantic rules as warnings, the import, promise, node,
TypeScript, unicorn, oxc and Vitest plugins, and type-aware rules. Only the
documented exceptions may be off. Any finding at warning or error severity
SHALL fail the gate. The lint configuration SHALL be asserted by a test, so
turning a rule or category off without changing the contract fails the suite.

#### Scenario: A warning fails the gate

- **WHEN** the lint run reports one warning
- **THEN** the gate fails
- **AND** a clean run exits zero

#### Scenario: A type-aware defect fails the gate

- **WHEN** a module creates a floating promise or awaits a non-thenable
- **THEN** the type-aware lint run reports it
- **AND** the gate fails

#### Scenario: Documented exceptions stay quiet

- **WHEN** the lint run scans the test suite and the compatibility shim
- **THEN** the configured assertion names satisfy the empty-expectation rule
- **AND** the allowed globals satisfy the underscore rule
- **AND** the named scoped-off rules produce no finding in their files
- **AND** the fixture casts in `test/**` do not trip the assertion rule
- **AND** the same cast in a `src`-shaped module still fails

### Requirement: Pin inline suppressions

A file-level suppression SHALL NOT be used. A per-line suppression SHALL be
`oxlint-disable-next-line` with the rule name and a reason, and the gate test
SHALL pin the exact set, so an added suppression fails the suite without a
contract change.

#### Scenario: Inline suppressions are pinned

- **WHEN** a source line suppresses a lint rule
- **THEN** it uses `oxlint-disable-next-line` with the rule name and a reason
- **AND** a file-level suppression or an unpinned addition fails the gate test

### Requirement: Check formatting without changing output

The gate SHALL verify formatting with one pinned formatter and config. The
format scope SHALL exclude generated sources, report CSS, test fixtures and
committed goldens, so formatting cannot change a report byte. The repository
SHALL enforce LF checkout line endings, so the check gives the same result on
Windows, Linux and macOS. A formatting violation SHALL fail the gate.

#### Scenario: Unformatted source fails

- **WHEN** a tracked source file differs from the formatter output
- **THEN** the format check fails

#### Scenario: Same verdict on every checkout

- **WHEN** the gate runs on a fresh Windows, Linux or macOS checkout
- **THEN** the working tree is LF and the format check reports the same files
- **AND** an existing CRLF working tree is re-checked out rather than
  reformatted to pass

#### Scenario: Generated and golden files are out of scope

- **WHEN** the formatter runs and the assets are rebuilt
- **THEN** generated TypeScript, report CSS, fixtures and golden HTML are
  unchanged
- **AND** the committed characterization hashes and golden files stay
  unchanged

### Requirement: Fail an empty test selection and enforce a coverage floor

The unit test gate SHALL fail when no test matches its pattern. It SHALL collect
coverage over `src/**/*.ts`, excluding the browser entry that only the browser
suite covers, and SHALL fail below 93 percent statements, 86 percent branches,
95 percent functions and 95 percent lines.

#### Scenario: Empty selection fails

- **WHEN** the test pattern matches no file
- **THEN** the test gate fails instead of passing

#### Scenario: Coverage floor

- **WHEN** the unit suite runs below any threshold
- **THEN** the gate fails
- **AND** the measured baseline above the floor passes

### Requirement: Preserve behaviour and package content

The tooling baseline SHALL NOT change runtime behaviour, report bytes, the
public API or the shipped entry points. The characterization baseline SHALL
follow the base requirement "Keep the characterization baseline"; this change
introduces no intentional render change. The formatter, the coverage provider,
knip, publint and `@arethetypeswrong/cli` SHALL be development-only
dependencies.

#### Scenario: Report bytes unchanged

- **WHEN** the same fixtures are rendered before and after the change
- **THEN** the report bytes are identical
- **AND** no characterization hash or golden file is re-pinned

#### Scenario: Runtime surface unchanged

- **WHEN** the packed package is inspected
- **THEN** its entry points and runtime dependencies are unchanged
- **AND** the public declaration names the same input types
- **AND** `docs/README.md` is present under npm 10 and npm 12

### Requirement: Run the dead-code check in the gate

The check gate SHALL run knip with an explicit entry and project config. An
unused file, export, type or dependency that is not an entry or a documented
exception SHALL fail the gate.

#### Scenario: A new unused export fails

- **WHEN** a module gains an exported value, type or file that nothing imports
  and that is not an entry
- **THEN** the dead-code check fails
- **AND** the gate fails

### Requirement: Pin the dead-code entries and exceptions

The config SHALL name the public entry, the CLI entry, the two compat entries,
the browser bundle entry, the manual scripts and the test files.
`playwright-core`, `publint` and `@arethetypeswrong/cli` SHALL be the ignored
dependencies: the first is an optional peer loaded at runtime, the other two
are spawned by the package check. No other dependency SHALL be ignored. No
export reachable from the package entry or the compat entry SHALL be removed.

#### Scenario: Entries and fixtures stay quiet

- **WHEN** the manual scripts, the compat entry and the CJS type fixture are
  scanned
- **THEN** they count as entries or ignored paths
- **AND** the check stays green

#### Scenario: The public surface is not removed

- **WHEN** knip flags an export that is reachable from `src/index.ts` or the
  compat entry
- **THEN** the export stays
- **AND** the config gets a documented exception instead

### Requirement: Check the packed package surface

The package gate SHALL pack once and check that file. The packed set SHALL
equal the documented `files` set plus npm's automatic root files; an unexpected
path SHALL fail, and `docs/README.md` SHALL be required unconditionally. Glob
entries in `files` are patterns, not literal paths, and a file matching a glob
entry SHALL be allowed. Absolute, `..` and backslash paths SHALL fail.
`publint --strict` and `attw` SHALL run on the tarball.

#### Scenario: The B-071 regression fails

- **WHEN** the npm 12 pack list omits `docs/README.md`
- **THEN** the manifest check fails and names the missing path
- **AND** the tarball is not used for a smoke test or a publish

#### Scenario: A forbidden path fails

- **WHEN** the tarball contains a `src/`, `test/`, `openspec/`, `scripts/`,
  `node_modules/` or `.github/` path
- **THEN** the manifest check fails

#### Scenario: An unexpected or unsafe path fails

- **WHEN** the tarball contains a path outside the documented `files` set, or an
  absolute, `..` or backslash path
- **THEN** the manifest check fails and names the path
- **AND** the tarball is not used for a smoke test or a publish

### Requirement: Pin the package-check exceptions

The attw config SHALL use the node16 profile and ignore exactly
`cjs-resolves-to-esm` (the ESM-only root); node16 (CJS and ESM) and the bundler
SHALL stay checked, and node10 is out of scope below `engines`.
`docs/README.md` SHALL be listed in `files`, so npm 10 and npm 12 pack it. The
manifest check SHALL read the npm 10 array and the npm 12 object shapes the
same way.

#### Scenario: Both npm JSON shapes are accepted

- **WHEN** `npm pack --json` returns the npm 10 array or the npm 12 object
- **THEN** the manifest check reads the same file list
- **AND** the result does not depend on the npm version
