# Indirect report patterns: triage, reconciliation and honesty

Status: research note for post-0.2 planning. Not an approved design.
Date: 2026-11-05.

The first research note covered direct test-report competitors. This one looks
outside test reporting — observability, security alerting, CI test analytics,
project health and financial reporting — for interaction patterns that survive
Tolkira's constraints: **one self-contained file, offline, no server, no
accounts, no telemetry, and no cross-run store by default**.

The useful question is not "which dashboard looks modern". It is: what does the
first screen answer, how does the product mark "needs attention", and which
parts only work because the product owns history, identity or a server? A
pattern that depends on those things is still worth studying, but it must not
be copied into a one-run artifact as if the data existed.

This note changes no production code, tests, CI, README or `package.json`. The
only new project file is this note.

## Method and evidence

Primary sources only: official documentation, current public screenshots, and
source where the docs do not describe the UI.

- "First screen" means the view at open, before any row is clicked.
- Products that require an account are described from their public docs and
  screenshots, not from a live logged-in session.
- Maven Surefire is covered through the official 3.6.1 report screenshots.
- TestNG is covered through its current reporter source, because the docs
  describe the output files but not the report layout.
- Jenkins is covered through the JUnit plugin docs; the old wiki only adds the
  trend-graph example.
- No performance benchmark was run. Scale notes come from documented limits,
  architecture and published behaviour.
- Where the reviewed pages do not describe keyboard or accessibility behaviour,
  this note says so rather than guessing.

Caveats:

- These are server products with fast-moving UIs. Claims are limited to the
  cited pages, accessed 2026-11-05.
- A server product is evidence of a pattern, not a target architecture for
  Tolkira.
- The line between "test report" and "test analytics" is deliberately crossed
  here; that is the point of the exercise.

## Key conclusions

- **The strongest transferable pattern is a triage queue with a reason, not a
  chart.** Cypress's run overview, Sentry's issue stream and Trunk's test table
  each put a small set of items in front of the reader and say why each one is
  there. A one-run report can do that honestly; it cannot do the cross-run
  scoring behind it.
- **Every number should reconcile to rows.** Stripe, ReportPortal and GitLab
  make summary counts traceable to the underlying items. A count that is not a
  filter is a dead end.
- **Keep outcome, cause, priority and ownership on separate axes.** ReportPortal
  separates execution status from defect type. Sentry separates issue status
  from priority and assignee. GitHub code scanning separates severity from
  security severity. Collapsing them produces labels the data cannot support.
- **Worst-child rollup is useful; "no data" is not "failed".** Grafana rolls an
  alert rule up to its worst instance but keeps rule health separate for
  `Error` and `NoData`. Tolkira should do the same for `undefined`,
  `ambiguous` and `unknown`.
- **One run can honestly show exceptions, causes, concentration and scope.**
  It cannot show first/last seen, trend, flake rate, reliability, ownership or
  quarantine. Those need history or external metadata.
- **Stable scenario identity is the prerequisite for deep links and any future
  history.** Datadog, Buildkite, Cypress and ReportPortal all rely on a stable
  test identity; display names alone are not enough.
- **Keyboard-first is cheap; a command palette is optional.** A shortcut sheet
  and a few keys buy most of the value in a static report. A full command
  registry is product surface without a matching need.

## At a glance

### Observability, security and delivery

| Source | First screen answers | "Needs attention" cue | Overview → detail | History? |
| --- | --- | --- | --- | --- |
| Grafana | Is anything alerting, and where? | Alert state, labels, worst instance | Dashboard/row → panel; alert rule → instances → history | Yes |
| Datadog CI Visibility / Test Optimization | Which pipeline or test is failing, flaky or slower? | Failed, flaky, known/new flaky, regression facets | Explorer → execution trace or test detail | Yes |
| Sentry | What is broken, and what needs review? | For Review, priority, regressed/escalating, assignee | Issue stream → issue detail → event | Yes |
| Honeycomb | What is unusual, and which dimension explains it? | BubbleUp selection vs baseline; outlier charts | Query → result → trace/span | Yes |
| GitHub Actions / code scanning | Did the run pass, and which alert matters? | Failed job; severity and security severity | Run → job; alert list → alert | Yes |
| Vercel Observability | Which route or function is erroring or slow? | Error rate and duration; top offenders | Observability → route/function → logs | Yes |

### Test-adjacent and general product surfaces

| Source | First screen answers | "Needs attention" cue | Overview → detail | History? |
| --- | --- | --- | --- | --- |
| Maven Surefire | Pass/fail/error counts, and which package/class? | Failures and errors columns; success rate | Summary → package → class → test | No |
| JUnit XML viewers (GitLab) | Did the suite pass, and what changed? | Newly failed, existing, resolved; 14-day failure count | Test summary → suite → case | Yes |
| TestNG | Suite summary, and which tests failed/retried? | Failed sections first; retried count | Suite → test → class → method | No |
| NUnit | No first-party HTML; XML result, label and site | Result + label + failure site | Test run → fixture → case | No |
| ReportPortal | Which launch needs investigation? | "To investigate", defect types, retries | Launch → suite → test → step | Yes |
| Jenkins | Did the build's tests pass, and what is old? | Age, fail-since, regression | Build → test result → class/test | Yes |
| Buildkite Test Engine | Which tests are failing, flaky or owned? | Failed/flaky labels, owner filter | Build/suite → test | Yes |
| Trunk Flaky Tests | Which flaky/broken tests impact PRs? | Flaky/broken, quarantine, PR impact | Collection → test → history | Yes |
| Cypress Cloud | What needs review in this run? | Tests for Review: failed, flaky, modified | Run → test detail sidebar | Yes |
| Linear | Is the project on track, and who owns it? | On track / At risk / Off track; update missing | Project → updates/issues | Yes |
| Stripe | Do the totals reconcile to transactions? | Failed payouts section only if failures exist | Summary → itemized rows | Yes |

## 1. Observability, security and delivery

### Grafana

**First screen.** Grafana's own guidance is question-led: a dashboard should
"tell a story or answer a question", reduce cognitive load, use hierarchical
drill-downs, compare like with like, use meaningful colour, and be careful with
stacked graphs. The alerting view is a separate first screen: the alert rule
list shows each rule's state and actions such as pause, silence, export and
delete.

**Needs attention.** An alert rule's state is determined by the **worst state
among its instances**. Rule *health* is separate and indicates `Error` or
`NoData` conditions. That distinction matters: a rule that cannot be evaluated
is not the same as a rule that is firing. Alert detail tabs are Query and
conditions, Instances (with search by label), History and Details.

**Overview and detail.** Dashboard rows reflect the service hierarchy; panels
drill down to the next level. Alert rules drill into instances and history.
Breadcrumbs show namespace and group and can filter the list.

**Vocabulary and grouping.** Alert states are `Normal`, `Pending` and
`Alerting`; health is a separate `Error`/`NoData` signal. Labels carry
environment, region and severity-like dimensions; label selectors support
`=`, `!=` and regex matching.

