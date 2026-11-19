# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, spec delta and design; fix
  blockers before code. PIR and DXR PASS after two fix rounds on 2026-11-19.
- [x] 1.2 Link the change to #8 and B-005.
- [x] 1.3 Confirm no TDD-Red is needed: no behaviour changes; the static
  assertion inventory, characterization hashes, golden files and test-title
  parity are the safety net. The inventory check is the natural guard.

## 2. Baseline

- [x] 2.1 Record the collected unit baseline: 38 files, 659 tests, and the
  static `expect(` inventory of `test/render.test.ts` (485). Record the
  per-platform split for the conditional skips: Windows 657 passed / 2 skipped
  (`playwright.test.ts` ×2 win32), Linux 658 passed / 1 skipped
  (`cli-ci.test.ts` ×1 linux), macOS 659 passed / 0 skipped. The parity rule is
  the collected total, the full sorted title multiset (describe chain included)
  and the assertion inventory, never the pass/skip split.
- [x] 2.2 Record the browser baseline: 91 definitions × 3 projects = 273 runs
  in 6 files at 83.9 s; the static `expect(` inventory (466); `npx playwright
  test --list` normalized to 91 project-excluded definition titles and 273
  per-project entries; OS, core count, Playwright workers (6), `node -v`,
  Playwright/Vitest versions, exact command, and the per-test duration sum from
  `npx playwright test --reporter=json --outputFile=<file>`.
- [x] 2.3 Run `render-characterization` and `render-golden` on the clean
  baseline; record the eight hashes and two golden files. Record
  `git ls-files --eol test/render-characterization.test.ts test/fixtures/render-golden/*.html`
  and `core.autocrlf`; require `i/lf w/lf`. A CRLF mismatch is diagnosed, never
  re-recorded.

## 3. Unit split

- [x] 3.1 Add `test/render-helpers.ts` and move the shared setup and HTML
  helpers; use `test/fixtures.ts` for paths.
- [x] 3.2 Move `messages rendering` to `test/render-report.test.ts`.
- [x] 3.3 Move `scenario outlines` and `hooks rendering` to their own files.
- [x] 3.4 Move `triage overview`, `feature overview and matrix`,
  `parity diagnostics rendering` and `default open state` to their own files.
- [x] 3.5 Move `source strip`, `parity rules rendering` and
  `empty-run rendering` to their own files; remove `test/render.test.ts`.
- [x] 3.6 Confirm every unit file is below 800 lines and every original test
  title appears once. If a file exceeds 800 lines, record its single flow and
  why in this task. Largest new file: `render-rules.test.ts`, 389 lines; no
  exception.

## 4. Browser split

- [x] 4.1 Add `test/e2e/helpers.ts` (`writeReport`, `removeReport`,
  `reportUrl`, `stubClipboard`, `stubClipboardFailure`, `readClipboard`) and
  `test/ansi-payload.ts`; set Playwright `testMatch` to `**/*.spec.ts`; move
  `test/ansi-stripping.test.ts` to the shared payload. Record the ANSI
  literal change: the visible sample becomes `c1-csi` instead of `c1-red`;
  both tests keep the forbidden-family checks (ESC, `]52;`, `]8;;`, DCS, APC,
  charset, C1 OSC/DCS/CSI, C0/C1 control range). The failing clipboard stub
  keeps `document.execCommand`.
- [x] 4.2 Move the core report, search/filter, triage and attachment tests;
  every standard report uses `writeReport`/`removeReport`.
- [x] 4.3 Move the clipboard, hooks, outlines and diagnostics tests; every
  standard report uses `writeReport`/`removeReport` (the diagnostic markup test
  calls it twice).
- [x] 4.4 Move the rules, empty-run, keyboard, no-JS and performance tests;
  move the 200 % zoom test into `responsive.spec.ts`; every standard report
  uses `writeReport`/`removeReport`. Move the `without scripting` wrapper and
  its `test.use({ javaScriptEnabled: false })` with the four tests; grep
  `no-js.spec.ts` for the `test.use` line and `performance.spec.ts` for
  `test.slow()`. Leave the no-JS block in `parity-metadata.spec.ts` untouched.
