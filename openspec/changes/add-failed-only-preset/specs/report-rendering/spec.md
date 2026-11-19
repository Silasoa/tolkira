# Spec Delta

## ADDED Requirements

### Requirement: Provide a failed-only preset

When the run has failed plus another present status or an unexecuted row, the
Report toolbar SHALL render a `Failed only` toggle that reflects the preset
state in `aria-pressed`. The toggle SHALL apply the failed-only chip state plus
an `unexecuted` sentinel; the sentinel hides statusless rows. The preset SHALL
be encoded as `hide` statuses plus `hide=unexecuted` and survive a reload only
with the preset chip state.

#### Scenario: Toggle presence

- **WHEN** the run has failed plus another present status, or failed plus an
  unexecuted row
- **THEN** the toolbar renders a `Failed only` toggle with
  `aria-pressed="false"`
- **WHEN** the run has no failures, or failed with neither another status nor an
  unexecuted row
- **THEN** no toggle is rendered

#### Scenario: Activate

- **WHEN** the user presses `Failed only`
- **THEN** only the failed chip stays on
- **AND** scenarios with any other present status are hidden
- **AND** rows without a status are hidden
- **AND** the live count reflects the visible scenarios
- **AND** the header counts and the `N unexecuted` label are unchanged
- **AND** the triage index and source strip are hidden
- **AND** the URL contains the other statuses and `hide=unexecuted`
- **AND** the toggle is `aria-pressed="true"`

#### Scenario: Deactivate

- **WHEN** the user presses `Failed only` while it is active
- **THEN** every chip is on again
- **AND** statusless rows are visible again
- **AND** the triage index and source strip return
- **AND** the `hide` parameters are removed
- **AND** the live count is updated
- **AND** a previously hidden partial state is not restored

#### Scenario: Manual chip change

- **WHEN** the user changes any status chip while the preset is active
- **THEN** the `unexecuted` sentinel is removed
- **AND** statusless rows follow the chip-only behaviour again
- **AND** the toggle is pressed only for the exact preset state
- **AND** hiding every other chip without the sentinel leaves statusless rows
  visible

#### Scenario: Reload

- **WHEN** the report is opened with the other statuses and `unexecuted` in the
  `hide` parameters
- **THEN** the toggle is pressed
- **AND** the chip states match
- **AND** only failed and no statusless rows are visible
- **WHEN** the URL carries `unexecuted` without the preset chip state
- **THEN** the sentinel is dropped unless it is the exact preset state (failed
  plus unexecuted with no other present status)
- **AND** a pruned URL is rewritten without the stale sentinel
- **AND** statusless rows stay visible

#### Scenario: Search and tag combination

- **WHEN** a search query or tag is active with the preset
- **THEN** only failed scenarios matching both remain visible
- **AND** a matching unexecuted row stays hidden
- **AND** the empty state appears when nothing matches
- **AND** the empty state names the preset when it is active

#### Scenario: Keyboard and no JavaScript

- **WHEN** the toggle is reached with the keyboard
- **THEN** it shows focus and toggles with Enter or Space
- **WHEN** JavaScript is disabled
- **THEN** the static rows and chips remain
- **AND** the toggle is inert like the other filters

## MODIFIED Requirements

### Requirement: Count only executed scenarios on every count surface

Scenario counts and outcome aggregates SHALL use executed scenarios only on the
header, feature row and bar, triage index, source strip and Details matrix.
Unexecuted rows SHALL remain visible and searchable but SHALL NOT contribute to
counts, percentages, bars, triage membership or matrix cells, except that the
failed-only preset's `unexecuted` sentinel MAY hide them while the preset chip
state is active.

#### Scenario: Mixed run

- **WHEN** a run contains executed and unexecuted scenarios
- **THEN** the header, feature rows, triage, source strip and matrix include
  only executed scenarios
- **AND** the unexecuted rows remain visible and searchable unless the
  failed-only preset is active

#### Scenario: Header count

