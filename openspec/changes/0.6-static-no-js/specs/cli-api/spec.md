# Spec Delta

## MODIFIED Requirements

### Requirement: Generate a report from the CLI

The CLI SHALL accept one or more input files or directories and either an
output path or `--json`, and SHALL produce one HTML report and/or one summary.
With `--static`, the CLI SHALL require `--out` or `--pdf`; `--json` alone SHALL
NOT be a report surface.

#### Scenario: Single input

- **WHEN** the user runs the CLI with one supported input and an output path
- **THEN** the CLI writes the HTML report to that path

#### Scenario: Multiple inputs

- **WHEN** the user runs the CLI with multiple supported inputs
- **THEN** the CLI writes one report containing all results

#### Scenario: Directory input

- **WHEN** the user runs the CLI with a directory
- **THEN** the CLI includes every supported report file in that directory

#### Scenario: Static report surface

- **WHEN** `--static` is used with `--json` and without `--out` or `--pdf`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`
- **AND** nothing is written

### Requirement: Provide a machine-readable summary

The CLI SHALL support `--json` and print exactly one stable JSON document to
stdout. The summary SHALL contain the overall status, status counts, duration,
attachments and per-scenario results. The programmatic API SHALL expose the
same summary without writing HTML. With `--static`, the JSON summary SHALL still
print when `--out` or `--pdf` is present; `--static --json` without either SHALL
be a usage error (2).

#### Scenario: JSON summary without HTML

- **WHEN** the user runs the CLI with one or more supported inputs and `--json`
  without `--out`
- **THEN** the CLI prints the JSON summary and writes no HTML file

#### Scenario: JSON summary with HTML

- **WHEN** the user runs the CLI with `--out` and `--json`
- **THEN** the CLI writes the HTML report and prints only the JSON summary to
  stdout

#### Scenario: Failing tests in the summary

- **WHEN** the input contains failed scenarios
- **THEN** the summary reports `status: "failed"`, the failing scenario and its
  step messages, and the CLI still exits with code 0

#### Scenario: Stable schema

- **WHEN** the input is summarized more than once
- **THEN** scenarios are ordered deterministically and every status key is
  present with a numeric value, including zero counts

#### Scenario: Static JSON

- **WHEN** `--static --out report.html --json` is used
- **THEN** the JSON stdout is unchanged
- **AND** the report is the static form

#### Scenario: Static JSON without a report surface

- **WHEN** `--static --json` is used without `--out` or `--pdf`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`
- **AND** nothing is written

### Requirement: Support title, metadata and output options

The CLI SHALL support a report title, repeated metadata entries, a logo, an
accent colour, a size warning threshold, help and version output. The API SHALL
support title, metadata, logo and accent. The CLI SHALL require at least one of
`--out` or `--json`. With `--static`, the CLI SHALL require `--out` or `--pdf`
instead of accepting `--json` alone.

#### Scenario: Title and metadata

- **WHEN** the user supplies a title and metadata entries
- **THEN** the generated report contains the escaped title and metadata

#### Scenario: Help

- **WHEN** the user requests help
- **THEN** the CLI prints usage and exits successfully

#### Scenario: Static output surface

- **WHEN** `--static` is used with only `--json`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`
