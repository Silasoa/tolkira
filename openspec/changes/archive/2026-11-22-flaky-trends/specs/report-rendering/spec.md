# Spec Delta

## ADDED Requirements

### Requirement: Count flaky scenarios per history run

A new history run SHALL store an optional `flaky` count: executed, non-skipped
scenarios with the inherited `@flaky` tag, or scenarios whose final status is
passed after at least one retry (`attempt > 0`). A retried scenario that finally
failed SHALL NOT count through the retry branch. The history schema version
SHALL stay 1; the summary schema SHALL stay 2 and SHALL NOT gain a flaky field.

#### Scenario: Tagged flaky scenario

- **WHEN** an executed, non-skipped scenario has the `@flaky` tag
- **THEN** the new history run counts it once, including when its final status
  failed

#### Scenario: Retried and passed

- **WHEN** an executed scenario has `attempt > 0` and its final status is passed
- **THEN** the new history run counts it once
- **AND** a scenario that is both tagged and retried is still counted once

#### Scenario: Retried and failed

- **WHEN** a scenario retried but its final status is not passed
- **THEN** the retry branch does not count it
- **AND** the `@flaky` tag can still count it when present

#### Scenario: Unexecuted or skipped

- **WHEN** a tagged scenario is unexecuted or its final status is skipped
- **THEN** the flaky count does not include it

### Requirement: Keep old history entries field-less

Reading a history file SHALL NOT materialize `flaky` on old entries; appending a
new run SHALL leave them without it. An old entry SHALL render `—` for Flaky and
Flaky share, not 0. A present count SHALL be a whole number no greater than
attempted (total minus skipped); an invalid value SHALL reject the file without
a rewrite.

#### Scenario: Old history file

- **WHEN** an existing history file has runs without `flaky`
- **THEN** those rows show `—` for Flaky and Flaky share
- **AND** appending a new run leaves those entries without the field

#### Scenario: Invalid count

- **WHEN** a history file has a negative, fractional or above-attempted `flaky`
- **THEN** the file is rejected without a rewrite

### Requirement: Show flaky count and share in Trends

The Trends table SHALL show a `Flaky` count and a `Flaky share` per run. The
share SHALL be `flaky / attempted` (attempted = total - skipped) and SHALL render
`—` when attempted is 0 or the field is absent. A positive share below 0.1%
SHALL render `<0.1%` (locale-formatted). The displayed count SHALL be clamped to
attempted.

#### Scenario: Share with attempts

- **WHEN** a run has 2 flaky scenarios and 40 attempted scenarios
- **THEN** the row shows 2 and `5%`

#### Scenario: No attempts

- **WHEN** every scenario is skipped or the run is empty
- **THEN** the flaky share is `—`

#### Scenario: No flaky scenarios

- **WHEN** a run has attempts and no tagged or passed-after-retry scenario
- **THEN** the row shows 0 and `0%`

#### Scenario: Tiny share

- **WHEN** a run has 1 flaky scenario and more than 1,000 attempted scenarios
- **THEN** the share renders `<0.1%`, not `0%`

#### Scenario: Above-attempted API history

- **WHEN** an API-supplied history run has more flaky scenarios than attempted
- **THEN** the displayed count and share are clamped to attempted

### Requirement: Explain the flaky proxy

A Trends note SHALL state that the count is executed non-skipped scenarios
tagged `@flaky` or passed after a retry; a tagged final failure counts, while a
retried final failure does not count unless tagged. It SHALL state that the
share is not a flake probability, that the run-meta tagged count can differ in
either direction, and that legacy JSON is tag-only.

#### Scenario: Contributor note

- **WHEN** the Trends table renders
- **THEN** the note explains the tag/final-pass rule, the non-probability, the
  run-meta difference and the legacy limit
