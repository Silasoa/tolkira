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
  that starts before `#report-view` and closes after the last present panel;
  the Report and Details panels are inside it; `#analysis-view` has no
  `<main>` and keeps its class, role, label, ID and `hidden`; no `#trends-view`;
  two tabs; every runHead sits inside main and the site header is the only
  banner. A default report with two history runs has one `<main>` around all
  three panels, three tabpanels and the three IDs. A static report has the same
  wrapper and no tab roles. Assert heading order and the
  `#analysis-view, #trends-view` print rule.
- [x] 2.2 B-048 browser: one `main` role and exactly one `banner` role at 320,
  390, 768, 1024 and 1440 px and at 320 px / 200 % text; after the initial load
  and after each tab click the active panel is inside `main`; no horizontal
  overflow; Details and Trends panels keep their bounding boxes; save
  before/after visual captures for CMP.
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

- [x] 3.1 B-048: drop the `<main class="shell">` from both `report.ts` branches
  in favour of `<div class="shell">` inside the Report `tabPanel`, and wrap the
  three view renders in one plain `<main>` in `html.ts`; keep every panel
  attribute and ID. Leave `details.ts`, `trends.ts` and `styles.ts` alone.
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
  `attachments-presentation.html`). Inspect the diff: the one `<main>` wrapper
  around the three panels, the `<main class="shell">`→`<div class="shell">`
  replacement in the Report panel, the `<div class="shell analysis">`
  replacements in Details/Trends, their closing tags, the narrow CSS string and
  the removed 1970 run dates on the three zero-timestamp Messages fixtures are
  allowed. Record the byte delta and the per-fixture reason. Measured: the
  B-039 CSS insertion and the Details/Trends `<main>`→`<div>` replacements
  moved each golden +104 bytes; the wrapper re-pin moved `minimal.html`
  66,447→66,458 and `attachments-presentation.html` 70,623→70,634, +11 bytes
  each (`<main>`/`</main>` add 13, `<main class="shell">`→`<div class="shell">`
  and `</main>`→`</div>` remove 2, the self-referential size row follows). New
  hashes: screenshot `5eee7f129a439eb9f93cc881ffff5317d0d8cfeca46bd81966e057c82804a2fa`,
  all-statuses `266529052466a6a334cc283b8e1eaab4d2872e108e009b4042f99c59ef298225`,
  empty-statuses `2658a0f983ef4a6d0461ce95deff71c4799e8ceb798897b910e3dbe70c0f302f`,
  examples-tables `cd64046de63c9930be29f73837160fe234e357e5695443a6990b9d96ad78e725`,
  legacy-happy `af93978b48b5a0b24655230907f9f17db7837e8c8cc84ba594ae781e9180b320`,
  legacy-failed `da1109990012f16891a0dacea34699b161688361dcb255b3b7cbdcba96f1eeed`,
  playwright-real `bdc438cc7fccddd1738445ef6a3b1dee2ea17b27f782c249413a07dd6e217bc6`,
  playwright-two-files `084947a250043d9b6de5c87ccfbc93f1ddc5234137768262534fb20f59ae8243`,
  playwright-skipped `aab9fb019fa78109d00560a1c26f29721ef9ec6a336676a0a14f863f144de6c7`,
  two-run Trends `e372bc13936bad44e5bd7d5e6d96741aca35c2deae52449eae662613df0aa6a3`.
  Do not re-pin a Playwright fixture unless the gate record names a
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

- [x] 4.1 `npm run hygiene`, `npm run check` and `npm run test:e2e`
  (report-level change) are green; typecheck, lint, unit tests and build
  included. Record the exact counts, the client bundle size and the report byte
  delta.
- [x] 4.2 Independent reviewers in one batch: SCR (all five deltas), CR, DAR,
  SEC (history input parsing, attachment roots and file handling, path
  trust-model docs), UXR (report shell, stack breakpoint and landmarks), ILA
  (the German `localeCss` override), PCA (loader accounting/cap, final-result
  selection and the shared predicate), STR (module/test health, including the
  shared selector and history parser) and CMP (default report captures at 320,
  390, 768, 1024, 1440 px and 320/200 against 0.6.0; only the wrapper, the
  narrow metadata rule and the removed epoch dates may differ). A failing review
  spawns a fixer, not the implementer of record.
