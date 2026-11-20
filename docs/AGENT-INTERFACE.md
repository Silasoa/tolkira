# Tolkira for agents

Tolkira produces five things from the same input:

- a self-contained HTML report for humans;
- a stable JSON summary for programs and AI agents;
- deterministic CI text: GitHub Actions annotations or a Markdown summary;
- an opt-in HTML email summary for a status mail or chat message;
- an opt-in PDF print archive when the optional Playwright Chromium engine is
  installed.

The HTML report is the artifact. The JSON summary is the interface. The CI text
is a presentation of that same summary. Do not parse the HTML to decide whether
a test run passed.

## CLI

Generate HTML and print the JSON summary:

```shell
tolkira test-results/ --out report.html --json
```

Generate only the summary, without writing HTML:

```shell
tolkira test-results/ --json
```

`--json` writes exactly one JSON document to stdout. Warnings and errors go to
stderr. Exit codes are about report generation, not test status:

| Code | Meaning |
| ---- | ------- |
| 0    | Report or summary generated; tests may still have failed |
| 1    | Input could not be parsed or rendered, or the output could not be written |
| 2    | Invalid usage, including an invalid flag value or logo file |

Always read `status` from the JSON summary for the test outcome. A failed test
suite is exit code 0 by design.

## CI output

Format the same summary for CI instead of, or alongside, HTML and JSON:

```shell
# GitHub Actions workflow commands on stdout; no HTML required
tolkira test-results/ --ci github

# Markdown on stdout, or in a standalone file
tolkira test-results/ --ci markdown
tolkira test-results/ --out report.html --ci markdown --ci-out summary.md
```

- `--ci github` writes `::error` and `::notice` workflow commands. It needs no
  `--out` and rejects `--ci-out`: GitHub only reads workflow commands from
  stdout.
- `--ci markdown` writes deterministic Markdown with complete counts, a failed
  list and skipped names. `--title` sets the heading.
- Without `--ci-out`, CI text is the only stdout and the human confirmation is
  suppressed. With `--ci-out`, the file receives the CI text and stdout keeps
  its normal confirmation; with `--json`, stdout stays JSON only.
- `--ci-out` requires `--ci markdown`, is written atomically as a standalone
  file, and must not overwrite an input, the logo, `--out` or the `--email`
  file. To add to
  `$GITHUB_STEP_SUMMARY`, append stdout with `>>`; do not point `--ci-out` at a
  shared file.
- Exit codes are unchanged. A failed test run still exits 0; invalid
  combinations exit 2 before any file is written.
- Messages are copied verbatim and are not redacted. See [`CI.md`](CI.md).

GitHub mode caps at 50 error and 20 notice annotations and states the
remainder; the final count notice keeps the exact totals. A failed run status
without a scenario-level error produces one run-level error annotation.
Markdown caps the failed list at 50 scenarios, each message at 500 raw
characters and the skipped name list at 20, while the counts and the overall
`Status` row stay complete.

## Email summary

`--email <file>` writes one self-contained HTML mail body from the same summary.
It is another output, not a mode, and composes with `--out`, `--json`, `--ci` and
`--ci-out` (`--ci-out` still requires `--ci markdown`):

```shell
tolkira test-results/ --out report.html --email email.html
tolkira test-results/ --json --email email.html > summary.json
tolkira test-results/ --email email.html --locale de
```

- The file is a 600 px table with an inline system font stack and a small style
  block below 480 px, no scripts, images, links, remote assets or hidden
  preheader. The heading, note and failed names wrap anywhere; displayed feature,
  scenario and report-name strings are capped at 200 characters with an ellipsis.
  A standard summary stays under 100 KB.
