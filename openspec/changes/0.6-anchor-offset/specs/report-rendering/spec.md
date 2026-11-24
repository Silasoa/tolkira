## ADDED Requirements

### Requirement: Keep anchored targets clear of the sticky topbar

The report client SHALL measure the rendered `.topbar` height on load and on
every hash change and SHALL set the root `scroll-padding-top` to that height
plus 8 px before it scrolls an anchored target into view. The static CSS
`scroll-padding-top` values SHALL stay as the no-JS fallback. The measured
offset SHALL hold at every gate viewport and at 200 % text zoom, including a
three-row bar with wider fallback fonts, and SHALL keep the client bundle under
its 16 KB budget.

#### Scenario: Wrapped three-row bar

- **WHEN** the Trends report is opened at 320 px and 200 % text zoom and the tab
  strip wraps the topbar onto three rows
- **THEN** an anchored scenario's top edge sits at least 8 px below the bar's
  bottom edge

#### Scenario: Hash change

- **WHEN** the hash changes while the report is open
- **THEN** the offset is re-measured before the target scrolls into view

#### Scenario: No JavaScript

- **WHEN** the report is opened with JavaScript disabled
- **THEN** the static CSS `scroll-padding-top` values still apply
- **AND** the report remains readable without the measurement

#### Scenario: Budget

- **WHEN** the client bundle is built
- **THEN** it stays under 16,000 B

## MODIFIED Requirements

### Requirement: Keep the default report and budgets unchanged

Without the flag, a report without a Trends section SHALL keep its content,
markup and CSS unchanged from before the 0.6.0 changes. The release's only
default-document delta SHALL be the measured scroll-offset script described by
the anchor requirement: the client bundle grows from 15,268 B to 15,438 B, so
the document grows by 170 B. A default report with two or more history runs
SHALL gain the Trends shell CSS (task 3.5) and otherwise keep the same content.
The client bundle SHALL stay under 16 KB, and the current no-JS behaviour (inert
tabs, closed details) SHALL remain. No runtime dependency SHALL be added. The
default report's pre-existing multiple `<main>` elements SHALL stay unchanged in
this release; the defect is recorded as B-048.

#### Scenario: Default characterization

- **WHEN** the standard fixtures are rendered without `--static`
- **THEN** the committed characterization hashes and golden HTML match the
  document with the measured scroll-offset script
- **AND** the client bundle stays under 16 KB

#### Scenario: Default no-JS

- **WHEN** the default report is opened without JavaScript
- **THEN** the active Report view is visible
- **AND** Details and Trends stay inert like today
- **AND** closed details stay closed

#### Scenario: Default multiple main unchanged

- **WHEN** a default report with two history runs is inspected
- **THEN** it keeps its three `<main>` elements

#### Scenario: No-history default bytes

- **WHEN** a default report without a Trends section is rendered
- **THEN** its bytes match the committed characterization hash

#### Scenario: History default bytes

- **WHEN** a default report with two history runs is rendered
- **THEN** it contains the Trends shell CSS
- **AND** its bytes match the committed history characterization hash

#### Scenario: Dependency surface

- **WHEN** the change is complete
- **THEN** no runtime dependency is added
- **AND** the report still makes no network request

### Requirement: Render the baseline comparison panel

When a baseline is supplied, the Report view SHALL render one "Compared with
baseline" panel before the needs-attention index. It SHALL show the baseline
status, the four tracked counts, the ambiguous-group count when positive and a
"Not in this run" list of at most 10 entries; beyond 10 it SHALL state the
remaining count and point to `--json`. The panel SHALL be escaped, printable,
visible without JavaScript, stay visible with a filter active, and use a
conditional CSS string.

#### Scenario: Panel position

- **WHEN** a report with a baseline is rendered
- **THEN** the panel sits after the toolbar and live region and before the
  needs-attention index

#### Scenario: Panel counts and list

- **WHEN** the comparison has two new failures, one fixed, three still failing
  and one not in this run
- **THEN** the panel shows those four counts and the baseline status
- **AND** it lists the not-in-this-run scenario under "Not in this run" with its
  feature, scenario, optional example and baseline status
- **AND** no entry is a link

#### Scenario: Capped list

- **WHEN** 15 baseline scenarios are not in this run
- **THEN** the panel lists 10
- **AND** it states that 5 more are in the JSON summary and names `--json`
- **AND** the count remains 15
- **AND** no dead "more" control is rendered

#### Scenario: Filter active

- **WHEN** a search, status filter or tag filter is active
- **THEN** the comparison panel stays visible with its whole-run counts
- **AND** the triage index and source strip still hide

#### Scenario: Localized

- **WHEN** the report locale is German
- **THEN** the panel heading, counts, list label and badges use the German
  catalog
- **AND** the JSON keys and CI text stay English

#### Scenario: No JavaScript and print

- **WHEN** the report is opened with JavaScript disabled or printed
- **THEN** the panel, list and badges are visible
- **AND** no script is needed to read them

#### Scenario: Hostile baseline text

- **WHEN** a baseline name, feature or URI contains HTML, script text, control
  characters or an absolute path
- **THEN** it renders as escaped text
- **AND** an absolute URI is reduced by the display-URI rule
- **AND** no link, file path or script is created
- **AND** the report still makes no network request

#### Scenario: Narrow viewport

- **WHEN** the panel is rendered at 320 px and 200 % text zoom
- **THEN** it wraps without horizontal page overflow

#### Scenario: No baseline bytes

- **WHEN** a report is rendered without a baseline
- **THEN** no baseline panel, badge or baseline CSS rule is present
- **AND** the HTML is byte-identical to before the change apart from the
  measured scroll-offset script

#### Scenario: Baseline CSS

- **WHEN** a report is rendered with a baseline
- **THEN** the baseline CSS is appended to the report's style block
- **AND** the default `report.css` bytes are unchanged

### Requirement: Add an opt-in static report mode

The CLI SHALL accept `--static` and the render API SHALL accept `static: true`.
The mode SHALL require `--out` or `--pdf`, SHALL default off, and SHALL leave
the default report's content, markup and CSS unchanged apart from the
release-wide measured scroll-offset script; a default report with two or more
history runs also carries the documented Trends shell CSS. JSON, CI and email
bytes SHALL stay unchanged.

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

#### Scenario: Help lists the option

- **WHEN** `--help` is requested
- **THEN** the usage text lists `--static`
