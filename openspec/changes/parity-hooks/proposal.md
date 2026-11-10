# Proposal

## Why

Hooks are the second-largest visible difference from the official Cucumber HTML
formatter. Tolkira renders every hook as an ordinary step, so a scenario with
two passed hooks claims `3 steps` instead of `1 step`, hook names disappear and
passed hooks add noise to every scenario. Test-run hooks (`BeforeAll` and
`AfterAll`) are accepted by the parser but never rendered at all.

This is the G2 + G3 slice of the 0.3 Cucumber-fidelity work. It follows the
outline slice and uses the same Messages-first approach; legacy JSON keeps its
best-effort per-scenario hooks.

No tracking issue exists yet; the change is driven by
`docs/research/cucumber-html-parity.md` (gaps G2 and G3).

## What Changes

- Per-scenario hooks are separated from steps. The scenario subtitle counts
  steps and hooks separately, and the HTML step counts no longer include hooks.
- Hook rows show their type (`Before`, `After`, `BeforeStep`, `AfterStep`),
  their name when Messages provides one (`Before: name`), status, duration,
  error and attachments.
- Passed hooks are collapsed behind a `N hooks` disclosure. Failed, skipped and
  other non-passing hooks stay inline so the failure is visible.
- Test-run hooks get their own Hooks section above the feature list, with
  BeforeAll/AfterAll type or name, status, duration, error and attachments. The
  section is omitted when the run has no test-run hooks.
- A failed hook still makes its scenario non-passing and keeps it in the triage
  index; the hook error is visible in the scenario.
- Legacy Cucumber JSON keeps its per-scenario `before`/`after` hooks as
  best-effort hook rows; it has no test-run hooks and usually no hook names.
  JUnit has no hooks.
- The JSON summary contract is unchanged in this slice. It still represents
  hooks as `steps` entries with `keyword: "Hook"`; the HTML report is the view
  that separates them. Changing the summary is a separate schema decision.

Out of scope: undefined/ambiguous diagnostics and auto-expansion (G4/G5/G6),
rules/backgrounds/feature tags (G9), empty-run semantics (G7), Markdown
descriptions (G8), tag-expression search and URL state (G10), `meta.ci` (G11),
attachment polish (G12), the stream adapter (G14), parameter highlighting
(G15), hook source-location links and a summary-schema change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: the report SHALL separate per-scenario hooks from steps,
  collapse passed hooks, render hook names, errors and attachments, and show a
  test-run Hooks section for BeforeAll/AfterAll.

## Impact

- `src/report/model.ts`: `ReportHook`, `ReportRunHook`, per-scenario hook rows,
  run-hook collection, hook attachments and step counts.
- `src/render/html.ts` and `src/render/report.css`: scenario hook groups, run
  hooks section, hook rows, search text and responsive styling.
- Tests and fixtures: the CCK `hooks.ndjson` fixture, synthetic named/failed
  hooks and run hooks, legacy hook coverage, browser and responsive tests.
- No CLI, API or dependency change. The JSON summary stays version 1 and keeps
  hooks as steps; the difference is documented in `docs/AGENT-INTERFACE.md`.
- Documentation: `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/AGENT-INTERFACE.md` and `GLOSSARY.md`.
- After implementation, the CMP reviewer compares the result with the official
  formatter on the same fixtures.