- [x] 4.3 Host rows in `docs/DROP-IN-VALIDATION.md`: Seed-Test (legacy JSON and
  the `cucumber-html-reporter` shim), the official Cucumber-js host (legacy
  JSON and Messages) and the Playwright JSON host (because of the final-result,
  skip and inherited-file mapping fixes). Record host, pin, artifact and
  result. Confirm the report has one `<main>`, no horizontal overflow at
  1440/390 and 320/200, correct final statuses and dates, summary/report
  attachment parity and no console errors. The other required release rows stay
  for the release pass.
- [x] 4.4 Gate record: commands, results, characterization re-pin evidence with
  the per-fixture reason (shell, narrow CSS, removed epoch date), the exact CSS
  rule and German override, the BOM read/peek/append table, the audit evidence
  table (finding, test, result), the attempt-tie table, the write-error and
  CI-boundary evidence, host rows and the byte delta. Confirm no existing
  Playwright fixture was re-pinned and list any new fixture. Deferred findings
  get a backlog trigger; nothing is dropped silently.
- [x] 4.5 Fix every review finding or record a decision with a trigger; re-run
  the gate after fixes.

## 5. Release boundary

- [x] 5.1 Do not bump the version, tag, stage or publish. 0.6.1 preparation and
  approval remain a separate user decision after this change is complete and
  reviewed.

## Gate record (2026-11-24)

### Gate

| Check | Result |
| --- | --- |
| `npm run hygiene` | `hygiene: ok`, 848 tracked files / 391 commits |
| `npm run check` | catalog 203 keys / 2 locales; typecheck, lint and build green; 91 test files, 1,590 passed / 9 skipped (1,599) |
| `npm run test:e2e` | 445 passed / 8 skipped (453) on Chromium, Firefox and WebKit |
| CI for `4414826` | green: hygiene, check (22/24/26), check-windows, e2e, e2e-macos, package |
| Client bundle | `client-bundle.ts` 15,438 bytes (budget 16,000) |

Report byte delta against 0.6.0 on the same fixed-clock fixture:
`minimal.html` 66,343 -> 66,458 (+115); `attachments-presentation.html`
70,519 -> 70,634 (+115). The delta is the B-039 container rule and the
Details/Trends panel-container move (+104) plus the one-main wrapper (+11). No
runtime dependency was added.

### Reviewers

One blind batch: SCR, CR, DAR, SEC, UXR, ILA, PCA, STR and CMP.

| Reviewer | Result |
| --- | --- |
| SCR | Three blockers: an expected skip took the expected-failure branch; an explicit empty Messages file deduped behind a scanned empty shard lost its `Input is empty` error; the equal/missing-retry suppression was unapproved. Fixed in `a410354`; the third item removed the suppression and relaxed the Red assertion to the every-result-is-an-attempt contract. Targeted re-review: PASS, no blockers. |
| CR | Confirmed the first two SCR blockers; no further blockers. |
| DAR | Four doc blockers (static tab roles, wrong commit cites, stale `COMPATIBILITY.md`, `PLAYWRIGHT-JSON.md` row) plus wording; fixed in `b6065fa`. |
| CMP | One a11y regression: the one `<main>` sat inside `#report-view`, so Details/Trends lost the main landmark and their `runHead` became a second banner. Fixed in `4414826`; re-review: PASS, no blockers. |
| SEC, UXR, ILA, PCA, STR | No blockers. |

CMP re-review of `4414826` against `v0.6.0` (commit `31fc139`): both revisions
were built in isolated temporary worktrees and rendered from
`screenshot.ndjson` with 2- and 3-run `--history` and a long Actions metadata
URL, default and `--static`, at 320, 390, 768, 1024 and 1440 px and at 320 px
with 200 % text, measured with Playwright 1.65.1/Chromium. The new tree has
exactly one `<main>`, exactly one banner (the site `topbar`), and every
`runHead` plus the active panel inside that main in every state; tab roles,
aria, panel IDs, heading order and the ID-keyed print page-break rule are
unchanged. Panel and shell x/width deltas against 0.6.0 are 0 px for every
report, state and viewport; the only deltas are the approved B-039 stacked
Details metadata at 320/200 (two tracks to one, long link 478 -> 236 px tall,
Details -77.19 px) and the approved removed 1970 dates in the all-statuses run,
plus the inevitable report-byte row value. No horizontal overflow and no
console or page errors; the static form has one main, no scripts, all details
open, the three view IDs and the ID-keyed print rule. Evidence: screenshots,
landmark/geometry tables and raw JSON were captured in a temporary directory
outside the repo and are not committed.

