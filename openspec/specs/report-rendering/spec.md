# report-rendering Specification

## Purpose
Defines the single-file HTML report: its content, shell, offline behaviour,
attachment safety and user-visible security guarantees.

## Requirements

### Requirement: Produce one self-contained HTML file

Tolkira SHALL produce one HTML file that contains all required styles, scripts
and attachments by default. The report SHALL work offline and SHALL NOT load
external assets.

#### Scenario: Offline report
- **WHEN** the generated file is opened without a network connection
- **THEN** styles, scripts, test details and embedded attachments still render

#### Scenario: No external assets
- **WHEN** the generated HTML is inspected
- **THEN** it contains no CDN, remote font or remote asset URL

### Requirement: Show summary and detailed test results

The report SHALL show pass/fail/skipped/pending counts, total duration, features,
scenarios, steps, hooks, errors and stack traces. The default view SHALL remain
a single-column report; deeper details SHALL be available in a separate Details
view.

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
- **WHEN** the user opens the Details tab
- **THEN** the report shows feature counts, status distribution, environment,
  run metadata and the agent summary without changing the Report tab

### Requirement: Search and filter results

The report SHALL allow the user to search by text and filter by status and tag.

#### Scenario: Search finds a scenario
- **WHEN** the user searches for a scenario name
- **THEN** the matching scenario remains visible and non-matching scenarios are hidden

#### Scenario: Status filter
- **WHEN** the user filters to failed results
- **THEN** only failed scenarios remain visible

### Requirement: Render attachments safely

The report SHALL render supported images, videos and text attachments. It SHALL
NOT execute HTML or SVG attachments as active content.

#### Scenario: Screenshot is shown
- **WHEN** a step has a PNG attachment
- **THEN** the open scenario shows the image inline

#### Scenario: HTML attachment is not executed
- **WHEN** a step has an HTML attachment containing a script
- **THEN** the script does not execute and the content is shown as escaped text

### Requirement: Escape user-controlled content

All test names, tags, metadata, titles and attachment names SHALL be escaped
before they are inserted into the report shell.

#### Scenario: Script in a title
- **WHEN** the report title contains `<script>alert(1)</script>`
- **THEN** the text is displayed literally and no script executes

### Requirement: Support metadata, title, logo and theme

The report SHALL accept a title, metadata entries, a logo and basic theme
colours, and SHALL display them without requiring a code change.

#### Scenario: Custom title and metadata
- **WHEN** the user supplies a title and metadata entries
- **THEN** the report shows them in its header

### Requirement: No telemetry and no network requests

The report and the generator SHALL NOT send telemetry, analytics or test data to
any remote service.

#### Scenario: No telemetry
- **WHEN** the report is opened and the generator runs
- **THEN** no analytics, beacon or remote logging request is made

### Requirement: Keep status understandable without colour

The report SHALL label statuses with text or icons, not only colour, and SHALL
be usable with a keyboard.

#### Scenario: Status is not colour-only
- **WHEN** the user views a failed result
- **THEN** the failure is indicated by text or an accessible label as well as colour

### Requirement: Warn about very large reports

Tolkira SHALL warn when the generated report exceeds a configurable size limit
and SHALL still produce a valid file unless the user aborts.

#### Scenario: Large report warning
- **WHEN** the generated file exceeds the configured size threshold
- **THEN** Tolkira prints a warning that names the size and the threshold

### Requirement: Show screenshot thumbnails in scenario rows

The report SHALL show a small thumbnail in a scenario row when the scenario has
an image attachment, and the full image in the expanded body.

#### Scenario: Collapsed row with a screenshot
- **WHEN** a scenario has a PNG attachment and is collapsed
- **THEN** its row shows a thumbnail in a fixed thumbnail column

#### Scenario: Expanded row
- **WHEN** the scenario is expanded
- **THEN** the full image is shown inline in the detail body

### Requirement: Reveal matching features during search

Search and status filters SHALL open a collapsed feature when it contains a
matching scenario, and SHALL show an empty state when nothing matches.

#### Scenario: Match inside a collapsed feature
- **WHEN** the user searches for a scenario in a collapsed feature
- **THEN** the feature opens and the matching scenario is visible

#### Scenario: No matches
- **WHEN** the query or filters match no scenario
- **THEN** an empty state is visible and the live region reports zero

### Requirement: Show the run environment in Details

The Details view SHALL show the producer, runtime, OS, CPU and protocol version
from the Messages meta envelope when available, plus user metadata.

#### Scenario: Messages meta is present
- **WHEN** the input contains a meta envelope
- **THEN** Details lists runtime, OS, CPU and protocol version
- **AND** user metadata is listed below them

### Requirement: Filter scenarios by tag

