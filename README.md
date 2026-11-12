# Tolkira

**Cucumber reports that stay readable: legacy JSON, Messages and JUnit XML in one self-contained HTML file.**

Tolkira turns test results into a single HTML file you can open offline, attach
to a ticket, or keep as a CI artifact. Screenshots, logs and other attachments
stay inside the file. There is no server, no CDN and no telemetry.

Current release: **v0.2.0** · [npm](https://www.npmjs.com/package/tolkira) · [Changelog](https://github.com/Silasoa/tolkira/blob/main/docs/CHANGELOG.md)

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
```

Tolkira accepts one or more files and directories. A directory is scanned
recursively for supported result files. Everything is merged into one report.

## For agents and CI

Install as a project dependency and write both artifacts:

```shell
npm install --save-dev tolkira
npx tolkira test-results/ --out report.html --title "CI run" --json > summary.json
```

GitHub Actions step:

```yaml
- name: Generate Cucumber report
  if: always()
  run: npx tolkira test-results/ --out report.html --title "CI run" --json > summary.json

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: cucumber-report
    path: |
      report.html
      summary.json
```

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

## What you get

- **One file that works offline.** CSS, JavaScript and attachments are inline.
  No network requests, no remote fonts, no analytics.
- **The failure first.** Failed scenarios are open by default, and a compact
  triage index lists non-passing features and scenarios before passed ones,
  with links that open the scenario detail.
- **Multi-file context.** A source strip shows per-input status, counts and a
  proportion bar when the run has more than one input file and provenance is
  unambiguous. On phones the strip is hidden and the feature row keeps the
  source.
- **Screenshots and attachments that survive.** Images, text, video, audio and
  files are preserved through the legacy JSON adapter.
- **Search and filters.** Search scenarios, features, steps and tags; filter by
  status and tag; open matching features automatically and highlight matches.
- **Rendered descriptions.** Feature, rule, background, scenario and examples
  descriptions render a safe GFM subset - headings, emphasis, code, lists,
  tables, quotes and http(s)/mailto links - from Messages, legacy JSON and JUnit.
- **Tag expressions.** Search accepts the official Cucumber grammar
  (`@a and not @b`, parentheses, escaped tags). Mixed text and tags fall back to
  plain substring search.
- **Shareable filtered views.** Search, hidden statuses and the tag filter live
  in `?query=`, repeated `?hide=` and `?tag=`, so a URL reproduces the same view.
- **Copy failure.** Copy a failed scenario's feature, failed step and error as
  plain text for a ticket or an agent.
- **A Details view when you need it.** Status distribution, a feature-by-status
  matrix, run metadata and the Cucumber environment (producer, runtime, OS, CPU,
  protocol).
- **A stable summary for agents.** `--json` and `summarizeReport()` return a
  versioned schema with counts, durations, scenarios, steps and failure
  messages.
- **Accessible by default.** Keyboard navigation, visible focus, text status
  labels as well as colour, dark mode and 200% zoom reflow. Accessibility is an
  ongoing effort; feedback is welcome.
- **Your branding.** Title, metadata, logo and accent colour without forking the
  shell.

## Supported inputs

| Input | What works |
| --- | --- |
| **Legacy Cucumber JSON** | cucumber-js 2.3.1–13.3.0, Behave 1.3.3, cucumber-jvm 7.22.1 and cucumber-ruby 12.0.1 are covered by producer fixtures. Behave's real run does not yet include attachments or doc strings; see the [dated limitations table](https://github.com/Silasoa/tolkira/blob/main/docs/LIMITATIONS.md). Other producers often work; the adapter follows the Cucumber legacy dialect. |
| **Cucumber Messages (NDJSON)** | cucumber-js 11.2, cucumber-jvm 7.22.1 and cucumber-ruby 12.0.1 fixtures. This is the modern, implementation-independent format. |
| **JUnit XML** | Basic mode: suites, test cases, statuses, durations, failures, skipped cases and system output. JUnit has no Gherkin steps or screenshots; each test case is shown as one synthetic step. |

Multiple files and mixed formats can be merged into one run. See
[`docs/CUCUMBER-COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/CUCUMBER-COMPATIBILITY.md) for the
tested producer matrix and
[`docs/JUNIT-XML.md`](https://github.com/Silasoa/tolkira/blob/main/docs/JUNIT-XML.md) for the JUnit limits.

## Why Tolkira exists

[`cucumber-html-reporter`](https://github.com/protractor-cucumber-framework/cucumber-html-reporter)
has been effectively unmaintained since October 2024. It still has a large
user base, but it loads Bootstrap, jQuery and Google Charts from CDNs, only
reads legacy JSON, and carries old runtime dependencies. Reports that should
work offline lose their layout and charts.

Tolkira keeps the old input working and fixes the parts that hurt:

- one offline file instead of CDN dependencies;
- legacy JSON **and** modern Messages;
- JUnit XML as cheap breadth for non-Cucumber teams;
- screenshots and attachments that stay in the report;
- a stable JSON summary for agents and CI;
- a small, reviewed dependency surface.

Single-file output alone is no longer unique: the official formatter and Allure
can produce one file. Tolkira's difference is the combination - both Cucumber
generations, JUnit as cheap breadth, an agent-readable summary, and no server,
CDN or telemetry.

### What parity means here

"Parity" in this project means content and navigation: the same statements,
steps, tags, statuses, durations and descriptions, plus search, tag expressions
and shareable filter URLs, whether the input is legacy JSON, Messages or JUnit.
It does not mean theme parity with `cucumber-html-reporter`, a report folder, or
external attachments; Tolkira deliberately stays one offline file. The honest
claim is credible Messages report parity, not full formatter parity.

### How it compares

Last checked 2026-11-11 against the current package docs. Trade-offs are
deliberate; pick the tool that fits the job.

| Tool | Offline | Legacy JSON | Messages | JUnit | JSON summary | Themes | ESM/CJS | Node | Maintenance | Choose it if… |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [cucumber-html-reporter](https://github.com/gkushang/cucumber-html-reporter) | No, CDN assets | Yes | No | No | No | Three built-in themes | CJS | Old, no engine pin | Unmaintained since Oct 2024 | You need its exact themes and offline use is not a requirement. |
| [multiple-cucumber-html-reporter](https://github.com/WasiqB/multiple-cucumber-html-reporter) | Yes, report folder (CDN optional) | Yes | Yes | No | Saved JSON (`saveCollectedJSON`) | Dark mode, custom CSS | ESM (v4) | 22+ | Active | You want a dashboard, multi-run grouping, i18n and a report folder. |
| [Official Cucumber HTML formatter](https://github.com/cucumber/html-formatter) | Yes, one file | No | Yes | No | No | Custom CSS/JS only | ESM | Modern Node | Official Cucumber project | You use Cucumber Messages only and want the official look. |
| **Tolkira** | **Yes, one file** | **Yes** | **Yes** | **Basic** | **Versioned summary (`--json`)** | **Branding, dark mode; no theme gallery** | **ESM; CJS compat shim** | **22+** | **Active** | **You need one offline file from legacy JSON and/or Messages, plus a stable summary for CI and agents.** |

The visual comparison uses the report setup from
[Seed-Test](https://github.com/adessoSE/Seed-Test). If you are curious about
Seed-Test, you are welcome to take a look; the comparison notes and screenshots
are in [`docs/COMPARISON.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPARISON.md).

## Migrating from cucumber-html-reporter

Install Tolkira next to the old reporter and keep the existing JSON output:

```shell
npm i -D tolkira
```

Node.js 22 or newer is required. Node 20 is end-of-life and unsupported;
upgrading to Node 22+ is the migration cost for both the ESM and CommonJS
paths. The core and CLI are ESM-only; the compatibility subpath also loads
from CommonJS through an async wrapper.

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

**Version note (unreleased):** the CommonJS `require` path is new in Tolkira
0.3.0, which is not published yet. The published 0.2.0 package exposes only the
ESM `import` path; use the ESM form there, or install a 0.3.0 tarball from the
repository once that release is available.

The options object is mostly compatible, but the call contract is not. Only
the import style changing is not the whole story:

| Behaviour | `cucumber-html-reporter` | Tolkira compat shim |
| --- | --- | --- |
| Input | `jsonFile` falls back to `output + '.json'` when omitted | `jsonFile` or `jsonDir` is required; there is no implicit fallback |
| Return value | Sync `true` on success without a callback, `undefined` with one; `undefined` for a bad report | Always a `Promise<CompatResult>` with `output`, `warnings` and `summary`; await every call |
| Errors | The callback receives a string; without a callback a failure can be silent | The promise rejects with an `Error`, and the callback receives the same `Error` |
| Callback | `callback()` on success, `callback(string)` on failure | `callback(error?)`; the promise still rejects |
| `jsonDir` | Recursively merges features by `uri`, dedupes them and writes an `output + '.json'` sidecar | Scans recursively but passes the files as separate inputs; writes no sidecar and does not dedupe |
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
`metadata` to repeated `--meta key=value`, and `brandLogo` to `--logo`.
Dashboard, history, trends, i18n, email reports and the multi-file folder report
are not reproduced. See
[`docs/COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPATIBILITY.md#multiple-cucumber-html-reporter)
for the mapping.

## Privacy and limits

- No network requests, no telemetry, no remote fonts and no CDN.
- A restrictive Content Security Policy is embedded in every report.
- Test names, metadata and attachments are treated as untrusted input.
- Default limits: 100 MB total input, 50 MB per attachment and 100 MB total
  attachments. A warning appears when a report grows beyond 10 MB.
- JUnit XML is intentionally basic; it is not a replacement for a native
  Playwright, Jest or Allure report.
- One report is one file. External attachments for very large media are a
  future option.

See [`docs/LIMITATIONS.md`](https://github.com/Silasoa/tolkira/blob/main/docs/LIMITATIONS.md)
for the dated limitations table (last verified 2026-11-11), including the
remaining Behave real-run gap.

## Documentation

- [`llms.txt`](https://github.com/Silasoa/tolkira/blob/main/llms.txt) — short entry point for AI agents.
- [`docs/AGENT-INTERFACE.md`](https://github.com/Silasoa/tolkira/blob/main/docs/AGENT-INTERFACE.md) — JSON schema, CLI
  contract and exit codes.
- [`docs/LIMITATIONS.md`](https://github.com/Silasoa/tolkira/blob/main/docs/LIMITATIONS.md) — dated limitations table
  (last verified 2026-11-11).
- [`docs/CUCUMBER-COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/CUCUMBER-COMPATIBILITY.md) — tested
  Cucumber producers and versions.
- [`docs/JUNIT-XML.md`](https://github.com/Silasoa/tolkira/blob/main/docs/JUNIT-XML.md) — JUnit basic-mode mapping and
  limits.
- [`docs/COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPATIBILITY.md) — migration from
  cucumber-html-reporter.
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
```

`npm run check` runs typecheck, lint, unit tests, build and the CSS generation
step. `npm run test:e2e` runs the browser tests in Chromium, Firefox and
WebKit. `npm run stress -- 1000` builds a 1,000-scenario report and reports size
and timing.

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
