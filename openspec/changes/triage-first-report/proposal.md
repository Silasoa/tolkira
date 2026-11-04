# Proposal

## Why

The Report view answers "did the run pass?" in the header, but not "what needs
attention right now" without scrolling. Features keep input order, so a failed
feature can sit below dozens of passed ones, and its failing scenario is inside
a collapsed tree. The UI research (`docs/research/report-ui-patterns.md`,
`docs/research/hierarchy-overview.md`) found the same pattern across Playwright,
pytest-html and Mochawesome: exception-first first screens work, dashboards put
the failure path below charts.

The synthesis (Default/Map/Compact) confirms Default as the only variant that
stays bounded at hundreds of scenarios. Its cheapest part is ordering plus a
compact jump list; the map and matrix are separate lenses, not this slice.

## What Changes

- Order features and scenarios in the Report view exception-first:
  non-passing before passed, worst status first, input order inside a status.
- Add a "Needs attention" index above the feature list: one compact row per
  non-passing feature with status, scenario counts and up to three scenario
  links. Capped at 20 features, absent when everything passed.
- Add stable anchors so an index link expands and reveals the target scenario.
- Leave the Details view, the JSON summary and the stored model in input order.

## Impact

- `report-rendering` spec delta; `src/render/html.ts`,
  `src/render/report.css`, the inline report script.
- Unit render tests, one browser test, responsive/visual checks.
- No CLI, summary-schema, input-format or dependency change. No network.
- No new data store: the index is rendered server-side from `ReportModel`.

## Out of Scope

- Source groups: `ReportModel` has no input provenance, so no group level is
  invented from a feature URI.
- The feature × status matrix, map and compact modes, treemap, split index.
- Virtualisation or paging for thousands of scenarios.
- Changing the order of the JSON summary or the Details view.

## Tracking

No remote issue exists yet; this change is the tracking artifact.
