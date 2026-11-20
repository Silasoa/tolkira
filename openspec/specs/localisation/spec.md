# localisation Specification

## Purpose

The localisation capability defines how the report UI is translated: the ICU
JSON catalog format and its validation, deterministic per-build locale
selection with fallback, locale-sensitive number/date formatting, the
server/client message split, and the single-file and offline budgets.

## Requirements

### Requirement: Render report text from a locale catalog

The report UI SHALL render visible and accessibility strings from the active
locale catalog. Test data, Gherkin keywords, tags, doc strings, tables, error
text, attachment names, metadata and URIs SHALL render verbatim. CLI usage,
errors, the JSON summary and CI text SHALL stay English.

#### Scenario: German shell

- **WHEN** a report is generated with `--locale de`
- **THEN** the tabs, toolbar, filters, buttons, empty states, footer and
  accessibility labels are German
- **AND** the feature, scenario, step, tag, doc-string and attachment text is
  unchanged from the input

#### Scenario: Machine surfaces stay English

- **WHEN** `--locale de` is used with `--json` or `--ci`
- **THEN** the summary keys and values, the CI text and the exit codes are
  byte-identical to the English run
- **AND** the report is the only localized artifact

### Requirement: Store messages in ICU JSON catalogs

Catalogs SHALL be ICU MessageFormat JSON, one flat file per locale under
`src/i18n/locales/`, with sorted dotted keys. The English catalog SHALL carry a
description per message; other locales SHALL be value-only. Messages SHALL be
full sentences with placeholders, not concatenated fragments.

#### Scenario: Catalog shape

- **WHEN** a locale is added
- **THEN** it has one JSON file with the same keys as English
- **AND** every English entry has a description
- **AND** a plural message contains an `other` branch

#### Scenario: Full sentence

- **WHEN** a count or name is inserted
- **THEN** the catalog value is one complete sentence with `{placeholders}`
- **AND** no code concatenates a translated fragment with another

### Requirement: Keep the formatter and client subset small

The server formatter SHALL support placeholder interpolation and plural with
`#` and `other`. It SHALL NOT support select, nested plural/select or HTML. The
client SHALL support interpolation and `one`/`other` only and SHALL NOT import
the server formatter or any catalog.

#### Scenario: Unsupported syntax

- **WHEN** a message contains select, nested branches or HTML
- **THEN** the catalog check fails with the file and key
- **AND** the message is not shipped

#### Scenario: Client stays catalog-free

- **WHEN** the client bundle is built
- **THEN** it contains no German catalog and no server formatter
- **AND** it stays under 16 KB

### Requirement: Keep machine identifiers untranslated

Status identifiers, `data-*` values, CSS classes, URL state, summary keys and
values, CLI commands and the default brand title SHALL stay English. Only
visible labels and accessibility text SHALL be translated.

#### Scenario: German URL state

- **WHEN** a German report is filtered by `?hide=passed` and reloaded
- **THEN** the same scenarios are hidden
- **AND** the visible filter label is German

#### Scenario: Default title and history

- **WHEN** a German report is generated without `--title`
- **THEN** the title stays `Tolkira report`
- **AND** the history id and summary are unchanged
- **AND** `--title` still overrides the title

### Requirement: Resolve the locale deterministically

The CLI SHALL accept `--locale <tag>`; the render API SHALL accept a `locale`
option. The default SHALL be `en`. Matching SHALL be exact, then by primary
subtag (`de-AT` -> `de`). An unknown or empty tag SHALL exit 2 with the supported
list. There SHALL be no host auto-detection and no in-report switcher.

#### Scenario: Default and German

- **WHEN** no locale is given
- **THEN** the report is English
- **WHEN** `--locale de` is given
- **THEN** the report is German
- **AND** `<html lang="de" dir="ltr">` is set

#### Scenario: Regional fallback

- **WHEN** `--locale de-AT` is given
- **THEN** the German catalog is used
- **AND** the report records `lang="de-AT"`

#### Scenario: Unsupported locale

- **WHEN** `--locale fr` or `--locale ''` is given
- **THEN** the CLI exits 2 and names the supported locales
- **AND** nothing is written

#### Scenario: No implicit detection

- **WHEN** the process or browser locale is German and no option is given
- **THEN** the report stays English
- **AND** identical input produces identical bytes

### Requirement: Validate catalogs and fall back safely

Validation SHALL enforce key parity, placeholder equality, the active locale's
plural categories, non-empty values and `other` for every plural. A missing key
SHALL fall back to English, then to the key. A missing plural category SHALL use
`other`. The shipped German catalog SHALL be complete.

#### Scenario: Missing key

- **WHEN** a key exists in English but not in the active locale
- **THEN** the English value renders
- **AND** a validation test reports the missing key

#### Scenario: Missing plural category

- **WHEN** a count resolves to a category the locale does not define
- **THEN** the `other` branch renders

#### Scenario: Broken catalog

- **WHEN** a placeholder differs, a value is empty, a plural lacks `other`, or
  the keys differ
- **THEN** the catalog check fails with the file and key
- **AND** the report build does not ship the broken catalog

### Requirement: Format locale-sensitive values

Non-English locales SHALL format numbers, percentages, durations and dates with
native `Intl` and UTC. English SHALL keep the existing helpers and output.
Counts used for sorting, data attributes or the summary SHALL stay numeric.
German percentages and durations SHALL use the `Intl` output, including its
no-break space.

#### Scenario: German numbers and dates

- **WHEN** a German report shows a count, percentage, duration and recorded
  time
- **THEN** it uses German separators, a German date order and the locale's
  percent spacing
- **AND** the Trends table still sorts by the numeric value

#### Scenario: English unchanged

- **WHEN** an English report is generated
- **THEN** its visible numbers, percentages, durations and dates match the
  previous output
- **AND** only `dir="ltr"`, the client-message block, the client script and its
  CSP hash differ

### Requirement: Keep the report single-file and offline

Only the active locale's client messages SHALL be embedded. No catalog SHALL
enter the client bundle, and no request SHALL leave the page. The smallest
localized report SHALL add at most 10 KB over its English counterpart.

#### Scenario: No network

- **WHEN** the German report is opened with the network disabled
- **THEN** every label, filter and empty state works
- **AND** no request is made

#### Scenario: Size and client budget

- **WHEN** the smallest German report is compared with the English report
- **THEN** the difference is at most 10 KB
- **AND** the generated client bundle stays under 16 KB
