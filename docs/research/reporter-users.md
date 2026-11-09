# Who uses Cucumber HTML reports

Research note, 2026-11-09. Read-only for production files; no code changed and
nothing committed. The question: who actually uses Cucumber HTML reporters, in
what shapes, and what should Tolkira prioritize — including whether a 20-result
search auto-open cap is sensible.

**Top insight:** the report is primarily a failure-triage tool for automation
engineers in CI. Failed-first ordering and screenshots do most of the work;
single-file, iframe-safe delivery is the constraint that makes the report
usable.

## Short answer

- Demand is large and stable: roughly 2.1M downloads/month for
  `cucumber-html-reporter`, 0.9M for `multiple-cucumber-html-reporter`, and
  12.6M for `@cucumber/html-formatter` in the last 30 days.
- The public evidence points to a primary user who is a **failure triager**, not
  a dashboard reader: an automation engineer in CI who needs the failed
  scenario, its error and its screenshot without scrolling through passed tests.
- The secondary users are CI engineers publishing one artifact, QA leads and
  stakeholders sharing a summary, consultancies embedding a white-label report,
  legacy/multi-language Cucumber teams, and framework/tool integrators.
- Reports are attachment-heavy. A recurring concrete failure mode in public
  issues is report size and attachment handling, not missing charts.
- Single-file, offline delivery is a **delivery constraint**, not the whole
  product. It matters because reports are emailed, attached to tickets,
  published as CI artifacts and embedded in iframes.
- A 20-result search auto-open cap is sensible as a **rendering guard**, but it
  must not be a silent result limit. Open all matches on small result sets;
  on large sets, open 20, say “20 of N matches expanded”, and offer “Expand all”.
- Do not build dashboards/trends, PDF, i18n, video/trace viewers or live
  progress first. The public evidence for those as core pain is thin.

## Evidence base

