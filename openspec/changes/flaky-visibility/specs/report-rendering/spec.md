# Spec Delta

## ADDED Requirements

### Requirement: Show flaky scenarios

When a scenario's tags include `@flaky`, the report SHALL show a localized flaky
badge on that scenario and the run metadata SHALL show a tagged `@flaky` count
(for example `1 tagged @flaky`), separate from the status counts, when the count
is positive. The scenario SHALL keep its existing status (normally `passed`) in
the report, JSON summary, CI and email; no new schema or field is introduced.
With no `@flaky` scenario, no badge or count SHALL appear.

#### Scenario: Playwright retry passed

- **WHEN** a Playwright test passes on a retry and the adapter adds `@flaky`
- **THEN** the scenario row shows the flaky badge
- **AND** the run metadata shows one tagged `@flaky`
- **AND** the status counts stay separate and the summary status remains passed

#### Scenario: No flaky

- **WHEN** no scenario has `@flaky`
- **THEN** the report shows no flaky badge or count

#### Scenario: Localized

- **WHEN** the report locale is German
- **THEN** the badge and count use the German catalog
- **AND** the tag text and test data stay unchanged
