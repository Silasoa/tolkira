# Tolkira

> **The interpreter for your test results.**
> Clear, embeddable HTML reports for Cucumber JSON, Messages, and beyond.

**Status: v0.1 core in development.** Messages and legacy Cucumber JSON render
to one self-contained HTML file with a simple report, an optional Analysis tab,
the CLI/API, title/metadata, screenshots, browser tests and a stable JSON
summary for agents. Remaining v0.1 work is tracked in
`openspec/changes/bootstrap-tolkira-core/tasks.md`.

## What is Tolkira?

Tolkira turns test results into a single, self-contained HTML report that works
offline and can be embedded anywhere. It starts with the two Cucumber formats
that matter today:

- **Legacy Cucumber JSON** — the format produced by cucumber-js, cucumber-jvm,
  cucumber-ruby, Behave and many compatible tools.
- **Cucumber Messages (NDJSON)** — the modern, implementation-independent
  format produced by Cucumber's official implementations.

The important part is that **screenshots and attachments survive**. A test
report without the failing screenshot is not a report; it is a table.

Tolkira is deliberately not tied to Cucumber or Gherkin in its name. The
adapter layer can grow to other result formats later without renaming the
product.

## Why the name?

Tolkira is a coined name from the Scandinavian word **“tolk”** — interpreter.
A test report is an interpreter: it translates raw test events into something
people can understand, and it bridges old JSON pipelines and modern Messages
without forcing a migration.

The name is pronounced approximately **TOL-kee-rah**.

## What works today

- **Inputs:** legacy Cucumber JSON (cucumber-js 2.3.1-13.3.0 tested, Behave
  1.3.3 tested; cucumber-jvm/ruby fixtures pending), Cucumber Messages
  (cucumber-js 11.2 fixture; 7+ structurally), and JUnit XML (basic mode:
  suites, test cases, failures, durations and system output; no steps or
  screenshots). Multiple files and directories merge into one run.
- **Output:** one self-contained HTML file; CSS, script and attachments are
  inline. No CDN, no network requests, no telemetry.
- **Report:** failed-first simple report, feature/scenario disclosures, inline
  screenshots and text attachments, doc strings, data tables, hooks, tags,
  durations and errors; search and status filters; dark mode.
- **Analysis:** pass/fail counts, feature table, run metadata and the agent
  summary. It becomes **Details** in the next UI pass.
- **Branding:** title, metadata, logo and accent colour.
- **CLI/API:** `tolkira <input...> --out <file>`, `--json`,
  `summarizeReport()`, atomic output, size limits, CSP and escaping.
- **Compatibility:** experimental
  `tolkira/compat/cucumber-html-reporter` options shim.
- **Browsers:** Chromium, Firefox and WebKit tests.

## Release status

The v0.1 gate is green: typecheck, lint, unit tests, build and browser tests.
The remaining release work is tracked in
`openspec/changes/bootstrap-tolkira-core/tasks.md`; npm publication waits for
explicit approval.

## Non-goals for v0.1

- Rich per-framework adapters (Playwright JSON, Allure results, .NET TRX).
  A basic JUnit XML mode is planned for cheap breadth.
- History, trends and flaky-test analytics (Allure/ReportPortal territory).
- PDF or email reports.
- Localisation (the shell starts in English; German can follow).
- A plugin system, SaaS, test management or a live server.
- A first-class visual clone of the old cucumber-html-reporter themes.

## Principles

- **One file, no network.** A report must be shareable as a CI artefact.
- **Few dependencies.** Prefer Node built-ins and the official Cucumber
  Messages package over another framework.
- **The data pipeline is the product.** The report shell is ours; the input
  model is the official Cucumber Messages format.
- **The report is a designed artifact.** Simple by default, deeper analysis on
  demand.
- **Security at the trust boundary.** Test names, metadata and attachments are
  untrusted input.
- **Spec first, tests first, small slices.**
- **MIT, no telemetry, no vendor lock-in.**

## Migration from cucumber-html-reporter

The legacy options object is accepted as-is; only the import changes.

```js
import { generate } from 'tolkira/compat/cucumber-html-reporter';

await generate({
  jsonFile: 'reports/cucumber.json',
  output: 'reports/report.html',
  brandTitle: 'Checkout acceptance',
  metadata: { Browser: 'Chrome', Environment: 'Staging' },
});
```

The shim is experimental. Themes, charts, external screenshots and browser
launch are not reproduced; they warn and use Tolkira's defaults. It consumes
the same input JSON, never the old HTML. See
[`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md).

## Documentation

- [`docs/PRODUCT.md`](https://github.com/Silasoa/tolkira/blob/main/docs/PRODUCT.md) — vision, audience, scope, market context.
- [`docs/ARCHITECTURE.md`](https://github.com/Silasoa/tolkira/blob/main/docs/ARCHITECTURE.md) — system shape and decisions.
- [`docs/AGENT-INTERFACE.md`](https://github.com/Silasoa/tolkira/blob/main/docs/AGENT-INTERFACE.md) — JSON schema and agent workflow.
- [`docs/COMPARISON.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPARISON.md) — Seed-Test visual comparison and parity gaps.
- [`docs/COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPATIBILITY.md) — cucumber-html-reporter migration shim.
- [`docs/CUCUMBER-COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/CUCUMBER-COMPATIBILITY.md) — tested Cucumber producers and versions.
- [`docs/JUNIT-XML.md`](https://github.com/Silasoa/tolkira/blob/main/docs/JUNIT-XML.md) — JUnit XML basic mode.
- [`docs/agents/review.md`](https://github.com/Silasoa/tolkira/blob/main/docs/agents/review.md) — review and audit protocol.
- [`GLOSSARY.md`](https://github.com/Silasoa/tolkira/blob/main/GLOSSARY.md) — shared language.
- [`AGENTS.md`](https://github.com/Silasoa/tolkira/blob/main/AGENTS.md) — how agents work in this repository.
- [`openspec/`](https://github.com/Silasoa/tolkira/tree/main/openspec) — the change contract and specifications.

## Development

Requires Node.js 22 or newer.

```shell
npm install
npx playwright install chromium firefox webkit
npm run check
npm run test:e2e
npm run stress -- 1000
```

Generate a report from one of the fixtures:

```shell
npm run build
node dist/cli.js test/fixtures/legacy/happy.json \
  --out report.html \
  --title "My report" \
  --meta Browser=Chrome \
  --accent "#1b5e20"

# Optional: embed a logo (path is yours, not part of the repo)
node dist/cli.js test-results/ --out report.html --logo path/to/logo.png
```

The check runs typecheck, lint, unit tests and build. The browser test renders
both a Messages report and a legacy JSON report, opens a screenshot, exercises
search, status filters, expand/collapse and checks that an HTML attachment does
not execute. `npm run stress -- 1000` checks a 1,000-scenario report; see
[`docs/COMPARISON.md`](docs/COMPARISON.md) for the Seed-Test comparison.

For agents and CI, print the stable summary instead of scraping HTML:

```shell
node dist/cli.js test-results/ --out report.html --json
node dist/cli.js test-results/ --json
```

See [`docs/AGENT-INTERFACE.md`](docs/AGENT-INTERFACE.md) for the schema and exit
codes.

## License

MIT. See [`LICENSE`](LICENSE).

Tolkira is not affiliated with Cucumber, SmartBear or any test-framework
vendor. Cucumber and Gherkin are used descriptively; the project uses the
MIT-licensed Cucumber Messages format and package.
