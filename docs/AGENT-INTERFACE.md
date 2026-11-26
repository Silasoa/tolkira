# Tolkira for agents

Tolkira produces six things from the same input:

- a self-contained HTML report for humans;
- a stable JSON summary for programs and AI agents;
- deterministic CI text: GitHub Actions or Azure DevOps annotations, or a
  Markdown summary;
- an opt-in HTML email summary for a status mail or chat message;
- an opt-in PDF print archive when the optional Playwright Chromium engine is
  installed;
- an opt-in JSON manifest that lists the files written before it and the first
  failures.

The HTML report is the artifact. The JSON summary is the interface. The CI text
is a presentation of that same summary. Do not parse the HTML to decide whether
a test run passed. For a copy-paste block for an `AGENTS.md`, a skill or a tool
description, see [`AGENT-SNIPPET.md`](AGENT-SNIPPET.md).

## CLI

Generate HTML and print the JSON summary:

```shell
tolkira test-results/ --out report.html --json
```

Generate only the summary, without writing HTML:

```shell
tolkira test-results/ --json
```

Discover the installed machine surface and write a run manifest:

```shell
tolkira --capabilities
tolkira test-results/ --out report.html --manifest run.json
```

At least one of `--out`, `--pdf`, `--email`, `--json`, `--ci` or `--manifest`
is required; `--manifest` alone is a valid summary-only run.

`--json` writes exactly one JSON document to stdout. Warnings and errors go to
stderr. Exit codes are about output generation, not test status:

| Code | Meaning |
| ---- | ------- |
| 0    | Requested output generated (report, summary, manifest or another file); tests may still have failed |
| 1    | Input could not be parsed or rendered, or a requested output could not be written |
| 2    | Invalid usage, including an invalid flag value or logo file |

Read `status` from the JSON summary or the manifest for the test outcome. A
failed test suite is exit code 0 by design.

A failed `--out` write exits 1 and reports
`Cannot write report to <target> (<code>)`; a failed `--ci-out` write reports
`Cannot write CI output to <target> (<code>)`. The target is one-lined, the Node
error code appears when present, no `.tmp` name or UUID appears, and no partial
file remains. A failed report write writes no later output; a failed CI write
keeps an already written report, skips the manifest and writes no later stdout.

## Capabilities

`tolkira --capabilities` prints one schema-1 JSON document and exits 0. It takes
no input and no other option: a positional input or another valid flag exits 2
with `--capabilities takes no input and no other option; run tolkira
--capabilities alone`, followed by the usage text, and nothing is read or
written; an unknown flag keeps the normal unknown-option error. `--help` and
`--version` keep precedence.

```json
{
  "schemaVersion": 1,
  "name": "tolkira",
  "version": "0.6.1",
  "node": ">=22",
  "inputs": [
    "cucumber-legacy-json",
    "junit-xml",
    "cucumber-messages",
    "playwright-json"
  ],
  "outputs": [
    { "kind": "report", "flag": "--out" },
    { "kind": "pdf", "flag": "--pdf" },
    { "kind": "email", "flag": "--email" },
    { "kind": "json-summary", "flag": "--json" },
    { "kind": "ci-github", "flag": "--ci github" },
    { "kind": "ci-azure", "flag": "--ci azure" },
    { "kind": "ci-markdown", "flag": "--ci markdown", "fileFlag": "--ci-out" },
    { "kind": "history", "flag": "--history" },
    { "kind": "manifest", "flag": "--manifest" }
  ],
  "summarySchemaVersion": 2,
  "locales": ["en", "de"],
  "limits": {
    "inputTotalBytes": 104857600,
    "inputWarnBytes": 52428800,
    "attachmentBytes": 52428800,
    "totalAttachmentBytes": 104857600,
    "baselineBytes": 10485760,
    "historyBytes": 1048576,
    "historyLimitMax": 365
  },
  "defaults": {
    "reportWarnMb": 10,
    "pdfTimeoutMs": 300000,
    "historyLimit": 30
  },
  "exitCodes": {
    "generated": 0,
    "inputOrWriteFailure": 1,
    "usage": 2
  }
}
```

- Top-level keys are exactly this order; each `outputs` entry has `kind`,
  `flag` and, for markdown, `fileFlag`.
- Every value has one source. Limits come from their enforcing modules;
  `summarySchemaVersion` and `locales` come from their constants. `version` is
  the running package version (`tolkira --version`) and `node` is the package's
  Node range, both pinned to `package.json` by tests. `inputs` lists the four
  accepted input kinds in detection order, each proven by a `detectInput`
  fixture. `outputs` lists report, PDF, email, JSON summary, history, manifest
  and the CI formats; `ci-markdown` names `--ci-out` as its file form.
  `defaults` (`reportWarnMb`, `pdfTimeoutMs`,
  `historyLimit`) are overridable option defaults, not caps.
- The document is deterministic: no timestamp, cwd, environment value or
  unbounded array. It stays under 4,096 bytes.
- `--static` and the other modifiers are not enumerated in schema 1; `--help`
  and this document own them. A future additive schema can add them.

## Run manifest

`tolkira <inputs> --manifest <file>` writes a schema-1 JSON manifest of the run.
It is opt-in and adds no file to a run without the flag. `--manifest` alone
satisfies the at-least-one-output rule, so a summary-only run is valid:

```shell
tolkira test-results/ --manifest run.json
tolkira test-results/ --out report.html --json --manifest run.json
```

```json
{
  "schemaVersion": 1,
  "tool": { "name": "tolkira", "version": "0.6.1" },
  "status": "failed",
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
  "attachments": { "total": 1, "bytes": 68 },
  "warnings": { "skippedAttachments": 0 },
  "artifacts": [
    { "kind": "report", "path": "report.html" },
    { "kind": "ci-markdown", "path": "summary.md" }
  ],
  "failures": [
    {
      "feature": "Checkout",
      "name": "pays by card",
      "example": "#1.2",
      "uri": "features/checkout.feature"
    }
  ]
}
```

