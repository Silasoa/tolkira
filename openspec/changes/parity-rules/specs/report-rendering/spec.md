# Spec Delta

## ADDED Requirements

### Requirement: Show feature and rule tags

The report SHALL render feature tags once in the feature header and rule tags
once in the rule section. Scenario rows SHALL display only their own scenario
tags; inherited feature, rule and examples tags SHALL remain available to the
tag filter and search but SHALL NOT be repeated on every row.

#### Scenario: Feature tags

- **WHEN** a feature has tags
- **THEN** the tags appear once in the feature header
- **AND** they remain available to the tag filter

#### Scenario: Rule tags

- **WHEN** a rule has tags
- **THEN** the tags appear once on the rule section
- **AND** scenarios under the rule do not repeat them

### Requirement: Render rule sections

For Cucumber Messages input, scenarios and outlines SHALL render under their
Gherkin rule with the rule keyword, name, description and tags. Features
without rules SHALL keep their current layout.

#### Scenario: Rule with scenarios

- **WHEN** a feature contains a rule with two scenarios
- **THEN** the rule heading, description and tags render once
- **AND** both scenarios render under the rule

#### Scenario: Rule with an outline

- **WHEN** a rule contains a scenario outline
- **THEN** the outline and its examples render inside the rule section

#### Scenario: Mixed feature-level and rule scenarios

- **WHEN** a feature has a scenario before a rule and a scenario inside it
- **THEN** feature-level and rule blocks are ordered by severity, then input
- **AND** scenarios do not move across rule boundaries

#### Scenario: Filtered rule

- **WHEN** a search, status or tag filter hides every scenario in a rule
- **THEN** the rule section is hidden
- **AND** a rule with a visible scenario keeps its heading and tags

#### Scenario: Rule tags in search

- **WHEN** the user searches for a rule name or tag
- **THEN** the matching scenarios remain visible
- **AND** the rule section is visible

### Requirement: Render background headings and descriptions

The report SHALL show the background keyword, name and description for
features and rules when the name or description is non-empty. Background steps
SHALL remain in their existing scenario step lists and SHALL NOT be duplicated
as a second step list. Synthetic backgrounds created by legacy normalisation
SHALL NOT be rendered.

#### Scenario: Feature background

- **WHEN** a feature has a background with a description
- **THEN** the background heading and description render once
- **AND** the scenario steps are unchanged

#### Scenario: Rule background

- **WHEN** a rule has a background
- **THEN** its heading and description render inside the rule section

### Requirement: Preserve counts, search and summary

Grouping by rule SHALL change presentation only. Counts, triage membership,
status matrix, tag filtering and the JSON summary SHALL keep using the flat
scenario list and SHALL remain unchanged. Search SHALL additionally index rule
and background names and descriptions; a matching rule or background keeps its
descendant scenarios visible.

#### Scenario: Counts unchanged

- **WHEN** a feature with rules is rendered
- **THEN** scenario and step counts match the summary
- **AND** every scenario remains in the triage and status matrix
- **AND** the summary remains version 1

#### Scenario: Legacy fallback

- **WHEN** the input is legacy Cucumber JSON
- **THEN** no rule or background structure is invented
- **AND** feature and scenario tags remain best effort

### Requirement: Keep structure safe and accessible

Rule/background names, descriptions and tags SHALL be escaped, the report SHALL
remain one offline file, and the structure SHALL be readable without
JavaScript.

#### Scenario: Untrusted rule text

- **WHEN** a rule or background name, description or tag contains HTML
- **THEN** it is displayed as text and no script executes

#### Scenario: No-JS

- **WHEN** the report is opened without JavaScript
- **THEN** rule and background headings remain visible
- **AND** no external request is introduced
