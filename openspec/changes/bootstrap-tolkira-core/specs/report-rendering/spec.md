# Spec Delta

## Purpose

Defines the single-file HTML report: its content, shell, offline behaviour,
attachment safety and user-visible security guarantees.

## ADDED Requirements

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
scenarios, steps, hooks, errors and stack traces.

#### Scenario: Failed scenario is visible
- **WHEN** the input contains a failed scenario
- **THEN** the report shows the failure in the summary and on the scenario

#### Scenario: Hooks are visible
- **WHEN** the input contains before/after hooks
- **THEN** the report shows their results with the scenario

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
- **THEN** the report shows the image

#### Scenario: HTML attachment is not executed
- **WHEN** a step has an HTML attachment containing a script
- **THEN** the script does not execute and the content is shown safely as text or sandboxed content

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
