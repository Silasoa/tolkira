# Spec Delta

## ADDED Requirements

### Requirement: Filter scenarios by tag

The report SHALL provide a tag filter in the Report toolbar when the run
contains tags. The filter SHALL combine with text search and status filters and
SHALL update the visible count and empty state.

#### Scenario: Filter by one tag

- **WHEN** the user selects a tag
- **THEN** only scenarios carrying that tag remain visible
- **AND** features with no matching scenario are hidden
- **AND** the live region reports the new visible count

#### Scenario: Combine tag and status filters

- **WHEN** a tag and a status filter are active
- **THEN** a scenario is visible only when it matches both

### Requirement: Highlight search matches

The report SHALL visually highlight matching text in visible scenarios when a
search query is active, and SHALL clear the highlight when the query is empty.

#### Scenario: Search finds visible text

- **WHEN** the user enters a query of at least two characters
- **THEN** matching text inside visible scenarios is highlighted
- **AND** the highlight is removed when the query is cleared

#### Scenario: Browser lacks the Highlight API

- **WHEN** the browser does not support `CSS.highlights`
- **THEN** the report still filters and opens matching scenarios without
  throwing an error

### Requirement: Copy a failure summary

The report SHALL offer a copy action on failed scenarios that copies the
feature, scenario, URI, failed step and error message as plain text.

#### Scenario: Copy a failed scenario

- **WHEN** the user activates "Copy failure" on a failed scenario
- **THEN** the clipboard receives a readable text summary
- **AND** the control confirms success without changing the failure content

#### Scenario: Passed scenario

- **WHEN** a scenario passed
- **THEN** no copy-failure control is rendered for it

#### Scenario: Clipboard is unavailable

- **WHEN** the clipboard API and the fallback both fail
- **THEN** the control reports failure politely and does not throw
- **AND** keyboard focus stays on the control