The report SHALL provide a tag filter in the Report toolbar when the run
contains tags. The filter SHALL combine with text search and status filters and
SHALL update the visible count and empty state.

#### Scenario: Filter by one tag

- **WHEN** the user selects a tag
- **THEN** only scenarios carrying that tag remain visible
- **AND** features with no matching scenario are hidden
- **AND** the live region reports the new visible count

#### Scenario: Combine tag and status filters

- **WHEN** a tag and a status filter are active
- **THEN** a scenario is visible only when it matches both

### Requirement: Highlight search matches

The report SHALL visually highlight matching text in visible scenarios when a
search query is active, and SHALL clear the highlight when the query is empty.

#### Scenario: Search finds visible text

- **WHEN** the user enters a query of at least two characters
- **THEN** matching text inside visible scenarios is highlighted
- **AND** the highlight is removed when the query is cleared

#### Scenario: Browser lacks the Highlight API

- **WHEN** the browser does not support `CSS.highlights`
- **THEN** the report still filters and opens matching scenarios without
  throwing an error

### Requirement: Copy a failure summary

The report SHALL offer a copy action on failed scenarios that copies the
feature, scenario, URI, failed step and error message as plain text.

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

### Requirement: Show run duration in the header

The Report view SHALL show the total run duration in the header metadata.

#### Scenario: Duration is visible

- **WHEN** a report is rendered
- **THEN** the header shows the total run duration

### Requirement: Order results exception-first

The Report view SHALL list features and, inside each feature, scenarios with
non-passing status before passed ones. Non-passing statuses SHALL use the
existing Cucumber severity order, worst first: failed, ambiguous, undefined,
pending, skipped, unknown. Input order SHALL be preserved within equal status.

#### Scenario: Mixed statuses in one feature

- **WHEN** a feature contains failed, pending and passed scenarios in that input
  order
- **THEN** the rendered order is failed, pending, passed
- **AND** the counts and content of each scenario are unchanged

#### Scenario: Stable order within a status

- **WHEN** two features share the same worst status
- **THEN** they keep their input order relative to each other

#### Scenario: All scenarios passed

- **WHEN** every scenario passed
- **THEN** the report keeps input order
- **AND** the Details view keeps input order in every case
- **AND** the JSON summary keeps its documented URI-then-name order

### Requirement: Show a needs-attention index

When at least one scenario is not passed, the Report view SHALL render a
"Needs attention" index above the feature list. It SHALL list one row per
non-passing feature that has at least one scenario, with its worst status, its
non-passing scenario counts and up to three links to its non-passing scenarios.
Where a failed scenario has a message, the row SHALL also show the failing step
and the first line of the message, truncated to 120 characters. It SHALL NOT
render when every scenario passed.

#### Scenario: Index lists non-passing features

- **WHEN** a run has one failed and one pending feature
- **THEN** the index lists both before any passed feature
- **AND** each row shows the status as text and the failures per status

#### Scenario: Failure reason

- **WHEN** a feature has a failed scenario with a message
- **THEN** the row shows the failing step and the first message line
- **AND** the excerpt is escaped and truncated to 120 characters

#### Scenario: Scenario links are capped

- **WHEN** a feature has five non-passing scenarios
- **THEN** the index renders three scenario links
- **AND** a "2 more" note points to the report list without extra links

#### Scenario: Nothing to triage

- **WHEN** every scenario passed
- **THEN** no needs-attention index is rendered
- **AND** the feature list is unchanged apart from ordering

#### Scenario: Filters are active

- **WHEN** the user searches, selects a tag or turns off a status filter
- **THEN** the index and source strip are hidden while the list shows the
  filtered results
- **AND** clearing the filters shows them again

#### Scenario: Narrow viewport

- **WHEN** the report is opened at 560 px or narrower
- **THEN** the index is a collapsed disclosure with a one-line summary
- **AND** expanding it reveals the rows

### Requirement: Bound the needs-attention index

The index SHALL show at most five rows directly and place up to fifteen more
behind a disclosure. Above twenty features it SHALL state how many further
features are in the list.

#### Scenario: More than five features

- **WHEN** six features need attention
- **THEN** five rows are visible and one is behind a disclosure labelled
  "Show 1 more feature"

#### Scenario: Feature rows are capped

- **WHEN** more than 20 features need attention
- **THEN** the index renders 20 feature rows
- **AND** states how many further features are listed below

### Requirement: Jump from the index to a result

Index entries SHALL be ordinary links to stable anchors on the feature and
scenario rows. Following a link SHALL expand the target and its collapsed
ancestors, move focus to the target summary, and scroll the target into view so
the scenario and its steps are visible.

#### Scenario: Link to a collapsed pending scenario

- **WHEN** the user follows a scenario link whose feature and scenario are
  collapsed
- **THEN** both open, the URL hash names the target and the browser scrolls to
  it
- **AND** no other scenario is opened

#### Scenario: Link without scripting

- **WHEN** the inline script does not run
- **THEN** the links still name an existing anchor and the report remains
  readable

#### Scenario: Keyboard use

- **WHEN** the index is reached by keyboard
- **THEN** every entry is focusable and follows the link order of the rows

### Requirement: Show the shape of each feature

The Report view SHALL show on every feature row the passed/total scenario count
and a segmented proportion bar using the run's status colours. The non-passing
counts SHALL also be named as text.

#### Scenario: Mixed feature

- **WHEN** a feature has passed, failed and pending scenarios
- **THEN** its row states the passed/total count and the failed and pending
  counts as text
- **AND** the bar has one segment per present status in the same order as the
  run bar

#### Scenario: Feature without scenarios

- **WHEN** a feature contains no scenarios
- **THEN** the report omits it from the feature list and the matrix

### Requirement: Compare features in the Details matrix

The Details view SHALL present one row per feature with the total scenario
count, one count column per status present in the run, and the duration. Status
columns SHALL be ordered worst first. Zero counts SHALL be rendered as a muted
zero, not an empty cell.

#### Scenario: Mixed run

- **WHEN** the run contains failed, pending and passed scenarios
- **THEN** the matrix has failed, pending and passed columns
- **AND** every row's cells match the summary counts for that feature

#### Scenario: Clean run

- **WHEN** every scenario passed
- **THEN** the matrix has only the passed status column

#### Scenario: Narrow viewport

- **WHEN** the matrix is wider than its container
- **THEN** it scrolls inside its labelled region
- **AND** the page itself does not scroll horizontally

### Requirement: Show source provenance only when real

When at least two input files contribute features and every feature URI
belongs to exactly one input, the Report view SHALL render a compact source
strip above the feature rows, with one card per input file that contributes at
least one feature, carrying the file name and that input's aggregates.
Otherwise it SHALL render a flat list. The report SHALL NOT infer a source from
a feature URI, tag, directory or name.

#### Scenario: Two input files

- **WHEN** two files are merged into one report
- **THEN** the strip shows one card per file
- **AND** cards are ordered by worst status, then input order

#### Scenario: One contributing file

- **WHEN** two files are merged but only one contributes features
- **THEN** no source strip is rendered

#### Scenario: One input file

- **WHEN** a single file contains several features
- **THEN** no source strip is rendered

#### Scenario: Shared or missing provenance

- **WHEN** a feature URI appears in two inputs, or a Messages stream has no
  file boundary
- **THEN** the report renders a flat feature list
- **AND** no source name is derived from the URI

### Requirement: Bound and adapt the source strip

The strip SHALL show at most six cards and state how many further inputs exist
above that. Below 560 px it SHALL be hidden and each feature row SHALL keep its
source badge.

#### Scenario: More than six input files

- **WHEN** more than six input files contribute features
- **THEN** the strip shows six cards
- **AND** states how many further inputs exist

#### Scenario: Narrow viewport

- **WHEN** the report is opened at 560 px or narrower
- **THEN** the source strip is hidden
- **AND** each feature row keeps its source badge

### Requirement: Keep the triage index offline and safe

The index SHALL be rendered server-side from `ReportModel` with escaped names,
SHALL add no network request, inline data store or new dependency, and SHALL
keep the existing content security policy.

#### Scenario: Untrusted names in the index

- **WHEN** a feature or scenario name contains HTML or a script payload
- **THEN** the index shows it as text and executes nothing

#### Scenario: Self-contained file

- **WHEN** the report is opened offline
- **THEN** the index, its links and the reveal behaviour work without a server

#### Scenario: Status without colour

- **WHEN** colour is unavailable
- **THEN** every index row still names its status as text

### Requirement: Group executed scenario-outline examples

For Cucumber Messages input, Tolkira SHALL render executed pickles from the
same scenario outline under one outline section. Each examples block with at
least one executed row SHALL become a subsection, and each executed example
SHALL become a numbered row. Unexecuted examples and blocks SHALL NOT be
rendered.

#### Scenario: Two outlines in one feature

- **WHEN** the input contains the Compatibility Kit `examples-tables` feature
  with two scenario outlines
- **THEN** the report shows two outline sections
- **AND** the first outline shows examples headings for `These are passing`
  and `These are failing` with rows `#1.1`, `#1.2`, `#2.1` and `#2.2`
- **AND** the second outline shows one unnamed examples heading with rows
  `#1.1`, `#1.2` and `#1.3`
- **AND** the second outline heading keeps the unsubstituted name
  `Eating cucumbers with <friends> friends`

#### Scenario: Unexecuted rows and blocks are omitted

