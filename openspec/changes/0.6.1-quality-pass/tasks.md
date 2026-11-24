# Tasks

## 1. Gate

- [x] 1.1 PIR + DXR over this proposal, the five spec deltas and the design;
  check every base requirement that mentions the default shell, print, static
  mode, input loading, history reading/writing, summary counts, Playwright
  mapping, Messages validation, CI formatting, CLI writes or compat scanning
  for a contradiction. Fold blockers into the contract before Red.
- [x] 1.2 Confirm the seams: `src/render/details.ts` (`renderAnalysisView`),
  `src/render/trends.ts` (`renderTrendsView`), `src/render/report.css` around
  the `.metaList` rules and the new narrow container query, the `localeCss`
  block in `src/render/html.ts`, the generated `src/render/styles.ts`,
  `src/history.ts` (`readSidecar`, `readHistory`, `storedSchema`,
  `writeHistory`), `src/input/load.ts`, `src/input/detect.ts`,
  `src/input/messages.ts`, `src/input/playwright.ts`, `src/report/index-run.ts`,
  `src/report/model.ts`, `src/summary.ts`, `src/ci.ts`, `src/cli.ts`,
  `src/compat/options.ts` and `src/compat/cucumber-html-reporter.ts`. Confirm no
  new catalog key, option, summary field or dependency.
- [x] 1.3 Record the BOM scope decision (strip in `readSidecar`, so
  `readHistory` and `storedSchema` accept a BOM; `writeHistory` stays BOM-free
  and normalises on the next successful write) and the intentional
  characterization/golden re-pin (design decisions: all nine for the shell,
  three Messages fixtures also for the removed 1970 date; legacy fixtures stay
  pinned here). Record that B-051 stays open (no refactor in this patch) and
  that the compat shim keeps its own write and byte accounting, before Red.
- [x] 1.4 Record the audit evidence and the B-058 doc decision: findings 2-12
  from `docs/research/audit-2026-11.md`, their exact acceptance scenarios in
  `specs/input-formats`, `specs/report-rendering`, `specs/cli-api` and
  `specs/compatibility`, and the docs-only trust-model sentence for finding 1.
  Confirm no remote issue exists, no root option or allowlist is added, B-058
  keeps the 0.7 trigger, and no path/attachment behaviour changes.

## 2. TDD-Red

- [x] 2.1 B-048 unit: a default report with no history has exactly one `<main>`
  inside `#report-view`; `#analysis-view` has no `<main>` and keeps its class,
  role, label, ID and `hidden`; no `#trends-view`; two tabs. A default report
  with two history runs has one `<main>`, three tabpanels and the three IDs. A
  static report still has one `<main>` and no tab roles. Assert heading order
  and the `#analysis-view, #trends-view` print rule.
- [x] 2.2 B-048 browser: one `main` role at 320, 390, 768, 1024 and 1440 px and
  at 320 px / 200 % text; no horizontal overflow; Details and Trends panels
  keep their bounding boxes; save before/after visual captures for CMP.
- [x] 2.3 B-039 unit: the narrow container rule is present in `REPORT_CSS`
  with one column and start-aligned values; the German override is present in
  the locale string; the base 2fr/3fr rule at 100 % is untouched; `styles.ts`
  is regenerated, not hand-edited.
- [x] 2.4 B-039 browser: with a long metadata URL in Details, 320 px / 200 %
  yields one computed track, `text-align: start`, a wrapped link and no
  horizontal overflow; 320 px / 100 % and 390 px / 100 % keep two tracks and
  `text-align: right`; 768, 1024 and 1440 px are unchanged; the German boundary
  case passes.
- [x] 2.5 B-049 unit in `test/history.test.ts`: valid no-BOM file (regression),
  one BOM plus valid JSON, BOM-only, BOM plus invalid JSON, two leading BOMs,
  and byte equality after every read. The schema peek accepts a BOM-prefixed
  target. An append to a BOM-prefixed sidecar succeeds and writes the same
  bytes as the same append without the BOM, with no run lost. A writer test
  pins no BOM in the output and unchanged schema/validation. Existing error
  text is asserted, not loosened.
- [x] 2.6 Confirm RED for 2.1-2.5 and the audit tasks 2.8-2.18; 2.7 is
  expected green. No existing test is deleted or weakened. Assertions that
  encoded the three-`<main>` defect or an old accounting/attachment/Playwright
  expectation are updated in place and named in the change record.
- [x] 2.7 B-054 visual evidence (test-only): one e2e test renders the default
  and the `--static` report from `test/fixtures/messages/screenshot.ndjson` and
  writes viewport captures to `test-results/visual/<engine>/`: 1440 px and
  390 px for both forms, plus 320 px at 200 % text for both forms, six PNGs
  per engine per run. The engine folder keeps the three parallel projects from
  overwriting each other; the existing `playwright-visual-*` CI artifacts pick
  the PNGs up. No pixel assertions, no committed images, no new dependency;
  each form asserts its title before capture. Expected green from the first
  run, not part of the RED set. B-054 changes no report behaviour, so this
  change adds no requirement delta for it.
