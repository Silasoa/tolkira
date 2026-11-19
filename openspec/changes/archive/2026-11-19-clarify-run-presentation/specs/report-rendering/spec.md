# Spec Delta

## ADDED Requirements

### Requirement: Compute pass ratios over attempted scenarios

The Report and Details views SHALL compute the pass ratio over attempted
scenarios: reported results whose status is not `skipped`. Skipped scenarios
SHALL remain in counts, status pills, filters, proportion bars and the feature
text. A run with results but no attempt SHALL show `No scenarios attempted`
instead of a percentage or a passed fraction. An empty run SHALL keep the
existing `0%` and `0 / 0`.

#### Scenario: Mixed run with a skip

- **WHEN** one scenario passed, one failed and one skipped, all in one feature
- **THEN** the Report header shows `50%` and `1 / 2 attempted`
- **AND** the feature row shows `1 passed of 2 attempted` and names `1 failed`
  and `1 skipped`
- **AND** the Details health shows `1 / 2 attempted`
- **AND** the status pill still shows the skipped count
- **AND** the proportion bar keeps a skipped segment

#### Scenario: Only skipped results

- **WHEN** every reported scenario is skipped
- **THEN** the Report and Details views show `No scenarios attempted`
- **AND** neither shows a percentage or a passed fraction
- **AND** a screen-reader note states that skipped results are not pass attempts
- **AND** the skipped count stays visible

#### Scenario: Empty run

- **WHEN** no scenario has a result
- **THEN** the Report header keeps `0%` and `0 / 0`

### Requirement: Show reported scenario counts

The Report header SHALL show the number of scenarios with a reported result as
`N scenario with results` or `N scenarios with results` and SHALL NOT label that
count as executed. When the run also contains unexecuted rows, the header SHALL
name them as `N unexecuted`.

#### Scenario: Unexecuted row is named

- **WHEN** two scenarios have results and one started test case has no result
- **THEN** the header shows `2 scenarios with results` and `1 unexecuted`
- **AND** the unexecuted scenario remains in the list

#### Scenario: Every scenario has a result

- **WHEN** every scenario row has a result
- **THEN** no unexecuted label is shown

### Requirement: Name a multi-file feature source

For each feature, the Details matrix SHALL always show the source label. The
Report row and the triage title SHALL use the same label whenever they render a
source; the Report row hides its source below the existing 900 px breakpoint.
The label is the file path when the display URIs of the feature's scenarios
reduce to exactly one non-empty value, and `N spec files` when they reduce to
more than one. No surface SHALL show one arbitrary file for a multi-file
feature.

#### Scenario: Project feature across files

- **WHEN** a feature's scenarios come from two spec files
- **THEN** its Report row, triage title and Details matrix row show
  `2 spec files`
- **AND** none of them shows either file path as the source

#### Scenario: Narrow viewport

- **WHEN** the viewport is too narrow for the Report row source
- **THEN** the Report row may hide the source
- **AND** the Details matrix still shows `2 spec files`

#### Scenario: Single-file feature

- **WHEN** all scenarios of a feature come from one spec file
- **THEN** its Report row, triage title and Details matrix row show that file
  path

### Requirement: Label summed durations

The Details view SHALL label the run duration `Test time` and the
feature-matrix duration column `Scenario time`. It SHALL state that test time
sums the final attempt per scenario and test-run hooks, that scenario time sums
the final attempt per scenario, and that neither is wall-clock time. The Report
header SHALL label its duration `Test time` and expose that explanation as its
title.

#### Scenario: Details labels

- **WHEN** a report is rendered
- **THEN** Details uses `Test time` for the run duration
- **AND** the feature matrix column is `Scenario time`
- **AND** Details states that neither value is wall-clock time
- **AND** the header shows `Test time` and exposes the sum as a title

## MODIFIED Requirements

### Requirement: Show the run environment in Details

The Details view SHALL show the producer, runtime, OS, CPU and protocol version
from the Messages meta envelope when available, plus user metadata, under the
producer-neutral heading `Run environment`.

