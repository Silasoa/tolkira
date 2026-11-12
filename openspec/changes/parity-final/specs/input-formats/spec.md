# Spec Delta

## ADDED Requirements

### Requirement: Verify common JUnit producer shapes

The JUnit adapter SHALL remain covered by fixtures modelled on the output of
common producers: jest-junit (Jest), pytest `junitxml` and Gradle test XML.
Every fixture SHALL record its provenance, producer shape and whether it is a
recorded or synthetic sample. The coverage SHALL include suites and test cases,
`failure`, `error`, `skipped`, durations, testcase-level `system-out` and
`system-err` where a producer writes them, and tolerance for suite-level
output. This is a verification requirement; it SHALL NOT add behaviour
that the adapter does not already provide.

#### Scenario: Jest style output

- **WHEN** a jest-junit shaped document contains passed, failed and skipped
  test cases and suite-level output
- **THEN** the report maps the statuses, failure text and durations
- **AND** the suite-level output is tolerated and not attached
- **AND** the fixture's provenance is recorded in the repository

#### Scenario: pytest style output

- **WHEN** a pytest shaped document contains `<properties>`, testcase-level
  `<system-out>`/`<system-err>` and a failing assertion
- **THEN** the report maps the suite and test cases without treating the
  properties as test cases
- **AND** the testcase output becomes an attachment
- **AND** the failing assertion text is visible

#### Scenario: Gradle style output

- **WHEN** a Gradle shaped document uses a root `<testsuite>` with
  `<properties>`, an `error` or `failure` and a skipped case
- **THEN** the report maps every test case
- **AND** suite-level output remains ignored as documented

#### Scenario: Provenance

- **WHEN** a fixture or its accompanying provenance file is inspected
- **THEN** it names the producer shape, version, date and synthetic/recorded
  status
- **AND** no real private path, token or personal data is included

### Requirement: Accept declaration-like text in JUnit data

The JUnit adapter SHALL reject `<!DOCTYPE>` and `<!ENTITY>` declarations only
when they appear as markup outside comments, CDATA sections and processing
instructions. Declaration-looking text inside those constructs SHALL be treated
as data.

#### Scenario: CDATA declaration text

- **WHEN** a failure or system-output CDATA section contains `<!DOCTYPE>` or
  `<!ENTITY>` text
- **THEN** the document parses and the text stays available as data
- **AND** the declaration content is still rejected outside CDATA