- [x] 2.8 Audit 2, input accounting and cap order: failing tests in
  `test/inputs.test.ts` and `test/input-resolve-scan.test.ts` for a directory
  with a report plus `package.json`/`tsconfig.json` (`inputFiles: 1`), two
  identical 51 MiB files (load once), two different files over the cap (new
  error text), a skipped large file that does not count, and a single file over
  the per-file guard that fails before parse. Cover equivalence classes
  (loaded/skip/duplicate), boundaries at 100 MB and 100 MB + 1, the load-order
  decision table and the duplicate-to-loaded state transition.
- [x] 2.9 Audit 3, history target: failing tests in `test/history.test.ts` for
  schema-1 `runs` not an array, schema-2 one bad entry, a valid target that
  keeps its schema, a missing target that writes, and a rejected target that
  stays byte-identical with no temp file. Cover the decision table
  (missing/valid/malformed) and the state transition from rejected to valid.
- [x] 2.10 Audit 4, empty Messages shard: failing tests in
  `test/input-detect.test.ts` and `test/inputs.test.ts` for empty, BOM-only,
  whitespace-only, non-empty invalid and explicit empty, plus an empty shard
  beside a valid report and an empty-only directory. Cover the decision table
  and the explicit/scanned state boundary.
- [x] 2.11 Audit 5, attachment counts: failing tests in
  `test/model-summary-cross-check.test.ts` and `test/summary.test.ts` for an
  orphan `testStepId` (0/0), a step without a result (0/0), a missing run-hook
  start (0/0), a normal step attachment (1/1), an attachment without a
  `testStepId` (1/1), and the `screenshot.ndjson` cross-check against
  `model.counts.attachments`, the summary total and the Details count. Add an
  HTML assertion in `test/render-attachments.test.ts` or the attachments e2e.
  ISTQB: decision table over step state (result/no result/absent) and
  equivalence classes for attachment ownership; the cross-check covers the
  summary-to-Details state transition.
- [x] 2.12 Audit 6, Playwright final result and date: failing tests in
  `test/playwright.test.ts` for missing and equal retry values (last array
  element wins) and distinct retries (highest wins), and in `test/model.test.ts`,
  `test/summary.test.ts`, `test/model-summary-cross-check.test.ts` and
  `test/render-report.test.ts` for a zero `testRunStarted`/`testRunFinished`
  (no date, no `1970`), a zero per-scenario `startedAt`, a real timestamp
  (existing date) and two starts with a full attempt/timestamp tie (the later
  passed start wins in model, summary and HTML). Add the new fixtures
  `no-retry.json`, `equal-retry.json` and `no-timing.json`. ISTQB: equivalence
  classes for missing/equal/distinct retry, the zero/real timestamp boundary and
  the final-result and attempt-tie decision tables.
- [x] 2.13 Audit 7, expected skip: failing tests in `test/playwright.test.ts`
  for expected skip plus a failed result (failed with error) and expected skip
  plus a passed result (unexpected pass, failed), keeping the existing skipped
  and skipped-without-results cases. Add `expected-skip-failed.json` and
  `expected-skip-passed.json`; cross-check the summary status, HTML row and
  history status. ISTQB: decision table over expected status, test status and
  final status, and the state transition from skipped to failed/unexpected
  pass.
- [x] 2.14 Audit 8, inherited file: failing test in `test/playwright.test.ts`
  for a suite `file: "a.spec.ts"` and a spec without `file`, asserting the
  scenario URI and rule name use `a.spec.ts` and `playwright.spec.ts` is absent;
  with no project the feature name is `a.spec.ts`, with a project it stays the
  project name. Add `inherited-file.json`; keep the explicit-spec-file case as
  the control. ISTQB: equivalence classes for spec-file present/absent,
  suite-file present/absent and project present/absent; the no-file fallback is
  the invalid class.
- [x] 2.15 Audit 9, Messages attempt: failing tests for `1e309`, a string, a
  negative value and a non-integer in `test/inputs.test.ts` or
  `test/messages-producers.test.ts`, and an absent/valid attempt in
  `test/summary.test.ts` and `test/model.test.ts`. Assert the line/file/field
  error, the model/summary parity and that `--json` never contains `null`.
  Cover the number/string/absent equivalence classes, the safe-integer boundary
  and the validation decision table.