- Keys are in this order: `schemaVersion`, `tool`, `status`, `counts`,
  `attachments`, `warnings`, `artifacts`, `failures`. `status`, `counts` and
  `attachments` are the summary values copied as-is, so counts cover executed
  rows only and every status key is present. `tool.version` is the running
  package version.
- `warnings.skippedAttachments` is the run's skipped-attachment count, whether
  or not that CLI path prints the stderr warning. The summary-only path does not
  print the skipped-attachment warning but still reports the true count; it is
  `0` when nothing was skipped.
- `failures` holds the first 10 failed scenario rows in summary order, with the
  display `uri` and the outline `example` coordinate when the row has one.
  `counts.scenarios.failed` carries the complete number. A failed run hook with
  no failed scenario leaves `failures` empty while `status` stays `failed`; the
  status and counts are authoritative.
- `artifacts` lists only files written before the manifest, once each, in write
  order: `report`, `pdf`, `email`, `history`, `ci-markdown`. The JSON summary on
  stdout and the manifest itself are not artifacts. Each `path` is relative to
  the manifest file's directory with `/` separators. An absolute artifact path
  is recorded as given only when no relative path exists, such as across Windows
  drives; a relative artifact path that cannot be expressed relative to the
  manifest is a usage error that exits 2 before any write. Beyond that absolute
  fallback, it never contains the cwd and never names an input.
- The document has no timestamp, attachment content or second copy of the
  scenario rows. It is deterministic for the same run and options.
- The path must be non-empty and is validated like every other output: it must
  not name an input, the logo, `--out`, `--pdf`, `--email`, `--history`,
  `--ci-out` or `--baseline`, and must not sit inside an input directory even
  when it does not exist. A collision or empty path exits 2 before any write.
  The file uses the same atomic `0600` writer as the other outputs.
- Write order is report → PDF → email → history → `--ci-out` → manifest →
  stdout. The manifest is the last file written. On a write failure the CLI
  exits 1 with `Cannot write manifest to <path>`, keeps earlier outputs, skips
  all later stdout including `--json`/`--ci`, and leaves no partial file.
  `Manifest written to <path>` appears only when stdout is free; with `--json`
  or `--ci` on stdout, the machine bytes are unchanged.

## CI output

Format the same summary for CI instead of, or alongside, HTML and JSON:

```shell
# GitHub Actions workflow commands on stdout; no HTML required
tolkira test-results/ --ci github

# Azure DevOps logging commands on stdout; no HTML required
tolkira test-results/ --ci azure

# Markdown on stdout, or in a standalone file
tolkira test-results/ --ci markdown
tolkira test-results/ --out report.html --ci markdown --ci-out summary.md
```

- `--ci github` writes `::error` and `::notice` workflow commands. It needs no
  `--out` and rejects `--ci-out`: GitHub only reads workflow commands from
  stdout.
- `--ci azure` writes `##vso[task.logissue ...]` commands and a final
  `##[section]Tolkira:` count line for Azure Pipelines. It needs no `--out`,
  rejects `--ci-out`, emits no `##vso[task.complete]` and keeps exit 0.
  `type=error` commands may still mark the Azure step failed, so publish
  artifacts in a later `condition: succeededOrFailed()` step.
- `--ci markdown` writes deterministic Markdown with complete counts, a failed
  list and skipped names. `--title` sets the heading.
- Without `--ci-out`, CI text is the only stdout and the human confirmation is
  suppressed. With `--ci-out`, the file receives the CI text and stdout keeps
  its normal confirmation; with `--json`, stdout stays JSON only.
- `--ci-out` requires `--ci markdown`, is written atomically as a standalone
  file, and must not overwrite an input, the logo, `--out`, the `--email` file or
  the `--manifest` file. To add to
  `$GITHUB_STEP_SUMMARY`, append stdout with `>>`; do not point `--ci-out` at a
  shared file.
- Exit codes are unchanged. A failed test run still exits 0; invalid
  combinations exit 2 before any file is written.
- Messages are copied without additional redaction (the Playwright adapter
  already scrubs absolute local paths from its error text). See
  [`CI.md`](CI.md).

GitHub mode caps at 50 error and 20 notice annotations and states the
remainder; the final count notice keeps the exact totals. A failed run status
without a scenario-level error produces one run-level error annotation. Azure
mode caps error commands at 50 and warnings at 20, truncates each complete
message at 4,000 code points and escapes `%`, `]`, CR, LF and Unicode line
separators into one inert command line. Markdown caps the failed list at 50
scenarios, each message at 500 raw characters and the skipped name list at 20,
while the counts and the overall `Status` row stay complete. The GitHub
annotation title (feature + scenario identity) and the Markdown heading
(`--title` included), feature name, scenario name, URI and skipped identity cap
at 200 Unicode code points before escaping or code-span wrapping. The
`[truncated]` marker stays literal when appended, and a surrogate pair is never
split. The counts, the full report, the failure-message
limits, the 50/20 list limits and the Azure 4,000-code-point message cap are
unchanged.

## Baseline comparison

`--baseline <file>` reads an earlier schema-2 `--json` summary and compares it
with the current run. The comparison appears in the HTML report, in the JSON
summary and in Markdown CI text:

```shell
# Report with the comparison panel and row badges
tolkira test-results/ --out report.html --baseline previous.json

# Comparison block and per-scenario change in the JSON summary
tolkira test-results/ --json --baseline previous.json

# One Markdown baseline line after the counts table
tolkira test-results/ --ci markdown --baseline previous.json
```

- The baseline is a read-only earlier `--json` document. It is never rewritten,
  and the report and summary never embed its path.
- It needs a surface that shows it: `--out`, `--pdf`, `--json` or
  `--ci markdown`. `--email` alone, `--ci github` alone or `--ci azure` alone is
  a usage error (exit 2). GitHub and Azure annotation bytes do not change; the
  email stays current-run only.
- A baseline path that names an input, the logo, `--out`, `--pdf`, `--email`,
  `--history`, `--ci-out`, `--manifest` or a path inside an input directory is a
  usage error (exit 2) before any read. A missing, unreadable, non-regular,
  oversized, invalid or wrong-schema baseline exits 1, names the file and
  writes nothing. The cap is 10 MiB (10,485,760 bytes).
