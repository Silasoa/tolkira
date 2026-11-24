# Spec Delta

## ADDED Requirements

### Requirement: Read an explicit baseline summary

The CLI SHALL accept `--baseline <file>` as a read-only schema-2 summary and
SHALL require `--out`, `--pdf`, `--json` or `--ci markdown`. A colliding path
SHALL exit 2; a missing, unreadable, non-regular, oversized, invalid or
wrong-schema baseline SHALL exit 1, writing nothing.

#### Scenario: Baseline with a report

- **WHEN** `--out report.html --baseline previous.json` is used with a valid
  schema-2 baseline
- **THEN** the report contains the comparison panel
- **AND** the baseline file's bytes and modification time are unchanged

#### Scenario: Static report with a baseline

- **WHEN** `--static --baseline previous.json --out report.html` is used with a
  valid schema-2 baseline
- **THEN** the process exits 0
- **AND** the report is the static form
- **AND** the baseline comparison panel is visible without JavaScript
- **AND** the document has one `<main>` and no `<script>`

#### Scenario: Missing baseline

- **WHEN** `--baseline missing.json` is used
- **THEN** the CLI exits 1 and names the file
- **AND** no report, JSON, CI text or email is written

#### Scenario: Wrong schema

- **WHEN** the baseline is a history sidecar (any schema version) or any version
  other than 2
- **THEN** the CLI exits 1 and names the supported version
- **AND** no output is written

#### Scenario: Baseline surface required

- **WHEN** `--baseline previous.json` is used with only `--email`, or with only
  `--ci github` or `--ci azure`
- **THEN** the CLI exits 2 and names the surfaces that show the comparison
- **AND** nothing is written

#### Scenario: Baseline path collision

- **WHEN** `--baseline` names an input, the logo, `--out`, `--pdf`, `--email`,
  `--history`, `--ci-out`, or a path inside an input directory, even when the
  baseline file does not exist
- **THEN** the CLI exits 2 and writes nothing

#### Scenario: Oversized or non-regular baseline

- **WHEN** the baseline is larger than 10,485,760 bytes, a directory, a symlink
  to a directory or another non-regular file
- **THEN** the CLI exits 1 and names the file and the limit
- **AND** a summary larger than 10 MiB cannot be a baseline
- **AND** no output is written

#### Scenario: BOM and `..` URI

- **WHEN** the baseline starts with a UTF-8 BOM or carries a `..` segment in a
  scenario URI
- **THEN** the BOM is stripped before parsing
- **AND** the `..` segment is passed through the display-URI rule, never
  resolved against the file system

#### Scenario: Help lists the option

- **WHEN** `--help` is requested
- **THEN** the usage text lists `--baseline <file>`

### Requirement: Reject hostile baseline shapes

The reader SHALL reject a non-object scenario entry, a missing required field, a
missing `executed`, a wrong field type, an unknown status, a value nested deeper
than 64 levels and a `__proto__`, `constructor` or `prototype` own key on the
document or a scenario entry with exit 1 and no write.

#### Scenario: Hostile invalid shapes

- **WHEN** the baseline has a non-object scenario entry, a missing required
  field, a missing `executed`, a wrong field type, an unknown status or a value
  nested deeper than 64 levels
- **THEN** the CLI exits 1 and names the file and the reason
- **AND** nothing is written

#### Scenario: Prototype keys

- **WHEN** the baseline has a `__proto__`, `constructor` or `prototype` own key
  on the document or a scenario entry
- **THEN** the CLI exits 1 and names the file
- **AND** nothing is written
- **AND** `Object.prototype` is unchanged

#### Scenario: Symlink to a regular file

- **WHEN** the baseline path is a symlink to a regular file
- **THEN** the reader reads the target file
- **AND** the comparison succeeds

### Requirement: Match baseline scenarios by stable identity

The comparison SHALL group by feature name + scenario name, match a unique base
key, then pair a repeated group in two passes: by the example coordinate when
every row on both sides carries it, then by display URI when exactly one
genuinely unmatched row on each side carries it. Any remaining unpaired row
SHALL make the whole group ambiguous and count it once. No pickle id, position,
line, tags, step text, status or order SHALL be used.

