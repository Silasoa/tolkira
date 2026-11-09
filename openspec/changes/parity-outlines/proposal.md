# Proposal

## Why

Scenario outlines are the largest visible difference from the official Cucumber
HTML formatter. Tolkira renders every example as a separate, flat scenario, so
an outline with five examples looks like five similarly named scenarios and
repeats the outline description and tags on every row. The official report
shows one outline, its examples blocks and numbered rows, which is how Cucumber
users expect to read the result.

This is the first slice of the 0.3 Cucumber-fidelity work. It should land
before hooks, rules and undefined-step diagnostics because it changes the
report's core grouping and is the most visible gap for Messages users.

No tracking issue exists yet; the change is driven by
`docs/research/cucumber-html-parity.md` (gap G1).

## What Changes

- Messages runs: examples that belong to the same scenario outline are shown
  under one outline section instead of as unrelated scenario rows.
- The outline heading, keyword, tags and description are rendered once. Each
  examples block gets its own heading and tags, and its rows are numbered
  `#1.1`, `#1.2`, `#2.1`, and so on.
- Each example row keeps its own outcome, duration, attachments, steps and
  anchor, so failed examples remain visible and linkable.
- The flat scenario list remains the source for counts, the triage index, the
  status matrix, search, tag filtering and the JSON summary. Grouping changes
  presentation, not the numbers.
- Legacy Cucumber JSON keeps its current flat rendering. The format arrives
  with expanded examples and cannot reconstruct the outline reliably.
- Reports without outlines render exactly as before.

Out of scope: rules, backgrounds, feature/rule tags (G9), hooks (G2/G3),
undefined/ambiguous diagnostics (G4), empty-run semantics (G7), legacy outline
reconstruction, tag-expression search, URL state and visual themes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: the report SHALL group Messages scenario-outline examples
  under their outline and examples blocks, render outline metadata once and
  number example rows, while keeping per-example outcomes, anchors and the
  existing flat counts.

## Impact

- `src/report/model.ts`: outline and examples metadata on scenario rows, or a
  grouped outline view derived from the existing flat rows.
- `src/render/html.ts` and `src/render/report.css`: outline and examples
  headings, numbered rows and styling.
- Tests and fixtures: a Messages fixture with passing and failing examples,
  render assertions, search/anchor regressions and a browser test.
- No CLI, API, summary-schema or dependency change.
- Documentation: `docs/CHANGELOG.md` and the Cucumber compatibility notes.
- After implementation, the CMP reviewer compares the result with the official
  formatter on the same fixture.
