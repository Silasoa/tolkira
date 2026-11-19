# Spec Delta

## ADDED Requirements

### Requirement: Keep an opt-in run history

The CLI SHALL accept `--history <file>` (requires `--out`) and keep an
aggregate run history in that sidecar. It SHALL read, append and write the file
atomically, keep the last 30 runs, and reject corrupt, oversized or unsupported
files before writing. A missing file starts empty. An identical last run SHALL
NOT be duplicated, where identity ignores the recorded time. Without the flag no
history is read or written and no history data enters the report.

#### Scenario: First run creates the sidecar

- **WHEN** `--history` points to a missing file and `--out` is set
- **THEN** the file is created with schema version 1 and one run entry
- **AND** the report is written normally
- **AND** the first run has no Trends tab

#### Scenario: Second run appends

- **WHEN** the sidecar already has entries and another report is generated with
  the same flag
- **THEN** the new run is appended
- **AND** the Trends view receives both entries

#### Scenario: Identical last run is not duplicated

- **WHEN** the last entry has the same aggregate id as the current run, even
  with a different recorded time
- **THEN** the file keeps one copy with the old timestamp
- **AND** the report still renders

#### Scenario: Retention

- **WHEN** the file already has 30 entries, or more from an older version
- **THEN** the oldest entries are dropped and the newest kept
- **AND** the file never grows past 30 entries

#### Scenario: Missing and invalid files

- **WHEN** the file is missing
- **THEN** generation succeeds with an empty history
- **WHEN** the file is not valid JSON, has a wrong schema version, exceeds the
  sidecar size cap, or has a malformed entry (bad ISO time, non-finite or
  negative count)
- **THEN** the CLI exits with code 1 and a message naming the file
- **AND** the file is not overwritten

#### Scenario: History requires HTML

- **WHEN** `--history` is used without `--out`
- **THEN** the CLI exits with a usage error naming both options
- **AND** nothing is written

#### Scenario: Path safety

- **WHEN** `--history` resolves to an input, the logo, `--out`, `--ci-out`, or
  a path inside an input directory (even when the file does not exist yet)
- **THEN** the CLI exits with a usage error
- **AND** nothing is written

#### Scenario: History write failure

- **WHEN** the sidecar cannot be written after a successful report
- **THEN** the CLI exits with code 1 and a message naming the file
- **AND** the already written HTML file stays in place
- **AND** no partial sidecar is left behind

#### Scenario: No history flag

- **WHEN** `--history` is absent
- **THEN** no history file is read or written
- **AND** no history data or Trends tab enters the report
- **AND** the Report and Details views are unchanged (only the shared client
  bundle and stylesheet may differ)

### Requirement: Document the history schema

The sidecar SHALL use `schemaVersion: 1` and entries with `id`, `recordedAt`
(ISO), `title` (the resolved report title), `status`, `counts` (features,
scenarios, steps), `durationMs` and `attachments` (total, bytes). It SHALL NOT
contain scenario names, step text, paths, tags or attachment content. Unknown
fields SHALL be ignored within schema version 1.

#### Scenario: Aggregate-only entry

- **WHEN** a run is recorded
- **THEN** the entry contains only the documented aggregate fields
- **AND** the documentation shows the schema, the retention and dedupe rules,
  and that a shared report embeds the prior-run aggregates it was generated with
