# Design

## Context

0.6.0 shipped the static form with one `<main>`. The default form kept the
pre-existing three-main markup (B-048). The Details metadata list uses a grid
whose label track shrinks under text zoom (B-039), and `readHistory` parses the
sidecar text without removing a leading UTF-8 BOM (B-049). The baseline reader
already strips one BOM (`src/baseline.ts:223`); this change gives the shared
history sidecar read the same narrow tolerance.

The November 2026 audit (`docs/research/audit-2026-11.md`) reproduced eleven
further defects in the same release. Finding 1 is a trust-model documentation
decision, not a behaviour change: the input file's folder and `process.cwd()`
stay the roots, and B-058 owns the 0.7 opt-in root/allowlist. Findings 2 to 12
are small seams in the loader, history writer, summary, Playwright adapter,
Messages validator, CI formatter, CLI writes and compat scan. The change keeps
the four accepted defects and adds these seams. It adds no new module and no
new dependency.

## Seams

### B-048: one `<main>` in both report forms

- `src/render/report.ts` keeps `<main class="shell">` for the Report view.
- `src/render/details.ts` (`renderAnalysisView`) and `src/render/trends.ts`
  (`renderTrendsView`) already use `<div class="shell analysis">` in static
  mode. The default branch changes from
  `<main class="shell analysis">...</main>` to
  `<div class="shell analysis">...</div>`.
- The panel wrapper, `tabPanel` class, `analysis-view`/`trends-view` IDs,
  `role="tabpanel"`, `aria-labelledby`, `tabindex` and `hidden` stay exactly as
  today. Only the landmark element changes.
- The print rule `#analysis-view, #trends-view { break-before: page; }` is keyed
  by ID, not by `.tabPanel` or `<main>`, so it is unaffected.
- The static and default branches now share the same inner markup; the mode
  still controls only scripts, controls, `open`, `hidden` and ARIA.

The Report view is first in document order, so the one `<main>` remains the
first main landmark. Heading order and levels do not move. The only landmark
change is the removal of the two duplicate `main` landmarks, which is the
defect being fixed.

No CSS changes for B-048; `.shell` keeps its layout, max-width, padding and
container type.

### B-039: stacked metadata at the text-zoom boundary

Current rules (`src/render/report.css`):

- base at 354-356: `grid-template-columns: minmax(0, auto) minmax(0, 1fr)`,
  values right-aligned;
- at `max-width: 560px` (386): `minmax(0,2fr) minmax(0,3fr)`;
- German (`localeCss` in `src/render/html.ts`) also forces the 2fr/3fr label
  share, and `sizeMeta` already stacks at 560 px and below (B-046).

At 320 px and 200 % text the shell content is 320 - 2 × 2rem = 192 px while the
root is 32 px; a 2fr label track is about 77 px at 26 px type, so labels break
per character and right-aligned long links fragment.

The fix is one narrow container query. `.shell` is already
`container-type: inline-size` (report.css:61), so a container query can read the
shell's content width. The condition is written in `rem`: container-query
lengths follow the root font size, unlike a media query, whose `em` is fixed at
the initial size. A `max-width: 10rem` condition therefore means "narrower than
10 text-sized rems": it matches 320 px at 200 % text (192 px < 320 px) and
390 px at 200 % text (262 px < 320 px), but not 320 px at 100 % (256 px >
160 px), 390 px at 100 % (326 px > 160 px) or any wider gate viewport at 100 %.
The exact threshold is verified against the five gate widths; 10rem is the
starting value, not a contract.

```css
@container (max-width: 10rem) {
  .metaList { grid-template-columns: minmax(0, 1fr); }
  .metaList dd { text-align: left; }
}
```

- `overflow-wrap: anywhere` already exists on `dt` and `dd`; the stacked
  full-width track lets a long URL wrap instead of forming a narrow column.
- Values start-align because a right-aligned single column reads as ragged.
- The generic container rule must come after the existing
  `@media (max-width: 560px)` `.metaList` rule (`src/render/report.css:384-386`)
  or use a higher-specificity selector; where both match at 320 px / 200 %, the
  later 2fr/3fr rule would otherwise win.
