# Design

## Context

The data is already correct; the problems are contract wording and rendering.
A Playwright project becomes one feature whose scenarios keep their own `uri`.
A statically skipped Playwright test gets one synthetic skipped step, so the
summary sees a result. `AGENT-INTERFACE.md` currently defines `executed` as a
raw step result, which the synthetic step is not.

## Data flow

Playwright JSON → `src/input/playwright.ts` (normalized Cucumber Messages, one
location per error) → `src/report/model.ts` (unchanged `ReportModel`) →
`src/render/html.ts` (counts, ratios, source labels, headings, durations) → one
self-contained HTML file. The JSON summary in `src/summary.ts` is unchanged.
This follows ADR 0001 (hybrid report engine), ADR 0004 (normalize to Messages)
and ADR 0005 (server-rendered shell).

## Decisions

### D1 — Keep the flag, define it

A reported skip is a final result, not a missing one. Setting `executed: false`
would turn a visible skipped scenario into an unknown, unexecuted one and lose
the skipped status. Excluding skipped from `counts.scenarios` would be a schema
change. Therefore:

- `executed` stays `true` for a reported skip;
- `docs/AGENT-INTERFACE.md` and `GLOSSARY.md` define `executed` as “the runner
  reported a result: at least one step or hook result, or a final skipped status
  without raw steps”;
- no JSON key, value shape or `schemaVersion` changes.

### D2 — Pass ratios use attempted scenarios

Attempted = a reported result whose status is not `skipped`. Only reported rows
participate in counts, so unexecuted rows never reach the ratio:

- `attempted = counts.scenarios.total - counts.scenarios.skipped`
- run percent = `round(passed / attempted * 1000) / 10`
- Report header: `50%`, visible `1 / 2 attempted`, screen-reader
  `1 of 2 attempted scenarios passed`
- Details health: `50%`, `1 / 2 attempted`
- feature text: `1 passed of 2 attempted` plus the existing non-passing names
  (which already include skipped)
- no attempt but reported results: `No scenarios attempted` in both views,
  counts and pills stay
- empty run: `0%` and `0 / 0` unchanged

The Details “Status distribution” paragraph becomes:
`Pass rate counts attempted (non-skipped) scenarios; counts and bars include skipped.`
Only the two health ratios and the feature's pass text change. Every other
count surface keeps `executed` (including skipped): the feature bar, status
bar, pills, matrix cells and totals, triage and open state. `attentionCounts`
keeps all reported statuses so `1 skipped` is still named. Triage behaviour for
skipped results is unchanged; it is recorded as a backlog decision.

### D3 — Count reported scenarios and name unexecuted rows

`counts.scenarios.total` counts scenarios with a reported result. The header
replaces `N executed scenarios` with `${total} scenario(s) with results` and
adds `${n} unexecuted` when rows exist with `executed: false`. A never-started
pickle has no row, so it cannot inflate this count. No other count changes.

### D4 — Feature source shows a file count for multi-file features

Compute in the renderer from the feature's scenarios:

```
uris = new Set(feature.scenarios.map((s) => displayUri(s.uri)).filter(Boolean))
label = uris.size > 1 ? `${uris.size} spec files` : displayUri(feature.uri)
```

Used for `<span class="featureUri">` (Report row), the triage `title`
attribute and `<span class="matrixUri">` (Details matrix). The Report row hides
its source below the existing 900 px breakpoint; the matrix stays visible.
Deduplicating on `displayUri` avoids inflating the count for absolute or
backslash variants of the same file. Single-file features keep the current
path; no model field is added and the source strip contract is unchanged.

### D5 — One location line

`errorText` in `src/input/playwright.ts` currently appends
`at ${locationText(...)}` after the message and snippet. Playwright messages and
snippets often already contain that location. Check each part before appending,
with a token boundary so `file:1` does not match inside `file:12`:

```
hasLocation(part, at) =
  new RegExp(`(?:^|[^\\w:./-])${escapeRegExp(at)}(?![\\w:])`)
    .test(part.replace(/\\/g, '/'))
```

Append only when no part contains the complete location. The check runs per
error, so a result with two errors keeps one location for each.
`locationText` already supports `<file>[:<line>[:<column>]]`. The message stays
escaped by the renderer as before.

### D6 — Neutral labels

- `Cucumber environment` → `Run environment` for every producer, including
  Cucumber. The listed values are unchanged; unavailable rows stay omitted.
- Details run row `Duration` → `Test time` (sums scenarios and run hooks).
- Details matrix column `Duration` → `Scenario time` (sums scenarios).
- Details note: `Test time sums the final attempt per scenario and test-run
  hooks; Scenario time sums the final attempt per scenario. Neither is
  wall-clock time.`
- Report header: `<span title="Sum of the final attempt per scenario and run hooks"><b>Test time</b> …</span>`.

## Module changes

- `src/render/html.ts`: attempted helpers, header meta, run and Details health,
  feature text, `featureSourceLabel`, triage title, environment heading, matrix
  header, duration labels and note.
- `src/input/playwright.ts`: location containment check in `errorText`.
- `docs/AGENT-INTERFACE.md`: `executed` definition; HTML pass-rate note;
  duration sums.
- `docs/PLAYWRIGHT-JSON.md`: skipped result semantics, location rule, duration
  wording.
- `docs/ARCHITECTURE.md`: the count/percentage paragraph now separates reported
  counts from the attempted pass rate.
- `README.md`: the Details line that still says `Cucumber environment`.
- `DESIGN.md`: the Feature source badge and the Details `Cucumber environment`
  row.
- `GLOSSARY.md`: executed/skipped definitions and the attempted pass-rate rule.
- `docs/CHANGELOG.md`: one user-facing entry.
- Tests: `test/playwright.test.ts`, `test/render.test.ts`,
  `test/e2e/report.spec.ts` and `test/e2e/visual.spec.ts` as needed. Assert the
  header meta with a scoped locator (`.meta` or `{ exact: true }`); `getByText`
  also matches the live region and the source cards.

## Alternatives considered

- **Set `executed: false` for a skipped no-step test.** Loses the skipped status
  and contradicts Cucumber semantics; rejected.
- **Remove skipped from `counts.scenarios`.** Schema-visible and hides skipped
  results from agents; rejected.
- **Show 0 % for an all-skipped run.** Implies failure where nothing was tried;
  rejected in favour of `No scenarios attempted`.
- **Drop the feature URI for multi-file features.** Loses orientation; a count
  is more useful.
- **Tooltip-only duration explanation.** Not discoverable on touch; a label plus
  sentence is better.

## Risks

- Pass percentages change for runs with skips; call it out in the changelog.
- Existing unit and browser tests pin `2 executed scenarios`, `Cucumber
  environment`, the `Duration` matrix header and several percentages; update
  them without weakening the assertions.
- A skipped-only run has no ratio but still appears in “Needs attention” because
  skipped is non-passed; that is pre-existing, recorded in `docs/BACKLOG.md`.
- The CI summary keeps its own `Duration` label and `executed scenarios` wording
  for now; aligning it is a separate backlog item.
- Archive after `add-playwright-json-adapter`, because both changes add to the
  `input-formats` capability.
