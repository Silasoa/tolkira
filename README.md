# Tolkira

**Cucumber reports that stay readable: legacy JSON, Messages, JUnit XML and Playwright JSON in one self-contained HTML file.**

Tolkira turns test results into a single HTML file you can open offline, attach
to a ticket, or keep as a CI artifact. Screenshots, logs and other attachments
are embedded where available; the report names any it had to skip. There is no
server, no CDN and no telemetry. An opt-in PDF export reuses the same print view
when the optional Playwright Chromium engine is installed.

Current release: **v0.5.1** - [npm](https://www.npmjs.com/package/tolkira) - [Changelog](https://github.com/Silasoa/tolkira/blob/main/docs/CHANGELOG.md)

> **How this is built:** Tolkira is human-directed and largely AI-generated.
> The maintainer sets the product direction and approves releases. Most code,
> tests and documentation are drafted with large language models, then checked
> by automated tests and AI-assisted review passes. The maintainer reviews the
> release gate and tests the report from time to time. AI output can be wrong;
> please check the report against your own results and open an issue if
> something looks off. [Read more](#how-this-project-is-built).

## Install

Tolkira requires Node.js 22 or newer.

```shell
# CLI for one-off use
npm install --global tolkira
tolkira --help
```

Or add it to a project and run it from there (recommended for CI):

```shell
npm install --save-dev tolkira
npx tolkira --help
```

`npx tolkira --help` also works without a local install.

On Windows, `npx` can fail when the current folder contains parentheses in its
path. Use the global install or a folder without parentheses if that happens.

## Quick start

```shell
# One file, one report
tolkira test-results/ --out report.html --title "Checkout acceptance"

# Add your own metadata and brand colour
tolkira test-results/ --out report.html \
  --title "Checkout acceptance" \
  --meta "App version=0.3.2" \
  --meta "Environment=Staging" \
  --accent "#1b5e20"

# Embed a logo (PNG, JPEG, GIF, WebP or SVG)
tolkira test-results/ --out report.html --logo path/to/logo.png

# Keep aggregate run history and show a Trends tab from the second run
tolkira test-results/ --out report.html --history .history/history.json

# German report UI; test data stays verbatim
tolkira test-results/ --out report.html --locale de

# Write a small HTML email body beside the report (no sending)
tolkira test-results/ --out report.html --email email.html

# Print an A4 PDF (needs the optional Playwright engine; see below)
tolkira test-results/ --out report.html --pdf report.pdf
```

`--meta` values that are absolute `http` or `https` URLs render as links in the
Report header and in Details; all other values, including URLs with an internal
tab, line feed or carriage return, stay plain text. The `href` is the normalized
URL; the label is the value trimmed and stripped of the report's bidi-control
set (U+202A–202E and U+2066–2069). Use the full URL, not a raw SHA, and suggested
keys are `CI run`, `Commit`, `Browser` and `Project` (for example
`--meta "CI run=https://github.com/acme/tolkira/actions/runs/42"` or
`--meta "Commit=https://github.com/acme/tolkira/commit/<sha>"`). The same rule
applies to the compatibility shim's `metadata` object.

Tolkira accepts one or more files and directories. A directory is scanned
recursively for supported result files. Everything is merged into one report.
The optional history file is a separate sidecar: without `--history` no history
is read or written and the report stays one file. Use one sidecar per suite and
variant; mixing runs makes the trend meaningless. The Trends tab needs
JavaScript: a copy opened without JavaScript shows the Report view and an inert
tab. Printing works in both cases; see
[Print or Save as PDF](#print-or-save-as-pdf).

## Print or Save as PDF

Use the browser's print dialog and choose **Save as PDF** as the destination.
With JavaScript, printing captures the whole text and screenshot archive: the
Report, Details and (when history is present) Trends views, with every closed
feature and scenario opened and lazy thumbnails requested eagerly. The current
search and filter state carries into print, so clear it first to archive the
whole run. The active tab is left untouched; previously closed details, the
lightbox and the scroll lock return in browsers that fire `afterprint`; the
print-only panel reveal is scoped to print media, so a missed `afterprint`
cannot stack panels on screen. The interactive chrome (tabs, toolbar, filters,
copy and expand buttons) is hidden, the page uses the light palette even when
the screen is dark, and the tables are sized to the printable width.

- **Failures-only Report:** press **Failed only**, then print. This is still an
  archival print, not the concise summary: the Report view keeps only the
  filtered rows and adds a visible count marker, while Details and Trends print
  in full. The concise email summary is available with `--email`.
- **Without JavaScript:** the active Report view prints with the chrome hidden;
  Details and Trends stay hidden and closed features stay closed. Without
  `beforeprint` support the same fallback applies.
- **Wide runs:** if an unusually wide matrix still clips at the right edge,
  choose **Landscape** in the print dialog.
- **Browser headers and footers:** the browser's own header/footer, page numbers
  and URL are not part of the report. Turn them off for a shared PDF, because
  the footer can reveal a local file path or URL; with them off, pages after the
  first carry no report title or page number, because a repeated print title is
  not implemented (see [Limitations](docs/LIMITATIONS.md)).
- **Video and audio** attachments cannot print, so the print is a text and
  screenshot archive, not a full attachment copy; screenshots, text attachments
  and the skipped-attachment notice do print.

Browser printing needs no network, no extra tool and no PDF engine. There is no
mail delivery and no print button: `--email` writes a separate HTML mail body,
and the browser's print command is the zero-install PDF route.

### PDF file with `--pdf`

For CI and headless workflows, `--pdf <file>` prints the same complete archive
without a print dialog. Install the optional engine in the project where Tolkira
runs; a project-local Tolkira install is recommended:

```shell
npm i -D playwright-core@^1.65.0
npx playwright-core install chromium-headless-shell
tolkira test-results/ --out report.html --pdf report.pdf
```

The PDF is the full rendered archive, not a one-page executive summary; use
`--email` for the concise summary. It is A4 portrait with 12 mm margins, no
browser header/footer or page numbers, and it follows the report locale. Letter
and custom paper are not exposed. It is Chromium-only, has no CLI filter state,
does not print video/audio, and `--logo`/`--history` still require `--out`.
`--pdf-timeout <ms>` overrides the five-minute render deadline. The optional
engine is a dynamic import resolved beside Tolkira or in the project: the default
install and runtime dependency surface, report, JSON and CI bytes are unchanged.
The write order is report → PDF → email → history → `--ci-out` → stdout, so a PDF
failure exits 1, keeps the report and skips later outputs. Common HTML reporters
ship no PDF export, and Allure exports CSV; Playwright/CI teams already print
through headless Chromium, which is the same engine route. See
[PDF export](docs/PDF.md) for the install, API, costs and limits.

## For agents and CI

Install as a project dependency and write the report, the optional email body
and the JSON summary:

```shell
npm install --save-dev tolkira
npx tolkira test-results/ --out report.html --email email.html --title "CI run" --json > summary.json
```

GitHub Actions step:

```yaml
- name: Generate Cucumber report
  if: always()
  run: npx tolkira test-results/ --out report.html --email email.html --history .history/history.json --title "CI run" --json > summary.json

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: cucumber-report
    include-hidden-files: true
    path: |
      report.html
      email.html
      summary.json
      .history/history.json
```

`email.html` is an optional, small HTML mail body; a later CI mail step can use
it as `html_body` and attach `report.html`. Tolkira never sends mail and exits 0
even when tests fail, so derive the subject from `summary.json` (`jq -r .status`),
not from the job status. See [Email summary](docs/EMAIL.md).

Add `--pdf report.pdf` to the same command for a print archive. It needs the
optional engine in the project (`npm i -D playwright-core@^1.65.0 &&
npx playwright-core install chromium-headless-shell`) and composes with
`--out`, `--email`, `--history`, `--json` and `--ci`; see
[PDF export](docs/PDF.md). The PDF is written after the report and before the
email, so a PDF failure keeps `report.html` and skips the later outputs.

Persist `.history/history.json` between CI runs (for example with
`actions/cache`) so the next run continues the trend. A missing sidecar starts a
new history; upload it beside the report if you want another job to continue it.

`--json` writes exactly one JSON document to stdout; warnings go to stderr.
Exit code 0 means the report was generated, not that the tests passed. Read
`status` and `counts` from the summary. Abridged real output (counts and steps
trimmed):

```json
{
  "schemaVersion": 2,
  "status": "failed",
  "counts": {
    "scenarios": { "total": 6, "passed": 5, "failed": 1 }
  },
  "scenarios": [
    {
      "name": "Fred wants to see passing scenarios in the HTML report",
      "uri": "features/happy.feature",
      "status": "failed",
      "executed": true,
      "steps": [
        {
          "keyword": "When",
          "text": "this feature runs with background",
          "status": "failed",
          "message": "Expected values to be strictly equal: -8 !== 0"
        }
      ]
    }
  ]
}
```

Paste this into an agent's instructions:

```text
Use Tolkira for Cucumber results. Run `npx tolkira <inputs> --out report.html --json`
and parse stdout as the JSON summary; do not scrape the HTML. Exit code 0 means
the report was generated, not that the tests passed. Read summary.status and
summary.counts, and check scenarios[].executed before treating a status as an
outcome. Upload report.html as the human-facing artifact.
```

See [`docs/AGENT-INTERFACE.md`](https://github.com/Silasoa/tolkira/blob/main/docs/AGENT-INTERFACE.md)
for the full schema and exit codes.

### CI annotations and step summaries

GitHub turns Tolkira's workflow commands into annotations without `--out`:

```shell
npx tolkira test-results/ --ci github
```

For a GitHub step summary, append Markdown so earlier steps survive:

```shell
npx tolkira test-results/ --ci markdown >> "$GITHUB_STEP_SUMMARY"
```

Azure Pipelines reads Azure logging commands from stdout:

```shell
npx tolkira test-results/ --ci azure
```

GitLab and other CI systems can keep the Markdown as a file:

```shell
npx tolkira test-results/ --out report.html --ci markdown --ci-out tolkira-summary.md
```

`--ci github` and `--ci azure` write to stdout only; `--ci-out` requires
`--ci markdown`, is written atomically and must not overwrite an input, the logo
or `--out`. Exit codes do not change: a failed test run still exits 0. See
[`docs/CI.md`](https://github.com/Silasoa/tolkira/blob/main/docs/CI.md) for the
GitHub, Azure DevOps, Jenkins, sharded and GitLab recipes, output caps and the
unredacted-message warning.

## What you get

- **One file that works offline.** CSS, JavaScript and attachments are inline.
  No network requests, no remote fonts, no analytics.
- **The failure first.** Failed scenarios are open by default, and a compact
  triage index lists non-passing features and scenarios before passed ones,
  with links that open the scenario detail.
- **Multi-file context.** A source strip shows per-input status, counts and a
  proportion bar when the run has more than one input file and provenance is
  unambiguous. It is hidden at 560 px or narrower, and the Report row hides its
  source at 900 px or narrower; the Details matrix keeps the source label.
- **Screenshots and attachments that survive.** Images, text, video, audio and
  files are preserved through the input adapters where available; skipped path
  attachments are named in the report with their reason (up to three per
  scenario), and the run-level count includes outside-root, missing, unreadable,
  non-regular and non-local paths. Only final-attempt paths are inspected for
  that notice. Retried scenarios also get a collapsed `Earlier attempts` block
  with the earlier status, duration and first failure message; a single-input
  Playwright report adds at most one earlier screenshot under a 10 MB budget,
  and multi-input reports keep the text evidence without an earlier image.
- **Search and filters.** Search scenarios, features, steps and tags; filter by
  status and tag; a `Failed only` preset hides other statuses and unexecuted
  rows; open matching features automatically and highlight matches.
- **Rendered descriptions.** Feature, rule, background, scenario and examples
  descriptions render a safe GFM subset - headings, emphasis, code, lists,
  tables, quotes and http(s)/mailto links - from Messages, legacy JSON, JUnit
  and Playwright JSON.
- **Tag expressions.** Search accepts the official Cucumber grammar
  (`@a and not @b`, parentheses, escaped tags). Mixed text and tags fall back to
  plain substring search.
- **Shareable filtered views.** Search, hidden statuses (including the failed-only
  preset's `hide=unexecuted`) and the tag filter live in `?query=`, repeated
  `?hide=` and `?tag=`, so a URL reproduces the same view.
- **Parameter highlighting.** Matched step arguments render with their Cucumber
  parameter type from Messages; ambiguous or unmatched steps stay plain.
- **Messages stream adapter.** `CucumberHtmlStream` is shape-compatible with the
  official formatter: it accepts envelopes, buffers until flush and emits the
  same offline HTML as `renderReport`, for embedding without a temp file.
- **Copy failure.** Copy a failed scenario's feature, failed step and error as
  plain text for a ticket or an agent.
- **A Details view when you need it.** Status distribution, a feature-by-status
  matrix, run metadata (absolute http(s) values become links), the Run
  environment (producer, runtime, OS, CPU, protocol) and size contributors: the
  unique report files and their total on-disk bytes, decoded attachment bytes,
  the exact report HTML bytes (at 1 MiB and above, paired with one-decimal MB in
  parentheses) and the three largest attachments by decoded bytes. The rows are
  contributors, not a sum.
- **Opt-in run trends.** `--history <file>` keeps the last 30 aggregate runs and
  adds a Trends tab from the second run: a newest-first table with pass rate,
  flaky count and flaky share, plus a pass-rate sparkline. The flaky share is a
  flagged share, not a flake probability; a positive share below 0.1% shows a
  less-than boundary, and runs recorded without the count show `—` for both
  flaky cells. A note explains that it counts executed non-skipped tagged or
  passed-after-retry scenarios, which can differ in either direction from the
  header's tag-only count. The sidecar holds counts, status, the resolved title,
  duration, attachment totals and the optional flaky count only, never scenario
  names or paths; a report embeds the runs it was generated with, so share it
  with that in mind.
- **A stable summary for agents.** `--json` and `summarizeReport()` return a
  versioned schema with counts, durations, scenarios, steps and failure
  messages.
- **Accessible by default.** Keyboard navigation, visible focus, text status
  labels as well as colour, dark mode and 200% zoom reflow. Accessibility is an
  ongoing effort; feedback is welcome.
- **Report language.** `--locale de` renders the report shell, labels and
  accessibility text in German; `de-AT` keeps the regional tag and uses the
  German catalog. Test data, Gherkin keywords, attachment content and names,
  metadata and URIs render unchanged in every locale; the JSON summary stays
  English. English is the default; one report is one locale and there is no
  in-report switcher. See
  [docs/I18N.md](https://github.com/Silasoa/tolkira/blob/main/docs/I18N.md).
- **Your branding.** Title, metadata, logo and accent colour without forking the
  shell.

## Supported inputs

| Input | What works |
| --- | --- |
| **Legacy Cucumber JSON** | cucumber-js 2.3.1–13.3.0, Behave 1.3.3, cucumber-jvm 7.22.1 and cucumber-ruby 12.0.1 are covered by producer fixtures. Behave's real run includes statuses, durations, a multiline doc string, a data table, an inline PNG, a multiline error message and an `error` status; see the [dated limitations table](https://github.com/Silasoa/tolkira/blob/main/docs/LIMITATIONS.md). Other producers often work; the adapter follows the Cucumber legacy dialect. |
| **Cucumber Messages (NDJSON)** | cucumber-js 11.2, cucumber-jvm 7.22.1 and cucumber-ruby 12.0.1 fixtures. This is the modern, implementation-independent format. |
| **JUnit XML** | Basic mode: suites, test cases, statuses, durations, failures, skipped cases and system output. JUnit has no Gherkin steps or screenshots; each test case is shown as one synthetic step. |
| **Playwright JSON** | Native adapter for the Playwright JSON reporter: projects, file/describe rules, retries (the final attempt is visible, earlier attempts in a collapsed evidence block), nested steps, expected/unexpected outcomes, tags, annotations, inline and in-tree path attachments, `stdout`/`stderr` and run-level errors. No trace viewer or HTML-report replay. |

Multiple files and mixed formats can be merged into one run. See
[`docs/CUCUMBER-COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/CUCUMBER-COMPATIBILITY.md) for the
tested producer matrix,
[`docs/JUNIT-XML.md`](https://github.com/Silasoa/tolkira/blob/main/docs/JUNIT-XML.md) for the JUnit limits and
[`docs/PLAYWRIGHT-JSON.md`](https://github.com/Silasoa/tolkira/blob/main/docs/PLAYWRIGHT-JSON.md) for the Playwright mapping.

## Why Tolkira exists

[`cucumber-html-reporter`](https://github.com/protractor-cucumber-framework/cucumber-html-reporter)
has been effectively unmaintained since October 2024. It still has a large
user base, but it loads Bootstrap, jQuery and Google Charts from CDNs, only
reads legacy JSON, and carries old runtime dependencies. Reports that should
work offline lose their layout and charts.

Tolkira keeps the old input working and fixes the parts that hurt:

- one offline file instead of CDN dependencies;
- legacy JSON, modern Messages and native Playwright JSON;
- JUnit XML as cheap breadth for non-Cucumber teams;
- screenshots and attachments embedded where available;
- a stable JSON summary for agents and CI;
- a small, reviewed dependency surface.

Single-file output alone is no longer unique: the official formatter and Allure
can produce one file. Tolkira's difference is the combination - both Cucumber
generations, JUnit as cheap breadth, an agent-readable summary, and no server,
CDN or telemetry.

### What parity means here

"Parity" in this project means content and navigation: the same statements,
steps, tags, statuses, durations and descriptions, plus search, tag expressions
and shareable filter URLs, whether the input is legacy JSON, Messages, JUnit or
Playwright JSON.
It does not mean theme parity with `cucumber-html-reporter`, a report folder, or
external attachments; Tolkira deliberately stays one offline file. The honest
claim is credible Messages report parity, not full formatter parity.

### How it compares

Last checked 2026-11-20 against the current package docs. Trade-offs are
deliberate; pick the tool that fits the job.

| Tool | Offline | Legacy JSON | Messages | JUnit | Playwright JSON | JSON summary | Themes | ESM/CJS | Node | Maintenance | Choose it if… |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [cucumber-html-reporter](https://github.com/gkushang/cucumber-html-reporter) | No, CDN assets | Yes | No | No | No | No | Three built-in themes | CJS | Old, no engine pin | Unmaintained since Oct 2024 | You need its exact themes and offline use is not a requirement. |
| [multiple-cucumber-html-reporter](https://github.com/WasiqB/multiple-cucumber-html-reporter) | Yes, report folder (CDN optional) | Yes | Yes | No | No | Saved JSON (`saveCollectedJSON`) | Dark mode, custom CSS | ESM (v4) | 22+ | Active | You want a dashboard, multi-run grouping, build-time UI languages (en/es/fr/pt/ar, no German) and a report folder. |
| [Official Cucumber HTML formatter](https://github.com/cucumber/html-formatter) | Yes, one file | No | Yes | No | No | No | Custom CSS/JS only | ESM | Modern Node | Official Cucumber project | You use Cucumber Messages only and want the official look. |
| **Tolkira** | **Yes, one file** | **Yes** | **Yes** | **Basic** | **Yes** | **Versioned summary (`--json`)** | **Branding, dark mode; no theme gallery** | **ESM; CJS compat shim** | **22+** | **Active** | **You need one offline file from legacy JSON, Messages, JUnit or Playwright JSON, plus a stable summary for CI and agents.** |

The visual comparison uses the report setup from
[Seed-Test](https://github.com/adessoSE/Seed-Test). If you are curious about
Seed-Test, you are welcome to take a look; the comparison notes and screenshots
are in [`docs/COMPARISON.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPARISON.md).

## Migrating from cucumber-html-reporter

Keep the JSON your test run already writes and point the CLI at it:

```shell
npx tolkira reports/cucumber.json --out reports/report.html --title "Checkout acceptance"
```

For a shell or CI step, that is the whole migration: the input stays the legacy
Cucumber JSON the old reporter consumed, and the output is one self-contained
HTML file with no CDN and no server. `npx tolkira --help` lists the other flags.

Node.js 22 or newer is required. Node 20 is end-of-life and unsupported;
upgrading to Node 22+ is the migration cost for the CLI and both code paths. The
core and CLI are ESM-only; the compatibility subpath also loads from CommonJS
through an async wrapper.

**What changes for your CI:** the report still comes from the same legacy JSON
input and is written to the `--out` path, now as one self-contained HTML file.
Exit codes describe report generation, not test status: 0 means the report or
summary was generated, even when tests failed; 1 means the input could not be
parsed or rendered, or the output could not be written; 2 means invalid usage.
Add `--json` to write one JSON summary document to stdout, with warnings on
stderr; read `status` and `counts` from it. The old themes, charts and CDN
assets do not carry over.

If a Node script calls the reporter instead of a shell step, use the
compatibility shim. Install Tolkira next to the old reporter and keep the
existing JSON output:

```shell
npm i -D tolkira
```

**Before — CommonJS with cucumber-html-reporter:**

```js
// report.js
const reporter = require('cucumber-html-reporter');

reporter.generate({
  theme: 'bootstrap',
  jsonFile: 'reports/cucumber.json',
  output: 'reports/report.html',
  brandTitle: 'Checkout acceptance',
  metadata: { Browser: 'Chrome', Environment: 'Staging' },
});
```

**After — ESM with Tolkira:**

```js
// report.mjs
import { generate } from 'tolkira/compat/cucumber-html-reporter';

await generate({
  jsonFile: 'reports/cucumber.json',
  output: 'reports/report.html',
  brandTitle: 'Checkout acceptance',
  metadata: { Browser: 'Chrome', Environment: 'Staging' },
});
```

**If the project must stay CommonJS**, require the compatibility subpath and
await the async wrapper:

```js
// report.cjs
const { generate } = require('tolkira/compat/cucumber-html-reporter');

async function main() {
  await generate({
    jsonFile: 'reports/cucumber.json',
    output: 'reports/report.html',
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

The wrapper is only for the compatibility subpath; the core package, CLI and
other exports remain ESM-only. There is no default export.

The options object is mostly compatible, but the call contract is not. Only
the import style changing is not the whole story:

| Behaviour | `cucumber-html-reporter` | Tolkira compat shim |
| --- | --- | --- |
| Input | `jsonFile` falls back to `output + '.json'` when omitted | `jsonFile` or `jsonDir` is required; there is no implicit fallback |
| Return value | Sync `true` on success without a callback, `undefined` with one; `undefined` for a bad report | Always a `Promise<CompatResult>` with `output`, `warnings` and `summary`; await every call |
| Errors | The callback receives a string; without a callback a failure can be silent | The promise rejects with an `Error`, and the callback receives the same `Error` |
| Callback | `callback()` on success, `callback(string)` on failure | `callback(error?)`; the promise still rejects |
| `jsonDir` | Recursively merges features by `uri`, dedupes them and writes an `output + '.json'` sidecar | Scans recursively; the `jsonDir`-only run writes the merged sidecar (merge by `uri`, previous sidecar excluded on the next run); the report inputs remain separate files |
| Output timing | The HTML is written synchronously before `generate` returns | The HTML is complete only when the promise resolves |
| Export | `require('cucumber-html-reporter').generate` | Named `generate`; no default export |

**Callback caveat:** callback-only code can ignore the returned promise.
Tolkira marks that ignored promise handled so it does not crash the process;
awaiting the same call still throws. Errors are `Error` objects, not the
legacy strings. If the callback itself throws, handle that error yourself.

`theme` is ignored with a warning. Themes, charts, external screenshots and
browser launch are not reproduced. The shim consumes the same input JSON,
never the old rendered HTML.
See [`docs/COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPATIBILITY.md)
for the full mapping and caveats.

### From multiple-cucumber-html-reporter

There is no MCHR shim; use the core CLI. The common mapping:

```shell
# MCHR config: jsonDir + reportPath + reportName
mchr

# Tolkira
npx tolkira path/to/jsonDir --out reports/index.html --title "My report"
```

Map `jsonDir` to the input directory, `reportPath`/`reportName` to `--out`,
`metadata` to repeated `--meta key=value`, `brandLogo` to `--logo`, and
`language`/`--language`/`--lang` to `--locale`. MCHR 4.6 chooses one UI language
at build time from en, es, fr, pt and ar (including RTL Arabic; German is not in
that set); Tolkira supports en and de per report. Neither has an in-report
switcher; Tolkira's one file carries one locale, while MCHR writes its report
folder. MCHR localizes its default report titles; Tolkira keeps `Tolkira report`
unless `--title` overrides it. An unknown MCHR language warns and falls back to
English on the API/config path, while its `--language`/`--lang` CLI throws.
Tolkira rejects it too: the CLI exits 2 and the API throws. MCHR's `--email` is a
boolean that writes `reportPath/email-report.html`; Tolkira's `--email` takes a
required file path, so a copied bare flag exits 2. MCHR shows per-feature cards
and the five slowest scenarios; Tolkira shows aggregate counts and the first five
failed scenarios in summary order, with no per-feature table, metadata or logo.
Both MCHR and Allure's mail plugin only generate a file and never send, so the
no-sending boundary is shared. MCHR's dashboard and folder report are not
reproduced. History is only the opt-in aggregate sidecar described above; there
is no scenario-level history or multi-run dashboard. See
[`docs/COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPATIBILITY.md#multiple-cucumber-html-reporter)
for the mapping.

## Privacy and limits

- No network requests, no telemetry, no remote fonts and no CDN.
- A restrictive Content Security Policy is embedded in every report.
- Test names, metadata and attachments are treated as untrusted input.
- Playwright path attachment skips are listed with a reason in the HTML
  (outside the allowed roots, missing, unreadable, not a regular file or
  non-local). Only sanitized attachment names are shown; the JSON summary, CI
  text, email and history carry no names or paths.
- Default limits: 100 MB total input, 50 MB per attachment and 100 MB total
  attachments. A warning appears when a report grows beyond 10 MB and names the
  report HTML, report-file and decoded attachment sizes.
- JUnit XML is intentionally basic; use the native Playwright JSON adapter for
  Playwright projects that can write the JSON reporter.
- History is opt-in and aggregate-only. `--history <file>` stores counts, status,
  the resolved title (capped at 200 characters), duration, attachment totals and
  the optional flaky count for the last 30 runs; runs recorded without the count
  show `—`. The report embeds those prior-run aggregates. The CLI is the only
  automatic writer, so use one sidecar per suite and variant and one generation
  at a time. No scenario names, steps, paths, tags or attachment content are
  stored.
- The opt-in email summary contains feature and scenario names, statuses, counts,
  durations, the title (which may carry a branch or build name) and the report
  basename. It is written only with `--email`; there is no redaction mode, no
  network request and no sending.
- PDF export is opt-in and Chromium-only. It needs the optional `playwright-core`
  peer and the Chromium headless shell (about 13 MB of package, 286 MB unpacked
  shell and 4 MB of helpers; roughly 303 MB unpacked, download smaller; the full
  Chromium build is not required) in the project where Tolkira runs. It prints A4
  portrait with no header/footer or page numbers and has no CLI filter state,
  Letter/custom paper, landscape or PDF-only logo/Trends. The default Chromium
  launch is not OS-sandboxed; the report CSP and escaped attachments are the
  boundary, so run untrusted attachments in a container or VM. The PDF is not
  byte-identical across engine or font updates.
- One report is one file. External attachments for very large media are a
  future option.

See [`docs/LIMITATIONS.md`](https://github.com/Silasoa/tolkira/blob/main/docs/LIMITATIONS.md)
for the dated limitations table (last verified 2026-11-20).

## Documentation

- [`docs/README.md`](https://github.com/Silasoa/tolkira/blob/main/docs/README.md) — map of all project documentation.
- [`llms.txt`](https://github.com/Silasoa/tolkira/blob/main/llms.txt) — short entry point for AI agents.
- [`docs/AGENT-INTERFACE.md`](https://github.com/Silasoa/tolkira/blob/main/docs/AGENT-INTERFACE.md) — JSON schema, CLI
  contract and exit codes.
- [`docs/CI.md`](https://github.com/Silasoa/tolkira/blob/main/docs/CI.md) — GitHub and Azure annotations, Jenkins
  HTML Publisher, sharded reports, GitLab and step-summary output.
- [`docs/EMAIL.md`](https://github.com/Silasoa/tolkira/blob/main/docs/EMAIL.md) — opt-in HTML email summary, CLI/API and
  CI mail-step example.
- [`docs/PDF.md`](https://github.com/Silasoa/tolkira/blob/main/docs/PDF.md) — opt-in PDF export, engine install, CLI/API,
  write order and limits.
- [`docs/LIMITATIONS.md`](https://github.com/Silasoa/tolkira/blob/main/docs/LIMITATIONS.md) — dated limitations table
  (last verified 2026-11-20).
- [`docs/CUCUMBER-COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/CUCUMBER-COMPATIBILITY.md) — tested
  Cucumber producers and versions.
- [`docs/JUNIT-XML.md`](https://github.com/Silasoa/tolkira/blob/main/docs/JUNIT-XML.md) — JUnit basic-mode mapping and
  limits.
- [`docs/PLAYWRIGHT-JSON.md`](https://github.com/Silasoa/tolkira/blob/main/docs/PLAYWRIGHT-JSON.md) — native Playwright
  JSON mapping and limits.
- [`docs/COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPATIBILITY.md) — migration from
  cucumber-html-reporter.
- [`docs/I18N.md`](https://github.com/Silasoa/tolkira/blob/main/docs/I18N.md) — report locales, catalog rules,
  formatting and the German glossary.
- [`docs/COMPARISON.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPARISON.md) — Seed-Test comparison and
  remaining parity gaps.

## Development

Tolkira requires Node.js 22 or newer.

```shell
npm install
npx playwright install chromium firefox webkit
npm run check
npm run test:e2e
npm run stress -- 1000
npm run bench:ansi
```

`npm run check` runs typecheck, lint, unit tests, build and the CSS generation
step. `npm run test:e2e` runs the browser tests in Chromium, Firefox and
WebKit. `npm run stress -- 1000` builds a 1,000-scenario report and reports size
and timing. `npm run bench:ansi` measures `stripAnsi` on fixed message corpora
and enforces the 500 ms production budget.

Build once and run the CLI from `dist`:

```shell
npm run build
node dist/cli.js test/fixtures/legacy/happy.json \
  --out report.html \
  --title "My report" \
  --meta Browser=Chrome
```

## Contributing and feedback

Bug reports, accessibility feedback and compatibility fixtures are welcome.
If a producer or report shape does not work, a small sanitized fixture is the
most useful thing you can attach. Please do not include secrets or private test
data.

If you want to work on the code, start with [`AGENTS.md`](https://github.com/Silasoa/tolkira/blob/main/AGENTS.md), the
[`openspec/`](https://github.com/Silasoa/tolkira/tree/main/openspec) change contracts and
[`docs/agents/review.md`](https://github.com/Silasoa/tolkira/blob/main/docs/agents/review.md). Product and architecture
notes live in [`docs/PRODUCT.md`](https://github.com/Silasoa/tolkira/blob/main/docs/PRODUCT.md) and
[`docs/ARCHITECTURE.md`](https://github.com/Silasoa/tolkira/blob/main/docs/ARCHITECTURE.md).

## How this project is built

Tolkira is an experiment in AI-assisted open source. The maintainer defines the
problem, the scope and the design direction; large language models draft most of
the code, tests and documentation; automated tests and AI-assisted review passes
check changes; the maintainer reviews the release gate, approves versions and
tests the report from time to time.

The project does not name specific models in its files on purpose. The
maintainer configures the models and tooling. This keeps the project
model-agnostic and avoids turning a temporary tool choice into a permanent
dependency.

AI-generated code can contain mistakes. The test suite and the review process
reduce that risk, but they do not remove it. If you rely on Tolkira in a
production pipeline, validate the report against your own results and pin the
version you use.

## License

MIT. See [`LICENSE`](https://github.com/Silasoa/tolkira/blob/main/LICENSE).

Tolkira is an independent project, not an official Cucumber, SmartBear or
Seed-Test product. The maintainer also contributes to Seed-Test; the visual
comparison uses Seed-Test's report setup. Cucumber and Gherkin are used
descriptively; the project uses the MIT-licensed Cucumber Messages format and
package.