The targeted SCR re-review confirmed all three blockers closed and named the
test that fails when each fix is reverted:
`does not hide an expected skip whose test status is expected`,
`rejects an explicit empty file deduped behind a scanned shard` and
`uses the last array result when retry values are missing or equal`. It also
noted two test-strength limits, recorded in `docs/BACKLOG.md`: the equal-attempt
acceptance test is order-aligned (a regression to "always last envelope" would
pass), and the explicit-first dedupe test is an order control rather than a
pre-fix falsifier.

Residual test nits are recorded in `docs/BACKLOG.md` with the next-change
trigger; the attempt-label, RTL and test-helper items carry their own triggers.

### Host rows

Recorded in `docs/DROP-IN-VALIDATION.md`, "`0.6.1-quality-pass` host check
(2026-11-24, pre-release tarball)" (`110ce91`). Tarball 641,686 B, SHA-256
`7C21915BD364A2EBD8F5103856B36E76F071D8BEDE66466482B8004E67B5172C`, CLI
prints `0.6.0`. Seed-Test (`ce2cad8`): `tsc -b` and the 35 host tests pass,
story 88,794 B and group 106,406 B with unchanged counts, shim sidecar
deep-equal except the old reporter's trailing newline, 45/45 report/viewport
combinations pass. Cucumber-js (`@cucumber/cucumber@13.3.0`): legacy and
Messages counts unchanged, summaries byte-identical. Playwright movies-app
(`5d2cdf0`): 123 tests, 121 passed / 2 skipped, 123/123 source lines and final
statuses correct, no 1970 date. Every page has one `<main>` and one banner,
all panels inside it, no overflow, no console errors and no external requests;
attachment parity 1/1/1, 2/2/2, 2/2/2 and 4/4/4; no failing row.

### Characterization re-pin

Nine default hashes, the two-run history hash and both golden HTML files were
re-pinned. The first re-pin moves each golden +104 bytes: the `report.css`
container rule and the three Details/Trends
`<main class="shell analysis">` -> `<div class="shell analysis">` replacements.
The three zero-timestamp Messages fixtures (`all-statuses`, `empty-statuses`,
`examples-tables`) also lose the 1970 run date. The wrapper re-pin moves each
golden +11 bytes: `<main>`/`</main>` add 13, `<main class="shell">` ->
`<div class="shell">` and `</main>` -> `</div>` remove 2, and the
self-referential size row follows. Applying only that wrapper delta to the
parent golden reproduces the new file exactly; no other diff was found.

| Fixture | SHA-256 |
| --- | --- |
| messages screenshot | `5eee7f129a439eb9f93cc881ffff5317d0d8cfeca46bd81966e057c82804a2fa` |
| messages all statuses | `266529052466a6a334cc283b8e1eaab4d2872e108e009b4042f99c59ef298225` |
| messages empty statuses | `2658a0f983ef4a6d0461ce95deff71c4799e8ceb798897b910e3dbe70c0f302f` |
| messages examples tables | `cd64046de63c9930be29f73837160fe234e357e5695443a6990b9d96ad78e725` |
| legacy happy | `af93978b48b5a0b24655230907f9f17db7837e8c8cc84ba594ae781e9180b320` |
| legacy failed | `da1109990012f16891a0dacea34699b161688361dcb255b3b7cbdcba96f1eeed` |
| playwright real run | `bdc438cc7fccddd1738445ef6a3b1dee2ea17b27f782c249413a07dd6e217bc6` |
| playwright two files | `084947a250043d9b6de5c87ccfbc93f1ddc5234137768262534fb20f59ae8243` |
| playwright skipped no steps | `aab9fb019fa78109d00560a1c26f29721ef9ec6a336676a0a14f863f144de6c7` |
| two-run Trends | `e372bc13936bad44e5bd7d5e6d96741aca35c2deae52449eae662613df0aa6a3` |

