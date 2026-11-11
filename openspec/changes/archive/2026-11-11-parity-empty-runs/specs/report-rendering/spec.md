# Spec Delta

## ADDED Requirements

### Requirement: Mark executed and unexecuted scenarios

The model SHALL expose `executed` on every scenario row. A scenario is executed
when its selected test case has at least one raw test-step result, including a
hook result; otherwise it is unexecuted and renders without an outcome. The
selected case is the latest started attempt; never-started pickles do not
produce a row.

#### Scenario: Scenario with no step results

- **WHEN** the selected test case for a scenario started with zero raw test-step
  results
- **THEN** the row exists with `executed: false` and `status: "unknown"`
- **AND** the report shows it without an outcome
- **AND** it is not counted as passed, failed, skipped or unknown
- **AND** it is not listed in “Needs attention”

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

#### Scenario: Never-started pickle is pruned

- **WHEN** a pickle or outline example has no started test case
- **THEN** no scenario row is created for it
- **AND** counts and the summary do not include it

#### Scenario: Retry selection uses the latest attempt

- **WHEN** an earlier attempt has results and the latest started attempt has no
  results
- **THEN** the latest attempt is selected
- **AND** the earlier retried attempt is ignored
- **AND** the scenario is unexecuted

### Requirement: Handle empty features and runs

A feature's status SHALL be the worst status among executed scenarios, or
`unknown` when none executed. Its unexecuted rows stay visible without an
outcome. The header SHALL show the executed passed/total count, including
`0 / 0` for an empty run, and an empty run SHALL render no "Needs attention"
index.

#### Scenario: All-unexecuted feature

- **WHEN** every scenario in a feature is unexecuted
- **THEN** the feature status is `unknown`
- **AND** the feature is visible and open by default
- **AND** its rows are collapsed and show no outcome

#### Scenario: Mixed executed and unexecuted feature

- **WHEN** a feature has one passed executed scenario and one unexecuted
  scenario
- **THEN** the feature status is `passed`
- **AND** its passed/total count and bar cover only the executed scenario

#### Scenario: Empty run

- **WHEN** the input contains a feature with a blank scenario and no results
- **THEN** the header shows `0 / 0` and `0 %`
- **AND** the feature and the blank row remain visible without an outcome
- **AND** no “Needs attention” index is rendered

#### Scenario: No scenario rows at all

- **WHEN** the input contains no scenario rows
- **THEN** the header shows `0 / 0`
- **AND** the existing “No scenarios in this report.” empty state remains

### Requirement: Count only executed scenarios on every count surface

Scenario counts and outcome aggregates SHALL use executed scenarios only on the
header, feature row and bar, triage index, source strip and Details matrix.
Unexecuted rows SHALL remain visible and searchable but SHALL NOT contribute to
counts, percentages, bars, triage membership or matrix cells.

#### Scenario: Mixed run

- **WHEN** a run contains executed and unexecuted scenarios
- **THEN** the header, feature rows, triage, source strip and matrix include
  only executed scenarios
- **AND** the unexecuted rows remain visible and searchable

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
  scenario
- **THEN** the row remains visible
- **AND** it still shows no outcome

### Requirement: Summary schema version 2

The JSON summary SHALL set `schemaVersion` to 2 and add `executed` to each
scenario. An unexecuted scenario SHALL remain in `scenarios` with
`status: "unknown"` and `executed: false` but SHALL NOT be counted in
`counts.scenarios`, so `counts.scenarios.total` MAY be less than
`scenarios.length`. The overall `status` SHALL use executed scenarios and
test-run hooks only. `counts.steps` and attachment counts SHALL keep their
current meaning.

#### Scenario: Summary marks unexecuted

- **WHEN** a run contains an unexecuted scenario
- **THEN** its summary entry has `executed: false` and `status: "unknown"`
- **AND** `counts.scenarios.total` excludes it and is less than
  `scenarios.length`
- **AND** `schemaVersion` is 2

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

