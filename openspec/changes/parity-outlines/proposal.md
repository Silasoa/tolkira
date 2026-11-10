# Proposal

## Why

Scenario outlines are the largest visible difference from the official Cucumber
HTML formatter. Tolkira renders every executed example as a separate, flat
scenario, so an outline with several examples looks like a list of similarly
named scenarios and repeats the outline description and tags on every row. The
official report shows one outline, its examples blocks and numbered rows, which
is how Cucumber users expect to read the result.

This is the first slice of the 0.3 Cucumber-fidelity work. It should land
before hooks, rules and undefined-step diagnostics because it changes the
report's core grouping and is the most visible gap for Messages users. It
targets credible Messages report parity, not full formatter parity; Markdown
descriptions (G8), tag-expression search and URL state (G10), `meta.ci` (G11)
and attachment polish (G12) remain later slices.

No tracking issue exists yet; the change is driven by
`docs/research/cucumber-html-parity.md` (gap G1) and the pre-implementation
review in `docs/research/parity-outlines-review.md`.

## What Changes

- Messages runs: executed examples that belong to the same scenario outline
  are shown under one outline section instead of as unrelated scenario rows.
- The outline heading, keyword, tags and description are rendered once. Each
  examples block that has at least one executed example gets its own heading,
  tags and description, and its rows are numbered `#1.1`, `#1.2`, `#2.1`, and
  so on. Unexecuted rows and blocks are omitted, matching the official
  formatter.
- Each executed example row keeps its own outcome, duration, attachments, steps
  and anchor, so failed examples remain visible and linkable. Failed rows are
  open by default.
- The triage index and copy-failure text include the example number, and the
  examples block name when present, so two failing examples with the same
  pickle name are distinguishable.
- The flat scenario list remains the source for counts, triage membership, the
  status matrix, search and tag filtering. Grouping changes presentation, not
  the numbers. The JSON summary is unchanged because it is computed from
  envelopes, not from the render model.
- Legacy Cucumber JSON keeps its current flat rendering. The format arrives
  with expanded examples and cannot reconstruct the outline reliably. A
  Messages outline with no examples but an executed test case also falls back
  to a flat row; this is a deliberate difference from the official formatter.
- Reports without outlines render exactly as before.

Out of scope: rules, backgrounds, feature/rule tags (G9), hooks (G2/G3),
undefined/ambiguous diagnostics and auto-expansion (G4/G5/G6), empty-run
semantics (G7), Markdown descriptions (G8), tag-expression search and URL state
(G10), `meta.ci` (G11), attachment polish (G12), the stream adapter (G14),
parameter highlighting (G15), legacy outline reconstruction and visual themes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: the report SHALL group executed Messages scenario-outline
  examples under their outline and examples blocks, render outline/examples
  metadata once, number example rows, include example context in triage and
  copy-failure text, and keep per-example outcomes, attachments, anchors,
  counts, search and filters working.

## Impact

- `src/report/model.ts`: optional outline/examples metadata on executed
  scenario rows, derived from the Gherkin AST.
- `src/render/html.ts` and `src/render/report.css`: outline and examples
  headings, numbered rows, triage/copy-failure context, heading hierarchy and
  responsive styling.
- Tests and fixtures: the CCK `examples-tables` and
  `examples-tables-attachment` fixtures, a synthetic Messages fixture with
  outline/examples tags, descriptions, XSS text, a Rule, partial execution,
  an extra AST id and a retry, plus render, browser, responsive and stress
  coverage.
- No CLI, API, summary-schema or dependency change. The JSON summary keeps the
  pickle name; the duplicate-name limitation for outline examples is documented
  in `docs/AGENT-INTERFACE.md`.
- Documentation: `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/COMPATIBILITY.md`, `docs/AGENT-INTERFACE.md` and `GLOSSARY.md`.
- After implementation, the CMP reviewer compares the result with the official
  formatter on the same fixtures, then MCHR, Allure and Playwright. G8 and G11
  differences are known and out of scope for this slice.
