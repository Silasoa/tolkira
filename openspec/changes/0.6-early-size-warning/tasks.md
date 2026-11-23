# Tasks

## 1. Gate

- [x] 1.1 PIR + DXR over the proposal, spec delta and design; fold blockers
  into the contract before Red.
- [x] 1.2 Confirm the loader resolution seam, the current `--max-size` warning
  order and the 100 MB cap; no new option or dependency.
- [x] 1.3 Confirm the threshold (50 MiB) and the all-runs scope, including
  summary-only, with the user.

## 2. TDD-Red

- [x] 2.1 Scan unit: explicit files and a directory sum; a repeated path counts
  once; a stat-only call attempts no content read; a sparse 50 MiB file reports
  its size without a read; a resolved directory is rejected before reading; a
  missing input leaves the loader to report the error. The scan unit tests
  landed in the implementation commit `a08a6c4`, not in the Red commit
  `0216742`.
- [x] 2.2 CLI boundary: a temp directory of smaller valid JUnit files totalling
  50 MiB warns and exits 0; 50 MiB minus one byte does not warn; the exact line
  and one-decimal MB unit are pinned; a `--json` run keeps stdout JSON-only.
- [x] 2.3 Ordering: a malformed 50 MiB sparse file warns before the parse error
  and exits 1 with no partial output.
- [x] 2.4 Purity: `--json` keeps stdout JSON-only; `--ci` keeps its text; a
  usage error emits no warning.
- [x] 2.5 Limits: above 100 MB still exits 1 with the cap message; a large
  report still emits the existing report-size warning and both lines can appear
  with different totals.
- [x] 2.6 Confirm RED; no coverage is deleted or weakened. The separate `--json`
  test was folded into the first boundary test (see the review findings below),
  keeping its assertions.

## 3. Implement

- [x] 3.1 Extract the input file resolution used by `loadInputs` and the
  one-decimal MB helper used by the report-size warning; add the stat-only scan
  and the 50 MiB constant.
- [x] 3.2 Resolve the input list once, pass it to the scan and the loader, call
  the scan after validation and before generation, write the one stderr line and
  ignore scan failures so the loader reports the real error.
- [x] 3.3 Document the threshold, the exact line and unit, the advisory nature,
  the no-path rule, the two-number difference from the report-size warning, the
  architecture seam and the unchanged cap; record the duplicate overcount limit.

## 4. Verification and review

