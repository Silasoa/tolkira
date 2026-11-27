# Gate — bundled license notice

## 1. Contract and pre-implementation review

- Contract: `proposal.md`, `design.md`, the `report-rendering` and `release`
  deltas, `tasks.md`; `openspec validate bundled-license-notice --strict` is
  green.
- PIR: **PASS** after two rounds. Round 1 blocked the size-label proof
  (`applyReportSize` includes the notice, so stripping the comment alone is not
  enough), the render-module set and the `html.ts` shell cap, and the main
  release spec's "no report byte" requirement. All were folded into the
  contract.
- DXR: **PASS** after two rounds. Blockers: the duplicated package requirement
  in both deltas, and the untestable "remaining bytes" static scenario. Fixed
  by keeping the package requirement in `release` only and pinning the static
  hash, the insertion point and the rendered-constant equality.
- Baseline (2026-11-27, `legacy/failed.json`, title `License size`): scripted
  report 95,687 B / SHA-256 `da396575…`; static report 76,017 B / SHA-256
  `a9fdb994…`; installed `@cucumber/tag-expressions` 11.2.0, LICENSE 1,086 B,
  LF, trailing `SOFTWARE.\n`.

## 2. Implementation

One commit on `main`, not pushed at the time of this record:

| Commit | Subject |
| --- | --- |
| `3a8f81c` | `feat(report): ship the bundled MIT notice (B-075)` |

`src/render/third-party-notice.ts` exports the notice as explicit `\n`-joined
lines. `src/render/html.ts` appends it as one comment after the last script
only when the client script is embedded. `THIRD-PARTY-NOTICES.md` ships in the
package, which also gains the notice file in `files` and in the package check.
No runtime dependency, public API, CLI option or version changed.

## 3. Verification

### Gates

- `npm run check`: 108 files, **2,184 passed / 11 skipped / 0 failed of
  2,195**; typecheck, lint, knip, format and build green. Coverage:
  statements 95.13 %, branches 88.51 %, functions 97.09 %, lines 96.52 %.
- Focused (notice, manifest, modules, goldens, characterization): 5 files,
  60 passed.
- `npm run hygiene`: 942 files, green.
- `npm run test:e2e`: **515 passed / 10 skipped** on Chromium, Firefox and
  WebKit.

### Report and package

- Scripted report **+1,206 B** (the fixed comment plus its size label); static
  report **+0 B**, hash still `a9fdb994…`.
- Differential: for all 10 scripted outputs, stripping the 1,206-byte block and
  restoring the previous "Report HTML" label reproduces the old hash exactly
  (e.g. `License size` 96,893 B / `c9da1b16…` → 95,687 B / `da396575…`).
- `npm run package:check`: **94 entries**, **707,997 B**, SHA-256
  `61d964da…`. The extra entry over the expected 93 is
  `dist/render/third-party-notice.d.ts`, emitted by the declaration build and
  packed by `files: ["dist"]`; the module layout is required, so the file is
  kept and recorded.

### Host rows

A comment-only change with a byte-identical static report and a differential
that reproduces every old scripted hash has no rendered effect. No host row is
required; the e2e matrix and the byte proofs cover the change. This is the
recorded reason for the exemption.

## 4. Reviews

SCR, CR and legal PASS; DAR FAIL on docs only, fixed in this commit.

## 5. Exceptions

None. No tag, stage or publish happened.
