# Design

## Data flow

Input files are parsed and merged into `ReportModel` as today. Ordering is a
render concern only: `renderReportView` builds an ordered copy of
`model.features` and of each feature's `scenarios`, then renders the index and
the list from that copy. `model`, the Details view and the JSON summary keep
input order, so anchor IDs, summary consumers and the documented contract do
not change. See ADR 0005 for the server-rendered shell.

```
ReportModel (input order)
  └─ ordered view (status sort, stable)
       ├─ renderTriage(ordered)   → "Needs attention" nav
       └─ renderFeature(ordered)  → feature list, same order
```

## Severity order

One severity table already exists in `src/report/model.ts` (`STATUS_ORDER`,
mirroring `getWorstTestStepResult`). Export a small `statusSeverity(status)`
from there and sort by it descending instead of adding a second status ranking
in the renderer. "Needs attention" is `status !== 'passed'`; unknown therefore
counts as attention but ranks last among the non-passing statuses, before
passed.

Sorting is stable by construction: decorate each entry with its input index and
compare `severity desc, index asc`, which does not depend on the engine's sort
stability.

## Index

Rendered only when at least one scenario is not passed. One row per non-passing
feature that has at least one scenario, in the same order as the list. A row
shows:

- the worst status as text plus its colour class,
- the feature name as a link to `#feature-<n>`,
- the non-passing counts by status ("1 failed, 2 pending"),
- up to three scenario links with status text, then "N more" as plain text.

Caps: three scenario links and twenty feature rows. Above twenty features a
single remainder line states how many more are in the list. The caps bound the
DOM at roughly eighty links regardless of run size; no client-side data store
is added.

## Anchors and reveal

Features and scenarios get deterministic anchors in display order:
`feature-<i>` and `scenario-<i>-<j>`. Model IDs are not used because legacy
parsers synthesise them and their HTML-id safety is not part of the contract.

A small `revealHash()` runs on load and `hashchange`: it resolves
`location.hash`, opens the target if it is a `<details>`, then opens every
ancestor `<details>`. It does not move focus or call `scrollIntoView`; the
browser's own fragment navigation scrolls. The links are ordinary anchors, so
they keep working if scripting is unavailable (the target may stay collapsed,
which the spec accepts).

## Styling

The index is a bordered block between the toolbar and the feature list, using
the existing tokens, one row per feature, wrapping counts on narrow widths.
Text status is mandatory; colour is only a secondary cue. No fixed widths,
no horizontal scroll; check 320 px and 200 % text zoom.

## Hard parts

- Keeping one severity definition instead of a renderer-local order.
- Opening ancestors without stealing focus or double-scrolling.
- Not letting display ordering leak into summary or Details order.

## Risks

- Users who rely on input order in the visible list will see a different order.
  Details and the JSON summary keep the old order; the change is documented.
- A deep link to a scenario is a new, unspecified URL shape. It is stable
  within one generated file only, not across runs.
- The index repeats names and statuses that also appear below. It is bounded
  and link-only; steps and evidence stay in the list.