- It shows the title and status, generation time, attempted pass rate as a
  percentage with a full-sentence note that the rate counts only executed
  (non-skipped) scenarios, every non-zero scenario status plus unexecuted, the
  total as scenarios with results, feature/step/duration/attachment totals and
  the first five failed scenarios in summary order
  (feature, name, status, duration; no steps or errors). The attachment count is
  labelled `Attachments in the run`. English digits are grouped (`8,509 bytes`)
  and durations are human (`12 ms`, `12.3 s`, `1 min 5 s`, `1 h 2 min`). An
  empty run and an all-unexecuted run are distinct; further failures are a
  count.
- `--title` sets the heading and suggested subject; `--accent` sets the top
  border even without `--out`. With `--out`, the report note names only the
  report basename and says to attach or share it separately. Without `--out`
  but with `--pdf`, it names the PDF basename because the PDF is the full
  artifact and is written first. With neither, it says that no full report is
  attached, so the mail never points at a file that does not exist.
- The email path is validated like an output: no collision with an input, the
  logo, `--out`, `--ci-out`, `--history` or `--pdf`, and no path inside an input
  directory (including through a junction or symlink); an empty path exits 2 and
  writes nothing. The write order is report, PDF, email, history, `--ci-out`,
  stdout. A write failure exits 1, names the email path, keeps the report and
  skips later outputs.
- `Email written to <path>` is printed only when stdout is free. With `--json`
  or `--ci` on stdout, the machine bytes are unchanged and no email line is
  added; with `--ci-out` and no `--json`, the line is printed.
- Tolkira writes the file only. There is no SMTP, sending, scheduling or
  network access. Feature and scenario names, the title (which may carry a
  branch or build name) and the report basename are included and not redacted.
  See [`EMAIL.md`](EMAIL.md).

## PDF export

`--pdf <file>` prints the complete report archive through the optional
Playwright Chromium engine. It is another output, not a mode, and composes with
`--out`, `--email`, `--json`, `--ci`/`--ci-out` and `--history`:

```shell
npm i -D playwright && npx playwright install chromium
tolkira test-results/ --out report.html --pdf report.pdf
tolkira test-results/ --pdf report.pdf --json > summary.json
tolkira test-results/ --pdf report.pdf --locale de
```

- The PDF is A4 with 12 mm print CSS margins, the light print palette and no
  browser header, footer, URL or page number. Chromium only in this slice.
- It is the complete archive (all views and details, screenshots, fitted tables)
  from a fresh page: the CLI search/filter does not apply. Video/audio do not
  print; use browser print for a filtered or landscape view.
- `--locale` is accepted with `--pdf` even without `--out` or `--email`; the PDF
  follows the report locale while CLI/JSON/CI stay English. `--accent` applies.
- Without `--out`, no report HTML is written. `--logo` and `--history` still
  require `--out` and exit 2.
- Write order: **report → PDF → email → history → `--ci-out` → stdout**. A PDF
  render or write failure exits 1, names the PDF path, keeps the report and skips
  the email/history/`--ci-out`/stdout; no partial PDF remains. A missing engine
  exits 1 with the install command.
- `PDF written to <path>` is printed only when stdout is free, like the report and
  email lines. JSON/CI stdout stays byte-identical.
- The PDF path is validated like an output: no collision with an input, the logo,
  `--out`, `--ci-out`, `--history` or `--email`, and no path inside an input
  directory; a collision exits 2.
- The email with `--out` names the report; without `--out` it names the PDF
  because the PDF is written first.
- The engine is optional and dynamically imported; the default install, report,
  JSON, email and CI bytes are unchanged. See [`PDF.md`](PDF.md).

## Report locale

`--locale <tag>` localizes the HTML report, the optional email summary and the
PDF. It requires `--out`, `--pdf` or `--email`, defaults to `en`, and accepts
`en` or `de`;
`de-AT` keeps the regional tag for `<html lang>` and uses the German catalog. An
empty or unknown tag exits 2 with the supported list before anything is written;
the API throws instead. The JSON summary, CI text, exit codes, summary keys and
the default title `Tolkira report` are unchanged. Test data renders verbatim in
every locale. With only `--json` or `--ci`, `--locale` stays a usage error. See
[`I18N.md`](I18N.md).

