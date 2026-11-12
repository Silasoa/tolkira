# cli-api Specification

## Purpose
Defines the command-line and programmatic entry points for generating a Tolkira
report and their error and exit-code behaviour.

## Requirements

### Requirement: Generate a report from the CLI

The CLI SHALL accept one or more input files or directories and either an
output path or `--json`, and SHALL produce one HTML report and/or one summary.

#### Scenario: Single input
- **WHEN** the user runs the CLI with one supported input and an output path
- **THEN** the CLI writes the HTML report to that path

#### Scenario: Multiple inputs
- **WHEN** the user runs the CLI with multiple supported inputs
- **THEN** the CLI writes one report containing all results

#### Scenario: Directory input
- **WHEN** the user runs the CLI with a directory
- **THEN** the CLI includes every supported report file in that directory

### Requirement: Use stable exit codes

The CLI SHALL return exit code 0 on success, 1 on parse or render failure and 2
on usage errors. Failing test results SHALL NOT fail report generation.

#### Scenario: Failing tests still generate a report
- **WHEN** the input contains failed test results but is otherwise valid
- **THEN** the CLI writes the report and exits with code 0

#### Scenario: Malformed input
- **WHEN** the input cannot be parsed
- **THEN** the CLI exits with code 1 and writes no partial report

#### Scenario: Missing arguments
- **WHEN** the user omits a required argument
- **THEN** the CLI exits with code 2 and prints usage

### Requirement: Expose a programmatic API

Tolkira SHALL expose a programmatic API that accepts the same inputs as the CLI
and returns the generated HTML or summary. The API SHALL NOT write files.

#### Scenario: API returns HTML
- **WHEN** a caller invokes the API with a supported input
- **THEN** the API returns the report HTML without requiring a file write

#### Scenario: API reports errors
- **WHEN** a caller invokes the API with malformed input
- **THEN** the API rejects with a clear error

### Requirement: Provide a machine-readable summary

The CLI SHALL support `--json` and print exactly one stable JSON document to
stdout. The summary SHALL contain the overall status, status counts, duration,
attachments and per-scenario results. The programmatic API SHALL expose the
same summary without writing HTML.

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

### Requirement: Support title, metadata and output options

The CLI SHALL support a report title, repeated metadata entries, a logo, an
accent colour, a size warning threshold, help and version output. The API SHALL
support title, metadata, logo and accent. The CLI SHALL require at least one of
`--out` or `--json`.

#### Scenario: Title and metadata
- **WHEN** the user supplies a title and metadata entries
- **THEN** the generated report contains the escaped title and metadata

#### Scenario: Help
- **WHEN** the user requests help
- **THEN** the CLI prints usage and exits successfully

### Requirement: Do not leave partial output

On failure, the CLI SHALL remove or avoid a partial output file.

#### Scenario: Render failure
- **WHEN** rendering fails after the output path was opened
- **THEN** no partial report remains at the output path

### Requirement: Stream Cucumber Messages into a report

The package SHALL export `CucumberHtmlStream`, a Node `Transform` that accepts
Cucumber Messages `Envelope` objects in object mode. It SHALL collect the
envelopes, render one HTML document on flush and emit it as a string chunk. It
SHALL accept the same `RenderReportOptions` as `renderReport` and SHALL
produce the same HTML for the same envelopes and options. It SHALL NOT write
files.

#### Scenario: Stream output matches the file API

- **WHEN** a caller pipes the envelopes of one Messages input through
  `CucumberHtmlStream` with a title
- **THEN** the collected output equals `renderReport` for that input and title

#### Scenario: Stream options

- **WHEN** a caller passes title, metadata, logo or accent to the constructor
- **THEN** the rendered HTML contains the same escaped values as the file API
- **AND** missing options use the API defaults

#### Scenario: Streaming error

- **WHEN** rendering fails during flush
- **THEN** the stream emits that error
- **AND** no partial HTML is presented as a complete report
