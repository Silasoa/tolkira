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

Details and Trends SHALL use plain containers inside their existing panels.
Each SHALL keep the `tabPanel` class, `role="tabpanel"`, `aria-labelledby`,
`tabindex`, `hidden` and its `analysis-view` or `trends-view` ID. Both SHALL
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
