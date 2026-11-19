# Spec Delta

## ADDED Requirements

### Requirement: Show a Trends view

When at least two history entries are passed, the shell SHALL render a third
`Trends` tab with a table of the latest runs (newest first) and an inline SVG
sparkline of the pass rate. The table SHALL carry the data accessibly; the
sparkline SHALL be decorative. With no history or one entry, no Trends tab
SHALL be rendered. The static, no-JS report SHALL keep the Report view.

#### Scenario: Two runs

- **WHEN** the history has two or more entries
- **THEN** the tab bar shows Report, Details and Trends
- **AND** the Trends view lists the runs newest first
- **AND** the pass rate uses attempted (non-skipped) scenarios

#### Scenario: No attempt in a run

- **WHEN** a run has no attempted scenarios
- **THEN** its pass rate is shown as `—`
- **AND** the sparkline omits that point and draws no line with fewer than two
  points remaining

#### Scenario: Sparkline order

- **WHEN** the sparkline is rendered
- **THEN** it plots the runs by recorded time ascending, oldest to newest
- **AND** it uses a fixed viewBox and non-scaling strokes for 200 % zoom

#### Scenario: Table region

- **WHEN** the table is rendered
- **THEN** it sits in a labelled, focusable region and scrolls at narrow widths
- **AND** its header cells are scoped

#### Scenario: No or one run

- **WHEN** the history is absent or has one entry
- **THEN** no Trends tab is rendered
- **AND** the Report and Details tabs are unchanged

#### Scenario: Narrow viewport

- **WHEN** the Trends view is opened at 320 px
- **THEN** the table scrolls inside its region
- **AND** the page does not scroll horizontally

#### Scenario: No JavaScript

- **WHEN** the report is opened without JavaScript
- **THEN** the Report view stays visible
- **AND** the Trends tab is inert like Details
