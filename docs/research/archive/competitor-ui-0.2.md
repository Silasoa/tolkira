# Competitor UI comparison — Tolkira 0.2

Research note, 2026-11-05. Read-only for tracked files. No release is
authorised. The 0.2 UI is unreleased work at `HEAD 7d05c94`; the package
version is still 0.1.2.

Scope: the first screen and triage path of the unreleased 0.2 report against
the current public UIs of the official Cucumber HTML formatter,
multiple-cucumber-html-reporter, Allure 3, the Playwright HTML report and
pytest-html. One health/observability surface (Grafana or Sentry) was checked
only for a distinct pattern; the result is recorded at the end.

Method: official documentation, GitHub READMEs, public live demos and
screenshots, plus locally generated reports where a current public screenshot
was not available. Competitor screenshots were not committed. The links below
point to the public sources.

Limits:

- This is a pattern comparison, not a controlled experiment on identical data.
- Screenshots are snapshots; Allure's public demo reports version 3.16.0 while
  npm current is 3.22.1.
- No formal WCAG audit was run on any tool. The accessibility row describes
  observable semantics and public documentation, not conformance.
- The Tolkira numbers are from one 22-scenario sample, not a scale test.

Status: the failure reason in the triage index, total run duration, focus
handoff and mobile compact mode were implemented after this capture. The
competitor comparison remains valid; the phone toolbar and sticky toolbar are
still open.

## Our 0.2 first screen

Generated from four legacy fixtures to exercise mixed statuses and screenshots.
The four fixtures share `features/happy.feature`, so this sample has no source
strip; the provenance path is covered by the distinct-URI fixtures in the UX
capture.

```text
node dist/cli.js \
  test/fixtures/legacy/failed.json \
  test/fixtures/legacy/unhappy.json \
  test/fixtures/legacy/screenshot.json \
  test/fixtures/legacy/happy.json \
  --out docs/ui-loop/review-ux-0.2/competitor-context/tolkira-0.2-report.html \
  --title "Checkout acceptance" \
  --meta "Environment=staging" \
  --meta "Release=2026.11.0" \
  --meta "Branch=main"
```

Result: 4 features, 22 scenarios, 81.8% passed (18 passed, 1 failed, 1 pending,
2 undefined). First feature: “Happy HTML reporting”, 5 of 6 passed, 1 failed.
First error: `Expected values to be strictly equal: -8 !== 0`.

Captures (gitignored, not committed):

- `docs/ui-loop/review-ux-0.2/competitor-context/tolkira-0.2-first-screen-1440x900.png`
- `docs/ui-loop/review-ux-0.2/competitor-context/tolkira-0.2-first-screen-390x844.png`
- `docs/ui-loop/review-ux-0.2/competitor-context/tolkira-0.2-report.html`

First-screen measurements:

| Viewport | Toolbar | “Needs attention” | First feature | First failed scenario | First error |
| --- | --- | --- | --- | --- | --- |
| 1440×900 | top 229, h 69 | top 318, h 285 | top 628 | top 779 | top 979 |
| 390×844 | top 370, h 191 | top 581, h 422 | top 1027 | top 1186 | top 1427 |

At 1440 the first screen shows the pass rate, run metadata, the triage index
and the failed feature/scenario. The error is 79 px below the 900 px fold. At
390 the first failure link is visible at y≈715, but the error is far below the
fold and the first feature does not start until y≈1027. The toolbar alone
takes 191 px on the phone.

No horizontal overflow was measured at either size (390 viewport: 375 scroll
width; 1440 viewport: 1425 scroll width).

## Comparison matrix

