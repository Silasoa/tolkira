# Tasks

## 1. Planning gate

- [x] 1.1 Run PIR and DXR over the proposal, design and preserved spec
  requirements; fix blockers in the change contract and record the results.
  PIR and DXR returned blockers on 2026-11-19; all are fixed in the proposal and
  design.
- [x] 1.2 Link the change to #9 and B-006 and confirm the baseline test commands
  and counts on the clean worktree.

## 2. Baseline and TDD-Red

- [x] 2.1 Run the baseline suite before any `src/` edit; 148 tests green
  across characterization (8), goldens (2), cross-check (31), parity-metadata,
  model and summary. The committed hashes and goldens are the before state.
- [x] 2.2 TDD-Red adds `test/attachment.test.ts` with the byte-count, full
  14-row media table, empty-fileName, naming/kind, text-format and
  duplicate-formula guard tests described in the design; adds the model-level
  empty-fileName assertion to `test/model.test.ts`; and adds the
  `sanitizeEnvelopes` cap-boundary and exact-message tests to
  `test/sanitize.test.ts`. Run them and confirm they fail for the missing module
  API or constants, not for test mistakes. No production code in this task.

## 3. Consolidate

- [x] 3.1 Move `src/report/attachment.ts` to `src/attachment.ts`; add the
  single media table, `attachmentBytes`, `attachmentMetadata`, the kind/text
  types and the shared cap constants. Update the direct imports in the model,
  renderer and ANSI module, and the `report/attachment.ts` comment in the
  Playwright adapter. Run `npx tsc --noEmit` and the Red tests.
- [x] 3.2 Use the shared byte function and caps in `src/input/sanitize.ts`, the
  shared byte function in `src/summary.ts`, the metadata in
  `src/report/model.ts` and `textFormat` in `src/render/attachments.ts`; remove
  the local helpers. Run the new tests, the cross-check, the characterization,
  the goldens and `test/parity-metadata.test.ts`.
- [x] 3.3 Point the Playwright cap constants at the shared module and keep the
  stat-based checks unchanged. Run `npx vitest run test/playwright.test.ts
  test/sanitize.test.ts test/legacy.test.ts test/compat.test.ts`.

## 4. Documentation

- [x] 4.1 Update `docs/ARCHITECTURE.md`: name `src/attachment` as the shared
  kernel that owns decoded byte accounting, caps, naming, kind and text
  presentation; state its input/report/render direction and the new `ansi.ts`
  import; update the `src/report` bullet and the renderer map note if needed.
- [x] 4.2 Add one Unreleased changelog entry for the internal consolidation.
  Touch only the B-006 entry in `docs/BACKLOG.md` if it needs an in-progress note,
  and mark B-006 in `docs/architecture/rewrite-list.md` as implemented, pending
  merge.

## 5. Verification and review

- [x] 5.1 Re-run the baseline characterization, goldens, cross-check and
  `parity-metadata`; require byte-identical HTML and equal summary bytes. Run
  `npm run hygiene`, `npm run check` and `npm run test:e2e` (including
  `test/e2e/parity-metadata.spec.ts`).
- [x] 5.2 Run the review swarm: SCR, CR, DAR, STR, SEC, PCA. Fix findings with a
  separate fixer worker and re-check. The swarm and the fixer re-checks are
  green.
- [x] 5.3 Commit and push on `openchamber/attachment-bytes` with #9 and the
  change reference. Do not merge, close the issue, tag, stage, publish or archive.

## Gate record

2026-11-19, `consolidate-attachment-bytes` on
`openchamber/attachment-bytes`:

- Baseline before any `src/` edit: 148 tests green (characterization 8,
  goldens 2, cross-check 31, parity-metadata, model, summary).
- `npm run hygiene`: ok.
- `npm run check`: 717 passed, 2 skipped.
- `npm run test:e2e`: 273 passed.
- Review swarm SCR, CR, DAR, STR, SEC and PCA ran with no production blockers;
  the fixer pass completed and SCR, CR, DAR, STR, SEC and PCA re-checked green.
- Commit and push on `openchamber/attachment-bytes`; merge, issue close and
  archive remain with the coordinator.
