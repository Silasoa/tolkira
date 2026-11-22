# Spec Delta

## ADDED Requirements

### Requirement: Show earlier attempts in the scenario detail

A scenario with executed earlier attempts SHALL render a collapsed
`Earlier attempts` block in its detail. The summary SHALL state the shown and
total count (`3 of 5` when capped). Each item SHALL show attempt number,
localized status, duration and, when present, the first failure message. The
block SHALL be native `<details>`, escaped, included in print and usable without
JavaScript. An earlier-attempt image SHALL use the existing attachment renderer,
alt text and lightbox.

#### Scenario: Failed then passed

- **WHEN** a scenario failed on attempt 1 and passed on attempt 2
- **THEN** its detail shows `Earlier attempts (1)`
- **AND** opening it shows attempt 1 as failed with the error and any image
- **AND** the final passed attempt stays the visible scenario result

#### Scenario: More than three earlier attempts

- **WHEN** a scenario has five executed earlier attempts
- **THEN** the summary says `Earlier attempts (3 of 5)`
- **AND** the block shows the first three
- **AND** the final attempt remains the scenario result

#### Scenario: Escaping and print

- **WHEN** an earlier failure message or attachment name contains HTML, ANSI or
  bidi characters
- **THEN** the rendered text is escaped and sanitized
- **AND** the block is included in the print stylesheet

#### Scenario: No earlier attempts

- **WHEN** a scenario has one start or legacy input
- **THEN** no earlier-attempt block is rendered
