# One-time equivalence gate — task 4.6

Run on the final implementation on 2026-11-26, after all 3.x steps, and re-run
after the review-fix commit `88b9f74`.

| Item | Value |
| --- | --- |
| Final code | `88b9f74` (review fix); `02088a7` was the first gate run |
| Gate file source | `c329643` (`test/cli-equivalence-gate.test.ts`, restored byte-exact with `git show c329643:test/...` for this run, then removed again) |
| Gate file history | added `c329643`; formatted `02088a7`; removed `79505c8`; not committed by the re-run |
| OS / arch | `win32` / `x64` |
| Node | `v26.13.1` |
| playwright-core | `1.65.1` |
| Chromium (headless shell) | `159.0.8154.6` (revision 1255), as in `baseline.md` |
| Frozen clock | `2026-11-26T12:00:00.000Z` |

## Commands and results

| Task | Command | Result |
| --- | --- | --- |
| 4.1 | `npx vitest run` over the 12 pre-existing CLI suites (including `cli.test.ts`, which does not match `cli-*`), the five new files, `capabilities` and `inputs` at `88b9f74`; re-measured at `7d0579e` | 19 files, 495 passed, 4 skipped |
| 4.6 | `npx vitest run test/cli-equivalence-gate.test.ts` at `88b9f74` | **17 passed** (15 non-★ rows + 2 baseline comparisons) |
| 4.2 | `npm run check` | green; 103 files, 2089 passed, 11 skipped; coverage 95.07 % stmts, 88.32 % branch, 97.04 % funcs, 96.47 % lines |
| 4.3 | `npm run test:e2e` | 478 passed, 8 skipped (1.9 min); no browser change |
| 4.4 | `npm run package:check` | green: publint `All good!`, attw all green except the ignored `node10` entries; tarball **91 entries** |

The eight ★ rows are the permanent `test/cli-equivalence.test.ts` cases
(11, 12, 13, 15, 17, 21, 22, 23); they are green in the 4.1 run and are not
duplicated in the gate. The permanent built-CLI spawn in the same file now
pins the exact 2044/6/1318/2044 bytes, their SHA-256 values and exit
0/0/0/2 from this record, so a `USAGE` edit can no longer stay green.

## 4.4 process probes (real `node dist/cli.js`)

Built at `88b9f74`; bytes and hashes reproduced on the re-run.

| Probe | Stream | Bytes | SHA-256 | Exit |
| --- | --- | ---: | --- | ---: |
| `--help` | stdout | 2044 | `0debb225b3d6e9b98bd966671925f55cd9f574eba65bd35a4b92ef75c6ee4574` | 0 |
| `--version` | stdout | 6 | `87b241b275c591694846560e9879f50c9da3150f854efdabd782c539772f3033` | 0 |
| `--capabilities` | stdout | 1318 | `013d180c59d64916fffdd92643fafae8ff5e478b2e6bb2b599b9d1fc41df647c` | 0 |
| no args | stderr | 2044 | `0debb225b3d6e9b98bd966671925f55cd9f574eba65bd35a4b92ef75c6ee4574` | 2 |

These match `baseline.md` byte for byte.

## 1.1 baseline comparison

The gate reproduced the exact 1.1 generate, summary and `--json` argv with the
frozen clock and `--locale en` at `88b9f74`:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `generate/report.html` | 98930 | `35f601978e270c87f8df113728d3b7e73c3a4b8dfe916f8c92bafc355e61180c` |
| `generate/email.html` | 4951 | `6d01fc31b2dcdf782542db4c31bc5d7da4ca3058858aa0d6bf8ebcb2fab620aa` |
| `generate/history.json` | 2450 | `7cf2d838d03dddf7b8408f65d78b820e641234b15fc4b0c5e29ee2201d4f0fb5` |
| `generate/summary.md` | 480 | `640af92da29ec892697d3eb3326ac54abfd17e14e37719b19d76a4e821ea3524` |
| `generate/manifest.json` | 1118 | `1ae0d2fc438e7733dda23676566da6c277d7a7f2c8512e5e5db9b493b0ff7ce3` |
| `summary/email.html` | 4922 | `9e98e79d669257e68e201b00a00c4a17ea7ea106a1532a2d235c2cfd6173aca1` |
| `summary/summary.md` | 480 | `640af92da29ec892697d3eb3326ac54abfd17e14e37719b19d76a4e821ea3524` |
| `summary/manifest.json` | 925 | `43cc61c9683bd20f360bf7f73d88815b56325fe9557a482ababb6c1dd5333a69` |
| `json/b.json` | 1519 | `09c4be0d7b20f5f9981521956e94d3b7cffc7a932856850090d49c3cce9b2da8` |