No existing Playwright fixture was re-pinned. Six Playwright fixtures were
added: `equal-retry.json`, `expected-skip-failed.json`,
`expected-skip-passed.json`, `inherited-file.json`, `no-retry.json` and
`no-timing.json`; `test/fixtures/playwright/PROVENANCE.md` records them.

### B-039 rule and German override

`src/render/report.css`, after the `max-width: 560px` block and keyed to the
`.shell` inline-size container:

```css
/* At 320px/200% text the shell content is narrower than 10 text-sized rems;
   stack the metadata so labels keep a readable width and long URLs wrap. */
@container (max-width: 10rem) {
  .metaList { grid-template-columns: minmax(0, 1fr); }
  .metaList dd { text-align: left; }
}
```

The German override in `src/render/html.ts` follows the existing German
`metaList` share and restores one column at the same boundary:

```css
:lang(de) .metaList{grid-template-columns:minmax(0,2fr) minmax(0,3fr)}
@container (max-width:10rem){:lang(de) .metaList{grid-template-columns:minmax(0,1fr)}}
```

`npm run styles` regenerated `styles.ts`; the generated string is not hand-edited.

### BOM read, peek and append

| Path | Case | Result | Test (`test/history.test.ts`) |
| --- | --- | --- | --- |
| read | valid file without BOM | regression, unchanged | `reads a valid BOM-prefixed file exactly like the file without a BOM` |
| read | one BOM + valid JSON | read equals the no-BOM file | same test |
| read | BOM only | existing not-valid-JSON error | `rejects a BOM-only file with the existing not-valid-JSON error` |
| read | BOM + invalid JSON | error, bytes unchanged | `rejects a BOM followed by invalid JSON without rewriting the file` |
| read | two leading BOMs | exactly one stripped, second stays invalid | `strips exactly one BOM so a second one stays invalid JSON` |
| write peek | BOM-prefixed target | accepted, next write is BOM-free | `accepts a BOM-prefixed target in the schema peek and writes BOM-free bytes` |
| write peek | BOM + invalid JSON | rejected before any write | `rejects a BOM followed by invalid JSON in the write peek without touching it` |
| append | BOM-prefixed sidecar | same bytes as the no-BOM append, no run lost | covered by the append/schema tests |
| write | any write | no BOM in the output | `writes a schema-1 sidecar without a BOM` |

### Audit evidence (findings 2-12 of `docs/research/audit-2026-11.md`)

| # | Finding | Representative test | Result |
| --- | --- | --- | --- |
| 2 | Input accounting counted skipped files and checked the cap first | `test/inputs.test.ts`: `loads two identical 51 MiB reports once and below the total cap`, `does not count large skipped files toward the cap or the input bytes`, `fails unique content above the total cap with the supported remedy` | pass |
| 3 | `writeHistory` overwrote a malformed target | `test/history.test.ts`: target validation and byte-identity tests | pass |
| 4 | An empty `.jsonl`/`.ndjson` shard aborted a scan | `test/inputs.test.ts`: `skips an empty shard without a warning`, `rejects an explicit empty file deduped behind a scanned shard`, `rejects the same empty pair when the explicit file sorts first` | pass |
| 5 | HTML and JSON attachment counts disagreed | `test/model-summary-cross-check.test.ts`, `test/summary.test.ts`, `test/render-attachments.test.ts`: orphan, resultless, missing run-hook, normal, no-step-id and screenshot cross-check | pass |
| 6 | Playwright reports without timing picked the first attempt | `test/playwright.test.ts`: missing/equal/distinct retry tests; `test/model.test.ts`, `test/summary.test.ts`, `test/model-summary-cross-check.test.ts`, `test/render-report.test.ts`: zero run/scenario timestamp and real-timestamp tests | pass |
| 7 | `expectedStatus: skipped` hid a failure | `test/playwright.test.ts`: `renders an expected skip with a failed result as failed`, `renders an expected skip with a passed result as an unexpected pass`, `does not hide an expected skip whose test status is expected` | pass |
| 8 | A spec without `file` lost the suite file name | `test/playwright.test.ts`: `uses the enclosing suite file for a spec without file` | pass |
| 9 | An unvalidated Messages `attempt` could be `null` in JSON | `test/messages-producers.test.ts`, `test/model.test.ts`: invalid attempt errors; absent is 0, valid is kept, no `null` | pass |
| 10 | CI output did not cap scenario names, URIs or titles | `test/ci.test.ts`: `caps a long GitHub error title at 200 code points with the marker`, `keeps exactly 200 code points unchanged and cuts 201`, `caps the Markdown feature, name and URI before code-span wrapping`, `caps a long skipped identity with the marker`, `leaves the Azure 4000-code-point identity and message cap unchanged` | pass |
| 11 | Report write errors exposed the random temporary path | `test/cli-edge.test.ts`, `test/cli-ci.test.ts`: clean target naming, report kept on a failed CI write, no later output, input/logo overwrite refusal | pass |
| 12 | `ignoreBadJsonFile` failed on a non-feature JSON array | `test/compat.test.ts`, `test/compat-sidecar.test.ts`: skipped/merged array, failure without the flag, one predicate | pass |

