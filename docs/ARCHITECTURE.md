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

One package. One CLI. One report file, plus an optional email summary. No
monorepo, no server, no database.

An optional aggregate history sidecar (`--history <file>`) sits beside the
report: the CLI validates and reads it, then drives
`generateReportFromResolved`, which appends one aggregate entry and returns the
list, and the renderer adds a Trends view when the list has two or more entries.
`--history-limit <n>` (1 to 365, default 30) bounds that path; `renderReport`
renders the list it is given and never prunes. It holds no scenario, step or
path data and stays opt-in.

An optional baseline (`--baseline <file>`) is a read-only earlier schema-2
summary: the CLI validates and reads it, `src/baseline.ts` builds one comparison
(the summary block plus a change map keyed by the report model's pickle id), and
the summary, renderer and Markdown CI formatter read that result. It stays
opt-in; without the flag the one-file report, CI and email bytes are unchanged.

An optional HTML email summary (`--email <file>`) is a second output derived from
the same `ReportSummary`: no logo, scripts, images, network or SMTP, one 600 px
table with inline styles. It stays opt-in; without the flag the one-file report
default is unchanged.

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

### `src/input/load`

- Resolves explicit files and directory scans once into one ordered,
  deduplicated file list (`resolveInputFiles`). The CLI hands that same list to
  the advisory stat-only size scan (`scanInputBytes`) and the loader, so a
  directory scan or `realpath` cannot see two different trees. The list is
  ordered by the shared UTF-16 code-unit comparator in `src/text`, not by the
  host locale. That order is the report model's feature order (the Details
  matrix order) and the stable tie-break inside the Report's status-first
  feature grouping; the top-level Report list itself sorts by status first.
- The scan reads no content and returns the summed `stat` sizes; the loader
  keeps its own per-file stat guard before reading, its content dedupe and the
  100 MB total-input cap over unique loaded content after dedupe and skip.
- The early input warning is advisory: it can overcount identical content that
  the loader later dedupes and never replaces the loader's real error.

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
  recorded runs with attempted pass rate, flaky count and flaky share, and a
  decorative pass-rate sparkline oldest to newest. One `passRate` helper in
  `format.ts` feeds both the health panel and the table, so `attempted === 0`
  states the same thing in both. The flaky share is a flagged share, not a
  probability; a positive share below 0.1% shows a less-than boundary and an old
  run without the field shows `—` for both flaky cells. A note below the table
  explains the tag-or-retry proxy, the run-meta tagged-count difference and the
  legacy `attempt: 0` limit.
- Static report (`static: true`, CLI `--static`): `html.ts` resolves the flag
  once and passes it to the three views. It omits both inline scripts, the
  client-message block, the tab bar, the lightbox and the toolbar/copy/image
  buttons; sets `script-src 'none'` while keeping `connect-src 'none'`; opens
  every `<details>`; and renders Report, Details and Trends as stacked visible
  sections, each a plain container inside a panel that keeps the same `tabPanel`
  class and view IDs. Both forms render exactly one `<main>` around all three
  views; it starts before `#report-view` and closes after the last present panel,
  the site header is the only banner and each view's run header sits inside main.
  The print page-break rule still applies. The flag controls scripts, controls,
  `open`, `hidden` and ARIA, not the landmark, and the mode stays opt-in.
- The history-only Trends shell fixes (wrapped tab strip, capped table with a
  sticky header, whole-word print headers, the `Current` tag on the date line
  and a ratio-correct sparkline) ship in `TRENDS_SHELL_CSS`, appended only when
  Trends renders. The no-history default HTML therefore gains no Trends CSS;
  the fixes apply to every report that has a Trends section, default or static.
  The separate measured scroll-offset script adds 170 B to every non-static
  0.6.0 report.
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
  header and detail rows; `baseline.ts` owns the comparison panel and the row
  badges, and joins the precomputed change map by pickle id; `format.ts` owns
  status, duration, date, bar, count, health, pass-rate and tag helpers;
  `types.ts` owns `RenderOptions` (including the optional `history` list,
  `static` flag and internal comparison), `DisplayStatus` and `OrderedFeature`.
  Two shared foundation modules carry localisation:
  `i18n.ts` owns locale resolution, the catalog translator and locale-aware
  number/percent/duration/date helpers, caching `Intl` formatters per translator;
  `client-i18n.ts` owns the browser formatter for the embedded `client.*` block,
  with every `Intl.PluralRules` category and numeric `#` parameters. `escape.ts`,
  `dom-contract.ts`, `markdown.ts`, `ansi.ts`, `styles.ts`, `client-bundle.ts`,
  `search.ts`, `report-client.ts`, `i18n.ts` and `client-i18n.ts` are shared
  foundation, importable from every layer.
  `src/attachment.ts` is a shared leaf below the renderer;
  `render/attachments.ts` reads the `textFormat` it produced.