## API

```ts
import {
  generateReport,
  readHistory,
  renderEmail,
  renderPdf,
  renderReport,
  summarizeReport,
} from 'tolkira';

const inputs = ['test-results/'];
const summary = await summarizeReport(inputs);
const previousRuns = await readHistory('.history/history.json');
const { html, summary: sameSummary, skippedAttachments, history } =
  await generateReport(inputs, {
    title: 'Nightly',
    locale: 'de',
    metadata: { CI: 'true', Commit: process.env.GITHUB_SHA ?? '' },
    logo: 'data:image/png;base64,...',
    accent: '#1b5e20',
    history: previousRuns,
  });
const htmlOnly = await renderReport(inputs, { title: 'Nightly', locale: 'de' });
const email = renderEmail(summary, {
  title: 'Nightly',
  locale: 'de',
  reportName: 'report.html',
  accent: '#1b5e20',
  now: new Date('2026-11-20T09:30:00.000Z'),
});
const pdf = await renderPdf(html, { timeoutMs: 300_000 });
```

`renderEmail(summary, options)` is synchronous and returns the same HTML the CLI
writes for the same summary, options and clock. `EmailOptions` has `title`,
`locale`, `reportName`, `accent` and `now`; there is no logo option. It writes
nothing and sends nothing. Invalid accents are ignored, an unrecognised summary
status falls back to the `Unknown` label and colour, and an invalid `now` omits
the generated date. The title, test names and report name are escaped; the report
note keeps only the basename. The CLI strips control characters from its
`Email written to` confirmation.

`renderPdf(html, options)` returns the PDF bytes for already rendered report
HTML. `PdfOptions` has only the optional `timeoutMs` (default five minutes). It
writes no file, starts no server and uses the same optional Chromium engine as
the CLI; a missing engine throws an install error. The CLI and API produce
equivalent PDFs for the same HTML and engine.

`skippedAttachments` is the number of Playwright path attachments skipped
because they resolve outside every allowed root. It is a plain number, additive
to the returned object; the HTML notice and the CLI stderr warning use it, while
the summary document keeps schema version 2 and no warning field.

`history` is the aggregate run list the HTML was rendered with; it already
contains the current run. `generateReport` appends the current run to
`options.history` and returns the appended list. `renderReport` and
`CucumberHtmlStream` render `options.history` exactly as given and record
nothing. Both fields are additive.

The package is ESM, Node.js 22 or newer, and has no network or telemetry code.

| Option | CLI | API |
| ------ | --- | --- |
| title | `--title` sets the report heading, Markdown CI heading and email heading/suggested subject | `title` |
| metadata | `--meta key=value` (repeatable) | `metadata` object |
| logo | `--logo <file>` reads a local image | `logo` base64 image data URI |
| accent | `--accent #rrggbb` | `accent` hex string; invalid values are ignored |
| history | `--history <file>` reads and appends a sidecar; needs `--out` | `history` array; `generateReport` appends the current run, `renderReport` and the stream render it as given |
| locale | `--locale <tag>` (`en` or `de`; needs `--out`, `--pdf` or `--email`) | `locale` string; default `en` |
| email | `--email <file>` writes an HTML summary | `renderEmail(summary, options)` |
| pdf | `--pdf <file>` prints the report with optional Playwright Chromium | `renderPdf(html, { timeoutMs })` |
| size warning | `--max-size <mb>` (default 10) | not applicable; the API returns HTML |
| CI output | `--ci github\|markdown`, `--ci-out <file>` | not applicable; format the summary yourself |

The CLI validates logo bytes and rejects unsupported types or a size over
2 MB. The API only accepts a `data:image/...;base64,...` logo; anything else is
omitted.

## Messages stream