- Match by feature name + scenario name. A unique key matches. A repeated group
  is paired in two passes: the outline example coordinate when every row on both
  sides carries `example`, then display URI for the genuinely unmatched remainder
  when exactly one unmatched row on each side carries it. A group that still
  cannot be reduced to unique rows is ambiguous: its rows make no claim and
  count once in `ambiguous`. Pickle id, order, line, tags, step text and status
  are never identity.
- Classify every baseline row outside an ambiguous group as new failure, fixed,
  still failing, `other` (no claim) or not in this run. An unmatched current row
  that fails is a new failure; an unmatched executed row that does not fail is
  `added`. New failure means the row fails now and did not fail in the baseline,
  including a scenario new to the suite; there is no separate regressed class.
  Not in this run means absent from this summary (deleted, never started,
  filtered or another shard), not a claim of deletion. A repeated group that
  gains an extra current row is ambiguous, not a new failure or added row. Use
  one baseline per suite and variant, and compare the merged run for shards. A
  wrong baseline produces spurious counts, not a crash.
- The report and summary embed baseline feature/scenario names and URIs, escaped
  like current-run text, but never the baseline path. The file has no baseline
  title or timestamp; the two artifacts are linked by the command. `renderHtml`
  and `CucumberHtmlStream` keep their current-run options.