### Requirement: Publish the version-2 migration contract

The documentation SHALL describe the version-2 summary contract: unexecuted
scenarios keep `status: "unknown"` and `executed: false`,
`counts.scenarios.total` may be less than `scenarios.length`, and agents SHALL
filter on `executed`. The version-1 tests and docs listed below SHALL be
updated.

#### Scenario: Agent guidance

- **WHEN** an agent reads `docs/AGENT-INTERFACE.md`
- **THEN** the examples show `schemaVersion: 2` and an `executed` field
- **AND** the field contract says to filter on `executed`

#### Scenario: Count relationship is documented

- **WHEN** the migration section is read
- **THEN** it states that `counts.scenarios.total` can be smaller than
  `scenarios.length`
- **AND** it states that an unexecuted scenario has `status: "unknown"` and
  `executed: false`

#### Scenario: No stale version-1 contract

- **WHEN** `test/cli`, `test/compat`, `test/render`, `test/summary`,
  `test/model`, `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md` and
  `docs/CUCUMBER-COMPATIBILITY.md` are searched after the change
- **THEN** no assertion expects `schemaVersion` 1
- **AND** no documentation calls the summary version 1

### Requirement: Fallbacks and safety

Legacy JSON and JUnit SHALL use the same executed detection on normalized
results. A legacy scenario with no executable steps or hooks SHALL be
unexecuted and uncounted, while a legacy step without a result SHALL remain
executed. No outcome SHALL be invented for an unexecuted row; names SHALL stay
escaped and the report SHALL stay offline.

#### Scenario: Legacy zero-step row

- **WHEN** legacy JSON has a scenario with no steps and no hooks
- **THEN** it renders without an outcome
- **AND** the model and summary mark it `executed: false`
- **AND** the scenario totals drop by one compared with version 1

#### Scenario: Legacy step without a result

- **WHEN** legacy JSON has a scenario with a step but no result status
- **THEN** normalization still emits an unknown step result
- **AND** the scenario remains executed and counted

#### Scenario: Legacy attachments

- **WHEN** legacy JSON has step attachments
- **THEN** they still render inline and count once
- **AND** execution detection does not change their totals

#### Scenario: Legacy unexecuted row

- **WHEN** legacy JSON has a scenario without a usable result
- **THEN** it renders without an outcome
- **AND** no new status is invented

#### Scenario: JUnit

- **WHEN** the input is JUnit XML
- **THEN** execution detection follows the parsed test case
- **AND** no network request is made

## MODIFIED Requirements

### Requirement: Show a needs-attention index

When at least one executed scenario is not passed, the Report view SHALL render
a "Needs attention" index above the feature list. It SHALL list one row per
feature that has at least one executed, non-passing scenario, with its worst
executed status, its executed non-passing scenario counts and up to three links
to its executed non-passing scenarios. Where a failed executed scenario has a
message, the row SHALL also show the failing step and the first line of the
message, truncated to 120 characters. It SHALL NOT render when every executed
scenario passed, including when the run has no executed scenarios.

#### Scenario: Index lists non-passing features

- **WHEN** a run has one failed and one pending executed feature
- **THEN** the index lists both before any passed feature
- **AND** each row shows the status as text and the failures per status

#### Scenario: Failure reason

- **WHEN** a feature has a failed scenario with a message
- **THEN** the row shows the failing step and the first message line
- **AND** the excerpt is escaped and truncated to 120 characters

#### Scenario: Scenario links are capped

- **WHEN** a feature has five executed non-passing scenarios
- **THEN** the index renders three scenario links
- **AND** a "2 more" note points to the report list without extra links

#### Scenario: Nothing to triage

- **WHEN** every executed scenario passed, or the run has no executed scenarios
- **THEN** no needs-attention index is rendered
- **AND** the feature list is unchanged apart from ordering

#### Scenario: Only unexecuted scenarios

- **WHEN** every scenario in the run is unexecuted
- **THEN** no needs-attention index is rendered
- **AND** the unexecuted rows remain visible without an outcome

