# Spec Delta

## ADDED Requirements

### Requirement: Print the complete report

With JavaScript, printing SHALL include the Report, Details and Trends panels
when present, and SHALL open every closed `<details>`. A `beforeprint` handler
SHALL remember the active tab, the open state, an open lightbox and the page
overflow, and `afterprint` SHALL restore them. Without JavaScript or
`beforeprint` support, the active Report view SHALL print with closed details
unchanged.

#### Scenario: Complete print

- **WHEN** the report is printed with JavaScript
- **THEN** all present tab panels and all details are visible in the print
- **AND** the active tab and the previous detail state return after printing or
  cancelling

#### Scenario: Print from an open lightbox

- **WHEN** a screenshot lightbox is open and the report is printed
- **THEN** the lightbox closes and the page overflow is reset for the print
- **AND** the lightbox and overflow state return afterwards

#### Scenario: Lazy thumbnails

- **WHEN** an off-screen screenshot thumbnail is printed
- **THEN** its image is loaded for the print
- **AND** the thumbnail state is restored afterwards

#### Scenario: No JavaScript

- **WHEN** the report is printed without JavaScript
- **THEN** the active Report view prints
- **AND** Details and Trends stay hidden
- **AND** closed details stay closed

#### Scenario: No Trends panel

- **WHEN** the report has no history
- **THEN** printing includes Report and Details only
- **AND** no empty Trends page is produced

### Requirement: Hide interactive chrome in print

`@media print` SHALL hide the tab bar, toolbar, search, tag filter, filter
buttons, copy controls, expand/collapse controls, chevrons and the lightbox
through explicit selectors, not by hiding every button. Screenshots SHALL stay
visible; video and audio attachments are documented as not printable. The print
SHALL repeat the full light palette, including status, soft and ANSI colours,
independent of the screen colour scheme, with prefixed and unprefixed
`print-color-adjust`.

#### Scenario: Chrome hidden, screenshots kept

- **WHEN** print media applies
- **THEN** the topbar, toolbar, filters, copy buttons, chevrons and lightbox are
  not rendered
- **AND** screenshot images and tags remain in the print

#### Scenario: Dark screen, light print

- **WHEN** the report is open in dark mode and printed
- **THEN** the printed page uses light surfaces and dark ink
- **AND** status chips, legends and logs use the light palette
- **AND** status colours remain distinguishable

### Requirement: Paginate and fit the printed page

Each present view SHALL start on a new printed page. Tables SHALL not require
horizontal scrolling in print; the matrix and the Trends table SHALL fit the
A4 printable width for the standard fixtures, using smaller print type and
resetting child column widths. Unusually wide runs MAY use landscape; the
documentation names it. Long blocks SHOULD avoid awkward breaks, but a block
larger than a page SHALL break normally.

#### Scenario: Views on separate pages

- **WHEN** the complete report is printed
- **THEN** Report, Details and Trends each start on a new page
- **AND** the standard matrix and Trends table are not clipped at the right edge

#### Scenario: Wide matrix

- **WHEN** a report with many status columns is printed
- **THEN** the matrix fits the A4 printable width with a smaller type
- **AND** the documentation names landscape as the fallback for unusually wide
  runs

### Requirement: Preserve the current filter state

The print SHALL reflect the current search and filter state in the Report view
and SHALL NOT silently clear it. It SHALL show the existing visible-count text
in print as a filter marker, without a new catalog key. Details and Trends
SHALL print in full; the triage index stays hidden while a filter is active.

#### Scenario: Failed-only print

- **WHEN** the failed-only filter is active and the report is printed
- **THEN** the Report view prints only the filtered rows
- **AND** the visible-count text is visible as a filter marker
- **AND** Details and Trends still print in full

### Requirement: Keep the print view single-file and dependency-free

The print view SHALL add no dependency, network request, catalog string or
delivery format. The report SHALL stay one self-contained file and the client
bundle SHALL stay under its 16 KB budget.

#### Scenario: Budget and offline

- **WHEN** the print change ships
- **THEN** the client bundle is under 16 KB and contains no new catalog
- **AND** the report makes no request when opened offline and printed
