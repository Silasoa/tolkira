# Spec Delta

## ADDED Requirements

### Requirement: Show a skipped-attachment notice

When the run skipped path attachments, the report SHALL render one static,
escaped notice in the shared shell, visible on both the Report and Details
tabs. The notice SHALL name the count and the allowed roots by role and SHALL
NOT contain an absolute local path. The footer SHALL say that attachments are
embedded when available and SHALL NOT claim that every screenshot is embedded.

#### Scenario: Singular notice

- **WHEN** exactly one path attachment was skipped
- **THEN** the notice says that one path attachment was skipped
- **AND** it names its input file's folder and the working directory as the
  allowed roots
- **AND** it does not contain an absolute path

#### Scenario: Plural notice

- **WHEN** two or more path attachments were skipped
- **THEN** the notice names the count and uses the plural wording
- **AND** it refers to each input file's folder

#### Scenario: Both tabs

- **WHEN** the notice is rendered
- **THEN** it is visible on the Report tab and remains visible on Details
- **AND** it needs no JavaScript

#### Scenario: Alignment

- **WHEN** the notice is rendered at 1440 or 320 px
- **THEN** its left and right edges align with the run header

#### Scenario: Clean report

- **WHEN** no path attachment was skipped
- **THEN** no notice is rendered
- **AND** no warning markup appears in the body
- **AND** the footer keeps the neutral sentence
- **AND** only the shared stylesheet and the footer sentence differ from the
  previous report bytes

#### Scenario: Narrow viewport and text zoom

- **WHEN** the report is viewed at 320 px or at 200 % text zoom
- **THEN** the notice wraps without horizontal page overflow