Finding 1 (path attachments can read any file under the cwd) is documented in
`SECURITY.md` and carried by B-058; no behaviour change is part of this change.

### Attempt tie

| Case | Expected | Test |
| --- | --- | --- |
| Equal attempt and timestamp, first failed and second passed | later input wins in model, summary and HTML | `test/model-summary-cross-check.test.ts`: `uses the later timestamp when the attempt is equal` |
| Higher attempt with an earlier timestamp | higher attempt wins | `model.test.ts`: `keeps a higher attempt when its timestamp is earlier` |
| Same attempt, distinct timestamps | later timestamp wins | the timestamp precedence tests |
| Three starts on a tie | last input start wins, report and summary agree | `test/model-summary-cross-check.test.ts` |
| Playwright missing or equal retry | last array result wins; every result stays an attempt | `test/playwright.test.ts`: `uses the last array result when retry values are missing or equal`, `uses the last array result when one retry value is missing`, `keeps the highest retry when retry values are distinct` |

### Write errors and CI boundary

| Area | Case | Result | Test |
| --- | --- | --- | --- |
| Report write | directory target | names the requested target, exit 1, no partial file | `test/cli-edge.test.ts`: `creates missing output parents but fails cleanly on an existing directory target` |
| Report write | failure after the write | no later output | `test/cli-edge.test.ts`: `writes no later output when the report write fails` |
| Report write | overwrite guard | input and logo files refused | `test/cli-edge.test.ts`: `refuses to overwrite an input file`, `refuses to overwrite the logo file` |
| CI write | failed `--ci-out` | requested target named, report kept | `test/cli-ci.test.ts`: `names the requested CI target and keeps the report on a failed write` |
| CI identity | GitHub title/heading/feature/name/URI/skipped | 200 code points kept, 201 cut, marker outside the cap, escaped after truncation | `test/ci.test.ts` (five tests above) |
| CI identity | Azure | 4,000-code-point cap unchanged | `test/ci.test.ts`: `leaves the Azure 4000-code-point identity and message cap unchanged` |

### Deferred findings

The residual test nits, the `Attempt: 1` label, the RTL `text-align`, the
synthetic 1970 finish time, the test-helper duplication and the two
test-strength limits are recorded in `docs/BACKLOG.md` with explicit triggers.
B-058 covers the path trust model. Nothing from the review or the audit is
dropped silently.

### Findings closed

| Finding | Fix |
| --- | --- |
| SCR blocker 1: expected skip hid a failure | `a410354` |
| SCR blocker 2: explicit empty file lost its error after dedupe | `a410354` |
| SCR blocker 3: equal/missing-retry suppression | `a410354`; Red assertion relaxed to the every-result-is-an-attempt contract |
| Two missing acceptance tests | `e9c0522` |
| 14 accepted test/hardening items | `a410354` |
| Four DAR doc blockers | `b6065fa` |
| CMP a11y regression | `4414826` |
| Residual nits | `e28a14e` as decisions with triggers |

The gate was re-run after each fix: `npm run check` green (1,590 passed / 9
skipped at the final tree), Chromium e2e green after every fixer commit, and the
full three-engine suite green at `4414826`.
