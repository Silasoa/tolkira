# input-formats Specification

## Purpose
Defines how Tolkira reads, detects, validates and merges Cucumber test-result
inputs without losing screenshots or attachments.

## Requirements

### Requirement: Accept legacy Cucumber JSON and Cucumber Messages

Tolkira SHALL accept both legacy Cucumber JSON reports and Cucumber Messages
NDJSON as input. It SHALL detect the format from the input content and
extension, and SHALL reject unsupported input with a clear error.

#### Scenario: Legacy JSON is recognised
- **WHEN** the user passes a Cucumber legacy JSON report
- **THEN** Tolkira treats it as a legacy JSON report and proceeds to normalise it

#### Scenario: Messages NDJSON is recognised
- **WHEN** the user passes an NDJSON file containing Cucumber Messages envelopes
- **THEN** Tolkira treats it as a Messages report and proceeds to render it

#### Scenario: Unsupported input is rejected
- **WHEN** the user passes a file that is neither legacy JSON nor Messages
- **THEN** Tolkira exits with a clear error and writes no report

### Requirement: Merge multiple inputs deterministically

Tolkira SHALL accept more than one input file or directory and SHALL merge the
results into one report. The order of features and scenarios SHALL be stable
for the same inputs.

#### Scenario: Two reports become one
- **WHEN** the user passes two reports containing different features
- **THEN** the generated report contains both features

#### Scenario: Directory input is expanded
- **WHEN** the user passes a directory containing supported report files
- **THEN** Tolkira reads every supported file in a stable order

### Requirement: Preserve legacy embeddings as attachments

When normalising legacy JSON, Tolkira SHALL convert `embeddings` entries into
Cucumber Messages attachments, including their media type and base64 data.
Screenshots SHALL remain viewable in the generated report.

#### Scenario: Screenshot survives normalisation
- **WHEN** a legacy JSON step contains a base64 PNG embedding
- **THEN** the generated report contains an image attachment for that step

#### Scenario: Text attachment survives normalisation
- **WHEN** a legacy JSON step contains a text embedding
- **THEN** the generated report contains a readable text attachment for that step

### Requirement: Preserve legacy test detail

Tolkira SHALL preserve statuses, durations, tags, hooks, background steps,
expanded scenario-outline rows, data tables, doc strings and error messages when
normalising legacy JSON.

#### Scenario: Failed step keeps its error
- **WHEN** a legacy JSON step has a failed status and an error message
- **THEN** the generated report shows the failure and the error message

#### Scenario: Scenario outline rows are preserved
- **WHEN** a legacy JSON report contains two example rows of a scenario outline
- **THEN** both rows appear as separate scenarios with their statuses

Reconstructing the original outline `examples` table is a documented limitation
of the legacy format and is not required for v0.1.

### Requirement: Reject malformed input without partial output

Tolkira SHALL stop on malformed or unparseable input, return a non-zero exit
code and SHALL NOT leave a partially written report file.

#### Scenario: Invalid JSON
- **WHEN** the input is not valid JSON or NDJSON
- **THEN** Tolkira reports the parse error and writes no report file

### Requirement: Accept JUnit XML as a basic input

Tolkira SHALL accept JUnit XML files and map suites and test cases into the
existing report model. This is a basic mode: no Gherkin steps and no
screenshots are claimed.

#### Scenario: A passing and a failing test case

- **WHEN** a JUnit XML file contains one passing and one failing `<testcase>`
- **THEN** the report shows two scenarios, one passed and one failed
- **AND** the failure text is visible on the failed scenario

#### Scenario: Skipped test case

- **WHEN** a `<testcase>` contains `<skipped>`
- **THEN** the scenario status is skipped

#### Scenario: Duration

- **WHEN** a `<testcase>` has `time="1.234"`
- **THEN** the scenario duration is 1234 ms

#### Scenario: System output

- **WHEN** a `<testcase>` contains `<system-out>` or `<system-err>`
- **THEN** the text is available as a text attachment
- **AND** it is never executed as HTML

### Requirement: Detect JUnit XML in files and directories

The loader SHALL recognise `.xml` JUnit files by content and SHALL include them
when scanning a directory.

#### Scenario: Directory scan

- **WHEN** a directory contains a JUnit `.xml` file
- **THEN** the report includes its suites and test cases

#### Scenario: Malformed XML

- **WHEN** an explicit `.xml` file is not valid JUnit XML
- **THEN** generation fails with a clear file/line error
- **AND** no partial report is written

### Requirement: State the basic-mode limits

The report SHALL make clear that JUnit XML is a basic mode.

#### Scenario: No screenshots claimed

- **WHEN** a JUnit XML report is opened
- **THEN** no screenshot or Gherkin-step affordance is shown for that input
- **AND** the report still provides counts, durations, failures and filters

### Requirement: JUnit XML edge cases

The JUnit XML adapter SHALL handle common real-world suite shapes and SHALL fail
with a clear file-specific error for malformed XML.

#### Scenario: Nested suites and mixed statuses

- **WHEN** a JUnit document contains multiple or nested `testsuite` elements
- **THEN** every test case is summarised
- **AND** passed, failed, error and skipped cases have the expected status

#### Scenario: System output and entities

- **WHEN** a test case contains `system-out`, `system-err`, XML entities or
  CDATA
- **THEN** the readable text is preserved without breaking the report

#### Scenario: Failure without attributes

- **WHEN** a test case contains a text-only, CDATA-only or self-closing
  `<failure>` or `<error>` element
- **THEN** the test case is marked failed
- **AND** the text message is preserved when present

#### Scenario: Malformed XML

- **WHEN** a JUnit file is not well-formed XML
- **THEN** generation fails with an error that names the file

#### Scenario: DTD entities and processing instructions

- **WHEN** the document declares an internal DTD entity or contains a
  processing instruction with ampersands
- **THEN** the document is accepted and the entity is not treated as invalid

#### Scenario: Mixed input

- **WHEN** a JUnit file is merged with legacy JSON or Messages
- **THEN** all scenarios appear in one report with stable ordering