#### Scenario: Filters are active

- **WHEN** the user searches, selects a tag or turns off a status filter
- **THEN** the index and source strip are hidden while the list shows the
  filtered results
- **AND** clearing the filters shows them again

#### Scenario: Narrow viewport

- **WHEN** the report is opened at 560 px or narrower
- **THEN** the index is a collapsed disclosure with a one-line summary
- **AND** expanding it reveals the rows

### Requirement: Show the shape of each feature

The Report view SHALL show on every feature row the passed/total executed
scenario count and a segmented proportion bar using the run's status colours.
The non-passing executed counts SHALL also be named as text. A feature with no
executed scenarios SHALL state `0 of 0 passed`, omit the proportion bar and name
no non-passing status.

#### Scenario: Mixed feature

- **WHEN** a feature has passed, failed and unexecuted scenarios
- **THEN** its row states the passed/total count for executed scenarios and the
  failed count as text
- **AND** the bar has one segment per present executed status in the same order
  as the run bar

#### Scenario: Feature without scenarios

- **WHEN** a feature contains no scenarios
- **THEN** the report omits it from the feature list and the matrix

#### Scenario: Only unexecuted scenarios

- **WHEN** every scenario in a feature is unexecuted
- **THEN** its row states `0 of 0 passed`
- **AND** no proportion bar and no status counts are rendered
- **AND** the feature stays visible

### Requirement: Compare features in the Details matrix

The Details view SHALL present one row per feature with the total executed
scenario count, one count column per status present among executed scenarios in
the run, and the duration. Status columns SHALL be ordered worst first. Zero
counts SHALL be rendered as a muted zero, not an empty cell. Unexecuted
scenarios SHALL NOT contribute to a row's total or cells, and the matrix SHALL
carry the caption “Executed scenarios only.”

#### Scenario: Mixed run

- **WHEN** the run contains failed, pending and passed executed scenarios
- **THEN** the matrix has failed, pending and passed columns
- **AND** every row's cells match the executed summary counts for that feature

#### Scenario: Clean run

- **WHEN** every executed scenario passed
- **THEN** the matrix has only the passed status column

#### Scenario: Only unexecuted scenarios

- **WHEN** a feature has no executed scenarios
- **THEN** its row total is 0
- **AND** its cells are muted zeros
- **AND** no status column appears unless an executed scenario in the run has
  that status

#### Scenario: Narrow viewport

- **WHEN** the matrix is wider than its container
- **THEN** it scrolls inside its labelled region
- **AND** the page itself does not scroll horizontally

### Requirement: Show source provenance only when real

When at least two input files contribute features and every feature URI
belongs to exactly one input, the Report view SHALL render a compact source
strip above the feature rows, with one card per input file that contributes at
least one feature, carrying the file name and that input's aggregates over
executed scenarios. Otherwise it SHALL render a flat list. The report SHALL NOT
infer a source from a feature URI, tag, directory or name.

#### Scenario: Two input files

- **WHEN** two files are merged into one report
- **THEN** the strip shows one card per file
- **AND** cards are ordered by worst executed status, then input order
- **AND** scenario counts and bars cover executed scenarios only

#### Scenario: All-unexecuted input

- **WHEN** an input contributes only features whose scenarios are unexecuted
- **THEN** its card shows the feature count, `0 scenarios` and status `unknown`
- **AND** the card renders no proportion bar

#### Scenario: One contributing file

- **WHEN** two files are merged but only one contributes features
- **THEN** no source strip is rendered

#### Scenario: One input file

- **WHEN** a single file contains several features
- **THEN** no source strip is rendered

#### Scenario: Shared or missing provenance

- **WHEN** a feature URI appears in two inputs, or a Messages stream has no
  file boundary
- **THEN** the report renders a flat feature list
- **AND** no source name is derived from the URI

### Requirement: Group executed scenario-outline examples

