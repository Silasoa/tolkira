# Spec Delta

## ADDED Requirements

### Requirement: Report each Playwright error location once

The Playwright adapter SHALL include at most one `at <location>` line per error,
where the location is `<file>[:<line>[:<column>]]`. When the message or snippet
already contains that location as a complete token, the adapter SHALL NOT
append another location line. A longer line or column that merely starts with
the same digits SHALL NOT count as the same location.

#### Scenario: Message ends with the location

- **WHEN** an expected-failure message ends with the same
  `at <file>:<line>:<column>` that the error carries
- **THEN** the scenario description contains that location line exactly once

#### Scenario: Location inside a message

- **WHEN** the message or snippet contains the location inside another sentence
- **THEN** the adapter does not append a second location line

#### Scenario: Location prefix is not the location

- **WHEN** the location is `file:1` and the message only contains `file:12`
- **THEN** the adapter appends the `at file:1` line

#### Scenario: Message has no location

- **WHEN** the error carries a location and neither the message nor the snippet
  contains it
- **THEN** the adapter appends one location line

#### Scenario: Location without a column

- **WHEN** the error location has a file and line but no column
- **THEN** the appended location is `at <file>:<line>`