#### Scenario: Reordered run

- **WHEN** the current run has the same scenarios in a different order
- **THEN** every scenario matches its baseline row
- **AND** the new-failure, fixed and still-failing counts are all zero

#### Scenario: Renamed feature file

- **WHEN** a `*.feature` file is renamed but the feature and scenario names are
  unchanged and the base key is unique
- **THEN** its scenarios match their baseline rows
- **AND** none is reported as new or not in this run

#### Scenario: Renamed scenario

- **WHEN** a scenario name changes
- **THEN** the baseline row is reported as not in this run
- **AND** the current row is reported as a new failure or added
- **AND** no row is reported as modified

#### Scenario: Repeated name in a renamed file

- **WHEN** a repeated non-outline name appears in a renamed `*.feature` file
- **THEN** the URI no longer matches and the group is ambiguous
- **AND** no row in it is reported as new, fixed or not in this run

#### Scenario: Outline examples

- **WHEN** two outline rows share a feature and scenario name but carry
  different example coordinates
- **THEN** each current row matches its baseline row by coordinate
- **AND** no row is ambiguous

#### Scenario: 0.5 baseline with repeated names

- **WHEN** a 0.5 baseline without `example` has repeated names in different
  display URIs
- **THEN** each row pairs by URI
- **AND** repeated names in the same URI make the group ambiguous instead of
  pairing by order

#### Scenario: Ambiguous duplicate names

- **WHEN** a base-key group has repeated names without usable coordinates or
  unique URIs on both sides
- **THEN** the whole group is excluded from the tracked counts
- **AND** none of its baseline rows is listed as not in this run
- **AND** `ambiguous` counts the group once
- **AND** no row is paired by order or status

### Requirement: Classify matched pairs

The comparison SHALL classify each matched pair by the table, with F = failing
(`failed`, `undefined`, `ambiguous`), P = passing (`passed`), O = other
(`skipped`, `pending`, `unknown`) and U = unexecuted:

| Baseline | Current | Class |
| --- | --- | --- |
| F | F | still failing |
| F | P | fixed |
| F | O, U | `other` |
| P | F | new failure |
| P | P, O, U | `other` |
| O | F | new failure |
| O | P, O, U | `other` |
| U | F | new failure |
| U | P, O, U | `other` |

#### Scenario: Status classes

- **WHEN** a matched pair is classified
- **THEN** `failed`, `undefined` and `ambiguous` are failing
- **AND** `passed` is passing
- **AND** `skipped`, `pending` and `unknown` are other
- **AND** an unexecuted current row is unexecuted

#### Scenario: New failure

- **WHEN** a scenario passed, was unexecuted, or was another status in the
  baseline and fails now, or is absent from the baseline and fails now
- **THEN** it is counted once as a new failure
- **AND** it is not counted as added

#### Scenario: Fixed

- **WHEN** a scenario failed in the baseline and passes now
- **THEN** it is counted once as fixed

#### Scenario: Still failing

- **WHEN** a scenario failed in the baseline and still fails now
- **THEN** it is counted once as still failing

#### Scenario: No claim

- **WHEN** a scenario failed in the baseline and is skipped, pending, unknown or
  unexecuted now
- **THEN** it is counted once as `other`
- **AND** it is not counted as fixed, still failing or not in this run
- **AND** it has no per-scenario change

#### Scenario: Added

- **WHEN** an executed scenario is absent from the baseline and does not fail
- **THEN** it is counted as added
- **AND** it has no new-failure claim

#### Scenario: Not in this run

- **WHEN** a baseline scenario has no current match
- **THEN** it is counted as not in this run
- **AND** the report uses the wording "Not in this run"

#### Scenario: Unexecuted current row

- **WHEN** a baseline scenario has a current row that is present but unexecuted
- **THEN** it is not reported as not in this run
- **AND** it makes no status claim

### Requirement: Reconcile baseline counts

