# Spec Delta

## ADDED Requirements

### Requirement: Make the history window configurable

The CLI SHALL accept `--history-limit <n>` only with `--history`. `n` SHALL be a
decimal integer from 1 to 365; the default SHALL be 30. The limit SHALL bound
the runs read, appended, written and rendered in Trends. An invalid value SHALL
exit 2 naming the range; without `--history` it SHALL exit 2 naming both
options. Without the flag the 30-run behaviour SHALL be unchanged.

#### Scenario: Smaller window

- **WHEN** `--history-limit 5` is used with a sidecar that holds seven runs
- **THEN** the newest five runs are read, written and rendered in Trends
- **AND** the report is generated normally
- **AND** the process exits 0

#### Scenario: Larger window

- **WHEN** `--history-limit 40` is used with a sidecar that holds 40 runs and a
  new current run
- **THEN** the current run is appended and the newest 40 of the 41 runs are kept
- **AND** all 40 kept runs are rendered in Trends
- **AND** the file does not grow past 40 runs

#### Scenario: One run

- **WHEN** `--history-limit 1` is used
- **THEN** the sidecar keeps one run
- **AND** no Trends tab is rendered

#### Scenario: Default

- **WHEN** `--history` is used without `--history-limit`
- **THEN** the window is 30
- **AND** the report and CI bytes match the previous release
- **AND** the email matches except its generated timestamp
- **AND** the JSON is byte-identical today; the additive outline `example` field
  is the only final 0.6.0 delta and is owned by the baseline change

#### Scenario: Invalid value

- **WHEN** `--history-limit` is `0`, `366`, `1.5`, `abc`, `05` or empty
- **THEN** the CLI exits 2 and names the range 1 to 365
- **AND** no report or sidecar is written

#### Scenario: Missing history option

- **WHEN** `--history-limit 10` is used without `--history`
- **THEN** the CLI exits 2 and names both options
- **AND** nothing is written

#### Scenario: Missing HTML

- **WHEN** `--history --history-limit 10` is used without `--out`
- **THEN** the existing `--history` requires `--out` error exits 2
- **AND** nothing is written

#### Scenario: Help lists the option

- **WHEN** `--help` is requested
- **THEN** the usage text lists `--history-limit <n>`

### Requirement: Keep the sidecar schema and cap

The reader SHALL accept schema version 1 and 2. The writer SHALL write schema 1
unless the limit is above 30 or the file is already schema 2, then schema 2. The
writer SHALL prune the oldest entries until the serialized file is at or below
1,048,576 bytes and SHALL never write a file the reader would reject. A file
above 1 MiB or with an invalid entry SHALL be rejected without a rewrite.

#### Scenario: Default schema

- **WHEN** a schema-1 file is written with the default limit
- **THEN** the file stays schema version 1

#### Scenario: Extended schema

- **WHEN** a file is written with `--history-limit 40`, or the read file was
  already schema 2
- **THEN** the file is schema version 2
- **AND** no run field changes

#### Scenario: Writer stays under the cap

- **WHEN** a schema-2 file's serialized form would exceed 1,048,576 bytes
- **THEN** the writer drops the oldest entries until the bytes are at or below
  the cap
- **AND** the newest entry remains
- **AND** the written file re-reads successfully

#### Scenario: Oversized or invalid file

- **WHEN** the sidecar is above 1 MiB or has an invalid entry
- **THEN** the CLI exits 1 and names the file
- **AND** the file is not rewritten

### Requirement: Prune to the configured window

A lower limit SHALL prune on the next successful write; a higher limit SHALL NOT
recover dropped runs. A 0.5 reader SHALL reject a schema-2 file with its visible
unsupported-version error and leave it untouched.

#### Scenario: Prune on write

- **WHEN** a 31-entry sidecar is read with `--history-limit 10` and a new current
  run is generated
- **THEN** the newest 10 runs are read and the report shows 10
- **AND** the current run is appended unless it dedupes
- **AND** the next successful write stores the newest 10 runs
- **AND** the 21 runs older than the read window are gone

#### Scenario: Raise within the file

- **WHEN** a 31-entry sidecar is read with `--history-limit 40` and a new current
  run is generated
- **THEN** all 31 runs are read
- **AND** the current run is appended unless it dedupes
- **AND** the next write stores 32 runs, not 40

#### Scenario: Dedupe

- **WHEN** the last run is identical to the current run
- **THEN** it is not appended
- **AND** the old timestamp stays
- **AND** the window still bounds the list

#### Scenario: Dropped runs stay dropped

- **WHEN** a window was lowered and the file was written
- **THEN** raising the limit later does not restore the dropped runs
- **AND** the report renders the runs that remain

#### Scenario: Older reader

- **WHEN** a 0.5 reader opens a schema-2 sidecar
- **THEN** it exits 1 with its unsupported-version error
- **AND** the file is not rewritten or truncated

### Requirement: Expose the limit on the API

`readHistory`, `appendHistory` and `writeHistory` SHALL accept an optional
limit and SHALL default an omitted limit to 30; `generateReport` SHALL accept
`historyLimit` with the same default; an invalid limit SHALL throw a clear error.
`renderReport` and `CucumberHtmlStream` SHALL render the list they are given and
SHALL NOT prune it.

