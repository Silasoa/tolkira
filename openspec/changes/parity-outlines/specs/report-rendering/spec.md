# Spec Delta

## ADDED Requirements

### Requirement: Group scenario-outline examples

For Cucumber Messages input, Tolkira SHALL render every pickle generated from
the same scenario outline under one outline section, with one subsection per
examples block and one numbered row per example. It SHALL NOT present those
pickles as unrelated scenario rows.

#### Scenario: Outline with two examples blocks

- **WHEN** the input contains a scenario outline with two examples blocks
- **THEN** the report shows one outline heading with the outline keyword and
  name
- **AND** each examples block has its own heading with its keyword and name
- **AND** the example rows are numbered `#1.1`, `#1.2`, `#2.1` and `#2.2` in
  Gherkin order

#### Scenario: Outline metadata appears once

- **WHEN** an outline has a description and tags and its examples block has tags
- **THEN** the outline description and outline tags are shown on the outline
  heading
- **AND** the examples tags are shown on the examples heading
- **AND** neither is repeated on every example row

#### Scenario: Example values remain visible in the steps

- **WHEN** an example row is opened
- **THEN** its steps show the values substituted for that example
- **AND** the substituted scenario name remains available to search and
  assistive technology without being repeated as the visible row heading

#### Scenario: Untrusted outline text is escaped

- **WHEN** an outline name, examples name, description or tag contains HTML
- **THEN** it is displayed as text and no markup or script executes

### Requirement: Preserve example outcomes and navigation

Grouping SHALL change presentation only. Each example SHALL keep its own
outcome, duration, steps, attachments and anchor, and SHALL remain part of the
existing counts, triage index, status matrix, search and filters.

#### Scenario: Failed example is visible

- **WHEN** one example fails and another passes in the same examples block
- **THEN** the failed row is open by default and shows its failed step, error
  and attachments
- **AND** the passed row remains collapsed

#### Scenario: Counts still count every example

- **WHEN** an outline with four examples is rendered
- **THEN** the summary, feature bar, status matrix and triage index count four
  scenarios, not one outline

#### Scenario: Search finds an example

- **WHEN** the user searches for text that occurs only in one example row
- **THEN** that row is visible and its outline and examples headings are visible
- **AND** non-matching example rows are hidden
- **AND** an outline or examples heading with no visible row is hidden

#### Scenario: Status and tag filters keep grouping

- **WHEN** a status or tag filter hides every row of an examples block
- **THEN** that examples block is hidden
- **AND** the outline remains visible only while it has a visible row

#### Scenario: Anchor opens the grouped example

- **WHEN** the user opens a `#scenario-...` link for an example row
- **THEN** the feature, outline and examples ancestors are revealed
- **AND** the example row is focused and scrolled into view

#### Scenario: Example order is stable

- **WHEN** outlines are ordered failed-first
- **THEN** examples blocks and rows keep their Gherkin order and numbering
- **AND** a failed row is open even when it is not the first row

### Requirement: Fall back to flat rendering without outline metadata

Tolkira SHALL keep the current flat scenario rendering when the input cannot
provide outline and examples structure.

#### Scenario: Legacy JSON stays flat

- **WHEN** the input is legacy Cucumber JSON with expanded outline examples
- **THEN** each example remains a normal scenario row
- **AND** Tolkira does not invent an outline or examples grouping

#### Scenario: Unlinked pickle falls back

- **WHEN** a Messages pickle cannot be linked to an outline and examples row
- **THEN** it is rendered as a normal scenario row
- **AND** the report still renders without an error

#### Scenario: Non-outline scenario is unchanged

- **WHEN** the input contains an ordinary scenario
- **THEN** it keeps its current heading, steps, status and anchor
