# Migration from cucumber-html-reporter

**Status: experimental.** The compatibility subpath accepts the legacy options
object and renders with Tolkira. It is a migration aid, not a promise of visual
parity. The shim is asynchronous: use Node 22 or later, then either
`import { generate }` or `require(...)`, and await `generate(...)` before
reading the report.

## Before and after

```shell
npm i -D tolkira
```

```js
// before
const reporter = require('cucumber-html-reporter');

reporter.generate({
  theme: 'bootstrap',
  jsonFile: 'reports/cucumber.json',
  output: 'reports/report.html',
  brandTitle: 'Checkout acceptance',
  metadata: { Browser: 'Chrome', Environment: 'Staging' },
});
```

```js
// after
import { generate } from 'tolkira/compat/cucumber-html-reporter';

await generate({
  theme: 'bootstrap',
  jsonFile: 'reports/cucumber.json',
  output: 'reports/report.html',
  brandTitle: 'Checkout acceptance',
  metadata: { Browser: 'Chrome', Environment: 'Staging' },
});
```

The option names are unchanged. ESM projects import the shim; CommonJS
projects require it. The wrapper is async, so await the promise (or use the
callback) before reading the report. The core package and CLI remain ESM-only.

A CommonJS project can require the shim directly:

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

The wrapper exposes only the named `generate` function; there is no default
export. `theme` is ignored with a warning; everything else maps to Tolkira. The
callback form still works:

```js
generate(options, (error) => {
  if (error) console.error(error);
});
```

Callback caveat: callback-only code can ignore the returned promise. Tolkira
marks that ignored promise handled so it does not crash the process; awaiting
the same call still throws. The callback receives an `Error` object, not the
legacy string. If the callback itself throws, handle that error yourself.

## Mapping

| Old option | Tolkira behaviour |
| --- | --- |
| `jsonFile` | Input file. |
| `jsonDir` | Directory scanned recursively for `.json` files. |
| `output` | Exact HTML path; missing parent directories are created. |
| `brandTitle` / `name` | Report title. `brandTitle` wins if both differ. |
| `metadata` | Flat string/number/boolean values become report metadata; absolute http(s) values become links in the Report header and Details, with a normalized `href` and a trimmed, bidi-control-stripped label. |
| `ignoreBadJsonFile` | With `jsonDir`, invalid JSON, non-array JSON or an array with a non-feature object is skipped with a warning. |
| `theme` | Warned, ignored. Tolkira uses its own theme. |
| `reportSuiteAsScenarios`, `scenarioTimestamp`, `columnLayout`, `failedSummaryReport` | Warned, ignored. |
| `storeScreenshots`, `screenshotsDirectory`, `noInlineScreenshots` | Warned, ignored; attachments stay inline. |
| `launchReport` | Warned, ignored; Tolkira never opens a browser. |
| Unknown keys | Warned once, ignored. |

`jsonFile` wins when both `jsonFile` and `jsonDir` are set. If both are missing,
generation fails with a usage error.

With `jsonDir` and no `jsonFile`, the shim also writes the old reporter's merged
legacy array to `<output>.json` after the HTML. Features merge by `uri`, or
under `Feature: URI Not Present` when the `uri` is absent; duplicate features
concatenate their `elements`, every element gets `retried: 0`, and the file uses
two-space indentation. The write is atomic and creates missing parent
directories. The `<output>.json` path is reserved for the sidecar: if an earlier
run left it inside `jsonDir`, it is excluded from the report inputs and replaced
when every feature URI in it also appears in another input, so a second group
run does not duplicate features. On the strict path a file at that path is
refused before the report is written, and stays unchanged, when it is not a
valid legacy feature array or has a feature URI that no other input represents;
the error names the sidecar and the input. With `ignoreBadJsonFile: true`, an
invalid file at that reserved path is skipped and the sidecar replaces it
instead. Every input is parsed once before the report when the sidecar is
written: it must be an array of legacy feature objects, where each object has an
`elements` array or both a string `keyword` and a string `name`, and one leading
UTF-8 BOM is accepted. Non-array content or an array with a non-feature object, including
Playwright JSON, fails before the HTML with an error naming the file. The old
reporter's timestamp sort and filename-derived retry counter are not reproduced:
features keep their input order and `retried` stays `0` for every element, which
Seed-Test's group analysis does not read.
`jsonFile` never writes the sidecar, even when `jsonDir` is also set.

The shim consumes legacy Cucumber JSON, which has no Messages `meta.ci`
envelope. CI job and git details therefore do not appear automatically; pass
them as `metadata` entries (for example `CI run`, `Build`, `Commit` and
`Branch`). The core Messages path reads `meta.ci` and renders it in the HTML
report (and the print/PDF derived from it); the JSON summary, CI text and email
do not carry it. Shim metadata uses the same link rule as `--meta`: an absolute
http(s) value becomes a link with a normalized `href` and the value trimmed and
stripped of the report's bidi-control set (U+202A–202E, U+2066–2069) as its
label; use a full URL for `CI run` or `Commit`, not a raw SHA. Other values stay
text.

## What is not reproduced

- **Themes and charts.** The old Bootstrap, hierarchy and Foundation themes are
  not cloned. The report keeps Tolkira's simple shell and Details view.
