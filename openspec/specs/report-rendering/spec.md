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

When at least one executed scenario is not passed, the Report view SHALL render
a "Needs attention" index above the feature list. It SHALL list one row per
feature with executed non-passing scenarios, with the worst executed status,
counts and up to three links. It SHALL NOT render when every executed scenario
passed or none executed.

#### Scenario: Index lists non-passing features

- **WHEN** a run has one failed and one pending executed feature
- **THEN** the index lists both before any passed feature
- **AND** each row shows the status as text and the failures per status

#### Scenario: Failure reason

- **WHEN** a feature has a failed scenario with a message
- **THEN** the row shows the failing step and the first message line
- **AND** the excerpt is escaped and truncated to 120 characters

#### Scenario: Scenario links are capped

- **WHEN** a feature has five executed non-passing scenarios
- **THEN** the index renders three scenario links
- **AND** a "2 more" note points to the report list without extra links

#### Scenario: Nothing to triage

- **WHEN** every executed scenario passed, or the run has no executed scenarios
- **THEN** no needs-attention index is rendered
- **AND** the feature list is unchanged apart from ordering

#### Scenario: Only unexecuted scenarios

- **WHEN** every scenario in the run is unexecuted
- **THEN** no needs-attention index is rendered
- **AND** the unexecuted rows remain visible without an outcome

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

The Report view SHALL show on every feature row the passed/total executed
scenario count and a segmented proportion bar using the run's status colours.
The non-passing executed counts SHALL also be named as text. A feature with no
executed scenarios SHALL state `0 of 0 passed`, omit the proportion bar and name
no non-passing status.

#### Scenario: Mixed feature

- **WHEN** a feature has passed, failed and unexecuted scenarios
- **THEN** its row states the passed/total count for executed scenarios and the
  failed count as text
- **AND** the bar has one segment per present executed status in the same order
  as the run bar

#### Scenario: Feature without scenarios

- **WHEN** a feature contains no scenarios
- **THEN** the report omits it from the feature list and the matrix

#### Scenario: Only unexecuted scenarios

- **WHEN** every scenario in a feature is unexecuted
- **THEN** its row states `0 of 0 passed`
- **AND** no proportion bar and no status counts are rendered
- **AND** the feature stays visible

### Requirement: Compare features in the Details matrix

The Details view SHALL present one row per feature with the total executed
scenario count, one count column per status present among executed scenarios in
the run, and the duration. Status columns SHALL be ordered worst first. Zero
counts SHALL be rendered as a muted zero, not an empty cell. Unexecuted
scenarios SHALL NOT contribute to a row's total or cells, and the matrix SHALL
carry the caption “Executed scenarios only.”

#### Scenario: Mixed run

- **WHEN** the run contains failed, pending and passed executed scenarios
- **THEN** the matrix has failed, pending and passed columns
- **AND** every row's cells match the executed summary counts for that feature

#### Scenario: Clean run

- **WHEN** every executed scenario passed
- **THEN** the matrix has only the passed status column

#### Scenario: Only unexecuted scenarios

- **WHEN** a feature has no executed scenarios
- **THEN** its row total is 0
- **AND** its cells are muted zeros
- **AND** no status column appears unless an executed scenario in the run has
  that status

#### Scenario: Narrow viewport

- **WHEN** the matrix is wider than its container
- **THEN** it scrolls inside its labelled region
- **AND** the page itself does not scroll horizontally

### Requirement: Show source provenance only when real

When at least two input files contribute features and every feature URI
belongs to exactly one input, the Report view SHALL render a compact source
strip above the feature rows, with one card per input file that contributes at
least one feature, carrying the file name and that input's aggregates over
executed scenarios. Otherwise it SHALL render a flat list. The report SHALL NOT
infer a source from a feature URI, tag, directory or name.

#### Scenario: Two input files

- **WHEN** two files are merged into one report
- **THEN** the strip shows one card per file
- **AND** cards are ordered by worst executed status, then input order
- **AND** scenario counts and bars cover executed scenarios only

#### Scenario: All-unexecuted input

- **WHEN** an input contributes only features whose scenarios are unexecuted
- **THEN** its card shows the feature count, `0 scenarios` and status `unknown`
- **AND** the card renders no proportion bar

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

For Cucumber Messages input, Tolkira SHALL group pickles from the same
scenario outline under one outline section. Each examples block with at least
one rendered row SHALL become a subsection, and each rendered example SHALL
become a numbered row. Examples and blocks whose test case never started SHALL
NOT be rendered. An example whose selected test case started with zero raw
test-step results SHALL render as an unexecuted row with its original numbering
and no outcome.

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
- **AND** the never-started block and its heading are absent
- **WHEN** only the second row of a one-block outline was executed
- **THEN** only `#1.2` is rendered and `#1.1` is absent
- **WHEN** an empty examples block precedes an executed block
- **THEN** the executed block keeps its original numbering, such as `#2.1`

#### Scenario: Started example without results

- **WHEN** an outline example's selected test case started with zero raw
  test-step results
- **THEN** its numbered row is rendered without an outcome
- **AND** its examples block heading is visible
- **WHEN** that example never started instead
- **THEN** its row and any empty examples block are absent

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
- **THEN** its rendered examples are grouped under the outline
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

### Requirement: Separate per-scenario hooks from steps

Tolkira SHALL render per-scenario hooks separately from steps. The scenario
subtitle SHALL count steps and hooks independently, and the report's step counts
SHALL NOT include hooks.

#### Scenario: Passed hooks do not inflate the step count

- **WHEN** a scenario has one step and two passed hooks
- **THEN** the scenario subtitle states one step and two hooks
- **AND** the step count for the run excludes both hooks

#### Scenario: Non-passing hooks keep their place among steps

- **WHEN** a scenario has before, step and after hooks
- **THEN** non-passing hooks render inline in their test-case order among the steps
- **AND** the ordinary steps keep their order
- **AND** a failed before hook is visible before the step it affected

### Requirement: Show hook identity and outcome

Each per-scenario hook SHALL show its type, name when available, status,
duration, error message and attachments. A named hook SHALL be labelled with
its type and name, such as `Before: name`.

#### Scenario: Named hook

- **WHEN** a Messages hook has type `BEFORE_TEST_CASE` and name `seed database`
- **THEN** the hook row is labelled `Before: seed database`
- **AND** it shows its status and duration

#### Scenario: Unnamed hook

- **WHEN** a hook has a type but no name
- **THEN** the row falls back to the type label, such as `Before`

#### Scenario: Failed hook

- **WHEN** a hook fails with a message
- **THEN** the row is visible inline in the scenario
- **AND** it shows the error message
- **AND** the scenario remains non-passing and in the triage index
- **AND** the triage reason and copied failure can use the failed hook when no
  step failed

#### Scenario: Hook attachment

- **WHEN** a hook has an image or text attachment
- **THEN** the attachment is rendered with that hook
- **AND** it is not duplicated on another hook or in the run attachments

#### Scenario: Durations include hook time

- **WHEN** a scenario has hooks and steps
- **THEN** its duration includes both
- **AND** the feature and run durations include the hook time

### Requirement: Collapse passed hooks

Passed per-scenario hooks SHALL be collapsed behind a disclosure labelled with
the number of hooks. Failed and other non-passing hooks SHALL remain inline.

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

### Requirement: Show test-run hooks

Tolkira SHALL render test-run hooks in a separate Hooks section below the
feature list. Each row SHALL show the hook name when present, otherwise
BeforeAll/AfterAll, plus status, duration, error message and attachments. The
section SHALL be omitted when the run has no test-run hooks.

#### Scenario: BeforeAll and AfterAll

- **WHEN** the input contains a BeforeAll and an AfterAll hook
- **THEN** the Hooks section lists both with their status and duration
- **AND** a named run hook shows its name
- **AND** a failed test-run hook shows its error and attachments

#### Scenario: No test-run hooks

- **WHEN** the input has only per-scenario hooks
- **THEN** no test-run Hooks section is rendered
- **AND** the scenario hook groups are unchanged
- **AND** this omission is a documented deliberate difference from the
  official empty Hooks section

#### Scenario: Missing hook metadata

- **WHEN** a test-run hook start or finish has no matching Hook envelope
- **THEN** the row falls back to the hook type or a generic hook label
- **AND** the report still renders without an error

#### Scenario: Run-hook attachments are counted once

- **WHEN** a test-run hook has an attachment
- **THEN** the attachment is rendered in the Hooks section
- **AND** it is not repeated in the run attachments list
- **AND** the attachment totals count it once

### Requirement: Keep hook data searchable and safe

Hook names and error messages SHALL be searchable with their scenario. All hook
names, type labels, messages and attachment names SHALL be escaped, and the
report SHALL remain a single offline file with no new network request.

#### Scenario: Search finds a hook name

- **WHEN** the user searches for a hook name or a hook error
- **THEN** the matching scenario is visible and opened
- **AND** a matching passed-hook group opens so the hook row is visible
- **AND** the 20-match expansion cap still applies

#### Scenario: Untrusted hook text

- **WHEN** a hook name, type label or message contains HTML or script text
- **THEN** it is displayed as text and no markup or script executes

#### Scenario: Keyboard and no-JS

- **WHEN** the report is used by keyboard or without JavaScript
- **THEN** the hooks disclosure is operable and the run-hook rows remain
  readable
- **AND** no external asset or request is introduced

### Requirement: Preserve the summary and fallback contracts

The JSON summary SHALL use schema version 2. Hooks remain `steps` entries with
`keyword: "Hook"` and an optional name. Each scenario SHALL carry `executed`;
unexecuted scenarios SHALL have `executed: false`, `status: "unknown"` and
SHALL NOT count in `counts.scenarios`. A failed test-run hook SHALL make the
summary `failed`.

#### Scenario: Summary stays version 1

- **WHEN** a version-1 consumer reads the summary
- **THEN** it must check `schemaVersion` and reject version 2 instead of
  silently misreading the executed-only counts
- **AND** the hook entry shape itself keeps `keyword: "Hook"` and an optional
  name

#### Scenario: Hook entry shape is retained

- **WHEN** a version-2 Messages run with hooks is summarised
- **THEN** hook entries keep `keyword: "Hook"` and a named hook carries its name
- **AND** the HTML report still separates hooks from steps

#### Scenario: Summary is version 2

- **WHEN** a Messages run is summarised
- **THEN** `schemaVersion` is 2
- **AND** an executed scenario carries `executed: true`

#### Scenario: Unexecuted summary entry

- **WHEN** a scenario's selected test case started with zero raw test-step
  results
- **THEN** its summary entry has `executed: false` and `status: "unknown"`
- **AND** `counts.scenarios.total` excludes it and may be less than
  `scenarios.length`
- **AND** the overall summary `status` ignores it

#### Scenario: Failed run hook fails the summary

- **WHEN** a BeforeAll or AfterAll hook fails after otherwise passing scenarios
- **THEN** the JSON summary status is failed
- **AND** CI can detect the failure from the documented interface

#### Scenario: Two step totals are labelled

- **WHEN** the Details view shows the model step count and the embedded summary
- **THEN** the HTML count is labelled as excluding hooks
- **AND** the summary count is labelled as including hook entries
- **AND** a Hooks count is shown separately

#### Scenario: Legacy hooks

- **WHEN** the input is legacy Cucumber JSON with before/after hooks
- **THEN** the hooks render as per-scenario hook rows with status, duration,
  error and attachments
- **AND** no test-run Hooks section is invented
- **AND** the compatibility shim still returns the summary

#### Scenario: JUnit without hooks

- **WHEN** the input is JUnit XML
- **THEN** no hook rows or Hooks section are rendered

### Requirement: Show undefined-step snippets

For Cucumber Messages input, an undefined step SHALL show the lead "No step
definition found." and SHALL render every available suggestion snippet as
escaped code. The lead is shown even when no suggestion envelope exists; the
snippet sentence and code blocks are added only when snippets are present.

#### Scenario: One suggestion

- **WHEN** an undefined step has one suggestion
- **THEN** the step shows "No step definition found. Implement with the
  snippet(s) below:"
- **AND** the snippet code is shown in a code block

#### Scenario: Multiple suggestions

- **WHEN** an undefined step has more than one suggestion
- **THEN** every snippet is shown
- **AND** each snippet keeps its language label when present

#### Scenario: No suggestion envelope

- **WHEN** an undefined step has no suggestion envelope
- **THEN** the step shows "No step definition found."
- **AND** no snippet sentence or empty code block is rendered

#### Scenario: Legacy undefined step

- **WHEN** the input is legacy Cucumber JSON with an undefined step
- **THEN** the status is shown without snippets
- **AND** the report does not invent a definition

### Requirement: Show ambiguous-step definitions

For Cucumber Messages input, an ambiguous step SHALL show "Multiple matching
step definitions found:" and the matching patterns with their source
references. The lead is shown even when no definition metadata exists; the
pattern list is added only when definitions are present.

#### Scenario: Multiple matching definitions

- **WHEN** an ambiguous step matches two step definitions
- **THEN** both patterns are shown
- **AND** each pattern names its source file and line when available

#### Scenario: No matching definition metadata

- **WHEN** an ambiguous step has no step-definition envelopes
- **THEN** the step shows "Multiple matching step definitions found:"
- **AND** no empty definition list is rendered

#### Scenario: Legacy ambiguous step

- **WHEN** the input is legacy Cucumber JSON with an ambiguous step
- **THEN** the status is shown without patterns
- **AND** the report does not invent definitions

### Requirement: Open non-passed results by default

The report SHALL open features and executed scenarios whose status is not
`passed` by default, including undefined, ambiguous, pending, skipped and
unknown results. A feature whose scenarios are all unexecuted SHALL open by
default, while its unexecuted rows SHALL remain collapsed and show no outcome.
The search auto-open cap SHALL remain in force.

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

### Requirement: Keep diagnostics safe and searchable

Snippets, patterns and source references SHALL be escaped, SHALL not execute
markup, and SHALL remain part of the single offline file. Source references
SHALL use the report-relative URI form. The step text and diagnostic text SHALL
be searchable.

#### Scenario: Untrusted snippet

- **WHEN** a suggestion snippet contains HTML or script text
- **THEN** it is displayed as code and no markup executes

#### Scenario: Search finds an undefined step

- **WHEN** the user searches for text in an undefined step or its diagnostic
- **THEN** the matching scenario is visible and open

#### Scenario: No network

- **WHEN** the report is opened offline
- **THEN** diagnostics render without an external request

### Requirement: Preserve counts and summary

Diagnostics SHALL not change scenario, step or attachment counts, executed
filtering, triage membership or the JSON summary schema version.

#### Scenario: Counts unchanged

- **WHEN** a report with undefined and ambiguous steps is rendered
- **THEN** its scenario counts match the summary scenario counts, using
  executed scenarios only
- **AND** the summary remains version 2
- **AND** undefined suggestions and ambiguous definitions are also exposed as
  optional summary-step fields, without changing the schema version

#### Scenario: JUnit without diagnostics

- **WHEN** the input is JUnit XML
- **THEN** no undefined or ambiguous diagnostics are rendered

### Requirement: Show feature and rule tags

The report SHALL render feature tags once in the feature header and rule tags
once in the rule section. Scenario rows SHALL display only their own scenario
tags; inherited feature, rule and examples tags SHALL remain available to the
tag filter and search but SHALL NOT be repeated on every row.

#### Scenario: Feature tags

- **WHEN** a feature has tags
- **THEN** the tags appear once in the feature header
- **AND** they remain available to the tag filter

#### Scenario: Rule tags

- **WHEN** a rule has tags
- **THEN** the tags appear once on the rule section
- **AND** scenarios under the rule do not repeat them

### Requirement: Render rule sections

For Cucumber Messages input, scenarios and outlines SHALL render under their
Gherkin rule with the rule keyword, name, description and tags. Features
without rules SHALL keep their current layout.

#### Scenario: Rule with scenarios

- **WHEN** a feature contains a rule with two scenarios
- **THEN** the rule heading, description and tags render once
- **AND** both scenarios render under the rule

#### Scenario: Rule with an outline

- **WHEN** a rule contains a scenario outline
- **THEN** the outline and its examples render inside the rule section

#### Scenario: Mixed feature-level and rule scenarios

- **WHEN** a feature has a scenario before a rule and a scenario inside it
- **THEN** feature-level and rule blocks are ordered by severity, then input
- **AND** scenarios do not move across rule boundaries

#### Scenario: Filtered rule

- **WHEN** a search, status or tag filter hides every scenario in a rule
- **THEN** the rule section is hidden
- **AND** a rule with a visible scenario keeps its heading and tags

#### Scenario: Rule tags in search

- **WHEN** the user searches for a rule name or tag
- **THEN** the matching scenarios remain visible
- **AND** the rule section is visible

### Requirement: Render background headings and descriptions

The report SHALL show the background keyword, name and description for
features and rules when the name or description is non-empty. Background steps
SHALL remain in their existing scenario step lists and SHALL NOT be duplicated
as a second step list. Synthetic backgrounds created by legacy normalisation
SHALL NOT be rendered.

#### Scenario: Feature background

- **WHEN** a feature has a background with a description
- **THEN** the background heading and description render once
- **AND** the scenario steps are unchanged

#### Scenario: Rule background

- **WHEN** a rule has a background
- **THEN** its heading and description render inside the rule section

### Requirement: Preserve counts, search and summary

Grouping by rule SHALL change presentation only. Counts, triage and the matrix
SHALL use executed scenarios; search and tag filtering SHALL use all rows.
Unexecuted rows stay visible and searchable but SHALL NOT count. Search SHALL
index rule/background names and descriptions; a matching rule keeps its
descendants visible.

#### Scenario: Counts unchanged

- **WHEN** a feature with rules is rendered
- **THEN** scenario and step counts match the summary
- **AND** every executed scenario remains in the triage and status matrix
- **AND** unexecuted scenarios are absent from both
- **AND** the summary remains version 2

#### Scenario: Legacy fallback

- **WHEN** the input is legacy Cucumber JSON
- **THEN** no rule or background structure is invented
- **AND** feature and scenario tags remain best effort

### Requirement: Keep structure safe and accessible

Rule/background names, descriptions and tags SHALL be escaped, the report SHALL
remain one offline file, and the structure SHALL be readable without
JavaScript.

#### Scenario: Untrusted rule text

- **WHEN** a rule or background name, description or tag contains HTML
- **THEN** it is displayed as text and no script executes

#### Scenario: No-JS

- **WHEN** the report is opened without JavaScript
- **THEN** rule and background headings remain visible
- **AND** no external request is introduced

### Requirement: Mark executed and unexecuted scenarios

The model SHALL expose `executed` on every scenario row. A scenario is executed
when its selected test case has at least one raw test-step result, including a
hook result; otherwise it is unexecuted and renders without an outcome. The
selected case is the latest started attempt; never-started pickles do not
produce a row.

#### Scenario: Scenario with no step results

- **WHEN** the selected test case for a scenario started with zero raw test-step
  results
- **THEN** the row exists with `executed: false` and `status: "unknown"`
- **AND** the report shows it without an outcome
- **AND** it is not counted as passed, failed, skipped or unknown
- **AND** it is not listed in “Needs attention”

#### Scenario: Started but unfinished

- **WHEN** a test case started but has no finished step and no finish envelope
- **THEN** the scenario is rendered as unexecuted
- **AND** the row is not dropped

#### Scenario: Hook-only result is executed

- **WHEN** the selected test case produced a hook result and no pickle-step
  result
- **THEN** the scenario has `executed: true`
- **AND** its status comes from the worst raw test-step result, including the
  hook

#### Scenario: Never-started pickle is pruned

- **WHEN** a pickle or outline example has no started test case
- **THEN** no scenario row is created for it
- **AND** counts and the summary do not include it

#### Scenario: Retry selection uses the latest attempt

- **WHEN** an earlier attempt has results and the latest started attempt has no
  results
- **THEN** the latest attempt is selected
- **AND** the earlier retried attempt is ignored
- **AND** the scenario is unexecuted

### Requirement: Handle empty features and runs

A feature's status SHALL be the worst status among executed scenarios, or
`unknown` when none executed. Its unexecuted rows stay visible without an
outcome. The header SHALL show the executed passed/total count, including
`0 / 0` for an empty run, and an empty run SHALL render no "Needs attention"
index.

#### Scenario: All-unexecuted feature

- **WHEN** every scenario in a feature is unexecuted
- **THEN** the feature status is `unknown`
- **AND** the feature is visible and open by default
- **AND** its rows are collapsed and show no outcome

#### Scenario: Mixed executed and unexecuted feature

- **WHEN** a feature has one passed executed scenario and one unexecuted
  scenario
- **THEN** the feature status is `passed`
- **AND** its passed/total count and bar cover only the executed scenario

#### Scenario: Empty run

- **WHEN** the input contains a feature with a blank scenario and no results
- **THEN** the header shows `0 / 0` and `0 %`
- **AND** the feature and the blank row remain visible without an outcome
- **AND** no “Needs attention” index is rendered

#### Scenario: No scenario rows at all

- **WHEN** the input contains no scenario rows
- **THEN** the header shows `0 / 0`
- **AND** the existing “No scenarios in this report.” empty state remains

### Requirement: Count only executed scenarios on every count surface

Scenario counts and outcome aggregates SHALL use executed scenarios only on the
header, feature row and bar, triage index, source strip and Details matrix.
Unexecuted rows SHALL remain visible and searchable but SHALL NOT contribute to
counts, percentages, bars, triage membership or matrix cells.

#### Scenario: Mixed run

- **WHEN** a run contains executed and unexecuted scenarios
- **THEN** the header, feature rows, triage, source strip and matrix include
  only executed scenarios
- **AND** the unexecuted rows remain visible and searchable

#### Scenario: Header count

- **WHEN** a run has two executed scenarios and one is passed
- **THEN** the header shows `1 / 2` and `50 %`
- **AND** the status pills and status bar count only the two executed scenarios

#### Scenario: Feature bar

- **WHEN** a feature has one passed, one failed and one unexecuted scenario
- **THEN** the feature row states one of two passed and the failed count
- **AND** the bar has segments for passed and failed only

#### Scenario: Triage

- **WHEN** a run has a failed executed scenario and an unexecuted scenario
- **THEN** the triage index counts one of one executed scenario and links only
  the failed scenario
- **AND** the unexecuted row is absent from the index

#### Scenario: Source strip

- **WHEN** two input files contribute features and one scenario is unexecuted
- **THEN** each source card's scenario count, status and bar cover executed
  scenarios only
- **AND** a source that contributes only unexecuted features shows its feature
  count, `0 scenarios`, status `unknown` and no bar

#### Scenario: Details matrix

- **WHEN** a feature has one passed and one unexecuted scenario
- **THEN** its matrix row total is 1
- **AND** only the passed column is incremented for that row
- **AND** an all-unexecuted feature shows total 0 and muted zero cells

#### Scenario: Search

- **WHEN** the user searches for the name, source or tag of an unexecuted
  scenario
- **THEN** the row remains visible
- **AND** it still shows no outcome

### Requirement: Summary schema version 2

The JSON summary SHALL set `schemaVersion` to 2 and add `executed` to each
scenario. An unexecuted scenario SHALL remain in `scenarios` with
`status: "unknown"` and `executed: false` but SHALL NOT be counted in
`counts.scenarios`, so `counts.scenarios.total` MAY be less than
`scenarios.length`. The overall `status` SHALL use executed scenarios and
test-run hooks only. `counts.steps` and attachment counts SHALL keep their
current meaning.

#### Scenario: Summary marks unexecuted

- **WHEN** a run contains an unexecuted scenario
- **THEN** its summary entry has `executed: false` and `status: "unknown"`
- **AND** `counts.scenarios.total` excludes it and is less than
  `scenarios.length`
- **AND** `schemaVersion` is 2

#### Scenario: Executed scenario

- **WHEN** a scenario has at least one raw test-step result
- **THEN** its summary entry has `executed: true`
- **AND** it is counted as before

#### Scenario: Overall status ignores unexecuted

- **WHEN** a run has one passed executed scenario and one unexecuted scenario
- **THEN** the summary `status` is `passed`
- **AND** `counts.scenarios` reports one passed scenario

#### Scenario: Hook-only result is counted

- **WHEN** a scenario has a hook result and no pickle-step result
- **THEN** it has `executed: true`
- **AND** it is counted with the hook result's status

#### Scenario: Only unexecuted run

- **WHEN** every scenario in the run is unexecuted
- **THEN** the overall summary `status` is `unknown`
- **AND** `counts.scenarios.total` is 0
- **AND** every entry keeps `executed: false`

#### Scenario: Steps and attachments unchanged

- **WHEN** a run mixes an executed scenario with steps and attachments and an
  unexecuted scenario
- **THEN** `counts.steps` and the attachment counts cover the executed content
  only
- **AND** the unexecuted entry has no steps

#### Scenario: Never-started pickle is omitted

- **WHEN** a pickle never started
- **THEN** it has no `scenarios` entry and no count

### Requirement: Publish the version-2 migration contract

The documentation SHALL describe the version-2 summary contract: unexecuted
scenarios keep `status: "unknown"` and `executed: false`,
`counts.scenarios.total` may be less than `scenarios.length`, and agents SHALL
filter on `executed`. The version-1 tests and docs listed below SHALL be
updated.

#### Scenario: Agent guidance

- **WHEN** an agent reads `docs/AGENT-INTERFACE.md`
- **THEN** the examples show `schemaVersion: 2` and an `executed` field
- **AND** the field contract says to filter on `executed`

#### Scenario: Count relationship is documented

- **WHEN** the migration section is read
- **THEN** it states that `counts.scenarios.total` can be smaller than
  `scenarios.length`
- **AND** it states that an unexecuted scenario has `status: "unknown"` and
  `executed: false`

#### Scenario: No stale version-1 contract

- **WHEN** `test/cli`, `test/compat`, `test/render`, `test/summary`,
  `test/model`, `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md` and
  `docs/CUCUMBER-COMPATIBILITY.md` are searched after the change
- **THEN** no assertion expects `schemaVersion` 1
- **AND** no documentation calls the summary version 1

### Requirement: Fallbacks and safety

Legacy JSON and JUnit SHALL use the same executed detection on normalized
results. A legacy scenario with no executable steps or hooks SHALL be
unexecuted and uncounted, while a legacy step without a result SHALL remain
executed. No outcome SHALL be invented for an unexecuted row; names SHALL stay
escaped and the report SHALL stay offline.

#### Scenario: Legacy zero-step row

- **WHEN** legacy JSON has a scenario with no steps and no hooks
- **THEN** it renders without an outcome
- **AND** the model and summary mark it `executed: false`
- **AND** the scenario totals drop by one compared with version 1

#### Scenario: Legacy step without a result

- **WHEN** legacy JSON has a scenario with a step but no result status
- **THEN** normalization still emits an unknown step result
- **AND** the scenario remains executed and counted

#### Scenario: Legacy attachments

- **WHEN** legacy JSON has step attachments
- **THEN** they still render inline and count once
- **AND** execution detection does not change their totals

#### Scenario: Legacy unexecuted row

- **WHEN** legacy JSON has a scenario without a usable result
- **THEN** it renders without an outcome
- **AND** no new status is invented

#### Scenario: JUnit

- **WHEN** the input is JUnit XML
- **THEN** execution detection follows the parsed test case
- **AND** no network request is made

### Requirement: Show CI metadata from Messages

When `meta.ci` is present, the report SHALL show the CI name/link and git
revision, branch and tag when available. Missing fields are omitted; a URL
without a name uses the URL as label. Safe GitHub https/ssh/scp remotes link
the 7-character commit; other schemes stay plain text. Only http(s) CI URLs
become links.

#### Scenario: CI job and git revision

- **WHEN** `meta.ci` has a name, URL and git revision
- **THEN** the header and Details show the CI name as a link
- **AND** the short revision is visible
- **AND** branch and tag are shown when present

#### Scenario: Commit link

- **WHEN** `meta.ci.git.remote` is a safe GitHub https, ssh or scp-like remote
  and a revision exists
- **THEN** the 7-character revision links to the commit
- **AND** the full revision is available as a title
- **AND** other remotes or schemes render the revision as plain text

#### Scenario: CI URL without a name

- **WHEN** `meta.ci` has a safe http(s) URL and no name
- **THEN** the header and Details show the URL as the link label

#### Scenario: Partial metadata

- **WHEN** `meta.ci` has no URL or no git fields
- **THEN** only the available fields render
- **AND** no empty link or placeholder is rendered

#### Scenario: Legacy/JUnit

- **WHEN** the input is legacy JSON or JUnit
- **THEN** no CI metadata is invented

### Requirement: Improve attachment naming

Attachment names SHALL use the Cucumber file name when present, otherwise a
deterministic `attachment.<extension>` fallback across all inputs. Media types
SHALL be normalised and checked against the renderer allowlist; known
parameterised media types strip parameters and keep their extension, while
unknown, XML, XHTML or comma-joined types become `application/octet-stream`
before any name or data URI is built.

#### Scenario: Named attachment

- **WHEN** an attachment has a file name
- **THEN** that name is used unchanged and escaped

#### Scenario: Unnamed attachment

- **WHEN** an attachment has no file name and a known media type
- **THEN** the name is `attachment.<extension>`
- **AND** the same input produces the same name

#### Scenario: Path-like name

- **WHEN** a file name contains path separators or traversal text
- **THEN** it is shown as text, not used as a filesystem path

#### Scenario: Unknown or forged media type

- **WHEN** an attachment declares `application/vnd.acme.widget`,
  `application/xhtml+xml`, `application/xml` or a comma-joined type
- **THEN** its media type is `application/octet-stream`
- **AND** its name is `attachment.bin` when unnamed
- **AND** the raw value never appears in a data URI

### Requirement: Render JSON and URI-list attachments

`application/json` attachments (including media-type parameters) SHALL be
pretty-printed and escaped; invalid JSON SHALL fall back to escaped raw text.
Only http(s) `text/uri-list` entries become links; other schemes remain text.
The report SHALL make no request when opened.

#### Scenario: Unknown media type

- **WHEN** an unnamed attachment has an unknown media type
- **THEN** its name is `attachment.bin`
- **AND** its media type is `application/octet-stream`
- **AND** the name is deterministic

#### Scenario: Parameterised media type

- **WHEN** an unnamed attachment is `application/json; charset=utf-8`
- **THEN** its name is `attachment.json`

#### Scenario: JSON attachment

- **WHEN** an attachment is `application/json`
- **THEN** the body is pretty-printed in a code block
- **AND** HTML inside the JSON is escaped

#### Scenario: Malformed JSON

- **WHEN** a JSON attachment cannot be parsed
- **THEN** its raw text is shown escaped
- **AND** the report still renders

#### Scenario: URI list

- **WHEN** an attachment is `text/uri-list`
- **THEN** http(s) URIs render as links with `rel="noopener noreferrer"`
- **AND** all other schemes render as escaped text
- **AND** the report itself makes no request

### Requirement: Render Cucumber ANSI logs safely

`text/x.cucumber.log+plain` attachments SHALL render SGR colours (including
256/truecolour) with a copy action. Non-SGR control sequences SHALL be stripped
or escaped, and large logs SHALL fall back to escaped text above 256 KB.

#### Scenario: ANSI log

- **WHEN** a log attachment contains SGR colour codes
- **THEN** the text renders with colours
- **AND** the raw escape sequences are not shown as markup
- **AND** a copy action copies the readable text

#### Scenario: Unsafe URI or CI URL

- **WHEN** a URI-list entry or CI URL uses a non-http(s) scheme
- **THEN** it renders as escaped text, not a link
- **AND** mixed case and leading whitespace are handled safely

#### Scenario: Large log

- **WHEN** an ANSI log exceeds 262,144 UTF-8 bytes
- **THEN** it renders as escaped text without colour parsing
- **AND** the report still renders

#### Scenario: Malicious control sequence

- **WHEN** a log contains non-SGR control sequences or HTML
- **THEN** they are stripped or escaped
- **AND** no script runs

#### Scenario: Escape sequences in messages

- **WHEN** a step, hook, run-hook or summary message contains OSC-8, OSC-52,
  DCS, APC, CSI or two-byte escape sequences
- **THEN** the sequences are removed before the text reaches HTML, the JSON
  summary or the clipboard
- **AND** the visible message text is preserved

### Requirement: Keep the offline and count contracts

CI metadata and attachment polish SHALL NOT change scenario or attachment
counts, the JSON summary schema, or the no-network baseline. HTML step counts
keep excluding hooks; comparisons use the documented baseline.

#### Scenario: Counts unchanged

- **WHEN** a report with CI metadata and polished attachments is rendered
- **THEN** scenario/attachment counts match the summary baseline
- **AND** HTML step counts keep excluding hooks
- **AND** the summary schema version is 2

#### Scenario: CI metadata is HTML-only

- **WHEN** a Messages report with `meta.ci` is summarised with `--json`
- **THEN** no CI field appears in the summary
- **AND** `schemaVersion` stays 2

#### Scenario: Offline

- **WHEN** the report is opened offline
- **THEN** CI metadata, JSON, URI lists and ANSI logs render without an
  external request

### Requirement: Render safe GFM descriptions

The report SHALL render feature, rule, background, scenario and examples
descriptions as a safe GFM subset inside a block container: headings, emphasis,
code, links, lists, tables and blockquotes. Description heading level 1 SHALL
render as `h3` and levels 2-6 as `h4`. Raw HTML SHALL NOT be rendered and
images SHALL be omitted without becoming links.

#### Scenario: Markdown description

- **WHEN** a description contains a heading, list, table or blockquote
- **THEN** the formatted structure renders
- **AND** the underlying text is escaped where Markdown does not format it

#### Scenario: Raw HTML in Markdown

- **WHEN** a description contains a script or an HTML tag
- **THEN** it is shown as text or omitted
- **AND** no markup or script executes

#### Scenario: Links and images

- **WHEN** a description contains a link or image
- **THEN** only http(s)/mailto links become anchors with
  `rel="noopener noreferrer nofollow"`
- **AND** images render as alt text only, including reference and linked images
- **AND** the report makes no network request

#### Scenario: Legacy and JUnit descriptions

- **WHEN** legacy JSON or JUnit supplies a description
- **THEN** the same safe Markdown rendering applies
- **AND** JUnit uses its non-standard `description` attributes on `<testsuite>`
  and `<testcase>` as a best-effort feature and scenario description
- **AND** no external asset is loaded

### Requirement: Support tag-expression search

The search box SHALL accept the official tag-expression grammar (`not` before
`and` before `or`, parentheses, escaped tags, lowercase operators) when the
whole query is tag-shaped. Otherwise it uses substring search; mixed text and
tag input is text. Status filters and the tag dropdown combine with a valid
expression using AND.

#### Scenario: Tag expression

- **WHEN** the user enters `@a and not @b`
- **THEN** only scenarios whose tags satisfy the expression remain visible
- **AND** features, rules and examples with no match are hidden
- **AND** at most 20 newly opened rows are expanded

#### Scenario: Invalid expression

- **WHEN** the input is not a valid tag expression
- **THEN** the report falls back to the existing substring search
- **AND** no error is shown

#### Scenario: Mixed text and tags

- **WHEN** the query contains text and tag tokens together
- **THEN** the whole query is treated as substring text
- **AND** the visible count and empty state are accurate

### Requirement: Persist search and filters in the URL

The report SHALL restore `?query=`, repeated lowercase `?hide=` and `?tag=` on
load and update them with `replaceState` when the user changes search or
filters. Restore SHALL synchronize the inputs, select and status buttons and
preserve the hash and unrelated URL parameters.

#### Scenario: Share a filtered view

- **WHEN** the user searches, hides a status or selects a tag
- **THEN** the URL contains the corresponding parameters
- **AND** opening that URL restores the same view

#### Scenario: Restore controls

- **WHEN** a URL contains query, hide and tag parameters
- **THEN** the search box, status buttons and tag select reflect them
- **AND** the search cap and empty state stay consistent

#### Scenario: URL update fails

- **WHEN** `replaceState` is unavailable or throws on `file://`
- **THEN** filtering still works
- **AND** the report does not throw

#### Scenario: No JavaScript

- **WHEN** the inline script does not run
- **THEN** the full static report remains readable
- **AND** URL state is not required

### Requirement: Keep counts, summary and offline behavior

Markdown rendering, tag expressions and URL state SHALL NOT change scenario,
step or attachment counts, the summary schema or the no-network baseline.

#### Scenario: Counts unchanged

- **WHEN** a Markdown/tag-expression report is rendered
- **THEN** its counts match the summary baseline
- **AND** the summary schema version is 2

#### Scenario: Offline

- **WHEN** the report is opened offline
- **THEN** Markdown, tag expressions and restored filters work without a
  server or external request