- [x] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e` if any browser
  fixture changes (expected: none).
- [x] 4.2 SCR, CR, DAR and STR; PCA if the scan touches the loader hot path.
- [x] 4.3 Record the test runtime for the 50 MiB fixtures and the scan cost.
- [x] 4.4 Fix findings; record deferred decisions with a trigger.

Review findings (2026-11-23): PIR/DXR found the scan resolved the file list a
second time (D16/I10), the 50 MiB JUnit `system-out` fixture was too heavy
(D17/I11), the MB helper was a local closure in `runCli` (I12), and the early
total can differ from the report-size warning's `input` value (I20). The design
now resolves the list once and shares it with the loader, the fixture is a temp
directory of smaller JUnit files, the helper is extracted, and the spec pins the
exact line, the one-decimal MB unit and the two-number difference. The docs list
gains `docs/PRODUCT.md` and `GLOSSARY.md` (D20). Implementation followed in
`0216742` (Red) and `a08a6c4` (implementation).

Blind review round (2026-11-23) over `0216742` and `a08a6c4`, and dispositions:

- CR/SEC IMPORTANT — public API widened to a resolved union: fixed. `InputSource`
  is `string | string[]` again, `isResolvedInputs` is deleted, and the resolved
  entry points live in the internal `src/run.ts` plus internal resolved variants
  in `src/input/load.ts` and `src/summary.ts`. `dist/index.d.ts` names no
  `InputSource`, `ResolvedInputs` or `ResolvedInputFile`.
- SEC IMPORTANT — TOCTOU between resolution and read: fixed. The resolved
  loader re-checks `stat().isFile()` and rejects anything else with
  `Unsupported input: <path>` before `readFile`; a resolved directory test pins
  it.
- CR/STR minor — scan return shape: fixed. `scanInputBytes` returns `{ bytes }`
  only; no count.
- CR/SCR minor — false `INPUT_WARN_BYTES` comment: fixed. The literal stays
  because `test/attachment.test.ts` allows the multiplication form only in
  `attachment.ts`; the comment now states that reason. The "50 MB" label is
  derived from the constant.
- CR minor — warning helper contract: fixed. `earlyInputWarning` returns body
  copy only; the CLI adds `tolkira: warning: ` and the newline. The CLI tests
  pin the emitted bytes unchanged.
- CR minor — scan `try` scope: fixed. The inner `try` wraps `scanInputBytes`
  only; the stderr write sits outside it, and the comment names a stat error.
- SCR BLOCKER / CR/STR IMPORTANT — missing resolved-list identity pin: fixed.
  A CLI test mocks the load module and asserts `resolveInputFiles` ran once and
  that the scan and the resolved loader received the same files array by
  identity. The stale "no public seam" comment is gone.
- SCR/STR minor — history bytes not compared: fixed. The byte-identity run now
  passes `--history` and compares the sidecar under the frozen clock.
- SCR minor — stat-only proof too weak: fixed. A sparse 50 MiB file reports its
  size with no `readFile` call.
- SCR minor — duplicated `--json` fixture: fixed. The JSON-only assertions are
  folded into the first boundary test.
- Test independence — two 50 MiB preambles in the usage-error and missing-input
  tests: recorded, deliberately kept; each test proves its own fixture is large.
- Canonicalization coverage: fixed. A Windows-safe junction/symlink dedupe test
  counts a directory and its target once.
- Fixture duplication: fixed where it fits. The identity test copies the shared
  `legacyFixture('happy.json')`; byte-exact 50 MiB fixtures stay generated
  because a static fixture cannot carry the required sizes.
- DAR — contract and doc drift: fixed. The design sketch returns `{ bytes }`,
  the stale line number and baseline mention are gone, and the proposal Impact
  lists `README.md`, `src/index.ts`, `src/summary.ts` and `src/run.ts`.
- DAR — usage-error scope: fixed in the spec text only. Invalid options and
  rejected paths exit 2; a missing input stays the loader's ENOENT exit 1.
- DAR — dates, CI note, glossary and changelog: fixed. `docs/LIMITATIONS.md` and
  `README.md` are dated 2026-11-23; `docs/CI.md` states the warning appears on
  `--json`/`--ci`-only runs; the glossary counts each resolved path once and
  identical content under two paths twice; the changelog has an Unreleased
  `Added` bullet.
- STR — file and describe names: fixed. The tests are
  `test/cli-size-warning.test.ts` and `test/input-resolve-scan.test.ts`, with
  describes aligned to "Early input warning".

Decisions recorded by this round:

- Public API stays path-based; the resolved list is an internal CLI seam.
- Scan returns `{ bytes }` only.
- A partial scan failure stays silent; the loader re-stats and reports the real
  error.
- The two 50 MiB preambles stay for test independence.
- Host rows: loader seam only; no adapter or report-shell change;
  `docs/DROP-IN-VALIDATION.md` host rows are not required.
- Changelog: one Unreleased `Added` bullet in `docs/CHANGELOG.md`; no version
  bump in this change.

## Gate record

- PIR/DXR: folded into the contract on 2026-11-23 (see the review findings
  above); implementation followed in `0216742` and `a08a6c4`.
- Final commits: `a2a6305`, `a316276`, `4f82510`.
- Focused tests: `npx vitest run test/cli-size-warning.test.ts
  test/input-resolve-scan.test.ts` 25/25 passed (13 + 12) in 2.8 s on
  2026-11-23.
- `npm run hygiene`: passed, 788 tracked files and 328 commits.
- `npm run check`: `npm run i18n:check` (24/24), `npm run assets`,
  `npm run typecheck`, `npm run lint`, `npm run build` and `npx vitest run`
  (80 files, 1255 passed, 5 skipped) passed on 2026-11-23.
- `npm run test:e2e`: not run; no report-rendering or browser fixture changed.
- Scan/fixture runtime: the 25 focused tests over generated 50 MiB fixtures ran
  in 2.8 s (Windows, local run). The scan is one `stat` per resolved file and
  reads no content; the sparse stat test does not write 50 MiB.
- Review round: complete (4.2/4.4); every finding above is fixed or recorded.
