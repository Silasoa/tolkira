# Spec Delta

## ADDED Requirements

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

#### Scenario: Malformed XML

- **WHEN** a JUnit file is not well-formed XML
- **THEN** generation fails with an error that names the file

#### Scenario: Mixed input

- **WHEN** a JUnit file is merged with legacy JSON or Messages
- **THEN** all scenarios appear in one report with stable ordering
