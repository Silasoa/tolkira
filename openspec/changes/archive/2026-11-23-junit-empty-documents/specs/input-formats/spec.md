# Spec Delta

## MODIFIED Requirements

### Requirement: Detect JUnit XML in files and directories

The loader SHALL recognise `.xml` JUnit files by content and SHALL include them
when scanning a directory. A zero-test JUnit document — well-formed JUnit XML
with no `<testcase>` anywhere — SHALL be skipped when it is found in a directory
scan only if it is exactly one recognised `<testsuites>`, `<testsuite>` or
`<testcase>` root. A zero-test JUnit document that is named explicitly SHALL
fail with a clear file-specific error; a file that is also named explicitly is
treated as explicit even when a scanned directory contains it. Malformed XML, a
wrapper root, a multi-root document and a `<testcase>` under an unrecognised
element SHALL still fail, including in a directory.

#### Scenario: Directory scan

- **WHEN** a directory contains a JUnit `.xml` file
- **THEN** the report includes its suites and test cases

#### Scenario: Empty document in a directory

- **WHEN** a directory contains one JUnit document with test cases and one
  zero-test JUnit document
- **THEN** generation succeeds
- **AND** the report includes the test cases from the document with test cases
- **AND** the zero-test document contributes no scenario or feature

#### Scenario: Empty document named explicitly

- **WHEN** an explicit JUnit document has no `<testcase>`
- **THEN** generation fails with a clear file-specific error
- **AND** no report file is written

#### Scenario: File named explicitly inside a scanned directory

- **WHEN** a zero-test JUnit file is named explicitly and also lies inside a
  scanned directory
- **THEN** generation fails with the same clear file-specific error
- **AND** the directory scan does not downgrade it to a skipped file

#### Scenario: Only empty documents

- **WHEN** every JUnit document in a directory is zero-test and the directory
  has no other usable input
- **THEN** generation fails with a clear error
- **AND** no report file is written

#### Scenario: Mixed Cucumber and zero-test JUnit directory

- **WHEN** a directory contains Cucumber input with test cases and a zero-test
  JUnit document
- **THEN** generation succeeds
- **AND** the report includes the Cucumber results
- **AND** the zero-test document contributes no scenario or feature

#### Scenario: Malformed XML in a directory

- **WHEN** a directory contains a malformed JUnit document
- **THEN** generation fails with a clear file/line error
- **AND** the malformed document is not skipped as zero-test
- **AND** no partial report is written

#### Scenario: Malformed XML

- **WHEN** an explicit `.xml` file is not valid JUnit XML
- **THEN** generation fails with a clear file/line error
- **AND** no partial report is written