**Trend and ownership.** The History tab records alert-rule history and can be
filtered by state. Silences and notification policies are operational tools,
not ownership; the docs do not define a per-test owner.

**Scale and accessibility.** Built for aggregated metrics, not per-test rows.
The reviewed pages do not describe keyboard or screen-reader behaviour for the
alert list.

**Worth taking.** Worst-child rollup; `NoData` separate from failure; a
question-led summary rather than a chart wall. **Not transferable:** alerting,
silences, live evaluation and history.

Sources: [dashboard best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/),
[view alert state](https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-state/).

### Datadog CI Visibility and Test Optimization

**First screen.** The CI Visibility Explorer opens on pipeline executions with
a facet panel on the left, a query bar, a result list, and — at pipeline level —
three graphs for duration, errored pipelines and execution volume. The Test
Optimization Explorer applies the same facet/query model to test runs at four
levels: **Session → Module → Suite → Test**. Sessions correspond to a test
command; modules, suites and tests are aggregations below it.

**Needs attention.** Facets include `Test Status` (`Passed`, `Failed`,
`Skipped`), `Flaky`, `Known Flaky`, `New Flaky`, `Performance Regression`,
`Is Retry`, `Is New`, code owners and a stable test fingerprint. A performance
regression is defined as a duration that is both five times the mean and
greater than the maximum duration for the same test on the default branch.
That is a precise, history-based rule; it is not a guess.

**Overview and detail.** Explorer list → execution trace; test run → test
detail. The pipeline explorer keeps Pipeline, Stage, Job, Step and Command as
levels. Facets and the query bar stay in sync.

**Vocabulary and grouping.** `Passed`, `Failed`, `Skipped` are the base test
statuses; flaky and regression are separate facets. Grouping is by any tag,
including test service, suite, module, code owner and fingerprint. Saved views
and export are first-class.

**Trend and ownership.** Timeseries visualisations and baseline mean/standard
deviation are documented. Code owners are inferred from the repository
configuration. This is server-side history and repository integration.

**Scale and accessibility.** A server-side explorer built for large volumes.
The reviewed pages do not describe keyboard or screen-reader behaviour.

**Worth taking.** The vocabulary for "new flaky" vs "known flaky", the stable
fingerprint idea, and the separation of retry from flaky. **Not transferable:**
the history, baselines and repository integration.