- [x] 4.5 Point `search-state.spec.ts`, `failed-only.spec.ts` and
  `parity-metadata.spec.ts` at the shared `writeReport` helper; in
  `parity-metadata.spec.ts`, replace the local `navigator.clipboard` init
  script with `stubClipboard(page)` and read the copied text with
  `readClipboard(page)`. Confirm every browser file is below 800 lines and
  every original test title appears exactly once in the sorted multiset.
  Record any >800-line exception with its single flow.

## 5. Docs

- [x] 5.1 Add a `Changed` entry to `docs/CHANGELOG.md` describing the suite
  split and helper consolidation.
- [x] 5.2 If a review finding is deferred, record the reason and trigger in
  `docs/BACKLOG.md`; keep shared-doc edits to the B-005 entry. Do not close #8
  or archive the change.
- [x] 5.3 Mark the Test split item in `docs/architecture/rewrite-list.md` as
  done in #8, with the change reference; it is the item's own status line.

## 6. Verification and review

- [x] 6.1 Run `npm run hygiene`.
- [x] 6.2 Run `npm run check`; record the collected unit total (expect 47
  files / 659 tests), the sorted title multiset and the `expect(` inventory
  (485 unit; 417 split browser specs + 1 in `writeReport` = 418). Compare with
  the baseline; ignore the platform-specific pass/skip split. Confirm zero diff
  in `test/render-characterization.test.ts` and both golden files.
- [x] 6.3 Run `npm run test:e2e`; record the collected browser total (expect
  273 runs), compare the 91 project-excluded definition titles and the 273
  per-project entries, and compare wall clock plus the per-test duration sum on
  the same machine. A >20 % increase is investigated; the in-test performance
  budgets are the hard guard.
- [ ] 6.4 Run the review swarm: SCR, CR, DAR, STR and PCA. SEC, UXR and CMP
  are not triggered. The CR brief must name the security/parity assertions
  that stay byte-identical: CSP meta, no external scripts/styles, XSS escaping,
  remote-logo rejection, malicious attachment name, HTML-attachment inertness
  and no-external-request checks.
- [ ] 6.5 Fix findings, re-run the gate, and commit on the worktree branch with
  #8 and the change reference. Do not merge, close, tag, stage, publish or
  archive.

## Baseline record

2026-11-19, branch `openchamber/split-test-suites`, LF checkout
(`core.autocrlf=false`, `i/lf w/lf`):

- Unit: 38 files, 659 collected, 485 static `expect(` in `test/render.test.ts`.
  Windows 657 passed / 2 skipped; Linux 658 / 1; macOS 659 / 0. Conditional
  skips: `playwright.test.ts` ×2 (win32), `cli-ci.test.ts` ×1 (linux).
  Runtime 4.4 s.
- Browser: 6 spec files, 91 definitions × 3 projects = 273 runs, 466 static
  `expect(` in `report.spec.ts`. JSON-reporter baseline: 79.7 s wall clock,
  409.6 s per-test duration sum; the list run was 83.9 s. Machine: Windows,
  12 logical CPUs / 6 cores, 6 workers (Playwright default 50 %), 3 browsers,
  Playwright 1.65.0, Node v26.13.1, Vitest 5.1.0; exact commands
  `npm run test:e2e` and `npx playwright test --reporter=json`.
- Characterization: eight SHA-256 values and two golden files unchanged.

## Gate record

2026-11-19 implementation:

- Unit split: 47 files, 659 collected, 485 `expect(` preserved; 92 original
  render tests with exact title parity.
- Browser split: 273 runs in 18 files, 70.0 s final `npm run test:e2e`; earlier
  JSON run 82.4 s / 410.9 s per-test sum against the 79.7 s / 409.6 s baseline
  (+0.3 % sum). Exact 91-definition and 273 per-project title parity.
- Assertion inventory: 417 split browser specs + 1 `writeReport` = 418, after
  49 inline setup checks collapsed into the helper. ANSI value changed in
  place. No matcher loosened.
- `npm run hygiene` ok; `npm run check` 47 files / 657 passed / 2 skipped
  (659); characterization hashes and both golden files unchanged.
- Review swarm: pending.
- Commit and push: pending.
