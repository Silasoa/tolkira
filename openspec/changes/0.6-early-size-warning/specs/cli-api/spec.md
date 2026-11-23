# Spec Delta

## ADDED Requirements

### Requirement: Warn before parsing about large inputs

The CLI SHALL, after option and path validation and before parsing or rendering,
resolve the input file list once, stat the resolved files, and write one stderr
warning when their total is at least 50 MiB (52,428,800 bytes). The same
resolved list SHALL go to the scan and the loader. The warning SHALL name the
total at one decimal and the 50 MB threshold, name no path, and change no exit
code or output byte.

#### Scenario: At the threshold

- **WHEN** a valid run resolves 50 MiB of input
- **THEN** stderr contains exactly one line
  `tolkira: warning: input files total 50.0 MB, at or above the 50 MB early-warning threshold; parsing and rendering may take a while.`
- **AND** the report or summary is produced normally
- **AND** the process exits 0

#### Scenario: Below the threshold

- **WHEN** the resolved inputs total 50 MiB minus one byte
- **THEN** no early-warning line is written

#### Scenario: Directory total

- **WHEN** a directory resolves several files whose sizes sum to at least
  50 MiB
- **THEN** the warning names the summed total at one decimal
- **AND** the scan and the loader receive the same resolved file list

#### Scenario: Malformed large input

- **WHEN** a 50 MiB input cannot be parsed
- **THEN** the early warning is written before the parse error
- **AND** the CLI exits 1 with the parse error
- **AND** no partial output remains

#### Scenario: JSON-only run

- **WHEN** `--json` is used with a large input and no report
- **THEN** stdout contains only the JSON summary
- **AND** the warning is on stderr

#### Scenario: Usage error

- **WHEN** the command has an invalid option or path
- **THEN** no early-warning line is written
- **AND** the CLI exits 2 with its usage error

### Requirement: Keep the scan cheap and the limits unchanged

The scan SHALL read no file content, SHALL use the one resolved file list that
the loader also receives, and SHALL count each resolved path once. It SHALL add
no option, dependency or network request. The 100 MB input cap and the post-render
report-size warning SHALL stay, and both warnings MAY appear in one run. The
early total and the report-size warning's `input` value measure different sets
(resolved file sizes versus content-deduped loader bytes) and MAY differ.

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
- **AND** the early warning does not replace that message

#### Scenario: Both warnings

- **WHEN** a large input also produces a report above `--max-size`
- **THEN** the early input warning and the report-size warning both appear
- **AND** the two totals may differ because they measure different sets
- **AND** the report is still written

#### Scenario: No new surface

- **WHEN** the change is complete
- **THEN** no new CLI option or dependency exists
- **AND** the report, JSON, CI, email and history bytes are unchanged

### Requirement: Document the early warning

The documentation SHALL state the 50 MiB threshold, the exact warning line and
its MB unit, that the warning is advisory, that it names no path, and that it
does not change the exit code or any output byte. It SHALL also state that the
early total and the report-size warning's `input` value can differ.

#### Scenario: Agent guide

- **WHEN** a reader opens the CLI or limits documentation
- **THEN** the early input warning, its threshold, its exact line and its
  advisory nature are stated
- **AND** the two-number difference from the report-size warning is stated
- **AND** the existing 100 MB input cap and report-size warning are still
  documented separately
