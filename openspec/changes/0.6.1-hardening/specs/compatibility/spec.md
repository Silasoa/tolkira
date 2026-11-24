# Spec Delta

## MODIFIED Requirements

### Requirement: Write the merged legacy JSON sidecar

When `jsonDir` is used without `jsonFile`, the compatibility shim SHALL write a
merged legacy JSON array to `<output>.json` after the report HTML is written.
The array SHALL merge features by `uri`, concatenate duplicate `elements`, set
`retried: 0` on every element and use two-space indentation. Duplicate features
SHALL be merged by appending their elements one at a time; the merge SHALL NOT
use a spread that can exceed the engine's argument limit. The sidecar SHALL be
written atomically and SHALL create missing parent directories. `jsonFile` SHALL
NOT produce a sidecar.

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

#### Scenario: Large duplicate merge

- **WHEN** two same-URI features contain about 65,000 elements each
- **THEN** the sidecar is written without `RangeError`
- **AND** all about 130,000 elements are present
- **AND** their order is the input order
- **AND** every element has `retried: 0`
