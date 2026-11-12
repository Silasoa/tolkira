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
report path. It SHALL scan `jsonDir` recursively, SHALL create missing output
parent directories, and SHALL refuse to write over `jsonFile` or any file it
would read from `jsonDir`.

#### Scenario: Directory input

- **WHEN** `jsonDir` contains reports in nested subdirectories
- **THEN** the report includes all supported files

#### Scenario: Output would overwrite an input

- **WHEN** `output` resolves to `jsonFile` or to a report file inside `jsonDir`
- **THEN** generation fails with an error
- **AND** the input file is left unchanged

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

#### Scenario: Oversized file in a directory

- **WHEN** `jsonDir` contains a file above the 100 MB input cap and
  `ignoreBadJsonFile` is true
- **THEN** the shim checks the file size before reading it
- **AND** the file is skipped with a warning while valid reports are rendered

### Requirement: Do not transform legacy HTML

The shim SHALL consume the legacy input JSON and options, not the old rendered
HTML.

#### Scenario: Old HTML is irrelevant

- **WHEN** the user only has the old generated HTML and no input JSON
- **THEN** the shim fails with a message asking for the input JSON

### Requirement: Load the compat subpath from CommonJS

The compatibility subpath SHALL be loadable with `require()` and SHALL expose
an async `generate(options, callback?)` function. It SHALL delegate to the ESM
shim, forward the optional callback, and SHALL NOT add a default export.

#### Scenario: Require from CommonJS

- **WHEN** a CommonJS file requires `tolkira/compat/cucumber-html-reporter`
- **THEN** it receives an object with a `generate` function
- **AND** `await generate(options)` writes the report and returns the same
  result shape as the ESM import

#### Scenario: Legacy callback

- **WHEN** a CommonJS caller passes a callback to `generate`
- **THEN** the callback receives the same success/error result as the ESM shim
- **AND** the returned promise still resolves or rejects consistently

#### Scenario: Errors propagate

- **WHEN** the ESM shim rejects an option or fails to write the report
- **THEN** the returned promise rejects with the same error
- **AND** no report is left half-written

#### Scenario: No default export

- **WHEN** a caller reads `.default`
- **THEN** it is undefined
- **AND** the named `generate` path remains the only supported entry

#### Scenario: Node requirement

- **WHEN** the package is installed on Node 22 or later
- **THEN** the CJS wrapper loads
- **AND** older Node versions keep the documented engine error

### Requirement: Keep the core ESM-only

The CJS wrapper SHALL apply only to the compatibility subpath. The core package,
CLI and other exports SHALL remain ESM-only.

#### Scenario: Core require fails

- **WHEN** a CommonJS file requires the package root
- **THEN** it fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`
- **AND** no root `default` condition or CJS core build is shipped
