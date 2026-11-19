# Tolkira — Architecture

## Shape

```
CLI / API
   │
   ├── Messages adapter ───────────────┐
   │   (NDJSON, validated)             │
   │                                    ▼
   └── Legacy JSON adapter ───────► Cucumber Messages
       (Cucumber JSON, embeddings)      │
                                        ▼
                              Report view model
                                        │
                                        ▼
                              Server-rendered shell
                                        │
                                        ▼
                              One self-contained HTML file
```

One package. One CLI. One HTML output. No monorepo, no server, no database.

An optional aggregate history sidecar (`--history <file>`) sits beside the
report: the CLI validates and reads it, `generateReport` appends one aggregate
entry and returns the list, and the renderer adds a Trends view when the list has
two or more entries. The 30-run bound belongs to that CLI/`generateReport` path;
`renderReport` renders the list it is given. It holds no scenario, step or path
data and stays opt-in.

## Components

### `src/input/messages`

- Reads NDJSON.
- Parses and validates each line with a strict envelope validator.
- Rejects malformed input with a clear error and no partial output.
- Merges multiple message streams; IDs are expected to be unique per run.

### `src/input/legacy`

The hard part. It normalises Cucumber JSON from cucumber-js, cucumber-jvm,
cucumber-ruby and Behave into Messages:

- Gherkin documents, features, scenarios, background steps, expanded outline
  rows, steps and hooks;
- test cases, test steps, hooks, statuses, durations;
- tags, data tables, doc strings;
- **embeddings → attachments**, including base64 screenshots and MIME types.

The canonical `@cucumber/json-to-messages` converter is a useful reference but
does not preserve embeddings. The focused adapter preserves them, accepts the
2.x-13.x cucumber-js shape, Behave (seconds normalised) and cucumber-jvm 7.x,
and is covered by real producer fixtures.

### `src/input/junit`

- Basic JUnit XML mode for non-Cucumber frameworks.
- `<testsuite>` -> feature, `<testcase>` -> scenario with one synthetic step,
  `failure`/`error`/`skipped` -> status, `time` -> duration,
  `system-out`/`system-err` -> text attachments.
- Uses `fast-xml-parser`, loaded on demand only for XML input.
- No Gherkin steps or screenshots; this is breadth, not Cucumber depth.

### `src/attachment`

- Shared leaf module used by the input layer, the report model, the summary and
  the renderer. It imports only Messages attachment types and no project module.
- Owns decoded attachment byte accounting, the 50 MB per-attachment and 100 MB
  total attachment caps, the MIME allowlist, fallback naming, attachment kind and
  the JSON/URI-list/ANSI/plain text presentation lookup.
- The encoded base64 length and padding are counted without decoding the body.

### `src/report`

- Builds a `ReportModel` from Messages: features, scenarios, steps, statuses,
  durations, tags, descriptions, doc strings, data tables, errors and
  attachments.
- Selects the latest attempt per scenario and normalises attachment payloads
  into data URIs or decoded text. Attachment bytes, names, kinds and text
  presentation come from `src/attachment`.
- Keeps the report view model separate from the machine-readable summary.

### `src/render`

- Server-renders the report model into one HTML file; no React runtime.
- Default Report tab: title, run metadata, pass-rate health panel, search,
  status filters, exception-first feature and scenario order, a triage index, a
  source strip for multi-file runs with unambiguous provenance, feature
  counts/proportion bars, fixed thumbnail gutter and scenario details. Scenario
  counts, bars, triage entries and matrix cells cover reported (executed)
  scenarios, including skipped; unexecuted rows stay visible without an outcome,
  except that the failed-only preset's `hide=unexecuted` sentinel hides them
  while the preset chip state is active.
  The run percentage and feature pass text use attempted (non-skipped)
  scenarios. Below 560 px the triage collapses and the source strip hides.
- Details tab: feature-by-status matrix, status distribution, environment and
  the agent summary.
- Trends tab (only with two or more history runs): newest-first table of the
  recorded runs with attempted pass rate, and a decorative pass-rate sparkline
  oldest to newest. One `passRate` helper in `format.ts` feeds both the health
  panel and the table, so `attempted === 0` states the same thing in both.
- Renderer module map (top to bottom; a module imports only lower layers, and
  same-layer modules never import each other — `report.ts`, `details.ts` and
  `trends.ts` are peers, as are `triage.ts`, `matrix.ts`, `attachments.ts` and
  `ci.ts`): `html.ts` owns the shell, CSP and `renderHtml` assembly; `report.ts`
  owns the report header, toolbar, features, scenarios, steps, hooks and
  feature-row chrome; `details.ts` owns the Details header, run/environment
  panels and analysis layout; `trends.ts` owns the Trends header, the
  recorded-runs table and the sparkline; `triage.ts` owns the needs-attention
  index and source strip; `matrix.ts` owns the feature-by-status matrix;
  `attachments.ts` owns image/text/video/log/file rendering; `ci.ts` owns the CI
  header and detail rows; `format.ts` owns status, duration, date, bar, count,
  health, pass-rate and tag helpers; `types.ts` owns `RenderOptions`
  (including the optional `history` list), `DisplayStatus` and
  `OrderedFeature`. `escape.ts`, `dom-contract.ts`, `markdown.ts`, `ansi.ts`,
  `styles.ts`, `client-bundle.ts`, `search.ts` and `report-client.ts` are shared
  foundation, importable from every layer. `src/attachment.ts` is a shared leaf
  below the renderer; `render/attachments.ts` reads the `textFormat` it produced.
