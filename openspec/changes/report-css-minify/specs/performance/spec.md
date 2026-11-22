# Spec Delta

## ADDED Requirements

### Requirement: Minify the embedded report stylesheet

The asset build SHALL minify `src/render/report.css` before writing
`src/render/styles.ts`. The generated `REPORT_CSS` SHALL be smaller than the
source, SHALL remain one embedded stylesheet and SHALL NOT require a runtime
minifier, network request, new dependency or split asset. The source stylesheet
SHALL stay the readable source of truth.

#### Scenario: Build output is smaller

- **WHEN** `npm run styles` or `npm run assets` runs
- **THEN** `REPORT_CSS` is minified and shorter than `report.css`
- **AND** it is semantically equivalent (selectors, declarations and rules
  preserved apart from minifier-safe merges)

#### Scenario: Layout unchanged

- **WHEN** the browser gate renders the report at 320, 390, 768, 1024 and
  1440 px, 200 % text and print
- **THEN** the layout and overflow behaviour are unchanged
- **AND** no console error is introduced

#### Scenario: Source remains authoritative

- **WHEN** a developer edits `report.css`
- **THEN** `npm run styles` regenerates the minified `styles.ts`
- **AND** the generated file is not edited by hand
