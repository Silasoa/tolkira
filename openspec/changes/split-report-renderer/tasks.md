# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal and design; fix blockers.
  PIR and DXR PASS on 2026-11-19.
- [x] 1.2 Link the change to #7 and B-004.

## 2. Characterization baseline

- [ ] 2.1 Add `test/render-characterization.test.ts`: render the eight fixtures
  with `vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))` and assert
  SHA-256 against constants recorded from the current code. Commit it green
  before touching `src/render`.
- [ ] 2.2 Add `test/render-golden.test.ts` with two file snapshots generated
  from the current code and the same fake time: `legacy/minimal.json` with a
  title, and `messages/attachments-presentation.ndjson` with a title, metadata,
  accent and a small PNG data-URI logo. Commit them green.
- [ ] 2.3 Run `npm run check` on the clean baseline and record the counts; every
  later task keeps it green. No knowingly red test is committed in this phase.

## 3. Split

After each of 3.1-3.8, run `npx tsc --noEmit`, the characterization test and the
markup tests (`npx vitest run test/render.test.ts test/render-characterization.test.ts`).

- [ ] 3.1 Add `src/render/types.ts` and `src/render/format.ts`; move the shared
  helpers and types with no behavior change.
- [ ] 3.2 Add `src/render/ci.ts`; move the CI header/detail helpers.
- [ ] 3.3 Add `src/render/attachments.ts`; move the attachment renderers.
- [ ] 3.4 Add `src/render/triage.ts` and `src/render/matrix.ts`; move the
  triage, source strip, feature shape and matrix.
- [ ] 3.5 Add `src/render/details.ts`; move `renderAnalysisView` and its panels.
- [ ] 3.6 Add `src/render/report.ts`; move the report header, toolbar, features,
  scenarios, steps, hooks and the report view. Split this task in two if it
  exceeds two hours.
- [ ] 3.7 Reduce `src/render/html.ts` to the shell, CSP and `renderHtml`; keep
  `renderHtml` and a one-line `export type { RenderOptions }`. Add
  `test/render-modules.test.ts` now that the modules exist: assert the expected
  module set and the layer direction. It is green once the split is complete and
  guards future imports.
- [ ] 3.8a Extract the report-view fragments (`reportHeader`, `toolbar`,
  `featureSummary`, `scenarioSummary`, `scenarioBody`) with no whitespace change.
- [ ] 3.8b Extract the Details fragments (`detailsHeader`, `runPanel`,
  `environmentPanel`) with no whitespace change.

## 4. Docs

- [ ] 4.1 Add a renderer file map to `docs/ARCHITECTURE.md` (it does not have a
  per-file map today) and update the entry description.
- [ ] 4.2 Point `DESIGN.md` at `render/report.ts` for report internals instead of
  the now-shell-only `html.ts`.
- [ ] 4.3 Add the `scenarios.ts`/`steps.ts` split trigger to
  `docs/BACKLOG.md` (when `report.ts` exceeds ~800 lines or a second consumer
  needs scenario/step rendering).

## 5. Verification and review

- [ ] 5.1 Re-render the fixture set and require the characterization hashes and
  both golden snapshots to stay identical.
- [ ] 5.2 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 5.3 Run the review swarm: SCR, CR, DAR, STR.
- [ ] 5.4 Fix findings, commit and push with #7 and the change reference.

## Gate record

To be filled after verification: characterization hashes, golden, check/e2e
counts, review verdicts and any deferred item.
