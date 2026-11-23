# Spec Delta

## ADDED Requirements

### Requirement: Add an opt-in static report mode

The CLI SHALL accept `--static` and the render API SHALL accept `static: true`.
The mode SHALL require `--out` or `--pdf`, SHALL default off, and SHALL leave
the default report, JSON, CI and email bytes unchanged. `--static` SHALL compose
with `--baseline` when both are supplied.

#### Scenario: Static report with HTML

- **WHEN** `--static --out report.html` is used
- **THEN** the report is written and the process exits 0
- **AND** the report is the static form

#### Scenario: Static mode without a report surface

- **WHEN** `--static` is used with `--json`, `--ci` or `--email` and without
  `--out` or `--pdf`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`
- **AND** nothing is written

#### Scenario: Static PDF

- **WHEN** `--static --pdf report.pdf` is used
- **THEN** the PDF is rendered from the static HTML
- **AND** the HTML source used for the PDF contains no `<script>`

#### Scenario: Static report with a baseline

- **WHEN** `--static --baseline previous.json --out report.html` is used with a
  valid schema-2 baseline
- **THEN** the process exits 0
- **AND** the report is the static form
- **AND** the baseline comparison panel is visible without JavaScript

#### Scenario: Help lists the option

- **WHEN** `--help` is requested
- **THEN** the usage text lists `--static`

### Requirement: Render the static report without scripts

The static report SHALL contain no `<script>` element, no client-message block
and no print script. Its CSP SHALL use `script-src 'none'` and SHALL keep
`connect-src 'none'` with no allowed source, `default-src 'none'`,
`img-src data: blob:`, `media-src data: blob:`, inline styles and
`font-src data:`.

#### Scenario: No scripts

- **WHEN** the static report is inspected
- **THEN** it contains no `<script>` element
- **AND** the CSP contains `script-src 'none'`
- **AND** it contains no client-message JSON block
- **AND** the CSP contains `connect-src 'none'` with no allowed source

#### Scenario: Hostile text does not execute

- **WHEN** a scenario, feature or attachment name contains a script payload
- **THEN** the text renders escaped
- **AND** no script or markup executes

#### Scenario: Offline

- **WHEN** the static report is opened with the network disabled
- **THEN** every label, table, image and open detail renders
- **AND** no request is made

### Requirement: Expand every detail and stack every view

The static report SHALL open every `<details>` element, render Report, Details
and Trends as visible stacked sections, omit the tab bar and every
`role="tab"`/`role="tabpanel"`, and contain exactly one `<main>`. It SHALL keep
the `report-view`, `analysis-view` and `trends-view` IDs so the print page-break
rule still applies.

#### Scenario: All details open

- **WHEN** a static report contains a passed scenario, an unexecuted row, a hook
  group, an earlier-attempts block, a text attachment and a triage rest list
- **THEN** every one of those `<details>` elements carries `open`
- **AND** the passed scenario content is visible without a click

#### Scenario: Stacked views with history

- **WHEN** a static report has two or more history runs
- **THEN** the Report, Details and Trends sections are all visible
- **AND** the document has no tab bar, no `role="tab"` or `role="tabpanel"` and
  exactly one `<main>`
- **AND** the `report-view`, `analysis-view` and `trends-view` IDs are present

#### Scenario: No Trends without history

- **WHEN** the static report has no history or one run
- **THEN** the Trends section is absent
- **AND** Report and Details are visible

#### Scenario: Bookmarked filter URL

- **WHEN** the static report is opened with `?query=`, `?hide=` or `?tag=`
- **THEN** every row stays visible
- **AND** no filter or highlight is applied
- **AND** no script is needed to show the full report

### Requirement: Remove dead controls and dangling ARIA

The static report SHALL omit the lightbox dialog, the image lightbox buttons,
the copy-failure buttons and the search/filter toolbar. It SHALL have no
`aria-labelledby` or `aria-controls` that points at a removed element.

#### Scenario: No lightbox and no dead controls

- **WHEN** the static report contains an image attachment and a failed scenario
- **THEN** the image is visible inline in the open detail body
- **AND** it is not wrapped in a lightbox button and no lightbox dialog is
  rendered
- **AND** no copy-failure button is rendered
- **AND** no `[data-search]`, `[data-tag-filter]`, `[data-filter-status]` or
  `[data-filter-preset]` control is rendered

#### Scenario: No dangling ARIA

- **WHEN** the static document is inspected
- **THEN** every `aria-labelledby` and `aria-controls` value resolves to an
  element ID in the document

### Requirement: Keep the static report readable and safe

The static report SHALL keep escaped test text, inline images, counts, tables
and localized labels; SHALL make no network request; and SHALL not scroll
horizontally at 320 px or 200 % text.

#### Scenario: German static report

- **WHEN** `--static --locale de` is used
- **THEN** the report labels, counts and headings are German
- **AND** test data and Gherkin keywords are unchanged

#### Scenario: Narrow viewport

- **WHEN** the static report is opened at 320 px and 200 % text
- **THEN** the page has no horizontal overflow
- **AND** the sections and open detail text are visible

### Requirement: Keep the default report and budgets unchanged

Without the flag, the HTML SHALL be byte-identical to before, the client bundle
SHALL stay under 16 KB, and the current no-JS behaviour (inert tabs, closed
details) SHALL remain. No runtime dependency SHALL be added. The default
report's pre-existing multiple `<main>` elements SHALL stay unchanged in this
release; the defect is recorded as B-048.

#### Scenario: Default characterization

- **WHEN** the standard fixtures are rendered without `--static`
- **THEN** the committed characterization hashes and golden HTML are unchanged
- **AND** the client bundle stays under 16 KB

#### Scenario: Default no-JS

- **WHEN** the default report is opened without JavaScript
- **THEN** the active Report view is visible
- **AND** Details and Trends stay inert like today
- **AND** closed details stay closed

#### Scenario: Default multiple main unchanged

- **WHEN** a default report with two history runs is inspected
- **THEN** it keeps its three `<main>` elements
- **AND** the default bytes match the characterization hash

#### Scenario: Dependency surface

- **WHEN** the change is complete
- **THEN** no runtime dependency is added
- **AND** the report still makes no network request

## MODIFIED Requirements

### Requirement: Show summary and detailed test results

The default report SHALL show pass/fail/skipped/pending counts, total duration,
features, scenarios, steps, hooks, errors and stack traces. Its default view
SHALL remain a single-column report; deeper details SHALL be available in a
separate Details view reached through the Details tab. The static report SHALL
show the same Report and Details content as stacked sections with no tab bar.

#### Scenario: Simple report is the default

- **WHEN** the generated report is opened
- **THEN** the Report tab shows the run summary and feature/scenario details
  without a permanent sidebar or detail pane

#### Scenario: Failed scenario is visible

- **WHEN** the input contains a failed scenario
- **THEN** its feature and scenario are open by default and the failure and
  screenshot are visible inline

#### Scenario: Hooks are visible

- **WHEN** the input contains before/after hooks
- **THEN** the report shows their results with the scenario

#### Scenario: Details are optional

- **WHEN** the user opens the Details tab in the default report
- **THEN** the report shows feature counts, status distribution, environment,
  run metadata and the agent summary without changing the Report tab

#### Scenario: Static Details

- **WHEN** the static report is opened
- **THEN** the Details content is visible as a stacked section
- **AND** no tab bar or Details tab is rendered

### Requirement: Search and filter results

The report SHALL allow the user to search by text and filter by status and tag
in the default report. The static report SHALL render every scenario with no
search box and no status or tag filter.

#### Scenario: Search finds a scenario

- **WHEN** the user searches for a scenario name
- **THEN** the matching scenario remains visible and non-matching scenarios are
  hidden

#### Scenario: Status filter

- **WHEN** the user filters to failed results
- **THEN** only failed scenarios remain visible

#### Scenario: Static full report

- **WHEN** the static report is opened
- **THEN** every scenario is visible
- **AND** no search box, status filter or tag filter is rendered

### Requirement: Filter scenarios by tag

The default report SHALL provide a tag filter in the Report toolbar when the run
contains tags. The filter SHALL combine with text search and status filters and
SHALL update the visible count and empty state. The static report SHALL omit the
toolbar and the tag filter; tagged rows stay visible.

#### Scenario: Filter by one tag

- **WHEN** the user selects a tag
- **THEN** only scenarios carrying that tag remain visible
- **AND** features with no matching scenario are hidden
- **AND** the live region reports the new visible count

#### Scenario: Combine tag and status filters

- **WHEN** a tag and a status filter are active
- **THEN** a scenario is visible only when it matches both

#### Scenario: Static tag filter

- **WHEN** the static report has tagged scenarios
- **THEN** no tag filter control is rendered
- **AND** every tagged row stays visible

### Requirement: Highlight search matches

The default report SHALL visually highlight matching text in visible scenarios
when a search query is active, and SHALL clear the highlight when the query is
empty. The static report SHALL have no search query and SHALL render no
highlight.

#### Scenario: Search finds visible text

- **WHEN** the user enters a query of at least two characters
- **THEN** matching text inside visible scenarios is highlighted
- **AND** the highlight is removed when the query is cleared

#### Scenario: Browser lacks the Highlight API

- **WHEN** the browser does not support `CSS.highlights`
- **THEN** the report still filters and opens matching scenarios without
  throwing an error

#### Scenario: Static highlight

- **WHEN** the static report is opened
- **THEN** no search highlight is rendered
- **AND** no script is present to apply one

### Requirement: Copy a failure summary

The default report SHALL offer a copy action on failed scenarios that copies
the feature, scenario, URI, failed step and error message as plain text. The
static report SHALL render no copy-failure control.

#### Scenario: Copy a failed scenario

- **WHEN** the user activates "Copy failure" on a failed scenario
- **THEN** the clipboard receives a readable text summary
- **AND** the control confirms success without changing the failure content

#### Scenario: Passed scenario

- **WHEN** a scenario passed
- **THEN** no copy-failure control is rendered for it

#### Scenario: Clipboard is unavailable

- **WHEN** the clipboard API and the fallback both fail
- **THEN** the control reports failure politely and does not throw
- **AND** keyboard focus stays on the control

#### Scenario: Static copy control

- **WHEN** the static report contains a failed scenario
- **THEN** no copy-failure control is rendered
- **AND** the failure text stays visible

### Requirement: Collapse passed hooks

In the default report, passed per-scenario hooks SHALL be collapsed behind a
disclosure labelled with the number of hooks. Failed and other non-passing hooks
SHALL remain inline. The static report SHALL open the passed-hooks disclosure
with every other `<details>`.

#### Scenario: Passed hooks are collapsed

- **WHEN** a scenario has two passed hooks and no failed hook
- **THEN** the scenario shows one `2 hooks` disclosure
- **AND** the hook rows are hidden until the disclosure is opened

#### Scenario: Non-passing hooks stay visible

- **WHEN** a scenario has one passed and one failed hook
- **THEN** the failed hook is visible inline
- **AND** the passed hook remains behind the hooks disclosure

#### Scenario: Skipped hooks are kept

- **WHEN** a hook is skipped
- **THEN** it remains visible inline because it explains the skipped result
- **AND** this deliberate difference from the official step filter is
  documented

#### Scenario: Static passed hooks

- **WHEN** the static report contains a passed-hook group
- **THEN** the group's `<details>` carries `open`
- **AND** the hook rows are visible without a click

### Requirement: Open non-passed results by default

The default report SHALL open features and executed scenarios whose status is
not `passed` by default, including undefined, ambiguous, pending, skipped and
unknown results. A feature whose scenarios are all unexecuted SHALL open by
default, while its unexecuted rows SHALL remain collapsed and show no outcome.
The search auto-open cap SHALL remain in force. The static report SHALL open
every feature and every scenario, including passed and unexecuted rows; the
search auto-open cap does not apply because there is no search.

#### Scenario: Undefined scenario

- **WHEN** a feature contains an undefined scenario
- **THEN** the feature and the undefined scenario are open
- **AND** its diagnostic is visible without a click

#### Scenario: Pending and skipped scenarios

- **WHEN** a feature contains pending or skipped scenarios
- **THEN** those scenarios are open by default
- **AND** passed scenarios remain collapsed

#### Scenario: Unexecuted scenario

- **WHEN** a scenario has no raw test-step result
- **THEN** its row stays collapsed and shows no status label
- **AND** when every scenario in its feature is unexecuted, the feature opens

#### Scenario: Search cap

- **WHEN** a search matches more than 20 scenarios
- **THEN** at most 20 newly matched scenarios are opened by the search
- **AND** the existing "20 of N" note is shown only when 20 new rows were opened

#### Scenario: Static all rows open

- **WHEN** the static report contains a passed scenario and an unexecuted
  scenario
- **THEN** both scenario `<details>` elements carry `open`
- **AND** the unexecuted row still shows no outcome

### Requirement: Preserve example outcomes and navigation

Grouping SHALL change presentation only. Each executed example SHALL keep its
own outcome, duration, steps, attachments and anchor, and SHALL remain part of
the existing counts, triage membership, status matrix and JSON summary. In the
static report an image attachment SHALL render inline in the open detail body
with no lightbox dialog.

#### Scenario: Failed example is visible

- **WHEN** one example fails and another passes in the same examples block
- **THEN** the failed row is open by default and shows its failed step, error
  and attachments
- **AND** the passed row remains collapsed

#### Scenario: Attachments stay with their example

- **WHEN** two examples in one outline each have an image attachment
- **THEN** each row shows only its own image and attachment count
- **AND** in the default report, opening an image still uses the lightbox

#### Scenario: Counts still count every example

- **WHEN** an outline with four executed examples is rendered
- **THEN** the summary, feature bar, status matrix and triage index count four
  scenarios, not one outline
- **AND** the JSON summary counts are unchanged because they are computed from
  envelopes

#### Scenario: Triage identifies the example

- **WHEN** two failing examples share the same pickle name
- **THEN** each triage label includes its example number
- **AND** when the examples block has a name, the label includes that name
- **AND** each triage link opens the correct grouped example row

#### Scenario: Copy failure keeps the scenario identity

- **WHEN** the user copies a failure from a grouped example in the default
  report
- **THEN** the copied text contains the substituted scenario name, the example
  number and the examples block name when present
- **AND** it still contains the feature, URI, failed step and error message

#### Scenario: Anchor opens the grouped example

- **WHEN** the user opens a `#scenario-...` link for an example row
- **THEN** the feature, outline and examples ancestors are revealed
- **AND** the example row is focused and scrolled into view