- [x] 2.16 Audit 10, CI identity cap: failing tests in `test/ci.test.ts` and
  `test/cli-ci.test.ts` for a GitHub title, Markdown heading/name/URI/title,
  exactly 200 code points (unchanged), 201 (truncated) and a surrogate pair at
  the boundary. Assert counts, failure-message limits and 50/20 limits stay
  unchanged and Azure output is untouched. ISTQB: boundary at 199/200/201 code
  points and the surrogate boundary, plus ASCII/non-BMP equivalence classes.
- [x] 2.17 Audit 11, write errors: failing tests in `test/cli-edge.test.ts` and
  `test/cli-ci.test.ts` for a directory `--out` target and a permission-failing
  `--ci-out` target: exact prefix, requested target, Node code, exit 1, no
  `.tmp`, no UUID, no partial file and preserved earlier report. ISTQB:
  equivalence classes for directory/permission failure, the report-first vs
  CI-later decision table and the written-report-to-failed-CI state
  transition.
- [x] 2.18 Audit 12, compat bad JSON array: failing tests in
  `test/compat.test.ts` and `test/compat-sidecar.test.ts` for `[1,2,3]` and an
  array of non-feature objects with `ignoreBadJsonFile: true` (skip with the
  existing warning, valid report renders) and false (compat legacy-array
  failure, no output). Cover the decision table, the reserved-sidecar path and
  the state transition from skipped bad file to valid merged report.

## 3. Implement

- [x] 3.1 B-048: replace the default `<main class="shell analysis">` wrapper in
  `details.ts` and `trends.ts` with `<div class="shell analysis">`; keep every
  panel attribute and ID. Leave `report.ts` and the static branches alone.
- [x] 3.2 B-039: add the narrow `@container` rule to `report.css` after the
  existing `@media (max-width: 560px)` `.metaList` rule (or raise its
  specificity), add the German override after the existing `:lang(de) .metaList`
  rule in `html.ts`, run `npm run styles`, and confirm the generated string
  matches `report.css`.
- [x] 3.3 B-049: strip exactly one leading U+FEFF in `readSidecar` after the
  bounded read, so `readHistory` and `storedSchema` share the rule; leave
  `writeHistory`'s serialisation unchanged and BOM-free.
- [x] 3.4 Re-pin intentionally: replace the nine default characterization
  hashes, the two-run history hash and the two golden HTML files
  (`test/fixtures/render-golden/minimal.html` and
  `attachments-presentation.html`). Inspect the diff: the two
  `<main>`→`<div>` replacements, their closing tags, the narrow CSS string and
  the removed 1970 run dates on the three zero-timestamp Messages fixtures are
  allowed. Record the byte delta and the per-fixture reason. Measured:
  `minimal.html` and `attachments-presentation.html` each +104 bytes (CSS
  insertion +106, `<main>`→`<div>` open/close −2, self-referential size row
  follows). Do not re-pin a Playwright fixture unless the gate record names a
  legitimately changed expected value; the current fixtures do not change. The
  two legacy fixtures are re-pinned here for the shell with their 2026 date, and
  again in the hardening change for the removed date.
- [x] 3.5 Docs for the accepted items: update `docs/ARCHITECTURE.md` (default
  and static both render one `<main>`), `docs/AGENT-INTERFACE.md` (remove the
  default three-`<main>` defect note; add the one-BOM sidecar sentence),
  `docs/LIMITATIONS.md` (static row no longer claims the default keeps three
  `<main>`), and `docs/BACKLOG.md` (move B-039, B-048, B-049 and B-054 to
  Resolved at archive time).
- [x] 3.6 Changelog for the accepted items: add the B-048, B-039 and B-049
  entries under `## [0.6.1] - Unreleased` in `docs/CHANGELOG.md`, including the
  BOM-free next write. Do not change `package.json` (`version` stays 0.6.0).
- [x] 3.7 Audit 2: reorder `loadResolvedInputs` to per-file guard → read →
  hash/dedupe → detect/skip → total guard → parse → push group. Skip decisions,
  duplicates and empty shards create no group and no bytes; validation-only
  groups still count. Use the exact new cap text. Invariant: `inputFiles` and
  `inputBytes` describe loaded groups only, and `run.ts` needs no change.
- [x] 3.8 Audit 3: extract the shared history document/run parser; make
  `readHistory` and `storedSchema` use it with their own prefixes. Invariant:
  `writeHistory` validates the target fully before `writeAtomic`, and a rejected
  target keeps its bytes.
- [x] 3.9 Audit 4: map a non-explicit empty `.jsonl`/`.ndjson` file to `skip`
  in `detectInput`; keep the explicit empty error and the malformed non-empty
  error. Invariant: no new option, warning or decision kind.
- [x] 3.10 Audit 5: add the rendered-attachment selector in
  `src/report/index-run.ts`; use it in `buildReportModel` and `summarizeIndex`.
  Build the summary run set from rendered scenario attachments, present
  run-hook starts and run-level attachments only. Invariant: summary total
  equals model counts and Details counts, schema stays 2.