- `src/i18n/locales/<tag>.json` are the catalog sources; `en.json` carries a
  description per key and is the fallback. `scripts/build-i18n.mjs` derives each
  tag from its file name and generates `src/i18n/catalogs.ts` (a `MessageKey`
  union plus `Record<MessageKey, string>` catalogs, no runtime JSON import);
  `npm run assets` runs it. Adding a left-to-right locale is mostly a data step:
  drop in the JSON file, then update the CLI usage line and any test that names
  the supported list; an RTL locale also needs a `DIRECTIONS` entry. `renderHtml`
  resolves `options.locale` once, sets `<html lang>`/`dir`, passes one translator
  to every view and always embeds the active `client.*` messages as an inert JSON
  block. The browser bundle contains no non-English catalog. See
  [`docs/I18N.md`](I18N.md).
- `src/render/report.css` is the stylesheet source; `scripts/build-styles.mjs`
  minifies it into `src/render/styles.ts` for the inline report. The baseline
  panel and badges live in `src/render/baseline.css`, minified into a second
  `BASELINE_CSS` constant and appended only when a comparison is supplied, so
  adding it does not change `report.css` or a report without a baseline; the
  0.6.1 shell rules are separate.
- `src/render/search.ts` carries the tag-expression, URL-state and open-state
  helpers; `src/render/report-client.ts` is the browser script.
  `src/render/print-script.ts` is the static print lifecycle, imported only by
  `html.ts` and embedded as a second CSP-hashed inline script.
  `src/render/dom-contract.ts` owns the scenario data attributes, the shared IDs
  and the pure visibility decisions used by both the templates and the client.
  `scripts/build-search.mjs` bundles
  `report-client.ts` and its helpers into one `CLIENT_SCRIPT` artifact in
  `src/render/client-bundle.ts`; `renderHtml` hashes both inline scripts into
  the CSP. `npm run assets` regenerates the generated modules.
- Adds a small shell: visible title, optional logo and accent colour, system
  dark mode.
- No CDN, no external fonts, no network requests.
- Injects a restrictive Content-Security-Policy meta tag.
- Optional external-attachments mode is a later change.

### `src/baseline`

- Owns the read-only baseline reader, matcher and classification. The CLI is the
  only file reader; the API accepts the validated `BaselineSummary` projection.
- The reader is read-only, `O_NONBLOCK` where available, checks the target before
  and after opening, caps it at 10 MiB (10,485,760 bytes), decodes strict UTF-8,
  strips a BOM, rejects a history sidecar, prototype keys, values deeper than 64
  levels and malformed entries, and applies `displayUri` to every baseline URI.
  It trusts only identity, status and `executed` (plus optional `example`);
  steps, tags, counts, attachments and a nested `baseline` block are ignored.
- `compareBaseline(baseline, current)` groups by feature + scenario name, matches
  a unique key, then pairs a repeated group in two passes: the example coordinate
  when every row on both sides carries it, then display URI for the genuinely
  unmatched remainder. A group that cannot be reduced to unique rows is
  ambiguous and makes no claim. Both passes use a key-to-index map, so the
  matcher is linear in the rows; a 20,000 by 20,000 repeated outline compares in
  well under 100 ms. It returns one comparison: the seven-count summary block and
  a change map keyed by pickle id.
- `src/summary.ts` type-imports the comparison type only; the comparison is
  built once in `src/run.ts`. `src/baseline.ts` imports `displayUri` from the
  summary module, so the runtime dependency points one way and there is no
  runtime cycle.

### `src/summary`

- Builds a renderer-independent, stable JSON summary from Messages.
- Reports overall status, executed scenario/step counts, durations, attachments
  and per-scenario step results with failure messages. With a comparison it adds
  the `baseline` block and a per-scenario `change`; Messages outline rows carry
  an unconditional `example` coordinate.
