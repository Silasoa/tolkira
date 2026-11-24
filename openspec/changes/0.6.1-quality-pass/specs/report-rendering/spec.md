# Spec Delta

## ADDED Requirements

### Requirement: Render one main landmark in the default report

The default report SHALL contain exactly one `<main>`, on the Report view. The
static report SHALL also contain exactly one `<main>`. The change SHALL preserve
tab roles, heading order and content. Apart from the Details metadata rule owned
by this change, it SHALL NOT change the layout at the gate viewports or at
320 px with 200 % text.

#### Scenario: Default report without Trends

- **WHEN** a default report with no history is inspected
- **THEN** it contains exactly one `<main>` and that element is inside
  `#report-view`
- **AND** `#analysis-view` exists and has no `<main>`
- **AND** no `#trends-view` is rendered
- **AND** the tab list still renders Report and Details

#### Scenario: Default report with Trends

- **WHEN** a default report with two history runs is inspected
- **THEN** it contains exactly one `<main>` and that element is inside
  `#report-view`
- **AND** `#analysis-view` and `#trends-view` each exist once, without a
  `<main>`
- **AND** the three tabpanels keep their roles, labels and document order

#### Scenario: Static report keeps one main

- **WHEN** a static report with two history runs is inspected
- **THEN** it contains exactly one `<main>`
- **AND** Report, Details and Trends stay visible with no tab bar or tab roles
- **AND** the `report-view`, `analysis-view` and `trends-view` IDs are present

#### Scenario: Landmarks and headings stay ordered

- **WHEN** a default report with two history runs is inspected in document
  order
- **THEN** the one `<main>` is the first main landmark and precedes the Details
  and Trends panels
- **AND** the heading levels and their order inside each view are unchanged
- **AND** no new landmark is introduced and no existing tabpanel role is lost

#### Scenario: No visual change at the gate viewports

- **WHEN** the default report is compared before and after the change at 320,
  390, 768, 1024 and 1440 px and at 320 px with 200 % text
- **THEN** the rendered position and size of the report header, health block,
  feature rows, matrix and Trends table are unchanged
- **AND** no viewport scrolls horizontally

### Requirement: Keep the Details and Trends panel contract without a main

In the default report, Details and Trends SHALL use plain containers inside
their existing panels. Each default panel SHALL keep the `tabPanel` class,
`role="tabpanel"`, `aria-labelledby`, `tabindex`, `hidden` and its
`analysis-view` or `trends-view` ID. The static report SHALL keep the `tabPanel`
class and the same IDs without tab roles or the tab attributes. Both forms SHALL
keep the `#analysis-view, #trends-view` print page-break rule.

#### Scenario: Panel contract

- **WHEN** a default report is inspected
- **THEN** each panel keeps its role, label, tabindex, `hidden` state and ID
- **AND** neither panel contains a `<main>`

#### Scenario: Print page breaks still apply

- **WHEN** the complete report is printed
- **THEN** the `#analysis-view, #trends-view` rule still starts each present
  view on a new page
- **AND** the rule still resolves without a `<main>` wrapper

### Requirement: Keep the Details metadata list readable at 320 px and 200 % text

The Details metadata lists SHALL stack each label above a start-aligned value at
320 px with 200 % text, without squeezing the label or overflowing the page. A
long unbroken URL SHALL wrap inside the value column. At 100 % text and at wider
viewports the existing two-column, right-aligned layout SHALL remain unchanged.

#### Scenario: Exact 320 px at 200 % boundary

- **WHEN** the Details view is opened at 320 px with 200 % text
- **THEN** each metadata label and value pair is stacked in one column
- **AND** the value is start-aligned
- **AND** the label keeps its full readable width rather than a squeezed track
- **AND** the page does not scroll horizontally

#### Scenario: Long unbroken metadata URL

- **WHEN** a metadata value is a long unbroken Actions URL at 320 px and 200 %
  text
- **THEN** the link label wraps inside the stacked value column
- **AND** the link keeps its destination and `rel="noopener noreferrer"`
- **AND** the page does not scroll horizontally

#### Scenario: Normal text keeps the two-column layout

