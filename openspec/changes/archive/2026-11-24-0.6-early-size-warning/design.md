# Design

## Seam

`loadInputs` currently resolves explicit files and directory scans, dedupes
canonical paths and stats each file inside its read loop. Extract the resolution
into one helper used by both the loader and a new advisory scan:

```
resolveInputFiles(inputs) ──► ordered file list (realpath and directory scan once)
        │
        ├──► scanInputBytes(files) ──► { bytes }  (stat only)
        └──► loadResolvedInputs(files) ─► read, dedupe by content, parse
```

The file list is resolved once and the same list is passed to both callers, so a
directory scan or `realpath` cannot see two different trees (D16). `scanInputBytes`
returns the total `stat().size` of the resolved files and reads no content.
`loadResolvedInputs` keeps the current read, content-dedupe and parse order, so
the input cap and duplicate handling are unchanged. The loader keeps its
per-file stat before reading to enforce the 100 MB cap and rejects a resolved
entry that is no longer a regular file before reading it; a swap to a different
regular file after the loader's own stat remains possible. The scan's stat pass
is O(files) and advisory.

The public API stays path-based: `generateReport` and `renderReport` accept
`string | string[]` and resolve first. The resolved list is an internal CLI seam
(`src/run.ts`, `loadResolvedInputs`, `summarizeResolvedReport`), not a package
root type.

The CLI calls the scan after option and path validation and before reading the
history and before `generateReport`/`summarizeReport`. If the shared resolution
cannot resolve an input, it throws the loader's existing error and the scan
emits no early input warning; a warning never replaces the real message. A scan
stat failure is silent because the loader re-stats and reports the real error.

## Threshold and warning

`INPUT_WARN_BYTES = 52_428_800` (52,428,800 bytes, 50 MiB), fixed. The literal
stays because `test/attachment.test.ts` allows the multiplication form only in
`attachment.ts`. The warning fires at `bytes >= INPUT_WARN_BYTES` and is one
stderr line:

```
tolkira: warning: input files total 50.0 MB, at or above the 50 MB early-warning threshold; parsing and rendering may take a while.
```

The total uses the existing one-decimal MB helper, extracted from the local
closure in `runCli` into one shared helper so the early input warning and the
report-size warning cannot drift (I12). The threshold label is derived from the
constant, and `earlyInputWarning` returns body copy without the
`tolkira: warning: ` prefix or trailing newline; the CLI adds both. The
arithmetic is MiB-based like the
existing `--max-size` warning; the label stays `MB`. The line names no file or
path. It is emitted once, before the report confirmation, and does not change
the exit code. A later failure (malformed input, 100 MB cap, render error) still
reports its own message and exit code; the warning may already be visible.

The scan counts each resolved path once; identical content under two paths
counts twice. Identical-content duplicates are only known after reading, so a
run that passes two copies of one file can be overcounted. The scan counts the
resolved paths at scan time, so a file that grows between scan and load can make
the loader total larger. That is acceptable for a hint and is documented.

The 100 MB input cap in `loadInputs` and the post-render `--max-size` warning in
the CLI stay unchanged. Both the early input warning and the report-size warning
can appear in one run. The early total counts each resolved path once; the
report-size warning's `input` value counts content-deduped loader bytes, so the
two numbers can differ (I20). Neither is a sum of the other; each names what it
measures.

## Ordering

1. Parse arguments and validate options and paths (usage errors exit 2 here).
2. Resolve and stat the inputs; warn if large (advisory, never fatal).
3. Read the history and generate the report/summary.
4. Write outputs and the existing report-size/attachment warnings.

A usage error therefore never emits the early input warning. A missing input is
reported by the loader with its existing ENOENT exit 1, not by the scan.

## Tests

- Unit: `scanInputBytes` sums explicit files and a directory, dedupes a repeated
  path, counts a directory of smaller files, reports a sparse 50 MiB file
  without reading it, ignores content duplicates only as documented, and returns
  the size of a file whose content cannot be read (a spy pins that no read is
  attempted). A resolved directory entry is rejected before reading.
- CLI identity: a mocked load module pins that `resolveInputFiles` runs once and
  that the scan and the resolved loader receive the same files array (identity,
  not equality).
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

## Decisions

- Threshold: fixed 50 MiB (52,428,800 bytes). Not configurable in this change.
- Scope: warn on every run that resolves large inputs, including `--json` and
  `--ci`-only runs, because parsing is the cost. The warning is advisory.
- Public API: stays path-based (`string | string[]`); the resolved list is an
  internal CLI seam and does not appear in `dist/index.d.ts`.
- Scan return shape: `{ bytes }` only; no file count.
- Partial scan failure: silent, because the loader re-stats and reports the real
  error.
- The two 50 MiB preambles in the usage-error and missing-input CLI tests stay,
  so each test proves its own fixture is large instead of depending on a sibling
  test.

## Out of scope

- A new input cap, a streaming parser, a progress meter, file names in the
  warning, a configurable threshold, a dependency or any report/schema change.