- `displayUri` shares `analyzePath` from `src/display-path.ts` with the legacy
  adapter. For an absolute path or file URL it removes the `file:` scheme, an
  empty/localhost authority, a remote authority (as the first path segment), an
  optional drive and a `/mnt/<drive>` mount, and treats `%2F`/`%5C` as
  separators for that analysis; it then drops every `Users`, `home` or
  `Documents and Settings` segment plus the next segment anywhere in the path,
  repeatedly. The result uses the `/features/` marker or the last three
  remaining segments, never a drive prefix, and is empty when nothing remains.
  Relative paths stay unchanged. The report model keeps raw URIs for provenance
  and uses the display URI for an unnamed feature's heading; the renderer uses
  it for display URIs and copied failure text.
- One comparator in `src/text` orders every deterministic text sort by UTF-16
  code units: summary scenarios, resolved input files, baseline not-in-run rows
  and report tags. No `Intl`, `localeCompare`, host locale or ICU collation
  participates, so the same input gives byte-identical `--json`, CI Markdown and
  report order across hosts. The visible order for non-ASCII names differs from
  locale-aware order.
- Pure: it builds from an index or envelope list and owns no file reading. The
  CLI always drives `summarizeReportFromResolved` in `src/run.ts`, the single
  summary seam, even without a baseline.
- Exposed as `summarizeReport(inputs, options?)`.
- Schema version 2 is documented in `docs/AGENT-INTERFACE.md`; breaking changes
  bump the version.

### `src/ci`

- Formats the summary as GitHub Actions workflow commands, Azure DevOps logging
  commands or deterministic Markdown for GitLab and step summaries.
- Pure and offline: no network, no report-model access and no schema change.
- Caps annotations and lists while keeping the exact counts. Markdown adds one
  `Baseline:` line after the counts table only when the summary carries a
  baseline block; GitHub and Azure bytes are unchanged.

### `src/email`

- Renders one self-contained HTML email summary from a `ReportSummary`; pure and
  synchronous, writing nothing and sending nothing.
- A 600 px table (`width: 100%`, `max-width: 600px`) with an inline system font
  stack, inline styles and a small `<style>` block that applies below 480 px, so
  600 px keeps the 2 by 2 metric grid; no scripts, images, links, hidden
  preheader or remote assets, so it makes no request and a standard summary stays
  under 100 KB.
- Shows the title/status, generation time, attempted pass rate as a percentage
  with a full-sentence note that skipped scenarios are not attempts, every
  non-zero status plus unexecuted, counts, feature/step/duration totals and the
  inline-attachment count labelled `Attachments in the run`, then the first five
  failed scenarios in summary order. The empty and all-unexecuted states are
  distinct. The heading, note and failed names wrap
  anywhere, and displayed names are capped at 200 characters with an ellipsis.
  The report note keeps only the basename, or states that no full report is
  attached.
- Uses the report translator for labels, percentages, dates and locale number
  formatting; email-local helpers render grouped digits (`8,509 bytes`) and
  durations as `12 ms`, `12.3 s`, `1 min 5 s` or `1 h 2 min`, leaving the report
  helpers unchanged. A validated accent becomes a border and invalid values are
  ignored. Exported as `renderEmail` with `EmailOptions`; the CLI and API produce
  identical HTML for the same summary, options and clock.

### `src/pdf`

- Opt-in PDF export: `renderPdf(html, { timeoutMs? })` returns the PDF bytes for
  already rendered report HTML; it writes no file and starts no server.
- `playwright-core` is imported dynamically inside the call, with a
  `createRequire(cwd/package.json)` fallback for globally installed or npx-cached
  Tolkira, launched headless, and marked external in esbuild. It is an optional
  peer: the default install and runtime dependency surface stay unchanged (the
  package gains the PDF docs), and a missing package or Chromium browser becomes
  one install error.
- The page receives the HTML with `page.setContent` (no temporary report or
  `file://` page). Before loading, HTTP(S) routes are aborted; every
  `img.loading` is set to `eager` so below-the-fold lazy thumbnails decode. Then
  the engine awaits `document.fonts.ready` and best-effort `img.decode()`. The
  native `page.pdf` lifecycle fires `beforeprint`, so the print script opens
  every detail without a manual dispatch. Print options are `format: 'A4'`,
  `printBackground`, `preferCSSPageSize` and `displayHeaderFooter: false`. The
  load uses the `setContent` timeout; the font/image wait and the print are each
  bounded by an explicit five-minute deadline (`--pdf-timeout`/
  `PdfOptions.timeoutMs`), because `page.pdf` has no timeout option. The browser
  is closed in `finally` with a short close deadline.