| Package | Latest | Downloads, last 30 days | Dependents / repos (libraries.io) | GitHub code-search files |
| --- | --- | ---: | ---: | ---: |
| [`cucumber-html-reporter`](https://www.npmjs.com/package/cucumber-html-reporter) | 7.2.0, 2024-10-01 | 2,115,024 | 178 / 54 | 8,832 |
| [`multiple-cucumber-html-reporter`](https://www.npmjs.com/package/multiple-cucumber-html-reporter) | 4.6.0, 2026-11-05 | 909,498 | 115 / 26 | 4,080 |
| [`@cucumber/html-formatter`](https://www.npmjs.com/package/@cucumber/html-formatter) | 24.2.0, 2026-09-28 | 12,589,536 | 34 / 11 | 8,992 |
| [`tolkira`](https://www.npmjs.com/package/tolkira) | 0.1.2, 2026-11-04 | 713 | — | — |

Downloads are the npm downloads API for 2026-10-10 to 2026-11-08. Code-search
counts are GitHub’s code-search API for the package name in a file, default
branches only; they include docs, forks and generated code, so they are a
footprint signal, not a count of projects. libraries.io dependents
([chr](https://libraries.io/npm/cucumber-html-reporter),
[MCHR](https://libraries.io/npm/multiple-cucumber-html-reporter),
[formatter](https://libraries.io/npm/@cucumber%2Fhtml-formatter)) are likely an
undercount and should be read as a floor.

Issue corpus reviewed (GitHub API, excluding pull requests):

| Repo | Non-PR issues | Open | Note |
| --- | ---: | ---: | --- |
| `gkushang/cucumber-html-reporter` | 175 | 88 | last release October 2024; 92 open issues including PRs |
| `WasiqB/multiple-cucumber-html-reporter` | 218 | 5 | active; 4.6.0 released 2026-11-05 |
| `cucumber/html-formatter` | 43 | 14 | official formatter; active |

I read 29 key threads in full and keyword-scanned the rest. Keyword counts are
directional only: issue templates, pasted screenshots and environment blocks
inflate words such as “screenshot” and “environment”. The concrete threads are
the evidence; the counts are not a survey. A rough scan finds
screenshot/image/attachment language in 68/175 `chr`, 65/218 `MCHR` and 16/43
`fmt` issue bodies; treat that as a signal, not a classification. Below, `chr`,
`MCHR` and `fmt` abbreviate the three repositories.

Additional primary sources: public repositories and CI configs, Stack Overflow
questions via the Stack Exchange API, and package/repository metadata. No user
interviews were conducted. No public usage telemetry is available for these
reporters, so actual click-through and search usage cannot be measured.

## 1. Audience segments

### 1.1 Automation engineer / SDET (primary)

**Job:** run the BDD suite, find the failed scenario, read the error and stack,
look at the screenshot or log, fix the test or product, rerun. Often also
maintains the framework and report wiring.

**Constraints:** suites of hundreds to thousands of scenarios; screenshots on
failure and sometimes on every step; retries; parallel workers; CI timeouts;
browser memory; report files that become too large to open or upload.

**What they value:** failed-first ordering, the failing step and error visible
without clicking through five screens, inline screenshots with a lightbox,
search/tag/status filters, low report weight, and a file that opens locally.

**Evidence:** the clearest UX request is “by default only failed/pending tests
should be visible … in cases many features/scenarios you have to do a lot of
scrolling” ([chr #147](https://github.com/gkushang/cucumber-html-reporter/issues/147),
[#154](https://github.com/gkushang/cucumber-html-reporter/issues/154)). The same
pain appears for MCHR: “when running hundred of tests and there is some fail
test … easy find fail tests quickly instead of scroll over the page”
([MCHR #141](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/141)).
Screenshot friction is the largest concrete issue cluster:
[chr #84](https://github.com/gkushang/cucumber-html-reporter/issues/84),
[#232](https://github.com/gkushang/cucumber-html-reporter/issues/232),
[#263](https://github.com/gkushang/cucumber-html-reporter/issues/263),
[MCHR #382](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/382),
[#413](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/413).

### 1.2 CI / DevOps engineer

**Job:** run the suite, generate the report at a stable path, upload it as a CI
artifact, expose it in a build tab, retain it for the team, and keep the
pipeline fast and reproducible.

**Constraints:** Jenkins/GitLab/Azure/GitHub Actions viewers; sandboxed iframes
and CSP; no CDN or network at view time; folder reports whose links break when
only `index.html` is published; artifact storage and retention; cross-platform
runners.

**What they value:** one self-contained file, a deterministic CLI, a stable
output path, a machine-readable summary, no server, no telemetry, and a small
artifact. The report must survive being moved from the agent to an artifact
store or an iframe.

**Evidence:** public GitHub Actions workflows generate and upload the report as
an artifact; GitHub code search finds 30 workflow files for `chr` and 16 for
`MCHR` (query limited to `.github/workflows`), which confirms CI use
([Cypress + MCHR](https://github.com/yarreaza/cypress-cucumber-reportes-html/blob/main/.github/workflows/main.yml),
[Cucumber Ruby + chr](https://github.com/srbarrios/cucumber-ruby-skeleton/blob/master/.github/workflows/capybara.yml),
[Cypress + MCHR + gh-pages](https://github.com/AZANIR/cypress-cucumber/blob/master/.github/workflows/cypress-cucumber.yml),
[WDIO + chr](https://github.com/AndriiZhydkykh/wdio-cucumber--html-report/blob/master/.github/workflows/wdio.yml)).
The Azure DevOps extension wraps `cucumber-html-reporter`, accepts metadata and
shows the report in a Build/Release tab via an iframe
([README](https://github.com/maciejmaciejewski/azure-pipelines-cucumber/blob/master/README.md),
[tab.html](https://github.com/maciejmaciejewski/azure-pipelines-cucumber/blob/master/tab.html)).
MCHR users hit exactly this: “each scenario has its own file so the viewer
cannot follow the `<a href>` links, plus css and js are not being loaded”; the
workaround was to merge everything into one HTML file with Cheerio
([MCHR #216](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/216)).
Jenkins HTML Publisher and shared-report problems are also recurring on Stack
Overflow ([example](https://stackoverflow.com/questions/66635638/report-is-not-fully-displaying-while-using-html-publisher-plugin-in-jenkins)).

### 1.3 QA lead / test manager / stakeholder

**Job:** answer “did the release pass?”, “which environment/build was tested?”,
“what is failing?”, and share that answer with the team, a ticket or management.

**Constraints:** not a step-level debugger; may read on mobile or in email;
needs the summary first; may not have the repository or CI access; wants
branding and context.

**What they value:** pass/fail counts and pass rate, duration, environment and
build metadata, a clear failure list, a shareable file or emailable summary,
and optional trends/history. Deep step detail is secondary.

**Evidence:** MCHR invests in a dashboard, metadata and an “Emailable Report”
([README](https://github.com/WasiqB/multiple-cucumber-html-reporter#readme);
[email template](https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/reporter/src/templates/email.liquid)).
Requests for project/release/cycle names, execution start/end time and timezone
go back to [MCHR #14](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/14).
“Send cucumber index.html report to email” has ~8k Stack Overflow views
([SO](https://stackoverflow.com/questions/53041081/send-cucumber-index-html-report-to-email)).
Direct quotes from this segment are weaker than for engineers; much of the
evidence is product investment and feature requests, not interviews.

### 1.4 Consultancy / platform team embedding reports

**Job:** put a white-label test report inside a customer portal, internal
platform or low-code testing product; isolate customer data; keep the report
stable across many runs.

**Constraints:** iframe/`srcdoc`, CSP and sandbox rules, no external requests,
stable HTML and CSS, branding, small file size, many concurrent runs, cleanup.

**What they value:** a single HTML file that can be assigned to an iframe,
inline CSS/JS and data URIs, logo/accent/title, custom metadata, no telemetry,
and a programmatic API or CLI.

**Evidence:** Seed-Test, a low-code UI-testing platform, embeds the generated
report with `iframe.srcdoc`, exports it to PDF in the host app, stores reports,
and deletes files after five minutes
([reporting.ts](https://github.com/adessoSE/Seed-Test/blob/master/backend/src/helpers/reporting.ts),
[report.component.ts](https://github.com/adessoSE/Seed-Test/blob/master/frontend/src/app/report/report.component.ts),
[report.component.html](https://github.com/adessoSE/Seed-Test/blob/master/frontend/src/app/report/report.component.html)).
It pins `cucumber-html-reporter` 7.2.0 and overrides `semver` because of the old
dependency chain ([package.json](https://github.com/adessoSE/Seed-Test/blob/master/backend/package.json)).
The Azure DevOps extension is another embedding case; its CORB
(Cross-Origin Read Blocking) fix inlines screenshot bytes as data URIs because
external attachment URLs were blocked in the report iframe
([proposal](https://github.com/maciejmaciejewski/azure-pipelines-cucumber/blob/master/openspec/changes/archive/2026-07-31-fix-screenshot-corb-inline-fetch/proposal.md)).
The official formatter’s sandboxed-iframe request is the same constraint from
the other side ([fmt #535](https://github.com/cucumber/html-formatter/issues/535)).

### 1.5 Legacy / multi-language Cucumber team

**Job:** keep an existing Cucumber-JVM, Cucumber-Ruby, Behave, Behat, Reqnroll,
Karate or Godog pipeline working while the team migrates to Messages at its own
pace.

**Constraints:** legacy JSON quirks, attachment encodings, old Cucumber
versions, no Node/JS tooling in the build, framework-specific report plugins,
and a large installed base of scripts that already point at a JSON file.

**What they value:** auto-detection of legacy JSON and Messages, preserved
screenshots and text attachments, a compatible CLI/API, clear errors on bad
input, and documentation that names the supported producers.

**Evidence:** Godog’s official README still points users to
`cucumber-html-reporter` for HTML
([godog README](https://github.com/cucumber/godog/blob/main/README.md)).
The old reporter’s top gap is Messages support
([chr #202](https://github.com/gkushang/cucumber-html-reporter/issues/202),
[#229](https://github.com/gkushang/cucumber-html-reporter/issues/229),
[#244](https://github.com/gkushang/cucumber-html-reporter/issues/244)).
MCHR users still hit Katalon/legacy attachment shapes
([MCHR #103](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/103)),
Cucumber 8 NDJSON ([MCHR #193](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/193))
and Cucumber 10+ JSON attachment decoding
([MCHR #316](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/316)).
Tolkira’s real-producer fixtures for cucumber-js, Behave, cucumber-jvm and
cucumber-ruby are directly relevant here (see
`docs/research/reporter-compatibility.md`).

### 1.6 Framework / tool integrator

**Job:** ship report generation inside a framework, service or CI extension so
users do not wire it themselves.

**Constraints:** stable API/CLI, low dependency weight, cross-platform behavior,
output path control, metadata injection, and low maintenance burden.

**What they value:** a programmatic API, a single-file output option, predictable
paths, compatibility with existing JSON/Messages streams, and no server.

**Evidence:** the WDIO service
([wdio-multiple-cucumber-html-reporter](https://github.com/wswebcreation/wdio-multiple-cucumber-html-reporter)),
Playwright-BDD’s reporter docs pointing at both reporters
([docs](https://github.com/vitalets/playwright-bdd/blob/main/docs/reporters/cucumber.md)),
the Azure DevOps task, and Seed-Test. These integrations are a distribution
channel: users often meet the reporter through the framework, not through npm.

## 2. Real-world report shapes

The public record supports three recurring shapes. Sizes below are reported
examples, not a statistically representative distribution; issue trackers
over-represent large and broken runs.

| Shape | What it looks like | Reported examples | Implication |
| --- | --- | --- | --- |
| **Small/local** | Tens of scenarios, a handful of features, screenshots on failure, opened locally or attached to a ticket | 9 scenarios / 42 steps ([chr #204](https://github.com/gkushang/cucumber-html-reporter/issues/204)); 11 scenarios × 14 steps with screenshots ([MCHR #159](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/159)) | The summary and failed scenario must be immediate; search/filters are secondary but cheap. |
| **CI regression** | Hundreds of scenarios, screenshots on failure or every step, generated on every pipeline run, uploaded as an artifact | 423 scenarios → 314 MB ([fmt #62](https://github.com/cucumber/html-formatter/issues/62)); 80 MB report with 34 MB JSON and 6 MB screenshots ([chr #188](https://github.com/gkushang/cucumber-html-reporter/issues/188)); 15 MB report ([fmt #61](https://github.com/cucumber/html-formatter/issues/61)) | Size is driven by attachments and embedded data, not by scenario count alone. A single file can still be too big to email or open comfortably. |
| **Large/parallel** | 1,000+ scenarios, 20,000+ steps, per-step screenshots and per-scenario video, multiple hosts/workers merged into one report | 1,000+ scenarios / 20,000+ steps → Node heap OOM ([MCHR #595](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/595)); 146 scenarios with a screenshot on every step → `RangeError: Invalid string length` ([chr #263](https://github.com/gkushang/cucumber-html-reporter/issues/263)); ~300 tests → report generation hangs ([chr #283](https://github.com/gkushang/cucumber-html-reporter/issues/283)) | Streaming, external attachments, and retry/merge correctness matter more than dashboard polish. |

Some of these threads are closed; they are used as size/shape evidence, not as
current bug status.

**Green vs red runs.** Public CI configs generate the report as part of the
pipeline, but the public evidence is dominated by failure debugging. A green run mostly needs a summary
and a shareable artifact; a red run needs fast failure inspection. Failure
density is **not** publicly measured: no reporter publishes a failure-rate
distribution, and issue threads self-select failing runs. Do not design around
an assumed percentage of failures.

**Attachment mix.** Screenshots are the dominant attachment. Text/JSON/log
attachments are common; video, HAR files and Playwright traces are emerging but
heavy. Multiple attachments per step are increasingly common: reference, actual
and diff images in one step ([chr #84](https://github.com/gkushang/cucumber-html-reporter/issues/84)),
or a screenshot on every step for QA review
([chr #263](https://github.com/gkushang/cucumber-html-reporter/issues/263)).
Users report 20 MB HAR files per scenario plus video/trace zips
([fmt #282](https://github.com/cucumber/html-formatter/issues/282)).

**Retries and parallel runs.** Retries are a recurring Cypress/WDIO problem:
the reporter counts a rerun as an extra test, so one scenario becomes “2 tests,
1 passed, 1 failed” ([MCHR #221](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/221));
users want attempts grouped and the final status shown
([MCHR #217](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/217)).
Parallel runs create merge and overwrite problems
([MCHR #23](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/23),
[#82](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/82);
[chr #102](https://github.com/gkushang/cucumber-html-reporter/issues/102),
[#149](https://github.com/gkushang/cucumber-html-reporter/issues/149),
[#238](https://github.com/gkushang/cucumber-html-reporter/issues/238)).

**Size drivers.** Inline base64 attachments, embedded Messages streams and
duplicated step-definition messages are the named causes of bloated reports
([fmt #62](https://github.com/cucumber/html-formatter/issues/62),
[#414](https://github.com/cucumber/html-formatter/issues/414)).
The official formatter maintainers themselves describe the architecture as
“all the messages have to be on the browser page” ([fmt #62](https://github.com/cucumber/html-formatter/issues/62))
and discuss pre-computing results and externalising attachments
([fmt #414](https://github.com/cucumber/html-formatter/issues/414),
[#281](https://github.com/cucumber/html-formatter/issues/281)).

## 3. What users actually use

| Capability | Demand evidence | Usage evidence | Implication for Tolkira |
| --- | --- | --- | --- |
| **Search / status / tag filters** | Repeated requests for failed-only views and filtering ([chr #147](https://github.com/gkushang/cucumber-html-reporter/issues/147), [#154](https://github.com/gkushang/cucumber-html-reporter/issues/154); [MCHR #141](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/141); [fmt #49](https://github.com/cucumber/html-formatter/issues/49)) | No telemetry; actual frequency unknown. Large-run threads describe scrolling through hundreds of tests. | Keep search and filters, but make failed-first the default and make search result counts explicit. |
| **Screenshots / attachments** | Strongest concrete cluster: attach, decode, multiple images, passing-step images, rendering in CI ([chr #84](https://github.com/gkushang/cucumber-html-reporter/issues/84), [#232](https://github.com/gkushang/cucumber-html-reporter/issues/232), [#263](https://github.com/gkushang/cucumber-html-reporter/issues/263); [MCHR #382](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/382), [#413](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/413); [fmt #363](https://github.com/cucumber/html-formatter/issues/363)) | Many Stack Overflow questions about attaching screenshots; public CI repos upload report artifacts with screenshots. | Preserve every attachment, show thumbnails/lightbox, handle text/JSON/logs, and guard size. |
| **Metadata / CI context** | Project/release/cycle names, app version, browser/OS, branch/commit/build link, custom fields ([chr #18](https://github.com/gkushang/cucumber-html-reporter/issues/18); [MCHR #14](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/14), [#82](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/82), [#333](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/333); [fmt #106](https://github.com/cucumber/html-formatter/issues/106)) | France Connect and ProConnect inject GitLab branch/commit/MR/job links into MCHR ([script](https://github.com/france-connect/sources/blob/main/quality/scripts/multiple-cucumber-html-reporter.ts), [script](https://github.com/proconnect-gouv/federation/blob/main/quality/scripts/multiple-cucumber-html-reporter.ts)); Seed-Test injects app version/environment/platform. | Make metadata compact, escaped and easy to pass; auto-detect CI values only from a safe allowlist. |
| **Retries / flaky results** | Reruns counted as extra tests; users want attempts grouped and final status ([MCHR #221](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/221), [#217](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/217); [chr #237](https://github.com/gkushang/cucumber-html-reporter/issues/237); [fmt #283](https://github.com/cucumber/html-formatter/issues/283)) | Cypress/WDIO retry configurations are common in public examples; the issue threads include concrete rerun counts. | Deduplicate counts now; show attempt history later. Do not let a passing retry look like a failure. |
| **Sharing / CI artifacts** | Single-file requests, email/Slack sharing, Azure/Jenkins viewers, artifact uploads ([MCHR #190](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/190), [#556](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/556), [#216](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/216); [SO email](https://stackoverflow.com/questions/53041081/send-cucumber-index-html-report-to-email)) | GitHub Actions workflows upload the report; Azure extension displays it in a tab; Seed-Test embeds it via `srcdoc`. | Keep one file, no CDN, stable path, and an offline/no-JS baseline. |
| **Embedding** | iframe/`srcdoc`, sandboxed viewers, white-label portals ([MCHR #190](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/190); [fmt #535](https://github.com/cucumber/html-formatter/issues/535)) | Seed-Test uses `iframe.srcdoc`; Azure uses an iframe and inlines screenshots to avoid CORB. | Test iframe/`srcdoc` explicitly; avoid top-window assumptions and external assets. |
| **Trends / history** | Competitor investment (MCHR dashboard, Allure history); public issue demand exists but is not the top pain in the threads reviewed | Not measurable; no public usage data. | Defer. A history file is a later feature, not the default report. |
| **Branding / i18n / PDF / video** | MCHR supports custom data, five languages, emailable report; PDF request is thin; video/HAR requests are heavy ([MCHR #101](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/101); [fmt #282](https://github.com/cucumber/html-formatter/issues/282)) | Branding is visible in public configs; PDF is often done by the host (Seed-Test uses jsPDF); video/trace is niche in the reviewed threads. | Keep basic branding; defer deep theming, i18n, PDF and media players. |

**The strongest single quote on audience:** a Cucumber maintainer, discussing a
test-case-centric redesign, wrote that “more people want test results than want
documentation (with some test results sprinkled in)” and that the formatter
should be “a useful report for people trying to keep their pipelines green”
([fmt #283](https://github.com/cucumber/html-formatter/issues/283)). That is the
job Tolkira should optimize first.

## 4. Implications for Tolkira

### 4.1 Default view: failure-driven, not attachment-driven

Tolkira already orders failures first and has a triage index. The current
renderer, however, opens a scenario when it failed **or has any image**, and
opens a feature when it failed **or contains any image**
(`src/render/html.ts`, `renderScenario`/`renderFeature`). Per-step screenshots
are common, including on passing steps
([chr #263](https://github.com/gkushang/cucumber-html-reporter/issues/263),
[MCHR #159](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/159),
[fmt #363](https://github.com/cucumber/html-formatter/issues/363)). On such a
run, “any image” expands most of a green report on first paint, which is exactly
the scrolling problem users complain about.

Recommended default:

- Open failed scenarios and the features that contain them; keep passed
  scenarios collapsed, with the screenshot thumbnail still visible in the row.
- Do not use “has an attachment” as an open signal. Attachments are evidence,
  not a failure.
- If there are many failures, open the first N (the same guard as search) and
  show “N failures · Expand all”. A 100-failure run should not open 100 bodies
  before the user asks.
- On an all-green run, show the summary, feature list and thumbnails; no empty
  triage block and no “needs attention” noise.

### 4.2 Search and the 20-result auto-open cap

Current behavior: any non-empty query filters scenarios; matching features are
opened; the first 20 matching scenarios are opened; highlighting is capped at
200 ranges. The 20 cap is a reasonable **paint guard** for a single-file report
with inline screenshots, but the current implementation makes it invisible.

Verdict: **keep the cap, remove the ambiguity.**

- **Small result set (≤20 matches):** open all matches. The cap never applies;
  do not show “show more” friction.
- **Large result set (>20 matches):** open the first 20, then show a visible
  line such as “20 of 87 matches expanded” with an “Expand all 87” action. The
  other 67 matches must still be visible as collapsed rows; filtering must never
  be capped, only expansion.
- **Feature opening:** open only features that contain an expanded match. Other
  matching features should stay collapsed with their match count. Opening every
  matching feature body creates a wall of headers on a 100+ feature run.
- **Short queries:** filter from the first character if desired, but do not
  auto-expand until the query has at least two characters. A one-character
  query can match everything and defeat the guard.
- **Highlighting:** the 200-range cap is fine; it should never change which
  scenarios match.
- **Status/tag filters:** do not auto-open every match. Preserve failure-first
  expansion and let the user open what they need.
- **Announcement:** use the existing live region to say both “N of M scenarios
  visible” and “K of N matches expanded”; the second number is the one users
  cannot infer today.

This gives the right behavior on both ends: a 12-scenario run opens all matches
and feels instantaneous; a 2,000-scenario run opens a bounded set, tells the
truth about the rest, and offers one explicit action to see everything.

### 4.3 Attachment handling

- Preserve **all** attachments per step, not just the first image. Multiple
  screenshots per step are a real request ([chr #84](https://github.com/gkushang/cucumber-html-reporter/issues/84)).
- Show a thumbnail in the scenario row and a lightbox/full-size view; keep
  `loading="lazy"` for images.
- Render text, JSON and log attachments as expandable blocks; do not dump
  10,000-line logs into the row. Users explicitly complain about this
  ([fmt #282](https://github.com/cucumber/html-formatter/issues/282)).
- Inline screenshots by default; add a size warning and, later, an external
  assets mode for large media. The official formatter has open requests for
  external attachments for exactly this reason
  ([fmt #281](https://github.com/cucumber/html-formatter/issues/281),
  [#282](https://github.com/cucumber/html-formatter/issues/282)); MCHR’s
  1,000-scenario run shows the scale limit of the same in-memory, all-in-one
  approach ([MCHR #595](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/595)).
- Do not drop screenshots from passing steps. They are used for QA review and
  visual evidence; just do not auto-open them.
- Keep the existing legacy attachment decoding work; it is a real migration
  need, not a corner case ([MCHR #316](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/316)).

### 4.4 Metadata and CI context

Metadata is not decoration; it answers “which build/environment failed?” Common
fields in public configs: project/app, release/version, environment, branch,
commit, merge/pull request, build/job URL, browser, device, platform, execution
time ([France Connect](https://github.com/france-connect/sources/blob/main/quality/scripts/multiple-cucumber-html-reporter.ts),
[ProConnect](https://github.com/proconnect-gouv/federation/blob/main/quality/scripts/multiple-cucumber-html-reporter.ts),
[MCHR #14](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/14),
[chr #18](https://github.com/gkushang/cucumber-html-reporter/issues/18)).

Recommendations:

- Keep the compact run line above the fold: title, date, duration, feature and
  scenario counts, source, environment/producer.
- Keep arbitrary `--meta key=value` in Details; do not force every field into
  the header.
- Auto-detect a small allowlist of CI variables (GitHub, GitLab, Jenkins, Azure,
  Buildkite) for branch/commit/build URL. Do not dump the environment; that is
  a privacy and layout risk.
- Escape metadata and cap long values; MCHR has layout bugs from long custom
  data ([MCHR #289](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/289)).
- Show the producer/runtime/OS block in Details, as Tolkira already does; it is
  useful for reproducing a failure but not for the first screen.

### 4.5 Single-file sharing and embedding

Single-file is validated repeatedly, but it is a delivery constraint rather
than a differentiator on its own:

- MCHR users asked for one file to “open directly inside the browser”, email and
  Slack it ([MCHR #190](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/190));
  the request was repeated in 2023 ([MCHR #556](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/556)).
- Folder reports break in Azure/Jenkins viewers; users write merge scripts
  ([MCHR #216](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/216)).
- Sandboxed iframes may block JavaScript and external assets
  ([fmt #535](https://github.com/cucumber/html-formatter/issues/535)); Azure’s
  CORB bug is the same failure with screenshots
  ([proposal](https://github.com/maciejmaciejewski/azure-pipelines-cucumber/blob/master/openspec/changes/archive/2026-07-31-fix-screenshot-corb-inline-fetch/proposal.md)).
- CDN-dependent charts broke when a report was shared through Jenkins
  ([chr #71](https://github.com/gkushang/cucumber-html-reporter/issues/71)).

Tolkira’s no-CDN, inline, no-telemetry model is the right response. Two additions
matter for this audience:

- **No-JS baseline.** Core content, summary, feature/scenario/step text and
  attachments should be readable without JavaScript; search/filter can be the
  enhancement. `details`/`summary` already gives this for free. This makes the
  report usable in strict sandboxed iframes and email-like viewers.
- **Embedding test.** Verify `iframe.srcdoc`, `file://`, an artifact download and
  a CSP-restricted viewer. Avoid top-window assumptions, external fonts and
  relative asset URLs. Keep a stable output path and the JSON summary for CI.

For very large media, the escape hatch is an external-assets mode, not a bigger
inline file. Keep it opt-in and document the trade-off.

### 4.6 Retries and parallel runs

- Keep the current latest-attempt selection so retries do not inflate totals.
- Show “Attempt N” (already present) and, later, a disclosure of earlier
  attempts with their status. Users want to see that a test failed then passed,
  not just the final green row ([MCHR #217](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/217)).
- Make the final status and counts unambiguous: a passing retry is a pass, but
  the report should not hide that it was flaky.
- Continue merging multiple inputs/shards; large parallel runs are where the
  old reporters break ([MCHR #595](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/595),
  [chr #102](https://github.com/gkushang/cucumber-html-reporter/issues/102)).

### 4.7 What not to build (evidence is thin)

- **History/trends dashboard as the default.** MCHR and Allure invest here, but
  the reviewed threads are dominated by failure inspection and report size. A
  history file is a reasonable later feature, not the first screen.
- **PDF export.** The public request is a single stale MCHR issue
  ([#101](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/101));
  Seed-Test does PDF in the host app with jsPDF. Thin evidence for core.
- **i18n/RTL.** MCHR supports five languages, but public issue demand is thin.
  Defer until a specific market or customer requires it.
- **Video/trace viewer.** Video/HAR attachments are real
  ([fmt #282](https://github.com/cucumber/html-formatter/issues/282)), but a
  trace viewer is a large product of its own. External attachment storage comes
  first.
- **Live/progress reporting.** The official formatter thread explicitly rejects
  partial-report rendering as a hack with ordering and partial-run risks
  ([fmt #120](https://github.com/cucumber/html-formatter/issues/120)). Do not
  build it.
- **Plugin marketplace / deep custom themes.** Branding (logo, title, accent)
  is enough for the observed consultancy use; a theme system is not a proven
  pain.
- **Test management, SaaS integrations, AI analysis, telemetry.** Out of scope
  and against the product promise.

## 5. Ranked product needs

Ranked by strength of public evidence × severity × fit with Tolkira’s one-file
model.

1. **Screenshot and attachment fidelity.** Preserve every attachment, multiple
   per step, with thumbnails, lightbox, text/JSON/log rendering and a size
   guard. This is the largest concrete issue cluster:
   [chr #84](https://github.com/gkushang/cucumber-html-reporter/issues/84),
   [chr #232](https://github.com/gkushang/cucumber-html-reporter/issues/232),
   [chr #263](https://github.com/gkushang/cucumber-html-reporter/issues/263),
   [MCHR #382](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/382),
   [MCHR #413](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/413),
   [fmt #281](https://github.com/cucumber/html-formatter/issues/281).
2. **Failed-first triage with transparent search/filter.** Failed scenarios and
   their features first; passed rows collapsed; search opens a bounded set and
   says how many matches are expanded; status/tag filters preserve the failure
   focus. Evidence:
   [chr #147](https://github.com/gkushang/cucumber-html-reporter/issues/147),
   [chr #154](https://github.com/gkushang/cucumber-html-reporter/issues/154),
   [MCHR #141](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/141),
   [fmt #49](https://github.com/cucumber/html-formatter/issues/49).
3. **Single-file portable and embeddable report.** No CDN, inline assets,
   offline, iframe/`srcdoc`-safe, no-JS baseline, stable path, JSON summary.
   Evidence:
   [MCHR #190](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/190),
   [MCHR #556](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/556),
   [MCHR #216](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/216),
   [fmt #535](https://github.com/cucumber/html-formatter/issues/535),
   [Azure CORB fix](https://github.com/maciejmaciejewski/azure-pipelines-cucumber/blob/master/openspec/changes/archive/2026-07-31-fix-screenshot-corb-inline-fetch/proposal.md),
   [Seed-Test iframe](https://github.com/adessoSE/Seed-Test/blob/master/frontend/src/app/report/report.component.ts).
4. **Metadata and CI context.** Compact run metadata, arbitrary custom fields,
   safe CI auto-detection, escaped long values. Evidence:
   [chr #18](https://github.com/gkushang/cucumber-html-reporter/issues/18),
   [MCHR #14](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/14),
   [MCHR #82](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/82),
   [MCHR #333](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/333),
   [fmt #106](https://github.com/cucumber/html-formatter/issues/106),
   [France Connect config](https://github.com/france-connect/sources/blob/main/quality/scripts/multiple-cucumber-html-reporter.ts).
5. **Retry-aware and parallel-correct results.** Do not double-count attempts;
   show final status and attempt count; expose earlier attempts later; keep
   multi-input merging correct. Evidence:
   [MCHR #221](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/221),
   [MCHR #217](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/217),
   [chr #237](https://github.com/gkushang/cucumber-html-reporter/issues/237),
   [fmt #283](https://github.com/cucumber/html-formatter/issues/283),
   [MCHR #595](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/595).

## 6. Weak evidence and open questions

- **Failure density:** unknown. No public distribution; bug reports overrepresent
  failing runs. Design for all-green and all-red.
- **Search/filter usage:** unknown. No telemetry. Demand is documented; actual
  frequency is inferred from large-run complaints.
- **Report-size distribution:** unknown. The examples above are self-selected
  bug reports, not a sample.
- **PDF, i18n, trends, video/trace:** weak or niche in the reviewed public
  threads. Absence of complaints is not proof of absence of demand, but it is
  not enough to prioritize them over the five needs above.
- **Stakeholder use:** the QA-lead segment is supported by product investment
  (dashboards, metadata, emailable reports) more than by direct quotes.
- **Tolkira adoption:** 713 downloads in its launch month is too early to read
  as demand. The package is new (0.1.2, 2026-11-04).

Useful next research, without telemetry: short interviews with 5–10 users across
the segments above; opt-in feedback from the CLI; issue-label analysis after the
first external reports; and a synthetic large-run benchmark with realistic
screenshot counts. Do not instrument the report.

## 7. Sources

Package and repository data (accessed 2026-11-09):

- [cucumber-html-reporter](https://github.com/gkushang/cucumber-html-reporter) ·
  [npm](https://www.npmjs.com/package/cucumber-html-reporter) ·
  [issues](https://github.com/gkushang/cucumber-html-reporter/issues)
- [multiple-cucumber-html-reporter](https://github.com/WasiqB/multiple-cucumber-html-reporter) ·
  [npm](https://www.npmjs.com/package/multiple-cucumber-html-reporter) ·
  [issues](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues)
- [cucumber/html-formatter](https://github.com/cucumber/html-formatter) ·
  [npm](https://www.npmjs.com/package/@cucumber/html-formatter) ·
  [issues](https://github.com/cucumber/html-formatter/issues)
- [tolkira](https://www.npmjs.com/package/tolkira)

Public integrations and CI examples:

- [Seed-Test reporting.ts](https://github.com/adessoSE/Seed-Test/blob/master/backend/src/helpers/reporting.ts) ·
  [report component](https://github.com/adessoSE/Seed-Test/blob/master/frontend/src/app/report/report.component.ts) ·
  [package.json](https://github.com/adessoSE/Seed-Test/blob/master/backend/package.json)
- [Azure Pipelines Cucumber task](https://github.com/maciejmaciejewski/azure-pipelines-cucumber) ·
  [tab.html](https://github.com/maciejmaciejewski/azure-pipelines-cucumber/blob/master/tab.html) ·
  [CORB proposal](https://github.com/maciejmaciejewski/azure-pipelines-cucumber/blob/master/openspec/changes/archive/2026-07-31-fix-screenshot-corb-inline-fetch/proposal.md)
- [France Connect MCHR script](https://github.com/france-connect/sources/blob/main/quality/scripts/multiple-cucumber-html-reporter.ts) ·
  [ProConnect MCHR script](https://github.com/proconnect-gouv/federation/blob/main/quality/scripts/multiple-cucumber-html-reporter.ts)
- [BIBSYSDEV official formatter script](https://github.com/BIBSYSDEV/NVA-end-to-end-testing/blob/test-deploy/scripts/cucumber_report.mjs)
- [Cypress + MCHR workflow](https://github.com/yarreaza/cypress-cucumber-reportes-html/blob/main/.github/workflows/main.yml) ·
  [Cucumber Ruby + chr workflow](https://github.com/srbarrios/cucumber-ruby-skeleton/blob/master/.github/workflows/capybara.yml) ·
  [Cypress + MCHR + gh-pages](https://github.com/AZANIR/cypress-cucumber/blob/master/.github/workflows/cypress-cucumber.yml) ·
  [WDIO + chr](https://github.com/AndriiZhydkykh/wdio-cucumber--html-report/blob/master/.github/workflows/wdio.yml)
- [WDIO MCHR service](https://github.com/wswebcreation/wdio-multiple-cucumber-html-reporter) ·
  [Playwright-BDD reporter docs](https://github.com/vitalets/playwright-bdd/blob/main/docs/reporters/cucumber.md) ·
  [Godog README](https://github.com/cucumber/godog/blob/main/README.md)

Stack Overflow examples (view counts are historical, not current usage):

- [Cucumber HTML report with Protractor](https://stackoverflow.com/questions/25115272/cucumber-html-report-with-protractor) — 23,971 views
- [Send cucumber index.html report to email](https://stackoverflow.com/questions/53041081/send-cucumber-index-html-report-to-email) — 8,089 views
- [Attach screenshot to cucumber-html-reporter using cucumber-tsflow and protractor](https://stackoverflow.com/questions/58240414/attach-screenshot-to-cucumber-html-reporter-using-cucumber-tsflow-and-protractor) — 7,852 views
- [Screenshot function times out](https://stackoverflow.com/questions/40423453/function-to-take-screenshots-for-cucumber-html-reporter-generates-function-timed-out) — 5,807 views
- [Report not fully displaying in Jenkins HTML Publisher](https://stackoverflow.com/questions/66635638/report-is-not-fully-displaying-while-using-html-publisher-plugin-in-jenkins) — 3,896 views
- [Cucumber reports overwritten by new feature file](https://stackoverflow.com/questions/41423710/cucumber-reports-getting-overwritten-when-a-new-feature-file-is-executed) — 4,201 views
- [Custom metadata in MCHR](https://stackoverflow.com/questions/54386071/how-to-set-custom-meta-data-for-feature-at-multiple-cucumber-html-reporter) — 2,406 views
- [Karate report inaccessible in Azure DevOps](https://stackoverflow.com/questions/71602858/the-system-path-generated-cucumber-karate-html-report-is-not-accessible-in-azure) — 406 views

Internal context:

- `docs/PRODUCT.md` — audience, jobs, scope and non-goals.
- `docs/research/reporter-compatibility.md` — legacy/Messages compatibility and
  input/attachment caps.
- `docs/research/report-tools.md` — competitor feature comparison.
- `src/render/html.ts` — current default-open and search-cap behavior.