- **External screenshots.** `storeScreenshots`, `screenshotsDirectory` and
  `noInlineScreenshots` are ignored because Tolkira always inlines attachments.
  Very large runs can hit the 10 MB size warning; split assets are a later item.
- **The old rendered HTML.** The shim consumes the input JSON and options, not
  the generated HTML. If you only have the old HTML, export the JSON again.
- **Custom CSS/JS, MCHR's UI language set, CDN mode and browser launch.** MCHR
  4.6 chooses one UI language at build time (`language` or
  `--language`/`--lang`) from en, es, fr, pt and ar, including RTL Arabic;
  German is not in that set, and MCHR has no in-report switcher. Tolkira
  supports en and de per report and maps the MCHR option to `--locale`. Custom
  CSS/JS, CDN mode and browser launch conflict with the single-file, no-network
  baseline or are out of scope. Tolkira's core `--email <file>` is the nearest
  equivalent to MCHR's separate email report, not a shim option; see
  [`EMAIL.md`](EMAIL.md) and the MCHR section below.

## Seed-Test

Seed-Test 2.0's dev/AI integration branch is ESM. Use
`import { generate } from 'tolkira/compat/cucumber-html-reporter'` and await
the call before reading the HTML. The old default import becomes the named
`generate`, and the `reporter.Options` type becomes
`CucumberHtmlReporterOptions`. Seed-Test 1.x is CommonJS and can require the
same subpath, then await `generate` or use its callback; its current
`reporter.generate(options)` call without `await` must change too. The core
package stays ESM-only.
Seed-Test's group mode also reads the merged array at `output + '.json'`; a
`jsonDir` run writes it before `generate` resolves, so await the call and read
the sidecar afterwards.

## Limits

- The shim accepts legacy Cucumber JSON and passes `jsonFile` through the core
  loader; its documented contract remains legacy JSON. It does not turn
  Messages into legacy JSON or vice versa. Legacy JSON arrives with expanded
  outline examples, so the shim renders them as flat scenarios. The core CLI
  and API additionally accept Playwright JSON natively.
- The usual Tolkira limits apply: 100 MB total input, 50 MB per attachment,
  100 MB total attachments.
- The shim is experimental. The option set is frozen; new features are added to
  the core CLI/API, not to the shim.
- The shim has no equivalent of the 0.6.0 core flags (`--static`,
  `--history`/`--history-limit`, `--baseline`) or the core outputs (`--json`,
  `--ci`, `--email`, `--pdf`); use the core CLI/API for those. `jsonDir` group
  mode and its merged sidecar are supported. The legacy
  `reportSuiteAsScenarios`, `scenarioTimestamp`, `columnLayout` and
  `failedSummaryReport` options are warned and ignored.
- Printing is the browser's print/Save as PDF, not a shim option: with
  JavaScript the complete report prints by default (an active filter still
  narrows the Report view), without it the active Report only. Video/audio do not
  print, very wide matrices may need landscape, and browser headers/footers and
  page numbers stay user-controlled. The core CLI/API also adds the opt-in
  `--pdf <file>`/`renderPdf` Playwright Chromium export (A4 portrait,
  `--pdf-timeout`; no Letter/custom paper or landscape); it is not exposed as a
  cucumber-html-reporter option. The shim itself has no email option either; the
  core CLI/API adds the opt-in `--email` summary. See [`PDF.md`](PDF.md) and
  [`EMAIL.md`](EMAIL.md).

## `multiple-cucumber-html-reporter`

A dedicated MCHR helper and a `tolkira compat` CLI were deliberately left out
until there is real demand. If you use MCHR today, the core CLI covers the
common shape:

```shell
tolkira path/to/jsonDir --out reports/index.html --title "My report"
```

Map `jsonDir` to the input directory, `reportPath`/`reportName` to `--out`,
`metadata` to `--meta key=value` and `brandLogo` to `--logo`. MCHR 4.6 selects
its UI language at build time with `language` or `--language`/`--lang` from en,
es, fr, pt and ar (including RTL Arabic; no German); map it to Tolkira's
`--locale en|de`. Neither has an in-report switcher; Tolkira's one file carries
one locale, while MCHR chooses its language at build time and writes its report
folder. MCHR localizes its default report titles; Tolkira keeps `Tolkira report`
unless `--title` overrides it. An unknown MCHR language warns and falls back to
English on the API/config path, while its `--language`/`--lang` CLI throws.
Tolkira rejects it too: the CLI exits 2 and the API throws.
MCHR's `--email`/`emailReport` is a boolean and writes
`reportPath/email-report.html`; Tolkira's `--email` takes a required file path, so
copying MCHR's bare flag exits 2. MCHR renders a 960 px Tailwind/CDN page with
per-feature statistic cards, metadata/logo and the five **slowest** scenarios.
Tolkira writes a 600 px inline, offline mail body with aggregate counts and the
first five **failed** scenarios in summary order, with no per-feature cards,
metadata or logo. MCHR and Allure 3's `mail` plugin both only generate the file
and leave delivery to a mail step: no sending is shared, not a Tolkira
difference. Attach the report separately.
The dashboard, scenario-level history and the old folder report are not
reproduced; history is available only as the opt-in aggregate `--history`
sidecar described in [`AGENT-INTERFACE.md`](AGENT-INTERFACE.md#run-history). The
core CLI/API also accepts `--locale en|de` for the report shell and email; the
legacy `cucumber-html-reporter` shim option set stays frozen.
