# Tolkira

**Cucumber reports that stay readable: legacy JSON, Messages and JUnit XML in one self-contained HTML file.**

Tolkira turns test results into a single HTML file you can open offline, attach
to a ticket, or keep as a CI artifact. Screenshots, logs and other attachments
stay inside the file. There is no server, no CDN and no telemetry.

Current release: **v0.1.2** · [npm](https://www.npmjs.com/package/tolkira) · [Changelog](https://github.com/Silasoa/tolkira/blob/main/docs/CHANGELOG.md)

> **How this is built:** Tolkira is human-directed and largely AI-generated.
> The maintainer sets the product direction and approves releases. Most code,
> tests and documentation are drafted with large language models, then checked
> by automated tests and AI-assisted review passes. The maintainer reviews the
> release gate and tests the report from time to time. AI output can be wrong;
> please check the report against your own results and open an issue if
> something looks off. [Read more](#how-this-project-is-built).

## Install

```shell
npm install --global tolkira
tolkira --help
```

Or run it without a global install:

```shell
npx tolkira --help
```

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

For CI tools and AI agents, ask for the stable JSON summary instead of scraping
the HTML:

```shell
tolkira test-results/ --out report.html --json
tolkira test-results/ --json
```

## What you get

- **One file that works offline.** CSS, JavaScript and attachments are inline.
  No network requests, no remote fonts, no analytics.
- **The failure first.** Failed scenarios are open by default, with the error
  and screenshot where you need them.
- **Screenshots and attachments that survive.** Images, text, video, audio and
  files are preserved through the legacy JSON adapter.
- **Search and filters.** Search scenarios, features, steps and tags; filter by
  status and tag; open matching features automatically and highlight matches.
- **Copy failure.** Copy a failed scenario's feature, failed step and error as
  plain text for a ticket or an agent.
- **A Details view when you need it.** Status distribution, a feature table,
  run metadata and the Cucumber environment (producer, runtime, OS, CPU,
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
| **Legacy Cucumber JSON** | cucumber-js 2.3.1–13.3.0, Behave 1.3.3, cucumber-jvm 7.22.1 and cucumber-ruby 12.0.1 are tested with real output. Other producers often work; the adapter follows the Cucumber legacy dialect. |
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

The visual comparison uses the report setup from
[Seed-Test](https://github.com/adessoSE/Seed-Test). If you are curious about
Seed-Test, you are welcome to take a look; the comparison notes and screenshots
are in [`docs/COMPARISON.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPARISON.md).

## Migrating from cucumber-html-reporter

The old options object is accepted as-is; only the import changes.

```js
// before
const reporter = require('cucumber-html-reporter');

// after
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
the same input JSON, never the old rendered HTML. See
[`docs/COMPATIBILITY.md`](https://github.com/Silasoa/tolkira/blob/main/docs/COMPATIBILITY.md) for the full mapping and
caveats.

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

## Documentation

- [`docs/AGENT-INTERFACE.md`](https://github.com/Silasoa/tolkira/blob/main/docs/AGENT-INTERFACE.md) — JSON schema, CLI
  contract and exit codes.
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
