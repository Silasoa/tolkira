# Spec Delta

## ADDED Requirements

### Requirement: Render the baseline comparison panel

When a baseline is supplied, the Report view SHALL render one "Compared with
baseline" panel before the needs-attention index. It SHALL show the baseline
status, the four tracked counts, the ambiguous-group count when positive and a
"Not in this run" list of at most 10 entries; beyond 10 it SHALL state the
remaining count and point to `--json`. The panel SHALL be escaped, printable,
visible without JavaScript, stay visible with a filter active, and use a
conditional CSS string.

#### Scenario: Panel position

- **WHEN** a report with a baseline is rendered
- **THEN** the panel sits after the toolbar and live region and before the
  needs-attention index

#### Scenario: Panel counts and list

- **WHEN** the comparison has two new failures, one fixed, three still failing
  and one not in this run
- **THEN** the panel shows those four counts and the baseline status
- **AND** it lists the not-in-this-run scenario under "Not in this run" with its
  feature, scenario, optional example and baseline status
- **AND** no entry is a link

#### Scenario: Capped list

- **WHEN** 15 baseline scenarios are not in this run
- **THEN** the panel lists 10
- **AND** it states that 5 more are in the JSON summary and names `--json`
- **AND** the count remains 15
- **AND** no dead "more" control is rendered

#### Scenario: Filter active

- **WHEN** a search, status filter or tag filter is active
- **THEN** the comparison panel stays visible with its whole-run counts
- **AND** the triage index and source strip still hide

#### Scenario: Localized

- **WHEN** the report locale is German
- **THEN** the panel heading, counts, list label and badges use the German
  catalog
- **AND** the JSON keys and CI text stay English

#### Scenario: No JavaScript and print

- **WHEN** the report is opened with JavaScript disabled or printed
- **THEN** the panel, list and badges are visible
- **AND** no script is needed to read them

#### Scenario: Hostile baseline text

- **WHEN** a baseline name, feature or URI contains HTML, script text, control
  characters or an absolute path
- **THEN** it renders as escaped text
- **AND** an absolute URI is reduced by the display-URI rule
- **AND** no link, file path or script is created
- **AND** the report still makes no network request

#### Scenario: Narrow viewport

- **WHEN** the panel is rendered at 320 px and 200 % text zoom
- **THEN** it wraps without horizontal page overflow

#### Scenario: No baseline bytes

- **WHEN** a report is rendered without a baseline
- **THEN** no baseline panel, badge or baseline CSS rule is present
- **AND** the HTML is byte-identical to before the change

#### Scenario: Baseline CSS

- **WHEN** a report is rendered with a baseline
- **THEN** the baseline CSS is appended to the report's style block
- **AND** the default `report.css` bytes are unchanged

### Requirement: Mark baseline row changes

New-failure and fixed rows SHALL carry a localized text badge; still-failing and
added rows SHALL not. The renderer SHALL join each scenario row by the report
model's pickle id.

#### Scenario: Row join

- **WHEN** a current scenario has a `new-failure` or `fixed` change
- **THEN** its row carries the matching badge
- **AND** a row with no change-map entry carries no badge

#### Scenario: No badge for other classes

- **WHEN** a row is still failing or added
- **THEN** it carries no change badge
- **AND** its existing status chrome stays unchanged
