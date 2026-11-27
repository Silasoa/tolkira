# Tasks

## 1. Contract and review

- [ ] 1.1 Finish the contract: proposal, design, this file, the
  `report-rendering` and `release` deltas.
- [ ] 1.2 Run PIR and DXR in parallel; fold blockers.
- [ ] 1.3 Record the baseline: scripted report 95,687 B / SHA-256
  `da396575…` and static report 76,017 B / SHA-256 `a9fdb994…` for
  `legacy/failed.json` with `--title "License size"`; installed
  `@cucumber/tag-expressions` 11.2.0, LICENSE 1,086 B, SHA-256
  `c4b0a6e7…`, LF and a trailing `SOFTWARE.\n`.

## 2. TDD Red

- [ ] 2.1 Add `test/third-party-notice.test.ts`: scripted report contains the
  sentinel once, inside `<body>`, after the last `</script>`; the extracted
  block equals the exported constant; the block has the component line with
  the installed version, the copyright, the permission text and the final
  `SOFTWARE.`; it contains no `--`, `<!--`, `-->`, `<` or `>`; the static
  report has no sentinel and its SHA-256 equals the pinned pre-change
  `a9fdb994…`; the German locale block is identical; the drift guard resolves
  the installed package, cross-checks `package-lock.json` and asserts both
  project copies.
- [ ] 2.2 Extend `test/package-manifest.test.ts`: add the notice to both local
  mirrors (`rootFiles`, the fixture `packageJson.files`), assert the real
  `package.json` lists it, and assert `verifyPackList` rejects both npm shapes
  without it.
- [ ] 2.3 Run the focused files and record the red state.

## 3. Implementation

- [ ] 3.1 Add `THIRD-PARTY-NOTICES.md`, the render constant and the comment in
  `html.ts` for scripted reports only. Add `third-party-notice` to the
  `foundation` set in `test/render-modules.test.ts` and raise the `html.ts`
  shell cap from `< 100` to `< 101` with a comment naming the notice import as
  the extra line.
- [ ] 3.2 Add the file to `package.json` `files` and the package check.
- [ ] 3.3 Re-pin the goldens and characterization hashes for the intended
  comment; prove that stripping the notice block from one scripted report and
  restoring the previous "Report HTML" size label reproduces its previous
  hash, and that the static report hash did not move.
- [ ] 3.4 Record the measured scripted and static report delta and the tarball
  entry count (expected 93). Update `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`,
  `docs/CHANGELOG.md` (Unreleased) and the B-075 backlog row.

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