- A fresh page has no CLI filter state; the browser print remains the filtered
  and landscape route. Chromium-only, A4 portrait in this slice. The accepted
  `--no-sandbox` risk is documented in `docs/PDF.md`; B-029 tracks the OS
  sandbox. See `docs/PDF.md`.

### `src/history`

- Owns the opt-in aggregate history sidecar: schema version 1 or 2, a window of
  1 to 365 runs on the CLI/`generateReport` path and a 1 MiB size cap checked on
  the open descriptor before reading.
- The seam is read → append unless dedupe → keep the newest n. `readHistory`
  returns the newest `limit` runs without rewriting the file; `appendHistory`
  appends one run and slices to the window; `writeHistory` slices, caps titles
  and writes atomically with a trailing newline. An omitted limit is 30 in all
  three; an invalid limit throws `Use an integer from 1 to 365`.
- Schema 1 is the default for a default run on a schema-1 file. Schema 2 is
  written when the limit is above 30 or the file already used it, and is never
  downgraded; it only marks a file that may hold more than 30 runs and changes
  no run field. Readers accept both and `HISTORY_SCHEMA_VERSION_MAX` is the
  highest accepted version; a 0.5 reader rejects schema 2 with its
  unsupported-version error and leaves the file untouched. The write decision
  reads the target through the same bounded read at every limit, so a malformed
  or oversized target is an error, not a silent downgrade.
- The writer validates every stored run with the reader's field rules, caps
  titles at 200 code points and rejects an id longer than `HISTORY_MAX_ID` (128
  UTF-16 code units; the reader keeps accepting longer ids from older files). It
  then prunes the oldest entries until the serialized file is at or below
  1,048,576 bytes and always keeps the newest entry. A result still above the cap
  is rejected, so it never writes a file the reader would reject. A hand-made file
  above the cap is still rejected on read. The cap is a safety bound: a realistic
  365-run file measured 297,151 bytes (367,596 with 200-code-point titles) on
  Windows 11 Pro 10.0.26300, Node v26.13.1, and was not pruned; a maximal valid
  window can exceed the cap and is pruned through the public API, while the
  single-entry guard is not reachable through it.
- `buildHistoryRun` hashes the aggregates and the resolved title (capped at 200
  characters), excluding the recorded time; `appendHistory` keeps one copy of an
  identical last run and the old timestamp; `readHistory` rejects non-regular
  files, validates every documented field including cross-field count totals and
  the optional `flaky` bound, ignores unknown fields and never writes.
- Stores only id, recorded time, title, status, feature/scenario/step counts,
  duration, attachment totals and the optional flaky count. Old entries without
  `flaky` stay absent on read and append and render as `—`; new entries carry
  it, and it is part of the aggregate id. There is no scenario-level history,
  and the CLI is the only automatic writer, so concurrent processes can still
  lose an update.
- Exported through `src/index`; `generateReport` appends the current run,
  `renderReport` and `CucumberHtmlStream` render the list they are given.

### `src/run`

- Internal load/render/history assembly for a list the caller already resolved:
  `loadResolvedInputs` reads and parses the resolved files, `indexRun` builds the
  report index, and the summary, attachment totals and history come from that one
  run.
- `generateReportFromResolved`, `renderReportFromResolved` and
  `summarizeReportFromResolved` are the internal entry points for a resolved
  list; the CLI drives the first and the last.
- The public `generateReport`, `renderReport` and `summarizeReport` stay
  path-based and resolve first; the resolved list is not a package type.

### `src/cli`

- `tolkira <input...> [--out <file>] [--static] [--pdf <file>]`
  `[--pdf-timeout <ms>] [--email <file>] [--json]`
  `[--ci github|azure|markdown] [--ci-out <file>] [--history <file>]`
  `[--history-limit <n>] [--baseline <file>] [--locale <tag>] [--title <title>]`
  `[--meta key=value] [--logo <file>] [--accent <hex>] [--max-size <mb>]`.
- Auto-detects Messages and legacy JSON by content, not by file extension.
- Directories are scanned for `.json`, `.jsonl` and `.ndjson`, then sniffed by
  content; duplicate paths are resolved and read once.
- Exit codes: 0 success, 1 parse/render error, 2 usage error.
- Failing tests do not fail report generation; malformed input does.
- Writes atomically through a temporary file in the output directory.
- `--ci` may run without `--out`; `--ci-out` is a standalone atomic Markdown
  file and is rejected for GitHub and Azure annotations.
