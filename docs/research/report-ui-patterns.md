# Report UI patterns: hierarchy, status, navigation

Status: research note for the 0.2 overview; the shipped design is in
`openspec/changes/triage-first-report/`.
Date: 2026-11-04.

This note looks at how established test reports answer three questions on
open: **did the run pass, what failed, and where in the hierarchy is it?**
It covers first-screen composition, status encoding, navigation, scale and
accessibility, then proposes a default compact overview plus optional map/tree
modes for Tolkira.

No production code, tests, CI, README or `package.json` were changed. The only
new project file is this note.

## Method and evidence

Primary sources only: official documentation, READMEs, current public demo
reports, and source where the docs do not describe the UI.

I also generated small local reports from pass/fail/skip fixtures to see the
current default first screen rather than relying on old screenshots:

- Playwright `@playwright/test` 1.64.1
- pytest-html 4.2.0
- jest-html-reporter 4.4.3
- jest-html-reporters 3.1.7

MCHR 4.5.0 is covered through its current README screenshots; Allure 3 through
its docs and live demo. Cypress is covered through its reporter docs and the
`cypress-mochawesome-reporter` example report.

Caveats:

- The Allure live demo footer reports **3.16.0** while npm lists 3.22.1. Claims
  below are limited to elements visible in the demo and described in the
  current docs.
- MCHR's public README screenshots are used as-is; the version is the current
  4.x line.
- "First screen" means the view at report open, before any row is clicked.
- No performance benchmark was run. Scale notes are based on documented
  behaviour, source structure, and published issue reports.

## Key conclusions

