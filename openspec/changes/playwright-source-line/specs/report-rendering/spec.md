# Spec Delta

## ADDED Requirements

### Requirement: Show an unambiguous source line

The report SHALL carry the Pickle location line into the internal scenario model
and show `uri:line` in the scenario summary when the line is a positive integer.
The feature source label SHALL show a line only when every scenario in that
feature shares the same source URI and the same positive line; otherwise it SHALL
show the URI only or the existing file count for multiple URIs. The line SHALL
NOT appear in the JSON summary, CI text or email.

#### Scenario: Playwright project with multiple specs

- **WHEN** a Playwright project feature contains scenarios from two spec files
- **THEN** every scenario summary shows its own `file:line`
- **AND** the feature source label shows the file count or URI, not one invented
  line

#### Scenario: Mixed Cucumber lines

- **WHEN** scenarios share a source file but have different lines
- **THEN** each scenario summary shows its own line
- **AND** the feature source label shows the file only

#### Scenario: No line

- **WHEN** the Pickle has no positive location line
- **THEN** the scenario and feature labels stay the URI
- **AND** the report does not render a trailing colon
