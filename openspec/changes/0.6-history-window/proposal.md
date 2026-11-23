# 0.6-history-window

## Why

B-044: the history sidecar keeps the last 30 aggregate runs and Trends renders
that window. No remote issue exists; B-044 is the local backlog row. Thirty is a
fixed product choice, not a law: a nightly suite may want fewer rows, and a team
that runs several times a day may want more than a month of history. The window
should be the user's choice within a documented bound.

## What Changes

- Add `--history-limit <n>` (requires `--history`), a decimal integer from 1 to
  365, default 30. It bounds the runs read from the sidecar, appended, written
  and rendered in Trends.
- Retention is one boundary: read the newest `n`, append the current run unless
  it dedupes, then keep the newest `n`. A 31-entry file with limit 40 and a new
  current run stores 32; a 40-entry file with limit 40 appends the current run
  and keeps the newest 40.
- Readers accept schema version 1 and 2. The writer keeps schema 1 unless
  `--history-limit` is greater than 30 or the file already uses schema 2; then it
  writes schema 2. A 0.5 reader rejects schema 2 with a visible error and leaves
  the file untouched; a default run on a schema-1 file keeps the rollback path
  open.
- The writer prunes the oldest entries until the serialized file is at or below
  the 1 MiB read cap; it never writes a file the reader would reject.
- A smaller limit prunes the file on the next successful write; a larger limit
  cannot recover runs already dropped. Without the flag the 30-run behaviour is
  unchanged.
- Add the same limit to the API: `readHistory`, `appendHistory` and
  `writeHistory` accept an optional limit; `generateReport` accepts
  `historyLimit`. `renderReport` and the stream render the list they are given.
- Keep the 1 MiB sidecar cap, atomic writes and aggregate dedupe unchanged. No
  report, JSON, CI or email field changes; the only final 0.6.0 JSON delta is the
  additive outline `example` field owned by the baseline change.

## Rollout order

D1: early-size → history → static → baseline. This change lands second.

## Impact

- Capability: `cli-api`.
- Code: `src/cli.ts`, `src/history.ts`, `src/index.ts`, `src/options.ts`.
- Tests: history unit boundaries, CLI validation and retention, Trends row
  count, API limits and the default byte parity.
- Docs: `docs/AGENT-INTERFACE.md` (schema 1/2, window, default, destructive
  lower limit, older-reader rejection, 1 MiB prune), `docs/ARCHITECTURE.md`
  (the 30-run cap lines), `docs/LIMITATIONS.md` (history row),
  `docs/PRODUCT.md:109`, `GLOSSARY.md:175-178` and `docs/BACKLOG.md` at archive
  time.
- Report size: the Trends table and sparkline grow linearly with the window;
  the 365 maximum is measured in the tasks and stays inside the report-size
  warning behaviour.

## Out of scope

- Scenario-level history, a run store, a dashboard or a server.
- A new sidecar field or a per-run schema change; schema 2 is only a version
  marker for a window above 30, with the same run fields. Per-suite grouping and
  automatic pruning on read without a successful write stay out.
- Changing the 1 MiB cap or the aggregate-only privacy promise.
- A new dependency, network request or telemetry.

## Open questions

- **Maximum.** Proposed 365 (about a year of nightly runs). The alternative is
  to keep 30 as the hard maximum, which makes the flag a "smaller window" option
  only. Confirm 365, and whether the 1 MiB cap or a report-size budget should
  lower it.
- **Name.** Proposed `--history-limit` (API `historyLimit`), matching the
  `HISTORY_LIMIT` constant. Alternative: `--history-window`.
- **Destructive lower limit.** Proposed: lowering prunes on the next successful
  write, and raising later cannot restore dropped runs. Confirm that is the
  expected retention behaviour.
