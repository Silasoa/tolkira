# Spec Delta

## ADDED Requirements

### Requirement: Add a report locale option

The CLI SHALL accept `--locale <tag>` for the HTML report. It SHALL require
`--out`, default to `en`, and apply to the report only. `--json`, `--ci` and
their outputs SHALL stay English and byte-identical. An empty or unsupported tag
SHALL be a usage error naming the supported locales.

#### Scenario: Locale with HTML

- **WHEN** `--locale de --out report.html` is used
- **THEN** the report is German
- **AND** the process exits 0

#### Scenario: Locale without HTML

- **WHEN** `--locale de` is used with `--json` or `--ci` and no `--out`
- **THEN** the CLI exits 2 and says the option needs `--out`
- **AND** stdout and files are unchanged

#### Scenario: Unsupported tag

- **WHEN** `--locale fr` is used
- **THEN** the CLI exits 2 with the supported list
- **AND** no report or history file is written

### Requirement: Expose the locale on the render API

`RenderReportOptions` and `RenderOptions` SHALL accept an optional `locale`.
`renderReport` and `CucumberHtmlStream` SHALL render the given locale and
`generateReport` SHALL pass it through. The default SHALL be `en`. The summary,
JSON keys and CI text SHALL not change.

#### Scenario: API parity

- **WHEN** `renderReport` and `CucumberHtmlStream` receive the same model and
  `locale: 'de'`
- **THEN** both produce German report HTML
- **AND** neither changes the summary or CI output

#### Scenario: Default

- **WHEN** the option is omitted
- **THEN** the HTML is English
- **AND** the existing English goldens stay valid apart from `dir="ltr"`, the
  documented client-message block, the generated script and its CSP hash

#### Scenario: Unsupported API locale

- **WHEN** `renderReport` or `CucumberHtmlStream` receives an unknown locale
- **THEN** it throws an error naming the supported locales
- **AND** no partial HTML is returned