- German needs one extra override after the existing `:lang(de) .metaList`
  rule in `localeCss`, because that selector outranks the generic `.metaList`
  rule:
  `@container (max-width:10rem){:lang(de) .metaList{grid-template-columns:minmax(0,1fr)}}`
- `src/render/styles.ts` is generated from `report.css` by
  `scripts/build-styles.mjs`; edit `report.css` and run `npm run styles` (the
  gate's `npm run assets` does the same). Never hand-edit the generated string.
- No script, catalog key, DOM attribute or metadata value changes. The header
  metadata list is not a `.metaList`; it stays untouched.

### B-049: one leading BOM in the shared sidecar read

`readHistory` (`src/history.ts:344`) and `storedSchema` (`src/history.ts:390`)
both obtain their text from `readSidecar`. Insert the same one-line strip as
the baseline reader in `readSidecar`, immediately after `readBounded` returns:

```ts
const text = await readBounded(handle, info.size);
return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
```

Both callers therefore see BOM-free text through one rule in one bounded read
path. Consequences:

- A valid BOM-prefixed file returns the same runs as the same file without a
  BOM.
- The schema peek accepts the same file, so an append to a BOM-prefixed
  sidecar proceeds instead of failing with `not valid JSON`.
- A BOM-only file leaves an empty string; `JSON.parse('')` throws and the
  existing `Invalid ...: not valid JSON` and `Cannot write ...: not valid JSON`
  paths are unchanged.
- BOM plus invalid JSON behaves the same way in both callers.
- Two leading BOMs leave one; `JSON.parse` still fails with the same error. The
  "exactly one" boundary is intentional.
- A read never writes. The file bytes and mtime are untouched.
- `writeHistory` stays BOM-free: `serialize` emits `{` as the first byte, so
  the next successful append rewrites a BOM-prefixed target as BOM-free bytes
  and keeps every run the same append would keep.

### Audit 1: path trust model (docs only)

No code seam. `src/input/playwright.ts` keeps the two allowed roots: the input
file's folder and `process.cwd()` (`1568-1575`), resolves a relative path
against the input folder first and cwd second (`939-941`), and opens only a
regular file after `realpath` and the root check (`884-890`). The roots come
from the process, never from report data, but the report input chooses the
path. `SECURITY.md` and `docs/PLAYWRIGHT-JSON.md` gain that consequence and the
two-root statement. B-058 keeps the 0.7 trigger for an opt-in root/allowlist.
No requirement delta and no behaviour change.

### Audit 2: count loaded report files and cap unique content

The seam is `loadResolvedInputs` in `src/input/load.ts`.

Current order: stat the file, add its size to the total and check the cap, read
the content, hash it, skip a duplicate, detect the format, parse, then push a
group even for a `skip` decision. The `skip` branch (`216-217`) and the
unconditional push (`220-225`) are the accounting defect; `addInputBytes` at
`152` is the cap-order defect.

New order per resolved file:

1. `stat` and keep the regular-file check.
2. Check the per-file size against the 100 MB guard before any read. This is
   the DoS guard and stays first. A single file above 100 MB fails with the cap
   error below before it is read.
3. Read the content and hash it.
4. A duplicate content hash continues without a group and without accounting;
   the existing explicit-JUnit revalidation stays.
5. `detectInput` decides. A `skip` decision continues without a group, and so
   does an empty Messages shard skipped by audit 4.
6. Add the unique file's size to `totalBytes` through `addInputBytes`; this is
   the first point where the total cap applies. Unique content above 100 MB
   fails before the adapter parse.
7. Run the selected adapter and push the group, including a validation-only
   group with no envelopes.

`run.ts` keeps `inputFiles = groups.length` and
`inputBytes = sum(group.bytes)`, so both surfaces now describe the loaded
report set. The 50 MiB early warning stays `scanInputBytes` over every resolved
path and may be larger; the existing cli-api requirement already documents the
difference. The cap error becomes:

```
Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.
```

Failure behaviour: a skipped or duplicate file never contributes to the cap or
the counts; a single oversized file fails before the read; unique content above
the cap fails with the new text; no partial output follows from any of them.

### Audit 3: validate the history target with the reader's parser

The seam is `storedSchema` in `src/history.ts:390-418`, which currently checks
only JSON, a JSON object and a supported `schemaVersion`. `readHistory` at
`344-383` already applies the full document and run rules.

Extract one parser, for example
`parseHistoryText(text, reject): { schemaVersion, runs }`, from the reader
body: `JSON.parse`, expected object, supported schema, `runs` array, then
`parseRun` for every entry. Both callers use it through `readSidecar`:

- `readHistory` passes the `Invalid history file <file>: ...` prefix and slices
  the returned runs to its window.
- `storedSchema` passes the `Cannot write history file <file>: ...` prefix and
  returns only the schema version after the full validation.

`writeHistory` calls `storedSchema` before it serialises or writes. A target
with a supported schema but `runs: "not-an-array"` or one bad run entry now
throws `Cannot write history file <file>: ...` and the target bytes stay
unchanged. A missing target still returns schema 1 and writes. A valid target
keeps its schema; the existing writer `writeRun` id cap still applies to the
runs being written, not to the older target runs it is replacing.

Failure behaviour: no `writeAtomic` call, no temp file and no byte change on a
rejected target. The reader's error prefix and the writer's error prefix stay
distinct.

### Audit 4: skip an empty Messages shard in a scan

The seam is the non-explicit branch of `detectInput` in
`src/input/detect.ts:106-118` plus the `skip` branch in
`loadResolvedInputs`. Today an empty `.jsonl`/`.ndjson` file is routed to
`messages-validation`, and `parseMessages` throws `Input is empty: <file>`.

Add one decision-table row: for a non-explicit file whose extension is
`.jsonl` or `.ndjson` and whose content is empty after the existing BOM strip
and whitespace trim, return `{ kind: 'skip' }`. The loader then creates no
group, adds no count and writes no warning. A non-empty shard keeps its current
`messages`/`messages-validation` routing and still fails on malformed content.
The explicit branch is untouched: `content.trim().length === 0` still routes to
`messages-validation`, so `parseMessages` keeps the `Input is empty: <file>`
error for a named file.

A directory with only empty shards has no groups and reaches the existing
`No supported report files found.` guard. No option, warning or new decision
kind is added.

### Audit 5: one rendered-attachment selector

The seam is between `src/report/model.ts` (`596-731`) and `src/summary.ts`
(`329-385`). The model renders only attachments whose step has a result and is
a pickle step or hook, plus attachments without `testStepId`. The summary
counts every attachment for the selected start, then adds every attachment with
no `testCaseStartedId`; orphan step ids and attachments on a run-hook start
missing from the stream therefore disagree.

Add one exported selector beside the index, for example
`renderedCaseAttachments(index, testCase, startedId)` in
`src/report/index-run.ts`:

- return `[]` when `index.results.get(startedId)` is empty;
- build the set of test-step ids that have a result and are a pickle step or a
  hook (`testStep.pickleStepId || testStep.hookId`);
- return `index.caseAttachments.get(startedId)` filtered to attachments with no
  `testStepId` or with a `testStepId` in that set.

`buildReportModel` uses the selector for `startedAttachments`; its existing
per-step filters and `extraAttachments` still split the same set. `summarizeIndex`
uses the selector for `scenarios[i].attachments` and adds that set to the run
set. The run total is the union of:

- every selected scenario's rendered attachments;
- `index.runHookAttachments` for each `testRunHookStarted.id` present in
  `index.runHookStarts`;
- `index.runAttachments` (attachments with neither a test-case start nor a
  run-hook start).

Attachments on a step without a result, a step absent from the test case, a
step that is neither pickle nor hook, a missing run-hook start, or an
unselected earlier attempt are outside the set. `attachments.total` is the set
size and `bytes` the sum over it; both match `model.counts.attachments` and the
Details count. The summary schema stays version 2.

### Audit 6: Playwright final result and unknown run date

`src/input/playwright.ts:1234-1243` reduces the results with a strict `>` on
`retry`. Missing retry values default to 0, so a failed first result and a
passed second result keep the first. Change the comparison to `>=`: the last
result in array order wins when values are missing or equal, and a distinct
higher retry still wins.

The adapter index alone is not enough. `latestAttempt`
(`src/report/index-run.ts:94-108`) selects the start that supplies status,
timestamps and attachments, and on an equal attempt and equal nanos it keeps
`current`, the first start. Change that final comparison to return `candidate`
on a full tie: the later start in envelope order wins. The adapter's `>=` and
the model's later-candidate rule land together; the model tie is what makes the
missing/equal-retry acceptance test green.

`src/report/model.ts:267-275` converts a timestamp with
`timestampIso(timestamp)`. The Playwright adapter's zero fallback
(`timestamp(0)`) then becomes `1970-01-01T00:00:00.000Z`. Guard the model
conversion: a timestamp with `seconds === 0` is unknown and returns
`undefined`. `testRunStarted`, `testRunFinished` and the per-scenario
`startedAt` all use the guard, so no 1970 run date or scenario date reaches the
report. The adapter's zero fallback itself is not changed. The JSON summary,
CI text and email carry no run date and stay unchanged.

Failure behaviour: a report with no usable start time renders no date instead
of a false epoch date. A real non-zero timestamp renders the existing localized
date.

### Audit 7: expected skip never hides a result

The seam is `scenarioPlan` in `src/input/playwright.ts:1245-1265`. Today
`skipped` is true for `test.status === 'skipped'`,
`test.expectedStatus === 'skipped'` or a skipped final result, and that flag
wins the mode choice.

Tie the skip flag to the final result:

- `skipped = finalStatus === 'skipped' || (finalStatus === undefined &&
  (test.status === 'skipped' || test.expectedStatus === 'skipped'))`;
- a failed, timed out, interrupted or passed final result makes `skipped`
  false;
- add `test.expectedStatus === 'skipped'` to `unexpectedPass`, so an expected
  skip with a passed final result takes the existing `unexpected-pass` mode
  (passed steps plus one failed `Unexpected pass` step and a failed scenario);
- an expected skip with a failed final result takes `normal` mode and renders
  the failed result and its error.

The existing `expectedFailure` branch stays first for a genuine expected
failure, but a test with `expectedStatus: 'skipped'` does not take it. A
skipped final result still takes the `skipped` mode. Failure behaviour: a failed
or unexpectedly passed result stays visible in the report, summary, CI and
history instead of being flattened to skipped.

### Audit 8: inherit the suite file for the scenario URI

`collectScenarios` in `src/input/playwright.ts:1386-1408` already computes
`specFile = stripTrailingTags(spec.file ?? suiteFile)` and passes it to
`featureFor`, but `scenarioPlan` at `1221-1233` calls
`fileUri(spec.file, context.inputDir)` and falls back to
`playwright.spec.ts`.

Pass the inherited `specFile` into `scenarioPlan` and use it for the scenario
URI and the rule name (`fileUri(inheritedFile, context.inputDir)`). The feature
grouping does not change: `featureFor` uses `project || file`, so a project
stays the feature name; without a project, the feature name follows the
inherited file. An explicit `spec.file` still wins because `collectScenarios`
already prefers it. The `playwright.spec.ts` fallback remains only for the case
where neither the spec nor any suite names a file.

### Audit 9: validate the Messages attempt

The seam is the `testCaseStarted` case in `src/input/messages.ts:149-153`.
`attempt` is currently omitted from validation, so `1e309` becomes `Infinity`,
a string stays a string, and the summary can serialise `null`.

Add an optional-field rule: when `attempt` is present, it must be a number,
finite, a safe integer and non-negative. Otherwise throw the existing line
error form, naming the file, line and field:

```
Invalid Cucumber Messages on line <line> of <source>: "testCaseStarted.attempt" must be a non-negative safe integer.
```

An absent attempt stays absent in the envelope. `src/summary.ts:348` and
`src/report/model.ts:767` both default it to 0, so the summary and model agree
and `--json` never contains `null` for `attempt`. A valid value such as 2 is
copied unchanged to both surfaces.

### Audit 10: cap CI identity text at 200 code points

The seam is `src/ci.ts`: `scenarioIdentity` (`83-87`), the GitHub error title
(`160`), `markdownText` (`304-306`), `codeSpan` (`308-313`) and the Markdown
identity call sites (`354-369`, `421`). The existing `truncate` helper already
counts code points and appends `[truncated]`.

Add one constant, for example `CI_IDENTITY_LIMIT = 200`, and apply
`truncate(text, CI_IDENTITY_LIMIT)` to the original text before escaping or
code-span wrapping:

- the GitHub error title uses the feature + scenario identity;
- every Markdown failed-scenario feature name, scenario name and URI;
- the Markdown skipped-scenario identity.

The GitHub title and code-span call sites use `truncate`, which appends the
marker after the 200 code points. At the Markdown `--title` heading call site,
truncate the original with `truncateCodePoints`, escape the kept text with
`markdownText`, then append `[truncated]` outside the escaping when cut; this
keeps the marker literal because `markdownText` escapes square brackets.
Counts, the full report, the GitHub/Azure message limits, the failure-message
caps and the 50/20 list limits are untouched. Azure annotation identity text
keeps its current 4000-code-point message cap. The existing `truncateCodePoints`
walk keeps a surrogate pair intact.

### Audit 11: name the requested output on a write failure

The seam is `src/cli.ts`: the report write (`694-696`), the two `--ci-out`
writes (`668-670` and `736-738`) and the top-level catch (`756-759`).
`writeAtomic` already removes its temp file, but the raw Node error names the
random `.<name>.<uuid>.tmp` path.

Add two small local wrappers around `writeAtomic`, matching the existing email,
PDF and history writers:

```ts
async function writeReport(file: string, html: string): Promise<void> {
  try {
    await writeAtomic(file, html);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new Error(
      `Cannot write report to ${oneLine(file)}${code ? ` (${code})` : ''}`,
    );
  }
}
```

The CI wrapper uses `Cannot write CI output to <target>`. Both `--ci-out` call
sites use it. The target passes through `oneLine`, the top-level catch keeps
exit code 1, and `writeAtomic` keeps no partial file. A report failure leaves
no other output; a CI-out failure keeps the already written report and skips
the later stdout.

### Audit 12: reuse the legacy feature-shape predicate

The seam is `isFeatureLike` in `src/input/detect.ts:29-35` and the compat
pre-check in `src/compat/options.ts:178-187`. The compat pre-check accepts any
JSON array, then `src/compat/cucumber-html-reporter.ts:42-57` accepts any array
of objects; `planSidecar` later rejects non-object elements but merges
non-feature objects.

Export the existing `isFeatureLike` predicate from `detect.ts` and use it in
both compat points:

- `options.ts` pre-check: `Array.isArray(parsed) && parsed.every(isFeatureLike)`;
  otherwise throw `not a feature array` and let the existing skipped-file
  warning record the file when `ignoreBadJsonFile` is true.
- `readFeatures` in the sidecar planner: the same predicate, so a non-feature
  array is `undefined` and `planSidecar` throws the existing
  `compat: <file> is not a legacy feature array` when the flag is false.

`[1,2,3]` and an array of non-feature objects are both skipped with a warning
when the flag is true. With the flag false both fail generation; this makes the
non-feature-object case fail instead of being merged, which is the same
predicate rule the core loader already applies. The reserved-sidecar rule is
unchanged: an invalid reserved-path file may be skipped and replaced when the
flag is true.

## Data flow

```
input paths
  → resolveInputFiles (stat-only list, deduped paths, early 50 MiB warning)
  → loadResolvedInputs
      per-file 100 MB guard
      read + SHA-256
      duplicate content → continue
      detectInput → skip (unrelated file / empty shard) → continue
      total 100 MB guard over unique loaded bytes
      adapter (legacy, Messages, JUnit, Playwright)
  → envelopes
  → indexRun
  → buildReportModel + summarizeIndex (shared rendered-attachment selector)
  → renderHtml / summary / CI text / email / PDF
  → CLI write wrappers (report, PDF, email, history, --ci-out)
```

The 50 MiB early warning still measures resolved paths; the total cap and
`inputFiles`/`inputBytes` measure loaded groups. History keeps its own path:
sidecar → `readSidecar` (regular-file check, 1 MiB cap, bounded read, one-BOM
strip) → shared document/run parser → returned runs; the writer uses the same
parser with the `Cannot write` prefix, serialises without a BOM and writes
atomically.

No new module and no new dependency is added. The only shared extraction is the
attachment selector in `src/report/index-run.ts` and the history parser in
`src/history.ts`; both already own the data they expose.

## Hard parts and risks

- **Per-file guard versus total cap.** The 100 MB per-file guard must still run
  before the read, while the total cap moves after dedupe and skip. Do not
  reuse the old `addInputBytes(totalBytes, size)` call for both: a 101 MB
  unrelated file should fail the per-file guard, but a skipped 51 MB file
  should not consume the total. Cover the boundary on both sides. A content
  skip needs the read, so a directory of many large skipped files spends read
  time with no aggregate cap beyond the per-file guard; the 50 MiB warning stays
  advisory. The compat shim keeps its own pre-read byte accounting; that is a
  separate call site, not part of this loader rule.
- **Group and accounting order.** `inputFiles`/`inputBytes` follow groups, not
  attempts to load. A validation-only group with no envelopes still counts; a
  `skip`, a duplicate and an empty shard do not. Check the Details input row
  and the report-size warning's `input` value as well as the loader return.
- **Reader/writer shared parse with different prefixes.** `readHistory` must
  keep `Invalid history file`, `writeHistory` must keep
  `Cannot write history file`. A shared parser takes the reject function; do
  not let one prefix leak into the other. The target must stay byte-identical
  after a rejection.
- **Summary rendered-step-id set.** The summary must mirror the model's step
  filter, including a step that is neither a pickle step nor a hook and a
  run-hook start that is absent from the stream. Count distinct attachments,
  not envelopes; bytes follow the same set. Do not change the summary schema.
- **Zero-timestamp guard.** The guard belongs in the model, not in the
  Playwright adapter, so the adapter's zero fallback stays. A real non-zero
  timestamp must keep rendering the existing date; a zero timestamp must
  produce no date on `testRunStarted`, `testRunFinished` and the scenario
  `startedAt`.
- **CI code-point truncation.** Truncate the original text before escaping or
  code-span wrapping, so the `[truncated]` marker stays readable. Keep the
  marker outside the 200 and never split a surrogate pair. Do not change the
  Azure 4000-code-point message limit, the failure-message limits or the 50/20
  list limits.
- **Compat predicate export.** `isFeatureLike` must stay the one predicate
  `detectInput` uses; do not grow a second shape check in compat. With the flag
  false, an array of non-feature objects now fails instead of being merged.
  That is the intended same-predicate outcome and needs a test.
- **Write wrappers.** Both `--ci-out` call sites and the report write must use
  the wrappers. Keep `oneLine`, keep the Node code suffix when present, and
  never include the atomic temp name. A CI failure must not turn into a
  successful exit or print the human confirmation.
- **Path trust model.** B-058 is documentation only. Do not add a root option,
  allowlist, warning or new path check in this change. The docs must state that
  the report input controls the path and that any regular file under either
  root can be embedded.
- **Re-pin scope.** The nine characterization hashes, the two-run history hash
  and the two golden HTML files are re-pinned only for the recorded diffs. All
  nine hashes change for the B-048/B-039 shell; the three Messages fixtures with
  a zero run timestamp (`all-statuses`, `empty-statuses`, `examples-tables`)
  also lose their 1970 run date. The two legacy fixtures are re-pinned here for
  the shell with their pinned 2026 date, and again in `0.6.1-hardening` when the
  invented legacy date disappears. No Playwright fixture output changes. Any
  other changed expected value is a defect, not a re-pin.
- **Compat report write.** Audit 11 covers the CLI `--out` and `--ci-out` writes
  only. The compat shim's own `writeAtomic` report write keeps its current error
  path; no wrapper is added there in this patch.
- **Outline helper stays.** The duplicated outline-coordinate helper in
  `src/summary.ts` and `src/report/model.ts` is B-051 structure work; this patch
  touches both files but does not extract it, so no refactor is bundled with a
  behaviour change.

## Tests

- **B-048 unit**: a default report with no history has exactly one `<main>`
  inside `#report-view`; `#analysis-view` has no `<main>` and keeps its class,
  role, label, ID and `hidden`; no `#trends-view`; two tabs. A default report
  with two history runs has one `<main>`, three tabpanels and the three IDs. A
  static report still has one `<main>` and no tab roles. Assert heading order
  and the `#analysis-view, #trends-view` print rule.
- **B-048 browser**: one `main` role at 320, 390, 768, 1024 and 1440 px and at
  320 px / 200 % text; no horizontal overflow; Details and Trends panels keep
  their bounding boxes; save visual captures for CMP.
- **B-039 unit**: the narrow container rule is present in `REPORT_CSS` with one
  column and start-aligned values; the German override is present in the locale
  string; the base 2fr/3fr rule at 100 % is untouched; `styles.ts` is
  regenerated, not hand-edited.
- **B-039 browser**: with a long metadata URL in Details, 320 px / 200 % yields
  one computed track, `text-align: start`, a wrapped link and no horizontal
  overflow; 320 px / 100 % and 390 px / 100 % keep two tracks and
  `text-align: right`; 768, 1024 and 1440 px are unchanged; the German boundary
  case passes.
- **B-049 unit in `test/history.test.ts`**: valid no-BOM file (regression), one
  BOM plus valid JSON, BOM-only, BOM plus invalid JSON, two leading BOMs, and
  byte equality after every read. The schema peek accepts a BOM-prefixed
  target. An append to a BOM-prefixed sidecar succeeds and writes the same
  bytes as the same append without the BOM, with no run lost. A writer test
  pins no BOM in the output and unchanged schema/validation. Existing error
  text is asserted, not loosened.
- **Audit 2, `test/inputs.test.ts`** with directory and duplicate fixtures:
  a directory with a report plus `package.json` and `tsconfig.json` returns one
  input file and the report bytes; two identical large reports load once; two
  different reports over the total cap fail with the new text; a skipped large
  file does not count; a single file over the per-file guard fails before its
  content is parsed. ISTQB: equivalence classes for loaded/skip/duplicate,
  boundary at 100 MB and 100 MB + 1 byte, decision table for the load order,
  state transition from duplicate to loaded.
- **Audit 3, `test/history.test.ts`**: a schema-1 target with `runs` not an
  array and a schema-2 target with one bad entry both reject with
  `Cannot write history file`, leave the bytes and mtime unchanged and create
  no temp file; a missing target writes schema 1; a valid target keeps its
  schema and gains the appended run. Cross-check the CLI read-first path in
  `test/cli-history.test.ts`.
- **Audit 4, `test/input-detect.test.ts` and `test/inputs.test.ts`**: the
  decision table covers non-explicit empty, BOM-only, whitespace-only,
  non-empty invalid and explicit empty; a directory with one empty shard plus a
  valid report succeeds with no warning and `inputFiles: 1`; an explicit empty
  file fails with `Input is empty`; an empty-only directory fails with
  `No supported report files found.`
- **Audit 5, `test/model-summary-cross-check.test.ts` and
  `test/summary.test.ts`**: an orphan `testStepId` gives 0 in the scenario and
  0 in the run total; a missing run-hook start gives 0/0; a normal step
  attachment gives 1/1; a present run hook and a run-level attachment each count
  once. Cross-check `model.counts.attachments`, the summary total, the summary
  scenario count and the Details count against the screenshot fixture; render
  `test/fixtures/messages/screenshot.ndjson` and assert the image is present.
- **Audit 6, `test/playwright.test.ts`, `test/model.test.ts`,
  `test/summary.test.ts`, `test/model-summary-cross-check.test.ts` and
  `test/render-report.test.ts`**: a retried report with omitted `retry` values
  and a report with equal `retry` values render the last result; distinct
  retries still pick the highest; two starts with the same attempt and empty
  timestamps select the later start and show its passed result in model, summary
  and HTML; a report with no `stats.startTime` and no result time omits the
  date; a real timestamp keeps the existing date. New fixtures:
  `test/fixtures/playwright/no-retry.json`,
  `test/fixtures/playwright/equal-retry.json` and
  `test/fixtures/playwright/no-timing.json`.
- **Audit 7, `test/playwright.test.ts`**: expected-skip plus a failed result
  renders failed with the error; expected-skip plus a passed result renders an
  unexpected pass (failed) with the marker; the existing skipped and
  skipped-without-results cases stay skipped. Cross-check the summary status,
  the HTML row and the history status. New fixtures:
  `test/fixtures/playwright/expected-skip-failed.json` and
  `test/fixtures/playwright/expected-skip-passed.json`.
- **Audit 8, `test/playwright.test.ts` and
  `test/playwright-source-line.test.ts`**: a suite file with a spec that omits
  `file` produces the suite URI and rule name; with no project, the feature
  name follows the suite file; with a project, the project stays the feature
  name; an explicit spec file still wins. New fixture:
  `test/fixtures/playwright/inherited-file.json`.
- **Audit 9, `test/inputs.test.ts` or `test/messages-producers.test.ts`**:
  `1e309`, a string, a negative value and a non-integer each fail with the
  line, file and `testCaseStarted.attempt` field; an absent attempt is 0 in the
  model and summary and `--json` contains no `null`; a valid attempt 2 is 2 in
  both. ISTQB: equivalence classes for number/string/absent, boundary at
  `Number.MAX_SAFE_INTEGER` and `MAX_SAFE_INTEGER + 1`, decision table for the
  validation.
- **Audit 10, `test/ci.test.ts` and `test/cli-ci.test.ts`**: GitHub title and
  Markdown heading/name/URI/title cap at 200 code points with the marker; 200
  code points are unchanged; 201 are cut; a 200-code-point name ending in a
  surrogate pair is not split. Counts and the failure-message/list limits stay
  unchanged; Azure output is unchanged.
- **Audit 11, `test/cli-edge.test.ts` and `test/cli-ci.test.ts`**: a directory
  target for `--out` and `--ci-out` exits 1 with the requested target in the
  message, no `.tmp` and no UUID; a permission failure does the same; a failed
  report write leaves no partial file; a failed CI write keeps the report and
  skips stdout.
- **Audit 12, `test/compat.test.ts` and `test/compat-sidecar.test.ts`**:
  `[1,2,3]` and an array of non-feature objects are skipped with the existing
  warning while a valid report renders when the flag is true; the same files
  fail with the compat legacy-array error when the flag is false; a valid
  feature array still merges.
- **Characterization/goldens**: re-pin the nine default characterization
  hashes, the two-run history hash and the two golden HTML files
  (`minimal.html`, `attachments-presentation.html`). Inspect the diff for the
  two `<main>` → `<div>` replacements, their closing tags, the narrow CSS string
  and removed epoch dates only; no other change is allowed. The three Messages
  fixtures with a zero run timestamp also lose their 1970 run date. The client
  bundle budget stays under 16 KB. No existing Playwright fixture is re-pinned:
  every current fixture has `stats.startTime`, distinct retry values and a spec
  `file`, so the audit rules do not change their output. The two legacy
  fixtures are re-pinned here for the shell with their pinned 2026 date, and
  again in `0.6.1-hardening` for the removed date.

**Visual evidence (B-054, test-only).** One e2e test renders the default and the
`--static` report from `test/fixtures/messages/screenshot.ndjson` and writes
viewport captures to `test-results/visual/<engine>/`: 1440 px and 390 px for
both forms, plus 320 px at 200 % text for both forms. Six PNGs per engine per
run land in the existing `playwright-visual-*` artifacts; the engine folder
keeps the three parallel projects from overwriting each other. Each form
asserts its title before capture; the captures are never compared, so there is
no baseline, no committed image and no new dependency. The existing
`visual.spec.ts` captures stay as they are. B-054 is test work only and changes
no report behaviour, so it adds no requirement delta.

## ADRs

- [ADR 0005](../../../docs/adr/0005-server-rendered-shell.md): the shell is
  server-rendered; one main landmark is part of the shell contract.
- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md): no new
  dependency; the reader strip, the write wrappers and the cap are built-ins.
- [ADR 0004](../../../docs/adr/0004-normalize-to-messages.md): both input
  formats normalise to one Messages model, so the summary and the report must
  agree on the rendered attachment set and the attempt value.

## Open questions

1. **Final contract approval.** The user approves this proposal, the five spec
   deltas and this design, including the characterization and golden re-pin
   (shell, narrow metadata rule and removed epoch dates) and the docs-only path
   trust-model wording. No new product question is opened by the audit fixes.
