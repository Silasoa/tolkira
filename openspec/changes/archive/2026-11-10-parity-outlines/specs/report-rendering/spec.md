# Spec Delta

## ADDED Requirements

### Requirement: Group executed scenario-outline examples

For Cucumber Messages input, Tolkira SHALL render executed pickles from the
same scenario outline under one outline section. Each examples block with at
least one executed row SHALL become a subsection, and each executed example
SHALL become a numbered row. Unexecuted examples and blocks SHALL NOT be
rendered.

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
- **AND** the unexecuted block and its heading are absent
- **WHEN** only the second row of a one-block outline was executed
- **THEN** only `#1.2` is rendered and `#1.1` is absent
- **WHEN** an empty examples block precedes an executed block
- **THEN** the executed block keeps its original numbering, such as `#2.1`

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
- **THEN** its executed examples are grouped under the outline
- **AND** the rule name remains visible in the scenario detail metadata

#### Scenario: Untrusted outline text is escaped

- **WHEN** an outline or examples keyword, name, description or tag contains
  HTML or script text
- **THEN** it is displayed as text and no markup or script executes

### Requirement: Preserve example outcomes and navigation

Grouping SHALL change presentation only. Each executed example SHALL keep its
own outcome, duration, steps, attachments and anchor, and SHALL remain part of
the existing counts, triage membership, status matrix and JSON summary.

#### Scenario: Failed example is visible

- **WHEN** one example fails and another passes in the same examples block
- **THEN** the failed row is open by default and shows its failed step, error
  and attachments
- **AND** the passed row remains collapsed

#### Scenario: Attachments stay with their example

- **WHEN** two examples in one outline each have an image attachment
- **THEN** each row shows only its own image and attachment count
- **AND** opening an image still uses the lightbox

#### Scenario: Counts still count every example

- **WHEN** an outline with four executed examples is rendered
- **THEN** the summary, feature bar, status matrix and triage index count four
  scenarios, not one outline
- **AND** the JSON summary counts are unchanged because they are computed from
  envelopes

#### Scenario: Triage identifies the example

- **WHEN** two failing examples share the same pickle name
- **THEN** each triage label includes its example number
- **AND** when the examples block has a name, the label includes that name
- **AND** each triage link opens the correct grouped example row

#### Scenario: Copy failure keeps the scenario identity

- **WHEN** the user copies a failure from a grouped example
- **THEN** the copied text contains the substituted scenario name, the example
  number and the examples block name when present
- **AND** it still contains the feature, URI, failed step and error message

#### Scenario: Anchor opens the grouped example

- **WHEN** the user opens a `#scenario-...` link for an example row
- **THEN** the feature, outline and examples ancestors are revealed
- **AND** the example row is focused and scrolled into view

#### Scenario: Retry keeps one row per example

- **WHEN** an example was retried
- **THEN** the report shows one row with the latest attempt
- **AND** it does not render duplicate `#1.1` headings

### Requirement: Keep search and filters row-based

Search and filters SHALL operate on example rows. Outline and examples names
and tags SHALL be searchable, and headings with no visible row SHALL be hidden.

#### Scenario: Search finds an example by outline or examples name

- **WHEN** the user searches for the unsubstituted outline name or an examples
  block name
- **THEN** the matching example rows are visible and their outline and examples
  headings are visible
- **AND** non-matching example rows are hidden
- **AND** an outline or examples heading with no visible row is hidden

#### Scenario: Examples table values are not indexed

- **WHEN** the user searches for a value that appears only in the examples
  table and not in a substituted step
- **THEN** no example row matches solely because of the table value

#### Scenario: Status and tag filters keep grouping

- **WHEN** the user selects the `@failing` examples tag
- **THEN** the failing examples block and its outline heading remain visible
- **AND** the passing examples block is hidden
- **WHEN** the user selects the `@passing` examples tag
- **THEN** the reverse happens
- **AND** example numbering stays stable after filtering

#### Scenario: Search cap still applies

- **WHEN** a search matches more than 20 example rows
- **THEN** at most 20 rows are opened
- **AND** the visible note reports how many matches were expanded
- **AND** no empty outline or examples heading is left behind

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

#### Scenario: Executed outline without examples falls back

- **WHEN** a Messages scenario outline has no examples but has an executed test
  case
- **THEN** it is rendered as a normal flat scenario row
- **AND** the report documents this deliberate difference from the official
  formatter

#### Scenario: Non-outline scenario is unchanged

- **WHEN** the input contains an ordinary scenario
- **THEN** it keeps its current heading, steps, status and anchor