#### Scenario: Retry keeps one row per example

- **WHEN** an example was retried
- **THEN** the report shows one row with the latest attempt
- **AND** it does not render duplicate `#1.1` headings

#### Scenario: Static image

- **WHEN** the static report contains an example image
- **THEN** the image renders inline in the open example body
- **AND** no lightbox dialog or image button is rendered

### Requirement: Show a Trends view

When at least two history entries are passed, the default shell SHALL render a
third `Trends` tab with a table of the latest runs (newest first) and an inline
SVG sparkline of the pass rate. The table SHALL carry the data accessibly; the
sparkline SHALL be decorative. With no history or one entry, no Trends tab
SHALL be rendered. The static report SHALL render the Trends table and
sparkline as a stacked section with no tab, visible without JavaScript; with no
history or one entry the section SHALL be absent.

#### Scenario: Two runs

- **WHEN** the history has two or more entries
- **THEN** the default report's tab bar shows Report, Details and Trends
- **AND** the Trends view lists the runs newest first
- **AND** the pass rate uses attempted (non-skipped) scenarios

#### Scenario: No attempt in a run

- **WHEN** a run has no attempted scenarios
- **THEN** its pass rate is shown as `—`
- **AND** the sparkline omits that point and draws no line with fewer than two
  points remaining