Every non-PDF artifact matches `baseline.md` exactly (bytes and SHA-256). The
1.1 hashes therefore stay as recorded.

PDF: raw size **145116 bytes** (same as the 1.1 record). The engine's
`/CreationDate` and `/ModDate` were normalized to `D:FIXED`; no `/ID` field is
present in this engine output. Normalized size **145084 bytes**, SHA-256
`544c1fec6c5df287b1d9d134413dc86ab4689a8e12084fb4f99b6120e553e5dd`. The
normalization method and hash still reproduce, so both stay unchanged. The same
normalization on a pre-split capture of `1ee837e` under the same frozen clock
gives the same normalized hash, so the page and content bytes are equal.

## Line counts

At `88b9f74`:

| File | Lines |
| --- | ---: |
| `src/cli.ts` | 93 (baseline 993) |
| `src/cli/args.ts` | 103 |
| `src/cli/execute.ts` | 336 |
| `src/cli/logo.ts` | 57 |
| `src/cli/paths.ts` | 60 |
| `src/cli/plan.ts` | 427 |
| **Total** | **1076** (+83, +8.4 % vs 993) |

No module other than `cli.ts` exceeds 430 lines. The 430-line cap in
`design.md` is a soft budget: `plan.ts` was fitted by compaction, not by a
sixth module. Splitting `planOptions` out of `plan.ts` is deferred and belongs
in the backlog (the docs fixer records it); reflowing the file or adding a
module is not part of this change.

## Bundle and package delta

Clean `npm run build` at `88b9f74`:

| File | Baseline (`1ee837e`) | Final (`88b9f74`) | Delta |
| --- | ---: | ---: | ---: |
| `dist/cli.js` | 412458 | 414825 | +2367 (+0.57 %) |
| `dist/cli.js.map` | 777140 | 784102 | +6962 (+0.90 %) |
| `dist/cli.d.ts` | 176 | 171 | −5 (only the `CliIO` re-export) |
| `dist/index.js` | 364414 | 364414 | 0 (SHA-256 `4fd2c61f…`) |
| `dist/index.d.ts` | 1616 | 1616 | 0 (SHA-256 `24f07109…`) |

Both bundle deltas stay under the 2 % PCA trigger, so PCA is not triggered.
New internal declarations at `88b9f74`: `dist/cli/args.d.ts` 1211 B,
`dist/cli/execute.d.ts` 221 B, `dist/cli/logo.d.ts` 65 B,
`dist/cli/paths.d.ts` 600 B, `dist/cli/plan.d.ts` 2408 B.

Tarball: 86 entries at `1ee837e` → **91 entries** (+5), exactly the five
`dist/cli/*.d.ts` declarations. `package:check` reports 91 entries; publint and
attw are green. The `npm run check` and `npm run package:check` rebuilds
reproduced the same five byte sizes above.

## Post-implementation review (2026-11-26)

The standard reviewer set ran on `79505c8`, the last implementation commit
before the fix:

| Reviewer | First round | Delta re-review |
| --- | --- | --- |
| SCR | FAIL (2 blockers) | PASS (`a41035b`) |
| CR | PASS (1 should-fix) | PASS |
| DAR | FAIL (1 blocker) | PASS (`a41035b`) |
| STR | PASS (5 should-fixes) | PASS |
| SEC | PASS (1 should-fix) | PASS |

