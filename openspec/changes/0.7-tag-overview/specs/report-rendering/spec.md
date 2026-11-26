# Spec Delta

## ADDED Requirements

### Requirement: Show a tag overview with counts

The Details view SHALL render a tag overview when at least one rendered
scenario row carries a tag. Each row SHALL show the tag, its scenario count,
its failed count and its skipped count. The overview SHALL NOT react to the
toolbar filter and SHALL be absent when no row carries a tag.

#### Scenario: Counts per tag

- **WHEN** three executed rows carry `@smoke`, two failed and one skipped
- **THEN** the `@smoke` row shows `3` scenarios, `2` failed and `1` skipped

### Requirement: Count executed rows and each tag once

The scenario and status counts SHALL cover executed rows only, matching every
other scenario count in the report; failed and skipped count those statuses
only. A tag on an unexecuted row only SHALL render with zero counts. Inherited
and duplicate tags SHALL count each affected row once.

#### Scenario: Inherited tags

- **WHEN** a feature carries `@team` and three executed scenario rows sit under
  it
- **THEN** the `@team` row shows `3` scenarios
- **AND** an outline example tag counts each executed rendered example row once

#### Scenario: Unexecuted row

- **WHEN** only an unexecuted row carries `@wip`
- **THEN** the `@wip` row shows `0` scenarios, `0` failed and `0` skipped
- **AND** the tag still appears in the tag filter

#### Scenario: No tags

- **WHEN** no rendered scenario row carries a tag
- **THEN** the tag overview heading and table are absent

#### Scenario: German report

- **WHEN** the report locale is `de`
- **THEN** the heading, note, aria-label, column labels and remainder sentence
  are German
- **AND** counts use the locale number format and tag names render verbatim

#### Scenario: Overview is not a filter

- **WHEN** a toolbar search, status filter or tag filter hides scenarios
- **THEN** the tag overview keeps its complete counts
- **AND** the tag filter keeps its option set and behaviour

### Requirement: Order and bound the tag overview

Tag rows SHALL sort by failed count descending, then by scenario count
descending, then by tag in the fixed UTF-16 code-unit order, so a failing tag is
hidden by the 50-row cap only when more than 50 tags have a failed row. The
table SHALL be capped at 50 rows and SHALL state the complete distinct tag
count when the cap hides rows.

#### Scenario: Sort order

- **WHEN** one tag has 1 failed of 2 and another has 40 passed of 40
- **THEN** the failing tag comes first
- **AND** equal failed and scenario counts order by tag in the fixed UTF-16
  code-unit order

#### Scenario: Large tag set

- **WHEN** 60 distinct tags carry scenarios and fewer than 50 have a failed row
- **THEN** the table shows 50 rows
- **AND** one sentence states `Showing 50 of 60 tags` with the complete count
- **AND** every tag with a failed row stays in the visible 50

#### Scenario: More failing tags than rows

- **WHEN** 60 tags have a failed row
- **THEN** the table shows the 50 with the highest failed count, then scenario
  count, then code-unit tag order
- **AND** the remainder sentence states the complete count

### Requirement: Render the tag overview in every form

The table SHALL render in the default, static and print forms, and the static
form SHALL need no script. At 320 px with 200 % text the table SHALL scroll
inside its panel without overflowing the page.

#### Scenario: Static report

- **WHEN** the report is rendered with `--static`
- **THEN** the tag overview is visible without a script
- **AND** the table keeps its heading, columns and counts

#### Scenario: Narrow viewport and print

- **WHEN** the report is viewed at 320 px with 200 % text zoom
- **THEN** the table scrolls inside its panel and the page does not overflow
- **AND** the print form repeats the header row and does not split a row
