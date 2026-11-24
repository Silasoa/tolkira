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

### Requirement: Make the history window configurable

The CLI SHALL accept `--history-limit <n>` only with `--history`. `n` SHALL be a
decimal integer from 1 to 365; the default SHALL be 30. The limit SHALL bound
the runs read, appended, written and rendered in Trends. An invalid value SHALL
exit 2 naming the range; without `--history` it SHALL exit 2 naming both
options. Without the flag the 30-run behaviour SHALL be unchanged.

#### Scenario: Smaller window

- **WHEN** `--history-limit 5` is used with a sidecar that holds seven runs
- **THEN** the newest five runs are read, written and rendered in Trends
- **AND** the report is generated normally
- **AND** the process exits 0

#### Scenario: Larger window

- **WHEN** `--history-limit 40` is used with a sidecar that holds 40 runs and a
  new current run
- **THEN** the current run is appended and the newest 40 of the 41 runs are kept
- **AND** all 40 kept runs are rendered in Trends
- **AND** the file does not grow past 40 runs

#### Scenario: One run

- **WHEN** `--history-limit 1` is used
- **THEN** the sidecar keeps one run
- **AND** no Trends tab is rendered

#### Scenario: Default

- **WHEN** `--history` is used without `--history-limit`
- **THEN** the window is 30
- **AND** the CI bytes match the previous release
- **AND** the report differs from the previous release only by the 170 B
  measured scroll-offset script and, with two or more history runs, the
  documented Trends shell CSS
- **AND** the email matches except its generated timestamp
- **AND** the JSON matches apart from the additive outline `example` field,
  which is owned by the baseline change

#### Scenario: Invalid value

- **WHEN** `--history-limit` is `0`, `366`, `1.5`, `abc`, `05` or empty
- **THEN** the CLI exits 2 and names the range 1 to 365
- **AND** no report or sidecar is written

#### Scenario: Missing history option

- **WHEN** `--history-limit 10` is used without `--history`
- **THEN** the CLI exits 2 and names both options
- **AND** nothing is written

#### Scenario: Missing HTML

- **WHEN** `--history --history-limit 10` is used without `--out`
- **THEN** the existing `--history` requires `--out` error exits 2
- **AND** nothing is written

#### Scenario: Help lists the option

- **WHEN** `--help` is requested
- **THEN** the usage text lists `--history-limit <n>`
