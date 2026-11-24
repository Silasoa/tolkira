# Spec Delta

## ADDED Requirements

### Requirement: Count only loaded report files

`inputFiles` and `inputBytes` SHALL count only files for which the loader
creates a group. A `skip` decision, a skipped empty Messages shard and duplicate
content SHALL NOT count. A supported file that creates a group, including a
validation-only group with no envelopes, SHALL count once with its size. The
per-file 100 MB guard SHALL run before the read; the total cap SHALL apply to
unique loaded content after dedupe and skip.

#### Scenario: Directory with unrelated JSON files

- **WHEN** a directory contains one supported report, `package.json` and
  `tsconfig.json`
- **THEN** the run succeeds
- **AND** `inputFiles` is 1
- **AND** `inputBytes` is the report file's size
- **AND** the Details input row names one file

#### Scenario: Duplicate content under two paths

- **WHEN** two resolved paths contain byte-identical report content
- **THEN** the run succeeds
- **AND** `inputFiles` is 1
- **AND** `inputBytes` counts the content once

#### Scenario: Skipped files do not count toward the cap

- **WHEN** a directory contains a valid report and large unrelated JSON files
  that the loader skips
- **THEN** the run succeeds
- **AND** the skipped files are absent from `inputFiles` and `inputBytes`
- **AND** their bytes do not count toward the 100 MB total cap

#### Scenario: Only skipped files

- **WHEN** a directory contains only files that the loader skips
- **THEN** generation fails with `No supported report files found.`
- **AND** no report is written

### Requirement: Skip an empty Messages shard in a directory scan

A directory scan SHALL skip a `.jsonl` or `.ndjson` file with zero non-empty
lines after an optional BOM and whitespace trimming, without a loader group,
input count or warning. An explicitly named empty file SHALL still fail with
`Input is empty: <file>`. A directory with only empty shards SHALL fail with
`No supported report files found.` A non-empty malformed shard SHALL still fail
with its existing parse error. No new option SHALL be added.

#### Scenario: Empty shard plus a valid report

- **WHEN** a directory contains one empty `.ndjson` shard and one valid report
- **THEN** generation succeeds
- **AND** the report includes the valid report
- **AND** the empty shard contributes no scenario, feature, input count or
  warning

#### Scenario: Explicit empty file

- **WHEN** an empty `.jsonl` or `.ndjson` file is named explicitly
- **THEN** generation fails with `Input is empty: <file>`
- **AND** no report is written

#### Scenario: Whitespace or BOM-only shard

- **WHEN** a scanned shard contains only whitespace, only a UTF-8 BOM or a BOM
  followed by whitespace
- **THEN** the shard is skipped without a group, count or warning

#### Scenario: Empty-only directory

- **WHEN** every Messages file in a directory is empty and the directory has no
  other usable input
- **THEN** generation fails with `No supported report files found.`
- **AND** no report is written

#### Scenario: Malformed non-empty shard

- **WHEN** a scanned shard contains a non-empty line that is not a valid
  Cucumber Messages envelope
- **THEN** generation fails with the existing line-specific Messages error
- **AND** the shard is not skipped as empty

### Requirement: Validate the Messages attempt

`testCaseStarted.attempt` SHALL be optional. When present, it SHALL be a
non-negative safe integer. A value that is not a number, not finite, not a safe
integer or negative SHALL be rejected with the existing Messages line-error
style naming the file, line and `testCaseStarted.attempt`. An absent attempt
SHALL be treated as 0. The summary and report model SHALL agree, and the JSON
summary SHALL never contain `null` for `attempt`.

#### Scenario: Non-finite attempt

- **WHEN** a `testCaseStarted` line carries `"attempt": 1e309`
- **THEN** generation fails with an error naming the file, line and
  `testCaseStarted.attempt`
- **AND** no report is written

#### Scenario: String attempt

- **WHEN** `attempt` is a string
- **THEN** generation fails with the same line-error style
- **AND** no report is written

#### Scenario: Negative attempt

- **WHEN** `attempt` is a negative number
- **THEN** generation fails with the same line-error style
- **AND** no report is written

#### Scenario: Fractional attempt

- **WHEN** `attempt` is not an integer
- **THEN** generation fails with the same line-error style
- **AND** no report is written

#### Scenario: Absent attempt

- **WHEN** `testCaseStarted` omits `attempt`
- **THEN** the summary and model use 0
- **AND** `--json` contains the number 0, never `null`

#### Scenario: Valid attempt

- **WHEN** `attempt` is 2
- **THEN** the summary and model use 2
- **AND** `--json` contains the number 2

## MODIFIED Requirements

### Requirement: Preserve retries and final status

