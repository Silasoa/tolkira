# 0.6-early-size-warning

## Why

B-040: the `--max-size` warning measures the finished report, so a large input
spends the full parse and render before the user sees any size signal. No remote
issue exists; B-040 is the local backlog row. A cheap stat scan of the resolved
input files can say "this is large" before the work starts. This is a reliability
hint, not a new cap: the 100 MB input limit and the post-render report-size
warning stay exactly as they are.

## What Changes

- After option and path validation and before parsing or rendering, resolve the
  input file list once. Stat the resolved files and, when their total is at
  least 50 MiB (52,428,800 bytes), write one stderr warning naming the total and
  the threshold.
- The same resolved list goes to the advisory scan and the loader. The scan
  reads no file content and counts each resolved path once. Identical-content
  duplicates can be overcounted because dedupe needs a read; the warning never
  undercounts.
- The line is
  `tolkira: warning: input files total 50.0 MB, at or above the 50 MB early-warning threshold; parsing and rendering may take a while.`
  It uses the extracted one-decimal MB helper and names no path.
- The early total counts resolved file sizes; the report-size warning's `input`
  value counts content-deduped loader bytes. The two numbers can differ; both
  are correct for what they measure.
- The warning changes no exit code and no stdout, JSON, CI, report, PDF or email
  byte. The 100 MB input cap and the post-render `--max-size` warning still
  apply; both warnings can appear in one run.
- No new option, dependency, schema, catalog key or report byte.

## Rollout order

D1: early-size → history → static → baseline. This change lands first.

## Impact

- Capability: `cli-api`.
- Code: `src/cli.ts` (extract the one-decimal MB helper), `src/input/load.ts`
  (extract the file resolution and add the stat scan), `src/warnings.ts`.
- Tests: a scan unit test, CLI boundary and ordering tests, and the existing
  large-report warning test.
- Docs: `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`,
  `docs/LIMITATIONS.md`, `docs/PRODUCT.md`, `GLOSSARY.md` and
  `docs/BACKLOG.md` at archive time.
- No report, JSON, CI, email or history change.

## Out of scope

- A configurable input warning threshold or a new `--max-input-size` option.
- A hard pre-parse input cap beyond the existing 100 MB limit.
- Naming input files or paths in the warning, a progress meter, streaming
  parse, or a change to the report-size warning.
- A new dependency, network request or telemetry.

## Open questions

- **Threshold.** Proposed: a fixed 50 MiB (half of the 100 MB input cap), which
  is a "very large input" hint and does not fire on ordinary 10-20 MB runs. The
  alternative is 10 MiB, matching the `--max-size` default, which warns much
  earlier but noisier. Confirm the value and whether it should be configurable
  later.
- **Warning scope.** Proposed: warn for every run that parses inputs, including
  `--json`/`--ci`-only runs, because parsing is the cost. Confirm that a
  summary-only run should also warn.
