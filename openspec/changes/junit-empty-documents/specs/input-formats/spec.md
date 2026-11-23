# Spec Delta

## MODIFIED Requirements

### Requirement: Detect JUnit XML in files and directories

The loader SHALL recognise `.xml` JUnit files by content and SHALL include them
when scanning a directory. A JUnit document with no test cases SHALL be skipped
when it is found in a directory scan. A JUnit document with no test cases that
is named explicitly SHALL fail with a clear file-specific error. Malformed XML
SHALL still fail, including in a directory.

#### Scenario: Directory scan

- **WHEN** a directory contains a JUnit `.xml` file
- **THEN** the report includes its suites and test cases

#### Scenario: Empty document in a directory

- **WHEN** a directory contains one JUnit document with test cases and one
  well-formed document with no `<testcase>`
- **THEN** generation succeeds
- **AND** the report includes the test cases from the non-empty document
- **AND** the empty document contributes no scenario or feature

#### Scenario: Empty document named explicitly

- **WHEN** an explicit JUnit document has no test cases
- **THEN** generation fails with a clear file-specific error
- **AND** no report file is written

#### Scenario: Only empty documents

- **WHEN** every JUnit document in a directory has no test cases
- **THEN** generation fails with a clear error
- **AND** no report file is written

#### Scenario: Malformed XML in a directory

- **WHEN** a directory contains a malformed JUnit document
- **THEN** generation fails with a clear file/line error
- **AND** the malformed document is not skipped as empty
- **AND** no partial report is written

#### Scenario: Malformed XML

- **WHEN** an explicit `.xml` file is not valid JUnit XML
- **THEN** generation fails with a clear file/line error
- **AND** no partial report is written