| Surface | First screen at 1440 | Hierarchy | Status encoding | Filters / triage | Failure path | Metadata | Scale | Accessibility | Single-file / offline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Tolkira 0.2** (unreleased, `7d05c94`) | Title, run meta, 81.8% health, counts, search/tag/status controls, “Needs attention” index, first failed feature and open scenario | Feature → scenario → step; exception-first; triage index; Details tab with feature-by-status matrix | Text pills (failed red, passed green, pending amber, undefined purple), counts, proportion bars; not colour-only | Free text, tag select, status toggles with counts, expand/collapse; triage capped at 5 shown / 20 total; triage hides while filtering | Failed feature/scenario first and open; failing step and error below the fold on 900 px; inline screenshots; “Copy failure” | Title, date, features/scenarios, source, arbitrary `--meta`, environment in Details; no total duration on the first screen; no automatic CI/commit link | 1k/3k ≈ 0.15–0.2 s, 1.4 MB; 5k/15k ≈ 0.4–0.5 s, 7 MB (project baseline); triage cap; no virtualisation | Semantic headings, `details`/`summary`, `aria-pressed`, `aria-live`, focus-visible, text status; jump links do not move focus; no formal WCAG audit | One HTML file by default; inline assets; CSP; no network, no telemetry |
| **Official Cucumber HTML Formatter** 24.2.0 | 71.4% (5/7), duration, CI/commit/branch strip, search, Passed/Failed filters, “Scenarios” list with inline detail | Feature file → feature → scenario outline/examples → steps and hooks; expanded document order | Green check/red cross icons, text filter pills with counts, red error blocks | Search by text or `@tags`; Passed/Failed pills; no visible tag dropdown or sort control, no triage index, no explicit exception-first order | Failures stay in document order; filter to failed; error block with copy affordance | Pass rate, duration, CI/commit/branch; no arbitrary metadata (open request #106) | Embeds the whole messages stream; open issues for heavy attachments and report size (#281, #414); one file | Native search/filter controls, text labels; no public WCAG statement | One HTML file; inline assets; no CDN |
| **multiple-cucumber-html-reporter** 4.5.0 | Dashboard: title, metadata band, three donuts, device/browser/tag charts, status trend; feature list below the fold | Dashboard → feature list → separate feature detail pages; multi-run | Coloured donuts, bars, pass-% rings, counts; text legends | Feature search, tag filter, show-N, pagination; scenario search/tag/status on detail; no global triage index | Charts first; click feature → detail; failed scenario is not promoted (demo: 7th of 10) | Very rich: project/release, test cycle, build, environment, CI, user, Node, arch, browser/device/platform; custom data | Streams generation, pagination, multi-run; folder/assets; single-file still planned (#190 closed as duplicate; maintainer says planned) | Dark mode, i18n/RTL; charts depend on colour and legend; no public WCAG statement | Folder/static site; not one file |
| **Allure 3** 3.22.1 (demo 3.16.0) | Report title/date/duration, 85.18% donut, tabs (Results, Categories, Quality Gates, Global Attachments, Global Errors), counts, search, Retry/Flaky/Transition/Categories, status chips, sort, suite tree | Environment → suite → file → describe → test; categories; retries; history | Coloured icons/badges, count bubbles, text labels, status chips | Strong: search, status chips, retry/flaky/transition/categories/severity/resolution, sort, environment selector; no “needs attention” index | Click a tree row → test detail with steps, error, attachments, history/retries; failures not globally promoted by default | Report id, environment, generated time, version; environments, categories, quality gates, global attachments/errors; history | Default static site + local server; single-file via Awesome `--single-file` (docs warn for huge projects); history/trends | Theme toggle, text labels, tree controls; charts; no public WCAG statement | Folder + `allure open` by default; single-file opt-in |
| **Playwright HTML** 1.64.1 | Search, All/Passed/Failed/Flaky/Skipped filters, timestamp/total time, file-grouped test list; no title by default | File → describe → test; flat list; detail panel | Coloured icons and text filters; failed row red | Search, status filters, project filter; no triage index | Failed test first within its file (observed locally); click for error/steps/attachments/trace; no inline error on the list | Optional title, timestamp, total time; no environment metadata by default (requests #31415, #35178) | Folder + data files served by `show-report`; sharding/merge; not one file | Keyboard controls, text status; title optional; no public WCAG statement | Folder + local server; not one file |
| **pytest-html** 4.2.0 | Title (report filename), generated-by line, Environment table, summary counts, status checkboxes, results table; failed row expanded with traceback | Flat `file::test` rows; no feature/scenario hierarchy; collapsible rows | Coloured text and row tint; counts; checkboxes | Status checkboxes, show/hide all, query parameters for visible/collapsed/sort; no free-text search, no tags | Failed row first (observed), traceback inline; extras/links per row; no step hierarchy | Environment table: Python, platform, packages, plugins, environment variables, custom metadata; no CI link | One HTML table with all rows; no pagination/virtualisation observed | Semantic table, checkbox filters; plain styling; no dark-mode control observed; no public WCAG statement | Single file only with `--self-contained-html`; default assets separate |

## Where 0.2 is genuinely better, equal or worse

### vs official `@cucumber/html-formatter`

**Better**

- The “Needs attention” index and exception-first order answer “what needs
  attention” before the reader parses a feature list. The official formatter
  has status filters but no triage index or explicit failure promotion.
- Arbitrary run metadata and feature proportion bars are on the first screen.
  Source provenance is available when the inputs have distinct URIs; this
  sample does not, so it renders no source strip. The official formatter shows
  CI/commit/branch but has no arbitrary metadata path (#106).
- Legacy JSON input and one command without a Messages pipeline. The official
  formatter is Messages-only.
- 0.2 has a verified 390 px first screen; the official formatter's mobile
  behaviour was not verified in this pass.

**Equal**

- Single HTML file, inline assets, offline use.
- Search, status filters, inline screenshots/attachments, step detail.
- Pass-rate header and per-scenario durations.

**Worse**

- Gherkin fidelity: scenario outlines/examples and hooks are presented more
  faithfully by the official React components.
- Default integration: the official formatter is bundled into cucumber-js,
  cucumber-jvm, cucumber-ruby and Reqnroll; a Messages user gets it for free.
- CI context in the demo header: it shows CI, commit and branch; Tolkira only
  shows those when passed as `--meta`.

### vs multiple-cucumber-html-reporter

**Better**

- One file by default. MCHR produces a folder and still has single-file as a
  planned feature.
- Failure-first first screen. MCHR's first screen is a metadata band and chart
  wall; at 900 px the feature list is below the fold, and the feature detail
  puts charts above the scenario list.
- Lighter artifact and no CDN/asset folder. No chart library weight.
- The triage index is a direct answer to “what failed now”; MCHR answers
  “what does the run look like overall”.

**Equal**

- Branding (title, logo, accent), custom metadata, search/filter, screenshots,
  dark mode (Tolkira follows the system; MCHR has a toggle).
- Legacy JSON and Messages input.

**Worse**

- Dashboard, trends, multi-run comparison and historical charts.
- Structured metadata display and breadth (browser, device, platform, build,
  CI, machine, report version).
- i18n/RTL, emailable report, streaming generation for very large attachment
  sets, and the wider framework integration catalogue.
- Duration analytics: MCHR shows slowest scenarios/steps and tag charts;
  Tolkira shows per-step and per-scenario durations but no aggregate duration
  view on the first screen.

### vs Allure 3

**Better**

- One file by default and no local server. Allure's default is a directory
  served by `allure open`; single-file is an Awesome-plugin option and the docs
  warn about huge projects.
- Failure-first triage. Allure's first screen is a filterable suite tree; a
  failure is one filter/click away, not the organising principle.
- No history, storage service or telemetry is required. The report is the
  artifact.

**Equal**

- Search, status filtering, attachments, environment metadata, theme support,
  a single-file option (Allure opt-in, Tolkira default).
- Tree/detail navigation and a readable failure detail.

**Worse**

- History, retries, flaky detection, categories, quality gates, environments,
  timeline, global errors/attachments, CSV/metrics export.
- Filter depth (severity, resolution, transition, retry/flaky) and large-suite
  navigation.
- Test detail depth and the amount of context around a failure.

### vs Playwright HTML report

**Better**

- Pass rate, run metadata, feature/scenario hierarchy and a triage index on the
  first screen. Playwright's first screen is a sparse list with no title by
  default and no pass-rate summary.
- One file, no server, and a phone layout. Playwright produces a folder served
  by `show-report`.
- Cucumber/Gherkin semantics; Playwright is JS-test oriented.

**Equal**

- Failed-first intent: Playwright moves a failed test to the top of its file;
  Tolkira moves failed features/scenarios to the top.
- Search, status filters, detail-on-click, screenshots/attachments.
- Dark/light theme support (both follow the environment).

**Worse**

- Failure detail: trace viewer, DOM snapshots, network/console, retries,
  projects and sharding.
- Large-suite handling: folder + data files and a mature list UI have more
  headroom than a single HTML file with no virtualisation.
- Ecosystem and CI integration.

### vs pytest-html

**Better**

- Feature → scenario → step hierarchy, search, tag filter and a triage index.
  pytest-html is a flat `file::test` table.
- Pass rate, feature proportion bars and a compact first screen. pytest-html's
  Environment table takes the top of the page and its title defaults to the
  report filename.
- Phone layout and single-file default; pytest-html needs
  `--self-contained-html`.
- Cucumber semantics.

**Equal**

- Failed-first ordering and status filters.
- Inline failure detail (Tolkira's is below the fold on the sample; pytest-html
  expands the traceback immediately).
- Environment/custom metadata.

**Worse**

- Immediate “why”: pytest-html shows the traceback in the first screen;
  Tolkira's first error is at y≈979 on 1440 and y≈1427 on 390.
- Automatic environment detail for Python (packages, plugins, environment
  variables) is richer than Tolkira's generic key/value metadata.
- Simplicity and familiarity for Python teams; pytest-html is the default
  choice there.

## 3–5 concrete changes worth making

Ranked by expected value per unit of change. “Before release” means it is small
enough to consider for the held 0.2; “after release” means 0.2.x.

| Rank | Change | Value | Cost | When |
| --- | --- | --- | --- | --- |
| 1 | Put the first failure's reason in the triage index | High | S | Before release |
| 2 | Show total run duration in the header meta | Medium-high | XS | Before release |
| 3 | Make the phone first screen triage-first | High | S–M | Before release if mobile is a priority |
| 4 | Move focus to the target after a triage jump | Medium | XS | Before release (accessibility) |
| 5 | Keep search/filters available on long reports | Medium-high at scale | M | After release |

### 1. First failure's reason in the triage index

The first screen names the failure but not the reason. At 1440×900 the first
error is at y≈979; at 390×844 it is at y≈1427. pytest-html shows the traceback
immediately, and the official formatter shows error blocks inside the expanded
scenario.

Concrete shape: for the first failed scenario in each triage item, render the
failing step keyword and the first line of `step.message` (escaped, truncated
to roughly 120 characters) under the scenario link, or add a single “First
failure” line above the triage list with feature › scenario › step › error.
Keep the existing “Copy failure” action in the detail.

Acceptance: at 1440 and 390 the first error excerpt is inside the first
viewport; long messages truncate; HTML in the message stays escaped; no new
network or data source.

### 2. Total run duration in the header meta

All five competitors show total duration on the first screen: official
formatter (“in 0.06 seconds”), Allure (“2m 27s”), MCHR (execution period),
Playwright (“Total time”), pytest-html (“5 tests took 396 ms”). Tolkira only
shows it in Details.

Concrete shape: add `durationLabel(model.durationMs)` as one more `<span>` in
the `.meta` line of `renderReportView` (`src/render/html.ts`). Reuse the
existing formatter; no new model field.

Acceptance: duration appears at 1440 and 390, wraps without overflow, and
handles 0 ms and multi-minute values.

### 3. Make the phone first screen triage-first

At 390×844 the toolbar is 191 px and “Needs attention” does not start until
y≈581. The first failure link is visible, but the first feature starts at
y≈1027 and the error is far below. The phone first screen is mostly chrome.

Concrete shape: at narrow widths, either move the triage block above the
toolbar with CSS order, or collapse the toolbar to a search field plus a
“Filters” disclosure showing the active count. Keep search visible; put tag,
status and expand controls behind the disclosure. Desktop order can stay as is.

Acceptance: at 390 the first failure link is above y≈600; at 320 and 200% text
zoom there is still no horizontal overflow; the filter state remains visible
when active.

### 4. Move focus to the target after a triage jump

`revealHash` opens ancestor `<details>` and calls `scrollIntoView()`, but it
leaves focus on the triage link. Keyboard and screen-reader users do not get
moved to the newly opened scenario.

Concrete shape: after opening the ancestors, set `tabindex="-1"` on the target
(or its summary), call `focus({ preventScroll: true })`, then scroll. Keep the
hash and the existing open behaviour.

Acceptance: activating a triage scenario link moves focus to the scenario
summary and the next Tab continues inside that scenario; no focus trap.

### 5. Keep search/filters available on long reports

At 5k scenarios the toolbar scrolls away with the run header. Competitors keep
the filter surface close to the list: Allure's results pane keeps its
search/filter area fixed (verified: the search box stayed at y=84 after a
500 px scroll), and Playwright's filters sit at the top of the report. Without
a sticky control, a reader deep in a 7 MB report must scroll back to the top
to filter.

Concrete shape: make `.toolbar` sticky below the topbar on wide screens, or
add a compact sticky bar after the first scroll. Keep the height small and
ensure anchor jumps from triage do not land underneath it.

Acceptance: at 1024 and 1440 the toolbar remains usable after scrolling; no
overlap with the first feature row after a triage jump; no layout shift at 390.

Minor visual note, not ranked: the open failed scenario row uses
`--accent-soft` (beige) as its open state. With a red “Failed” pill inside, the
row can read as selected or warning rather than failed. A neutral open state,
or `--fail-soft` for failed rows, would make the status encoding cleaner.

## What not to copy

- **Dashboard-first composition** (MCHR, Allure dashboard). Charts and metadata
  before the failure path push the answer below the fold. The product promise
  is “what failed and why” in under thirty seconds, not an executive dashboard.
- **History, trends, quality gates, categories and storage** (Allure). These
  need persisted runs or a service and conflict with one file, no server and no
  telemetry. A future optional history file is a separate change.
- **Folder plus local server** (Playwright, Allure default, MCHR). The artifact
  must remain one file that opens from a ticket or CI upload.
- **Trace viewer, DOM snapshots, video and network logs** (Playwright). These
  are the right tools for a JS test runner, but they explode the file size and
  require a runtime. Screenshots remain the attachment that fits the contract.
- **Embedding the raw Messages stream** (official formatter). Open issues
  #281 and #414 show the size cost. Tolkira already renders a view model; do
  not regress to raw-stream embedding.
- **Environment table before the results** (pytest-html). It is useful data,
  but it delays the failure. Keep metadata compact and move the full
  environment to Details.
- **Emailable/separate report** (MCHR). Another artifact and another output
  path; it conflicts with the one-file promise.
- **CDN assets, remote fonts, Bootstrap/jQuery/Google Charts.** They break
  offline use and the CSP posture.
- **Telemetry, event counts, user impact, assignee/alerting** (Sentry,
  Grafana). These require a live event stream and a backend. A static test
  report has no honest source for them.
- **Default failed-only view** (the old `cucumber-html-reporter` pattern). It
  hides passes and breaks the first question, “did everything pass?”. The
  triage index plus status filters gives the same focus without hiding the run.

## Health/observability surface: why it is not a column

Grafana was checked for dashboard patterns. It duplicates what MCHR and Allure
already show (charts before the list) and adds no distinct report pattern.

Sentry's issue detail does add a distinct triage vocabulary: event count, first
seen, last seen, users affected, tags, assignee and alerting. Every one of
those signals depends on a live event stream, a backend and history. A
one-file, no-telemetry report cannot populate them honestly. It was excluded
rather than added as a column of “not applicable”.

## Sources

Official Cucumber HTML formatter:

- README: https://github.com/cucumber/html-formatter
- Example report screenshot:
  https://github.com/cucumber/html-formatter/blob/main/javascript/test/__screenshots__/examples-tables.png
- Metadata request: https://github.com/cucumber/html-formatter/issues/106
- External attachments: https://github.com/cucumber/html-formatter/issues/281
- Report size / embedded stream: https://github.com/cucumber/html-formatter/issues/414

multiple-cucumber-html-reporter:

- README: https://github.com/WasiqB/multiple-cucumber-html-reporter
- Documentation: https://multiple-cucumber-html-reporter.com/docs
- Feature list screenshot:
  https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/docs/public/images/feature-list-page.jpeg
- Feature detail screenshot:
  https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/docs/public/images/feature-detail-page.jpeg
- Single-file request: https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/190

Allure 3:

- Documentation: https://allurereport.org/docs/v3/
- Single-file viewing:
  https://allurereport.org/docs/v3/view-report/#open-a-single-html-file
- Live Awesome report: https://allure-framework.github.io/allure3-demo/awesomeAll/
- Live dashboard: https://allure-framework.github.io/allure3-demo/dashboard/
- Overview image: https://allurereport.org/images/allure3_main_light.png

Playwright:

- HTML reporter documentation:
  https://playwright.dev/docs/test-reporters#html-reporter
- Metadata requests: https://github.com/microsoft/playwright/issues/31415,
  https://github.com/microsoft/playwright/issues/35178

pytest-html:

- Documentation: https://pytest-html.readthedocs.io/en/latest/user_guide.html
- Package: https://pypi.org/project/pytest-html/
- Repository: https://github.com/pytest-dev/pytest-html

Versions inspected:

| Tool | Version | Source date |
| --- | --- | --- |
| Tolkira 0.2 | unreleased, `7d05c94` | local build, 2026-11-05 |
| @cucumber/html-formatter | 24.2.0 | npm, 2026-09-28 |
| multiple-cucumber-html-reporter | 4.5.0 | npm, 2026-10-18 |
| Allure 3 | 3.22.1 (demo 3.16.0) | npm 2026-10-23; demo 2026-10-28 |
| Playwright | 1.64.1 | local install |
| pytest-html | 4.2.0 | PyPI, generated locally |
