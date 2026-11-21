# Spec Delta

## ADDED Requirements

### Requirement: Write the merged legacy JSON sidecar

When `jsonDir` is used without `jsonFile`, the compatibility shim SHALL write a
merged legacy JSON array to `<output>.json` after the report HTML is written.
The array SHALL merge features by `uri`, concatenate duplicate `elements`, set
`retried: 0` on every element and use two-space indentation. The sidecar SHALL
be written atomically and SHALL create missing parent directories. If
`<output>.json` is itself an input whose features are all represented by the
other inputs, it SHALL be treated as a previous sidecar: excluded from the
report inputs and replaced. If it contains a feature not represented by the
other inputs, generation SHALL fail without changing the input. `jsonFile`
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

#### Scenario: Failed report write

- **WHEN** the HTML report cannot be written
- **THEN** no sidecar remains