Sources: [CI Visibility Explorer](https://docs.datadoghq.com/continuous_integration/explorer/),
[Test Optimization](https://docs.datadoghq.com/tests/),
[Test Optimization Explorer](https://docs.datadoghq.com/tests/explorer/).

### Sentry

**First screen.** The Issues stream is organised into tabs: All Unresolved,
For Review, Regressed, Archived and Escalating. Each row shows the issue type
and description, project, first/last seen and a level colour. Sorting can be
Recommended, Last Seen, First Seen, Trends, Events or Users. The default stream
is unresolved issues, including new, ongoing, escalating and regressed ones.

**Needs attention.** "For Review" is the explicit triage queue: new, regressed
or unresolved issues that have not been reviewed. Priority, assignee and
resolution/archive actions live in the issue header. Status vocabulary is
`New`, `Ongoing`, `Escalating`, `Regressed`, `Archived`, `Resolved`. A resolved
issue that recurs becomes `Regressed`; an archived issue can escalate back into
view if its volume rises.

**Overview and detail.** Issue detail shows high-level counts in the header, an
event graph, first/last seen, assignee, linked issues, participants and
activity in the sidebar, and the selected event's stack trace, breadcrumbs,
tags, request data, attachments and replays in the main area. The "recommended"
event is chosen for recency, relevance and debugging content; the reader can
jump to the first or latest event.

**Vocabulary and grouping.** Issues are grouped events, with grouping driven by
a fingerprint. Tags are key/value pairs and can be opened into filtered views.
The issue stream and the detail page deliberately show different scopes: header
counts are lifetime counts, while the graph reflects the current search,
environment and time range.

**Trend and ownership.** The event graph is the trend cue. Ownership is explicit
through assignee and ownership rules. This is all history- and account-based.

**Scale and accessibility.** Server-side event storage; no per-test scale
figures in the reviewed pages. Keyboard/screen-reader behaviour is not
described there.

**Worth taking.** The "For Review" queue, the explicit first/last-seen
vocabulary, and the distinction between lifetime and filtered counts. **Not
transferable:** the history, event store and assignment.

Sources: [Issues](https://docs.sentry.io/product/issues/),
[Issue Details](https://docs.sentry.io/product/issues/issue-details/),
[Issue status and triage](https://docs.sentry.io/product/issues/states-triage/).

### Honeycomb

**First screen.** A query builder with six clauses: `SELECT`, `WHERE`,
`GROUP BY`, `ORDER BY`, `LIMIT`, `HAVING`. The result is a visualisation plus a
summary table. A heatmap can show a distribution over time; selecting a region
opens BubbleUp, which compares the selected set with the rest of the data
across every field.

**Needs attention.** BubbleUp is the distinctive move: it highlights the
dimensions and measures that differ most between the selection and the
baseline. The optional Insights layer ranks fields by how strongly they differ
and gives a severity rating for the signal. This is not a generic "top errors"
chart; it answers "what is different about this subset?"

**Overview and detail.** Query → result table/chart → trace summary → span.
Clicking a grouped value can add a filter, group by that field or copy the
field name.

**Vocabulary and grouping.** There is no fixed test-status vocabulary; the data
model is arbitrary fields. `GROUP BY` can use one or many fields, and a
visualisation shows at most the top 50 groups. `LIMIT` defaults to 100 and can
go to 1,000.

**Trend and ownership.** Time series, time comparison with the previous period,
and permalinks are documented. Ownership is not a product concept in the
reviewed pages.

**Scale and accessibility.** Server-side query engine; the 50-series and 1,000
row limits are explicit. Keyboard support is documented: `Shift + Enter` runs a
query and `?` opens the shortcut list.

**Worth taking.** Compare the failure set with the rest of the run across
dimensions, and label the comparison honestly. **Not transferable:** the query
language, arbitrary grouping and server-side data.

Sources: [Query Builder](https://docs.honeycomb.io/investigate/query/),
[BubbleUp](https://docs.honeycomb.io/investigate/analyze/identify-outliers/).

### GitHub Actions and code scanning

**Actions first screen.** A workflow run summary shows a job graph: each job has
a status icon and lines indicate dependencies. Clicking a job opens its logs;
the run history is a list of previous runs.

**Actions needs attention.** The failed job is the cue, with annotations on the
code and a [job summary](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)
in Markdown. This is a summary surface, not a detailed
test report; the prior note already covers the 65,535-byte check-run limit and
the 1 MiB job-summary limit.

**Code scanning first screen.** The security view lists alerts; each alert has
a title, the tool that found it, a severity (`Error`, `Warning`, `Note`) and,
for CodeQL security alerts, a security severity (`Critical`, `High`, `Medium`,
`Low`). The detail page adds the affected line, the first time the issue was
introduced, affected branches, a Development section with linked branches/PRs,
and a dismissal action with a recorded reason.

**Needs attention and grouping.** Alerts support free-text search and filters,
including a branch filter. The same vulnerability reached through multiple
paths is grouped under one alert. Multiple analysis configurations can report
the same alert; affected branches show where it exists. Bulk dismissal works
on a filtered set.

**Trend and ownership.** "First introduced" and affected branches are history
cues. Assignment exists (including assignment to Copilot), and alerts can be
linked to issues. This is all account- and server-based.

**Scale and accessibility.** Server-side security database; the reviewed pages
do not describe keyboard or screen-reader behaviour.

**Worth taking.** Two-axis severity (rule severity and security severity),
dismissal with a reason, and grouping multiple paths under one cause. **Not
transferable:** the scanner, the alert database and assignment.

Sources: [visualization graph](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-the-visualization-graph),
[workflow run history](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-run-history),
[code scanning alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/about-code-scanning-alerts),
[resolving alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/managing-code-scanning-alerts-for-your-repository).

### Vercel Observability

**First screen.** The Observability tab shows error-rate and latency graphs over
a selected time range. Below the graphs is a list of routes; the reader can
reorder by error rate or duration, then click a route to open the function
view. The function view adds latency and path breakdowns (on paid plans) and a
direct link to that function's logs.

**Needs attention.** Error rate and duration are the sorting keys; the product
explicitly tells the reader to reorder by error rate or duration to see which
routes are causing the most issues. The list is the top-offender surface, not
an alphabetical inventory.

**Overview and detail.** Observability → route list → route/function → logs.
The time-range picker and drag-to-zoom are part of the drill-down.

**Vocabulary and grouping.** `500` errors and error rate are the main
vocabulary; there is no test-like status model. Grouping is by route and
function.

**Trend and ownership.** Time series and period selection are the trend cues.
Ownership is not a concept in the reviewed page.

**Scale and accessibility.** Server-side telemetry; no accessibility statement
in the reviewed page.

**Worth taking.** Sort the entity list by the bad metric, not by input order.
**Not transferable:** live telemetry, logs and retention.

Source: [Vercel Observability](https://vercel.com/docs/observability).

## 2. Java/.NET and test-adjacent reports

### Maven Surefire report

**First screen.** The generated report opens on a **Summary** table with
`Tests`, `Errors`, `Failures`, `Success Rate` and `Time`, followed by a note:
"failures are anticipated and checked for with assertions while errors are
unanticipated." Below it is a **Package List** with the same columns, then a
**Test Cases** section grouped by class. The three views are reachable through
`[Summary] [Package List] [Test Cases]` links.

**Needs attention.** Failures and errors are separate columns, and the class
table repeats the same counts. There is no severity or priority; the product
distinguishes an assertion failure from an unexpected error and leaves it at
that.

**Overview and detail.** The three views are Summary, Package List and Test
Cases; the third groups class → test case. The report is static HTML: the site
version is one page in a multi-page Maven site, and the standalone goal writes
`target/reports/surefire.html`. It is not Tolkira's one-file model. The captured
version has no search, filter or collapse controls.

**Vocabulary and grouping.** `Tests`, `Errors`, `Failures`, `Success Rate`,
`Time`; grouping is package → class → method. There is no run history in the
report itself.

**Trend and ownership.** None. The report is a snapshot of one run.

**Scale and accessibility.** Server-generated static HTML with a left project
navigation; no benchmark. The reviewed screenshots do not show search or filter
controls, and the docs do not describe accessibility.

**Worth taking.** The explicit failure/error distinction, the single success
rate, and the compact class/test tables. **Not transferable:** the Maven site
wrapper and the Maven-specific package hierarchy.

Sources: [plugin overview](https://maven.apache.org/surefire/maven-surefire-report-plugin/),
[usage and screenshots](https://maven.apache.org/surefire/maven-surefire-report-plugin/usage.html),
[sample report 1](https://maven.apache.org/surefire/maven-surefire-report-plugin/images/surefire-sample1.png),
[sample report 2](https://maven.apache.org/surefire/maven-surefire-report-plugin/images/surefire-sample2.png).

### JUnit XML viewers: GitLab

**First screen.** JUnit XML is a format, not a UI. GitLab renders it in two
places: a **Test summary** panel in the merge request and a **Tests** tab in
the pipeline. The merge-request panel shows an overview of passed and failed
tests; expanding it lists failed tests with a "View details" link. The pipeline
Tests tab lists suites and cases with total execution time and per-job time.

**Needs attention.** GitLab compares the source branch with a baseline pipeline
on the target branch and labels four outcomes: **newly failed**, **newly
encountered errors**, **existing failures** and **resolved failures**. For
tests that failed on the default branch in the last 14 days it shows "Failed
{n} time(s) in {default_branch} in the last 14 days". This is the clearest
"new vs old" vocabulary in the sources reviewed.

**Overview and detail.** Test summary → full report → suite → case → detail
dialog with test name, file path, execution time, screenshot attachment and
error output. Failed test names can be copied for local reruns.

**Vocabulary and grouping.** `failure`, `error`, `skipped`; suite/class/test,
with `testcase classname` displayed as the suite name. Duplicate test names are
ignored after the first. Timing distinguishes pipeline duration, test execution
time and queue time.

**Trend and ownership.** The 14-day failure count and branch comparison are
history cues. Ownership is not part of the test report.

**Scale and accessibility.** JUnit files must be under 30 MB each and 100 MB
total per job; duplicate names are dropped. The docs do not describe the
report's keyboard or screen-reader behaviour.

**Worth taking.** The new/existing/resolved vocabulary and "failed n times"
phrasing. **Not transferable:** the baseline pipeline and 14-day history.

Source: [GitLab unit test reports](https://docs.gitlab.com/ci/testing/unit_test_reports/).

### TestNG

**First screen.** TestNG writes `test-output/index.html` plus several HTML and
text files. The single-page **emailable report** opens with a suite summary
table: `Test`, `# Passed`, `# Skipped`, `# Retried`, `# Failed`, `Time (ms)`,
`Included Groups`, `Excluded Groups`. Below it is a scenario summary grouped in
this order: failed configuration methods, failed tests, skipped configuration
methods, skipped tests, retried tests, passed tests. Columns are `Class`,
`Method`, `Start`, `Time (ms)`. Details add parameters, reporter messages,
exception and stack trace, with "back to summary" links.

The per-test HTML page adds a header with `Tests passed/Failed/Skipped`, start
time, total time, included/excluded groups, then sections in this order:
`FAILED CONFIGURATIONS`, `SKIPPED CONFIGURATIONS`, `FAILED TESTS`,
`PASSED TESTS`, `SKIPPED TESTS`.

**Needs attention.** Failed configuration methods are separated from failed
tests, and retried is its own count. The report does not have a severity or
priority model.

**Overview and detail.** Suite → test → class → method. Navigation is anchor
links and "back to summary"; there is no search or filter.

**Vocabulary and grouping.** `PASS`, `FAIL`, `SKIP`; retried tests; failed
configuration methods; a separate "failed but within success percentage" bucket
exists in the per-test HTML. Grouping is suite → test → class → method.

**Trend and ownership.** None in the report itself; it is a single-run artifact.
Ownership is not modelled.

**Scale and accessibility.** Multi-file HTML with an index and per-test pages;
no scale benchmark. The markup uses old-style tables and JavaScript toggles; no
accessibility statement.

**Worth taking.** Separate configuration failures from test failures; count
retries; put failed sections first. **Not transferable:** the anchor-only
navigation and the multi-file layout.

Sources: [TestNG documentation](https://testng.org/) (section 4, test results),
[EmailableReporter2.java](https://raw.githubusercontent.com/testng-team/testng/master/testng-core/src/main/java/org/testng/reporters/EmailableReporter2.java),
[TestHTMLReporter.java](https://raw.githubusercontent.com/testng-team/testng/master/testng-core/src/main/java/org/testng/reporters/TestHTMLReporter.java).

### NUnit

**First screen.** NUnit 3's own runner produces **XML, not an HTML report**. The
console runner saves results in XML; the docs describe that XML as the way to
"produce reports or otherwise process the results". A UI, if any, comes from a
CI system or a third-party reporter.

**Needs attention.** The XML has a basic `result` (`Passed`, `Failed`,
`Inconclusive`, `Skipped`), a `label` that refines a failure (`Error`,
`Cancelled`, `Invalid`) or a skip (`Ignored`, `Explicit`), and a `site` that
says where the failure occurred (`Test`, `SetUp`, `TearDown`, `Parent`,
`Child`). The run and suite elements carry counts. This is a richer cause model
than pass/fail, but it is still one run.

**Overview and detail.** Test run → assembly → fixture → test case. Attachments
are file paths, and the docs say paths are fully rooted; that is a portability
and privacy problem for a one-file report, not a pattern to copy.

**Vocabulary and grouping.** Result + label + site; counts at run, suite and
case level. There is no trend, owner or severity.

**Trend and ownership.** None in the result file.

**Scale and accessibility.** XML consumed by a runner or viewer; no UI to
assess. Absolute attachment paths are the main caution.

**Worth taking.** Failure site (setup, teardown, parent, child) as a cause
dimension, and `Inconclusive` as distinct from `Skipped`. **Not transferable:**
NUnit's exact vocabulary and path-based attachments.

Sources: [NUnit test result XML](https://docs.nunit.org/articles/nunit/technical-notes/usage/Test-Result-XML-Format.html),
[NUnit console runner](https://docs.nunit.org/articles/nunit/running-tests/Console-Runner.html).

### ReportPortal

**First screen.** The **Launches** table lists runs with `Start time`,
`Duration`, `Total`, `Passed`, `Failed`, `Skipped`, `Product Bug`,
`Automation Bug`, `System Issue` and `To investigate`. Every count is a link
into the filtered test-case table. "Latest Launches" collapses repeats to the
last increment per name.

**Needs attention.** "To investigate" is the unresolved-failure queue: failed
and skipped items with no defect type. Defect types are `Product Bug`,
`Automation Bug`, `System Issue`, `No Defect` and `To Investigate`; custom
types can encode teams or causes. Retries are grouped under one test case, and
statistics use the last invocation.

**Overview and detail.** Launch → suite → test → step → log, with breadcrumbs.
A History tab shows a matrix of recent executions per test; the depth is
configurable from 3 to 30 launches. Duration growth is marked with triangles
whose count increases with the percentage growth.

**Vocabulary and grouping.** Execution status: `Passed`, `Failed`, `Skipped`,
`Interrupted`. Defect type is a separate axis. Grouping follows the reported
suite hierarchy; attributes and saved filters provide cross-cuts.

**Trend and ownership.** The history matrix and history line are explicit
cross-run views. Defect types can be used to assign a team, and Jira/Azure
DevOps links are supported. This is server- and account-based.

**Scale and accessibility.** Maximum page size is 300 items for launches,
suites, tests, steps and logs. The reviewed pages do not describe keyboard or
screen-reader behaviour.

**Worth taking.** Clickable counts, outcome separate from defect type, and the
history matrix as a compact multi-run view. **Not transferable:** the server,
the defect workflow and the 30-launch history.

Sources: [ReportPortal docs](https://reportportal.io/docs/),
[view launches](https://reportportal.io/docs/work-with-reports/ViewLaunches/),
[investigation of failure](https://reportportal.io/docs/work-with-reports/InvestigationOfFailure/),
[history of launches](https://reportportal.io/docs/work-with-reports/HistoryOfLaunches/).

### Jenkins test results

**First screen.** The build page carries the test-result summary and a
historical trend graph; the JUnit publisher adds a web UI for viewing reports
and tracking failures. The classic test-result view lists packages, classes and
tests, with the failure detail behind each test.

**Needs attention.** Jenkins exposes **age** (how many builds a test has been
failing), **fail since** and a **regression** flag as test-result fields. These are
history concepts, not one-run facts. The plugin also computes a build-health
contribution from the failure count with a configurable amplification factor;
that is a build metric, not a test verdict.

**Overview and detail.** Build → test result → package/class/test. The trend
graph is on the build page, not in the test detail.

**Vocabulary and grouping.** Pass/fail/skip from JUnit XML; age, fail-since and
regression as historical labels. Grouping is package → class → test.

**Trend and ownership.** The trend graph and age/fail-since are the history
cues. Ownership is not modelled.

**Scale and accessibility.** Server-side Jenkins storage; no accessibility
statement in the reviewed docs.

**Worth taking.** Age and fail-since vocabulary, and the idea of a build-level
history strip. **Not transferable:** the server and the build history.

Sources: [JUnit plugin](https://plugins.jenkins.io/junit/),
[JUnit pipeline step](https://www.jenkins.io/doc/pipeline/steps/junit/),
[JUnit graph](https://wiki.jenkins.io/display/JENKINS/JUnit+graph).

### Buildkite Test Engine

**First screen.** On a build page, the **Tests** tab lists failing tests and
lets the reader filter by result, state, owner, label, suite and tag. Executions
are grouped by test, so retries appear together; **Expand failures** opens all
failure reasons at once. The suite **Summary** page adds metric charts, test
statistics by team or tag, recent runs, and optional widgets such as flaky
tests added/resolved and slowest tests. Views are filtered to the default
branch unless the reader changes the branch filter.

**Needs attention.** Failed and flaky labels, owner filters and the
"Expand failures" action. A run is marked failed as soon as any test execution
fails, even if a retry later passes; that is deliberately stricter than the
final build status and surfaces unreliability.

**Overview and detail.** Build → test execution; suite Summary → Tests page →
individual test execution with trend and span/log detail.

**Vocabulary and grouping.** `passed`, `failed`, `unknown`, `skipped`; state
`enabled`/`disabled`; labels such as `flaky` and `slow`; reliability is
`passed_runs / (passed_runs + failed_runs)`. Grouping is by suite, test, team or
tag; retries group under the test.

**Trend and ownership.** Reliability over time, flaky-added/resolved widgets,
slowest tests and run history. Test ownership is a first-class filter and is
derived from the repository's ownership configuration.

**Scale and accessibility.** Server-side test analytics; execution data is
retained for 120 days per the docs. Keyboard/screen-reader behaviour is not
described in the reviewed pages.

**Worth taking.** Group retries, expand failures, and mark the run failed on
any attempt failure. **Not transferable:** history, ownership and retention.

Sources: [Test Engine overview](https://buildkite.com/docs/test-analytics),
[test suites](https://buildkite.com/docs/pipelines/configure/tests/test-suites).

### Trunk Flaky Tests

**First screen.** The collections list answers two questions: which collections
have flaky tests, and which are not fully set up. Columns include collection ID,
repository count, setup progress, tracked tests, currently flaky and broken
counts with 10-day sparklines, and runs per day. Selecting a collection opens
an Overview with flaky/broken/PR-impact cards, daily charts for new tests,
status changes and quarantined runs, and three top-10 tables: most unstable,
longest-running and longest-manually-quarantined. The test table is sorted by
**PRs impacted** by default, not by name.

**Needs attention.** Status is `Healthy`, `Flaky` or `Broken`; if a test
matches both a broken and a flaky monitor, **Broken wins**. Quarantine and
ticket status are separate. The test detail page has Summary, Test History,
Monitors and Events tabs; failure types group past runs by a summary of the
stack trace, and code owners are shown when a CODEOWNERS file exists.

**Overview and detail.** Collection → test → history/monitors. Test history has
a daily pass/fail/quarantined/skipped chart, result and quarantine filters, SHA
and branch filters, and a paginated runs table. Filter state is stored in the
URL.

**Vocabulary and grouping.** Healthy/Flaky/Broken; quarantined; ticket status;
failure type; code owner. Detection is monitor-based: pass-on-retry, failure
rate and failure count, each with thresholds and windows.

**Trend and ownership.** 10-day sparklines, 30-day monitor swimlanes, status
change charts and history. Code owners are explicit.

**Scale and accessibility.** Server-side analytics. The product documents a
command palette: `Cmd/Ctrl + K` anywhere in the app. It does not publish a
WCAG statement in the reviewed pages.

**Worth taking.** Reason-coded status, failure types and the command palette.
**Not transferable:** monitors, quarantine, tickets and cross-run history.

Sources: [Flaky Tests overview](https://docs.trunk.io/flaky-tests),
[dashboard](https://docs.trunk.io/flaky-tests/dashboard),
[detection](https://docs.trunk.io/flaky-tests/detection).

### Cypress Cloud

**First screen.** The project entry point is a paginated list of latest runs;
runs containing flaky tests are flagged with a flaky count. A run opens on an
**Overview** tab with run duration compared to previous runs, a **Tests for
Review** panel, and tabs for Test Results, Specs and Errors. The run header
shows counts for flaky, skipped, pending, passed and failed tests; clicking a
count goes to Test Results filtered by that status.

**Needs attention.** Tests for Review orders results as **Failed**, then
**Flaky**, then **Modified**, with a badge for the reason. "Modified" means the
test body or its hooks differ from a previously recorded version; "New" means
there is no earlier version. The Errors tab aggregates errors thrown in the
run and links into the test detail. Flake severity is computed from flake rate:
Low is >0–10%, Medium >10–50%, High >50%.

**Overview and detail.** Run → spec → test → detail sidebar. The sidebar has
status and title, the spec, attempts and errors, previous runs, artifacts
(screenshots, video, CI logs) and test code history. The Specs tab switches
between run order, spec duration and machine/parallelisation views.

**Vocabulary and grouping.** `passed`, `failed`, `pending`, `skipped`, `flaky`,
`modified`, `new`; flake severity Low/Medium/High. Grouping is run → spec →
test; retries are attempts within a test.

**Trend and ownership.** Duration over time, previous runs, failure/flake rates
over time and branch comparisons. Ticket creation is available from the test
detail; an owner field is not part of the documented test detail.

**Scale and accessibility.** Server-side run store; no per-test scale figures
in the reviewed pages. The docs do not describe keyboard or screen-reader
behaviour.

**Worth taking.** The reason badges, the Errors cross-cut and "previous runs"
as a test-detail section. **Not transferable:** the run store, flake scoring and
branch comparison.

Sources: [recorded runs](https://docs.cypress.io/cloud/features/recorded-runs),
[flaky test management](https://docs.cypress.io/cloud/features/flaky-test-management),
[project analytics](https://docs.cypress.io/cloud/features/analytics/project-analytics).

## 3. General product and analytics surfaces

### Linear project health

**First screen.** A project overview shows the project status, lead, progress
graph, latest update and milestones. The projects list can be grouped by
status, lead, target date or activity. The latest project update carries a
**health indicator** — `On track`, `At risk` or `Off track` — plus a rich-text
explanation; previous updates live under an **Updates** tab.

**Needs attention.** Health is explicitly **human-authored**, not computed from
issue counts. Linear also marks projects as **Update Missing** when an expected
update is overdue, and turns the health icon grey after a longer period of
inactivity. That is an honesty signal: the product distinguishes "we have not
heard from the owner" from "the project is unhealthy".

**Overview and detail.** Project → overview → updates/issues. A single project
lead owns the project; the FAQ says the single lead field exists to keep
ownership clear. Updates are chronological and can be sent to Slack.

**Vocabulary and grouping.** Project status is a lifecycle field; health is a
separate qualitative field. Grouping is team/project/initiative.

**Trend and ownership.** The progress graph and update chronology are the trend
cues; the lead is the owner. All of this is account-based and depends on a
human posting updates.

**Scale and accessibility.** Workspace-scale product. `Cmd/Ctrl + K` opens the
action menu for copying a link or Markdown; the reviewed pages do not describe
report-style keyboard navigation.

**Worth taking.** The separation of a qualitative health signal from computed
counts, and the "update missing" state. **Not transferable:** human updates,
accounts and project ownership.

Sources: [projects](https://linear.app/docs/projects),
[project status](https://linear.app/docs/project-status),
[initiative and project updates](https://linear.app/docs/initiative-and-project-updates).

### Stripe payout reconciliation

**First screen.** The payout reconciliation report has four sections: **Balance
summary** (starting and ending balance, activity, total payouts), **Payout
reconciliation** (automatic payouts grouped by reporting category such as
charges, refunds and fees), **Failed payouts** (only visible if there are failed
payouts in the range), and **Ending balance reconciliation** (transactions not
yet settled at the end date). The reconciliation sections can be downloaded as
**Summary** or **Itemized**; itemized CSV contains every transaction behind the
totals.

**Needs attention.** The failed-payouts section is the exception surface, and
it is absent when there is nothing to show. Amounts in the reconciliation
sections can be clicked to audit the underlying transactions where activity
breakdown is available. The report is built for reconciliation: the summary and
the itemized rows describe the same period and the same transactions.

**Overview and detail.** Balance summary → payout reconciliation → itemized
transactions; ending balance reconciliation is a second cut for unsettled
items. The reader can download the summary or the itemized data.

**Vocabulary and grouping.** Payout, reporting category, gross/fee/net,
failed payout. There is no severity model; the binary "failed payout" is
enough.

**Trend and ownership.** The report is period-based, not a live trend line.
Ownership is not part of the report.

**Scale and accessibility.** Server-side financial reporting with CSV/PDF
export; no accessibility statement in the reviewed page.

**Worth taking.** Every total must trace to rows; show the exception section
only when exceptions exist; distinguish summary from itemized. **Not
transferable:** financial completeness and server-side transaction data.

Sources: [Stripe reporting](https://docs.stripe.com/reports),
[payout reconciliation](https://docs.stripe.com/reports/payout-reconciliation),
[payouts](https://docs.stripe.com/payouts).

## Pattern catalog

These are the patterns that transfer to a one-file, one-run report. Each one
names its source, the Tolkira use, and whether it needs history.

### 1. Reconcile every number to the rows it counts

**Seen in:** Stripe (summary vs itemized; clickable amounts), ReportPortal
(Total/Passed/Failed counts are links), GitLab (test summary counts).

**What it does:** a number is not a decoration. Clicking it produces exactly
the rows it counted. The summary and the itemized view use the same scope.

**Tolkira use:** status chips and run-summary counts filter the list. When a
filter is active, show `Showing <n> of <m> scenarios`; the failed count and the
visible failed rows must agree. Keep a visible `All` that states whether it
includes skipped/undefined rows. Do not show a total that cannot be opened.

**History needed:** No.

### 2. Exception queue with a reason badge

**Seen in:** Cypress Cloud "Tests for Review" (Failed → Flaky → Modified, with
a badge), Sentry "For Review", Trunk's test table sorted by PRs impacted.

**What it does:** the first screen is a short queue of items that need a human,
ordered by a stated rule, with a reason for each item. It is not a chart and
not the full inventory.

**Tolkira use:** a **Needs attention** block or saved filter containing failed,
pending, undefined and ambiguous scenarios. Each row carries a reason: "failed
at step 4", "undefined step", "ambiguous match", "pending", "hook failed".
Order failed first, then the other non-passed statuses; do not invent a
priority score. "Flaky" is allowed only when the run itself contains a retry
that passed and the input preserves attempts; cross-run flake is not available.

**History needed:** No for the queue and reasons. Within-run retry evidence is
a one-run fact; cross-run flake is not.

### 3. Worst-child rollup, with "unknown/no data" separate

**Seen in:** Grafana (rule state = worst instance; rule health separate for
`Error`/`NoData`), Trunk (Broken > Flaky > Healthy), Surefire (errors vs
failures), NUnit (result + label + site).

**What it does:** a parent status is the worst child status, and the product
keeps "could not evaluate" distinct from "failed". The reader can see which
level is unhealthy without opening every child.

**Tolkira use:** run status = worst scenario status; feature status = worst
scenario in that feature. Keep `undefined`, `ambiguous` and `unknown` as their
own labels; never fold them into `skipped` or `failed` silently. A feature row
shows counts, a proportional bar and a text status. Add a one-line legend for
the Cucumber statuses.

**History needed:** No.

### 4. Scope banner: lifetime counts vs filtered counts

**Seen in:** Sentry (header counts are lifetime; graph counts follow the
filter), Buildkite (a widget warns when it ignores a filter), Datadog (facets
and query bar stay in sync).

**What it does:** the reader always knows what the current view is filtered by,
and which numbers are totals versus matches.

**Tolkira use:** when search or a status/tag filter is active, show a compact
scope line above the list: `Showing <n> of <m> · Failed · @smoke · "expired"`.
Keep the run totals visible, and label them as totals. Clearing the filter
returns to the full set. Put the filter state in the URL hash so a copied link
preserves the scope.

**History needed:** No.

### 5. Failure-cause cross-cut

**Seen in:** Cypress Cloud "Errors" tab, Trunk "Failure Types" grouped by
stack-trace summary, Sentry issue grouping.

**What it does:** failures are grouped by what went wrong, not only by where
they live. The reader can see that many red rows are one cause or many.

**Tolkira use:** group failed scenarios by a deterministic signature: the first
line of the error message plus the top stack frame, with volatile values
(URLs, IDs, timestamps) optionally masked by a documented rule. Show the group
size and the features it touches; clicking a group filters the scenario list.
Label it "Grouped by error text", not "root cause". Keep an "ungrouped" bucket
for failures with no usable message or frame.

**History needed:** No. A single run usually carries an error message or stack
trace; group when present, and say when it is not.

### 6. Concentration across dimensions

**Seen in:** Honeycomb BubbleUp (selection vs baseline across fields), Vercel
(routes sorted by error rate or duration), Datadog (group-by facets).

**What it does:** the product compares the problem set with the rest of the
data across dimensions, so the reader can see where the problem is concentrated
rather than only that it exists.

**Tolkira use:** a small table of failed-vs-all by feature, tag and source file;
sort by failed count or failure share; each row links to the filtered list.
Label the denominator: `<failed> of <total> failed in this run (<share>)` is a
one-run share, not a historical failure rate. Do not draw a trend line.

**History needed:** No for the one-run comparison. A trend needs history.

### 7. Stable identity for anchors, filters and retries

**Seen in:** Datadog test fingerprint/FQN, Buildkite grouping retries by test,
Cypress matching spec path + test title, ReportPortal test-case hash.

**What it does:** the product identifies a test across retries, filters and
links by a stable key, not by its position in a list or its current display
name.

**Tolkira use:** derive a deterministic scenario key from feature URI +
scenario name + outline row index; keep the attempt as a separate dimension for
retries. Use it for the HTML `id`, deep links, filter state and retry grouping.
0.2 currently uses display-order anchors; stable identity is the post-0.2
upgrade. Do not use array indexes. Document that renaming a scenario changes its
identity, so links are not promised across renames.

**History needed:** No, but it is the prerequisite for any future baseline or
history feature.

### 8. Keyboard-first with a discoverable help sheet

**Seen in:** Trunk (`Cmd/Ctrl + K`), Honeycomb (`?` opens shortcuts), and the
[Jenkins command palette](https://www.jenkins.io/doc/book/using/searchbox/).

**What it does:** the product exposes the few actions a frequent user needs
without forcing a mouse, and makes the keys discoverable.

**Tolkira use:** `?` opens a shortcut sheet; `/` focuses search; `f` selects
failed; `p` selects passed; `j`/`k` moves to the next/previous scenario; `Esc`
clears the filter. Keep visible labels next to icon controls. A full command
palette is optional; a static report has too few commands to justify a
registry.

**History needed:** No.

### 9. Outcome is not cause, priority or ownership

**Seen in:** ReportPortal (execution status + defect type), Sentry (status +
priority + assignee), GitHub code scanning (severity + security severity),
Trunk (status + quarantine + ticket).

**What it does:** the product keeps independent axes independent. A failed test
is not automatically "high severity"; a flaky test is not automatically
"owned"; a broken test is not automatically "quarantined".

**Tolkira use:** keep the Cucumber status as the outcome. Add a cause only when
the data supports it (error text, failure site, undefined step). Add an owner
only when the input or an explicit mapping supplies one. Do not derive severity
from pass rate or status. If tags such as `@critical` exist, show them as tags,
not as a computed severity.

**History needed:** No for outcome and cause. Ownership needs external
metadata; priority/severity needs an explicit source.

### 10. Render only the exception sections that exist, and say zero explicitly

**Seen in:** Stripe (Failed payouts only if present), Cypress Tests for Review,
GitLab Test summary.

**What it does:** the product does not render empty sections for their own sake.
When there is nothing to show, it says so or omits the section.

**Tolkira use:** hide `undefined`, `ambiguous` and retry blocks when their
count is zero; do not show an empty "Errors" card. If the run has no failures,
show a clear "No failures" state with the pass count and duration, not a blank
screen. Keep the zero in the run inventory if it is meaningful.

**History needed:** No.

## Patterns that only work with a server, history or accounts

These are good patterns in their own products. They must not be copied into a
one-file, one-run report as if the data existed.

| Pattern | Sources | Why it cannot work now | Honest alternative |
| --- | --- | --- | --- |
| Cross-run history: first/last seen, regression, "failed n times", new/existing/resolved | Sentry, GitLab, Jenkins, ReportPortal, Datadog, Cypress | Needs multiple runs, a stable test identity and a time window | Show run-scoped facts: first failing step, attempt count, current status. Do not label them "first seen" or "new". An optional `--baseline` against a previous summary is the explicit later step. |
| Trend, sparkline, reliability, flake rate | Buildkite, Trunk, Cypress, ReportPortal, Jenkins | A trend needs a defined series; one run has no series | Show a one-run distribution or share, clearly labeled as such. Do not call pass rate "reliability". |
| Quarantine, mute, auto-retry | Trunk, Buildkite, Cypress, Datadog | Needs write-back to CI and cross-run classification; a report cannot change what runs | Show a supplied "quarantined" label only if the input carries it; never invent one. |
| Ownership, assignment, ticketing | Sentry, ReportPortal, Trunk, Buildkite, Datadog | Needs accounts, CODEOWNERS or an issue tracker | Accept an explicit owner mapping as metadata if the user supplies one; do not infer it from a feature path. |
| Server-side query, saved views, live updates | Datadog, Sentry, Buildkite, Cypress, ReportPortal, Vercel | Needs a server, accounts and live data | Static facets plus URL hash state; a copied link is the saved view. |

## Modernization honesty check

Several ideas commonly presented as "modern test reporting" come from
observability or project tools. Some are honest in a one-run artifact; some
are not. This is the explicit check.

| Idea | Source | Honest without cross-run history? | What Tolkira should do |
| --- | --- | --- | --- |
| Exception-first triage | Cypress, Sentry, Trunk | **Yes** | Build a needs-attention queue from failed, pending, undefined and ambiguous scenarios, with a reason badge and the first failing step. |
| First/last seen | Sentry, GitLab, Jenkins | **No** | Do not show it. It is a cross-run fact. A run-scoped "first failing step" is a different thing and must be named that way. |
| Quarantine | Trunk, Buildkite, Cypress | **No** | Do not show a quarantine badge or action. A report cannot stop a test from running. |
| Owner | Sentry, Trunk, Buildkite, Datadog | **Conditional** | Only if the input or an explicit mapping supplies it. A static label is acceptable; assignment is not. |
| Trend sparkline | Trunk, Buildkite, Cypress | **No** | Do not draw one. A one-run distribution bar is honest if labeled as a distribution, not a trend. |
| Severity filters | GitHub code scanning, Sentry, Cypress | **Conditional** | Only if severity is explicit in the input (for example a tag or metadata field). Cucumber has no standard severity; do not compute one from status or pass rate. |
| Keyboard command palette | Trunk, Honeycomb, Jenkins | **Yes** | Add a shortcut sheet and the few high-value keys. A full palette is optional and lower value than search/filter. |
| Flaky badge | Cypress, Trunk, Buildkite, Datadog | **Within-run only** | "Passed on retry" is a one-run fact and can be shown. "Flaky" as a historical rate is not available. |
| Reliability / failure rate | Buildkite, Trunk, Cypress, Datadog | **No** | One run gives a pass rate or a one-run share. Do not call either "reliability" or a historical failure rate. |
| New vs existing / resolved | GitLab, Cypress, Sentry | **No** (needs a second run) | Keep the wording out until an explicit baseline exists. A future `--baseline` summary is the honest path. |
| Modified tests | Cypress | **No** | Needs the previous test definition. Do not infer "modified" from a name change. |
| Health score | Jenkins, Linear | **No** | Jenkins computes a configurable build-health contribution; Linear health is human-authored. Do not invent a test "health score". |
| Error grouping / fingerprint | Sentry, Trunk | **Partly** | A deterministic signature (first error line + top frame) is honest if labeled. An AI/ML grouping is not needed and not verifiable offline. |
| Saved views | Datadog, Buildkite, Sentry | **Yes, via URL** | Put filter/search/selection state in the hash. A copied link is the saved view; no account needed. |

## Ranked shortlist for after 0.2

Ranked by value for the one-file artifact, cost, and whether the data is
available without history. Costs are rough engineering size, not calendar
estimates.

| Rank | Improvement | User question it answers | Cost | History? | Why this rank |
| --- | --- | --- | --- | --- | --- |
| 1 | **Scope banner and reconciled counts** | "What am I looking at, and do these numbers add up?" | S | No | Cheapest trust fix. Makes every later filter, cause view and share link honest. Status counts become filters; `Showing n of m`; totals stay visible. |
| 2 | **Failure-cause view** | "Are these failures one bug or many?" | M | No | A single run usually has enough error text for deterministic grouping. It changes triage from row-by-row to cause-by-cause, and links back to the rows. |
| 3 | **Needs-attention queue with reason badges** | "What needs attention now, and why?" | M | No | Builds on the 0.2 overview. Uses failed/pending/undefined/ambiguous and the first failing step; no invented priority. |
| 4 | **Stable scenario identity for durable deep links** | "Can I send this exact failure to someone?" | S-M | No | Required for shareable one-file reports and for any future baseline. Use feature URI + scenario name + outline row; never array indexes. |
| 5 | **Optional baseline diff against a previous summary** | "Is this failure new, pre-existing or resolved?" | L | **Yes, a second run/file — not a server** | The first honest history feature. It must be explicit (`--baseline`), versioned against the summary schema, and silent when no baseline is supplied. |

Not in the top five, but cheap and worth folding into the search/filter work:
the keyboard shortcut sheet. A full command palette is not justified by the
number of actions in a static report.

## What this means for the first screen

The indirect sources reinforce the direct-competitor conclusion, with a sharper
emphasis on triage and reconciliation:

1. **Run verdict and scope first.** One line for pass/fail counts, duration and
   the active filter. The reader should never wonder whether the counts are
   totals or matches.
2. **A needs-attention queue, not a chart wall.** Failed, pending, undefined and
   ambiguous scenarios with a reason badge and the first failing step. Failed
   rows open; passed rows collapse.
3. **Cause and concentration are second-level lenses.** A compact
   "failure causes" table and a "failed vs all" breakdown by feature/tag. Both
   are one-run facts and both link back to the filtered rows.
4. **Detail stays in context.** A scenario disclosure keeps steps, error, doc
   string/data table, attachments and attempts together. A separate page or a
   server route is not needed.
5. **Do not fake the missing axes.** No first/last seen, no trend, no flake
   rate, no owner, no quarantine, no severity unless the input supplies it.
   Saying "not in this report" is better than a confident lie.

A compact shape:

```text
Run: <n> scenarios · <duration> · <passed> passed / <failed> failed / <other> other
Showing <n> of <m> · filters: <status/tag/search>              [clear]
Needs attention (<n>)
  ✕ <feature> — <scenario>     <reason> · <duration>
  …
Failure causes (one run)
  <error signature>            <n> scenarios · <n> features
Concentration (one run)
  <tag/feature>                <failed> of <total> failed (<share>)
```

The numbers are placeholders on purpose. This note does not claim a benchmark,
a target pass rate or a time saving.

## Open questions

- What error signature is stable enough to group failures without merging
  unrelated causes? First line + top frame is the starting point; masking rules
  need a written contract.
- Should "needs attention" be a separate block or a saved filter on the
  existing list? The 0.2 overview may already answer this.
- When a status filter is active, does `All` mean all scenarios or all
  non-skipped scenarios? The label must state the rule, as Playwright's
  `All` does not.
- How should `undefined`, `ambiguous` and `unknown` be grouped without a
  seven-chip filter row? A single "Other" facet with a breakdown is the likely
  answer.
- What is the minimum baseline format for a future `--baseline`? Reusing the
  versioned summary schema is cheaper than inventing a second history format.
- Does a one-file report need a command palette, or is a shortcut sheet plus
  search enough? The sources show command palettes in products with many
  commands; Tolkira has few.
- How do cause and concentration views stay small at 10k scenarios? Aggregate
  server-side; do not ship a second copy of every scenario.

## Sources

All accessed 2026-11-05.

### Observability, security and delivery

- Grafana: [dashboard best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/),
  [view alert state](https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-state/)
- Datadog: [CI Visibility Explorer](https://docs.datadoghq.com/continuous_integration/explorer/),
  [Test Optimization](https://docs.datadoghq.com/tests/),
  [Test Optimization Explorer](https://docs.datadoghq.com/tests/explorer/)
- Sentry: [Issues](https://docs.sentry.io/product/issues/),
  [Issue Details](https://docs.sentry.io/product/issues/issue-details/),
  [Issue status and triage](https://docs.sentry.io/product/issues/states-triage/)
- Honeycomb: [Query Builder](https://docs.honeycomb.io/investigate/query/),
  [BubbleUp](https://docs.honeycomb.io/investigate/analyze/identify-outliers/)
- GitHub: [visualization graph](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-the-visualization-graph),
  [workflow run history](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-run-history),
  [workflow commands and job summaries](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands),
  [code scanning alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/about-code-scanning-alerts),
  [resolving code scanning alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/managing-code-scanning-alerts-for-your-repository)
- Vercel: [Observability](https://vercel.com/docs/observability)

### Test-adjacent

- Maven Surefire: [plugin](https://maven.apache.org/surefire/maven-surefire-report-plugin/),
  [usage](https://maven.apache.org/surefire/maven-surefire-report-plugin/usage.html),
  [sample 1](https://maven.apache.org/surefire/maven-surefire-report-plugin/images/surefire-sample1.png),
  [sample 2](https://maven.apache.org/surefire/maven-surefire-report-plugin/images/surefire-sample2.png)
- GitLab: [unit test reports](https://docs.gitlab.com/ci/testing/unit_test_reports/)
- TestNG: [documentation](https://testng.org/),
  [EmailableReporter2.java](https://raw.githubusercontent.com/testng-team/testng/master/testng-core/src/main/java/org/testng/reporters/EmailableReporter2.java),
  [TestHTMLReporter.java](https://raw.githubusercontent.com/testng-team/testng/master/testng-core/src/main/java/org/testng/reporters/TestHTMLReporter.java)
- NUnit: [test result XML](https://docs.nunit.org/articles/nunit/technical-notes/usage/Test-Result-XML-Format.html),
  [console runner](https://docs.nunit.org/articles/nunit/running-tests/Console-Runner.html)
- ReportPortal: [docs](https://reportportal.io/docs/),
  [view launches](https://reportportal.io/docs/work-with-reports/ViewLaunches/),
  [investigation of failure](https://reportportal.io/docs/work-with-reports/InvestigationOfFailure/),
  [history of launches](https://reportportal.io/docs/work-with-reports/HistoryOfLaunches/)
- Jenkins: [JUnit plugin](https://plugins.jenkins.io/junit/),
  [JUnit pipeline step](https://www.jenkins.io/doc/pipeline/steps/junit/),
  [JUnit graph](https://wiki.jenkins.io/display/JENKINS/JUnit+graph),
  [command palette](https://www.jenkins.io/doc/book/using/searchbox/)
- Buildkite: [Test Engine overview](https://buildkite.com/docs/test-analytics),
  [test suites](https://buildkite.com/docs/pipelines/configure/tests/test-suites)
- Trunk: [Flaky Tests overview](https://docs.trunk.io/flaky-tests),
  [dashboard](https://docs.trunk.io/flaky-tests/dashboard),
  [detection](https://docs.trunk.io/flaky-tests/detection)
- Cypress: [recorded runs](https://docs.cypress.io/cloud/features/recorded-runs),
  [flaky test management](https://docs.cypress.io/cloud/features/flaky-test-management),
  [project analytics](https://docs.cypress.io/cloud/features/analytics/project-analytics)

### General product and analytics

- Linear: [projects](https://linear.app/docs/projects),
  [project status](https://linear.app/docs/project-status),
  [initiative and project updates](https://linear.app/docs/initiative-and-project-updates)
- Stripe: [reporting](https://docs.stripe.com/reports),
  [payout reconciliation](https://docs.stripe.com/reports/payout-reconciliation),
  [payouts](https://docs.stripe.com/payouts)

### Tolkira context

- `docs/research/report-ui-patterns.md` — direct competitors and the 0.2
  composition.
- `docs/research/hierarchy-overview.md` — run/feature/scenario hierarchy.
- `docs/PRODUCT.md` — scope, non-goals and the one-file/offline promise.
- `docs/AGENT-INTERFACE.md` — summary schema and CLI contract.
