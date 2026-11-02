# Spec Delta

## Purpose

Defines how Tolkira reads, detects, validates and merges Cucumber test-result
inputs without losing screenshots or attachments.

## ADDED Requirements

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

Tolkira SHALL preserve statuses, durations, tags, hooks, scenario outlines,
backgrounds, data tables, doc strings and error messages when normalising
legacy JSON.

#### Scenario: Failed step keeps its error
- **WHEN** a legacy JSON step has a failed status and an error message
- **THEN** the generated report shows the failure and the error message

#### Scenario: Scenario outline keeps its examples
- **WHEN** a legacy JSON report contains a scenario outline with examples
- **THEN** the generated report shows the outline and its example rows

### Requirement: Reject malformed input without partial output

Tolkira SHALL stop on malformed or unparseable input, return a non-zero exit
code and SHALL NOT leave a partially written report file.

#### Scenario: Invalid JSON
- **WHEN** the input is not valid JSON or NDJSON
- **THEN** Tolkira reports the parse error and writes no report file