- **WHEN** the Details view is opened at 320 px or 390 px at 100 % text
- **THEN** the metadata list keeps two tracks and right-aligned values
- **AND** the rendered layout matches the pre-change report

#### Scenario: Wider viewports are unchanged

- **WHEN** the Details view is opened at 768, 1024 or 1440 px
- **THEN** the metadata list keeps two tracks and right-aligned values
- **AND** the rendered layout matches the pre-change report

#### Scenario: German labels at the boundary

- **WHEN** the German Details view is opened at 320 px with 200 % text
- **THEN** the longer German labels stack above their values
- **AND** no label or value overflows horizontally

### Requirement: Keep the default report budgets and no-JS behaviour

Without the flag, a default report SHALL keep its no-JS behaviour, its client
bundle under 16 KB and its no-network baseline, except for the single-main
wrapper and the narrow metadata rule owned by this change. The committed
characterization hashes and golden HTML SHALL be re-pinned to the single-main
document. No runtime dependency SHALL be added.

#### Scenario: Default characterization

- **WHEN** the standard fixtures are rendered without `--static`
- **THEN** the committed characterization hashes and golden HTML match the
  single-main document
- **AND** the client bundle stays under 16 KB

#### Scenario: Default no-JS

- **WHEN** the default report is opened without JavaScript
- **THEN** the active Report view is visible
- **AND** Details and Trends stay inert like today
- **AND** closed details stay closed

#### Scenario: No-history default bytes

- **WHEN** a default report without a Trends section is rendered
- **THEN** its bytes match the re-pinned characterization hash
- **AND** the only diff from the previous hash is the single-main wrapper, the
  narrow metadata CSS and the matched closing tags

#### Scenario: History default bytes

- **WHEN** a default report with two history runs is rendered
- **THEN** it contains the Trends shell CSS
- **AND** its bytes match the re-pinned history characterization hash
- **AND** it contains exactly one `<main>`

#### Scenario: Dependency surface

- **WHEN** the change is complete
- **THEN** no runtime dependency is added
- **AND** the report still makes no network request

### Requirement: Agree on attachment counts between the report and the summary

The JSON summary per-scenario count SHALL equal the attachments the report
renders: those whose `testStepId` belongs to a pickle step or hook with a
result, plus those without a `testStepId`. An attachment on an unrendered or
resultless step, or on a missing run-hook start, SHALL NOT count.
`attachments.total` SHALL be the union of rendered-scenario, present-run-hook
and run-level attachments, and SHALL match `model.counts.attachments` and the
Details count. The schema SHALL stay version 2.

#### Scenario: Orphan step attachment

- **WHEN** an attachment names a `testStepId` that is absent from the selected
  test case and it is the scenario's only attachment
- **THEN** its summary scenario count is 0
- **AND** `attachments.total` is 0
- **AND** `model.counts.attachments` and the Details count are 0
- **AND** the HTML shows no attachment for that scenario

#### Scenario: Step without a result

- **WHEN** an attachment names a test step that has no test-step result
- **THEN** it is not counted in the scenario or the run total
- **AND** the HTML does not render it

#### Scenario: Missing run-hook start

- **WHEN** an attachment names a `testRunHookStartedId` with no matching start
  in the stream and it is the run's only attachment
- **THEN** `attachments.total` is 0
- **AND** `model.counts.attachments` and the Details count are 0
- **AND** no run-hook row is created for it

#### Scenario: Normal step attachment

- **WHEN** an attachment belongs to a rendered pickle step that has a result
  and it is the scenario's only attachment
- **THEN** the summary scenario count is 1
- **AND** `attachments.total` is 1
- **AND** the model, Details and HTML show the same one attachment

#### Scenario: Attachment without a test step id

- **WHEN** an attachment has no `testStepId` and belongs to an executed
  selected scenario
- **THEN** it is counted with the selected scenario
- **AND** the HTML renders it as a scenario attachment
- **AND** the run total counts it once

#### Scenario: Screenshot fixture cross-check

- **WHEN** `test/fixtures/messages/screenshot.ndjson` is summarised and
  rendered
