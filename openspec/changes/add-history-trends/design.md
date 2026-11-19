# Design

## Context

The summary already carries the aggregate fields a trend needs. The report is
one static file; history must therefore be an explicit sidecar plus a snapshot
rendered into the HTML at generation time. The CLI is the only writer.

Data flow: CLI validates and reads the sidecar → `generateReport` builds the
summary, records one aggregate entry, appends it to the passed history, renders
the Trends view when there are at least two entries, and returns the updated
list → the CLI writes the sidecar atomically after the HTML. `--history`
requires `--out`; there is no summary-only recording path. ADR 0005
(server-rendered shell) and ADR 0006 (inline attachments) still apply.

## History module (`src/history.ts`)

```
HISTORY_SCHEMA_VERSION = 1
HISTORY_LIMIT = 30
HISTORY_MAX_BYTES = 1 MB

interface HistoryRun {
  id: string;                 // sha256 of the aggregates, excluding recordedAt
  recordedAt: string;         // ISO timestamp at report generation
  title: string;              // resolved report title
  status: SummaryStatus;
  counts: { features: number; scenarios: StatusCounts; steps: StatusCounts };
  durationMs: number;
  attachments: { total: number; bytes: number };
}
```

- `buildHistoryRun(summary, title, now = new Date())`: the id hashes the
  aggregate fields (status, counts, duration, attachments, title), not
  `recordedAt`, so a regenerated identical run dedupes.
- `readHistory(file)`: missing → `[]`; reject a file above the size cap, invalid
  JSON, a wrong schema version, or a malformed entry (non-ISO time, non-finite
  or negative values, wrong types). Unknown fields are ignored. More than 30
  entries is trimmed on read. Errors name the file.
- `appendHistory(runs, run)`: if the last id equals the new id, return unchanged
  (the old `recordedAt` stays); otherwise append and keep the last 30.
- `writeHistory(file, runs)`: `writeAtomic` with JSON and a trailing newline.
- No scenario names, steps, paths, tags or attachment content; no revision,
  because the stable summary has no source revision (backlog trigger for an
  additive `revision?` if the summary gains one).
- One writer only: read-modify-write plus rename prevents corruption, not lost
  updates from concurrent processes; document that.

## CLI

- Add `--history <file>`; an empty path and `--history` without `--out` are
  usage errors. Add the option to the usage text.
- Validate after the existing usage checks, inside the try, before generation:
  - `samePath` against every input, the logo, `--out` and `--ci-out` (the check
    must compare resolved paths even when the history file does not exist yet;
    `outputOverwritesInput` alone returns false for a missing target).
  - Reject a history path inside any input directory, even when missing: on run
    two the sidecar would be collected as input JSON. Use the existing file
    collection/containment logic.
- Read the history once before generation; on error, exit 1 and write nothing.
- HTML path: pass `history` into `generateReport`; it returns the appended list;
  write it after the HTML succeeds. If the history write fails, exit 1, name the
  file and leave the written HTML in place; no partial sidecar.
- No flag: no read, no write, no history data or Trends tab. Report/Details
  markup is unchanged; the shared client bundle and stylesheet may differ, so
  regenerate assets and update the characterization hashes/goldens as an
  intentional change.

## Renderer

- `src/render/trends.ts` is a top-layer view (like `details.ts`): a `Trends`
  heading, a table and the sparkline. It imports `format`, `types` and the
  `HistoryRun` type only. Add it to the module-layer test's expected set.
- `RenderOptions.history?: HistoryRun[]`; `renderHtml` renders the third tab and
  panel only when `history.length >= 2`. `DOM_IDS.trendsView` is conditional;
  split the DOM-contract "every id exists" test into always-present and
  conditional ids.
- The tab bar adds `Trends` with `aria-controls`; `showView` in the client
  toggles the panel named by `aria-controls`, tolerates a missing panel, and
  keeps the null/default path. Keyboard arrow/Home/End already iterate `views`.
  No-JS stays on Report.
- Table: newest first by `recordedAt` descending, with scoped header cells,
  recorded time, title, status, scenario counts, pass rate and duration. Pass
  rate uses the same attempted helper as the health banner (`total - skipped`,
  one decimal); `attempted === 0` shows `—`. Extract that helper so Details and
  Trends cannot disagree.
- Sparkline: fixed `viewBox`, pass rate over `recordedAt` ascending, non-scaling
  strokes, `aria-hidden="true"`; n/a runs are skipped and the line breaks into
  segments; fewer than two points means no line. The table is the accessible
  source.
- CSS: reuse `.panel`, `.dataTable`, status classes; the table sits in a
  labelled `tabindex="0"` `.tableWrap` region for 320 px. No new colour tokens.
- The tablist label becomes `Report views`; keep the brand and layout.

## Alternatives considered

- **Default sidecar next to the report**: surprises the one-file default and
  changes output without a flag; rejected.
- **Server/database**: violates offline/no-telemetry; rejected.
- **Scenario-level history**: privacy and size, and the summary is the wrong
  level; rejected.
- **Separate trends HTML**: a second artifact contradicts the one-file default;
  rejected.
- **A chart library**: a dependency for one sparkline; rejected.
- **Recording from `--json`/`--ci` without HTML**: no report exists to show it;
  deferred to the backlog with a trigger.

## Risks

- A corrupt or oversized file must not be overwritten; validate before any write
  and test it.
- A clock change can reorder runs; sorting is by `recordedAt` descending.
- The tab generalization must keep Details/Report switching, keyboard and no-JS.
- The history snapshot inside the HTML is fixed at generation time and shares
  the prior-run aggregates with anyone who gets the report; the sidecar is the
  source for the next report. A sidecar reused across suites mixes them; suites
  are out of scope. Document both.
- The client bundle and stylesheet changes require `npm run assets` and an
  intentional update of the characterization hashes and goldens.