The comparison SHALL have one count set: `newFailures`, `fixed`,
`stillFailing`, `other`, `notInThisRun`, `added` and `ambiguous`. Every baseline
row outside an ambiguous group SHALL fall into exactly one of new failure, fixed,
still failing, `other` or not in this run; `added` counts current rows and
`ambiguous` counts groups.

#### Scenario: Unmatched current row

- **WHEN** a current row has no baseline match because its feature + name group
  has no baseline row at all
- **THEN** an executed failing row is a new failure
- **AND** an executed non-failing row is added
- **AND** an unexecuted row makes no claim and is not a baseline row
- **AND** a row in a repeated group that gains an extra current row is not
  unmatched; the whole group is ambiguous instead

#### Scenario: Count reconciliation

- **WHEN** the baseline has 10 rows outside ambiguous groups, with two new
  failures, one fixed, three still failing and one not in this run
- **THEN** `other` is 3
- **AND** `2 + 1 + 3 + 3 + 1` equals 10
- **AND** `added` and `ambiguous` are not part of that sum

### Requirement: Add the comparison to the JSON summary

With `--baseline`, the summary SHALL add a `baseline` object after `attachments`
and before `scenarios`, and a `change` field to each classified scenario. The
block SHALL carry the baseline status, seven counts and a capped `notInThisRun`
list; the counts stay complete. The schema stays 2 and no summary `id` field is
added. Without the flag there SHALL be no `baseline` or `change` key.

#### Scenario: Baseline block

- **WHEN** a run with a baseline is summarized
- **THEN** `schemaVersion` is 2
- **AND** `baseline.status` is the baseline overall status
- **AND** `baseline.counts` carries `newFailures`, `fixed`, `stillFailing`,
  `other`, `notInThisRun`, `added` and `ambiguous`
- **AND** every `notInThisRun` entry carries `feature`, `name`, `uri`, `status`,
  `executed` and optional `example`
- **AND** every classified scenario carries `change` after `executed`, with the
  value `new-failure`, `fixed`, `still-failing` or `added`
- **AND** unchanged, unexecuted and ambiguous rows carry no `change`
- **AND** no scenario or baseline entry carries an `id` field

#### Scenario: No baseline

- **WHEN** the same run is summarized without `--baseline`
- **THEN** no `baseline` or `change` key appears
- **AND** the Markdown CI bytes are identical to before the change
- **AND** the HTML is byte-identical to before the change
- **AND** the only JSON delta is the additive outline `example`

#### Scenario: Nested baseline block

- **WHEN** the baseline file contains its own `baseline` block
- **THEN** the run succeeds
- **AND** the nested block is ignored

### Requirement: Cap and sort the not-in-this-run list

The `notInThisRun` array SHALL be capped at 50 entries and sorted by feature,
then name, then the example coordinate (examples then example, numeric, rows
without `example` last), then URI. `counts.notInThisRun` SHALL stay complete.

#### Scenario: Not-in-this-run order

- **WHEN** the capped list contains `#1.2`, `#1.10`, a row without `example`,
  and rows from two features
- **THEN** rows are grouped by feature, then name
- **AND** within one feature and name, `#1.2` sorts before `#1.10`
- **AND** the row without `example` sorts after every row with an `example` in
  the same feature and name
- **AND** ties use URI

#### Scenario: Capped not-in-this-run list

- **WHEN** the baseline has 60 scenarios not in this run
- **THEN** `counts.notInThisRun` is 60
- **AND** the `notInThisRun` array has 50 entries
- **AND** the entries are sorted deterministically

### Requirement: Expose the outline example coordinate in the summary

Every summary row for a Messages scenario-outline example SHALL carry `example`
as `#<examples>.<example>` with 1-based numbers, matching the report label,
whether or not a baseline is supplied. A plain, legacy JSON or JUnit scenario
SHALL NOT carry it. The field is additive, stays schema 2 and appears after
`attempt`.

#### Scenario: Outline rows

- **WHEN** a Messages outline with two examples blocks is summarized
- **THEN** each example row carries its `example` coordinate
- **AND** the report and summary labels agree

#### Scenario: Non-outline row

- **WHEN** a plain scenario, a legacy JSON scenario or a JUnit scenario is
  summarized
- **THEN** it has no `example` key

