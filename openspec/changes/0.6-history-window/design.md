# Design

## Contract

- Default window: `HISTORY_LIMIT = 30`, unchanged.
- Maximum: `HISTORY_LIMIT_MAX = 365`; minimum 1.
- `--history-limit <n>` requires `--history`; `--history` still requires
  `--out`.
- The limit is one number used by read, append, write and the Trends list. It
  is not a second retention policy.
- Readers accept schema version 1 and 2. The exported `HISTORY_SCHEMA_VERSION`
  stays `1`; a private `SCHEMA_VERSION_EXTENDED = 2` marks a file that may hold
  more than 30 runs.
- The writer writes schema 2 only when the limit is greater than 30 or the read
  file already used schema 2; otherwise it writes schema 1. A schema-2 file is
  never downgraded, so a later default run still writes schema 2.
- The writer prunes the oldest entries until the serialized file is at or below
  the 1 MiB read cap (1,048,576 bytes), and always keeps at least the newest
  entry. It never writes a file the reader would reject.
- A 365-run file is expected to stay under the cap: the documented entry is
  fixed-size apart from the 200-character title. The cap is a safety bound, not
  the normal retention policy.

## Data flow

```
--history-limit n
      │
      ▼
readHistory(file, n) ──► newest n runs (schema 1 or 2)
      │
      ▼
generateReport({ history, historyLimit: n }) ──► append unless dedupe, keep newest n
      │
      ├──► HTML Trends table/sparkline over the bounded list
      ▼
writeHistory(file, bounded, n) ──► prune to the 1 MiB cap, choose schema, atomic
```

The renderer is unchanged: it renders the list it is given, as today. With one
run, the existing rule still omits the Trends tab; with two or more it renders
the bounded list. `renderReport` and `CucumberHtmlStream` keep the "render as
given" contract and do not prune.

## Validation

`--history-limit` accepts a decimal integer with no sign, fraction, whitespace
or leading zero (the same posture as `--pdf-timeout`). `0`, `366`, `1.5`,
`abc`, `05` and an empty value exit 2 with the range `1 to 365`. A value
without `--history` exits 2 and names both options. The API validates the same
range and throws a clear error; the CLI validates first so its exit code is 2.
An omitted limit is exactly `30` in the CLI and in `readHistory`, `appendHistory`
and `writeHistory`; `generateReport` treats an omitted `historyLimit` the same.

## Retention semantics

- Reading with a smaller limit returns the newest n entries but does not rewrite
  the file.
- The next successful run reads n, appends the current run unless it dedupes,
  then keeps the newest n. A 31-entry file read with 10 and a new current run
  stores 10 (the read newest 10 minus the oldest, plus the current run); the 21
  entries older than the read window are gone.
- A 31-entry file read with 40 keeps 31, appends the current run and stores 32.
- A 40-entry file read with 40 appends the current run and stores the newest 40
  of 41.
- Raising the limit later cannot restore runs that were dropped.
- An identical last run still dedupes and keeps the old timestamp; the slice
  keeps the newest n.
- A failed run after reading but before writing leaves the file as it was.
- The schema stays 1 for a default run on a schema-1 file. A limit above 30 or a
  schema-2 input writes schema 2; no field is added.
- A 0.5 reader rejects a schema-2 file with its visible
  `unsupported schema version` error (exit 1) and leaves the file untouched; it
  does not silently truncate the window. A default 0.6 run on a schema-1 file
  keeps the rollback path open.
- The writer prunes the oldest entries until `Buffer.byteLength(serialized) <=
  1,048,576`; the newest entry always fits because one entry is bounded by the
  fixed fields and the 200-character title.

## API shape

`readHistory(file, limit = HISTORY_LIMIT)`, `appendHistory(runs, run,
limit = HISTORY_LIMIT)` and `writeHistory(file, runs, limit = HISTORY_LIMIT)`
accept the optional limit. `generateReport` accepts a separate
`GenerateReportOptions extends RenderReportOptions` with `historyLimit?: number`
so the option does not appear to affect `renderReport`. `renderReport` and the
stream take `RenderReportOptions` and render the list as given. The CLI passes
the same limit to read, generate and write. The compat shim treats
`historyLimit` as an unknown legacy option: it warns once and ignores it, like
every other unknown key.

## Tests

- Unit: read/append/write with limits 1, 5, 30, 31, 40 and 365; the newest
  entries survive; an identical last run dedupes; a 31-entry file read with 10
  returns 10 and the next write stores 10; a 31-entry file read with 40 returns
  31 and the next write stores 32; a 40-entry file read with 40 returns 40 and
  the next write stores 40 of 41; a file above 1 MiB still rejects; an invalid
  entry still rejects.
- Schema: a default write on a schema-1 file stays schema 1; a write with limit
  40 writes schema 2; a schema-2 file read with the default limit stays schema 2
  on write; a schema-2 file is rejected by the 0.5 reader path (wrong version)
  without a rewrite.
- Pruning: a schema-2 file whose serialized form exceeds 1,048,576 bytes is
  pruned to the newest entries that fit; the newest entry always remains; the
  written bytes are at or below the cap and re-read successfully.
- CLI: `--history-limit 5` with seven runs writes five and the report shows
  five; `--history-limit 40` keeps 40; `--history-limit 1` keeps one and omits
  the Trends tab; the default report/CI/email bytes are identical to before;
  the default JSON is identical except the additive outline `example` field;
  `0`, `366`, `1.5`, `abc`, `05`, empty and no `--history` exit 2.
- API: each function with a limit; an omitted limit is 30; `generateReport`
  returns the bounded list; `renderReport` renders a 40-entry list unchanged;
  an invalid limit throws.
- Size: record the Trends table/sparkline bytes for a 365-run report and confirm
  the report-size warning still behaves as documented.

## Risks

- Lowering the window is destructive on the next write. This is the point of a
  retention option, but the documentation must say it plainly.
- A larger window grows the Trends table and sparkline linearly. The 365 bound
  and the measured bytes keep that bounded; a user who needs more is a separate
  decision.
- The 1 MiB sidecar cap is unchanged. The writer now prunes to it, so a
  hand-made oversized file is still rejected on read and the writer cannot
  create one.
- Schema 2 is a visible compatibility break for 0.5 readers: they reject the
  file with an error and leave it untouched instead of silently truncating to
  30 runs. A default run on a schema-1 file keeps the rollback path open; a run
  above 30, or any write to an already schema-2 file, does not.
- No renderer, JSON, CI or email change beyond the additive outline `example`
  owned by the baseline change.

## Rollout order

D1: early-size → history → static → baseline. This change lands second.

## ADRs

- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md): no new
  dependency.
- [ADR 0005](../../../docs/adr/0005-server-rendered-shell.md): Trends stays a
  server-rendered view over the given list.

## Open questions

- Maximum: 365 (proposed) vs keeping 30 as the hard maximum. The 1 MiB cap is
  handled by the writer prune, so it no longer limits the window.
- Name: `--history-limit` (proposed) vs `--history-window`.
- Lowering is destructive on the next successful write; confirm that retention
  behaviour.

## Out of scope

- Scenario-level history, a run store, per-suite grouping, a dashboard, a new
  run field or per-run schema change (schema 2 is only a window marker),
  automatic pruning on read without a write, a new cap, a dependency or any
  report/JSON/CI/email field.
