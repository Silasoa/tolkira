# Spec Delta

## ADDED Requirements

### Requirement: Lead the Report view with the first incident

The Report view SHALL render an incident panel when at least one executed
scenario has final status `failed`, `undefined`, `ambiguous` or `pending`. The
panel SHALL resolve the first such scenario in the ordered feature/scenario
list used by the triage and the index. It SHALL be absent when no scenario is
in that set.

#### Scenario: One failed scenario

- **WHEN** one executed scenario has final status `failed`
- **THEN** the panel renders below the toolbar and above the baseline panel and
  the triage block
- **AND** it names the feature and scenario, shows the `Failed` status and the
  first failing step or hook with the first line of its message
- **AND** the triage block and the feature index still render

#### Scenario: All passed

- **WHEN** every executed scenario has final status `passed`
- **THEN** the panel is absent
- **AND** no empty panel or placeholder is rendered

#### Scenario: Skipped or unknown only

- **WHEN** the only non-passing scenarios are `skipped` or `unknown`
- **THEN** the panel is absent
- **AND** the triage keeps its existing attention list

#### Scenario: Undefined or ambiguous

- **WHEN** the first incident has status `undefined` or `ambiguous`
- **THEN** the panel shows the diagnostic lead in the summary
- **AND** the full detail renders the existing diagnostics

#### Scenario: Several incidents

- **WHEN** three executed scenarios are in the incident set
- **THEN** the panel resolves the first
- **AND** a localized plural line states that two more are in the incident set
  and in the list
- **AND** the triage's first-incident link points at the panel and the rest at
  their rows; the triage may list additional skipped rows beyond the incident
  set
- **AND** the others stay reachable through the triage block and the index
- **AND** no selector and no new script are added; the client changes are the
  failure copy scope, scenario-scoped expand/collapse, the list-scoped empty
  copy and the row highlight guard (behaviour preserved: the incident row is no
  longer an open `<details>`, so the guard follows the markup)

#### Scenario: Mixed skipped and failed rows

- **WHEN** the run contains failed, skipped and unknown rows
- **THEN** the panel selects the first incident in the set and the remaining
  count covers the incident set only
- **AND** the triage keeps its broader attention list, including skipped

#### Scenario: Incident row is a link

- **WHEN** the panel resolves a scenario
- **THEN** that scenario's row in the index keeps its status, name, tags,
  thumbnail, duration and `scenarioId` anchor
- **AND** its disclosure is replaced by a link to the panel labelled
  `Shown above`, wherever the grouping places it (standalone, under a rule or a
  nested outline/example row)
- **AND** its detail is not rendered a second time
- **AND** other rows keep their existing disclosure

#### Scenario: Filters

- **WHEN** a toolbar search, status filter or tag filter hides the incident
  scenario's row
- **THEN** the panel keeps rendering the incident
- **AND** no panel control points into the filtered index
- **AND** the triage and source strip keep their existing client hiding
- **AND** the filtered empty state is scoped to the feature index and says no
  scenarios in the list match
- **AND** the client changes do not change filtering

#### Scenario: Expand and collapse controls

- **WHEN** the visitor uses the toolbar's expand or collapse control
- **THEN** it scopes to the scenario rows
- **AND** the incident panel stays open
- **AND** the controls' copy names the scenario rows, not the panel

#### Scenario: Static and print

- **WHEN** the report renders in static, print or PDF form
- **THEN** the panel renders with the same content and no controls
- **AND** the row link prints as text

#### Scenario: Run-level hook failure

- **WHEN** a BeforeAll or AfterAll hook fails without a scenario in the
  incident set
- **THEN** no incident panel renders
- **AND** the existing run hooks section shows the error

### Requirement: Reuse the scenario detail as the incident evidence

The panel SHALL reuse the existing scenario detail for the incident scenario,
including chronological steps and hooks, passed-hook grouping, diagnostics,
doc strings, data tables, step/hook/extra attachments, earlier attempts,
metadata and the copy actions. It SHALL NOT introduce a parallel evidence
renderer.

