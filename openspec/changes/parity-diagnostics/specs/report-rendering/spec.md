# Spec Delta

## ADDED Requirements

### Requirement: Show undefined-step snippets

For Cucumber Messages input, an undefined step SHALL show the lead "No step
definition found." and SHALL render every available suggestion snippet as
escaped code. The lead is shown even when no suggestion envelope exists; the
snippet sentence and code blocks are added only when snippets are present.

#### Scenario: One suggestion

- **WHEN** an undefined step has one suggestion
- **THEN** the step shows "No step definition found. Implement with the
  snippet(s) below:"
- **AND** the snippet code is shown in a code block

#### Scenario: Multiple suggestions

- **WHEN** an undefined step has more than one suggestion
- **THEN** every snippet is shown
- **AND** each snippet keeps its language label when present

#### Scenario: No suggestion envelope

- **WHEN** an undefined step has no suggestion envelope
- **THEN** the step shows "No step definition found."
- **AND** no snippet sentence or empty code block is rendered

#### Scenario: Legacy undefined step

- **WHEN** the input is legacy Cucumber JSON with an undefined step
- **THEN** the status is shown without snippets
- **AND** the report does not invent a definition

### Requirement: Show ambiguous-step definitions

For Cucumber Messages input, an ambiguous step SHALL show "Multiple matching
step definitions found:" and the matching patterns with their source
references. The lead is shown even when no definition metadata exists; the
pattern list is added only when definitions are present.

#### Scenario: Multiple matching definitions

- **WHEN** an ambiguous step matches two step definitions
- **THEN** both patterns are shown
- **AND** each pattern names its source file and line when available

#### Scenario: No matching definition metadata

- **WHEN** an ambiguous step has no step-definition envelopes
- **THEN** the step shows "Multiple matching step definitions found:"
- **AND** no empty definition list is rendered

#### Scenario: Legacy ambiguous step

- **WHEN** the input is legacy Cucumber JSON with an ambiguous step
- **THEN** the status is shown without patterns
- **AND** the report does not invent definitions

### Requirement: Open non-passed results by default

The report SHALL open features and scenarios whose status is not `passed` by
default, including undefined, ambiguous, pending, skipped and unknown results.
The search auto-open cap SHALL remain in force.

#### Scenario: Undefined scenario

- **WHEN** a feature contains an undefined scenario
- **THEN** the feature and the undefined scenario are open
- **AND** its diagnostic is visible without a click

#### Scenario: Pending and skipped scenarios

- **WHEN** a feature contains pending or skipped scenarios
- **THEN** those scenarios are open by default
- **AND** passed scenarios remain collapsed

#### Scenario: Search cap

- **WHEN** a search matches more than 20 scenarios
- **THEN** at most 20 newly matched scenarios are opened by the search
- **AND** the existing "20 of N" note is shown only when 20 new rows were opened

### Requirement: Keep diagnostics safe and searchable

Snippets, patterns and source references SHALL be escaped, SHALL not execute
markup, and SHALL remain part of the single offline file. Source references
SHALL use the report-relative URI form. The step text and diagnostic text SHALL
be searchable.

#### Scenario: Untrusted snippet

- **WHEN** a suggestion snippet contains HTML or script text
- **THEN** it is displayed as code and no markup executes

#### Scenario: Search finds an undefined step

- **WHEN** the user searches for text in an undefined step or its diagnostic
- **THEN** the matching scenario is visible and open

#### Scenario: No network

- **WHEN** the report is opened offline
- **THEN** diagnostics render without an external request

### Requirement: Preserve counts and summary

Diagnostics SHALL not change scenario, step or attachment counts, the triage
membership or the JSON summary schema.

#### Scenario: Counts unchanged

- **WHEN** a report with undefined and ambiguous steps is rendered
- **THEN** its scenario counts match the summary scenario counts
- **AND** the summary remains version 1
- **AND** undefined suggestions and ambiguous definitions are also exposed as
  optional summary-step fields, without changing the schema version

#### Scenario: JUnit without diagnostics

- **WHEN** the input is JUnit XML
- **THEN** no undefined or ambiguous diagnostics are rendered