- SCR-1: the built-CLI equivalence probe compared the spawned process with the
  in-process entry instead of pinning the baseline bytes, so a usage change
  could stay green. Fixed by pinning 2044/6/1318/2044 bytes, their SHA-256
  values and exit 0/0/0/2, with the in-process comparison kept as a second
  check.
- SCR-2 / DAR-1: the final bundle rows were stale (417397/789633) and did not
  reproduce; a clean build of the final code gives 414825/784102. Re-measured
  and recorded above.
- CR: `docs/ARCHITECTURE.md` claimed that `executePlan` follows `plan.writes`;
  the executed order is fixed and `plan.writes` mirrors it. Corrected, and the
  independent order pins replace the cross-check claim.
- STR: the 430-line `plan.ts` budget was met by compaction, not a seam, and
  `planOptions` had a fake async boundary. It is synchronous now (427 lines);
  the cap is a soft budget and the seam split is B-079. The duplicate
  out-collision case was removed (owner remains
  `test/cli-plan-paths.test.ts:936`), the Linux skip on the symlink case was
  dropped, and the bare `--max-size -1` case now runs through `planCli`.
- SEC: the logo 2 MB cap is checked before an unbounded `readFile`; unchanged
  from the pre-split code and recorded as B-078 with its trigger.

The fixes landed in `88b9f74`; the gate was re-run and recorded in
`b480ebd`/`b39ba99`; the documentation and record fixes in
`ed86d72`/`7d0579e`/`a41035b`. The delta re-reviews returned PASS from all
five reviewers; task 4.7 is closed.

`npm run check` on the final tree: 103 files, 2089 passed, 11 skipped;
coverage 95.07/88.32/97.04/96.47. `npm run test:e2e` (4.3) and
`npm run package:check` (4.4) ran on `88b9f74`; only documentation and a test
comment changed afterwards.

## Post-fix gate re-run

Run at `88b9f74` after the review fix, in this order:

| Command | Result |
| --- | --- |
| `npm run check` | green: i18n 24 tests, typecheck, lint, knip, format, build and coverage; 103 files, 2089 passed, 11 skipped; coverage 95.07 % stmts, 88.32 % branch, 97.04 % funcs, 96.47 % lines |
| `npm run test:e2e` | 478 passed, 8 skipped (1.9 min); Chromium, Firefox and WebKit |
| `npm run package:check` | green: publint `All good!`, attw all green except the ignored `node10` entries, tarball 91 entries |

All three gate commands are green; the post-implementation re-review is still
pending.

## Diff surface (task 4.5)

Two ranges make the exact union:

- Implementation range `1ee837e..88b9f74`:

```text
GLOSSARY.md
docs/ARCHITECTURE.md
openspec/changes/0.7-cli-plan-execute/gate.md
openspec/changes/0.7-cli-plan-execute/tasks.md
scripts/package-check.mjs
src/cli.ts
src/cli/args.ts
src/cli/execute.ts
src/cli/logo.ts
src/cli/paths.ts
src/cli/plan.ts
test/cli-equivalence.test.ts
test/cli-execute.test.ts
test/cli-plan-options.test.ts
test/cli-plan-paths.test.ts
test/cli-plan.test.ts
test/package-manifest.test.ts
```

- Contract range `8f4a493..1ee837e` adds the change contract
  `openspec/changes/0.7-cli-plan-execute/{proposal,design,baseline,tasks}.md`,
  `docs/BACKLOG.md` and the five TDD-Red test files (`test/cli-*.test.ts`).

Union `8f4a493..88b9f74`: the 17 files above plus
`docs/BACKLOG.md`, `proposal.md`, `design.md` and `baseline.md`. No renderer,
summary, email, PDF, history, baseline, input or output module changed.

The one-time gate file was a temporary test, not part of the shipped range:
`test/cli-equivalence-gate.test.ts` was added at `c329643`, edited at
`02088a7`, and removed at `79505c8`. This re-run restored the `c329643` bytes,
ran them and removed the file again; it is not tracked at `88b9f74`.

## Stop conditions

None hit. The review fix removed an unused async seam (`planOptions` is now
synchronous); that shrinks code and changes no observable byte, so it is not a
design stop condition.
