# Spec Delta

## ADDED Requirements

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