The adapter SHALL use the last Playwright result as the rendered attempt and
SHALL expose the retry index. A flaky test that passed on retry SHALL render as
passed with a retry attempt; a test that never passed SHALL render as failed.
When `retry` values are missing or equal, the last result in array order SHALL
win; with distinct retry values the highest retry SHALL win. A test SHALL be
skipped only when its final result is skipped, or when it is marked skipped and
has no result. A failed or passed final result SHALL win over a skip marker: an
expected skip with a failed result SHALL render failed, and an expected skip
with a passed result SHALL render as an unexpected pass (failed). An expected
skip SHALL NOT take the expected-failure branch.

#### Scenario: Flaky test passed on retry

- **WHEN** the first result failed and the second result passed
- **THEN** the scenario is passed
- **AND** its attempt is the second attempt
- **AND** it is marked as flaky

#### Scenario: Failed after retries

- **WHEN** every result failed, timed out or was interrupted
- **THEN** the scenario is failed
- **AND** the last error is visible

#### Scenario: Skipped test

- **WHEN** a test has skipped status and no executed steps
- **THEN** the scenario is skipped
- **AND** it does not count as passed

#### Scenario: Skipped test without results

- **WHEN** a test is marked skipped and has no results
- **THEN** the scenario remains visible as skipped
- **AND** it is not treated as an unknown unexecuted test

#### Scenario: Expected failure

- **WHEN** a test is marked as an expected failure and its final result
  failed, timed out or was interrupted
- **THEN** the scenario is not counted as a regression
- **AND** it is marked as an expected failure

#### Scenario: Unexpected pass

- **WHEN** a test is expected to fail but its final result passed
- **THEN** the scenario is failed
- **AND** the unexpected pass is marked in the report

#### Scenario: No results

- **WHEN** a non-skipped test has no results
- **THEN** the scenario remains visible as unexecuted
- **AND** it is not rendered as passed or skipped

#### Scenario: Missing retry values

- **WHEN** the first result failed and the second result passed, and neither
  result carries a `retry` value
- **THEN** the scenario is passed
- **AND** the rendered result is the second array element
- **AND** the first failure is not the final status

#### Scenario: Equal retry values

- **WHEN** the first result failed and the second result passed with the same
  `retry` value
- **THEN** the scenario is passed
- **AND** the rendered result is the second array element
- **AND** the first failure is not the final status

#### Scenario: Expected skip with a failed result

- **WHEN** `expectedStatus` is `skipped` and the final result failed
- **THEN** the scenario is failed
- **AND** the failure and its error are visible
- **AND** the scenario is not counted as skipped

#### Scenario: Expected skip with a passed result

- **WHEN** `expectedStatus` is `skipped` and the final result passed
- **THEN** the scenario is failed as an unexpected pass
- **AND** the unexpected pass is marked in the report
- **AND** it is not counted as passed or skipped

### Requirement: Map Playwright hierarchy and projects

The adapter SHALL preserve the Playwright project, file and describe context.
A project SHALL become the feature grouping; the file and describe path SHALL
become the rule; a spec SHALL become a scenario. A spec run in several
projects SHALL produce one scenario per project. When a spec omits `file`, the
scenario URI and rule name SHALL use the enclosing suite's file, so the
scenario URI, rule name and feature name agree. An explicit spec `file` SHALL
win.

#### Scenario: Projects are distinct

- **WHEN** one spec ran in projects `chromium` and `firefox`
- **THEN** the report contains a scenario for each project
- **AND** the project names are visible in the feature grouping

#### Scenario: One project with several files

- **WHEN** two files run in the same project
- **THEN** they share the project feature
- **AND** their rules keep the file path

#### Scenario: Nested describes are preserved

- **WHEN** a spec is nested under several `test.describe` suites
- **THEN** the describe titles appear in the rule path
- **AND** trailing `@tag` tokens are removed from the scenario and rule names

#### Scenario: Scenario order is deterministic

- **WHEN** tests with and without path attachments share a suite
- **THEN** model and generated ids follow the source order
- **AND** attachment I/O cannot reorder scenarios
- **AND** rendering the same input twice yields identical HTML

#### Scenario: Tags and annotations survive

- **WHEN** a spec has Playwright tags or test annotations
- **THEN** the tags are normalised to `@tag` and available to search and filters
- **AND** annotation type and description are visible in the scenario description

#### Scenario: Spec without a file inherits the suite file

- **WHEN** a suite carries `file: "a.spec.ts"` and one of its specs omits
  `file`
- **THEN** the scenario URI is `a.spec.ts`
- **AND** the rule name contains `a.spec.ts`
- **AND** the feature name is `a.spec.ts`
- **AND** `playwright.spec.ts` does not appear
