# Spec Delta

## MODIFIED Requirements

### Requirement: Show summary and detailed test results

The report SHALL show pass/fail/skipped/pending counts, total duration, features,
scenarios, steps, hooks, errors and stack traces. The default view SHALL remain
a single-column report; deeper analysis SHALL be available in a separate
Analysis view.

#### Scenario: Simple report is the default
- **WHEN** the generated report is opened
- **THEN** the Report tab shows the run summary and feature/scenario details
  without a permanent sidebar or detail pane

#### Scenario: Failed scenario is visible
- **WHEN** the input contains a failed scenario
- **THEN** its feature and scenario are open by default and the failure and
  screenshot are visible inline

#### Scenario: Analysis is optional
- **WHEN** the user opens the Analysis tab
- **THEN** the report shows feature counts, status distribution, run metadata
  and the agent summary without changing the Report tab

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