- `--history` requires `--out`. It is validated like an output path (inputs,
  logo, `--out`, `--pdf`, `--ci-out`, `--email`, `--baseline` and input
  directories, even when missing), read once before generation and written after
  the HTML. `--history-limit <n>` requires `--history` and accepts a decimal
  integer from 1 to 365 (default 30); the same limit goes to read, generate and
  write. A history read or write failure exits 1 and names the file; a written
  HTML stays in place.
- `--baseline <file>` reads one earlier schema-2 summary, needs `--out`,
  `--pdf`, `--json` or `--ci markdown`, and is validated against every input and
  output path before any read. A missing, unreadable, non-regular, oversized,
  invalid or wrong-schema baseline exits 1, names the file and writes nothing.
  The reader never rewrites it and the report and summary never embed its path.
- `--email` is an output: alone, with `--out`, `--json`, `--ci` or `--ci-out`
  (`--ci-out` still requires `--ci markdown`). It is validated like an output
  path and must not collide with an input, the logo, `--out`, `--ci-out`,
  `--history` or `--pdf`, and must not be written inside an input directory.
  `--title` sets the heading/suggested subject and `--accent` the top border,
  even standalone. The order is report, PDF, email, history, `--ci-out`, stdout.
  An email write failure exits 1, names the email path, keeps the report and
  skips later outputs; no temporary file remains.
- `--pdf <file>` is an output and can be the only one; the report HTML is then
  generated in memory. It composes with `--out`, `--email`, `--json`, `--ci` and
  `--history`. `--pdf-timeout <ms>` requires `--pdf` and accepts a positive
  integer up to 2,147,483,647; the value is passed to `renderPdf` as
  `timeoutMs`. The PDF is written atomically after the report and before the
  email; the path is validated against inputs, the logo, `--out`, `--ci-out`,
  `--history`, `--email` and input directories. A render or write failure exits
  1, names the PDF path, keeps the report and skips later outputs; no partial PDF
  remains and a raw engine error is capped at one 500-character line. A missing
  optional engine exits 1 with install guidance. `--logo` and `--history` still
  require `--out`; the PDF-only route has no logo or Trends.
- `--locale <tag>` requires `--out`, `--pdf` or `--email`, defaults to `en` and
  validates exact then primary-subtag matches (`de-AT` -> `de`) before
  generation. Unknown or empty tags exit 2 with `en, de`. The requested canonical
  tag reaches `<html lang>`; the JSON summary and CI text stay English.
- Warns before parsing, after option and path validation, when the resolved
  inputs total at least 50 MiB. The list is resolved once and the stat-only scan
  reads no content; the same list goes to the loader. The warning is advisory,
  names no path and changes no output or exit code; a later parse or cap error
  still reports its own message.
- Warns when the report HTML (also on a PDF-only run) exceeds 10 MB.
- `node:util parseArgs`; no CLI framework dependency.

### `src/index`

Programmatic API:

```ts
renderReport(inputs, options): Promise<string>
generateReport(inputs, options): Promise<{
  html, summary, skippedAttachments, inputFiles, inputBytes, history?
}>
renderEmail(summary, options): string
renderPdf(html, options?): Promise<Uint8Array>
summarizeReport(inputs, options?): Promise<ReportSummary>
```

`generateReport` accepts `history`, appends the current aggregate run and returns
the appended list; `historyLimit` bounds that list (default 30, range 1 to 365)
and is passed to `appendHistory`. `renderReport` renders `options.history`
without recording a run and has no `historyLimit` option. `inputFiles` and
`inputBytes` are the unique report files that formed loader groups (including
validation-only files with no envelopes) and their total size on disk; inline
media inside a report file is part of that file, while external path attachments
are not counted. `RenderReportOptions.locale` is optional and reaches the
renderer through `renderOptions`; `de-AT` keeps its tag and uses the `de`
catalog. `RenderReportOptions.static` (default false) reaches the renderer the
same way and selects the script-free stacked form; `--static` needs `--out` or
`--pdf`. `CucumberHtmlStream` accepts the same options. `renderEmail` is the
synchronous email renderer; it takes a `ReportSummary` and validated options,
writes nothing and shares the translator. `renderPdf` takes rendered
report HTML, returns PDF bytes and launches the optional engine only when
called; it accepts `PdfOptions` (`timeoutMs`) and writes no file. The CLI
resolves inputs once and drives the internal resolved entry points
(`generateReportFromResolved` and `summarizeReportFromResolved`) instead of
re-resolving through the path-based public functions.