- Keep the baseline path separate from the current `--json` redirect:
  `--json > baseline.json` truncates the file before Tolkira starts when the
  same path is also passed to `--baseline`. The CLI cannot detect that shell
  truncation. Write the current summary to a new path, then copy or cache it for
  the next run.

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
  logo, `--out`, `--ci-out`, `--history`, `--pdf` or `--manifest`, and no path
  inside an input directory (including through a junction or symlink); an empty
  path exits 2 and writes nothing. The write order is report, PDF, email,
  history, `--ci-out`, manifest, stdout. A write failure exits 1, names the
  email path, keeps the report and skips the history, `--ci-out`, manifest and
  stdout.
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
npm i -D playwright-core@^1.65.0
npx playwright-core install chromium-headless-shell
tolkira test-results/ --out report.html --pdf report.pdf
tolkira test-results/ --pdf report.pdf --json > summary.json
tolkira test-results/ --pdf report.pdf --locale de
tolkira test-results/ --pdf report.pdf --pdf-timeout 600000
```

On Windows PowerShell 5.1, `>` writes UTF-16; use PowerShell 7 or `cmd /c`
redirection before parsing the JSON.

- Run the install in the project where Tolkira runs; a project-local Tolkira
  install is recommended. The engine resolves beside Tolkira, then from the
  current project directory. Only `playwright-core` and the Chromium headless
  shell are needed; the `playwright` package and full Chromium are not.
- The PDF is A4 portrait (`format: 'A4'`) with 12 mm `@page` print CSS margins,
  the light print palette and no browser header, footer, URL or page number.
  Chromium only in this slice; Letter/custom paper and landscape are not exposed.
- It is the complete archive (all views and details, screenshots, fitted tables)
  from a fresh page: the CLI search/filter does not apply. The email is the
  concise summary; video/audio do not print. HTTP(S) images in caller HTML are
  aborted; inline `data:` images render.
- `--pdf-timeout <ms>` needs `--pdf`, is a positive integer up to 2,147,483,647
  and overrides the five-minute render deadline
  (`renderPdf(html, { timeoutMs })`). `page.pdf` has no timeout option and there
  is no 30 s browser print default; Tolkira bounds the font/image wait and the
  print explicitly.
- `--locale` is accepted with `--pdf` even without `--out` or `--email`; the PDF
  follows the report locale while CLI/JSON/CI stay English. `--accent` applies.
- Without `--out`, no report HTML is written. `--logo` and `--history` still
  require `--out` and exit 2.
- Write order: **report → PDF → email → history → `--ci-out` → manifest →
  stdout**. A PDF render or write failure exits 1, names the PDF path, keeps the
  report and skips the email/history/`--ci-out`/manifest/stdout; no partial PDF
  remains. A missing engine exits 1 with the install command.
- `PDF written to <path>` is printed only when stdout is free, like the report and
  email lines. JSON/CI stdout stays byte-identical; `--json --ci-out` also
  suppresses the PDF line.
- The PDF path is validated like an output: no collision with an input, the logo,
  `--out`, `--ci-out`, `--history`, `--email` or `--manifest`, and no path inside
  an input directory; a collision exits 2.
- The email with `--out` names the report; without `--out` it names the PDF
  because the PDF is written first.
- The engine is optional and dynamically imported; the default install and
  runtime dependency surface, report, JSON, email and CI bytes are unchanged;
  the package gains `docs/PDF.md`. See [`PDF.md`](PDF.md).

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
import { readFile } from 'node:fs/promises';
import {
  generateReport,
  readHistory,
  renderEmail,
  renderPdf,
  renderReport,
  summarizeReport,
  type BaselineRenderOptions,
  type BaselineSummary,
} from 'tolkira';

const inputs = ['test-results/'];
const previous: BaselineSummary = JSON.parse(
  await readFile('baseline.json', 'utf8'),
);
const summary = await summarizeReport(inputs);
const compared = await summarizeReport(inputs, { baseline: previous });
const previousRuns = await readHistory('.history/history.json', 365);
const {
  html,
  summary: sameSummary,
  skippedAttachments,
  inputFiles,
  inputBytes,
  history,
} = await generateReport(inputs, {
  title: 'Nightly',
  locale: 'de',
  metadata: {
    'CI run': 'https://github.com/acme/tolkira/actions/runs/42',
    Commit:
      'https://github.com/acme/tolkira/commit/abcdef1234567890abcdef1234567890abcdef12',
  },
  logo: 'data:image/png;base64,...',
  accent: '#1b5e20',
  history: previousRuns,
  historyLimit: 365,
  baseline: previous,
});
const renderOptions: BaselineRenderOptions = {
  title: 'Nightly',
  locale: 'de',
  baseline: previous,
};
const htmlOnly = await renderReport(inputs, renderOptions);
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
writes no file, starts no server, aborts HTTP(S) subresources and uses the same
optional Chromium engine as the CLI; a missing engine throws an install error.
The CLI and API produce equivalent PDFs for the same HTML and engine.

`skippedAttachments` is the number of Playwright path attachments skipped
on the final attempt because they resolve outside every allowed root, are
missing, unreadable, not a regular file or non-local (a URL, UNC or device
path). It is a plain number, additive to the returned object; the run-level
HTML count notice, up to three sanitized attachment name/reason entries per
affected scenario and the CLI stderr warning use it, while the summary document
keeps schema version 2 and no warning field. An earlier-attempt probe never
changes this number.

Earlier attempts are report-only. The HTML adds a collapsed `Earlier attempts`
block for a retried scenario with up to three executed earlier starts (status,
duration, first failure message and, for a single-input Playwright report, at
most one marked image under a 10 MB budget). `ReportSummary` (schema 2),
`--json`, CI text, the email summary, the history sidecar (schema 1 or 2) and
`ReportScenario` attachment counts/bytes stay final-attempt-only; legacy JSON
has no earlier data.

`inputFiles` and `inputBytes` are additive numbers on `GeneratedReport`: the
unique report files that formed loader groups (including validation-only files
that produced no envelopes) and their total size on disk. Inline media inside a
report file counts toward that file's bytes; Playwright path attachments are
external and are not added, so the attachment row covers their decoded payloads.
Duplicate-content files are not counted, and a `skip` decision or an empty
`.jsonl`/`.ndjson` shard skipped by a directory scan creates no group, so
`inputBytes` describes the files behind the report rather than every path on the
command line. A single resolved file above 100 MB fails the per-file guard
before it is read; the 100 MB total cap applies to the unique loaded content
after dedupe and skip and reports
`Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.`
The Details Run
panel shows the input row only when both values are present; direct `renderHtml`
callers and `CucumberHtmlStream` omit them, so their panel omits that row. The
same panel shows the exact final report HTML bytes and the three largest
attachments by decoded bytes. At 1 MiB and above the report row adds one-decimal
MB in parentheses after the exact bytes. These are contributors, not a sum.
`RenderReportOptions` is unchanged; `renderReport` computes the values
internally.

`history` is the aggregate run list the HTML was rendered with; it already
contains the current run. `generateReport` appends the current run to
`options.history` and returns the appended list; `historyLimit` bounds that list
(default 30, range 1 to 365) and is validated before the input is loaded.
`readHistory`, `appendHistory` and `writeHistory` accept the same optional limit
and default an omitted one to 30. `renderReport` and `CucumberHtmlStream` render
`options.history` exactly as given, never prune it and record nothing. Both
fields are additive.

`baseline` is the validated `BaselineSummary` projection, never a path; the CLI
is the only file reader. `generateReport`, `renderReport` and `summarizeReport`
accept it and build the comparison once. The exported `BaselineRenderOptions`
extends `RenderReportOptions` with that field. `renderHtml` and
`CucumberHtmlStream` do not take a baseline in 0.6.0: they keep
`RenderOptions`/`RenderReportOptions`, an unknown `baseline` key is ignored, and
the stream keeps its same-input-same-HTML contract. Read a baseline with your own
file handling and validate it before passing the projection; the exported type
carries `schemaVersion`, the overall status and the scenario
identity/status/execution fields. The report and summary embed baseline
feature/scenario names and URIs, never the baseline path.

The package is ESM, Node.js 22 or newer, and has no network or telemetry code.

| Option | CLI | API |
| ------ | --- | --- |
| title | `--title` sets the report heading, Markdown CI heading and email heading/suggested subject | `title` |
| metadata | `--meta key=value` (repeatable); absolute http(s) values become links in the HTML report | `metadata` object |
| logo | `--logo <file>` reads a local image | `logo` base64 image data URI |
| accent | `--accent #rrggbb` | `accent` hex string; invalid values are ignored |
| history | `--history <file>` reads and appends a sidecar; needs `--out`. `--history-limit <n>` sets the window (default 30, range 1 to 365) and needs `--history` | `history` array and `historyLimit`; `generateReport` appends the current run and bounds the list, `renderReport` and the stream render it as given |
| baseline | `--baseline <file>` reads a read-only schema-2 summary and compares; needs `--out`, `--pdf`, `--json` or `--ci markdown` | `baseline: BaselineSummary` on `BaselineRenderOptions` for `generateReport`, `renderReport` and `summarizeReport`; not on `renderHtml` or the stream |
| static | `--static` renders the script-free all-expanded form; needs `--out` or `--pdf` | `static: true` |
| locale | `--locale <tag>` (`en` or `de`; needs `--out`, `--pdf` or `--email`) | `locale` string; default `en` |
| email | `--email <file>` writes an HTML summary | `renderEmail(summary, options)` |
| pdf | `--pdf <file>` prints the report with optional Playwright Chromium; `--pdf-timeout <ms>` (needs `--pdf`) overrides the deadline | `renderPdf(html, { timeoutMs })` |
| capabilities | `--capabilities` prints the schema-1 machine document and exits; it takes no input and no other option | not applicable |
| manifest | `--manifest <file>` writes a schema-1 run manifest; alone it satisfies the at-least-one-output rule | not applicable; the CLI owns the run |
| size warning | `--max-size <mb>` (default 10) warns after rendering with the report HTML, report-file and decoded attachment sizes in MB; an advisory early input warning appears before parsing when the resolved inputs total at least 50 MiB | not applicable; the API returns HTML |
| CI output | `--ci github\|azure\|markdown`, `--ci-out <file>` | not applicable; format the summary yourself |

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
metadata, logo, accent, locale, the optional history list and `static`) and
produces the same HTML for the same envelopes and options. A supplied `history`
is rendered exactly as given; only `generateReport` appends the current run. The
stream is not an incremental renderer, writes no files and emits no summary; use
`summarizeReport` or `generateReport` when you also need the stable JSON. The
whole run is held in memory, exactly like the file API.

## Run history