For Cucumber Messages input, Tolkira SHALL group pickles from the same
scenario outline under one outline section. Each examples block with at least
one rendered row SHALL become a subsection, and each rendered example SHALL
become a numbered row. Examples and blocks whose test case never started SHALL
NOT be rendered. An example whose selected test case started with zero raw
test-step results SHALL render as an unexecuted row with its original numbering
and no outcome.

#### Scenario: Two outlines in one feature

- **WHEN** the input contains the Compatibility Kit `examples-tables` feature
  with two scenario outlines
- **THEN** the report shows two outline sections
- **AND** the first outline shows examples headings for `These are passing`
  and `These are failing` with rows `#1.1`, `#1.2`, `#2.1` and `#2.2`
- **AND** the second outline shows one unnamed examples heading with rows
  `#1.1`, `#1.2` and `#1.3`
- **AND** the second outline heading keeps the unsubstituted name
  `Eating cucumbers with <friends> friends`

#### Scenario: Unexecuted rows and blocks are omitted

- **WHEN** only the second examples block of a two-block outline was executed
- **THEN** only that block is rendered, with its original numbering starting
  at `#2.1`
- **AND** the never-started block and its heading are absent
- **WHEN** only the second row of a one-block outline was executed
- **THEN** only `#1.2` is rendered and `#1.1` is absent
- **WHEN** an empty examples block precedes an executed block
- **THEN** the executed block keeps its original numbering, such as `#2.1`

#### Scenario: Started example without results

- **WHEN** an outline example's selected test case started with zero raw
  test-step results
- **THEN** its numbered row is rendered without an outcome
- **AND** its examples block heading is visible
- **WHEN** that example never started instead
- **THEN** its row and any empty examples block are absent

#### Scenario: Outline and examples metadata appear once

- **WHEN** an outline has a description and tags and its examples block has
  tags and a description
- **THEN** the outline tags are shown above the outline heading and the outline
  description below it
- **AND** the examples tags are shown above the examples heading and the
  examples description below it
- **AND** neither description nor those tags is repeated on every example row
- **AND** an examples block with an empty name renders `Examples:`

#### Scenario: Example values remain visible in the steps

- **WHEN** an example row is opened
- **THEN** its steps show the values substituted for that example
- **AND** the examples table values are not rendered as a separate table
- **AND** the substituted scenario name remains available to search, the
  copy-failure text and assistive technology without being repeated as the
  visible row heading

#### Scenario: Row tags stay filterable but not visible

- **WHEN** an outline has examples tags
- **THEN** the tags appear on the examples heading, not on every row
- **AND** the row still carries the full pickle tags for the tag filter and
  `data-tags`

#### Scenario: Outline inside a Rule still groups

- **WHEN** a scenario outline is nested inside a Rule
- **THEN** its rendered examples are grouped under the outline
- **AND** the rule name remains visible in the scenario detail metadata

#### Scenario: Untrusted outline text is escaped

- **WHEN** an outline or examples keyword, name, description or tag contains
  HTML or script text
- **THEN** it is displayed as text and no markup or script executes

### Requirement: Open non-passed results by default

The report SHALL open features and executed scenarios whose status is not
`passed` by default, including undefined, ambiguous, pending, skipped and
unknown results. A feature whose scenarios are all unexecuted SHALL open by
default, while its unexecuted rows SHALL remain collapsed and show no outcome.
The search auto-open cap SHALL remain in force.

#### Scenario: Undefined scenario

- **WHEN** a feature contains an undefined scenario
- **THEN** the feature and the undefined scenario are open
- **AND** its diagnostic is visible without a click

#### Scenario: Pending and skipped scenarios

- **WHEN** a feature contains pending or skipped scenarios
- **THEN** those scenarios are open by default
- **AND** passed scenarios remain collapsed

#### Scenario: Unexecuted scenario

- **WHEN** a scenario has no raw test-step result
- **THEN** its row stays collapsed and shows no status label
- **AND** when every scenario in its feature is unexecuted, the feature opens