`CucumberHtmlStream` is a shape-compatible Node `Transform` for callers that
already hold Cucumber Messages envelopes:

```ts
import { Readable } from 'node:stream';
import { CucumberHtmlStream } from 'tolkira';

const html = await new Promise<string>((resolve, reject) => {
  let output = '';
  Readable.from(envelopes)
    .pipe(new CucumberHtmlStream({ title: 'Nightly' }))
    .on('data', (chunk) => (output += chunk))
    .on('error', reject)
    .on('end', () => resolve(output));
});
```

The stream accepts `Envelope` objects in object mode, buffers the run and
renders one HTML document on flush. It takes `RenderReportOptions` (title,
metadata, logo, accent, locale and the optional history list) and produces the
same HTML for the same envelopes and options. A supplied `history` is rendered
exactly as given; only `generateReport` appends the current run. The stream is
not an incremental renderer, writes no files and emits no summary; use
`summarizeReport` or `generateReport` when you also need the stable JSON. The
whole run is held in memory, exactly like the file API.

## Run history

`--history <file>` keeps an aggregate sidecar of prior runs and renders a
`Trends` tab once the report is generated with two or more entries. It requires
`--out`; without the flag no history is read or written and the report contains
no history data or Trends tab.

```shell
tolkira test-results/ --out report.html --history .history/history.json
```

The sidecar is UTF-8 JSON with schema version 1:

```json
{
  "schemaVersion": 1,
  "runs": [
    {
      "id": "0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9",
      "recordedAt": "2026-11-19T06:00:00.000Z",
      "title": "Nightly",
      "status": "failed",
      "counts": {
        "features": 3,
        "scenarios": {
          "total": 10,
          "passed": 6,
          "failed": 2,
          "skipped": 1,
          "pending": 1,
          "undefined": 0,
          "ambiguous": 0,
          "unknown": 0
        },
        "steps": {
          "total": 42,
          "passed": 34,
          "failed": 3,
          "skipped": 2,
          "pending": 1,
          "undefined": 1,
          "ambiguous": 1,
          "unknown": 0
        }
      },
      "durationMs": 12345.678,
      "attachments": { "total": 2, "bytes": 4096 }
    }
  ]
}
```

Contract:

- `schemaVersion` is `1`. A wrong version is rejected; unknown fields inside
  version 1 are ignored and the reader copies only the documented fields.
- `id` is the SHA-256 of the aggregates and the resolved title, excluding
  `recordedAt`. When the last entry has the same id, the new run is not
  appended and the old `recordedAt` stays.
- The sidecar keeps the newest 30 runs; older entries are dropped on read, on
  append and on write. A file above 1 MiB is rejected before it is read.
- `title` is the resolved report title (`Tolkira report` when `--title` is
  absent), capped at 200 characters including a trailing `…`; a longer title is
  truncated before it is hashed or written. `durationMs` is the summary
  duration, not wall-clock time.
- Only aggregates are stored: no scenario names, step text, paths, tags or
  attachment content. The report embeds the prior-run aggregates it was
  generated with, so anyone who receives the HTML can read the pass-rate
  history. Use one sidecar per suite and variant; mixing runs makes the trend
  meaningless.
- A missing file starts empty. Invalid JSON, a wrong schema version, an
  oversized file, a malformed entry or a write failure exits 1 and names the
  file. A bad file is never overwritten. The HTML is written first; a failed
  history write leaves it in place and leaves no partial sidecar.
- `--history` follows the output-path rules: it must not name an input, the
  logo, `--out`, `--ci-out`, `--email` or a path inside an input directory, even
  when the history file does not exist yet.
- The CLI (through `generateReport`) is the only automatic writer. API callers
  write through `writeHistory`; `renderReport` and `CucumberHtmlStream` render a
  given list and record nothing. The writer reads, appends and writes atomically
  with a rename; that prevents a corrupt file, not lost updates from two
  concurrent processes. Run one generation per sidecar at a time.
