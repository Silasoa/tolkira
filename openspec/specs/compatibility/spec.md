# compatibility Specification

## Purpose

Compatibility adapters let existing cucumber-html-reporter scripts keep their
options object while rendering with Tolkira's offline report shell.

## Requirements

### Requirement: Run an existing cucumber-html-reporter script

The package SHALL expose `tolkira/compat/cucumber-html-reporter` with a
`generate(options, callback?)` function that accepts the legacy options object
and writes a Tolkira HTML report.

#### Scenario: Existing options are reused

- **WHEN** `generate` receives `jsonFile`, `output`, `brandTitle` and
  `metadata`
- **THEN** it writes one HTML report at `output` with that title and metadata
- **AND** no old option has to be renamed

#### Scenario: Callback compatibility

- **WHEN** the caller passes a callback and generation succeeds
- **THEN** the callback is called without an error
- **WHEN** generation fails
- **THEN** the callback receives the error

### Requirement: Map inputs and output

The shim SHALL accept `jsonFile` or `jsonDir` for input and `output` for the
report path. It SHALL scan `jsonDir` recursively and SHALL create missing
output parent directories.

#### Scenario: Directory input

- **WHEN** `jsonDir` contains reports in nested subdirectories
- **THEN** the report includes all supported files

#### Scenario: Missing output directory

- **WHEN** `output` points into a directory that does not exist
- **THEN** the directory is created and the report is written

### Requirement: Warn about unsupported options

The shim SHALL warn once for each ignored or approximated option and SHALL
still generate the report.

#### Scenario: Theme is ignored

- **WHEN** `theme: "bootstrap"` is passed
- **THEN** the report is generated with Tolkira's theme
- **AND** one warning names `theme`

#### Scenario: External screenshots are ignored

- **WHEN** `storeScreenshots` or `noInlineScreenshots` is set
- **THEN** attachments stay inline
- **AND** the warning explains that split assets are not supported

### Requirement: Skip bad files when asked

The shim SHALL support `ignoreBadJsonFile` for directory inputs.

#### Scenario: One malformed file in a directory

- **WHEN** `jsonDir` contains one malformed `.json` file and
  `ignoreBadJsonFile` is true
- **THEN** the valid reports are rendered
- **AND** the malformed file is reported in a warning

### Requirement: Do not transform legacy HTML

The shim SHALL consume the legacy input JSON and options, not the old rendered
HTML.

#### Scenario: Old HTML is irrelevant

- **WHEN** the user only has the old generated HTML and no input JSON
- **THEN** the shim fails with a message asking for the input JSON
