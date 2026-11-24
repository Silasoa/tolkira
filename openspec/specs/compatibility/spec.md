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

The shim SHALL support `ignoreBadJsonFile` for directory inputs. It SHALL use
the same legacy feature-shape predicate as `detectInput`. A `jsonDir` file
whose JSON is not an array of legacy feature objects SHALL be skipped with the
existing skipped-file warning when `ignoreBadJsonFile` is true and SHALL still
fail generation when the flag is false.

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

#### Scenario: Non-feature JSON array

- **WHEN** `jsonDir` contains `numbers.json` with `[1,2,3]`, a valid legacy
  report and `ignoreBadJsonFile: true`
- **THEN** the valid report is rendered
- **AND** `numbers.json` is skipped with the existing skipped-file warning
- **AND** generation succeeds

#### Scenario: Array of non-feature objects

- **WHEN** `jsonDir` contains a JSON array of objects that lack the legacy
  feature shape and `ignoreBadJsonFile: true`
- **THEN** the file is skipped with the existing skipped-file warning
- **AND** it is not merged into the report or the legacy sidecar
- **AND** valid reports are rendered

#### Scenario: Bad array without the flag

- **WHEN** the same non-feature array is present and `ignoreBadJsonFile` is
  false
- **THEN** generation fails with the existing compat legacy-array error
- **AND** no report or sidecar is written

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

### Requirement: Write the merged legacy JSON sidecar

When `jsonDir` is used without `jsonFile`, the compatibility shim SHALL write a
merged legacy JSON array to `<output>.json` after the report HTML is written.
The array SHALL merge features by `uri`, concatenate duplicate `elements`, set
`retried: 0` on every element and use two-space indentation. The sidecar SHALL
be written atomically and SHALL create missing parent directories. `jsonFile`
SHALL NOT produce a sidecar.

#### Scenario: Seed-Test group shape

- **WHEN** `jsonDir` contains two features and `output` is
  `reports/group.html`
- **THEN** `reports/group.html.json` contains both features
- **AND** every element has `retried: 0`
- **AND** the report HTML is also written

#### Scenario: File input

- **WHEN** `jsonFile` is used, with or without `jsonDir`
- **THEN** no `<output>.json` is written

#### Scenario: Failed report write

- **WHEN** the HTML report cannot be written
- **THEN** no sidecar remains

### Requirement: Handle a previous or colliding sidecar

If `<output>.json` is itself an input whose features are all represented by the
other inputs, the shim SHALL treat it as a previous sidecar: exclude it from the
report inputs and replace it. If it contains a feature not represented by the
other inputs, generation SHALL fail without changing the input. On the strict
path, an invalid or non-legacy input at that reserved path SHALL be refused
before the HTML. `ignoreBadJsonFile: true` may skip an invalid reserved-path file
and replace the sidecar.

#### Scenario: Second group run

- **WHEN** `<output>.json` from an earlier run is inside `jsonDir` and all its
  feature URIs are also present in the other inputs
- **THEN** it is excluded from the report inputs
- **AND** the report has no duplicated features
- **AND** the sidecar is replaced atomically

#### Scenario: Source file collision

- **WHEN** `<output>.json` is an input with a feature URI that no other input
  represents
- **THEN** generation fails with a clear error
- **AND** the input file is unchanged