#### Scenario: Search cap

- **WHEN** a search matches more than 20 scenarios
- **THEN** at most 20 newly matched scenarios are opened by the search
- **AND** the existing "20 of N" note is shown only when 20 new rows were opened

### Requirement: Preserve the summary and fallback contracts

The JSON summary SHALL use schema version 2. Hooks SHALL remain entries in
`scenarios[].steps` with `keyword: "Hook"`, and an optional hook `name` is
added additively. Each scenario SHALL carry `executed`; a scenario whose
selected test case started with zero raw test-step results SHALL have
`executed: false` and `status: "unknown"` and SHALL NOT be counted in
`counts.scenarios`, while remaining in `scenarios`. A failed test-run hook
SHALL make the summary status failed. The HTML report SHALL separate hooks and
label its step counts as excluding them.

#### Scenario: Summary stays version 1

- **WHEN** a version-1 consumer reads the summary
- **THEN** it must check `schemaVersion` and reject version 2 instead of
  silently misreading the executed-only counts
- **AND** the hook entry shape itself keeps `keyword: "Hook"` and an optional
  name

#### Scenario: Hook entry shape is retained

- **WHEN** a version-2 Messages run with hooks is summarised
- **THEN** hook entries keep `keyword: "Hook"` and a named hook carries its name
- **AND** the HTML report still separates hooks from steps

#### Scenario: Summary is version 2

- **WHEN** a Messages run is summarised
- **THEN** `schemaVersion` is 2
- **AND** an executed scenario carries `executed: true`

#### Scenario: Unexecuted summary entry

- **WHEN** a scenario's selected test case started with zero raw test-step
  results
- **THEN** its summary entry has `executed: false` and `status: "unknown"`
- **AND** `counts.scenarios.total` excludes it and may be less than
  `scenarios.length`
- **AND** the overall summary `status` ignores it

#### Scenario: Failed run hook fails the summary

- **WHEN** a BeforeAll or AfterAll hook fails after otherwise passing scenarios
- **THEN** the JSON summary status is failed
- **AND** CI can detect the failure from the documented interface

#### Scenario: Two step totals are labelled

- **WHEN** the Details view shows the model step count and the embedded summary
- **THEN** the HTML count is labelled as excluding hooks
- **AND** the summary count is labelled as including hook entries
- **AND** a Hooks count is shown separately

#### Scenario: Legacy hooks

- **WHEN** the input is legacy Cucumber JSON with before/after hooks
- **THEN** the hooks render as per-scenario hook rows with status, duration,
  error and attachments
- **AND** no test-run Hooks section is invented
- **AND** the compatibility shim still returns the summary

#### Scenario: JUnit without hooks

- **WHEN** the input is JUnit XML
- **THEN** no hook rows or Hooks section are rendered

### Requirement: Preserve counts and summary

Diagnostics SHALL not change scenario, step or attachment counts, executed
filtering, triage membership or the JSON summary schema version.

#### Scenario: Counts unchanged

- **WHEN** a report with undefined and ambiguous steps is rendered
- **THEN** its scenario counts match the summary scenario counts, using
  executed scenarios only
- **AND** the summary remains version 2
- **AND** undefined suggestions and ambiguous definitions are also exposed as
  optional summary-step fields, without changing the schema version

#### Scenario: JUnit without diagnostics

- **WHEN** the input is JUnit XML
- **THEN** no undefined or ambiguous diagnostics are rendered

### Requirement: Preserve counts, search and summary

Grouping by rule SHALL change presentation only. Counts, triage membership,
status matrix and the JSON summary SHALL keep using the flat list of executed
scenarios, while search and tag filtering SHALL keep using all scenario rows.
Unexecuted scenarios SHALL remain visible and searchable but SHALL NOT
contribute to counts, triage membership or status matrix cells. Search SHALL
additionally index rule and background names and descriptions; a matching rule
or background keeps its descendant scenarios visible.

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
