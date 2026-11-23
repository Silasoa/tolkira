# Design

## Seam

`loadInputs` currently resolves explicit files and directory scans, dedupes
canonical paths and stats each file inside its read loop. Extract the resolution
into one helper used by both the loader and a new advisory scan:

```
resolveInputFiles(inputs) ──► ordered file list (realpath and directory scan once)
        │
        ├──► scanInputBytes(files) ──► { files, bytes }  (stat only)
        └──► loadInputs(files) ─────► read, dedupe by content, parse
```

The file list is resolved once and the same list is passed to both callers, so a
directory scan or `realpath` cannot see two different trees (D16). `scanInputBytes`
returns the total `stat().size` of the resolved files and reads no content.
`loadInputs` keeps its current read, content-dedupe and parse order, so the input
cap and duplicate handling are unchanged. The loader keeps its per-file stat
before reading to enforce the 100 MB cap; the scan's stat pass is O(files) and
advisory.

The CLI calls the scan after option and path validation and before reading the
history or baseline and before `generateReport`/`summarizeReport`. If the shared
resolution cannot resolve or stat an input, it throws the loader's existing
error and the scan emits no warning; a warning never replaces the real message.

## Threshold and warning

`INPUT_WARN_BYTES = 50 * 1024 * 1024` (52,428,800 bytes, 50 MiB), fixed. The
warning fires at `bytes >= INPUT_WARN_BYTES` and is one stderr line:

```
tolkira: warning: input files total 50.0 MB, at or above the 50 MB early-warning threshold; parsing and rendering may take a while.
```

The total uses the existing one-decimal MB helper, extracted from the local
closure in `runCli` (`src/cli.ts:604`) into one shared helper so the early and
report-size warnings cannot drift (I12). The arithmetic is MiB-based like the
existing `--max-size` warning; the label stays `MB`. The line names no file or
path. It is emitted once, before the report confirmation, and does not change
the exit code. A later failure (malformed input, 100 MB cap, render error) still
reports its own message and exit code; the warning may already be visible.

The scan counts each resolved path once. Identical-content duplicates are only
known after reading, so a run that passes two copies of one file can be
overcounted; the warning never undercounts. That is acceptable for a hint and is
documented.

The 100 MB input cap in `loadInputs` and the post-render `--max-size` warning in
the CLI stay unchanged. Both the early input warning and the report-size warning
can appear in one run. The early total counts resolved file sizes; the
report-size warning's `input` value counts content-deduped loader bytes, so the
two numbers can differ (I20). Neither is a sum of the other; each names what it
measures.

## Ordering

1. Parse arguments and validate options and paths (usage errors exit 2 here).
2. Resolve and stat the inputs; warn if large (advisory, never fatal).
3. Read the history/baseline and generate the report/summary.
4. Write outputs and the existing report-size/attachment warnings.

A usage error therefore never emits the early warning. A missing input is
reported by the loader, not by the scan.

## Tests

- Unit: `scanInputBytes` sums explicit files and a directory, dedupes a repeated
  path, counts a directory of smaller files, ignores content duplicates only as
  documented, and returns the size of a file whose content cannot be read (a spy
  pins that no read is attempted). A spy also pins that the file list is resolved
  once and handed to both the scan and the loader.
- CLI boundary: a temp directory of several smaller valid JUnit files whose
  total is at least 50 MiB warns and exits 0; 50 MiB - 1 byte does not warn. The
  fixture is not one JUnit document with a 50 MiB `system-out` (I11/D17).
- CLI ordering: a malformed 50 MiB sparse file warns before the parse error and
  exits 1 with no partial output.
- CLI purity: `--json` keeps stdout JSON-only; `--ci` keeps its text; a usage
  error emits no warning.
- Limits: a total above 100 MB still exits 1 with the existing cap message; a
  large report still emits the existing report-size warning, and both lines can
  appear with different totals.
- Size: no output byte changes when the warning is absent.

The 50 MiB fixtures are generated in a temp directory: a directory of smaller
valid JUnit files for the valid case and a sparse file for the malformed case, so
the tests do not commit a large binary and do not parse one 50 MiB text node.

## Risks

- A duplicate-heavy input can warn earlier than the loader's unique-byte total;
  documented and conservative. The report-size warning's `input` value can be
  smaller than the early total for the same reason.
- The threshold is a product choice; 50 MiB is half the hard cap and avoids
  warning on ordinary medium runs.
- The scan adds one stat per resolved file. A directory with a very large number
  of files pays that twice; it is still cheaper than reading the files.
- Windows and Linux sparse-file behaviour differs; the tests use generated
  files, not committed fixtures.

## Rollout order

D1: early-size → history → static → baseline. This change lands first.

## ADRs

- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md): Node
  built-ins, no new dependency.
- [ADR 0005](../../../docs/adr/0005-server-rendered-shell.md): no renderer or
  output change.

## Open questions

- Threshold: 50 MiB fixed (proposed) vs 10 MiB, or configurable later.
- Scope: warn on `--json`/`--ci`-only runs too (proposed, because parsing is the
  cost) or only when a report/PDF is written.

## Out of scope

- A new input cap, a streaming parser, a progress meter, file names in the
  warning, a configurable threshold, a dependency or any report/schema change.
