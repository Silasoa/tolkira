# Spec Delta

## MODIFIED Requirements

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
