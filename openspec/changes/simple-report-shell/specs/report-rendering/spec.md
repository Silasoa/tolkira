# Spec Delta

## MODIFIED Requirements

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

#### Scenario: Details are optional
- **WHEN** the user opens the Details tab
- **THEN** the report shows feature counts, status distribution, environment,
  run metadata and the agent summary without changing the Report tab

### Requirement: Render attachments safely

The report SHALL render supported images, videos and text attachments. It SHALL
NOT execute HTML or SVG attachments as active content.

#### Scenario: Screenshot is shown
- **WHEN** a step has a PNG attachment
- **THEN** the open scenario shows the image inline

#### Scenario: HTML attachment is not executed
- **WHEN** a step has an HTML attachment containing a script
- **THEN** the script does not execute and the content is shown as escaped text

### Requirement: Stay self-contained

The report SHALL contain all CSS, scripts and attachments and SHALL NOT load
external assets.

#### Scenario: No external assets
- **WHEN** the generated HTML is inspected
- **THEN** it contains no CDN, remote font or remote asset URL and no React
  formatter runtime

## ADDED Requirements

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
