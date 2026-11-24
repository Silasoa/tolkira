# Spec Delta

## MODIFIED Requirements

### Requirement: Count flaky scenarios per history run

A new history run SHALL store an optional `flaky` count: executed, non-skipped
scenarios with the inherited `@flaky` tag, or scenarios whose final status is
passed after at least one retry (`attempt > 0`). A retried scenario that finally
failed SHALL NOT count through the retry branch. The history schema SHALL stay 1
by default; it SHALL be 2 when the limit is above 30 or the file already used 2.
The summary schema SHALL stay 2 and SHALL NOT gain a flaky field.

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
