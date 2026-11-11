# Proposal

## Why

Scenarios that never executed are currently counted as `unknown`, listed in
“Needs attention” and can make a feature look failed. The official formatter
shows them without an outcome and reports `0 / 0`. This is the last top-tier
0.3 parity gap (G7).

No tracking issue exists yet; the change is driven by
`docs/research/cucumber-html-parity.md` (gap G7).

## What Changes

- Add an `executed` flag to scenarios. `executed` is true when the selected
  test case has at least one raw test-step result, including a hook result.
  Unexecuted means the latest started attempt has zero raw results.
- Never-started pickles and outline examples stay pruned. A started test case
  with zero results, including a started-but-unfinished one, becomes an
  unexecuted row instead of being dropped.
- Unexecuted scenarios render without an outcome and are excluded from every
  count surface: header, feature row and bar, triage, source strip and Details
  matrix. A feature whose scenarios are all unexecuted gets status `unknown`
  and opens by default; its blank rows stay collapsed.
- The header reports the executed passed/total count as `<passed> / <total>`,
  so an empty run shows `0 / 0`.
- **BREAKING:** the JSON summary grows an `executed` field and sets
  `schemaVersion` to 2. Unexecuted entries keep `status: "unknown"` with
  `executed: false` but leave `counts.scenarios`, so
  `counts.scenarios.total` can be smaller than `scenarios.length`. The overall
  summary status ignores unexecuted scenarios. Agents must filter on
  `executed` or use `counts`; the migration is documented in
  `docs/AGENT-INTERFACE.md`.
- Legacy JSON zero-step scenarios change counts: they were counted as
  `unknown` in version 1 and are now unexecuted and excluded. Legacy steps and
  JUnit test cases keep their current execution detection.
- Legacy JSON and JUnit keep the offline/escaped baseline; no outcome is
  invented for an unexecuted row.

Out of scope: G8 Markdown, G10 tag expressions, G11 `meta.ci`, G12 attachment
polish, G14/G15, themes, history and attempt history.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: executed-only counts on every count surface, unexecuted
  rows without an outcome, all-unexecuted features `unknown` and open, and the
  version-2 summary contract.

## Impact

- `src/report/model.ts`, `src/summary.ts`, `src/render/html.ts`.
- Tests/fixtures: CCK `empty.ndjson`, synthetic started-but-unfinished and
  all-unexecuted feature cases, and a legacy zero-step case.
- Existing version-1 assertions to update: `test/cli.test.ts`,
  `test/compat.test.ts`, `test/render.test.ts`, `test/summary.test.ts`,
  `test/model.test.ts`.
- Docs: `docs/CHANGELOG.md`, `docs/AGENT-INTERFACE.md`,
  `docs/ARCHITECTURE.md`, `docs/CUCUMBER-COMPATIBILITY.md`, `GLOSSARY.md`.
- No CLI/API options change; the summary schema bump is a breaking change for
  summary consumers.

## Review gate

PIR and DXR run before implementation. Implementation is a TDD pair: a
TDD-Red worker writes failing acceptance/ISTQB edge tests, then an implementer
makes them green without weakening them.
