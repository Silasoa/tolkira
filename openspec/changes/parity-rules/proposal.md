# Proposal

## Why

Modern Gherkin rules, backgrounds and feature/rule tags are part of the
document structure, but Tolkira flattens rules to a detail label and does not
render feature/rule tags or background headings. Messages users see the
scenarios but not the structure that explains them.

This is the G9 slice of the 0.3 Cucumber-fidelity work. It follows diagnostics
and keeps the flat report model for counts, triage, search and the summary.

No tracking issue exists yet; the change is driven by
`docs/research/cucumber-html-parity.md` (gap G9).

## What Changes

- Feature tags render once in the feature header, not on every scenario row.
- Rules render as sections with keyword, name, description and tags; scenarios
  and outlines group under their rule.
- Background headings and descriptions render for features and rules. Existing
  background steps stay in the scenario steps; no step is duplicated.
- Scenario and examples tags keep their current behavior.
- The flat scenario list remains the source for counts, triage, status matrix,
  search and the JSON summary.
- Legacy JSON has no reliable rule/background structure and stays flat; feature
  and scenario tags remain best effort.
- All new text is escaped and stays inside the single offline file.

Out of scope: empty-run semantics (G7), Markdown descriptions (G8),
tag-expression search and URL state (G10), `meta.ci` (G11), attachment polish
(G12), stream adapter (G14), parameter highlighting (G15), themes and summary
schema changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: the report SHALL show feature/rule/background structure
  and tags while keeping the flat counts, triage, search and summary.

## Impact

- `src/report/model.ts`: optional rule and background metadata on the flat
  report model.
- `src/render/html.ts` and `src/render/report.css`: feature tags, rule sections,
  background headings and responsive styling.
- Tests and fixtures: CCK rules/backgrounds/tags fixtures, render, browser,
  responsive and CMP coverage.
- No CLI, API, summary-schema or dependency change.
- Documentation: `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md` and
  `GLOSSARY.md`.

## Review gate

Before implementation, run PIR (parity) and DXR (developer experience and
integration) over this proposal, the spec delta and the design. Implementation
is delegated to an implementer subagent after the spec is green.
