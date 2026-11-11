# Tasks

## 1. TDD-Red tests

- [ ] 1.1 Add fixtures: use CCK `empty.ndjson`, add synthetic
  started-but-unfinished, all-unexecuted feature, hook-only result, retry with
  an unexecuted latest attempt, and legacy zero-step cases; verify they parse.
- [ ] 1.2 Write failing model tests: `executed` true with any raw result and
  false with zero results; hook-only result executed; latest-attempt selection;
  never-started pickles and outline examples pruned; started-but-unfinished row
  kept; unexecuted excluded from counts; feature status from executed rows only;
  all-unexecuted feature `unknown`; mixed passed/unexecuted feature `passed`.
- [ ] 1.3 Write failing summary tests: `schemaVersion: 2`; `executed` on every
  entry; unexecuted keeps `status: "unknown"` and `executed: false`;
  `counts.scenarios.total < scenarios.length`; overall status ignores
  unexecuted; hook-only result counted; never-started omitted; steps and
  attachments unchanged.
- [ ] 1.4 Write failing render/browser tests: header `0 / 0` and `X / Y`; no
  triage for all-unexecuted; blank row without status label/outcome; feature
  opens while its blank rows stay collapsed; executed-only feature bar, triage,
  source strip and matrix; source card with `0 scenarios`; mixed run counts;
  search; no-JS.
- [ ] 1.5 Write failing legacy/JUnit tests: legacy zero-step row is unexecuted
  and leaves model and summary counts (version-1 totals drop); legacy step
  without a result stays executed and `unknown`; legacy step attachments still
  render and count once; JUnit detection unchanged.
- [ ] 1.6 Cover ISTQB edge classes: zero executed, one unexecuted, one
  executed + one unexecuted, all unexecuted across features, started without
  finish, hook-only result, retry latest unexecuted, never started, legacy
  zero-step.
- [ ] 1.7 Update the stale version-1 assertions so they fail for the right
  reason: `test/cli.test.ts`, `test/compat.test.ts`, `test/render.test.ts`,
  `test/summary.test.ts`, `test/model.test.ts`.

## 2. Implementer

- [ ] 2.1 Add `executed` to the model, select the latest started attempt, keep
  started-but-unfinished rows and prune only never-started pickles/examples;
  verify 1.2 green.
- [ ] 2.2 Exclude unexecuted rows from model counts and all count surfaces,
  derive feature status from executed rows, set all-unexecuted features to
  `unknown` and open them while keeping their rows collapsed; verify 1.4 green.
- [ ] 2.3 Bump the summary schema to 2, add `executed`, exclude unexecuted
  scenarios from counts, derive overall status from executed scenarios and
  update the embedded summary example; verify 1.3 green.
- [ ] 2.4 Render blank rows without a status label or outcome, move the header
  to executed `passed / total` (`0 / 0` when empty), and keep the empty-run
  empty state; verify browser/responsive tests.
- [ ] 2.5 Apply the same detection to legacy/JUnit normalized results and test
  the legacy zero-step count change; verify 1.5 green.
- [ ] 2.6 Run `npm run check` and `npm run test:e2e`; verify the gate.

## 3. Documentation and review

- [ ] 3.1 Update `docs/AGENT-INTERFACE.md` to schema version 2 with `executed`,
  the `counts.scenarios.total < scenarios.length` relationship, unexecuted
  `status: "unknown"` + `executed: false`, and the rule that agents filter on
  `executed`.
- [ ] 3.2 Update `docs/CHANGELOG.md`, `docs/ARCHITECTURE.md` (schema version 1
  statement and executed-only count surfaces), `docs/CUCUMBER-COMPATIBILITY.md`
  (auto-expansion and version-1 summary shape) and `GLOSSARY.md` with the
  executed/unexecuted vocabulary and the legacy zero-step behaviour.
- [ ] 3.3 Run the full reviewer set (SCR, CR, DAR, SEC, UXR, PCA, CMP) and the
  STR structure/test-health and MKT market/drop-in reviews.
- [ ] 3.4 Fix every blocker; re-run the gate.

## Workflow follow-up

- Archive after the review set and user approval.