- The 30-run bound applies to the CLI and `generateReport` path through
  `readHistory` and `appendHistory`; `renderReport` and `CucumberHtmlStream`
  accept the list they are given.

The package exports `HistoryRun`, `HISTORY_SCHEMA_VERSION`, `HISTORY_LIMIT`,
`HISTORY_MAX_BYTES`, `HISTORY_MAX_TITLE`, `buildHistoryRun`, `appendHistory`,
`readHistory` and `writeHistory` for programmatic use.

## Summary schema, version 2

```json
{
  "schemaVersion": 2,
  "status": "failed",
  "durationMs": 12.4,
  "counts": {
    "features": 1,
    "scenarios": {
      "total": 2,
      "passed": 1,
      "failed": 1,
      "skipped": 0,
      "pending": 0,
      "undefined": 0,
      "ambiguous": 0,
      "unknown": 0
    },
    "steps": {
      "total": 2,
      "passed": 1,
      "failed": 1,
      "skipped": 0,
      "pending": 0,
      "undefined": 0,
      "ambiguous": 0,
      "unknown": 0
    }
  },
  "attachments": {
    "total": 1,
    "bytes": 68
  },
  "scenarios": [
    {
      "name": "Failing scenario",
      "uri": "features/screenshot.feature",
      "feature": "Screenshot attachment",
      "status": "failed",
      "executed": true,
      "durationMs": 10,
      "attempt": 0,
      "tags": ["@failing"],
      "attachments": 0,
      "steps": [
        {
          "keyword": "Then",
          "text": "the assertion fails",
          "status": "failed",
          "durationMs": 10,
          "message": "Expected 1 to equal 2"
        }
      ]
    }
  ]
}
```

This example is abridged: it shows only the failing scenario, not the passing
one that carries the screenshot. The totals reflect the whole input.

Undefined and ambiguous Messages steps add optional diagnostic fields:

```json
{
  "keyword": "Given",
  "text": "a list of 8 things",
  "status": "undefined",
  "durationMs": 0,
  "suggestions": [
    {
      "language": "typescript",
      "code": "Given(\"a list of {int} things\", (int: number) => {\n  return \"pending\"\n})"
    },
    {
      "language": "typescript",
      "code": "Given(\"a list of {float} things\", (float: number) => {\n  return \"pending\"\n})"
    }
  ]
}
```

```json
{
  "keyword": "Given",
  "text": "a step with multiple definitions",
  "status": "ambiguous",
  "durationMs": 0,
  "definitions": [
    {
      "pattern": "^a (.*?) with (.*?)$",
      "source": "samples/ambiguous/ambiguous.ts:3"
    },
    {
      "pattern": "^a step with (.*?)$",
      "source": "samples/ambiguous/ambiguous.ts:7"
    }
  ]
}
```

Field contract:

- `schemaVersion` is `2`. A breaking change increments it.
- `status` is one of `passed`, `failed`, `skipped`, `pending`, `undefined`,
  `ambiguous`, `unknown`.
- `status` is the worst executed scenario status, or `failed` when a test-run
  hook fails. A scenario is the worst step status, using the standard Cucumber
  severity order. When nothing executed, the run status is `unknown` unless a
  test-run hook failed.
- `counts.features` is the number of features with at least one scenario row,
  executed or unexecuted, matching the HTML feature list. A document whose
  pickles never started contributes no row and is not counted.
- `counts.scenarios` counts executed scenarios only, so `total` can be smaller
  than `scenarios.length`. `counts.scenarios` and `counts.steps` always contain
  every status key, even when the value is `0`. `total` is the sum. The HTML
  pass rate and feature pass text use attempted (non-skipped) scenarios, while
  counts, pills and bars include skipped results.