`BaselineRenderOptions extends RenderReportOptions` with
`baseline?: BaselineSummary`; `generateReport`, `renderReport` and
`summarizeReport` accept it, build one comparison and never read a file.
`renderHtml` and `CucumberHtmlStream` keep `RenderOptions`/
`RenderReportOptions` and ignore a `baseline` key, so the stream's
same-input-same-HTML contract is unchanged. The package exports both
`BaselineSummary` and `BaselineRenderOptions`.

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
  finite non-negative numbers, ISO 8601-shaped time with a zone, count totals),
  opened as a regular file, capped at 1 MiB on the descriptor and rewritten
  atomically. It stores aggregates only, so it cannot leak scenario names, step
  text, paths, tags or attachment content.
- The baseline summary is untrusted: strict UTF-8, a regular-file check before
  and after opening, a 10 MiB cap, prototype-key and depth rejection, no file
  reads, links or rewrites from its content, and escaped, control-stripped
  feature/name/example text in the panel. The path is never embedded.
- The email summary escapes the title, feature/scenario names and report name,
  ignores an invalid accent, wraps and caps long names, and contains no script,
  image, link or remote URL. Its path is contained: it cannot overwrite an input
  or the logo, or land inside an input directory. It is opt-in, written atomically
  and never sent.
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
- The early input warning is one `stat` per resolved file and reads no content;
  it does not alter the loader's accounting. The loader keeps its per-file stat
  guard before reading, its content dedupe and the 100 MB total cap on unique
  loaded content after dedupe and skip.
- Stress baseline: 1,000 scenarios / 3,000 steps render in about 0.15–0.2 s to
  1.4 MB; 5,000 / 15,000 in about 0.4–0.5 s to 7.0 MB. Timings vary with host
  load.
- The CLI/`generateReport` history path is capped at 1 MiB and a window of 1 to
  365 runs (default 30), so trend rendering is linear in at most 365 aggregate
  entries there; `renderReport` accepts the given list as-is. On the 2026-11-24
  reference host (Windows 11 Pro 10.0.26300, Node v26.13.1) the
  `test/fixtures/messages/second.ndjson` report was 184,775 bytes at 365 runs
  against 84,484 bytes at the default 30, a 100,291-byte difference, measured
  with `scripts/history-window.mjs`. Both are well below the 10 MB
  (10,485,760-byte) default `--max-size` threshold, so no size warning fires.
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
  `test/history-window.test.ts` and `test/cli-history-window.test.ts` pin the
  configurable window, schema 1/2 choice, 1 MiB prune and the CLI errors;
  `test/cli-history.test.ts` and `test/render-trends.test.ts` cover the
  `--history` flow and the Trends view; `test/e2e/trends.spec.ts` covers the
  two-run browser flow at 320, 390, 1440 and 200 % text zoom.
  `test/baseline-reader.test.ts`, `test/baseline-matcher.test.ts`,
  `test/baseline-summary.test.ts`, `test/ci-baseline.test.ts`,
  `test/cli-baseline.test.ts`, `test/render-baseline.test.ts` and
  `test/e2e/baseline.spec.ts` pin the untrusted reader, two-pass identity,
  classification and reconciliation, JSON block, CI line, panel/badges and the
  two-run browser flow. `test/email.test.ts`,
  `test/cli-email.test.ts`, `test/email-catalog.test.ts` and
  `test/e2e/email.spec.ts` pin the email template, metrics, escaping, locale,
  size, CLI composition and 600/320 px rendering. `test/pdf.test.ts` mocks
  `playwright-core` and pins the print options, deadline, eager lazy images,
  HTTP(S) abort, cwd fallback, fonts/images, browser close and install errors
  without launching a browser; `test/cli-pdf.test.ts` pins `--pdf`/
  `--pdf-timeout`, order, paths, atomic binary write and failure; the
  Chromium-only `test/e2e/pdf.spec.ts` asserts the real `%PDF`, page count, A4
  MediaBox, 12 mm
  inset, German text and embedded screenshots.
- Fixtures: cucumber-js legacy JSON, Behave 1.3.3 real runs (statuses, doc
  strings, tables and inline images), cucumber-jvm and cucumber-ruby real runs,
  and a hand-built Messages stream with passing/failing scenarios and
  attachments.
- Browser test per critical flow: render, search, open a screenshot, verify an
  HTML attachment does not execute, and open the email at 600 and 320 px.
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