- [x] 3.11 Audit 6: change the Playwright final-index comparison to `>=`; in
  `latestAttempt` return the later candidate on a full attempt/seconds/nanos
  tie; guard `timestampIso` in `src/report/model.ts` so `seconds === 0` is
  unknown. Leave the adapter's zero fallback unchanged; summary/CI/email stay
  unchanged.
- [x] 3.12 Audit 7: tie `skipped` to the final result and add expected skip to
  `unexpectedPass`; keep genuine expected-failure precedence but do not let an
  expected skip take that branch. Invariant: a failed or passed final result is
  never rendered or counted as skipped.
- [x] 3.13 Audit 8: pass the inherited `specFile` from `collectScenarios` into
  `scenarioPlan` and use it for the URI and rule name. Invariant: without a
  project the feature name follows the suite file; with a project the project
  stays the feature grouping; explicit spec file wins.
- [x] 3.14 Audit 9: validate optional `testCaseStarted.attempt` as a
  non-negative safe integer with the existing line-error form; keep absent as
  0 in the summary and model. Invariant: `--json` contains no `null` attempt.
- [x] 3.15 Audit 10: add the 200-code-point identity cap in `src/ci.ts` to the
  GitHub title and the Markdown heading, feature, name, URI and skipped
  identity; keep the marker outside the cap and truncate before escaping or
  code-span wrapping. Invariant: Azure, counts, messages and list limits are
  unchanged.
- [x] 3.16 Audit 11: add the report and CI write wrappers in `src/cli.ts` and
  use them at the report write and both `--ci-out` sites. Invariant: one-lined
  target, Node code when present, no temp name or UUID, exit 1, no partial
  file.
- [x] 3.17 Audit 12: export `isFeatureLike` from `src/input/detect.ts` and use
  it in `src/compat/options.ts` and `readFeatures` in
  `src/compat/cucumber-html-reporter.ts`. Invariant: one predicate, warning and
  skip with the flag, compat failure without it, no second shape check.
- [x] 3.18 Audit docs and changelog: update `docs/AGENT-INTERFACE.md` (input
  accounting/cap, history target validation, attachment parity, attempt,
  CI identity cap, write-error prefixes), `SECURITY.md` and
  `docs/PLAYWRIGHT-JSON.md` (path trust model, final-result/skip/file rules),
  `docs/CI.md` (200-code-point identity cap), `docs/LIMITATIONS.md` (accounting,
  empty-shard scan, Playwright rules, attempt, compat arrays) and
  `docs/CHANGELOG.md` (audit Fixed entries under 0.6.1). Keep B-058 open and do
  not add a root option.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check` and `npm run test:e2e`
  (report-level change) are green; typecheck, lint, unit tests and build
  included. Record the exact counts, the client bundle size and the report byte
  delta.
- [ ] 4.2 Independent reviewers in one batch: SCR (all five deltas), CR, DAR,
  SEC (history input parsing, attachment roots and file handling, path
  trust-model docs), UXR (report shell, stack breakpoint and landmarks), ILA
  (the German `localeCss` override), PCA (loader accounting/cap, final-result
  selection and the shared predicate), STR (module/test health, including the
  shared selector and history parser) and CMP (default report captures at 320,
  390, 768, 1024, 1440 px and 320/200 against 0.6.0; only the wrapper, the
  narrow metadata rule and the removed epoch dates may differ). A failing review
  spawns a fixer, not the implementer of record.
- [ ] 4.3 Host rows in `docs/DROP-IN-VALIDATION.md`: Seed-Test (legacy JSON and
  the `cucumber-html-reporter` shim), the official Cucumber-js host (legacy
  JSON and Messages) and the Playwright JSON host (because of the final-result,
  skip and inherited-file mapping fixes). Record host, pin, artifact and
  result. Confirm the report has one `<main>`, no horizontal overflow at
  1440/390 and 320/200, correct final statuses and dates, summary/report
  attachment parity and no console errors. The other required release rows stay
  for the release pass.
- [ ] 4.4 Gate record: commands, results, characterization re-pin evidence with
  the per-fixture reason (shell, narrow CSS, removed epoch date), the exact CSS
  rule and German override, the BOM read/peek/append table, the audit evidence
  table (finding, test, result), the attempt-tie table, the write-error and
  CI-boundary evidence, host rows and the byte delta. Confirm no existing
  Playwright fixture was re-pinned and list any new fixture. Deferred findings
  get a backlog trigger; nothing is dropped silently.
- [ ] 4.5 Fix every review finding or record a decision with a trigger; re-run
  the gate after fixes.

## 5. Release boundary

- [ ] 5.1 Do not bump the version, tag, stage or publish. 0.6.1 preparation and
  approval remain a separate user decision after this change is complete and
  reviewed.