- `scenarios[].executed` is `true` when the selected test case reported at
  least one raw step result, including a hook result. Adapters represent a
  reported skip without steps as a synthetic skipped step, so the summary
  reports it as executed. An unexecuted scenario keeps `status: "unknown"` and
  `executed: false`; it is not counted in `counts.scenarios`. A pickle that
  never started has no entry at all.
- `durationMs` is a number of milliseconds and sums the final attempt per
  scenario plus test-run hooks. It is not wall-clock time.
  `steps[].durationMs` is rounded to three decimals.
- `scenarios` is sorted by `uri`, then `name`, so output is stable across runs.
- `scenarios[].name` is the Cucumber pickle name. Examples of one scenario
  outline can share the same name; the HTML report labels rows with `#1.1` and
  shows the examples block name on the examples heading and in triage and
  copy-failure text, but the summary does not expose them yet.
- `scenarios[].tags` is the inherited pickle tag set, including feature, rule,
  scenario and examples tags. The HTML report uses the same set for its tag
  filter and search. Feature and rule tags render once at their section;
  scenario tags render on the scenario row or, for an outline, on the outline
  heading, and examples tags on the examples heading. Example rows repeat
  neither scenario nor examples tags. The summary does not expose rules,
  backgrounds or the own/inherited distinction.
- `attempt` is the latest started Cucumber attempt for that scenario, even when
  that attempt reported no result. An earlier retried attempt is ignored. For a
  Playwright JSON input it is the Playwright retry index of the final result;
  earlier attempts are not exposed as scenario rows.
- `attachments.bytes` is the decoded size, not the base64 length.
- `steps[].message` is present only when the step result has a message. For
  hooks, `keyword` is `"Hook"`, `text` is the hook type and `name` is present
  when Cucumber provides one. Summary step counts include hook entries; the
  HTML report counts steps and hooks separately. A failed test-run hook makes
  the overall summary `status` failed.
- `steps[].suggestions` is present only for an undefined Messages step with
  `suggestion` envelopes. Each entry has an optional `language` and the `code`
  to implement. `steps[].definitions` is present only for an ambiguous Messages
  step with `stepDefinition` envelopes. Each entry has the `pattern` and an
  optional `source` in `uri:line` form with absolute paths reduced to a
  relative form. Both fields are additive, so `schemaVersion` stays 2;
  a passed step never carries them.
- Attachment file names are not part of the summary. `scenarios[].attachments`
  is a count and is 0 for an unexecuted scenario; open the HTML report to see
  the image or file. Unnamed attachments use a deterministic
  `attachment.<ext>` fallback in HTML; unknown media types normalise to
  `application/octet-stream` and `attachment.bin`.
- CI metadata from Messages `meta.ci` is HTML-only. It renders in the report
  header and Details, but no CI field appears in the summary and
  `schemaVersion` stays 2. When `ci.name` is missing, the http(s) `ci.url` is
  the link text. In a mixed input the first non-empty CI block wins, and
  meta synthesized by the legacy adapter cannot erase it. Legacy JSON and
  JUnit never invent CI metadata; use the `metadata` option for a legacy path.

## Migrating to schema version 2

Version 2 adds `executed` to every scenario and changes scenario counts to
cover executed scenarios only:

- `counts.scenarios.total` can be smaller than `scenarios.length`; use the
  counts for aggregate decisions.
- An unexecuted scenario has `status: "unknown"` and `executed: false`. That
  `unknown` is not a failure signal.
- Filter on `executed` (or use `counts.scenarios`) before treating a
  scenario's `status` as an outcome. A legacy Cucumber JSON scenario with no
  steps and no hooks is now unexecuted, so its scenario total drops by one
  compared with version 1.
- Never-started pickles remain absent from `scenarios` and the counts.

The summary does not expose absolute input paths: absolute `uri` values are
reduced to a relative form (`features/...`, or the last path segments for files
outside `features/`).

## Recommended agent workflow

