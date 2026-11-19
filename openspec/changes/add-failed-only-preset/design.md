# Design

## Context

The Report toolbar renders one toggle per present status. The client keeps the
hidden statuses in `state.hidden` and serialises them as `hide` query values.
`scenarioVisible` hides a row only when it has a status and that status is
hidden, so statusless (unexecuted) rows survive every chip layout today.

## State model

Reuse `state.hidden` and add one sentinel value, `unexecuted`. It is not a
status and has no chip:

- `hide=passed&hide=skipped&hide=unexecuted` means “failed only, statusless
  rows hidden”.
- `parseUrlState` stays generic; `restoreUrlState` passes the sentinel as an
  accepted value next to the chip statuses.
- `scenarioVisible` returns false for a row without a status when `hidden` has
  the sentinel; every other filter path is unchanged.
- A manual chip change deletes the sentinel, so the chips keep their documented
  “statusless rows stay visible” behaviour.
- The preset action clears `state.hidden`, adds every present status except
  failed, and adds the sentinel. Undo clears the set.

## Predicate and pruning

`search.ts` exports the sentinel constant and two pure helpers, so the client
and the tests share one rule:

```
UNEXECUTED_HIDE = 'unexecuted'

isFailedOnlyState(hidden, present) =
  present.includes('failed') &&
  !hidden.includes('failed') &&
  present.filter((status) => status !== 'failed')
    .every((status) => hidden.includes(status)) &&
  hidden.includes(UNEXECUTED_HIDE)

pruneFailedOnly(hidden, present) =
  hidden.includes(UNEXECUTED_HIDE) && !isFailedOnlyState(hidden, present)
    ? hidden.filter((value) => value !== UNEXECUTED_HIDE)
    : [...hidden]
```

When the run has no other status, the `every` check is vacuously true and the
preset only adds the sentinel; that is the `--fail-fast`
failed-plus-unexecuted case. A failed-only run has no statusless rows, so a
surviving sentinel hides nothing.

`restoreUrlState` passes `[...chipStatuses, UNEXECUTED_HIDE]` to the generic
`parseUrlState` and applies `pruneFailedOnly` before setting the state. A
crafted `?hide=unexecuted` alone or a sentinel left over from another run
therefore cannot hide existing statusless rows without an in-page control.

## Effects

- The header counts and the `N unexecuted` label are unchanged; the preset is a
  view filter, not a count filter.
- `state.hidden.size` still hides the triage index and source strip, so the
  preset hides them like any other status filter and returns them on undo.
- A search or tag that matches an unexecuted row keeps it hidden while the
  sentinel is present; the empty state follows the visible count.

The toggle is rendered server-side when `counts.scenarios.failed > 0` and either
another present status exists or the model has an unexecuted row; the client
only syncs `aria-pressed`. A failed-plus-unexecuted `--fail-fast` run therefore
gets the shortcut for the rows it can hide.

## DOM and client

- `dom-contract.ts` exports `FILTER_PRESET_ATTRIBUTE = 'data-filter-preset'`.
  `search.ts` owns `UNEXECUTED_HIDE`, `isFailedOnlyState` and `pruneFailedOnly`.
- `html.ts` renders, after the status chips:
  `<button class="filter presetFilter" type="button" data-filter-preset="failed" aria-pressed="false">Failed only</button>`
  when the run qualifies.
- `report-client.ts`:
  - `presentStatuses` is the chip status list. `presetActive()` is
    `isFailedOnlyState([...state.hidden], presentStatuses)`.
  - `syncFilterUi()` sets every chip’s `aria-pressed` from `state.hidden` and
    sets the preset button from `presetActive()` when the button exists.
  - The preset click applies or clears the preset state, then calls
    `syncFilterUi()`, `apply()` and `syncUrl()`.
  - A chip click first deletes the sentinel, then toggles its status, syncs the
    UI, applies and syncs the URL.
  - `restoreUrlState` passes `[...presentStatuses, UNEXECUTED_HIDE]` to
    `parseUrlState`, prunes with `pruneFailedOnly`, sets the chips, then calls
    `syncFilterUi()` and applies when any state is present.
  - `apply` is unchanged except that `scenarioVisible` now sees the sentinel in
    `hidden`; the live count and empty state therefore include the hidden
    statusless rows.
  - `presetActive()` is evaluated before any mutation, so a click never
    double-applies.
- Keyboard comes for free from the native button; the toggle is in the normal
  tab order and toggles with Enter/Space.

## Styling

`.filter.presetFilter[data-filter-preset="failed"][aria-pressed="true"]` uses
the ink mode style: paper text on an ink pill, not the failed status colour.
Unpressed, it keeps the dashed chip style. The preset uses the same flex gap as
the chips; no extra margin, so a wrapped row at 320 px stays aligned.
`styles.ts` and the generated `client-bundle.ts` are rebuilt by the normal
build.

The existing DOM-contract test matches only `class="filter"` exactly. Extend it
so every `button.filter` has exactly one of `data-filter-status` or
`data-filter-preset`, and the preset has no `data-filter-status`.

## Alternatives considered

- **Hide statusless rows without a sentinel.** The same chip state then means
  two different views, and reload cannot distinguish them; rejected.
- **A new `?status=failed` parameter.** A second filter model and a second
  restore path for no benefit; rejected.
- **Single-select chips.** Changes the existing multi-toggle contract; rejected.
- **Rename the control instead of hiding statusless rows.** “Failures and
  unexecuted” is long and the preset would not do what its name says; rejected.

## Risks

- A shareable URL can contain a pseudo-status (`unexecuted`); it is validated,
  pruned unless the preset chip state is present, and unknown values are still
  dropped.
- Manually hiding every other chip without the sentinel shows statusless rows,
  unlike the preset; this is documented and tested.
- A failed-plus-unexecuted run gets the toggle; a run with only failed rows does
  not, so the vacuous pressed state cannot appear.
- No-JS keeps the full static report; the toggle is inert like the chips.
- Archive `clarify-run-presentation` before this change: the MODIFIED
  “Handle empty features and runs” block carries that change's wording plus the
  preset exception, and archiving in the other order would drop the exception.
