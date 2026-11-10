# Tasks

## 1. Fixtures and model

- [x] 1.1 Add the CCK `undefined`, `undefined-multiple`, `ambiguous`,
  `all-statuses` and `empty` `.ndjson`/`.feature` fixtures with a provenance
  note; verify they parse and expose the expected statuses.
- [x] 1.2 Write RED model tests for suggestion snippets and matching
  definitions on `ReportStep`; include a passed step that carries definition
  ids and must not render a diagnostic.
- [x] 1.3 Collect `suggestion` and `stepDefinition` envelopes, guard omitted or
  malformed repeated fields, and attach `suggestions`/`definitions` to the
  matching steps; verify 1.2 passes.
- [x] 1.4 Add fallback tests for an undefined step without suggestions, an
  ambiguous step without definitions, legacy JSON and JUnit; verify the leads
  still render and no diagnostics are invented.
- [x] 1.5 Add optional `suggestions`/`definitions` to summary steps without
  changing `schemaVersion`; verify the summary tests.

## 2. Rendering and default open state

- [x] 2.1 Write RED render tests for the undefined diagnostic (always the lead,
  one and multiple snippets, language labels, no snippet sentence without
  data), ambiguous diagnostic (always the lead, patterns and relative source
  references), and escaping.
- [x] 2.2 Implement the status-gated diagnostic blocks in `renderStep`; verify
  2.1 passes.
- [x] 2.3 Write RED tests that non-passed features and scenarios are open by
  default (undefined, ambiguous, pending, skipped, unknown) and passed ones
  stay collapsed; verify the tests fail before the open-state change.
- [x] 2.4 Open features with any non-passed scenario or image, and scenarios
  with any non-passed status or image; verify 2.3 passes and the search cap
  counts only newly opened rows.
- [x] 2.5 Add diagnostic text to the scenario search text with the existing
  message cap; verify search finds an undefined step and its diagnostic.

## 3. Browser, security and scale

- [x] 3.1 Add a browser test for an undefined scenario: feature/scenario open,
  lead and snippet visible, search finds it.
- [x] 3.2 Add a browser test for an ambiguous scenario: both definitions and
  relative source references visible.
- [x] 3.3 Test XSS in snippets, patterns and source references; verify no
  markup or script executes and the SEC review can reuse the fixture.
- [x] 3.4 Verify 320 px and 320 px at 200 % text zoom with diagnostics; no
  horizontal page scroll or clipped code blocks.
- [x] 3.5 Add a 1,000-scenario non-passed stress mode that checks every row is
  open and records generation/size budgets; add a browser test that loads the
  1,000-row report and budgets load and first search.
- [x] 3.6 Add a legacy compat test with an undefined/skipped scenario and note
  that auto-open covers legacy/JUnit while diagnostics are Messages-only.

## 4. Documentation, gate and review

- [x] 4.1 Update `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/AGENT-INTERFACE.md` and `GLOSSARY.md` with diagnostics, auto-expansion,
  summary fields and the legacy/JUnit fallbacks; verify the documented example
  matches the generated report.
- [x] 4.2 Run the full reviewer set (SCR, CR, DAR, SEC, UXR, PCA, CMP); the CMP
  reviewer compares the official formatter first, then MCHR, Allure and
  Playwright on the same fixtures. Fix every blocker.
- [x] 4.3 Run `npm run check` and `npm run test:e2e`; verify the gate is green.

## Workflow follow-up

- Archive the change after the review set and the user approve it.