`--history <file>` keeps an aggregate sidecar of prior runs and renders a
`Trends` tab once the report is generated with two or more entries. It requires
`--out`; without the flag no history is read or written and the report contains
no history data or Trends tab. `--history-limit <n>` sets the window: a decimal
integer from 1 to 365, default 30, accepted only with `--history`. The same
number bounds the runs read, appended, written and rendered in Trends.

```shell
tolkira test-results/ --out report.html --history .history/history.json
tolkira test-results/ --out report.html --history .history/history.json \
  --history-limit 365
```

The sidecar is UTF-8 JSON with schema version 1 or 2:

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
      "attachments": { "total": 2, "bytes": 4096 },
      "flaky": 2
    }
  ]
}
```

Contract:

- `schemaVersion` is `1` or `2`. Both are accepted on read; the two versions
  store the same run fields, and version 2 only marks a file that may hold more
  than 30 runs. A wrong version is rejected; unknown fields inside a supported
  version are ignored and the reader copies only the documented fields.
  `HISTORY_SCHEMA_VERSION` is the default write version (`1`);
  `HISTORY_SCHEMA_VERSION_MAX` is the highest accepted version (`2`).
- The writer writes version 1 for a default run on a version-1 file and version
  2 when the limit is above 30 or the read file already used version 2. A
  version-2 file is never downgraded, so a later default run keeps it at 2.
  `writeHistory` reads the target once through the same bounded, regular-file
  and 1 MiB checks as `readHistory` at every limit, both to preserve that schema
  and to reject a malformed, oversized or unreadable target instead of
  overwriting it with version 1. It validates an existing target with the
  reader's full document and run rules: a supported schema with a malformed
  `runs` value or entry is rejected with the existing
  `Cannot write history file <file>: ...` prefix and the target stays
  byte-identical, while a missing target is written and a valid target is
  appended with its schema kept. A 0.5 reader rejects version 2 with
  `unsupported schema version "2"`, exits 1 and leaves the file untouched; a
  default run on a version-1 file keeps that rollback path open, while a run
  above 30 or on a version-2 file does not. The 0.5.0 and 0.5.1 packages share
  the reader.
- `readHistory` and the schema peek behind `writeHistory` strip exactly one
  leading UTF-8 BOM (U+FEFF) from the bounded sidecar text before `JSON.parse`,
  and a read never rewrites the file. A BOM-only file and a BOM followed by
  invalid JSON keep the existing `not valid JSON` error; two leading BOMs leave
  one and still fail that way. The writer emits no BOM, so its next successful
  write replaces a BOM-prefixed file with BOM-free bytes and keeps every run the
  append would keep.
- `id` is the SHA-256 of the aggregates and the resolved title, excluding
  `recordedAt`. When the last entry has the same id, the new run is not
  appended and the old `recordedAt` stays.
- `recordedAt` accepts an ISO 8601-shaped timestamp with a zone (`Z` or
  `±HH:MM`), optional seconds and optional fraction digits
  (`YYYY-MM-DDTHH:mm[:ss[.fraction]]`), and a finite `Date.parse`. Calendar-day
  validity follows `Date.parse`, not a calendar check: a nonexistent day such
  as `2026-02-30` is accepted; `Date.parse` rolls it forward, while the stored
  string is never normalised. The pattern allows an offset up to `+23:59` and
  rejects `+25:00` or an offset without a colon. The tests pin 1, 3 and 9
  fraction digits. The original string is kept on read and on write; a
  `+02:00` value is not rewritten to `Z`. A zone-less value such as
  `2026-11-19T08:00:00` and free text such as `yesterday` fail with the existing
  `runs[i].recordedAt must be an ISO timestamp` error. The CLI's newly recorded
  run keeps the `YYYY-MM-DDTHH:mm:ss.sssZ` writer form.
- `flaky` is optional and new entries always carry it: the number of executed,
  non-skipped scenarios tagged `@flaky` (any final status) or whose final status
  is passed after at least one retry (`attempt > 0`). It is a flagged share
  input, not a flake probability. Old entries without the key stay absent on
  read and on append and show `—` for both flaky cells; a present value must be
  a whole number from 0 to the attempted scenarios (`scenarios.total -
  scenarios.skipped`), and a negative, fractional or above-attempted value
  rejects the file. The key is part of the aggregate id, so the first
  same-count run after an upgrade is appended once; later identical runs
  dedupe. The key itself does not change the schema version: a file stays
  version 1 until a write above 30 or on an already version-2 file. Older
  readers ignore the key but drop it if they rewrite the sidecar, so write a
  shared file with 0.5 only while it is version 1.
- The retention rule is: read n, append the current run unless it dedupes, then
  keep the newest n. A lower limit is destructive on the next successful write:
  a 31-entry file read with `--history-limit 10` returns 10, and the next write
  stores 10, so the 21 older runs are gone. Raising the limit later cannot
  restore them. A 31-entry file read with 40 keeps 31 and stores 32 after the
  append; a 40-entry file with 40 stores the newest 40 of 41. Reading with a
  smaller limit does not rewrite the file by itself.
- The sidecar is capped at 1 MiB (1,048,576 bytes). A file above the cap is
  rejected before it is read. The writer validates every stored run with the
  reader's field rules, caps a title at 200 code points and rejects an id longer
  than `HISTORY_MAX_ID` (128 UTF-16 code units; the reader still accepts longer
  ids from older files), then prunes the oldest entries until the serialized
  file is at or below the cap and always keeps the newest entry. A serialized
  result still above the cap is rejected instead of written, so the writer never
  writes a file the reader would reject. The cap is a safety bound, not the
  retention policy: a realistic 365-run file with a 200-code-point title
  measured 367,596 bytes and was not pruned on 2026-11-23. A maximal valid window
  (128-code-unit ids, 200-code-point titles, large whole counters) can exceed
  the cap and is pruned through the public API; the single-entry guard is not
  reachable through it.
- Invalid values: `0`, `366`, `1.5`, `abc`, `05` and an empty value exit 2
  with `Invalid --history-limit "<value>". Use an integer from 1 to 365.`;
  `--history-limit` without `--history` exits 2 with `--history-limit requires
  --history` before the generic usage text. Nothing is written on a rejected
  run. `--history` without `--out` keeps its existing exit-2 error.
- `title` is the resolved report title (`Tolkira report` when `--title` is
  absent), capped at 200 code points including a trailing `…`; a longer title is
  truncated before it is hashed or written. `durationMs` is the summary
  duration, not wall-clock time.
- Only aggregates are stored: no scenario names, step text, paths, tags or
  attachment content. The report embeds the prior-run aggregates it was
  generated with, so anyone who receives the HTML can read the pass-rate and
  flaky-share history. Use one sidecar per suite and variant; mixing runs makes
  the trend meaningless.
- A missing file starts empty. Invalid JSON, a wrong schema version, an
  oversized file, a malformed entry or a write failure exits 1 and names the
  file. A bad file is never overwritten. The HTML is written first; a failed
  history write leaves it in place, leaves no partial sidecar and skips the
  manifest.
- `--history` follows the output-path rules: it must not name an input, the
  logo, `--out`, `--pdf`, `--ci-out`, `--email`, `--manifest` or a path inside an
  input directory, even when the history file does not exist yet. `--baseline`
  is part of that list.
- The CLI is the only automatic writer: it resolves inputs once and drives the
  internal `generateReportFromResolved` (report) and
  `summarizeRunFromResolved` (summary plus the skipped-attachment count) entry
  points. The public API stays
  path-based: `generateReport` resolves the paths and appends the current run
  itself. API callers write
  through `writeHistory`; `renderReport` and `CucumberHtmlStream` render a given
  list and record nothing. The writer reads, appends and writes atomically with a
  rename; that prevents a corrupt file, not lost updates from two concurrent
  processes. Run one generation per sidecar at a time.
- The window applies to the CLI and `generateReport` path: the CLI passes one
  limit to `readHistory`, `generateReport` and `writeHistory`, and
  `generateReport` passes it to `appendHistory`. `renderReport` and
  `CucumberHtmlStream` accept the list they are given and never prune it.
- The writer prunes only to the 1 MiB cap. A realistic 365-run sidecar stays
  below it (297,151 bytes with a short title, 367,596 bytes with a
  200-code-point title, measured 2026-11-23 with `scripts/history-window.mjs`), so
  the window usually decides retention. A maximal valid window can hit the cap;
  the writer then drops the oldest runs and keeps the newest.

The package exports `HistoryRun`, `HISTORY_SCHEMA_VERSION`,
`HISTORY_SCHEMA_VERSION_MAX`, `HISTORY_LIMIT`, `HISTORY_LIMIT_MAX`,
`HISTORY_MAX_BYTES`, `HISTORY_MAX_ID`, `HISTORY_MAX_TITLE`, `buildHistoryRun`,
`appendHistory`, `readHistory` and `writeHistory` for programmatic use.

## Static report

`--static` (API `static: true`) renders one script-free, all-expanded form of
the report. It needs `--out` or `--pdf`; a `--static` run with only `--json`,
`--ci`, `--email` or `--manifest` exits 2 and writes nothing. Without a Trends section the
default report gains no static or Trends markup and remains the opt-in-free
form; a default report with two or more history runs gains the Trends shell CSS.
Every 0.6.0 default report also carries the 170 B measured scroll-offset script.

The static document contains no `<script>`, no client-message JSON block and no
print script. Its CSP is `script-src 'none'` with `connect-src 'none'` and no
allowed source; `default-src 'none'`, `img-src data: blob:`, `media-src data:
blob:`, inline styles and `font-src data:` stay as in the default report. Every
`<details>` carries `open` (features, scenarios, hook groups, earlier attempts,
text attachments, the triage rest list). Report, Details and Trends are stacked
visible sections; Trends appears only with two or more history runs.

The tab bar, tab roles, lightbox dialog and image lightbox buttons, the
copy-failure and log-copy buttons and the search/status/tag toolbar are removed,
not left inert. Images render inline in the open detail body. The `report-view`,
`analysis-view` and `trends-view` IDs stay, so the print page-break rule still
puts each present view on a new page. Both report forms render exactly one
`<main>` that wraps Report, Details and (when present) Trends; it starts before
`#report-view` and closes after the last present panel. The site header is the
only banner and each view's run header sits inside main. The panels keep the
`tabPanel` class, `role="tabpanel"`, `aria-labelledby`, `tabindex` and `hidden`
in the default form and the class and IDs without tab roles or tab attributes in
the static form.