- **THEN** the summary scenario attachment count equals the rendered scenario
  attachments
- **AND** `attachments.total` equals `model.counts.attachments` and the Details
  count
- **AND** the HTML shows the screenshot

### Requirement: Omit an unknown run date

When no usable run start time exists, the report SHALL omit the run date
instead of rendering a 1970-01-01 date. The model SHALL treat a zero-seconds
`testRunStarted`, `testRunFinished` or per-scenario `startedAt` timestamp as
unknown, so no scenario renders an epoch date. A real non-zero timestamp SHALL
render the existing localized date. The JSON summary, CI text and email SHALL be
unchanged.

#### Scenario: Zero run timestamp

- **WHEN** the only run timestamp is `{ "seconds": 0, "nanos": 0 }`
- **THEN** the model has no run start time
- **AND** the report shows no run date
- **AND** the text `1970` does not appear as the run date

#### Scenario: Real run timestamp

- **WHEN** the run carries a real non-zero start timestamp
- **THEN** the report shows the existing localized date
- **AND** the date matches the timestamp

#### Scenario: Zero finish timestamp

- **WHEN** a `testRunFinished` timestamp has zero seconds
- **THEN** the model treats it as unknown
- **AND** the report does not render an epoch finish date

#### Scenario: Zero scenario start

- **WHEN** a scenario's selected start carries a zero-seconds timestamp
- **THEN** the scenario shows no start time or `1970` date
- **AND** a real scenario timestamp still renders the existing value

#### Scenario: Machine outputs unchanged

- **WHEN** a run has no usable start time
- **THEN** the JSON summary, CI text and email are unchanged
- **AND** they gain no date field or placeholder

### Requirement: Use the later start on a full attempt tie

When two `testCaseStarted` envelopes for one pickle have the same attempt number
and the same timestamp, the report and the JSON summary SHALL use the later
envelope in input order. A higher attempt number or a later timestamp SHALL keep
the existing precedence. The selected start SHALL supply the rendered status,
attempt, timestamps, attachments and summary row.

#### Scenario: Equal attempt and empty timestamps

- **WHEN** a pickle has two starts with attempt 0 and empty timestamps, the
  first failed and the second passed
- **THEN** the report shows the scenario as passed
- **AND** the summary entry is passed
- **AND** the selected start is the second one

#### Scenario: Distinct attempt

- **WHEN** two starts have different attempt numbers
- **THEN** the higher attempt wins as before
- **AND** the tie rule does not apply

#### Scenario: Distinct timestamp

- **WHEN** two starts have the same attempt and different timestamps
- **THEN** the later timestamp wins as before
- **AND** the tie rule does not apply

#### Scenario: Three starts on a tie

- **WHEN** three starts share the same attempt and timestamp
- **THEN** the last start in input order is selected
- **AND** the report and summary agree

## MODIFIED Requirements

### Requirement: Add an opt-in static report mode

The CLI SHALL accept `--static` and the render API SHALL accept `static: true`.
The mode SHALL require `--out` or `--pdf`, SHALL default off, and SHALL NOT
itself change the default report's content, markup or CSS. The default form of
the same release MAY carry the changes of another change in that release (0.6.1
changes the tab containers and the narrow Details metadata rule), so byte
identity with an earlier release is not part of this mode. The default form
SHALL carry the release-wide measured scroll-offset script; a default report
with two or more history runs also carries the documented Trends shell CSS. The
static form SHALL contain no script. JSON, CI and email bytes SHALL stay
unchanged.

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

## REMOVED Requirements

### Requirement: Keep the default report and budgets unchanged

**Reason**: The requirement freezes the pre-0.6.1 three-`<main>` default
markup and the 0.6.0 byte hashes. B-048 now requires exactly one `<main>`, so
the frozen contract cannot stand.

**Migration**: “Render one main landmark in the default report”,
“Keep the Details and Trends panel contract without a main”, “Keep the Details
metadata list readable at 320 px and 200 % text” and “Keep the default report
budgets and no-JS behaviour” carry the replacement guarantees, including the
re-pinned hashes and goldens.