1. Run the tests and keep the raw Cucumber JSON or Messages.
2. Run `tolkira <inputs> --out report.html --json`; add `--email email.html`
   when a status mail or chat message is part of the job.
3. Parse stdout once. Filter on `executed` (or use `counts`) and use `status`,
   counts and `scenarios[].steps[].message` for diagnosis.
4. If you need screenshots or the full Gherkin view, open `report.html`; do not
   scrape it for pass/fail data.
5. Attach or upload the HTML report as the human-facing artifact; use
   `email.html` as optional mail body, never as the only record.

## Current limits

- Remote attachments (`attachment.url`, `externalAttachment`) are rejected on
  purpose; the report must work offline. Inline the bytes.
- Description Markdown renders only in the HTML report. Remote image
  destinations are neutralised and images render as alt text, so the report
  loads no external asset. JUnit `description` attributes are a best-effort,
  non-standard mapping; they never appear in the summary.
- Tag-expression search, the tag dropdown and `?query=`/`?hide=`/`?tag=` URL
  state are HTML-only progressive enhancements. `?hide=` also accepts
  `unexecuted`, a pseudo-status for the failed-only preset that hides rows
  without an outcome; it is restored only with the preset chip state and a
  pruned value is removed from the URL. The summary schema and counts are
  unchanged; the static no-JS report keeps the inert control and all rows.
- Inputs are capped at 100 MB in total; attachments at 50 MB each and 100 MB
  total.
- The HTML report includes a hash-based CSP and never executes attachments.
- History is an opt-in aggregate sidecar (`--history`); there is no
  scenario-level history, dashboard or server. Retries beyond the latest attempt
  and a trace viewer are not supported. Playwright JSON has a native adapter;
  the final attempt is the rendered one. JUnit XML is a basic input mode; see
  [`LIMITATIONS.md`](LIMITATIONS.md). Playwright producer metadata and
  annotation descriptions are HTML-only and do not change schema version 2.
- The email summary is opt-in and file-only. It has no sending, recipients,
  scheduling, `.eml` draft, logo, error snippets or redaction mode; the report
  basename (or the no-report note) is the only path-like content.
- PDF export is opt-in, Chromium-only and file-only. It has no page numbers,
  custom header/footer, tagged PDF, CLI filter, forced landscape, PDF-only logo
  or PDF-only Trends; it needs a separate engine and browser install. See
  [`PDF.md`](PDF.md).
- Playwright path attachments are embedded only when the resolved regular file
  is inside the input file's directory or the process working directory.
  Symlinked, missing, non-regular and outside-tree paths are skipped; inline
  base64 attachments are always preferred. An outside-tree path that exists as a
  regular file is counted in `generateReport().skippedAttachments` and surfaces
  as an HTML notice and a CLI stderr warning; later-missing files, symlinks and
  the other skipped causes are not counted. Trace zips and HTML-report replays
  are not read.
- Legacy Cucumber JSON outlines arrive as expanded scenarios; the original
  outline `examples` table is not reconstructed. Behave durations are seconds
  and are normalised to milliseconds; multiline doc strings and error messages
  arrive as line arrays and are joined with newlines. Behave's `error` and
  `hook_error` step-result statuses map to failed; `cleanup_error`, which Behave
  records on the scenario/feature during context cleanup, is accepted
  defensively as a failed step result.
- Rules and backgrounds are an HTML presentation feature. The version-2 summary
  keeps the flat scenario list; `scenarios[].tags` remains the inherited tag
  set. Legacy JSON and JUnit never invent rule or background structure.
- Legacy Cucumber JSON and JUnit have no suggestion or step-definition
  envelopes. An undefined or ambiguous legacy step still shows the status lead
  in HTML, but never invented snippets or definitions; JUnit renders no
  diagnostics.
- cucumber-js, Behave, cucumber-jvm, cucumber-ruby and Messages inputs are
  covered by fixtures.