#### Scenario: Messages meta is present

- **WHEN** the input contains a meta envelope
- **THEN** Details lists the available runtime, OS, CPU and protocol values
- **AND** user metadata is listed below them

#### Scenario: Native-only input

- **WHEN** a Playwright run provides environment metadata
- **THEN** the environment heading is `Run environment`
- **AND** the available producer, runtime, OS, CPU and protocol rows are listed
- **AND** unavailable rows are omitted
- **AND** the text `Cucumber environment` does not appear

### Requirement: Show the shape of each feature

The Report view SHALL show on every feature row the passed/total attempted
scenario count and a segmented proportion bar using the run's status colours.
Attempted scenarios are reported results whose status is not `skipped`; skipped
scenarios still appear in the bar and are named as text. The non-passing counts
SHALL also be named as text. A feature with no attempt SHALL state
`0 of 0 passed`; a feature with no reported result SHALL omit the proportion bar
and name no status.

#### Scenario: Mixed feature

- **WHEN** a feature has passed, failed and unexecuted scenarios
- **THEN** its row states `1 passed of 2 attempted` and names the failed count
- **AND** the bar has one segment per present reported status in the same order
  as the run bar

#### Scenario: Feature without scenarios

- **WHEN** a feature contains no scenarios
- **THEN** the report omits it from the feature list and the matrix

#### Scenario: Only unexecuted scenarios

- **WHEN** every scenario in a feature is unexecuted
- **THEN** its row states `0 of 0 passed`
- **AND** no proportion bar and no status counts are rendered
- **AND** the feature stays visible

#### Scenario: Only skipped results

- **WHEN** every reported scenario in a feature is skipped
- **THEN** its row states `0 of 0 passed` and names `1 skipped`
- **AND** the bar has a skipped segment

### Requirement: Handle empty features and runs

A feature's status SHALL be the worst status among reported results, or
`unknown` when none was reported. Its unexecuted rows stay visible without an
outcome. The header SHALL show the attempted passed/total count. When results
exist but none is an attempt, it SHALL show `No scenarios attempted` and keep
the status counts. An empty run SHALL show `0 / 0` and `0%` and SHALL render no
"Needs attention" index.

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

### Requirement: Mark executed and unexecuted scenarios

The model SHALL expose `executed` on every scenario row. A scenario is executed
when the runner reported a result: its selected test case has at least one raw
test-step result, including a hook result, or it was reported as skipped without
raw step results. Otherwise it is unexecuted and renders without an outcome. The
selected case is the latest started attempt; never-started pickles do not
produce a row.

#### Scenario: Scenario with no step results

- **WHEN** the selected test case for a scenario started with zero raw test-step
  results and was not reported as skipped
- **THEN** the row exists with `executed: false` and `status: "unknown"`
- **AND** the report shows it without an outcome
- **AND** it is not counted as passed, failed, skipped or unknown
- **AND** it is not listed in "Needs attention"

#### Scenario: Started but unfinished

- **WHEN** a test case started but has no finished step and no finish envelope
- **THEN** the scenario is rendered as unexecuted
- **AND** the row is not dropped

#### Scenario: Hook-only result is executed

- **WHEN** the selected test case produced a hook result and no pickle-step
  result
- **THEN** the scenario has `executed: true`
- **AND** its status comes from the worst raw test-step result, including the
  hook

#### Scenario: Reported skip

- **WHEN** a skipped scenario produced no raw step result
- **THEN** it has `executed: true` and `status: "skipped"`
- **AND** it stays visible with the skipped outcome

#### Scenario: Never-started pickle is pruned

- **WHEN** a pickle or outline example has no started test case
- **THEN** no scenario row is created for it
- **AND** counts and the summary do not include it

#### Scenario: Retry selection uses the latest attempt

- **WHEN** an earlier attempt has results and the latest started attempt has no
  results and was not reported as skipped
- **THEN** the latest attempt is selected
- **AND** the earlier retried attempt is ignored
- **AND** the scenario is unexecuted

