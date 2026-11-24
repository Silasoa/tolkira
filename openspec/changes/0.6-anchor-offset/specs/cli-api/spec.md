## MODIFIED Requirements

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
- **AND** the HTML is byte-identical to before the change apart from the
  measured scroll-offset script
- **AND** the only JSON delta is the additive outline `example`

#### Scenario: Nested baseline block

- **WHEN** the baseline file contains its own `baseline` block
- **THEN** the run succeeds
- **AND** the nested block is ignored

### Requirement: Keep the scan cheap and the limits unchanged

The scan SHALL read no file content, SHALL use the one resolved file list that
the loader also receives, and SHALL count each resolved path once. It SHALL add
no option, dependency or network request. The 100 MB input cap and the
post-render report-size warning SHALL stay, and both warnings MAY appear in one
run. The early total and the report-size warning's `input` value measure
different sets (resolved file sizes versus content-deduped loader bytes) and MAY
differ.

#### Scenario: Stat-only scan

- **WHEN** the scan reads a large file whose content cannot be read
- **THEN** it reports the file size without a content read
- **AND** no parse or render is started by the scan

#### Scenario: Repeated path

- **WHEN** the same input path is passed twice
- **THEN** the scan counts it once
- **AND** the loader still reads it once

#### Scenario: Hard cap

- **WHEN** the resolved inputs exceed 100 MB
- **THEN** the existing input-cap error exits 1
- **AND** the early input warning does not replace that message

#### Scenario: Both warnings

- **WHEN** a large input also produces a report above `--max-size`
- **THEN** the early input warning and the report-size warning both appear
- **AND** the two totals may differ because they measure different sets
- **AND** the report is still written

#### Scenario: No new surface

- **WHEN** the change is complete
- **THEN** no new CLI option or dependency exists
- **AND** the scan changes no report, JSON, CI, email or history byte
