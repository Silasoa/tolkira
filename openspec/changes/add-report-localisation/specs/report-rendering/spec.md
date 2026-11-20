# Spec Delta

## ADDED Requirements

### Requirement: Localize the server-rendered shell

The shell SHALL render its tabs, headings, toolbar, filters, buttons, empty
states, footer, status labels and accessibility names from the active locale
catalog. `<html>` SHALL carry the resolved `lang` and `dir`. Test data SHALL
render unchanged. The no-JS report SHALL keep the localized Report view.

#### Scenario: German shell

- **WHEN** the German report is opened
- **THEN** Report, Details and Trends, the toolbar, filters and footer are
  German
- **AND** the search and filter accessibility names are German
- **AND** feature and scenario text is unchanged

#### Scenario: Synthetic labels and input text

- **WHEN** a German report shows a feature, scenario, attempt or start time
- **THEN** the synthetic labels (`Feature:`, `Scenario:`, `Attempt:`,
  `Started:` and similar) are German
- **AND** the Gherkin keyword, feature/scenario name, step text and tags render
  verbatim
- **AND** a hostile name is escaped and never becomes markup

#### Scenario: No JavaScript

- **WHEN** the German report is opened without JavaScript
- **THEN** the Report view is visible and German
- **AND** Details and Trends stay inert like today

### Requirement: Localize the client messages

Search, filter, copy, visible-count and empty-result messages in the client
script SHALL come from the active locale. Only those client messages SHALL be
embedded in the report; the catalog SHALL NOT ship in the client bundle. The
embedded messages SHALL be escaped and inert.

#### Scenario: Client messages

- **WHEN** the German report is searched or copied
- **THEN** the visible-count, no-result and copy messages are German
- **AND** filtering, tabs and clipboard behaviour are unchanged

#### Scenario: Escaped data block

- **WHEN** a translation contains `<`, `>` or `&`
- **THEN** the embedded client data cannot close its element or start a script
- **AND** the visible text renders literally

### Requirement: Keep German layout usable

German labels SHALL not clip or overflow at the gate viewports. Long status
labels SHALL wrap; this change does not introduce a short form. The page SHALL
not scroll horizontally at 320 px, including at 200 % text zoom.

#### Scenario: Narrow German report

- **WHEN** the German report is opened at 320 px and 200 % text zoom
- **THEN** the tabs, filters, status chips and Trends table stay usable
- **AND** the page has no horizontal overflow
- **AND** an anchored scenario is not hidden behind the sticky bar