### Requirement: Count only executed scenarios on every count surface

Scenario counts and outcome aggregates SHALL use reported results only: executed
scenarios, including skipped, on the header, feature row and bar, triage index,
source strip and Details matrix. The header pass ratio and the feature pass text
SHALL use attempted (non-skipped) results. Unexecuted rows SHALL remain visible
and searchable but SHALL NOT contribute to counts, percentages, bars, triage
membership or matrix cells.

#### Scenario: Mixed run

- **WHEN** a run contains reported and unexecuted scenarios
- **THEN** the header, feature rows, triage, source strip and matrix include
  only reported scenarios
- **AND** the unexecuted rows remain visible and searchable

#### Scenario: Header count

- **WHEN** a run has two reported scenarios, one passed and no skips
- **THEN** the header shows `1 / 2 attempted` and `50%`
- **AND** the status pills and status bar count only the two reported scenarios

#### Scenario: Feature bar

- **WHEN** a feature has one passed, one failed and one unexecuted scenario
- **THEN** the feature row states `1 passed of 2 attempted` and the failed count
- **AND** the bar has segments for passed and failed only

#### Scenario: Triage

- **WHEN** a run has a failed reported scenario and an unexecuted scenario
- **THEN** the triage index counts one of one reported scenario and links only
  the failed scenario
- **AND** the unexecuted row is absent from the index

#### Scenario: Source strip

- **WHEN** two input files contribute features and one scenario is unexecuted
- **THEN** each source card's scenario count, status and bar cover reported
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
  scenario
- **THEN** the row remains visible
- **AND** it still shows no outcome

### Requirement: Summary schema version 2

The JSON summary SHALL set `schemaVersion` to 2 and add `executed` to each
scenario. A reported skip without raw step results SHALL have `executed: true`
and `status: "skipped"` and SHALL be counted in `counts.scenarios`. An
unexecuted scenario SHALL remain in `scenarios` with `status: "unknown"` and
`executed: false` but SHALL NOT be counted in `counts.scenarios`, so
`counts.scenarios.total` MAY be less than `scenarios.length`. The overall
`status` SHALL use executed scenarios and test-run hooks only.
`counts.steps` and attachment counts SHALL keep their current meaning.

#### Scenario: Summary marks unexecuted

- **WHEN** a run contains an unexecuted scenario
- **THEN** its summary entry has `executed: false` and `status: "unknown"`
- **AND** `counts.scenarios.total` excludes it and is less than
  `scenarios.length`
- **AND** `schemaVersion` is 2

#### Scenario: Reported skip

- **WHEN** a skipped scenario produced no raw step result
- **THEN** its summary entry has `executed: true` and `status: "skipped"`
- **AND** `counts.scenarios.total` and `counts.scenarios.skipped` include it

#### Scenario: Executed scenario

- **WHEN** a scenario has at least one raw test-step result
- **THEN** its summary entry has `executed: true`
- **AND** it is counted as before

#### Scenario: Overall status ignores unexecuted

- **WHEN** a run has one passed executed scenario and one unexecuted scenario
- **THEN** the summary `status` is `passed`
- **AND** `counts.scenarios` reports one passed scenario

#### Scenario: Hook-only result is counted

- **WHEN** a scenario has a hook result and no pickle-step result
- **THEN** it has `executed: true`
- **AND** it is counted with the hook result's status

#### Scenario: Only unexecuted run

- **WHEN** every scenario in the run is unexecuted
- **THEN** the overall summary `status` is `unknown`
- **AND** `counts.scenarios.total` is 0
- **AND** every entry keeps `executed: false`

#### Scenario: Steps and attachments unchanged

- **WHEN** a run mixes an executed scenario with steps and attachments and an
  unexecuted scenario
- **THEN** `counts.steps` and the attachment counts cover the executed content
  only
- **AND** the unexecuted entry has no steps

#### Scenario: Never-started pickle is omitted

- **WHEN** a pickle never started
- **THEN** it has no `scenarios` entry and no count
