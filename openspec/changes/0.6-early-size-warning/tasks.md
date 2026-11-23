# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over the proposal, spec delta and design; fold blockers
  into the contract before Red.
- [ ] 1.2 Confirm the loader resolution seam, the current `--max-size` warning
  order and the 100 MB cap; no new option or dependency.
- [ ] 1.3 Confirm the threshold (50 MiB) and the summary-only scope with the
  user.

## 2. TDD-Red

- [ ] 2.1 Scan unit: explicit files and a directory sum; a repeated path counts
  once; a stat-only call attempts no content read; a spy pins that the resolved
  file list is built once and passed to both the scan and the loader; a missing
  input leaves the loader to report the error.
- [ ] 2.2 CLI boundary: a temp directory of smaller valid JUnit files totalling
  50 MiB warns and exits 0; 50 MiB minus one byte does not warn; the exact line
  and one-decimal MB unit are pinned.
- [ ] 2.3 Ordering: a malformed 50 MiB sparse file warns before the parse error
  and exits 1 with no partial output.
- [ ] 2.4 Purity: `--json` keeps stdout JSON-only; `--ci` keeps its text; a
  usage error emits no warning.
- [ ] 2.5 Limits: above 100 MB still exits 1 with the cap message; a large
  report still emits the existing report-size warning and both lines can appear
  with different totals.
- [ ] 2.6 Confirm RED; no existing test is deleted or weakened.

## 3. Implement

- [ ] 3.1 Extract the input file resolution used by `loadInputs` and the
  one-decimal MB helper used by the report-size warning; add the stat-only scan
  and the 50 MiB constant.
- [ ] 3.2 Resolve the input list once, pass it to the scan and the loader, call
  the scan after validation and before generation, write the one stderr line and
  ignore scan failures so the loader reports the real error.
- [ ] 3.3 Document the threshold, the exact line and unit, the advisory nature,
  the no-path rule, the two-number difference from the report-size warning, the
  architecture seam and the unchanged cap; record the duplicate overcount limit.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e` if any browser
  fixture changes (expected: none).
- [ ] 4.2 SCR, CR, DAR and STR; PCA if the scan touches the loader hot path.
- [ ] 4.3 Record the test runtime for the 50 MiB fixtures and the scan cost.
- [ ] 4.4 Fix findings; record deferred decisions with a trigger.

Review findings (2026-11-23): PIR/DXR found the scan resolved the file list a
second time (D16/I10), the 50 MiB JUnit `system-out` fixture was too heavy
(D17/I11), the MB helper was a local closure in `runCli` (I12), and the early
total can differ from the report-size warning's `input` value (I20). The design
now resolves the list once and shares it with the loader, the fixture is a temp
directory of smaller JUnit files, the helper is extracted, and the spec pins the
exact line, the one-decimal MB unit and the two-number difference. The docs list
gains `docs/PRODUCT.md` and `GLOSSARY.md` (D20). No implementation task is
marked done.

## Gate record

- PIR/DXR:
- Focused tests:
- `npm run hygiene`:
- `npm run check`:
- `npm run test:e2e`:
- Scan/fixture runtime:
- Review round:
