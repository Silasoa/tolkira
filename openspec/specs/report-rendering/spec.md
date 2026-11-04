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
