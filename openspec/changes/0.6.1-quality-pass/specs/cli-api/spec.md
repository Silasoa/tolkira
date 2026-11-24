# Spec Delta

## ADDED Requirements

### Requirement: Accept a UTF-8 BOM before the history sidecar

Both `readHistory` and the schema peek used by `writeHistory` SHALL remove
exactly one leading U+FEFF from the bounded sidecar text before `JSON.parse`
and SHALL otherwise keep the existing validation and error text. The strip
SHALL live in the shared bounded read path. A read SHALL NOT rewrite the file.
`writeHistory` SHALL NOT emit a BOM, and its next successful write SHALL
replace a BOM-prefixed file with BOM-free bytes while keeping the runs the
append would otherwise keep.

#### Scenario: BOM-prefixed valid sidecar

- **WHEN** a valid history sidecar starts with one UTF-8 BOM
- **THEN** `readHistory` returns the documented runs
- **AND** the result equals the same file read without the BOM
- **AND** the file bytes and modification time are unchanged

#### Scenario: BOM-only file

- **WHEN** the sidecar contains only a UTF-8 BOM
- **THEN** `readHistory` rejects with
  `Invalid history file <file>: not valid JSON`
- **AND** the file is not rewritten

#### Scenario: BOM followed by invalid JSON

- **WHEN** the sidecar starts with one UTF-8 BOM and the rest is not valid JSON
- **THEN** `readHistory` rejects with the same `not valid JSON` error
- **AND** the file is not rewritten

#### Scenario: Two leading BOMs

- **WHEN** the sidecar starts with two U+FEFF characters followed by valid JSON
- **THEN** exactly one is stripped and the remaining U+FEFF is not valid JSON
- **AND** `readHistory` rejects with the same `not valid JSON` error
- **AND** the file is not rewritten

#### Scenario: Append to a BOM-prefixed sidecar

- **WHEN** a valid BOM-prefixed sidecar holds existing runs and a new run is
  written through the history append path
- **THEN** the schema peek accepts the file and keeps its stored schema version
- **AND** `readHistory` returns the documented runs
- **AND** the append and write succeed
- **AND** the rewritten file starts with `{` and contains no BOM
- **AND** its bytes equal the same append against the same sidecar without the
  BOM, so no run is lost

#### Scenario: No-BOM regression

- **WHEN** a valid sidecar has no BOM
- **THEN** `readHistory` returns exactly the runs it returned before this change
- **AND** the existing schema, size, regular-file and entry validation is
  unchanged

#### Scenario: Writer output is unchanged

- **WHEN** `writeHistory` writes a schema-1 or schema-2 sidecar
- **THEN** the file starts with `{` and contains no BOM
- **AND** the schema, validation, pruning and bytes are unchanged

### Requirement: Reject a malformed history target before writing

`writeHistory` SHALL validate an existing target with the reader's full
document and run rules before writing. A target with a supported schema but a
malformed `runs` value or entry SHALL be rejected with the existing
`Cannot write history file <file>: ...` prefix, and the target SHALL remain
byte-identical. A missing target SHALL still be written. A valid target SHALL
still be appended to and SHALL keep its schema. No partial file SHALL remain
after a rejection.

#### Scenario: Runs is not an array

- **WHEN** a schema-1 target contains `"runs": "not-an-array"` and
  `writeHistory` is called with a valid run
- **THEN** the call rejects with `Cannot write history file <file>: ...`
- **AND** the target bytes and modification time are unchanged
- **AND** no temporary file remains

#### Scenario: One bad run entry

- **WHEN** a schema-2 target contains one valid run and one entry that fails
  the reader's run rules
- **THEN** the call rejects with the `Cannot write history file` prefix and a
  reason naming the entry
- **AND** the target bytes are unchanged
- **AND** no temporary file remains

#### Scenario: Valid target appends

- **WHEN** a valid schema-1 target holds existing runs and a new run is written
  through the read-then-append path
- **THEN** the write succeeds
- **AND** the file keeps schema 1
- **AND** the existing runs and the new run are present

#### Scenario: Missing target writes

- **WHEN** the target does not exist
- **THEN** the write succeeds with schema 1 and the supplied runs
- **AND** no validation error is raised for the absent file

#### Scenario: Rejected target stays byte-identical

- **WHEN** a malformed supported-schema target is rejected
- **THEN** its bytes, size and modification time are unchanged
- **AND** the file bytes equal the pre-call bytes

### Requirement: Keep CI identity text bounded

GitHub annotation titles and Markdown headings and code spans SHALL cap the
original feature name, scenario name, URI and `--title` heading at 200 Unicode
code points and SHALL append the existing `[truncated]` marker when the text is
cut. The cap SHALL apply before escaping or code-span wrapping and SHALL NOT
split a surrogate pair. Counts, the full report, the failure-message limits,
the 50/20 list limits and the Azure annotation limits SHALL stay unchanged.

#### Scenario: GitHub title

- **WHEN** a failed scenario has a feature and name longer than 200 code points
- **THEN** the GitHub error title is built from at most 200 code points of the
  identity followed by `[truncated]`
- **AND** the annotation stays one escaped workflow command
- **AND** the exact failure count is unchanged

#### Scenario: Markdown heading, name and URI

- **WHEN** a failed scenario has a feature, name and URI longer than 200 code
  points and `--title` is also longer than 200 code points
- **THEN** the Markdown heading and each identity code span are built from at
  most 200 original code points followed by `[truncated]`
- **AND** the counts and the failure message limits are unchanged

#### Scenario: Exactly 200 code points

- **WHEN** a feature name, scenario name, URI or title has exactly 200 Unicode
  code points
- **THEN** the CI output contains the complete text
- **AND** no `[truncated]` marker is added

#### Scenario: 201 code points

- **WHEN** an identity has 201 Unicode code points
- **THEN** the CI output contains the first 200 code points followed by
  `[truncated]`

#### Scenario: Surrogate pair at the boundary

- **WHEN** the 200th code point is a surrogate pair
- **THEN** the pair is kept whole
- **AND** no lone surrogate appears in the output

### Requirement: Name the requested output on a write failure

A failed `--out` write SHALL report
`Cannot write report to <target> (<code>)`. A failed `--ci-out` write SHALL
report `Cannot write CI output to <target> (<code>)`. The target SHALL be
one-lined, and the Node error code SHALL be included when present. No `.tmp`
name and no UUID SHALL appear. The exit code SHALL stay 1, and no partial file
SHALL remain.

#### Scenario: Directory target

- **WHEN** `--out` names an existing directory
- **THEN** the CLI exits 1 and reports `Cannot write report to <target>` with
  the error code
- **AND** the message contains no `.tmp` name and no UUID
- **AND** no partial report remains

#### Scenario: Permission failure

- **WHEN** `--ci-out` cannot be written because the target is not writable
- **THEN** the CLI exits 1 and reports `Cannot write CI output to <target>` with
  the error code
- **AND** the already written report stays
- **AND** no partial CI file remains

#### Scenario: No temporary path

- **WHEN** a report or CI write fails
- **THEN** the error names the requested target
- **AND** it neither names the atomic temporary file nor contains a UUID

#### Scenario: Exit code and partial output

- **WHEN** a report or CI write fails
- **THEN** the process exits 1
- **AND** no partial file is left at the requested target
- **AND** a failed report write writes no later output

## MODIFIED Requirements

### Requirement: Keep the scan cheap and the limits unchanged

The scan SHALL read no file content, SHALL use the one resolved file list that
the loader also receives, and SHALL count each resolved path once. It SHALL add
no option, dependency or network request. The per-file 100 MB guard SHALL run
before the read. The total 100 MB cap SHALL apply to unique loaded content
after content dedupe and skip decisions, and its error SHALL read
`Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.`
The post-render report-size warning SHALL stay, and both the early warning and
the report-size warning MAY appear in one run. The early total and the
report-size warning's `input` value measure different sets (resolved file sizes
versus content-deduped loader bytes) and MAY differ.

#### Scenario: Stat-only scan

- **WHEN** the scan reads a large file whose content cannot be read
- **THEN** it reports the file size without a content read
- **AND** no parse or render is started by the scan

#### Scenario: Repeated path

- **WHEN** the same input path is passed twice
- **THEN** the scan counts it once
- **AND** the loader still reads it once

#### Scenario: Hard cap

- **WHEN** the unique loaded content exceeds 100 MB
- **THEN** the input-cap error exits 1 with
  `Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.`
- **AND** the early input warning does not replace that message

#### Scenario: Two identical large files

- **WHEN** two resolved files contain identical 51 MiB content and the unique
  content is below 100 MB
- **THEN** generation succeeds
- **AND** the content is loaded once
- **AND** the loader counts one input file and one copy of the bytes

#### Scenario: Skipped files do not count toward the cap

- **WHEN** a directory contains a valid report and two different 51 MiB files
  that the loader skips
- **THEN** generation succeeds
- **AND** neither skipped file counts toward the cap, `inputFiles` or
  `inputBytes`

#### Scenario: Single file over the cap before read

- **WHEN** one resolved file is larger than 100 MB, even when its content is
  malformed
- **THEN** generation fails with the input-cap error before the content is
  parsed
- **AND** no report is written

#### Scenario: Both warnings

- **WHEN** a large input also produces a report above `--max-size`
- **THEN** the early input warning and the report-size warning both appear
- **AND** the two totals may differ because they measure different sets
- **AND** the report is still written

#### Scenario: No new surface

- **WHEN** the change is complete
- **THEN** no new CLI option or dependency exists
- **AND** the scan changes no report, JSON, CI, email or history byte
