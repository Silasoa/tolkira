# Spec Delta

## ADDED Requirements

### Requirement: Accept a UTF-8 BOM before the history sidecar

Both `readHistory` and the schema peek used by `writeHistory` SHALL remove
exactly one leading U+FEFF from the bounded sidecar text before `JSON.parse`
and SHALL otherwise keep the existing validation and error text. The strip
SHALL live in the shared bounded read path. A read SHALL NOT rewrite the file.
`writeHistory` SHALL NOT emit a BOM, and its next successful write SHALL
replace a BOM-prefixed file with BOM-free bytes while keeping the runs the
append would otherwise keep.

#### Scenario: BOM-prefixed valid sidecar

- **WHEN** a valid history sidecar starts with one UTF-8 BOM
- **THEN** `readHistory` returns the documented runs
- **AND** the result equals the same file read without the BOM
- **AND** the file bytes and modification time are unchanged

#### Scenario: BOM-only file

- **WHEN** the sidecar contains only a UTF-8 BOM
- **THEN** `readHistory` rejects with
  `Invalid history file <file>: not valid JSON`
- **AND** the file is not rewritten

#### Scenario: BOM followed by invalid JSON

- **WHEN** the sidecar starts with one UTF-8 BOM and the rest is not valid JSON
- **THEN** `readHistory` rejects with the same `not valid JSON` error
- **AND** the file is not rewritten

#### Scenario: Two leading BOMs

- **WHEN** the sidecar starts with two U+FEFF characters followed by valid JSON
- **THEN** exactly one is stripped and the remaining U+FEFF is not valid JSON
- **AND** `readHistory` rejects with the same `not valid JSON` error
- **AND** the file is not rewritten

#### Scenario: Append to a BOM-prefixed sidecar

- **WHEN** a valid BOM-prefixed sidecar holds existing runs and a new run is
  written through the history append path
- **THEN** the schema peek accepts the file and keeps its stored schema version
- **AND** `readHistory` returns the documented runs
- **AND** the append and write succeed
- **AND** the rewritten file starts with `{` and contains no BOM
- **AND** its bytes equal the same append against the same sidecar without the
  BOM, so no run is lost

#### Scenario: No-BOM regression

- **WHEN** a valid sidecar has no BOM
- **THEN** `readHistory` returns exactly the runs it returned before this change
- **AND** the existing schema, size, regular-file and entry validation is
  unchanged

#### Scenario: Writer output is unchanged

- **WHEN** `writeHistory` writes a schema-1 or schema-2 sidecar
- **THEN** the file starts with `{` and contains no BOM
- **AND** the schema, validation, pruning and bytes are unchanged
