# Tasks

## 1. Spec gate

- [x] 1.1 Run PIR and DXR over proposal, spec and design; fix blockers.
  PIR and DXR PASS on 2026-11-19 after the blocker fixes.
- [x] 1.2 Link the change to #17 and B-014; confirm the change directory is the
  contract.

## 2. TDD-Red

- [x] 2.1 Add `test/bench-ansi.test.ts`: spawn `process.execPath` with
  `scripts/bench-ansi.mjs --quick` and require exit 0 plus a JSON document with
  `messages`, `bytes`, `medianMs`, `MiB/s`, `fastPathRatio`, `slicingRatio`,
  `budgetMs` and `decision`; require `decision` to be consistent with the
  printed ratio and floor. Set an explicit test timeout.
- [x] 2.2 Add the failure cases: `--quick --budget-ms 0` exits 1 and the error
  names the budget and measured time; `--quick --ratio-floor 1000` exits 0 with
  `decision: "review"`; an unknown argument exits 2 with usage. The test fails
  before the script exists.
- [x] 2.3 Cover output equivalence inside the script: control-only messages
  (excluding CR), an unterminated OSC/APC tail and a corpus boundary message
  must produce the same output from production and both references.
- [x] 2.4 Confirm the new test fails for the missing benchmark command, not for
  an unrelated import or type error.

## 3. Implement

- [x] 3.1 Add `scripts/bench-ansi.mjs`: deterministic corpora, production
  source loaded through esbuild (`bundle`, `write: false`, ESM, Node 22, silent)
  from a base64 `data:` URL, warm-up, median, JSON output, budget check,
  `keep`/`review` decision, `--quick`, `--budget-ms`, `--ratio-floor` and usage
  errors.
- [x] 3.2 Add `npm run bench:ansi`, run the full benchmark and record the final
  numbers in `design.md`.
- [x] 3.3 Keep `src/text.ts` behaviour unchanged; add the measured fast-path
  comment. If the final ratio is below 1.5x, report `review` to the coordinator
  and do not remove the fast path in this change.
- [x] 3.4 Add the benchmark step to the Node 22 Linux CI `check` job after the
  stress run, guarded by `if: matrix.node == 22`.

## 4. Docs

- [x] 4.1 Add the method, budget, reference host/numbers and failure policy to
  `docs/ARCHITECTURE.md` Performance.
- [x] 4.2 Add `npm run bench:ansi` to `README.md` Development and
  `CONTRIBUTING.md` Local checks.
- [x] 4.3 Add one `docs/CHANGELOG.md` Unreleased entry for the benchmark
  command and budget. Do not touch other entries.
- [x] 4.4 Confirm B-018 is recorded for the pre-existing CR-only fast-path
  divergence with a trigger; do not change CR behaviour in this change.

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`; run
  `npm run bench:ansi` twice and confirm the budget passes and the decision is
  stable.
- [x] 5.2 Review swarm: SCR, CR, DAR, STR, PCA and SEC. Record why UXR and CMP
  are not triggered.
- [x] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md` with a
  trigger.
- [x] 5.4 Commit and push with #17 and the change reference.

## Gate record

2026-11-19, Node 26.13.1 / Windows reference host, after the fixer pass and the
measurement-order fix. All production passes are measured before the
character-append allocations.

- `npx vitest run test/bench-ansi.test.ts`: 13/13 pass.
- `npm run bench:ansi` full, final run 1: combined production median 39.526 ms;
  clean fast-path ratio 7.039x; escaped slicing ratio 0.845x; `keep`;
  `outputIdentical: true`.
- `npm run bench:ansi` full, final run 2 (the coherent run recorded in
  `design.md` and `docs/ARCHITECTURE.md`): combined 27.709 ms; fast-path ratio
  9.591x; slicing ratio 1.075x; `keep`; `outputIdentical: true`. Clean
  3.201 ms + escaped 22.306 ms = 25.507 ms <= 27.709 ms combined.
- `npm run bench:ansi` full, final run 3: combined 76.042 ms; fast-path ratio
  7.664x; slicing ratio 0.646x; `keep`; `outputIdentical: true`.
- Host-load range across all full runs: combined 23.4-78.9 ms, fast-path
  4.2-9.6x (one noisier run), slicing 0.65-1.21x (one noisier 3.47x run);
  every run stayed below the budget with `outputIdentical: true`. The full-mode
  coherence guard passed in every full run.
- Full-mode coherence-guard verification: combined 23.362 ms; fast-path ratio
  8.152x; slicing ratio 0.975x; `keep`; `outputIdentical: true`. The recorded
  coherent run above stays the published table.
- `npm run hygiene`: ok (469 tracked files, 220 commits).
- `npm run check`: green; 39 test files, 670 passed, 2 skipped.
- `npm run test:e2e`: 273 passed (Chromium, Firefox, WebKit).
- `npm run bench:ansi -- --quick`: exit 0, decision `keep`; the quick command
  shape is pinned by 13 unit tests.
- Review swarm: SCR, CR, DAR, STR, PCA and SEC. DAR and PCA blockers were fixed
  and re-checked; no open blocker. UXR and CMP not triggered: no report shell,
  markup or user-facing report change.
- Deferred: `docs/BACKLOG.md` "ANSI benchmark follow-ups"; B-018 records the
  pre-existing CR-only divergence.
