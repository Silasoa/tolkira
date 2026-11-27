# Tasks

## 1. Contract and review

- [x] 1.1 Finish the contract: proposal, design, this file, both deltas.
- [x] 1.2 Run PIR and DXR in parallel; fold blockers.
- [x] 1.3 Record the baseline: the failing CI jobs, the measured `.expand`
  layout (block at x=32, 268.03 px in a 241 px toolbar, document 320 px,
  scroll 305 px), the two unquoted commands, and the 21 unique failing e2e
  tests (63 = 21 times 3 engines), each rendering a scripted report with the
  toolbar; the `visual-evidence` static capture is proven by the next CI run.
  B-075 commits first; this change re-pins on top of its notice bytes.

## 2. TDD Red

- [x] 2.1 In `test/workflow-config.test.ts` (it reads both `ci.yml` and
  `release.yml`), forbid the bare absolute path word
  `/(?:^|\s)\/tmp\/pack\/tolkira-\$TOLKIRA_VERSION\.tgz(?=\s|$)/`; quote-aware,
  so the digest, verify and stage lookalikes pass. Update the exact install
  command in `test/release-workflow.test.ts` to the quoted form. Add an
  assertion that the `workflows` job block contains `shellcheck --version`
  before the actionlint invocation (`test/workflow-config.test.ts`).
- [x] 2.2 Add to the e2e `failed-only` or a shell test: at 320 px / 200 %,
  `.expand` stays inside the toolbar (`left`/`right` against the toolbar box,
  ±1 px) and the page does not overflow; at 1440 px, both buttons share a top
  edge (±1 px) and the last ends at the toolbar's right edge (±1 px).
- [x] 2.3 Run the focused files; record the red state. Precondition: B-075 is
  committed, so the goldens/hashes already include the notice. Red: 3 vitest
  failures (two bare-path guards, one shellcheck-order guard) and the new
  chromium toolbar test failed on the unwrapped block.

## 3. Implementation

- [x] 3.1 `.expand { flex-wrap: wrap; justify-content: flex-end; }` in
  `src/render/report.css`; regenerate `styles.ts`.
- [x] 3.2 Quote the absolute tarball path in `.github/workflows/ci.yml` and the
  release `package` job. Add `shellcheck --version` before actionlint in the
  CI `workflows` job. Add one line to `CONTRIBUTING.md` that the local Windows
  actionlint has no shellcheck and CI is the proof.
- [x] 3.3 Re-pin the goldens and characterization hashes for the CSS bytes
  only; record the measured `.expand`, toolbar and document widths at
  320/200 % and 1440 px. Correct the archived B-074 and B-057 gate records
  with a dated note about the local-actionlint and local-e2e gaps.
  Measured Windows Chromium, `empty-statuses.ndjson`, 200 % text at 320 px:
  document 320 / scroll 305, toolbar 32 → 273 (241 px), `.expand` 32 → 273
  (241 px, was 268.03), both buttons 241 px wide, stacked. At 1440 px:
  toolbar 116.5 → 1308.5 (1192 px), `.expand` 799.69 → 1308.5 (508.81 px),
  both buttons share top 623.03, last right 1308.5. Differential: every
  pinned report differs only by the 40 CSS bytes and the derived
  "Report HTML" size (+40).

## 4. Verification and gate

- [ ] 4.1 `npm run check`, `npm run hygiene`, `npm run package:check`.
- [ ] 4.2 `npm run test:e2e` on Chromium, Firefox and WebKit.
- [ ] 4.3 Targeted host row 2: cucumber-js legacy and Messages at 320 px /
  200 %, 390 px and 1440 px; record the artifacts and results. One row covers
  both artifacts because the change is shell CSS only.
- [ ] 4.4 Write `gate.md`; review with SCR, CR, UXR and DAR in parallel; fix
  findings with a delta re-check.
- [ ] 4.5 Push and verify the three CI jobs (`e2e`, `workflows`, `check`) are
  green on the pushed commit; that Linux run is the proof for the font-metric
  overflow and the shellcheck finding.
- [ ] 4.6 Archive and sync the specs; no version bump, tag, stage or publish.
