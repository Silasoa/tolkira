# Spec Delta

## MODIFIED Requirements

### Requirement: Show a skipped-attachment notice

When the run skipped path attachments, the report SHALL render one static,
escaped notice in the shared shell, visible on both the Report and Details
tabs. The notice SHALL name the count and point to the affected scenarios. It
SHALL NOT contain an absolute local path or claim that every skip is outside the
roots. The footer SHALL say that attachments are embedded when available and
SHALL NOT claim that every screenshot is embedded. The static report SHALL keep
the same notice with wording that points into the report rather than a tab; the
notice is visible in the stacked Report section.

#### Scenario: Singular notice

- **WHEN** exactly one path attachment was skipped
- **THEN** the notice says that one path attachment was skipped
- **AND** it points to the affected scenario
- **AND** it does not contain an absolute path

#### Scenario: Plural notice

- **WHEN** two or more path attachments were skipped
- **THEN** the notice names the count and uses the plural wording
- **AND** it points to the affected scenarios

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
- **AND** the report differs from the previous bytes only by the shared
  stylesheet, the footer sentence and, in a scripted report, the third-party
  notice comment

#### Scenario: Narrow viewport and text zoom

- **WHEN** the report is viewed at 320 px or at 200 % text zoom
- **THEN** the notice wraps without horizontal page overflow

#### Scenario: Static notice

- **WHEN** the static report skipped path attachments
- **THEN** the notice names the count and points to the affected scenarios in
  the report
- **AND** it is visible in the stacked Report section without a tab

## ADDED Requirements

### Requirement: Carry the bundled component notice in the report

A report that embeds the client script SHALL carry the full MIT notice of every
third-party component bundled into that script as exactly one HTML comment at
the end of `<body>`, after the last element and outside every `<script>`. A
static report SHALL NOT carry the notice because it embeds no client script.
The notice SHALL name the component and its version and SHALL contain the
copyright and permission text of the installed license.

#### Scenario: A scripted report carries the notice

- **WHEN** a report is rendered without `--static`
- **THEN** the HTML contains one comment with the bundled component name,
  version, copyright line and the full MIT permission text
- **AND** the comment sits after the last element and outside every script
  element, so the CSP hashes are unchanged

#### Scenario: A static report stays clean

- **WHEN** a report is rendered with `--static`
- **THEN** it contains no third-party notice comment
- **AND** its characterization hash is the same as before the change

#### Scenario: A dependency bump cannot leave a stale notice

- **WHEN** the installed bundled component version or license text changes
  without the notice text and the package notice file changing with it
- **THEN** the unit test fails
- **AND** the failure names the component

#### Scenario: The rendered notice is the guarded constant

- **WHEN** the notice block is extracted from a rendered report
- **THEN** it equals the exported notice constant exactly
- **AND** the constant and the package notice file both contain the installed
  license text and the component line with the installed version