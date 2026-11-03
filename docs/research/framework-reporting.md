# Should Tolkira become an HTML formatter for other test frameworks?

**Status:** 2026-11-03.
**Question:** is a generic multi-framework HTML formatter the right next step, and
which input format or adapter is the best second path?

**Method:** primary documentation, package registries (npm, PyPI, RubyGems,
Maven Central, NuGet, Go proxy), release metadata and GitHub issues. Download
counts are npm last-30-days or gem totals at access time. No production code was
changed.

**Recommendation in one line:** no generic formatter. Build **Playwright JSON**
as the one framework adapter, treat **CTRF** as the strategic generic input once
it reaches 1.0, and document the two Cucumber-adjacent paths that already fit its
inputs (Karate Cucumber JSON, Reqnroll Messages). Do not build a JUnit XML parser
just to tick a box.

## 1. Framework snapshot

| Framework | Native machine output | Popular HTML report | Status (2026-11-03) | What a generic HTML renderer loses |
| --- | --- | --- | --- | --- |
| pytest | JUnit XML (`--junitxml`); no built-in JSON | [pytest-html](https://pytest-html.readthedocs.io/) 4.2.0, 2026-01-19; Allure | Maintained but slow: 211 open issues/PRs, 779 stars; self-contained HTML is opt-in; open themes include metadata display ([#683](https://github.com/pytest-dev/pytest-html/issues/683)) and suite grouping ([#33](https://github.com/pytest-dev/pytest-html/issues/33)) | Fixtures, parametrisation, captured log sections, `extras` (images/text/JSON), reruns |
| JUnit 5 / TestNG | JUnit XML via Gradle/Maven; TestNG `test-output/index.html` | Gradle/Maven HTML; [Allure JUnit5](https://central.sonatype.com/artifact/io.qameta.allure/allure-junit5) 2.35.5, 2026-09-04; [ExtentReports](https://www.extentreports.com/) 5.1.2, 2024-06-26 | Build-tool reports are basic; Allure active; Extent stale | Nested classes, parameterised names, attachments, steps, retries |
| Playwright Test | HTML folder, JSON, JUnit, blob, Perfetto | Built-in HTML | 1.64.1, 2026-10-14; 305M npm downloads/month | Traces, action steps, projects, retries, base64/attachment files |
| Cypress | Mocha JSON, JUnit, TeamCity | Mochawesome; Cypress Cloud Test Replay | 16.2.1, 2026-10-28; Test Replay is cloud-only | Command log, DOM/network replay; screenshots need extra wiring |
| Jest | Jest JSON (`--json`), JUnit via jest-junit | [jest-html-reporters](https://github.com/Hazyzh/jest-html-reporters) 3.1.7, 2023-12-26 | Reporter stale; 1.55M downloads/month; `jest-junit` 17.0.0, 2026-04-24 | Console output, coverage, test code context |
| Vitest | JSON (Jest-compatible), JUnit, TAP, built-in HTML | Built-in HTML with `singleFile: true` | 5.1.0, 2026-11-02; 501M downloads/month | Module graph, traces; single-file already solved |
| Mocha | JSON, TAP, XUnit | [Mochawesome](https://github.com/adamgruber/mochawesome) 8.1.1, 2026-09-15 | Active; 4.36M downloads/month | Hooks, retries, code context, merged attachments |
| RSpec | Built-in HTML and JSON; JUnit via [rspec_junit_formatter](https://github.com/sj26/rspec_junit_formatter) 0.8.0, 2026-10-21 | Built-in HTML; Allure RSpec 2.32.0, 2026-10-16 | Active | Example metadata, attachments, nested groups in JUnit |
| PHPUnit | JUnit XML, OTR XML, TestDox HTML, TeamCity | No full report; TestDox/Allure | 13.4.6, 2026-11-02; `--log-junit` now called legacy, `--log-otr` recommended | Assertion diffs, risky/incomplete states, attachments |
| Go test | `go test -json` (test2json) | [gotestsum](https://github.com/gotestyourself/gotestsum) 1.13.0, 2025-09-11; [go-junit-report](https://github.com/jstemmer/go-junit-report) 2.1.0, 2023-10-18 | go-junit-report maintenance questioned ([#190](https://github.com/jstemmer/go-junit-report/issues/190), 2025-10-07) | Subtests are flattened into names; no attachments |
| .NET NUnit/xUnit/MSTest | TRX (`--logger trx`), JUnit via a logger package | HTML logger; Allure .NET 2.15.0, 2026-04-28; Extent | TRX reporter 2.5.2, 2026-10-27; Extent .NET 5.0.5-beta1, 2024-07-03 | Traits, attachments, test-output nesting |
| Robot Framework | `output.xml`, `--xunit` | Built-in `log.html` / `report.html` | 7.5.1, 2026-11-02 | Keyword nesting, screenshots, timings; built-in report is already single-file |
| Karate | Local HTML, JUnit XML, **Cucumber JSON** | Built-in `karate-summary.html` | 2.1.4, 2026-10-22 | Request/response detail, HTTP logs; Cucumber JSON is already Tolkira input |
| Behat | JUnit only (`--format=junit`) | None built in; Allure Behat | 4.0.0, 2026-09-28 | Steps, attachments, scenario outline structure |
| Reqnroll | TRX, **Cucumber Messages**, HTML | Built-in HTML (Cucumber HTML formatter) | 3.3.4, 2026-03-23; Messages formatter since v3 | Nothing material: Messages is Tolkira's native model |

Two rows are the strategic surprise: **Karate can emit Cucumber JSON**
(`outputCucumberJson(true)`) and **Reqnroll can emit Cucumber Messages**. Those
frameworks need documentation and fixtures, not adapters. Behat only emits JUnit,
so it would be a lossy adapter; its users already have Allure.

**Dependency weight** is modest: pytest-html has 3 runtime dependencies,
rspec_junit_formatter 1, Playwright 1, Mochawesome 3 plus an 11-dependency
generator. jest-html-reporters has only 2, but `open@8` and `fs-extra@10` are majors
behind. An npm audit found 0 in jest-html-reporters 3.1.7 and
mochawesome-report-generator 6.3.2; mochawesome 8.1.1's Mocha peer tree shows 3
moderate advisories (GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249), none high.

## 2. What users praise and complain about

- **Single file wins.** pytest-html's `--self-contained-html` exists precisely
  because people share one file; Playwright's report is a folder served by
  `show-report`; Robot ships one `log.html`. Mochawesome users once had to zip a
  folder to move it ([#26](https://github.com/adamgruber/mochawesome/issues/26)).
- **Large suites hurt.** Jest HTML reporters are slow at ~25k tests
  ([#113](https://github.com/Hazyzh/jest-html-reporters/issues/113)) and heavy DOM
  is sluggish ([#232](https://github.com/Hazyzh/jest-html-reporters/issues/232)).
  Playwright's folder model caused Jenkins friction
  ([#10274](https://github.com/microsoft/playwright/issues/10274)) and Azure
  DevOps friction ([#16542](https://github.com/microsoft/playwright/issues/16542)).
- **Metadata and retries are expected.** Playwright users ask for environment
  metadata ([#31415](https://github.com/microsoft/playwright/issues/31415)) and
  secret redaction ([#35848](https://github.com/microsoft/playwright/issues/35848)).
  Allure's history/retry model is the mature reference.
- **Stale reporters are common.** `jest-html-reporters` has had no release since
  2023-12-26; `go-junit-report` has had none since 2023-10-18; ExtentReports has
  had no stable release since 2024. Maintenance, not features, is the recurring
  risk.
- **JUnit XML is the lowest common denominator, not a report model.** Gradle
  itself calls it a "pseudo standard"; it carries `system-out`/`system-err` text
  and no images. Gradle exposes retries only as `<flakyFailure>` with
  `mergeReruns`, and Jenkins needs a separate plugin to visualise that.

## 3. Generic input formats compared

| Format | Stability | Adoption | Attachments / screenshots | Steps / nesting | Mapping to Messages |
| --- | --- | --- | --- | --- | --- |
| **JUnit XML** | De facto, no normative spec; Gradle calls it a pseudo standard | Universal: every CI, Gradle, Maven, pytest, Playwright, PHPUnit, .NET | None; only text in `system-out`/`system-err` | Flat `<testcase>`; `<testsuite>` nesting only | Testcase → scenario, suite → feature; no steps or images. Requires an XML parser (new dependency) |
| **CTRF** | Formal spec + JSON Schema, but pre-1.0: docs use `0.1.0`; minor releases may break | Growing: 1.45M npm downloads/month for `ctrf` 0.5.0 (2026-10-10); reporters for Jest, Playwright, Cypress, Mocha, Go, .NET, pytest, RSpec; 103 stars | `attachments[].path` plus one base64 `screenshot` per test | Flat `tests[]` with `suite[]`; optional flat `steps[]`; retries with attempts | Tests → scenarios, suites → features, steps and retries map; attachment paths must be read and inlined |
| **TAP** | TAP14 stable since 2022 | Niche: Perl and node-tap; rare in JVM/Python/.NET | None | Subtests nest four spaces; YAML diagnostics free-form | Test point → scenario, subtest → suite; no images, weak metadata |
| **Allure results** | Documented schema, but a directory of JSON plus binary files | Large: Allure 3 CLI 1.49M downloads/month; integrations for every framework | First-class, separate files named by UUID | Nested steps, attachments, retries, labels, parameters | Rich mapping, but Tolkira would ingest a directory, resolve files and duplicate Allure's model |
| **Playwright JSON** | No versioned schema; docs only promise "an object with all information" | Playwright only, but 305M downloads/month | Attachments by path; traces are separate | Suites → specs → tests → results; steps, retries, projects, errors | Excellent mapping; attachment paths must be resolved; format can change between Playwright releases |
| **pytest-html "JSON"** | Not an output format: a `data-jsonblob` attribute embedded in the HTML template | 1.55M downloads/month for pytest-html | Base64 extras in HTML | Whatever the template happens to serialise | Scraping an undocumented HTML attribute; `pytest-json-report` 1.5.0 is from 2022. Reject |

The decisive constraint: Tolkira promises one offline file with screenshots.
JUnit XML cannot carry a screenshot at all. CTRF carries one base64 screenshot and
attachment paths. Playwright JSON and Allure carry paths only. Any path-based
format means Tolkira must read files next to the report, enforce size/MIME limits,
and inline them, which is acceptable when generating locally but not when someone
shares only the JSON from CI.

## 4. Recommendation

### Best generic second input: CTRF, gated on 1.0

CTRF is the only generic format whose model matches Tolkira's: names, statuses,
durations, suite hierarchy, steps, retries, stdout/stderr, tags, one base64
screenshot, attachment paths. It is JSON, so no new parser dependency. Reporters
cover most frameworks here.

But it is pre-1.0: `specVersion` examples are `0.1.0`, and the spec says minor
releases before 1.0 may introduce breaking changes. 103 GitHub stars is small.
Spike it behind an experimental flag, not a v0.2 commitment; adopt
when the spec reaches 1.0 and attachment handling is specified. Until then, ship
no generic input.

### Best framework-specific adapter: Playwright JSON

Playwright is the largest e2e audience (305M downloads/month), and its JSON is the
only popular framework format that carries steps, retries, projects, errors and
attachment references in one file. It maps almost directly onto Messages:
suite → feature, spec/test → scenario, result → attempt, step → step,
attachment → attachment.
The costs: no schema version, attachments are paths, traces are out of scope.
Contain them with a version sniff, a size cap and a fixture per Playwright minor.

PRODUCT.md names it; keep it the *only* framework adapter.

### Free wins before new code

- **Karate:** `outputCucumberJson(true)` writes Cucumber legacy JSON; add a
  fixture and docs.
- **Reqnroll:** the `message` formatter writes Messages NDJSON; same.
- **Behat:** JUnit only; skip it. Point users at Allure or a Messages formatter
  upstream.
- **Robot Framework:** its built-in `log.html`/`report.html` is already a richer
  single-file, keyword-level report.

### What not to build

1. **A generic JUnit XML renderer as the flagship.** Universal, but screenshots
   and steps are impossible; the result is a CI test list. Add a labelled "basic"
   mode only on demand.
2. **TAP ingestion.** No attachments, weak metadata, niche adoption.
3. **Allure results ingestion.** Multi-file, UUID-named attachments, and Allure
   already generates a report; Tolkira would be a worse Allure.
4. **pytest-html HTML/JSON scraping.** Undocumented `data-jsonblob`; it will break
   silently.
5. **Cypress Cloud/Test Replay.** Cloud upload, DOM replay, privacy conflict.
6. **A .NET TRX parser.** Complex XML, no screenshots; CTRF or JUnit covers the
   same users.
7. **Vitest/Jest/Robot HTML replacement.** Each already has a native or single-file
   report; the stale Jest reporter is a warning, not an opportunity.

### Ranked shortlist

1. **Playwright JSON** — build it. Highest audience fit, richest data, already in
   the product plan. Accept path-based attachments and no schema version.
2. **CTRF** — watch and spike. Best generic model, but pre-1.0 and small; revisit
   at 1.0.
3. **JUnit XML** — cheap fallback only. Universal, but lossy; add only if users
   ask for "any framework" and accept a basic report.
4. **Allure results** — avoid. Rich but heavy and multi-file; wrong shape for a
   single-file tool.
5. **TAP** — reject.
6. **pytest-html JSON** — reject.

**Strategic answer:** do not become an HTML formatter for other frameworks. Be
the best Cucumber-native single-file report: one e2e adapter (Playwright) plus
documented bridges for Cucumber-adjacent tools. Every adapter is a permanent
compatibility and security surface; depth in one model beats breadth across
twelve.

## Sources

- pytest-html [4.2.0](https://pypi.org/project/pytest-html/4.2.0/) · [user guide](https://pytest-html.readthedocs.io/en/latest/user_guide.html) · [template](https://github.com/pytest-dev/pytest-html/blob/master/src/pytest_html/resources/index.jinja2) · issues [#683](https://github.com/pytest-dev/pytest-html/issues/683), [#33](https://github.com/pytest-dev/pytest-html/issues/33)
- Allure pytest [2.16.2](https://pypi.org/project/allure-pytest/) · [Allure result file](https://allurereport.org/docs/how-it-works-test-result-file/) · [Allure 3](https://allurereport.org/docs/how-it-works/)
- JUnit [6.1.3](https://junit.org/junit5/docs/current/user-guide/) · TestNG [7.12.0](https://central.sonatype.com/artifact/org.testng/testng) · [Gradle test reporting](https://docs.gradle.org/current/userguide/java_testing.html#test_reporting) · [Allure JUnit5](https://central.sonatype.com/artifact/io.qameta.allure/allure-junit5) · [ExtentReports](https://central.sonatype.com/artifact/com.aventstack/extentreports)
- Playwright [1.64.1](https://www.npmjs.com/package/@playwright/test) · [reporters](https://playwright.dev/docs/test-reporters) · issues [#16542](https://github.com/microsoft/playwright/issues/16542), [#31415](https://github.com/microsoft/playwright/issues/31415), [#10274](https://github.com/microsoft/playwright/issues/10274), [#35848](https://github.com/microsoft/playwright/issues/35848)
- Cypress [16.2.1](https://www.npmjs.com/package/cypress) · [reporters](https://docs.cypress.io/app/tooling/reporters) · [Test Replay](https://docs.cypress.io/cloud/features/test-replay)
- Jest [30.5.2](https://www.npmjs.com/package/jest) · [reporters](https://jestjs.io/docs/configuration#reporters-arraymodulename--modulename-options) · jest-html-reporters [3.1.7](https://www.npmjs.com/package/jest-html-reporters) · issues [#113](https://github.com/Hazyzh/jest-html-reporters/issues/113), [#232](https://github.com/Hazyzh/jest-html-reporters/issues/232)
- Vitest [5.1.0](https://www.npmjs.com/package/vitest) · [reporters](https://vitest.dev/guide/reporters) · [single-file HTML](https://vitest.dev/guide/ui#share-as-a-single-file)
- Mocha [12.0.3](https://www.npmjs.com/package/mocha) · Mochawesome [8.1.1](https://www.npmjs.com/package/mochawesome) · issues [#26](https://github.com/adamgruber/mochawesome/issues/26), [#172](https://github.com/adamgruber/mochawesome/issues/172)
- RSpec [3.13.2](https://rubygems.org/gems/rspec) · [formatters](https://rspec.info/documentation/3.13/rspec-core/RSpec/Core/Formatters.html) · [rspec_junit_formatter 0.8.0](https://rubygems.org/gems/rspec_junit_formatter) · [allure-rspec 2.32.0](https://rubygems.org/gems/allure-rspec)
- PHPUnit [13.4.6](https://packagist.org/packages/phpunit/phpunit) · [CLI output and logging](https://docs.phpunit.de/en/13.4/textui.html)
- Go [test2json](https://pkg.go.dev/cmd/test2json) · [gotestsum 1.13.0](https://github.com/gotestyourself/gotestsum) · [go-junit-report 2.1.0](https://github.com/jstemmer/go-junit-report) · issues [#190](https://github.com/jstemmer/go-junit-report/issues/190), [#138](https://github.com/jstemmer/go-junit-report/issues/138)
- .NET [dotnet test](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-dotnet-test) · [TRX report 2.5.2](https://www.nuget.org/packages/Microsoft.Testing.Extensions.TrxReport) · [Allure .NET 2.15.0](https://www.nuget.org/packages/Allure.Net.Commons) · [ExtentReports .NET](https://www.nuget.org/packages/ExtentReports)
- Robot Framework [7.5.1](https://pypi.org/project/robotframework/) · [User Guide: outputs](https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html#output-files)
- Karate [test reports](https://docs.karatelabs.io/running-tests/junit) · Reqnroll [3.3.4](https://github.com/reqnroll/Reqnroll/releases/tag/v3.3.4) · [formatters](https://docs.reqnroll.net/latest/reporting/reqnroll-formatters.html) · Behat [4.0.0](https://github.com/Behat/Behat/releases/tag/v4.0.0) · [CLI formats](https://docs.behat.org/en/latest/user_guide/command_line_tool.html)
- CTRF [specification](https://ctrf.io/docs/specification/overview) · [test object](https://ctrf.io/docs/specification/test) · [integrations](https://ctrf.io/integrations) · [root/versioning](https://ctrf.io/docs/specification/root) · [npm ctrf 0.5.0](https://www.npmjs.com/package/ctrf)
- TAP [14 specification](https://testanything.org/tap-version-14-specification.html)
