# 0.6.1-quality-pass

## Why

Three accepted P3 defects remain after 0.6.0, plus one test-only gap. No remote
issue exists; the tracking rows are local backlog items B-048, B-039, B-049 and
B-054.

- B-048: the default report renders three `<main>` elements (Report, Details,
  Trends), which is invalid HTML. The static report already has one; the
  default form still has three.
- B-039: at 320 px and 200 % text the Details metadata list squeezes its label
  column and turns long value links into a narrow, ragged column.
- B-049: a UTF-8 BOM before the history sidecar JSON makes `readHistory` reject
  an otherwise valid file.
- B-054: a green e2e run leaves no visual evidence. Playwright captures a
  screenshot only for a failed test, so the shell is never recorded at the gate
  viewports for a passing run.

The November 2026 audit (`docs/research/audit-2026-11.md`) then confirmed
eleven code defects and one trust-model decision on the released 0.6.0 build.
No remote issue exists for them either; the audit is the tracking record, and
B-058 holds the one follow-up that is not part of this patch:

- path attachments can read any regular file under the input folder or the
  working directory (audit #1);
- input accounting counts skipped files and checks the 100 MB cap before
  dedupe and skip (audit #2);
- `writeHistory` overwrites a malformed supported-schema target (audit #3);
- an empty `.jsonl`/`.ndjson` shard aborts a directory scan (audit #4);
- the HTML and JSON summary disagree on some attachment counts (audit #5);
- Playwright reports without timing or retry fields pick the wrong attempt,
  including a full attempt and timestamp tie, and can render a 1970 date
  (audit #6);
- an expected Playwright skip hides a failed or unexpectedly passed result
  (audit #7);
- a Playwright spec without `file` loses the suite file in its URI and rule
  name (audit #8);
- an unvalidated Messages `attempt` can become `null` in JSON (audit #9);
- CI identity text is not capped (audit #10);
- a failed `--out`/`--ci-out` write exposes the random temporary path
  (audit #11);
- `ignoreBadJsonFile` still fails on a non-feature JSON array (audit #12).

The static change deliberately left B-048 as the default report's recorded
defect. This patch closes it, the two smaller reader/layout defects, the audit
defects, and adds the capture that would have shown the shell at each gate
viewport, before the next report-shell change has to carry them. Finding 1 is
documentation and a backlog decision only: the roots stay, and the trust model
becomes explicit.

## What Changes

- **B-048:** the default report has exactly one `<main>`, on the Report view.
  Details and Trends become plain containers and keep the `tabPanel` class,
  `role="tabpanel"`, the `analysis-view`/`trends-view` IDs and the
  `#analysis-view, #trends-view` print page-break rule. The static report keeps
  its one `<main>`.
- **B-039:** the Details metadata list stacks label over value at 320 px and
  200 % text, with start-aligned values; long unbroken URLs wrap and the page
  does not scroll horizontally. At 320 px and 390 px and wider at 100 % text,
  and at 768 px and wider at the gate, the existing two-column layout is
  unchanged.
- **B-049:** the shared sidecar read strips exactly one leading U+FEFF, so
  `readHistory` and the schema peek used by `writeHistory` accept a
  BOM-prefixed file. A BOM-only file and a BOM followed by invalid JSON still
  fail with the existing `not valid JSON` error, and a read never rewrites the
  file. The writer emits no BOM and its next successful write normalises a
  BOM-prefixed file.
- **B-054:** one e2e test writes viewport captures of the default and the
  static report under `test-results/visual/<engine>/` (1440 and 390 px, plus
  320 px at 200 % text for both forms), so a green run leaves images to
  inspect. No pixel assertions, no committed image, no new dependency.
- **Audit 1 — path trust model (docs only):** no behaviour change. The input
  file's folder and `process.cwd()` stay the allowed roots. `SECURITY.md` and
  `docs/PLAYWRIGHT-JSON.md` state that the report input controls the attachment
  path, so any regular file under either root can be embedded, and that the
  roots come from the process, never from report data. B-058 keeps the 0.7
  opt-in root/allowlist trigger.
- **Audit 2 — input accounting:** `inputFiles` and `inputBytes` count only
  files that produce a loader group. A `skip` decision, a skipped empty shard
  and duplicate content do not count. The per-file 100 MB guard stays before
  the read; the total 100 MB cap applies to unique loaded content after dedupe
  and skip. The cap error offers a supported remedy by asking for smaller
  inputs or a smaller attachment payload.
- **Audit 3 — history target:** `writeHistory` validates an existing target
  with the reader's full document and run rules before writing. A target with
  a supported schema but malformed `runs` is rejected with the existing
  `Cannot write history file <file>: ...` prefix and stays byte-identical.
  A missing target still writes; a valid target still appends and keeps its
  schema.
- **Audit 4 — empty Messages shard:** a directory scan skips an empty
  `.jsonl`/`.ndjson` file (zero non-empty lines, optional BOM or whitespace)
  without a loader group, count or warning. An explicitly named empty file
  still fails with `Input is empty: <file>`, and a directory with only empty
  shards fails with `No supported report files found.`
- **Audit 5 — attachment counts:** the summary per-scenario attachment count
  equals the scenario attachments the report renders: attachments on a step
  that is rendered and has a result, plus attachments without a `testStepId`.
  An attachment on a step without a result, on a test step absent from the test
  case, or on a run-hook start missing from the stream is not counted in the
  scenario or the run total. `attachments.total` matches
  `model.counts.attachments` and the Details count, and the summary schema
  stays version 2.
- **Audit 6 — Playwright final result and run date:** when `retry` values are
  missing or equal, the last result in array order wins; with distinct retry
  values the highest wins. The later start also wins a full attempt and
  timestamp tie for one pickle, so the report and summary agree on the final
  start. When no usable run start time exists, the report omits the run date
  instead of showing 1970-01-01; a zero-seconds
  `testRunStarted`/`testRunFinished`/`startedAt` timestamp is unknown to the
  model.
- **Audit 7 — Playwright expected skip:** a test is skipped only when its
  final result is skipped, or when it is marked skipped and has no result. A
  failed final result wins over an expected skip, and a passed final result
  under an expected skip is an unexpected pass (failed).
- **Audit 8 — Playwright inherited file:** when a spec omits `file`, the
  scenario URI and rule name use the enclosing suite's file, so the scenario
  URI, rule name and feature name agree.
- **Audit 9 — Messages attempt:** `testCaseStarted.attempt` is optional; when
  present it must be a non-negative safe integer. `1e309`, a string, a
  negative value and a non-integer are rejected with the existing line-error
  style naming the file, line and field. An absent attempt is 0, and `--json`
  never contains `null` for `attempt`.
- **Audit 10 — CI identity cap:** GitHub annotation titles and Markdown
  headings and code spans cap the original feature name, scenario name, URI
  and `--title` heading at 200 Unicode code points, followed by the existing
  `[truncated]` marker when cut. Counts, the full report, the failure-message
  limits and the 50/20 list limits stay unchanged.
- **Audit 11 — write errors:** a failed `--out` write reports
  `Cannot write report to <target> (<code>)`; a failed `--ci-out` write reports
  `Cannot write CI output to <target> (<code>)`. The target is one-lined, no
  `.tmp` name or UUID appears, the exit code stays 1 and no partial file
  remains.
- **Audit 12 — compat bad JSON array:** with `ignoreBadJsonFile: true`, a
  `jsonDir` file whose JSON is not a legacy feature array (`[1,2,3]`, an array
  of non-feature objects) is skipped with the existing skipped-file warning.
  Without the flag it still fails. The compat scan uses the same feature-shape
  predicate as `detectInput`; the existing private predicate is exported rather
  than duplicated.
- `docs/CHANGELOG.md` gains a `0.6.1` section. The package version stays 0.6.0
  and this change creates no tag, stage or publish.

## Impact

- Capabilities: `report-rendering`, `cli-api`, `input-formats`,
  `compatibility` and `test-infrastructure`.
- Code: `src/input/load.ts` (accounting and cap order), `src/input/detect.ts`
  (exported feature predicate and empty-shard skip), `src/input/messages.ts`
  (attempt validation), `src/input/playwright.ts` (final result, skip rule and
  inherited file), `src/report/index-run.ts` (rendered-attachment selector),
  `src/report/model.ts` (zero-timestamp guard and selector use),
  `src/summary.ts` (per-scenario and run attachment counts),
  `src/history.ts` (shared target validation), `src/ci.ts` (identity cap),
  `src/cli.ts` (report and CI write wrappers), `src/compat/options.ts` and
  `src/compat/cucumber-html-reporter.ts` (shared feature predicate). B-048 and
  B-039 still touch `src/render/details.ts`, `src/render/trends.ts`,
  `src/render/report.css`, `src/render/styles.ts` and `src/render/html.ts`;
  B-049 still touches `src/history.ts`.
- Tests: `test/inputs.test.ts`, `test/input-detect.test.ts`,
  `test/input-resolve-scan.test.ts`, `test/history.test.ts`,
  `test/history-window.test.ts`, `test/cli-history.test.ts`,
  `test/summary.test.ts`, `test/model-summary-cross-check.test.ts`,
  `test/model.test.ts`, `test/playwright.test.ts`,
  `test/playwright-retry-evidence.test.ts`, `test/playwright-source-line.test.ts`,
  `test/messages-producers.test.ts`, `test/ci.test.ts`, `test/cli-ci.test.ts`,
  `test/cli-edge.test.ts`, `test/compat.test.ts`, `test/compat-sidecar.test.ts`,
  `test/render-report.test.ts`, `test/render-characterization.test.ts`,
  `test/render-golden.test.ts`, `test/render-attachments.test.ts`, the
  report-shell, metadata and attachments e2e suites (`report.spec.ts`,
  `responsive.spec.ts`, `metadata-links.spec.ts`, `attachments.spec.ts`,
  `visual.spec.ts`) and the new visual capture. New Playwright fixtures cover
  the tie, zero-date, expected-skip and inherited-file cases; no existing
  Playwright fixture changes output.
- Docs: `docs/ARCHITECTURE.md`, `docs/AGENT-INTERFACE.md`, `SECURITY.md`,
  `docs/PLAYWRIGHT-JSON.md`, `docs/CI.md`, `docs/LIMITATIONS.md`,
  `docs/BACKLOG.md` and `docs/CHANGELOG.md`.
- B-048 and B-039 plus the audit 6 zero-date rule re-pin committed report
  bytes: the nine default characterization hashes (all nine for the shell, three
  of them also for a removed 1970 run date on the Messages fixtures), the two-run
  history hash and the two golden HTML files
  (`test/fixtures/render-golden/minimal.html` and
  `attachments-presentation.html`). Allowed diffs: the two `<main>`→`<div>`
  replacements, their closing tags, the narrow CSS string and the removed epoch
  dates. No other golden or characterization hash is re-pinned; the legacy
  fixtures keep their pinned clock until the hardening change removes the
  invented legacy date.
- The JSON summary changes only where the audit fixes correct an attachment
  count or a Playwright final status; `attempt` stays a number and the schema
  stays version 2. CI text changes only for identities above 200 code points. CLI
  and compatibility output change only where the input cap, the empty-shard
  scan, the Messages attempt validation, the compat skip/failure or the named
  write failures are corrected. The email attachment total and the history
  aggregate derived from the summary follow the corrected count for an affected
  input; no schema or field changes. Public API signatures, CLI options, the
  dependency surface and network behaviour do not change.
- The report HTML changes by the B-048/B-039 shell edits and, for affected
  Playwright or Messages input, by the corrected final result, run date or
  rendered attachment. No new module and no new runtime dependency is added.

## Out of scope

- The attachment-root behaviour change. B-058 owns the 0.7 opt-in
  root/allowlist; 0.6.1 documents the trust model and keeps the current roots.
- New features, options, public API, summary fields, schema versions or
  redesigns beyond the fixes named above.
- A version bump, release preparation, tag, stage or publish; the 0.6.1
  section is written in this change but the release remains a separate user
  decision.
- Normalising a BOM-prefixed sidecar on a read; the normalisation happens only
  when the next successful write replaces the file.
- Other encodings (UTF-16, BOM after whitespace, more than one BOM).
- A tab-shell redesign, removing tab roles, or changing the active-view
  behaviour.
- A header metadata layout change; B-039 covers the Details list, not the
  header.
- The remaining backlog rows, including B-050 to B-053 and B-058.
- Re-running the full five-host release matrix; the three host rows named in
  the tasks are the minimum for this patch.

## Decisions

- **Loader accounting.** A file counts when the loader creates a group for it.
  A `skip` decision, a skipped empty shard and duplicate content create no
  group and do not count. The per-file 100 MB guard runs before the read; the
  total cap applies to unique loaded content after dedupe and skip. The 50 MiB
  early warning stays stat-only over all resolved paths and may differ. Files
  are read before a content-based skip, so a directory of many large skipped
  files spends read time and has no aggregate cap beyond the per-file guard; the
  compat shim keeps its own pre-read byte accounting, out of scope here.
- **Reader-shared history validation.** The writer validates an existing
  target with the same document and run parser as the reader, but keeps the
  `Cannot write history file` prefix. A missing target writes; a valid target
  keeps its schema; a malformed target stays byte-identical.
- **Summary/report parity.** The summary counts the attachment set the report
  can render, not every attachment envelope for the selected start. The run
  total is the union of rendered scenario attachments, attachments on present
  run-hook starts and run-level attachments.
- **Playwright final result, skip and file.** Highest retry wins; the last
  array element wins a missing or equal retry. A skip marker never overrides a
  failed or passed final result. A spec without `file` inherits the enclosing
  suite's file.
- **Messages attempt.** Optional, but when present a non-negative safe integer;
  absent means 0. Both the model and the summary use the same value, and JSON
  never serialises `null`.
- **Identity cap.** 200 Unicode code points on the original text, before
  escaping or code-span wrapping, with the existing `[truncated]` marker. The
  marker is outside the 200; a surrogate pair is never split.
- **Write errors.** The CLI names the requested target with the Node error code
  when present, never the atomic temporary name. Exit code 1 and no partial
  file stay.
- **Compat predicate reuse.** `detectInput`'s existing legacy feature-shape
  predicate is exported and used by both the compat pre-check and the sidecar
  planner. Non-feature arrays are bad files, not merge candidates.
- **Path trust model.** The input file's folder and `process.cwd()` remain the
  allowed roots, and the report input controls the path. The docs state the
  consequence; an allowlist is B-058, not a silent 0.6.1 change.
- **Attempt tie.** A full attempt and timestamp tie returns the later candidate
  in envelope order, so the quality pass's missing/equal-retry rule selects the
  same start in the adapter, the model and the summary. Distinct attempts and
  timestamps keep their existing precedence. The hardening change inherits this
  rule instead of fixing it a second time.
- **Re-pin scope.** The nine characterization hashes, the two-run history hash
  and the two goldens are re-pinned only for the recorded shell, narrow-metadata
  and epoch-date diffs. A legacy hash changes only in the hardening change, when
  the invented legacy run date disappears.
- **Outline helper stays.** The duplicated outline-coordinate helper in
  `src/summary.ts` and `src/report/model.ts` is B-051 structure work; this patch
  touches both files but does not extract it, so no refactor is bundled with a
  behaviour change.
- **No version bump.** The package stays 0.6.0 until the user approves a
  separate release.