- `src/render/report.css` is the stylesheet source; `scripts/build-styles.mjs`
  generates `src/render/styles.ts` for the inline report.
- `src/render/search.ts` carries the tag-expression, URL-state and open-state
  helpers; `src/render/report-client.ts` is the browser script.
  `src/render/dom-contract.ts` owns the scenario data attributes, the shared
  IDs and the pure visibility decisions used by both the templates and the
  client. `scripts/build-search.mjs` bundles them into one `CLIENT_SCRIPT`
  artifact in `src/render/client-bundle.ts`; `npm run assets` regenerates the
  generated modules.
- Adds a small shell: visible title, optional logo and accent colour, system
  dark mode.
- No CDN, no external fonts, no network requests.
- Injects a restrictive Content-Security-Policy meta tag.
- Optional external-attachments mode is a later change.

### `src/summary`

- Builds a renderer-independent, stable JSON summary from Messages.
- Reports overall status, executed scenario/step counts, durations, attachments
  and per-scenario step results with failure messages.
- Exposed as `summarizeReport` and through the CLI `--json` flag.
- Schema version 2 is documented in `docs/AGENT-INTERFACE.md`; breaking changes
  bump the version.

### `src/ci`

- Formats the summary as GitHub Actions workflow commands or deterministic
  Markdown for GitLab and step summaries.
- Pure and offline: no network, no report-model access and no schema change.
- Caps annotations and lists while keeping the exact counts.

### `src/history`

- Owns the opt-in aggregate history sidecar: schema version 1, at most 30 runs
  on the CLI/`generateReport` path and a 1 MiB size cap checked on the open
  descriptor before reading.
- `buildHistoryRun` hashes the aggregates and the resolved title (capped at 200
  characters), excluding the recorded time; `appendHistory` keeps one copy of an
  identical last run and the old timestamp; `readHistory` rejects non-regular
  files, validates every documented field including cross-field count totals,
  ignores unknown fields and never writes; `writeHistory` bounds the list and
  titles, then writes atomically with a trailing newline.
- Stores only id, recorded time, title, status, feature/scenario/step counts,
  duration and attachment totals. There is no scenario-level history, and the
  CLI is the only automatic writer, so concurrent processes can still lose an
  update.
- Exported through `src/index`; `generateReport` appends the current run,
  `renderReport` and `CucumberHtmlStream` render the list they are given.

### `src/cli`

- `tolkira <input...> [--out <file>] [--json] [--ci github|markdown]`
  `[--ci-out <file>] [--history <file>] [--title <title>] [--meta key=value]`
  `[--logo <file>] [--accent <hex>] [--max-size <mb>]`.
- Auto-detects Messages and legacy JSON by content, not by file extension.
- Directories are scanned for `.json`, `.jsonl` and `.ndjson`, then sniffed by
  content; duplicate paths are resolved and read once.
- Exit codes: 0 success, 1 parse/render error, 2 usage error.
- Failing tests do not fail report generation; malformed input does.
- Writes atomically through a temporary file in the output directory.
- `--ci` may run without `--out`; `--ci-out` is a standalone atomic Markdown
  file and is rejected for GitHub annotations.
- `--history` requires `--out`. It is validated like an output path (inputs,
  logo, `--out`, `--ci-out` and input directories, even when missing), read once
  before generation and written after the HTML. A history read or write failure
  exits 1 and names the file; a written HTML stays in place.
- Warns when the report exceeds 10 MB.
- `node:util parseArgs`; no CLI framework dependency.

### `src/index`

Programmatic API:

```ts
renderReport(inputs, options): Promise<string>
generateReport(inputs, options): Promise<{
  html, summary, skippedAttachments, history?
}>
summarizeReport(inputs): Promise<ReportSummary>
```

`generateReport` accepts `history`, appends the current aggregate run and returns
the appended list; `renderReport` renders `options.history` without recording a
run. The CLI is a thin wrapper around the API.

## Security

Test names, metadata, file names and attachments are untrusted input.

- Escape all text injected into the shell.
- Do not execute HTML/SVG attachments; render them as text or in a sandboxed
  viewer.
- Reject remote attachment URLs and external attachments; strip remote Markdown
  images. Reports must stay offline.
- Parse JUnit XML without DTD/external entity resolution; parser errors fail
  closed and `system-out`/`system-err` remain text attachments.
- Validate attachment media type and size fields, and enforce input/attachment
  limits (100 MB input, 50 MB per attachment, 100 MB total attachments). Decoded
  attachment byte accounting and both attachment caps are owned in
  `src/attachment.ts` and enforced by the sanitizer and Playwright adapter; the
  loader keeps its separate total-input cap.
