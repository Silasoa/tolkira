# TDD-Red — failed-only preset

Date: 2026-11-19

Status: RED confirmed. No production code, docs or config changed.

## Files

- `test/search.test.ts` — sentinel, predicate, pruning and URL round-trip.
- `test/dom-contract.test.ts` — statusless visibility rule and the extended
  `button.filter` attribute invariant.
- `test/render-preset.test.ts` — toggle presence and toolbar markup.
- `test/e2e/failed-only.spec.ts` — browser behaviour, URL restore, search,
  tag, source strip, keyboard, no-JS and viewports.
- `openspec/changes/add-failed-only-preset/tdd-red.md` — this report.

## Red reasons

### `test/search.test.ts`

The module does not export the future API: `UNEXECUTED_HIDE` is `undefined`,
and `isFailedOnlyState` / `pruneFailedOnly` are not functions. The URL
round-trip also exposes the consequence: the serialised sentinel becomes an
`undefined` query value and disappears on parse. These tests cover:

- the sentinel value and every true branch of the predicate;
- false for failed hidden, a present other status still on, missing sentinel,
  no failure in the run, and no present status;
- pruning a lone or partial sentinel while keeping the exact preset and any
  ordinary chip-only state;
- a `serializeUrlState` / `parseUrlState` round-trip containing the sentinel.

### `test/dom-contract.test.ts`

`scenarioVisible` currently ignores the sentinel: a statusless row stays
visible when `hidden` contains `unexecuted`. The new test asserts it hides the
row only in that case, keeps statusless rows visible for an ordinary chip
state, and leaves passed and failed rows visible when only the sentinel is
hidden.

The DOM-contract invariant now matches every `<button class="filter…">` (not
only `class="filter"`) and requires exactly one of `data-filter-status` or
`data-filter-preset`, with no `data-status`. It is green today because only
chips exist; it guards the new preset markup.

### `test/render-preset.test.ts`

`renderHtml` does not render `data-filter-preset` yet, so:

- `empty-statuses.ndjson`, `all-statuses.ndjson` and the mixed
  `legacy/failed.json` do not contain the button;
- the derived failed-plus-unexecuted run does not contain the button;
- the expected exact markup and chip ordering are absent.

The two negative cases (passed-only `legacy/behave.json` and a derived
failed-only run) are green now and guard against over-rendering.

Note: `legacy/failed.json` is not an all-failed run. It has one failed and five
passed scenarios, so the spec's presence rule requires the toggle. The
failed-only negative is therefore derived from that fixture by keeping only
the element with a failed result.

The failed-plus-unexecuted fixture is derived from `empty-statuses.ndjson` by
dropping its `Passed scenario` pickle. The remaining rows are one failed
scenario and one statusless row, so the toggle can only come from the
unexecuted branch, and no passed chip is rendered.

### `test/e2e/failed-only.spec.ts`

All ten tests fail because the browser never finds
`button[data-filter-preset="failed"]`. Three fail on a locator assertion; seven
time out waiting to click or focus the absent control. No report generation or
navigation error appears before that point. Covered behaviour:

- activate/undo: rows, live count, chip state, URL hides and triage;
- a manual chip change clears the sentinel;
- a partial chip state leaves the toggle unpressed;
- `?hide=passed&hide=unexecuted` restores the preset;
- `?hide=unexecuted` alone is pruned and all rows stay visible;
- search matches failed rows while a matching blank row stays hidden;
- the tag filter combines on failed rows (`legacy/tag-expressions.json`);
- the source strip hides and returns in a two-input report
  (`all-statuses.ndjson` + `run-ratio.ndjson`);
- Space on the focused toggle;
- the no-JS static report keeps the control inert and all rows visible;
- 320, 390, 768, 1024 and 1440 px plus 320 px at 200 % text have no
  horizontal overflow.

The initial live region is not asserted before the first interaction: the
client fills it only when `apply()` runs, and a report opened without URL
state currently skips `apply()`.

## Commands and results

```
npx vitest run test/search.test.ts test/dom-contract.test.ts test/render-preset.test.ts test/render.test.ts
```

Result: `Test Files 3 failed | 1 passed (4)`, `Tests 13 failed | 139 passed
(152)`. `test/render.test.ts` stays green; the 13 red tests split into 9 search,
1 DOM-contract and 3 render-preset failures, each listed above.

```
npx playwright test test/e2e/failed-only.spec.ts --project=chromium
```

Result: `10 failed`. Every failure is the absent
`button[data-filter-preset="failed"]` locator.

```
npx tsc --noEmit
```

Result: only the three expected errors for the missing `search.ts` exports.

```
npx oxlint test/search.test.ts test/dom-contract.test.ts test/render-preset.test.ts test/e2e/failed-only.spec.ts
```

Result: clean.

No existing test was deleted, skipped or weakened.