- **WHEN** a run has two executed scenarios and one is passed
- **THEN** the header shows `1 / 2` and `50 %`
- **AND** the status pills and status bar count only the two executed scenarios

#### Scenario: Feature bar

- **WHEN** a feature has one passed, one failed and one unexecuted scenario
- **THEN** the feature row states one of two passed and the failed count
- **AND** the bar has segments for passed and failed only

#### Scenario: Triage

- **WHEN** a run has a failed executed scenario and an unexecuted scenario
- **THEN** the triage index counts one of one executed scenario and links only
  the failed scenario
- **AND** the unexecuted row is absent from the index

#### Scenario: Source strip

- **WHEN** two input files contribute features and one scenario is unexecuted
- **THEN** each source card's scenario count, status and bar cover executed
  scenarios only
- **AND** a source that contributes only unexecuted features shows its feature
  count, `0 scenarios`, status `unknown` and no bar

#### Scenario: Details matrix

- **WHEN** a feature has one passed and one unexecuted scenario
- **THEN** its matrix row total is 1
- **AND** only the passed column is incremented for that row
- **AND** an all-unexecuted feature shows total 0 and muted zero cells

#### Scenario: Search

- **WHEN** the user searches for the name, source or tag of an unexecuted
  scenario and the failed-only preset is not active
- **THEN** the row remains visible
- **AND** it still shows no outcome

### Requirement: Handle empty features and runs

A feature's status SHALL be the worst status among reported results, or
`unknown` when none was reported. Its unexecuted rows stay visible without an
outcome unless the failed-only preset is active. The header SHALL show the
attempted passed/total count. When results exist but none is an attempt, it
SHALL show `No scenarios attempted` and keep the status counts. An empty run
SHALL show `0 / 0` and `0%` and SHALL render no "Needs attention" index.

#### Scenario: All-unexecuted feature

- **WHEN** every scenario in a feature is unexecuted
- **THEN** the feature status is `unknown`
- **AND** the feature is visible and open by default
- **AND** its rows are collapsed and show no outcome

#### Scenario: Mixed executed and unexecuted feature

- **WHEN** a feature has one passed reported scenario and one unexecuted
  scenario
- **THEN** the feature status is `passed`
- **AND** its passed/attempted count and bar cover only the reported scenario

#### Scenario: Empty run

- **WHEN** the input contains a feature with a blank scenario and no results
- **THEN** the header shows `0 / 0` and `0%`
- **AND** the feature and the blank row remain visible without an outcome
- **AND** no "Needs attention" index is rendered

#### Scenario: No scenario rows at all

- **WHEN** the input contains no scenario rows
- **THEN** the header shows `0 / 0`
- **AND** the existing "No scenarios in this report." empty state remains

#### Scenario: Only skipped results

- **WHEN** every reported scenario is skipped
- **THEN** the header shows `No scenarios attempted`
- **AND** the status counts remain visible

#### Scenario: Preset active

- **WHEN** the failed-only preset is active
- **THEN** unexecuted rows are hidden
- **AND** the feature status and header counts are unchanged

### Requirement: Preserve counts, search and summary

Grouping by rule SHALL change presentation only. Counts, triage and the matrix
SHALL use executed scenarios; search and tag filtering SHALL use all rows.
Unexecuted rows stay visible and searchable but SHALL NOT count, except that the
failed-only preset's `unexecuted` sentinel MAY hide them. Search SHALL index
rule/background names and descriptions; a matching rule keeps its descendants
visible.

#### Scenario: Counts unchanged

- **WHEN** a feature with rules is rendered
- **THEN** scenario and step counts match the summary
- **AND** every executed scenario remains in the triage and status matrix
- **AND** unexecuted scenarios are absent from both
- **AND** the summary remains version 2

#### Scenario: Legacy fallback

- **WHEN** the input is legacy Cucumber JSON
- **THEN** no rule or background structure is invented
- **AND** feature and scenario tags remain best effort