#### Scenario: Old baseline

- **WHEN** a 0.5 baseline without `example` is compared
- **THEN** unique scenario names still match
- **AND** repeated names in different URIs pair by URI
- **AND** repeated names in the same URI become ambiguous instead of pairing by
  order

### Requirement: Expose the baseline comparison on the API

The package SHALL export the `BaselineSummary` type and a
`BaselineRenderOptions` type that extends `RenderReportOptions` with
`baseline?: BaselineSummary`. `generateReport`, `renderReport` and
`summarizeReport` SHALL accept `options.baseline` as that projection.
`renderHtml` and `CucumberHtmlStream` SHALL NOT accept a baseline in 0.6.0 and
SHALL keep `RenderReportOptions`/`RenderOptions`; the stream's
same-input-same-HTML contract is unchanged. The API SHALL accept the projection,
never a path.

#### Scenario: API projection

- **WHEN** `generateReport`, `renderReport` or `summarizeReport` receives a
  `BaselineSummary`
- **THEN** the output contains the comparison
- **AND** no file is read by the API

#### Scenario: Stream limit

- **WHEN** a caller passes a `baseline` to `CucumberHtmlStream` or the internal
  `renderHtml`
- **THEN** the option is not part of the accepted type
- **AND** the stream output stays the same for the same envelopes and options

#### Scenario: Type export

- **WHEN** a TypeScript caller imports from `tolkira`
- **THEN** `BaselineSummary` and `BaselineRenderOptions` are exported

### Requirement: Emit one Markdown baseline line

With `--baseline` and `--ci markdown`, the summary SHALL include one line after
the counts table's trailing blank line and before the empty-run and
zero-executed returns, followed by one blank line:
`Baseline: <n> new failure(s) · <n> fixed · <n> still failing · <n> not in this run`,
with all four counts including zeros, plus ` · <n> ambiguous group(s)` only when
positive. `added` SHALL NOT appear. Without the flag there SHALL be no line.

#### Scenario: Mixed counts

- **WHEN** the comparison has two new failures, one fixed, three still failing
  and one not in this run
- **THEN** the Markdown contains exactly
  `Baseline: 2 new failures · 1 fixed · 3 still failing · 1 not in this run`
- **AND** one blank line separates it from the next block

#### Scenario: Zero counts

- **WHEN** the comparison has no tracked changes
- **THEN** the line reads
  `Baseline: 0 new failures · 0 fixed · 0 still failing · 0 not in this run`

#### Scenario: Singular new failure

- **WHEN** the comparison has one new failure and no other tracked change
- **THEN** the line reads
  `Baseline: 1 new failure · 0 fixed · 0 still failing · 0 not in this run`

#### Scenario: Ambiguous groups

- **WHEN** the comparison has one ambiguous group
- **THEN** the line ends with ` · 1 ambiguous group`

#### Scenario: Empty or all-unexecuted run

- **WHEN** the current run is empty or has zero executed scenarios and a
  baseline is supplied
- **THEN** the baseline line appears before `No scenarios in this report.` or
  `0 executed scenarios; ...`

#### Scenario: No baseline

- **WHEN** `--ci markdown` runs without `--baseline`
- **THEN** no baseline line appears
- **AND** the Markdown bytes are unchanged

#### Scenario: Other CI formats

- **WHEN** `--ci github` or `--ci azure` runs with a baseline and another
  comparison surface
- **THEN** the annotation bytes are unchanged

### Requirement: Keep the baseline read-only and offline

The baseline SHALL be read once, never written, and SHALL add no network
request, telemetry or runtime dependency. The report and summary SHALL NOT embed
the baseline file path. The comparison SHALL be deterministic: the same inputs,
baseline and options SHALL produce byte-identical report, summary and CI text.

#### Scenario: Read-only

- **WHEN** a run reads a baseline
- **THEN** the file's bytes and modification time are unchanged
- **AND** no temporary or rewritten baseline file remains

#### Scenario: Offline and deterministic

- **WHEN** the same run is repeated
- **THEN** the report, JSON and CI text are byte-identical
- **AND** no network request is made
- **AND** no dependency is added