#### Scenario: Chronological detail

- **WHEN** the incident has hooks and steps
- **THEN** the detail orders them by their existing `order`
- **AND** a failed After hook appears after the steps
- **AND** passed hooks stay in the existing collapsed group

#### Scenario: Copy actions

- **WHEN** the incident detail renders the copy failure or copy log controls
- **THEN** the failure control copies the failure text from the panel
- **AND** the copied failure text keeps the feature title, scenario name and
  facts
- **AND** the log control keeps its nearest attachment details and copies the
  log, not the panel's first error block
- **AND** the existing client resolves the panel copy scope only for the
  failure text

#### Scenario: Failed step

- **WHEN** a step fails with a message
- **THEN** the summary and the detail mark that step and render the message
- **AND** passed steps keep their markers and durations

#### Scenario: Step without a message

- **WHEN** a failed step carries no message
- **THEN** the summary shows the step text and status
- **AND** no empty error block renders

#### Scenario: No evidence

- **WHEN** the incident scenario has no attachments
- **THEN** the panel renders the localized no-evidence line above the detail
- **AND** no empty attachment block renders

#### Scenario: Screenshot evidence

- **WHEN** the scenario has an image attachment
- **THEN** the panel renders it through the existing safe attachment path
- **AND** text, video and skipped path attachments keep their existing
  rendering and notices

#### Scenario: Long scenario

- **WHEN** the scenario has many steps
- **THEN** the summary (feature, scenario, status, first failing step and the
  first line of the error or diagnostic lead) is the above-the-fold minimum
- **AND** the full detail follows in the existing order
- **AND** passed hooks stay collapsed

#### Scenario: Baseline badge

- **WHEN** the scenario carries a baseline change
- **THEN** the panel shows the existing change badge and label

#### Scenario: Outline example

- **WHEN** the incident is an outline example
- **THEN** the panel names the example row and the row anchor still works

#### Scenario: Escaping

- **WHEN** the scenario name, step text, error, tag or source contains HTML
- **THEN** the panel escapes it and renders it verbatim

#### Scenario: German report

- **WHEN** the report locale is `de`
- **THEN** the heading, badges, row label, no-evidence line and remaining count
  are German
- **AND** plurals use the existing ICU convention
- **AND** test data stays verbatim

### Requirement: Apply the Incident review visual language

The report shell SHALL use the Incident review visual language: chart-neutral
paper and ink, one system sans for UI, mono for measurements, timestamps,
error text, paths, source, tags and code, compact chips, one-pixel rules, and
no new elevated or shadowed containers. The Report, Details, Trends, static and
print forms SHALL inherit the same tokens.

#### Scenario: Shared tokens

- **WHEN** the report renders any view
- **THEN** the shell, Details panels, Trends, baseline and tag styles use the
  shared tokens
- **AND** no new elevated or shadowed container is added
- **AND** existing full-border panels keep a full border and the shared 6 px
  radius, with the lightbox exempt from the radius/shadow assertion

### Requirement: Present the incident panel as a bordered block

The incident panel SHALL be a full-border tinted block with the reused detail,
not a one-sided accent bar.

#### Scenario: Bordered incident panel

- **WHEN** the incident panel renders
- **THEN** it has a full border and a tinted background
- **AND** no one-sided accent bar is used

#### Scenario: Light, dark and print

- **WHEN** the report renders in light, dark or print
- **THEN** the same roles map to contrast-safe values on paper, surface-2 and
  surface-3, including the status text
- **AND** status remains readable without colour

#### Scenario: Narrow viewport and zoom

- **WHEN** the report renders at 320 px or 200 % text zoom
- **THEN** the panel and the reused detail wrap without horizontal page scroll
- **AND** the row link and the panel are keyboard reachable

#### Scenario: Offline

- **WHEN** the report is opened offline
- **THEN** the panel and its styles load from the single file
- **AND** no network request is made
