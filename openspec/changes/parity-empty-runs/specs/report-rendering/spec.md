# Spec Delta

## ADDED Requirements

### Requirement: Mark executed and unexecuted scenarios

The model SHALL expose whether a scenario produced at least one step result.
Unexecuted scenarios SHALL render without an outcome and SHALL be excluded from
scenario counts and the triage index.

#### Scenario: Scenario with no step results

- **WHEN** a scenario has no step result
- **THEN** the report shows it without an outcome
- **AND** it is not counted as passed, failed, skipped or unknown
- **AND** it is not listed in “Needs attention”

#### Scenario: Started but unfinished

- **WHEN** a test case started but has no finished step
- **THEN** the scenario is rendered as unexecuted
- **AND** the row is not dropped

### Requirement: Handle empty features and runs

A feature whose scenarios are all unexecuted SHALL have status `unknown` and
SHALL open by default. An empty run SHALL show `0 / 0` and no outcome.

#### Scenario: All-unexecuted feature

- **WHEN** every scenario in a feature is unexecuted
- **THEN** the feature status is `unknown`
- **AND** the feature is open by default
- **AND** its rows show no outcome

#### Scenario: Empty run

- **WHEN** the input contains a feature with a blank scenario and no results
- **THEN** the header shows `0 / 0`
- **AND** no “Needs attention” index is rendered

### Requirement: Keep executed counts and search stable

Executed scenarios SHALL keep their current counts, triage membership, status
matrix, search and tag filtering. Unexecuted rows SHALL remain searchable by
name and source.

#### Scenario: Mixed run

- **WHEN** a run contains executed and unexecuted scenarios
- **THEN** counts include only executed scenarios
- **AND** the status matrix and triage include only executed scenarios
- **AND** unexecuted rows remain searchable

### Requirement: Summary schema version 2

The JSON summary SHALL add `executed` to each scenario, exclude unexecuted
scenarios from `counts.scenarios`, and set `schemaVersion` to 2. Step counts and
attachment counts SHALL keep their current meaning.

#### Scenario: Summary marks unexecuted

- **WHEN** a run contains an unexecuted scenario
- **THEN** its summary entry has `executed: false`
- **AND** `counts.scenarios.total` excludes it
- **AND** `schemaVersion` is 2

#### Scenario: Executed scenario

- **WHEN** a scenario has at least one step result
- **THEN** its summary entry has `executed: true`
- **AND** it is counted as before

### Requirement: Fallbacks and safety

Legacy JSON and JUnit SHALL keep their current execution detection and SHALL
NOT invent an outcome for an unexecuted row. All names and sources SHALL remain
escaped and the report SHALL stay offline.

#### Scenario: Legacy unexecuted row

- **WHEN** legacy JSON has a scenario without a usable result
- **THEN** it renders without an outcome
- **AND** no new status is invented

#### Scenario: JUnit

- **WHEN** the input is JUnit XML
- **THEN** execution detection follows the parsed test case
- **AND** no network request is made
