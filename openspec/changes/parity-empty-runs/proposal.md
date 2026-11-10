# Proposal

## Why

Scenarios that never executed are currently counted as `unknown`, listed in
“Needs attention” and can make a feature look failed. The official formatter
shows them without an outcome and reports `0 / 0`. This is the last top-tier
0.3 parity gap (G7).

No tracking issue exists yet; the change is driven by
`docs/research/cucumber-html-parity.md` (gap G7).

## What Changes

- Add an `executed` flag to scenarios. A scenario with no step result is not
  executed.
- Unexecuted scenarios render without an outcome, are excluded from scenario
  counts and the triage index, and do not make a feature pass or fail.
- A feature whose scenarios are all unexecuted gets the `unknown` status and
  opens by default.
- Empty runs show `0 / 0`, no “Needs attention” and no outcome on the blank
  scenario.
- Keep finished empty rows and include started-but-unfinished test cases as
  unexecuted rows instead of dropping them.
- **BREAKING:** the JSON summary grows an `executed` field and counts exclude
  unexecuted scenarios; `schemaVersion` moves from 1 to 2. The migration is
  documented in `docs/AGENT-INTERFACE.md`.
- Legacy JSON and JUnit keep their current execution detection; no outcome is
  invented for an unexecuted row.

Out of scope: G8 Markdown, G10 tag expressions, G11 `meta.ci`, G12 attachment
polish, G14/G15, themes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: unexecuted scenarios and empty runs render without an
  outcome, are excluded from counts/triage and set an all-unexecuted feature
  to `unknown`.

## Impact

- `src/report/model.ts`, `src/summary.ts`, `src/render/html.ts`.
- Tests/fixtures: CCK `empty.ndjson`, synthetic started-but-unfinished and
  all-unexecuted feature cases.
- Docs: `docs/CHANGELOG.md`, `docs/AGENT-INTERFACE.md`,
  `docs/CUCUMBER-COMPATIBILITY.md`, `GLOSSARY.md`.
- No CLI/API options change; the summary schema bump is documented.

## Review gate

PIR and DXR run before implementation. Implementation is a TDD pair: a
TDD-Red worker writes failing acceptance/ISTQB edge tests, then an implementer
makes them green without weakening them.
