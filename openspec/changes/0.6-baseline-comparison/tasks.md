# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over the proposal, spec delta and design; fold blockers
  into the contract before Red.
- [ ] 1.2 Confirm the current summary field order, the Markdown insertion
  point, the report model's pickle id, the conditional CSS build seam and the
  history reader posture; no new runtime dependency.
- [ ] 1.3 Confirm the decisions recorded in the proposal: name-first identity,
  the count set, the API surface, the panel location and the German copy. ILA
  stays a later catalog review.

## 2. TDD-Red

- [ ] 2.1 Matcher decision table: every baseline/current status pair, unexecuted
  rows, added rows, absent rows, no order or status pairing; retries are one row
  per pickle with the latest attempt.
- [ ] 2.2 Identity: reordered run, renamed `*.feature` file with a unique base
  key, renamed feature and scenario, outline coordinates (including the
  positional limit), duplicate names, a 0.5 baseline without `example`, and an
  ambiguous group counted once.
- [ ] 2.3 Reader: missing, empty, invalid JSON, wrong schema, non-regular,
  directory, symlink to a directory, symlink to a regular file, oversized,
  missing `executed`, non-object entries, wrong field types, unknown status,
  prototype keys exit 1 with no pollution, deep nesting, control/bidi names,
  absolute URI, `..` URI, BOM, nested `baseline` block; only identity/status
  fields are trusted; every invalid shape exits 1 without a write.
- [ ] 2.4 Summary/JSON: block and `change` only with a baseline; schema stays 2;
  stable key order (`change` after `executed`, `example` after `attempt`);
  `notInThisRun` carries `executed` and sorts numerically with missing
  `example` last; cap at 50; no absolute path; no `id` field; no-flag keys
  absent; `example` on Messages outline rows only; no summary golden changes.
- [ ] 2.5 CI: exact line, zero counts, singular/plural, ambiguous suffix, one
  blank line after the line, empty and all-unexecuted runs, no line without a
  baseline, GitHub/Azure bytes unchanged.
- [ ] 2.6 Report: panel counts and list cap, the `--json` pointer line, badges,
  pickle-id join, German labels, escaping, no-JS, print/PDF, filter-active
  panel, 320 px and 200 % text, no horizontal overflow, conditional CSS.
- [ ] 2.7 CLI/API: each surface, email-only and GitHub/Azure-only rejection,
  path collisions, missing baseline, 10 MiB boundary, `BaselineSummary` export,
  `summarizeReport` options, and the stream/`renderHtml` limit.
- [ ] 2.8 E2E: two real runs sharing one baseline, a renamed feature file, a
  fixed scenario, a new failure and a not-in-this-run scenario at 320 and
  1440 px; print/PDF contains the panel; `--static --baseline` after the static
  change lands.
- [ ] 2.9 Confirm RED for every new expectation; no existing test is deleted or
  weakened.

## 3. Implement

- [ ] 3.1 Add `src/baseline.ts` with the reader, matcher and classification;
  import `displayUri` from `summary.ts`; build the comparison once with the
  block and the pickle-id change map.
- [ ] 3.2 Add `options.baseline` to `generateReport`, `renderReport` and
  `summarizeReport`, `--baseline` to the CLI, path validation, the read order
  and the exit codes; export `BaselineSummary`.
  Note (2026-11-23): this change owns the `--baseline` path-collision row in the
  0.6-history-window spec and adds `--baseline` to the history path list
  (`historyConflicts`) when the flag lands.
- [ ] 3.3 Add the summary `baseline` block, per-scenario `change`, the outline
  `example` field and the documented key order.
- [ ] 3.4 Add the report panel, row badges, the separate conditional
  `src/render/baseline.css` string, the `--json` pointer and the en/de catalog
  keys.
- [ ] 3.5 Add the Markdown line at the pinned insertion point; keep GitHub and
  Azure bytes unchanged.
- [ ] 3.6 Document the option, the API, the schema, the CI recipe without the
  `--json > baseline.json` truncation trap, one baseline per suite/variant, the
  shard rule, the two-run artifact, the 10 MiB limit, the stream limit and the
  architecture seam; fix `docs/PRODUCT.md`, `GLOSSARY.md` and `docs/I18N.md`;
  resolve the backlog row at archive time.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [ ] 4.2 SCR, CR, DAR, SEC, UXR, ILA, CMP and STR; PCA if the summary hot path
  changes.
- [ ] 4.3 Run the relevant `docs/DROP-IN-VALIDATION.md` rows on the final tree
  and record host, pin and result.
- [ ] 4.4 Measure the no-flag HTML/summary delta and the panel/badge bytes with
  the flag; record the numbers.
- [ ] 4.5 After all four changes land, run one combined byte characterization:
  the default report, CI and email bytes are unchanged, and the default JSON
  differs only by the additive outline `example`.
- [ ] 4.6 Fix findings; record deferred decisions with a trigger.

Review findings (2026-11-23): PIR/DXR found two identity readings (D7/B3), an
undefined count set (D8/B6), a missing `executed` (D9/I7), an undefined API
surface and stream limit (D10/I2), the panel in the wrong capability (D11/I1),
`example` not scoped to Messages (D12/I4), an undocumented 10 MiB cap (D13/I4),
an ambiguous Markdown insertion point (D14/I6), an incomplete collision matrix
(D15/I17), the CSS-in-`report.css` byte break (B3), a lexicographic
`notInThisRun` sort (D18/I18), the false `displayUri` cycle (D19/I16), and a
design-only reader validation list (DXR I3). The delta now has one identity
algorithm, one count set with the `other` residual, `executed` on
`notInThisRun`, the API/stream split, a `report-rendering` panel delta,
Messages-only `example`, the 10 MiB limit, the pinned CI insertion point, the
full collision matrix, a separate conditional `baseline.css`, the numeric sort
and the hostile-shape reader cases. The docs list gains `docs/PRODUCT.md`,
`GLOSSARY.md` and `docs/I18N.md` (D20). No implementation task is marked done.

## Gate record

- PIR/DXR:
- Focused tests:
- `npm run hygiene`:
- `npm run check`:
- `npm run test:e2e`:
- Host rows:
- Size measurements:
- Review round:
