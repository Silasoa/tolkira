# Spec Delta

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