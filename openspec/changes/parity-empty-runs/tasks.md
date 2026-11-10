# Tasks

## 1. TDD-Red tests

- [ ] 1.1 Add CCK `empty.ndjson`/`.feature` plus synthetic all-unexecuted and
  started-but-unfinished fixtures; verify they parse.
- [ ] 1.2 Write failing model tests: `executed` flag, unexecuted rows excluded
  from counts/triage, all-unexecuted feature status `unknown`, unfinished row
  kept.
- [ ] 1.3 Write failing summary tests: `schemaVersion: 2`, `executed`,
  unexecuted excluded from scenario counts, steps/attachments unchanged.
- [ ] 1.4 Write failing render/browser tests: blank row without outcome,
  `0 / 0`, no triage, mixed run counts, search, no-JS.
- [ ] 1.5 Cover ISTQB edge classes: zero scenarios, one unexecuted, one
  executed + one unexecuted, all unexecuted, started-without-finish.

## 2. Implementer

- [ ] 2.1 Add `executed` to the model and keep started-but-unfinished rows;
  verify 1.2 green.
- [ ] 2.2 Exclude unexecuted rows from counts/triage, set all-unexecuted
  features to `unknown`, and keep them open; verify 1.4 green.
- [ ] 2.3 Bump the summary schema, add `executed`, exclude unexecuted scenario
  counts, update examples; verify 1.3 green.
- [ ] 2.4 Render blank rows without an outcome and keep the empty run at
  `0 / 0`; verify browser/responsive tests.
- [ ] 2.5 Test legacy/JUnit execution detection and no invented outcomes.
- [ ] 2.6 Run `npm run check` and `npm run test:e2e`; verify the gate.

## 3. Documentation and review

- [ ] 3.1 Update `docs/CHANGELOG.md`, `docs/AGENT-INTERFACE.md`,
  `docs/CUCUMBER-COMPATIBILITY.md` and `GLOSSARY.md` with the schema bump,
  empty-run semantics and fallbacks.
- [ ] 3.2 Run the full reviewer set (SCR, CR, DAR, SEC, UXR, PCA, CMP) and the
  STR structure/test-health and MKT market/drop-in reviews.
- [ ] 3.3 Fix every blocker; re-run the gate.

## Workflow follow-up

- Archive after the review set and user approval.