- **The default view should be an exception-first list, not a dashboard.**
  Every tool that puts charts first (MCHR, jest-html-reporters) pushes the
  failed path below the fold. The strongest first screens (Playwright,
  Mochawesome, pytest-html's results table) keep counts and failures in the
  first screenful.
- **Status filters with counts are the highest-value control.** They set
  expectations, make the failure set one click away, and work without a
  client-side data store.
- **A single honest hierarchy beats a mode picker.** Run → Feature → Scenario
  → Step is enough for Cucumber input. A tree is useful as an optional view,
  not as the landing screen; a group level should exist only when the input
  provides one.
- **Aggregate status at group level.** A feature row needs counts, a proportion
  bar and a text status; otherwise the reader has to open scenarios to learn
  where the run is unhealthy.
- **Progressive disclosure is mandatory at scale.** Failed rows open; passed
  rows collapse; steps, stack traces and attachments live in one detail
  surface.
- **One-file/offline rules out several good ideas.** Per-file lazy JSON,
  `show-report`/`allure open`, separate feature pages, CDN assets and external
  attachment URLs all improve their own products but conflict with Tolkira's
  artifact.
- **Accessibility is where most reports are weakest.** Per-row status is often
  icon-only, and icon-only controls frequently lack names. Text status labels,
  labeled controls, 320 px support and 200 % zoom are non-negotiable.

## At a glance

| Tool | Default first screen | Hierarchy | Status encoding | Navigation | Scale note |
| --- | --- | --- | --- | --- | --- |
| Playwright HTML | Status nav with counts, search, report date/duration, collapsible file groups, test rows | File (suite) → test path → steps in detail; no run/feature entity | Icon + text + count in nav; icon only per row; distinct flaky | Status filters, search tokens, keyboard, deep links, prev/next | Per-file data loaded on demand; files collapse after 200 visible tests |
| MCHR | Dashboard: metadata, three donuts, device/browser bars, tags, trend, feature table | Feature → scenario accordion → step; no suite/group | Six Cucumber statuses; donuts, count chips, status pills, stacked bars with counts | Feature search/tag/pagination; scenario search/tag/status pills | Streams generation; paginated feature table; detail list is not paginated |
| Allure 3 | Results tab: pass ring, top tabs, status counts, search, filters, sort, tree | Environment → configurable suite/behavior/package tree → test → step | Five statuses; colored pills with labels/counts; group mini-bars | Tabs, tree, search, status/tag/severity/category/environment filters, sort | Docs target hundreds/thousands; tree + filters; no virtualization claim |
| jest-html-reporters | Dashboard cards, timing chart, Details table | Suite/file → test; collapsible groups | Counts/percentages, per-suite status numbers, text | Expand/collapse, merge data, Info; no global search/filter in default report | Single page; known slow at 25k tests / heavy DOM |
| jest-html-reporter | Summary boxes, suite headers, status-colored rows, inline failure | Suite/file → describe → test; no steps | Full-row background color + status text | Config-level sort/status filter/collapse; no in-page search | One page; collapse is the only scale control |
| pytest-html | Environment table, summary, status checkboxes, results table | Flat test table; module/class in test ID; no steps | Status text + color; counts; filters | Status checkboxes, sortable columns, collapse/expand, query params | One table; no search/pagination; 800 px minimum width |
| Cypress / Mochawesome | Header counts + proportion bar, suite cards, test rows, hook failures inline | Spec → suite → test → hooks/commands; no Gherkin feature | Counts + red/green bar; row icons; hook error text | Suite collapse, filters; Cypress Cloud run view | One page; per-spec reports must be merged; single-file options exist |
| CTRF / GitHub summary | Badge counts, summary table, grouped checks | Flat tests with file/suite metadata → test; steps optional | Text counts, check/cross badges | Annotations; no in-page filtering | Markdown only; 65,535-byte check-run cap; 1 MiB per job-summary step |
| Grafana (health dashboard) | Question-led summary, rows per service, drill-down | Dashboard → row/panel → detail | Threshold color + numeric value | Variables, links, drill-down | Built for aggregation, not per-test rows |

## 1. Playwright HTML report

**First screen.** A horizontal status nav is the first control:
`All 5`, `Passed 3`, `Failed 1`, `Flaky 1`, `Skipped 1`, then a search field.
Below it are the report date, total time and file groups. Each file is a
collapsible chip; each test row shows status icon, full path
(`Checkout › rejects an expired card`), file:line and duration. The report
title is empty unless configured. In the generated 1.64.1 report, `All`
excluded skipped tests (`total - skipped`), and the list opened with failed and
flaky rows before passed rows.

**Hierarchy.** A single run, then a file (the suite), then the test path
(`describe` segments + test title). Steps exist only in the test detail view.
`mergeFiles` can group by the top-level `describe` title instead of by file,
but it is one or the other. There is no first-class run, feature or story
entity.

**Status.** The nav uses icon + text + count, so it is readable without
color. Per-test rows use only the status icon; the link's title is the test
path, not "failed". Flaky is a separate outcome from failed, and skipped is
excluded from the default `All` view. Test detail has `Run` / `Retry #1` tabs,
then `Errors`, `Test Steps`, attachments and source snippets.

**Navigation and filtering.** Status links work as filters; the search field
accepts tokens such as `s:failed`. Keyboard shortcuts: `a` (all), `p`
(passed), `f` (failed), left/right arrows for previous/next test. The URL hash
contains the filter (`q=...`) and `testId`, so a failure is linkable. A
"speedboard" view sorts by duration.

**Scale.** Test-file data is loaded on demand through `report.entry(...)`;
the initial page does not hold every test's steps and attachments. Files
auto-expand only while the visible test count is below 200; after that they
start collapsed. This is a useful threshold idea, but the per-file fetch is
not compatible with a one-file report.

**Accessibility.** Good semantics: links and buttons, `role="list"` /
`role="listitem"` for test rows, `aria-current` on the selected test,
`aria-label="Search tests"`, and keyboard navigation. The weak point is
per-row status: the icon is the only status cue in the list, so a screen
reader gets the test name but not "failed" or "flaky". Some icon-only controls
rely on `title` rather than visible text.

**Worth stealing.** Status filters with counts; filter tokens plus deep links;
previous/next test navigation; the 200-test collapse threshold; the detail
tabs for attempts; a separate speedboard.

**Worth avoiding.** Folder + local server delivery; per-file lazy JSON; icon-
only status in rows; an `All` view that excludes skipped rows without stating
the rule.

Sources: [reporters docs](https://playwright.dev/docs/test-reporters#html-reporter),
[headerView.tsx](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/headerView.tsx),
[reportView.tsx](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/reportView.tsx),
[testFilesView.tsx](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/testFilesView.tsx),
[testFileView.tsx](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/testFileView.tsx).

## 2. multiple-cucumber-html-reporter (MCHR)

**First screen.** The current README's feature-list page is a dashboard, not a
test list. It shows a title, a metadata strip (project/release, test cycle,
build, environment, CI pipeline, execution period, user, Node version, report
version, machine arch), then three donuts (`Features`, `Scenarios`, `Steps`),
two stacked bars (`Device & OS`, `Browsers`), `Top 10 Tags`, a
`Features Status Trend` chart, and finally a `Features Overview` table. The
table has feature search, tag filter, page size (`Show 10`) and pagination;
each row has environment icons, a stacked step-status bar with text counts, and
a pass-percentage ring.

**Hierarchy.** Feature list → feature detail → scenario accordion → step. There
is no suite or group level. Multiple runs are merged into the report and appear
as a dimension of the feature (the screenshot appends `[CHROME]` / `[FIREFOX]`
to feature names) and as metadata, not as a tree level. The detail page has a
breadcrumb `Dashboard / Feature Detail`, count chips for all six statuses, the
feature description, metadata, a 3×2 chart grid, then the scenario list.

**Status.** Six Cucumber-oriented statuses: passed, failed, ambiguous, not
defined, pending, skipped. They are encoded redundantly: donut legends,
large count chips (`6 PASSED`, `1 FAILED`, ...), scenario filter pills, and the
feature row's step bar with counts underneath. That is strong for a Cucumber
audience because the vocabulary matches the producer. It is also a lot of
color and chrome.

**Navigation and filtering.** Feature search, tag dropdown, page size and
pagination; scenario search, tag dropdown, status pills and accordions. Deep
links and URL state are not visible in the screenshots. Generation is
multi-page: each feature is its own page in a report folder.

**Scale.** The README says report generation streams so suites with heavy
screenshot/video attachments do not run out of memory. The feature table is
paginated. The detail page still renders all scenarios in one list; I found no
scenario pagination or virtualization. Search and status pills help, but the
page grows with the feature.

**Accessibility.** Dark mode, localization and RTL are documented. Status chips
and the stacked bar carry text labels and counts, so status is not color-only.
The donuts and trend chart are visual summaries with no tabular alternative
that I could find; there is no published WCAG statement.

**Worth stealing.** Count chips with the six Cucumber statuses; status pills
above a scenario list; a feature table with search and pagination; a stacked
bar whose segments are also labeled with counts; the honest use of a run
dimension (browser) rather than inventing a suite.

**Worth avoiding.** Dashboard-first charts that push the feature table below
the fold; three donuts plus three bar charts plus a trend chart to say "2
features, 1 failed"; six status chips as the primary filter row; separate
pages per feature; a trend chart that only makes sense with multiple runs.

Sources: [README](https://github.com/WasiqB/multiple-cucumber-html-reporter#readme),
[docs](https://multiple-cucumber-html-reporter.com/docs),
[features list screenshot](https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/docs/public/images/feature-list-page.jpeg),
[feature detail screenshot](https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/docs/public/images/feature-detail-page.jpeg).

## 3. Allure 3

**First screen.** A report opens on the **Results** tab, not a separate
Overview. The header has the report name, timestamp, duration and a pass-rate
ring (`85.18%`). Below it are top-level tabs: `Results 54`, `Categories 2`,
`Quality Gates 0`, `Global Attachments 4`, `Global Errors 0`. The Results view
then shows `Total 54`, `New tests 54`, `Flaky`, `Retried`, `Failed 4`,
`Broken 2`, `Passed 46`, `Skipped 2`, a search field, filter menus
(`Retry`, `Flaky`, `Transition`, `Categories`; plus tags/severity in the docs),
status pills with counts, a sort control, and a tree.

**Hierarchy.** Environment is the outer grouping in the demo
(`ubuntu-latest`, `macos-latest`). Below it is a configurable hierarchy. Allure
supports behavior-based (`epic` → `feature` → `story`), suite-based
(`parentSuite` → `suite` → `subSuite`) and package-based (`package` →
`testClass` → `testMethod`) grouping. Groups show a miniature status bar and
counts; test rows show a step count and duration. Categories are a
cross-cutting view by error, not a hierarchy level. Test detail contains
steps, attachments, retries and history.

**Status.** Five statuses: passed, failed, skipped, broken, unknown. Broken is
a test/infrastructure defect rather than a product assertion failure; unknown
means the integration did not set a status. Status filters use colored pills
with text labels and counts, so they are not color-only at the control level.
The tree's group rows are read mainly through color and mini-bars; the test
row itself relies on the status icon.

**Navigation and filtering.** Search by test title; status, tag, severity,
category and environment filters; retry/flaky/transition marks; sort by order,
name, duration or status. A `?` keyboard-shortcut button is present. The tree
expands and collapses at every level. Tabs separate results from cross-cutting
quality concerns.

**Scale.** The docs explicitly target projects with hundreds or thousands of
tests and present trees as the answer. Filters and sorting are the main tools.
I found no virtualization claim; the demo is small (54 tests). Deep
configurable trees can also become a navigation problem: the demo nests
environment → package → test file → suite → parent suite → suite → sub-suite
before the first test.

**Accessibility.** Status pills have labels and counts. In the live demo,
several tree expand/collapse buttons are icon-only and reported without an
accessible name, and the layout toggle is also unnamed. I found no published
WCAG conformance statement. The pass-rate ring includes a number, which helps.

**Worth stealing.** Status pills with counts; cross-cutting Categories for
failure causes; group-level counts and a small status bar; a detail surface
that keeps steps, attachments and retries together; a report-level pass-rate
ring as a single number (not a chart wall).

**Worth avoiding.** Making a configurable tree or a group-by choice the
landing screen; many top-level tabs before the first failure; icon-only tree
controls; default folder/CLI delivery; charts as the main overview.

Sources: [Allure 3 docs](https://allurereport.org/docs/v3/),
[live demo](https://allure-framework.github.io/allure3-demo/awesomeAll/),
[navigation](https://allurereport.org/docs/v3/navigation/),
[sorting and filtering](https://allurereport.org/docs/sorting-and-filtering/),
[test statuses](https://allurereport.org/docs/test-statuses/),
[charts](https://allurereport.org/docs/v3/read-charts/).

## 4. Jest HTML reporters

These are two different projects with different defaults.

### jest-html-reporters 3.1.7

**First screen.** A header with the page title, then `Dashboard` cards:
`Test Suites Total`, `Tests Total`, `Failed Suites` (with percentage),
`Failed Tests`, `Pending Suites`, `Pending Tests`. Below that is an
`Information` bar chart (`Suite Time`, `Timing Ratio`) and a `Details` table
with `File`, `ExecTime`, `Status`, `Action`; `Show Execution Time` and
`Expand All` sit above it. The default report has no global search or status
filter; navigation is expand/collapse and the `Info` action.

**Hierarchy.** Suite/file → tests; test groups can be collapsed, and
"Merge Data" can merge rows at a configured level. There is no feature, story
or step hierarchy.

**Status.** Counts and percentages in cards; per-suite status numbers in the
table; text labels in expanded rows. The cards are useful as a run-level
inventory but do not say which failure matters.

**Navigation and filtering.** Expand/collapse, merge data, `Info`, and a
details table. There is no in-page search/status filter in the default report.
The report can be a single file with `inlineSource`, and supports console logs,
attachments and custom info.

**Scale.** This is a single-page report that renders every suite in the table.
Users have reported it slow at ~25k tests and sluggish with a heavy DOM
([#113](https://github.com/Hazyzh/jest-html-reporters/issues/113),
[#232](https://github.com/Hazyzh/jest-html-reporters/issues/232)). `expand`
controls initial expansion but does not add pagination or search.

**Accessibility.** It uses a table and an `aria-label="Expand row"` control.
The theme switch in the current report is icon-only and has no accessible
name. The `RootDir` and `File` values show absolute local paths
(`C:\Users\...`), which is both a privacy leak and noise for readers.

**Worth stealing.** The `inlineSource` single-file option, attachment and
console-log support, and the idea of a compact run inventory.

**Worth avoiding.** Dashboard cards and a timing chart before the test list;
absolute paths; no search/filter; rendering the entire suite table at once.

### jest-html-reporter 4.4.3

**First screen.** Page title and start time, two summary boxes (`Suites (1)`
and `Tests (5)`) with passed/failed/pending counts, then suite headers with
the absolute file path and duration, then test rows. Each row has a full-width
green, yellow or red background, the status word (`passed`, `pending`,
`failed`) and the duration; failure output is inline under the row.

**Hierarchy.** Suite/file → `describe` → test. There are no steps. Suite
accordions can be collapsed by default.

**Status.** Full-row background color plus a status word. The status word
means it is not color-only, but the color covers a large area and the
contrast of the colored rows is poor for long reading.

**Navigation and filtering.** No in-page search or filter. Sorting and status
filtering are configuration options (`sort`, `statusIgnoreFilter`,
`collapseSuitesByDefault`). This makes the report a snapshot, not an
investigation tool.

**Scale.** One page; `collapseSuitesByDefault` is the only large-suite aid.
No pagination, search or virtualization.

**Accessibility.** Status text is present, which is better than an icon-only
row. There are no interactive controls beyond the suite accordions. The
absolute path in the suite header leaks the local user name and directory
structure. I found no published accessibility statement.

**Worth stealing.** Inline failure output directly under the failing row; a
very small summary; the option to collapse suites.

**Worth avoiding.** Full-row status coloring; absolute paths; a report with no
search or filter; treating configuration as navigation.

Sources: [jest-html-reporters README](https://github.com/Hazyzh/jest-html-reporters#readme),
[live demo](https://hazyzh.github.io/report.html),
[jest-html-reporter README](https://github.com/Hargne/jest-html-reporter#readme).

## 5. pytest-html

**First screen.** The generated 4.2.0 report opens with the title and
generation timestamp, then the **Environment** table (Python, platform,
packages, plugins, `JAVA_HOME`), then `Summary` (`4 tests took 494 ms`), a row
of status filter checkboxes with counts (`1 Failed`, `3 Passed`, `1 Skipped`,
`0 Expected failures`, `0 Unexpected passes`, `0 Errors`, `0 Reruns`,
`0 Retried`), `Show all details` / `Hide all details`, and the results table
(`Result`, `Test`, `Duration`, `Links`). Failed rows are expanded by default;
passed rows are collapsed.

**Hierarchy.** A flat table. Module and class appear only inside the test ID
(`test_demo.py::TestCheckout::test_adds_item`). There is no suite grouping and
no step level.

**Status.** Status text plus color in the `Result` column; counts in the
filter row; extra statuses for expected failure, unexpected pass, error and
rerun. This is a richer status model than Cucumber and would not map directly.

**Navigation and filtering.** Status checkboxes, sortable columns, collapse/
expand, and URL query parameters: `?visible=passed,skipped`,
`?collapsed=Passed,XFailed`, `?sort=result|testId|duration|original`. There is
no free-text search.

**Scale.** One table with every test row. No pagination or search; the docs
offer only collapse and visibility query parameters. The stylesheet sets
`min-width: 800px`, so a 320 px viewport gets horizontal scrolling.

**Accessibility.** A real table with header cells and status text is a good
base. In the generated report the filter checkboxes had no accessible name,
and the 800 px minimum width breaks narrow screens and 200 % zoom layouts.

**Worth stealing.** Failed rows expanded by default; URL query parameters for
view state; `--self-contained-html` as a first-class option; the simple
status-count filter row.

**Worth avoiding.** A flat table as the only hierarchy; no search; an 800 px
minimum width; unlabeled filter controls; environment metadata before the
failure summary.

Sources: [pytest-html docs](https://pytest-html.readthedocs.io/en/latest/),
[user guide](https://pytest-html.readthedocs.io/en/latest/user_guide.html).

## 6. Cypress HTML report

**There is no built-in Cypress HTML report.** The official Cypress reporters
page lists the built-in `spec`, `teamcity` and `junit` reporters, plus custom
Mocha reporters. Cypress Cloud is a hosted run UI, not a portable HTML file.
The de facto Cypress HTML report is Mochawesome, usually through
`cypress-mochawesome-reporter`.

**First screen (Mochawesome example).** A dark header with the report name,
total duration, and counts for suites, tests, passed, failed and pending,
followed by a red/green proportion bar. Below it are suite cards: title, spec
path, duration, test count and pass/fail counts. Each suite expands to test
rows; hook failures are shown inline with the error text. Status is a check or
cross icon plus counts; the failure text is visible.

**Hierarchy.** Spec file → suite (`describe`) → test → hooks/commands. There
is no Gherkin feature/story level and no step model comparable to Cucumber.

**Status.** Header counts and the proportion bar give the run shape; suite
cards repeat counts; rows use icons. The example's red/green bar is a good
compact encoding, though it is still color-only at the bar level and needs
the adjacent numbers.

**Navigation and filtering.** Suites collapse and expand; Mochawesome documents
filters "to display only the tests you want". Cypress Cloud is the hosted run
view; its run/spec filtering is outside the portable HTML artifact. There is no
feature-level navigation because there are no features.

**Scale.** Cypress runs each spec separately, so reports must be merged;
Mochawesome renders one page with every suite. `inlineAssets` plus
`embeddedScreenshots` can produce a single HTML file, which is notable because
it proves that screenshots do not have to force a folder. It still does not
give Cucumber hierarchy.

**Accessibility.** Counts are text; row status is icon-based. The README makes
no accessibility claim. The dark header and colored bars need sufficient
contrast checks.

**Worth stealing.** The summary strip with duration/counts and a proportion
bar; suite cards with spec path and counts; inline hook failure; the
single-file asset/screenshot options.

**Worth avoiding.** Cloud or per-spec merge dependency; spec-file hierarchy as
the primary model; charts as the only run summary.

Sources: [Cypress reporters](https://docs.cypress.io/app/tooling/reporters),
[cypress-mochawesome-reporter](https://github.com/LironEr/cypress-mochawesome-reporter#readme),
[example report](https://lironer.github.io/cypress-mochawesome-reporter/example-report/mochawesome.html),
[Mochawesome](https://github.com/adamgruber/mochawesome#readme).

## 7. CTRF and GitHub Actions summaries

**CTRF is a format, not a UI.** It defines a flat test collection with a
summary, environment, tool, insights and baseline objects. Status values are
`passed`, `failed`, `skipped`, `pending` and `other`; the final status reflects
the last attempt, and steps use the same status values. It is designed for
machine processing and cross-tool aggregation, not for a hierarchy view.

**GitHub test-reporter** renders results as a check run or job summary. The
first screen is a badge (`tests 3527 passed, 4 skipped`), a table with
`Report`, `Passed`, `Failed`, `Skipped`, `Time`, then collapsible file/suite/
test groups. Failures become annotations tied to code. Options include
`only-summary`, `list-suites`, `list-tests`, `list-files` and `collapsed`.

**Constraints are the point.** A check-run report is Markdown: no custom
styling, no screenshots, maximum 65,535 bytes; the action automatically trims
lists when it exceeds the limit. A job summary supports GitHub-flavored
Markdown, up to 1 MiB per step and at most 20 summaries per job. It is a
summary and annotation surface, not a replacement for a detailed report.

**Worth stealing.** A stable summary contract with counts; a "summary only"
mode; file/suite/test grouping in a table; annotations that point to the
failure location; collapsing details when everything passes.

**Worth avoiding.** Treating Markdown as the only report; expecting steps,
attachments or screenshots; relying on a hosted UI for the detailed view.

Sources: [CTRF overview](https://ctrf.io/docs/specification/overview),
[CTRF status](https://ctrf.io/docs/specification/status),
[test-reporter](https://github.com/dorny/test-reporter#readme),
[GitHub workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands).

## 8. Health dashboard patterns

Grafana's dashboard guidance is a useful counterweight to test-report
dashboard fashion:

- A dashboard should **tell a story or answer a question**; if it has no goal,
  question whether it should exist.
- It should **reduce cognitive load**, not add to it.
- Use **hierarchical dashboards with drill-downs**, and let the row order
  reflect the system or service hierarchy.
- Use **meaningful color** and normalize values so like is compared with like.
- Be careful with stacked graphs; they can hide important data.
- Alert on symptoms, not causes.

For a test report, this argues for an exception-first overview that answers
"what failed and where", with a drill-down to the scenario. Charts that show
the shape of the whole run are secondary, not the landing page.

Source: [Grafana dashboard best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/).

## Pattern catalog

These patterns recur across otherwise different tools. Each one has a direct
use in Tolkira.

### 1. Status filters with counts, including a visible "all"

Playwright, Allure and MCHR all put status filters at the top with counts.
Playwright's `All`, `Passed`, `Failed`, `Flaky`, `Skipped`; Allure's
`Total`/`Failed`/`Broken`/`Passed`/`Skipped`; MCHR's scenario pills. The
counts set expectations before the reader scrolls, and the filter is the
fastest path to the failure set.

**Tolkira:** `All`, `Failed`, `Pending`, `Skipped`, plus `Undefined` and
`Ambiguous` when the input contains them. Keep the Cucumber labels; do not
rename them to Allure's `Broken`. Show full-run counts on the tabs and a
separate "N matching" count when a search is active.

### 2. One compact run summary with a proportion bar

Mochawesome's header (duration, suites, tests, passed, failed, pending) plus a
red/green bar; MCHR's feature rows with stacked step bars and counts;
Playwright's status nav. A single segmented bar is faster to read than a donut
and can carry counts in text.

**Tolkira:** one run strip: title, source count, duration, total scenarios,
passed/failed/pending counts, and a segmented proportion bar with a legend.
No donut, no separate chart card.

### 3. Exceptions first, with the failure already open

pytest-html expands failed rows and collapses passed rows. Playwright expands
files only while the visible test count is under 200, then collapses them.
Cypress/Mochawesome shows hook failures inline inside the suite card. The
common move is: sort or group the failure path first, and do not make the
reader click to see the error.

**Tolkira:** failed features first; failed scenarios expanded or immediately
visible; passed features collapsed under a "N passed" group. Keep the full
report order available via a sort control, but do not make input order the
default when the run has failures.

### 4. Aggregate status at every group level, not just the leaves

Allure's tree shows a mini status bar and counts on each group row; MCHR's
feature table shows a step-status bar with counts; Playwright's file chips
group tests. The reader can see "this feature is unhealthy" before opening a
scenario.

**Tolkira:** feature row: scenario count, step counts, proportion bar, worst
status, and text label. Scenario row: step count, duration, status. Keep the
counts honest: if retries are collapsed, say "final status" and show attempts
separately.

### 5. Progressive disclosure to one detail surface

MCHR uses a scenario accordion; Playwright uses a test detail route; pytest-html
uses an expandable row. Each keeps the list scannable and puts steps, errors,
logs and attachments in one place.

**Tolkira:** scenario disclosure with steps, error, doc string, data table,
attachments and attempts. The list shows one line of the failing step; the
detail shows the full stack and evidence. Use `<details>` or an equivalent
button with `aria-expanded`.

### 6. View state in the URL

Playwright puts `q` and `testId` in the hash; pytest-html supports `visible`,
`collapsed` and `sort` query parameters. This gives shareable failure links,
working back/forward, and no server-side state.

**Tolkira:** hash/query parameters for status filter, search, selected
scenario, and optional view mode. It must work from `file://`; do not depend on
`localStorage` as the only store.

### 7. Search plus facets at the list level

Allure combines search with status, tag, severity, category and environment
filters; MCHR combines feature/scenario search with tag and status filters;
Playwright has a search field with filter tokens. Free text alone is not
enough once there are hundreds of scenarios.

**Tolkira:** search across feature name, scenario name, step text, tags and
error text; combine with status/tag facets. The no-JS baseline can be anchor
links plus `<details>`; the enhanced version can filter in place.

### 8. A static summary contract for CI, separate from the detailed report

GitHub test-reporter uses a badge + table + annotations; CTRF uses a flat
machine-readable summary; Grafana argues for a question-led summary with
drill-down. The summary is not the report; it is the entry point.

**Tolkira:** keep the JSON summary contract and the one-file HTML separate.
The HTML is the drill-down; the JSON/CI summary is the gate. A "summary only"
mode is useful, but it should not replace the detailed artifact.

## Anti-patterns

### 1. Dashboard-first chart walls

MCHR's first screen spends the top half on three donuts, two stacked bars, a
tag bar chart and a trend chart before the feature table. jest-html-reporters
puts metric cards and a timing chart before the Details table. The charts
repeat numbers that are already available as text, and they delay the failed
path. Donuts are also poor at comparing close values and are hard to read with
a screen reader.

**Instead:** one run strip and one proportion bar; charts only in an optional
analysis view.

### 2. Full-row status coloring

jest-html-reporter paints the entire test row green, yellow or red. The status
word is present, but the color dominates the page, reduces contrast, and turns
a long report into a traffic-light wall. It also makes status the only
organizing principle.

**Instead:** status icon + text label + a thin bar or left rail. Color is a
secondary cue.

### 3. A flat table as the only hierarchy

pytest-html renders one table of test IDs. Module and class are embedded in the
ID; there is no feature grouping, no scenario/step structure and no search.
This is fine for a unit-test run of 20 tests, but it does not answer "which
feature is unhealthy" at 500.

**Instead:** Run → Feature → Scenario, with a flat "all tests" view only as a
secondary mode.

### 4. Folder, server or runtime dependency

Playwright reports are a folder served by `show-report`; Allure's default is a
directory opened with `allure open`; MCHR writes multiple feature pages;
Cypress/Mochawesome writes a folder with assets. These are all reasonable for
their products, but they conflict with Tolkira's one-file, offline, email/
chat-artifact promise.

**Instead:** inline the CSS, the small script and the data; no fetch, no CDN,
no server, no separate per-test JSON.

### 5. A hierarchy-mode picker before the failures

Allure's `groupBy` is powerful: behaviors, suites or packages, chosen at
configuration time. Allure 2 exposed Behaviors/Suites/Packages tabs. For a
large organisation this is useful; as a landing screen it asks the reader to
choose a mental model before seeing what broke.

**Instead:** one honest default hierarchy (Run → Feature → Scenario → Step),
and optional tree/map modes as secondary views. Do not invent a suite/group
level when the input has none.

## Recommended composition for Tolkira

### Default: compact overview

The default view is a single server-rendered overview that answers the three
questions in one screen. It is not a dashboard, not a map and not a full tree.

```
Run: 1,240 scenarios · 18m 42s · 1,198 passed / 32 failed / 10 pending
[All 1,240] [Failed 32] [Pending 10] [Skipped 0]        Search…
Failed first
  Checkout                 3 failed / 12 scenarios   ███░░  75%   [open]
    ✕ rejects an expired card       4 steps · 2.1s            [open]
    ✕ applies a discount code       3 steps · 1.4s            [open]
  Search                   0 failed / 8 scenarios    █████ 100%  [open]
  … 14 passed features collapsed
Detail (on open): steps, error, doc string/data table, attachments, attempts
```

Rules:

1. **One screen, one answer.** Pass/fail counts and duration at the top; the
   failed features and scenarios immediately below. A reader should not need
   to open a chart tab to learn whether the run is healthy.
2. **Default is static.** The first view works with HTML/CSS only. Filters and
   search can be enhanced with a small script, but the report must remain
   readable when scripts are blocked. Use `<details>` for disclosure.
3. **Honest hierarchy.** Run → Feature → Scenario → Step. Add a Group level
   only when the report actually has multiple input sources or an explicit
   source-level grouping; do not infer a suite from tags or naming. A Rule is
   a property under Feature when Messages provides it; it is not a group.
4. **Feature rows carry the shape.** Name, tags, scenario count, step counts,
   proportion bar, text status. Failed first. Passed features are collapsed or
   below a "N passed" disclosure.
5. **Scenario rows stay one line until opened.** Status icon + label, name,
   duration, step count; optionally the first failing step and a one-line
   error. Full stack, doc string, data table and attachments are in the
   disclosure.
6. **No donuts or chart grid by default.** One segmented bar with a text
   legend is enough. If a distribution view is useful, make it optional and
   keep the numbers in text.
7. **Preserve Cucumber statuses.** Do not silently fold `pending`,
   `undefined` and `ambiguous` into `skipped`. If the filter row gets too wide,
   group them under an "Other" filter that still lists the exact labels and
   counts.
8. **Counts are explicit.** If `All` excludes a status (as Playwright's does),
   say so. If retries are collapsed, label the scenario status as final and
   show the attempt count.

### Optional tree mode

Use for large runs and readers who want to browse the whole hierarchy.

- Full outline: Run → Group (only if present) → Feature/Rule → Scenario → Step.
- All levels collapsed by default except the failed path; sticky feature
  headers; deep link to any scenario.
- `<details>`/`aria-expanded`, keyboard focus, 320 px and 200 % zoom.
- Same data as the compact overview, not a second copy. It is a presentation
  mode, not a second model.

### Optional map mode

Use to show the distribution of failures, not to replace the list.

- Only failed/pending/undefined/ambiguous scenarios; grouping by feature.
- Each cell is a link to the scenario; legend labels and counts; a parallel
  text list for screen readers and no-JS.
- Not all scenarios: a grid of 1,000 cells is a wall of squares, and the
  parallel text list stops being scannable. Restrict it to the exception set.
- No canvas-only rendering; static SVG or CSS grid with real links.

### Explicit separation

| View | Question it answers | Default? | JS needed? | Main risk |
| --- | --- | --- | --- | --- |
| Compact overview | Did it pass, what failed, where? | Yes | No | Too much detail if every scenario is open |
| Tree | What is the full structure and state? | No | No (with `<details>`) | Deep nesting, long pages |
| Map | Where are the failures concentrated? | No | Optional (static SVG fallback) | Color-only, wall of squares |

Do not put all three above the fold. The compact overview is the product; the
tree and map are lenses on the same data.

## What not to copy

| Pattern | Source | Why it conflicts |
| --- | --- | --- |
| Folder output plus `show-report`/`allure open` | Playwright, Allure, MCHR | Breaks one-file, offline, email/chat sharing |
| Per-file lazy JSON (`report.entry(...)`) | Playwright | Requires fetch and separate files |
| CDN-hosted scripts, Chart.js or web fonts | Common in older HTML reporters | Breaks no-network/offline and adds third-party code |
| Analytics/telemetry | Allure 3's [Google Analytics history](https://github.com/allure-framework/allure3/issues/476) | Trust and offline conflict |
| External attachment URLs (`attachmentsBaseURL`) | Playwright | Attachments must travel inside the file |
| Multi-run history/trends as a default view | Allure, MCHR | Needs history storage and a different product scope |
| Canvas-only charts/donuts | Common in dashboard reports | No text alternative, JS-dependent, weak comparison |
| Full-row status color | jest-html-reporter | Contrast, color dominance, color-only reading |
| `min-width: 800px` / horizontal-scroll tables | pytest-html | Fails 320 px and 200 % zoom |
| Absolute local paths | jest-html-reporter, jest-html-reporters | Leaks user names and directory structure |
| Auto-expanding every row | jest-html-reporters, jest-html-reporter | DOM cost and a wall of logs at scale |
| A group-by/mode picker as the landing screen | Allure | Delays the failure path; asks for a mental model first |
| Icon-only status/controls | Playwright rows, Allure tree, jest-html-reporters theme switch | Screen readers and low-vision users lose the state |

## Open questions

- Measure a 5,000-scenario report in the three modes: HTML size, DOM nodes,
  time to first render, and browser search/filter latency.
- Test screen-reader names for status chips, `<details>` summaries and the
  scenario disclosure.
- Decide whether failed features move above passed ones in the main list, or
  only in the overview. Input order and failure order should not fight.
- Decide how to show `undefined` and `ambiguous` without a seven-chip filter
  row. A single "Other" facet with a breakdown is the likely answer.
- Verify hash/query view state from `file://` in Chromium, Firefox and WebKit,
  including back/forward and a cold open with a `#scenario-...` anchor.
- Verify sticky headers and 200 % zoom at 320 px with a long feature list.

## Sources

All accessed 2026-11-04.

- Playwright: [reporters](https://playwright.dev/docs/test-reporters#html-reporter),
  [headerView.tsx](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/headerView.tsx),
  [reportView.tsx](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/reportView.tsx),
  [testFilesView.tsx](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/testFilesView.tsx),
  [testFileView.tsx](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/testFileView.tsx)
- MCHR: [README](https://github.com/WasiqB/multiple-cucumber-html-reporter#readme),
  [docs](https://multiple-cucumber-html-reporter.com/docs),
  [features list](https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/docs/public/images/feature-list-page.jpeg),
  [feature detail](https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/docs/public/images/feature-detail-page.jpeg)
- Allure 3: [docs](https://allurereport.org/docs/v3/),
  [live demo](https://allure-framework.github.io/allure3-demo/awesomeAll/),
  [navigation](https://allurereport.org/docs/v3/navigation/),
  [sorting and filtering](https://allurereport.org/docs/sorting-and-filtering/),
  [statuses](https://allurereport.org/docs/test-statuses/),
  [charts](https://allurereport.org/docs/v3/read-charts/)
- jest-html-reporters: [README](https://github.com/Hazyzh/jest-html-reporters#readme),
  [live demo](https://hazyzh.github.io/report.html),
  [large-suite issue](https://github.com/Hazyzh/jest-html-reporters/issues/113)
- jest-html-reporter: [README](https://github.com/Hargne/jest-html-reporter#readme)
- pytest-html: [docs](https://pytest-html.readthedocs.io/en/latest/),
  [user guide](https://pytest-html.readthedocs.io/en/latest/user_guide.html)
- Cypress: [reporters](https://docs.cypress.io/app/tooling/reporters),
  [cypress-mochawesome-reporter](https://github.com/LironEr/cypress-mochawesome-reporter#readme),
  [example report](https://lironer.github.io/cypress-mochawesome-reporter/example-report/mochawesome.html),
  [Mochawesome](https://github.com/adamgruber/mochawesome#readme)
- CTRF: [overview](https://ctrf.io/docs/specification/overview),
  [status](https://ctrf.io/docs/specification/status)
- GitHub: [test-reporter](https://github.com/dorny/test-reporter#readme),
  [workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)
- Grafana: [dashboard best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
