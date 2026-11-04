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
stays bounded at hundreds of scenarios. 0.2 finishes that Default view and the
Details comparison; the map and compact lenses stay optional and come later.

## What Changes

0.2 is one hierarchical overview, delivered in three slices.

- **Slice 1 — triage.** Order features and scenarios exception-first:
  non-passing before passed, worst status first, input order inside a status.
  Add a "Needs attention" index above the feature list with status, counts and
  up to three scenario links per feature; capped at 20 features.
- **Slice 2 — feature rows and matrix.** Feature rows show scenario counts and
  a proportion bar, passed features sit below the attention set, and the
  Details feature table becomes a feature × status matrix.
- **Slice 3 — source groups.** Add a group level only when the run has more
  than one input file and the loader carries that provenance; never inferred
  from a feature URI. A single input renders no group level.
- Batch the three unreleased CLI edge fixes into the 0.2 release.

## Impact

- `report-rendering` spec delta; `src/render/html.ts`,
  `src/render/report.css`, the inline report script, and for slice 3 the
  loader/model provenance field.
- Unit render tests, browser tests, responsive/visual checks.
- No CLI contract, summary-schema, or dependency change. No network.
- No new data store: every view is rendered server-side from `ReportModel`.

## Out of Scope

- Map and compact lenses, treemap, split index: post-0.2 optional views.
- Virtualisation or paging for thousands of scenarios.
- Input-format breadth (Playwright JSON, CTRF, TRX), history/trends, PDF/email,
  localisation.
- Changing the order of the JSON summary.

## Tracking

No remote issue exists yet; this change is the tracking artifact.
