# Spec Delta

## ADDED Requirements

### Requirement: Localize the email summary

The email SHALL use the active locale catalog for its subject, heading,
status labels, counts, pass rate, duration, failed-scenario labels and report
note. It SHALL set `lang`/`dir` and format numbers, percentages,
durations and dates for the locale. The default title and test data SHALL render
verbatim; the CLI, JSON and CI text SHALL stay English.

#### Scenario: German email

- **WHEN** `--email summary.html --locale de` is used
- **THEN** the email labels, counts, pass rate, duration and report note are
  German
- **AND** `lang="de"` and the German number/date formats are used

#### Scenario: English email

- **WHEN** the email is generated without `--locale`
- **THEN** the email is English
- **AND** its numbers, percentages, durations and dates match the existing
  English helpers

#### Scenario: Test data and title

- **WHEN** a German email contains an English feature name or the default
  `Tolkira report` title
- **THEN** both render verbatim
- **AND** only the chrome text is translated

#### Scenario: Hostile translation and data

- **WHEN** a catalog value or test name contains markup
- **THEN** the email shows the literal text
- **AND** no markup or attribute is created