- **WHEN** only the second examples block of a two-block outline was executed
- **THEN** only that block is rendered, with its original numbering starting
  at `#2.1`
- **AND** the unexecuted block and its heading are absent
- **WHEN** only the second row of a one-block outline was executed
- **THEN** only `#1.2` is rendered and `#1.1` is absent
- **WHEN** an empty examples block precedes an executed block
- **THEN** the executed block keeps its original numbering, such as `#2.1`

#### Scenario: Outline and examples metadata appear once

- **WHEN** an outline has a description and tags and its examples block has
  tags and a description
- **THEN** the outline tags are shown above the outline heading and the outline
  description below it
- **AND** the examples tags are shown above the examples heading and the
  examples description below it
- **AND** neither description nor those tags is repeated on every example row
- **AND** an examples block with an empty name renders `Examples:`

#### Scenario: Example values remain visible in the steps

- **WHEN** an example row is opened
- **THEN** its steps show the values substituted for that example
- **AND** the examples table values are not rendered as a separate table
- **AND** the substituted scenario name remains available to search, the
  copy-failure text and assistive technology without being repeated as the
  visible row heading

#### Scenario: Row tags stay filterable but not visible

- **WHEN** an outline has examples tags
- **THEN** the tags appear on the examples heading, not on every row
- **AND** the row still carries the full pickle tags for the tag filter and
  `data-tags`

#### Scenario: Outline inside a Rule still groups

- **WHEN** a scenario outline is nested inside a Rule
- **THEN** its executed examples are grouped under the outline
- **AND** the rule name remains visible in the scenario detail metadata

#### Scenario: Untrusted outline text is escaped

- **WHEN** an outline or examples keyword, name, description or tag contains
  HTML or script text
- **THEN** it is displayed as text and no markup or script executes

### Requirement: Preserve example outcomes and navigation

Grouping SHALL change presentation only. Each executed example SHALL keep its
own outcome, duration, steps, attachments and anchor, and SHALL remain part of
the existing counts, triage membership, status matrix and JSON summary.

#### Scenario: Failed example is visible

- **WHEN** one example fails and another passes in the same examples block
- **THEN** the failed row is open by default and shows its failed step, error
  and attachments
- **AND** the passed row remains collapsed

#### Scenario: Attachments stay with their example

- **WHEN** two examples in one outline each have an image attachment
- **THEN** each row shows only its own image and attachment count
- **AND** opening an image still uses the lightbox

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

- **WHEN** the user copies a failure from a grouped example
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

### Requirement: Keep search and filters row-based

Search and filters SHALL operate on example rows. Outline and examples names
and tags SHALL be searchable, and headings with no visible row SHALL be hidden.

#### Scenario: Search finds an example by outline or examples name

- **WHEN** the user searches for the unsubstituted outline name or an examples
  block name
- **THEN** the matching example rows are visible and their outline and examples
  headings are visible
- **AND** non-matching example rows are hidden
- **AND** an outline or examples heading with no visible row is hidden

#### Scenario: Examples table values are not indexed

- **WHEN** the user searches for a value that appears only in the examples
  table and not in a substituted step
- **THEN** no example row matches solely because of the table value

#### Scenario: Status and tag filters keep grouping

- **WHEN** the user selects the `@failing` examples tag
- **THEN** the failing examples block and its outline heading remain visible
- **AND** the passing examples block is hidden
- **WHEN** the user selects the `@passing` examples tag
- **THEN** the reverse happens
- **AND** example numbering stays stable after filtering

#### Scenario: Search cap still applies

- **WHEN** a search matches more than 20 example rows
- **THEN** at most 20 rows are opened
- **AND** the visible note reports how many matches were expanded
- **AND** no empty outline or examples heading is left behind

### Requirement: Fall back to flat rendering without outline metadata

Tolkira SHALL keep the current flat scenario rendering when the input cannot
provide outline and examples structure.

#### Scenario: Legacy JSON stays flat

- **WHEN** the input is legacy Cucumber JSON with expanded outline examples
- **THEN** each example remains a normal scenario row
- **AND** Tolkira does not invent an outline or examples grouping

#### Scenario: Unlinked pickle falls back

- **WHEN** a Messages pickle cannot be linked to an outline and examples row
- **THEN** it is rendered as a normal scenario row
- **AND** the report still renders without an error

#### Scenario: Executed outline without examples falls back

- **WHEN** a Messages scenario outline has no examples but has an executed test
  case
- **THEN** it is rendered as a normal flat scenario row
- **AND** the report documents this deliberate difference from the official
  formatter

#### Scenario: Non-outline scenario is unchanged

- **WHEN** the input contains an ordinary scenario
- **THEN** it keeps its current heading, steps, status and anchor
