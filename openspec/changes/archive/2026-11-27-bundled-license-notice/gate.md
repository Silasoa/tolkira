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

Two commits on `main`, not pushed at the time of this record:

| Commit | Subject |
| --- | --- |
| `3a8f81c` | `feat(report): ship the bundled MIT notice (B-075)` |
| `83b3e56` | `docs(report): close the notice review findings (B-075)` |

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
- `npm run package:check`: **94 entries**, **706,997 B**, SHA-256
  `61D964DA…5779AD`. The extra entry over the expected 93 is
  `dist/render/third-party-notice.d.ts`, emitted by the declaration build and
  packed by `files: ["dist"]`; the module layout is required, so the file is
  kept and recorded.

### Host rows

Host row 2 on the final package (`706,997 B`, 94 entries, SHA-256
`61D964DA…5779AD`, HEAD `83b3e56`, clean install, CLI `0.6.1`): cucumber-js
13.3.0 legacy JSON and Messages NDJSON, Chromium, print emulated. **PASS**.

| Input | Artifact | Default | Static | Notice (scripted/static) |
| --- | ---: | ---: | ---: | --- |
| legacy `out.json` | 3,302 B | 79,278 B (+1,206) | 58,378 B (+0) | 1 / 0 |
| Messages `out.ndjson` | 9,974 B | 79,596 B (+1,206) | 58,696 B (+0) | 1 / 0 |

The scripted report has exactly one notice comment after the last `</script>`
and directly before `</body>`; stripping it reproduces the earlier row-2 HTML
byte-for-byte, and the static HTML hash is unchanged. The installed
`THIRD-PARTY-NOTICES.md` equals the repo file. Summaries 2,191 B and identical,
the row link 83.23 × 28 px at 1440/390 and 164.47 × 56 px at 320/200 % with
0 px² status overlap, print and static forms green, zero console/page/http
errors.

## 4. Reviews

SCR **PASS**, CR **PASS**, legal **PASS**, DAR **FAIL** on docs only. The
findings were the 93→94 tarball wording, "visible markup", the exact
1,206-byte figure (1,207 across a digit boundary), the `ARCHITECTURE` wording,
the host-row record and the module-test comment. `83b3e56` fixes all of them,
adds the exact "only whitespace before `</body>`" assertion and the manifest
`license` field, and adds the MODIFIED skipped-attachment requirement so the
"Clean report" byte sentence names the notice comment. No behaviour or byte
changed; the two test tightenings pass.

## 5. Exceptions

None. No tag, stage or publish happened. Host row 2 is recorded in §3.
