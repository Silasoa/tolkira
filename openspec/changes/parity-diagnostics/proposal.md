# Proposal

## Why

Undefined and ambiguous steps are the largest remaining triage gap for
Messages users. Tolkira shows the status but not the implementation snippet or
the matching step definitions, and non-passed scenarios stay collapsed unless
they failed. The official formatter expands them and tells the user what to
implement or which definitions matched.

This is the G4 + G5 + G6 slice of the 0.3 Cucumber-fidelity work. It follows the
hook slice and keeps the same Messages-first approach; legacy JSON has no step
definitions or suggestions and stays status-only.

No tracking issue exists yet; the change is driven by
`docs/research/cucumber-html-parity.md` (gaps G4, G5 and G6).

## What Changes

- Messages undefined steps show "No step definition found. Implement with the
  snippet(s) below:" and the suggestion snippets, escaped as code.
- Messages ambiguous steps show "Multiple matching step definitions found:"
  with the matching patterns and source references.
- Multiple suggestions and multiple matching definitions are supported.
- Non-passed scenarios and their features open by default, including undefined,
  ambiguous, pending and skipped. The search auto-open cap is unchanged.
- Legacy JSON and JUnit keep their current status-only behavior; they have no
  suggestions or step-definition matches.
- The JSON summary contract is unchanged; diagnostics are an HTML view feature.
- Diagnostics are escaped and stay inside the single offline file.

Out of scope: rules/backgrounds/feature tags (G9), empty-run semantics (G7),
Markdown descriptions (G8), tag-expression search and URL state (G10),
`meta.ci` (G11), attachment polish (G12), the stream adapter (G14), parameter
highlighting (G15), source-location links and summary-schema changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: the report SHALL show undefined-step snippets and
  ambiguous-step definitions, and SHALL open non-passed scenarios and features
  by default.

## Impact

- `src/report/model.ts`: suggestion and step-definition maps on report steps.
- `src/render/html.ts` and `src/render/report.css`: diagnostic blocks, code
  snippets, definition patterns and auto-expansion.
- Tests and fixtures: CCK `undefined`, `undefined-multiple`, `ambiguous`,
  `all-statuses` and `empty`; render, browser, responsive, stress and security
  coverage. `ambiguous` already contains two matching definitions.
- No CLI, API, summary-schema or dependency change.
- Documentation: `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md` and
  `GLOSSARY.md`.
- After implementation, the CMP reviewer compares the result with the official
  formatter on the same fixtures.

## Review gate

Before implementation, run PIR (parity) and DXR (developer experience and
integration) over this proposal, the spec delta and the design. Implementation
is delegated to an implementer subagent after the spec is green.