Print/PDF follow the existing print CSS: every present section and open detail
prints, with no tab bar. A bookmarked `?query=`, `?hide=` or `?tag=` URL shows
the full static report because no script restores the filter. The mode does not
repair CSS or `data:` images blocked by a host CSP and does not restore scripts;
for Jenkins, see [`CI.md`](CI.md#jenkins-html-publisher). `--static --baseline`
keeps the comparison panel server-rendered and visible without JavaScript.

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

With `--baseline`, the summary adds a `baseline` block between `attachments` and
`scenarios` and a `change` field to classified scenario rows. This example is
abridged; the schema version stays 2:

```json
{
  "schemaVersion": 2,
  "baseline": {
    "status": "failed",
    "counts": {
      "newFailures": 2,
      "fixed": 1,
      "stillFailing": 3,
      "other": 1,
      "notInThisRun": 1,
      "added": 4,
      "ambiguous": 0
    },
    "notInThisRun": [
      {
        "feature": "Checkout",
        "name": "pays by card",
        "uri": "features/checkout.feature",
        "status": "failed",
        "executed": true,
        "example": "#1.2"
      }
    ]
  },
  "scenarios": [
    {
      "name": "refunds",
      "uri": "features/checkout.feature",
      "feature": "Checkout",
      "status": "failed",
      "executed": true,
      "change": "new-failure",
      "durationMs": 4,
      "attempt": 0,
      "tags": [],
      "attachments": 0,
      "steps": []
    }
  ]
}
```

Without `--baseline` there is no `baseline` or `change` key; the Markdown CI
text stays byte-identical, the HTML changes only by the 170 B measured
scroll-offset script, and the only unconditional summary delta is the outline
`example` field described below.

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
- With a baseline, `scenarios[].change` is `new-failure`, `fixed`,
  `still-failing` or `added`, placed after `executed`. Unchanged, no-claim,
  unexecuted and ambiguous rows have no `change`. No scenario row carries an
  `id` or `pickleId`.
- `baseline.status` is the earlier run's overall status. `baseline.counts` has
  all seven keys: `newFailures`, `fixed`, `stillFailing`, `other`,
  `notInThisRun`, `added` and `ambiguous`. Every baseline row outside an
  ambiguous group falls into exactly one of new failure, fixed, still failing,
  `other` or not in this run; `added` counts current rows and `ambiguous` counts
  base-key groups. An unmatched current failing row also counts as a new
  failure, so `newFailures` can exceed the matched baseline rows.
- `baseline.notInThisRun` is capped at 50 entries while `counts.notInThisRun`
  stays complete. It is sorted by feature, then name, then the example
  coordinate (numeric; rows without `example` last), then URI; every text
  comparison uses the same fixed UTF-16 code-unit order, not the host locale.
  Each entry has `feature`, `name`, `uri`, `status`, `executed` and optional
  `example`. Baseline URIs pass the same display-URI rule as current rows and
  are never links or file paths.
- `durationMs` is a number of milliseconds and sums the final attempt per
  scenario plus test-run hooks. It is not wall-clock time.
  `steps[].durationMs` is rounded to three decimals.
- `scenarios` is sorted by `uri`, then `name`, in fixed UTF-16 code-unit order,
  so output is stable across runs and independent of the host locale or ICU
  collation. The visible order for non-ASCII names can differ from earlier
  releases.
- `scenarios[].name` is the Cucumber pickle name. Examples of one scenario
  outline can share the same name. A Messages outline row carries `example` as
  `#<examples>.<example>` with 1-based numbers, matching the HTML label and
  placed after `attempt`. A plain, legacy JSON or JUnit row has no `example`
  key. The HTML report also shows the examples block name on the examples
  heading and in triage and copy-failure text; the summary does not expose that
  name.
- `scenarios[].tags` is the inherited pickle tag set, including feature, rule,
  scenario and examples tags. The HTML report uses the same set for its tag
  filter and search. Feature and rule tags render once at their section;
  scenario tags render on the scenario row or, for an outline, on the outline
  heading, and examples tags on the examples heading. Example rows repeat
  neither scenario nor examples tags. The summary does not expose rules,
  backgrounds or the own/inherited distinction. A scenario whose pickle tag set
  (own or inherited) includes `@flaky` (lowercase, exact match) gets a
  report-only (HTML/PDF) badge, and when at least one exists the run metadata
  gets a separate count such as `1 tagged @flaky`, distinct from the status
  counts. Feature, rule and outline-level `@flaky` tags badge every affected row,
  including every outline example, so the count can exceed the number of visible
  tag labels; a failed or unexecuted tagged scenario also counts. The count is
  not a computed flake rate or detection, and neither badge nor count appears in
  the summary, CI or email or changes a status. The history sidecar's optional
  `flaky` count is a separate per-run field; see Run history.
- `attempt` is the latest started Cucumber attempt for that scenario, even when
  that attempt reported no result. An earlier retried attempt is ignored. Two
  starts with the same attempt number and timestamp resolve to the later
  envelope in input order, which supplies the status, timestamps, attachments
  and summary row. For a Playwright JSON input `attempt` is the Playwright retry
  index of the final result; earlier attempts are not exposed as scenario rows.
  A Messages `testCaseStarted.attempt` is optional; when present it must be a
  non-negative safe integer, otherwise the input fails with the existing line
  error naming the file, line and `testCaseStarted.attempt`. An absent attempt
  is 0 in the model and the summary, and `--json` never contains `null` for it.
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
  the image or file. The count is the rendered set: attachments with no
  `testStepId`, plus attachments on a pickle or hook step that has a result. An
  attachment on a resultless step, on a test step absent from the case or on a
  run-hook start missing from the stream is not counted. `attachments.total` is
  the union of the rendered scenario sets, attachments on present run-hook
  starts and run-level attachments, so it matches `model.counts.attachments`
  and the Details count. Unnamed attachments use a deterministic
  `attachment.<ext>` fallback in HTML; unknown media types normalise to
  `application/octet-stream` and `attachment.bin`.
- CI metadata from Messages `meta.ci` renders in the HTML report (and the
  print/PDF derived from it). It appears in the report header and Details, but
  no CI field appears in the summary and `schemaVersion` stays 2. When
  `ci.name` is missing, the http(s) `ci.url` is the link text. In a mixed input
  the first non-empty CI block wins, and meta synthesized by the legacy adapter
  cannot erase it. Legacy JSON and JUnit never invent CI metadata; use the
  `metadata` option for a legacy path.
- Custom metadata values follow the same safe-URL rule: an absolute `http` or
  `https` value renders as a link in the Report header and Details, with the
  normalized URL as `href` and the value trimmed and stripped of the report's
  bidi-control set (U+202A–202E, U+2066–2069) as the label. Other schemes,
  scheme-less hosts, malformed URLs, plain text and values with an internal tab,
  line feed or carriage return stay escaped text. Pass the full URL (for example
  under `CI run` or `Commit`), not a raw SHA. The summary keeps no metadata
  field; this link appears only in the HTML report (and the print/PDF derived
  from it), while the JSON summary, CI text and email stay unchanged.

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

The summary does not expose absolute input paths. For Messages input, an
absolute `uri` is reduced by `displayUri`: it removes a `file:` scheme, an empty
or `localhost` authority (authority userinfo is stripped), a remote authority
(whose host becomes the first path segment), an optional drive token and a
`/mnt/<drive>` mount. `%2F` and `%5C` count as separators for this analysis,
including a leading one. Each remaining segment is decoded once for the home
comparison only, so `%68ome`, `%55sers` and `Documents%20and%20Settings` are
home segments; `.` and `..` (also `%2e` and `%2e%2e`) are resolved for the
analysis only. A `Users`, `home` or `Documents and Settings` segment and the
segment after it are then dropped **wherever they occur** in the absolute path,
repeatedly, including a trailing home segment. Display text keeps its original
encoding apart from `%2F`/`%5C`, which are treated as separators. The display
URI joins the remaining segments with `/` and never shows a drive prefix; when
no segment remains it is empty instead of the raw path. For example,
`file:///C:/Users/<user>/proj/login.feature`,
`file:/home/<user>/proj/login.feature` and
`file://localhost/home/<user>/proj/login.feature` display as
`proj/login.feature`; `file://server/share/home/<user>/proj/login.feature` and
`//server/share/Users/<user>/proj/login.feature` as `share/proj/login.feature`;
`/srv/home/<user>/proj/login.feature` as `srv/proj/login.feature`; and a path
that is only a home directory (`/home/<user>`, `/mnt/c/Users/<user>`) shows an
empty display URI. For these plain and single-encoded forms, a local user name
does not appear in the HTML display URI, the summary `uri` or copied failure
text. The home comparison decodes once: a double-encoded segment such as
`%2568ome` is not treated as home, and an encoded authority, an adjacent
`home/home` pair, a parent segment that cancels the home root or a
Windows-canonicalised home name can keep a name-like segment, so those forms
are outside the no-user-name guarantee (B-067). Relative URIs are unchanged and
keep the existing `/features/` marker and last-three fallback; a relative path
that starts with a home segment is outside this rule.

The legacy adapter normalises a URI before the summary sees it. For an absolute
path or file URL it applies the same analysis and `/features/` marker, but an
absolute path without a `features` segment becomes its last segment
(`file:///home/<user>/proj/login.feature` becomes `login.feature`), and a
missing URI or a path with no remaining segment becomes
`features/legacy-N.feature` (N is the zero-based feature index). A relative URI
keeps the adapter's `./` removal and is otherwise unchanged. The examples above
therefore describe Messages input and `displayUri`; legacy output is the display
form of that normalised value. The report model keeps raw URIs for provenance
and uses the same display URI for an unnamed feature's heading; the summary
`feature` field stays `""` for a featureless scenario.

## Recommended agent workflow

1. Run the tests and keep the raw Cucumber JSON or Messages.
2. Run `tolkira <inputs> --out report.html --json`; add `--email email.html`
   when a status mail or chat message is part of the job, and
   `--manifest run.json` when a later step must discover the written files.
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
  unchanged. The static `--static` report removes the search, status and tag
  controls and the copy/lightbox actions entirely, opens every row and detail,
  and ignores those bookmarked parameters: a `?query=`/`?hide=`/`?tag=` URL
  still shows the full report because no script restores them.
- Inputs are capped at 100 MB in total; attachments at 50 MB each and 100 MB
  total.
- Before parsing, the CLI resolves the input files once, stats them without
  reading content and writes one early input warning on stderr when their total
  is at least 50 MiB (52,428,800 bytes), including on `--json` and `--ci`-only
  runs:

  `tolkira: warning: input files total 50.0 MB, at or above the 50 MB early-warning threshold; parsing and rendering may take a while.`

  The total is MiB arithmetic shown at one decimal and labelled MB. The warning
  is advisory, names no path and changes no exit code or output byte. The same
  resolved list goes to the scan and the loader. The early total counts each
  resolved path once; identical content under two paths counts twice. The
  report-size warning's `input` value counts content-deduped loader bytes, so
  the two numbers can differ. Both warnings can appear in one run.
- The HTML report includes a hash-based CSP and never executes attachments.
- History is an opt-in aggregate sidecar (`--history`) with a window of 1 to 365
  runs (`--history-limit`, default 30); there is no scenario-level history,
  dashboard or server. Lowering the window drops older runs on the next write
  and they cannot be restored. Retries beyond the latest attempt
  and a trace viewer are not supported. Playwright JSON has a native adapter;
  the final attempt is the rendered one; the `@flaky` badge and run-meta tagged
  count are report-only (HTML/PDF), while the history `flaky` count is a separate
  per-run field: the summary, CI and email keep the final status. JUnit XML is a
  basic input mode; see
  [`LIMITATIONS.md`](LIMITATIONS.md). Playwright producer metadata and
  annotation descriptions are HTML-only and do not change schema version 2.
- The baseline is explicit and file-only: there is no automatic writer,
  scenario-level history, run store or first/last-seen trend. A baseline summary
  larger than 10 MiB (10,485,760 bytes) cannot be a baseline. Use one baseline
  per suite and variant and compare the merged run for shards; a wrong baseline
  produces spurious counts, not a crash. Keep the baseline in a separate path
  from the current `--json` redirect and cache it as a CI artifact. The report
  becomes a two-run artifact (baseline + current). `renderHtml` and
  `CucumberHtmlStream` do not accept a baseline in 0.6.0.
- `--capabilities` is input-free and read-only. The manifest is opt-in, has no
  timestamp or input path, and its artifact paths are relative to the manifest
  file; an absolute path is recorded as given only when no relative path exists,
  such as across Windows drives, and a relative path that cannot be expressed is
  a usage error before any write. It is not a second summary and carries no
  scenario rows beyond the first 10 failures.
- The email summary is opt-in and file-only. It has no sending, recipients,
  scheduling, `.eml` draft, logo, error snippets or redaction mode; the report
  basename (or the no-report note) is the only path-like content.
- PDF export is opt-in, Chromium-only and file-only. It is A4 portrait only
  (no Letter/custom paper), with no page numbers, custom header/footer, tagged
  PDF, CLI filter, forced landscape, PDF-only logo or PDF-only Trends; it needs a
  separate project-local engine and browser install. The default Chromium launch
  is not OS-sandboxed; see [`PDF.md`](PDF.md).
- Playwright path attachments are embedded only when the resolved regular file
  is inside the input file's directory or the process working directory.
  Symlinked, missing, non-regular, unreadable, non-local and outside-tree paths
  are skipped and counted; inline base64 attachments are always preferred. The
  HTML names up to three sanitized attachment names and reasons per scenario and
  shows a run-level count notice; the CLI warning carries the count without
  names. The JSON summary, CI text, email and history carry no skip names. Only
  final-attempt paths are counted; earlier attempts, trace zips and
  HTML-report replays are not counted. One marked earlier image from a
  single-input Playwright report may be read for the earlier-attempt block.
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
