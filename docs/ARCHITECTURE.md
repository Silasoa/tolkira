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

### `src/report`

- Builds a `ReportModel` from Messages: features, scenarios, steps, statuses,
  durations, tags, descriptions, doc strings, data tables, errors and
  attachments.
- Selects the latest attempt per scenario and normalises attachment payloads
  into data URIs or decoded text.
- Keeps the report view model separate from the machine-readable summary.

### `src/render`

- Server-renders the report model into one HTML file; no React runtime.
- Default Report tab: title, run metadata, pass-rate health panel, search,
  status filters, exception-first feature and scenario order, a triage index, a
  source strip for multi-file runs with unambiguous provenance, feature
  counts/proportion bars, fixed thumbnail gutter and scenario details. Every
  scenario count, percentage, bar, triage entry and matrix cell covers executed
  scenarios only; unexecuted rows stay visible without an outcome. Below
  560 px the triage collapses and the source strip hides.
- Details tab: feature-by-status matrix, status distribution, environment and
  the agent summary.
- `src/render/report.css` is the stylesheet source; `scripts/build-styles.mjs`
  generates `src/render/styles.ts` for the inline report.
- `src/render/search.ts` carries the tag-expression, URL-state and open-state
  helpers; `src/render/report-client.js` is the browser script.
  `scripts/build-search.mjs` minifies both into one `CLIENT_SCRIPT` artifact in
  `src/render/client-bundle.ts`; `npm run assets` regenerates the generated
  modules.
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

### `src/cli`

- `tolkira <input...> [--out <file>] [--json] [--title <title>] [--meta key=value]`
  `[--logo <file>] [--accent <hex>] [--max-size <mb>]`.
- Auto-detects Messages and legacy JSON by content, not by file extension.
- Directories are scanned for `.json`, `.jsonl` and `.ndjson`, then sniffed by
  content; duplicate paths are resolved and read once.
- Exit codes: 0 success, 1 parse/render error, 2 usage error.
- Failing tests do not fail report generation; malformed input does.
- Writes atomically through a temporary file in the output directory.
- Warns when the report exceeds 10 MB.
- `node:util parseArgs`; no CLI framework dependency.

### `src/index`

Programmatic API:

```ts
renderReport(inputs, options): Promise<string>
generateReport(inputs, options): Promise<{ html, summary }>
summarizeReport(inputs): Promise<ReportSummary>
```

The CLI is a thin wrapper around the API.

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
  limits (100 MB input, 50 MB per attachment, 100 MB total attachments).
- No network requests, telemetry or remote fonts.
- No path traversal when writing output or external attachments.
- A restrictive CSP is injected into every report; v0.1 defaults to inline
  assets.

## Performance

- Messages are accumulated and validated before rendering; the renderer builds
  the view model and writes one HTML string.
- Legacy JSON is parsed once; inputs above 100 MB fail with a useful message
  rather than exhausting memory.
- Stress baseline: 1,000 scenarios / 3,000 steps render in about 0.15–0.2 s to
  1.4 MB; 5,000 / 15,000 in about 0.4–0.5 s to 7.0 MB. Timings vary with host
  load.
- Warn when the generated file exceeds 10 MB.
- External attachments are the escape hatch for large screenshots/videos.

## Testing

- Unit tests: Vitest.
- Fixtures: cucumber-js legacy JSON, a Behave-shaped legacy report and a
  hand-built Messages stream with passing/failing scenarios and attachments.
  cucumber-jvm/ruby fixtures are follow-ups.
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