#### Scenario: Sparkline order

- **WHEN** the sparkline is rendered
- **THEN** it plots the runs by recorded time ascending, oldest to newest
- **AND** it uses a fixed viewBox and non-scaling strokes for 200 % zoom

#### Scenario: Table region

- **WHEN** the table is rendered
- **THEN** it sits in a labelled, focusable region and scrolls at narrow widths
- **AND** its header cells are scoped

#### Scenario: No or one run

- **WHEN** the history is absent or has one entry
- **THEN** no Trends tab is rendered in the default report
- **AND** the Report and Details tabs are unchanged

#### Scenario: Narrow viewport

- **WHEN** the Trends view is opened at 320 px
- **THEN** the table scrolls inside its region
- **AND** the page does not scroll horizontally

#### Scenario: No JavaScript

- **WHEN** the default report is opened without JavaScript
- **THEN** the Report view stays visible
- **AND** the Trends tab is inert like Details

#### Scenario: Static Trends

- **WHEN** the static report has two or more history runs and JavaScript is
  disabled
- **THEN** the Trends table and sparkline are visible
- **AND** no Trends tab is rendered

### Requirement: Localize the server-rendered shell

The default shell SHALL render its tabs, headings, toolbar, filters, buttons,
empty states, footer, status labels and accessibility names from the active
locale catalog. `<html>` SHALL carry the resolved `lang` and `dir`. Test data
SHALL render unchanged. The default no-JS report SHALL keep the localized Report
view. The static report SHALL keep every present section's headings, labels and
accessibility names localized and SHALL keep `<html lang>` and `dir`; test data
SHALL render unchanged.