#### Scenario: History functions

- **WHEN** `readHistory`, `appendHistory` or `writeHistory` receives a limit of
  5
- **THEN** it keeps the newest five runs
- **AND** the same validation range applies

#### Scenario: Default limit

- **WHEN** an API function is called without a limit
- **THEN** it uses exactly 30
- **AND** `generateReport` returns at most 30 runs

#### Scenario: generateReport

- **WHEN** `generateReport` receives `historyLimit: 5`
- **THEN** the returned history has at most five runs
- **AND** the report's Trends view renders those five

#### Scenario: renderReport as given

- **WHEN** `renderReport` receives a 40-entry history list
- **THEN** it renders all 40 runs
- **AND** it does not prune the list

#### Scenario: Invalid API limit

- **WHEN** an API function receives `0`, `366`, `1.5` or a non-number
- **THEN** it throws an error naming the range 1 to 365
- **AND** it writes no file

## MODIFIED Requirements

### Requirement: Keep an opt-in run history

The CLI SHALL accept `--history <file>` and `--history-limit <n>` and keep an
aggregate run history in that sidecar. It SHALL read, append and write
atomically, keep the newest configured number of runs (default 30, range 1 to
365), and reject corrupt, oversized or unsupported files before writing. The
reader SHALL accept schema version 1 and 2; the writer SHALL write schema 1 for a
default run on a schema-1 file and schema 2 when the limit is above 30 or the
file already uses schema 2. A missing file starts empty. An identical last run
SHALL NOT be duplicated. Without the flag no history is read or written and no
history data enters the report.

#### Scenario: First run creates the sidecar

- **WHEN** `--history` points to a missing file, `--out` is set and the limit is
  the default 30
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

- **WHEN** the file already has more entries than the configured window, or 30
  entries with the default
- **THEN** the newest configured number of runs is read
- **AND** the current run is appended unless it dedupes
- **AND** the newest configured number of runs is kept, so 31 entries with a
  limit of 40 store 32 and 40 entries with a limit of 40 store 40
- **AND** the file never grows past the configured window

#### Scenario: Configured window

- **WHEN** `--history-limit 5` is used with seven existing entries
- **THEN** the newest five are read
- **AND** the current run is appended unless it dedupes
- **AND** the report renders five Trends rows and the file stores five

#### Scenario: Missing and invalid files

- **WHEN** the file is missing
- **THEN** generation succeeds with an empty history
- **WHEN** the file is not valid JSON, has a schema version other than 1 or 2,
  exceeds the sidecar size cap, or has a malformed entry (bad ISO time,
  non-finite or negative count)
- **THEN** the CLI exits with code 1 and a message naming the file
- **AND** the file is not overwritten

#### Scenario: History requires HTML

- **WHEN** `--history` is used without `--out`
- **THEN** the CLI exits with a usage error naming both options
- **AND** nothing is written

#### Scenario: Path safety

- **WHEN** `--history` resolves to an input, the logo, `--out`, `--pdf`,
  `--email`, `--ci-out`, `--baseline`, or a path inside an input directory
  (even when the file does not exist yet)
- **THEN** the CLI exits with a usage error
- **AND** nothing is written

`--baseline` is owned by the `0.6-baseline-comparison` change. Until that flag
lands the CLI cannot receive it; the row names the final 0.6.0 state, and the
same note is kept in both changes' tasks.

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

The sidecar SHALL use `schemaVersion: 1` for a default write on a schema-1 or
missing file and `schemaVersion: 2` when the limit is above 30 or the target file
already uses version 2. Readers SHALL accept version 1 and 2 and reject any other
version. Entries SHALL use `id`, `recordedAt` (ISO), `title` (the resolved report
title, capped at 200 code points), `status`, `counts` (features, scenarios,
steps), `durationMs`, `attachments` (total, bytes) and an optional `flaky`
count. It SHALL NOT contain scenario names, step text, paths, tags or attachment
content. Unknown fields SHALL be ignored within a supported version. The writer
SHALL validate every stored run with the reader's field rules, SHALL reject an
`id` longer than 128 UTF-16 code units (the reader keeps accepting longer ids
from older files) and SHALL never write a file above 1,048,576 bytes. A 0.5
reader SHALL reject version 2 with its visible unsupported-version error and
leave the file untouched.

#### Scenario: Aggregate-only entry

- **WHEN** a run is recorded
- **THEN** the entry contains only the documented aggregate fields
- **AND** old entries may omit `flaky`
- **AND** the documentation shows the schema, the retention and dedupe rules,
  and that a shared report embeds the prior-run aggregates it was generated with

#### Scenario: Writer matches the reader

- **WHEN** `writeHistory` receives a run with a field the reader rejects, an id
  longer than 128 UTF-16 code units, or a serialized result above 1,048,576
  bytes
- **THEN** it throws `Cannot write history file <file>: ...` and writes nothing
- **AND** the target file, if any, keeps its bytes

#### Scenario: Schema 2 is readable by 0.6 and rejected by 0.5

- **WHEN** a schema-2 sidecar is read by 0.6
- **THEN** it is accepted and the run fields are unchanged
- **WHEN** a 0.5 reader opens the same file
- **THEN** it exits 1 with `unsupported schema version "2"` and the file is not
  rewritten
