# Tasks

## 1. Contract and review

- [x] 1.1 Finish the contract: proposal, design, this file, the
  `report-rendering` and `release` deltas.
  - Result: contract complete; no change to the deltas in this implementation.
- [x] 1.2 Run PIR and DXR in parallel; fold blockers.
  - Result: PIR/DXR run before implementation; blockers folded into the
    contract.
- [x] 1.3 Record the baseline: scripted report 95,687 B / SHA-256
  `da396575…` and static report 76,017 B / SHA-256 `a9fdb994…` for
  `legacy/failed.json` with `--title "License size"`; installed
  `@cucumber/tag-expressions` 11.2.0, LICENSE 1,086 B, SHA-256
  `c4b0a6e7…`, LF and a trailing `SOFTWARE.\n`.
  - Result: verified against the pre-change tree rendered in a detached
    worktree at `69d1095`: scripted 95,687 B / `da396575…`, static 76,017 B /
    `a9fdb994…`, installed LICENSE 1,086 B / `c4b0a6e7…` with 0 CRLF and a
    trailing `SOFTWARE.\n`.

## 2. TDD Red

- [x] 2.1 Add `test/third-party-notice.test.ts`: scripted report contains the
  sentinel once, inside `<body>`, after the last `</script>`; the extracted
  block equals the exported constant; the block has the component line with
  the installed version, the copyright, the permission text and the final
  `SOFTWARE.`; it contains no `--`, `<!--`, `-->`, `<` or `>`; the static
  report has no sentinel and its SHA-256 equals the pinned pre-change
  `a9fdb994…`; the German locale block is identical; the drift guard resolves
  the installed package, cross-checks `package-lock.json` and asserts both
  project copies.
  - Result: six tests red on the missing module; assertions unchanged by the
    implementation.
- [x] 2.2 Extend `test/package-manifest.test.ts`: add the notice to both local
  mirrors (`rootFiles`, the fixture `packageJson.files`), assert the real
  `package.json` lists it, and assert `verifyPackList` rejects both npm shapes
  without it.
  - Result: red on the missing manifest entry and package-check requirement.
- [x] 2.3 Run the focused files and record the red state.
  - Result: `third-party-notice`, `package-manifest` and `render-modules` red
    on the missing module, manifest entries and foundation set; the golden and
    characterization files also failed their pins by design.

## 3. Implementation

- [x] 3.1 Add `THIRD-PARTY-NOTICES.md`, the render constant and the comment in
  `html.ts` for scripted reports only. Add `third-party-notice` to the
  `foundation` set in `test/render-modules.test.ts` and raise the `html.ts`
  shell cap from `< 100` to `< 101` with a comment naming the notice import as
  the extra line.
  - Result: the constant is explicit `\n`-joined lines ending in
    `SOFTWARE.\n`; `html.ts` is 99 lines (100 `split('\n')` elements) with one
    new import and the comment folded into the existing body expression. The
    comment is `\n<!--\n…\n-->\n` after the print script, only when a client
    script exists, outside every `<script>`.
- [x] 3.2 Add the file to `package.json` `files` and the package check.
  - Result: `files` and `requiredRootFiles` list `THIRD-PARTY-NOTICES.md`; the
    fixture mirrors in `test/package-manifest.test.ts` match.
- [x] 3.3 Re-pin the goldens and characterization hashes for the intended
  comment; prove that stripping the notice block from one scripted report and
  restoring the previous "Report HTML" size label reproduces its previous
  hash, and that the static report hash did not move.
  - Result: both goldens and all ten scripted characterization pins re-pinned
    (nine fixtures plus the two-run Trends report). For each, removing the
    1,206-byte block and recomputing the size label reproduces the old hash,
    e.g. `legacy/failed.json` with `--title "License size"` is now 96,893 B /
    `c9da1b16…` and reverts to 95,687 B / `da396575…`; the characterization
    `legacy/failed.json` reverts to 95,699 B / `3a469f8f…`. The static report
    stays 76,017 B / `a9fdb994…`.
- [x] 3.4 Record the measured scripted and static report delta and the tarball
  entry count (expected 93). Update `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`,
  `docs/CHANGELOG.md` (Unreleased) and the B-075 backlog row.
  - Result: scripted report +1,206 B (fixed comment only), static +0 B.
    Tarball **94** entries (not 93) because the new
    `src/render/third-party-notice.ts` also emits
    `dist/render/third-party-notice.d.ts`, which `files: ["dist"]` packs:
    707,997 B / SHA-256 `61d964da…` for 0.6.1. Docs, changelog and backlog
    updated; B-075 moved to Resolved.

## 4. Verification and gate

- [ ] 4.1 Run `npm run check` and `npm run hygiene`.
- [ ] 4.2 Run `npm run test:e2e` on the three engines (report-level change).
- [ ] 4.3 Run `npm run package:check`; record the new tarball size, entries and
  SHA-256.
- [ ] 4.4 Host rows: a comment-only change has no rendered effect; record the
  evidence for the exemption, or run row 2 if the gate owner wants it.
- [ ] 4.5 Write `gate.md`; review with SCR, CR, DAR and SEC in parallel, fix
  findings with a delta re-check.
- [ ] 4.6 Commit and push; do not archive, bump, tag or publish.