#### Scenario: German shell

- **WHEN** the German report is opened
- **THEN** Report, Details and Trends, the toolbar, filters and footer are
  German
- **AND** the search and filter accessibility names are German
- **AND** feature and scenario text is unchanged

#### Scenario: Synthetic labels and input text

- **WHEN** a German report shows a feature, scenario, attempt or start time
- **THEN** the synthetic labels (`Feature:`, `Scenario:`, `Attempt:`,
  `Started:` and similar) are German
- **AND** the Gherkin keyword, feature/scenario name, step text and tags render
  verbatim
- **AND** a hostile name is escaped and never becomes markup

#### Scenario: No JavaScript

- **WHEN** the default German report is opened without JavaScript
- **THEN** the Report view is visible and German
- **AND** Details and Trends stay inert like today

#### Scenario: Static no JavaScript

- **WHEN** the static German report is opened without JavaScript
- **THEN** the Report, Details and present Trends sections are visible and
  German
- **AND** `<html lang>` is the resolved tag

### Requirement: Print the complete report

With JavaScript, printing SHALL include the Report, Details and Trends panels
when present and open every closed `<details>`. The static report SHALL print
every present section and open detail with no tab bar and one `<main>`. The
default report without JavaScript or `beforeprint` support SHALL print the
active Report view with closed details unchanged.

#### Scenario: Complete print

- **WHEN** the report is printed with JavaScript
- **THEN** all present tab panels and all details are visible in the print
- **AND** the active panel remains unchanged and the previous detail state
  returns afterwards in browsers that fire `afterprint`

#### Scenario: Static print

- **WHEN** the static report is printed without JavaScript
- **THEN** every present section and open detail is included
- **AND** each present view starts on a new page
- **AND** no tab bar is printed

#### Scenario: No JavaScript

- **WHEN** the default report is printed without JavaScript
- **THEN** the active Report view prints
- **AND** Details and Trends stay hidden
- **AND** closed details stay closed

#### Scenario: No Trends panel

- **WHEN** the report has no history
- **THEN** printing includes Report and Details only
- **AND** no empty Trends page is produced