- No network requests, telemetry or remote fonts.
- No path traversal when writing output or external attachments.
- The history sidecar is validated before use (schema version, field types,
  finite non-negative numbers, strict ISO time, count totals), opened as a
  regular file, capped at 1 MiB on the descriptor and rewritten atomically. It
  stores aggregates only, so it cannot leak scenario names, step text, paths,
  tags or attachment content.
- A restrictive CSP is injected into every report; v0.1 defaults to inline
  assets.

## Performance

- Messages are accumulated and validated before rendering; the renderer builds
  the view model and writes one HTML string.
- Attachment sizes are counted without decoding: base64 by encoded length and
  padding, identity by UTF-8 length, and Playwright path attachments by `stat`
  size before they are read.
- Legacy JSON is parsed once; inputs above 100 MB fail with a useful message
  rather than exhausting memory.
- Stress baseline: 1,000 scenarios / 3,000 steps render in about 0.15–0.2 s to
  1.4 MB; 5,000 / 15,000 in about 0.4–0.5 s to 7.0 MB. Timings vary with host
  load.
- The CLI/`generateReport` history path is capped at 1 MiB and 30 runs, so trend
  rendering is linear in at most 30 aggregate entries there; `renderReport`
  accepts the given list as-is.
- `npm run bench:ansi` bundles `src/text.ts` with esbuild, strips fixed
  2,000-message clean and escape-laden corpora of about 2 KiB per message, and
  reports medians plus scan-only and character-append reference ratios. The
  fast-path ratio is the scan-only median divided by the production median; the
  slicing ratio is the character-append median divided by the production median.
  Higher is better for both. On the 2026-11-19 reference host (Windows, Node
  26.13.1) a coherent full run measured a 27.7 ms combined production median
  against the 500 ms budget, a 9.6x clean fast-path ratio (roughly 7-10x), and
  `outputIdentical: true`. Across the full runs on this host, including phases
  under heavy local load, the combined median ranged 23.4-78.9 ms and the clean
  ratio 6.3-9.6x (one noisier run 4.2x). The slicing ratio ranged 0.65-1.21x
  (one noisier run 3.47x) and is evidence only. A fast-path ratio of at least
  1.5x reports `keep`; below reports `review` without failing CI. A budget
  failure is investigated, never raised silently, and a budget change or
  fast-path removal is a separate change with its own reason. A full-mode
  combined median below 0.75x the largest corpus median fails the benchmark as
  an incoherent measurement (re-run once; if it persists, investigate the
  measurement order or host load); quick mode skips the check.
- Warn when the generated file exceeds 10 MB.
- External attachments are the escape hatch for large screenshots/videos.

## Testing

- Unit tests: Vitest. Attachment byte counting, cap boundaries, the allowlist,
  fallback names, kinds and text presentation are pinned in
  `test/attachment.test.ts` and `test/sanitize.test.ts`; the model/summary
  cross-check keeps both consumers equal. `test/history.test.ts` pins the
  sidecar schema, validation, dedupe, retention and atomic write;
  `test/cli-history.test.ts` and `test/render-trends.test.ts` cover the
  `--history` flow and the Trends view; `test/e2e/trends.spec.ts` covers the
  two-run browser flow at 320, 1440 and 200 % text zoom.
- Fixtures: cucumber-js legacy JSON, Behave 1.3.3 real runs (statuses, doc
  strings, tables and inline images), cucumber-jvm and cucumber-ruby real runs,
  and a hand-built Messages stream with passing/failing scenarios and
  attachments.
- Browser test per critical flow: render, search, open a screenshot, verify an
  HTML attachment does not execute.
- Security tests: XSS payloads in names/metadata, malicious attachment names,
  remote attachments, HTML attachments, CSP and offline asset checks.
- ISTQB-inspired edge cases: equivalence classes, boundaries, decision tables
  for statuses, state transitions for multiple runs.

## Toolchain

- Node.js 22, 24 and 26 in CI.
- TypeScript, ESM.
- esbuild for the CLI/library bundle.
- oxlint (fast, single binary, no ESLint dependency tree).
- Vitest.
- Playwright for browser-level checks.
- npm trusted publishing with provenance.

## Key decisions

- [ADR 0001](adr/0001-hybrid-report-engine.md) — use official Cucumber
  components, build adapters and shell; superseded for rendering by ADR 0005.
- [ADR 0002](adr/0002-single-package-esm-node22.md) — one package, ESM,
  Node 22+.
- [ADR 0003](adr/0003-name-tolkira.md) — name origin and preliminary
  clearance.
- [ADR 0004](adr/0004-normalize-to-messages.md) — normalise legacy JSON to
  Messages instead of maintaining two renderers.
- [ADR 0005](adr/0005-server-rendered-shell.md) — own the report shell; render
  server-side from a view model.

## Open questions

- How much metadata can be injected without forking the official template?
- Attachment externalisation for oversized reports in v0.1.1?
- Which legacy implementations are v0.1 must-haves vs. fixtures-only?
- Legacy outline `examples` reconstruction: needed for agents, or are expanded
  scenarios enough?
