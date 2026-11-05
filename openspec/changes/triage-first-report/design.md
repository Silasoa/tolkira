# Design

## Data flow

Input files are parsed and merged into `ReportModel` as today. Ordering is a
render concern only: `renderReportView` builds an ordered copy of
`model.features` and of each feature's `scenarios`, then renders the index and
the list from that copy. `model` and the Details view keep input order; the
JSON summary keeps its documented URI-then-name order. See ADR 0005 for the
server-rendered shell.

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

The comparator is: passed last, otherwise severity descending, then input
index. Decorate-sort-undecorate keeps it independent of the engine's sort
stability.

## Index (slice 1)

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

## Feature rows and matrix (slice 2)

A feature row keeps its status cell and name, and gains a compact meta line:
passed / total scenarios, non-passing counts where present, and a segmented
proportion bar with the same status colours as the run bar. The existing URI
stays, truncated by CSS rather than cut in the model. Passed features are
collapsed and sit after the attention set by the ordering rule; no second
"passed features" disclosure is needed.

The Details feature table becomes the matrix: one row per feature, a total
column, one count column per status present in the run (ordered failed first,
passed near the end) and duration. Zero counts render as a muted "0" so the
matrix stays scannable. Columns are chosen from the statuses actually present,
like the toolbar filters, so a clean run does not carry five empty columns.
The table keeps its `tableWrap` scroll region.

## Source groups (slice 3)

Only with real provenance. The loader keeps each input's envelope group and the
model receives `{ file, envelopes }` groups; features built from a group carry
`sourceFile` (the input's base name, never an absolute path). The report renders
a compact source strip above the feature list, one card per input (up to six,
with a remainder line), with its worst status, feature/scenario counts and a
proportion bar, only when:

- the run has more than one input file, and
- every feature URI belongs to exactly one input file.

A URI that appears in two inputs, a file-name collision, or a merged Messages
stream with no file boundary renders no strip. Groups are never inferred from a
URI path, tag or feature name. This keeps the level honest and lets a
single-file report look exactly like today.

## Anchors and reveal

Features and scenarios get deterministic anchors in display order:
`feature-<i>` and `scenario-<i>-<j>`. Model IDs are not used because legacy
parsers synthesise them and their HTML-id safety is not part of the contract.

A small `revealHash()` runs on load and `hashchange`: it resolves
`location.hash`, opens the target if it is a `<details>`, then opens every
ancestor `<details>` and scrolls the target into view. It does not move focus.
The links are ordinary anchors, so they keep working if scripting is
unavailable.

## Styling

The index is a bordered block between the toolbar and the feature list, using
the existing tokens, one row per feature, wrapping counts on narrow widths.
Text status is mandatory; colour is only a secondary cue. No fixed widths,
no horizontal scroll; check 320 px and 200 % text zoom.

## Deferred: flaky

Allure and Playwright mark a test "flaky" when retries produce both a failure
and a pass. Within one run that is derivable from Cucumber Messages attempts,
which the model already stores (`attempt`); it is a small model addition.
Across runs it needs a history file, which is the separate history feature.

0.2 does not add flakiness: the overview should settle first, and cross-run
flaky data would need the history contract. A later slice can show "flaky
(passed on attempt 2)" from attempts in the same stream, with no history.

## Hard parts

- Keeping one severity definition instead of a renderer-local order.
- Opening ancestors without stealing focus or double-scrolling.
- Not letting display ordering leak into summary or Details order.
- Keeping source provenance honest when URIs collide across inputs.

## Risks

- Users who rely on input order in the visible list will see a different order.
  Details and the JSON summary keep the old order; the change is documented.
- A deep link to a scenario is a new, unspecified URL shape. It is stable
  within one generated file only, not across runs.
- The index repeats names and statuses that also appear below. It is bounded
  and link-only; steps and evidence stay in the list.
- Source groups add a level only for multi-file runs; a merged stream keeps the
  flat list, so the two shapes must both stay readable.
