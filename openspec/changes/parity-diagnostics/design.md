# Design

## Context

See `proposal.md` for motivation. `buildReportModel` currently ignores
`suggestion` and `stepDefinition` envelopes. Undefined and ambiguous steps get
their status but no diagnostic. `renderFeature` opens only failed features and
`renderScenario` opens only failed or image-bearing rows, so undefined,
ambiguous, pending and skipped results can stay collapsed.

ADR 0004 normalises legacy JSON to Messages; legacy has no suggestion or
step-definition envelopes. ADR 0005 keeps the report server-rendered, so the
diagnostics and default open state must be in the generated HTML.

## Goals / Non-Goals

**Goals:**

- Attach suggestion snippets to undefined steps.
- Attach matching definitions to ambiguous steps.
- Open every non-passed scenario and its feature by default.
- Keep diagnostics escaped, offline and out of the summary contract.

**Non-Goals:**

- Rules/backgrounds/tags (G9), empty runs (G7), Markdown (G8), tag expressions
  and URL state (G10), `meta.ci` (G11), attachment polish (G12), stream adapter
  (G14), parameter highlighting (G15), source-location links and summary schema
  changes.

## Decisions

### Attach diagnostics to `ReportStep`

Add optional fields:

- `suggestions?: Array<{ language?: string; code: string }>`;
- `definitions?: Array<{ pattern: string; source?: string }>`.

Collect `suggestion` envelopes by `pickleStepId` and `stepDefinition` envelopes
by id. In the test-step loop, attach suggestions for the pickle step and
definitions for `testStep.stepDefinitionIds`. Guard omitted or malformed
repeated fields with `Array.isArray`/`?? []`. Keep the existing step order and
status handling. Render diagnostics only when the step status is `undefined` or
`ambiguous`; passed steps can carry definition ids and must not show a
diagnostic.

### Render diagnostics inside the step

`renderStep` renders a diagnostic block after the step text and before any
attachment:

- undefined: always the "No step definition found." lead; when snippets exist,
  add the snippet sentence and one `<pre>` per snippet with an optional
  language label;
- ambiguous: always the "Multiple matching step definitions found:" lead; when
  definitions exist, add the pattern and source-reference rows.

All text is escaped. Source references use `displayUri` so absolute CI paths
are reduced to a relative form. The diagnostic is visible when the scenario is
open, which G6 guarantees for non-passed results.

### Open non-passed results

`renderFeature` opens when any scenario status is not `passed` or any scenario
has an image, preserving the existing screenshot behavior. `renderScenario`
opens when the scenario status is not `passed`, or when it has an image and is
not grouped. The search cap counts only scenarios it newly opens, so already
open non-passed rows do not consume the 20 slots; the "20 of N" note appears
only when 20 new rows were opened. Passed scenarios stay collapsed.

### Keep search and summary contracts

Add diagnostic text to the scenario search text so a snippet or pattern can be
found. The JSON summary stays version 1 and gains optional `suggestions` and
`definitions` fields on summary steps (additive). Legacy and JUnit keep
status-only behavior.

### Cover the scale and integration paths

Add a stress mode that renders 1,000 non-passed scenarios and checks that every
row is open, generation stays within its time budget and the report stays within
its size budget. A Playwright test loads that 1,000-row report and budgets the
browser load and the first search at 10 seconds each, so mass auto-open is
measured in a browser, not assumed. Add a legacy compat test with an
undefined/skipped scenario and document that auto-open applies to legacy/JUnit
while diagnostics are Messages-only.

## Risks / Trade-offs

- **Snippet/pattern XSS** → escape every snippet, pattern and source reference;
  add an XSS fixture and a browser assertion.
- **Large snippets** → cap the search index like step messages; keep the
  visible code complete.
- **Auto-expanding a large failed run** → the search cap is unchanged; default
  open is the official behavior and the feature list remains scannable.
- **Legacy users see no diagnostics** → intentional; document the difference.
- **Summary/HTML divergence** → diagnostics are not in the summary; document
  that the summary remains the status/count interface.

## Migration Plan

No schema, CLI or API change. HTML output changes for non-passed results.
Rollback is a revert of the slice.

## Open Questions

None.
