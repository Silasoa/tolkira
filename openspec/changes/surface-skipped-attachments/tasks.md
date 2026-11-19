# Tasks

## 1. Spec gate

- [x] 1.1 Run PIR and DXR over proposal, spec and design; fix blockers.
  PIR and DXR PASS on 2026-11-19.
- [x] 1.2 Link the change to the promoted issue and #24. Promoted as #26.

## 2. TDD-Red

- [ ] 2.1 Build a temp-dir Playwright report whose final-attempt path
  attachment exists outside the input folder and the repo cwd; assert the
  adapter count and the singular/plural notice.
- [ ] 2.2 Assert the cwd fallback: a relative path that misses the input folder
  but exists in the working directory is embedded and counts 0.
- [ ] 2.3 Assert an inline body with an outside path counts 0; missing,
  symlink, non-regular, URL-scheme and UNC/device paths count 0.
- [ ] 2.4 Assert trace zips and earlier attempts count 0.
- [ ] 2.5 Assert two Playwright inputs sum once and a duplicate input removed by
  the content hash is not counted twice.
- [ ] 2.6 Render tests: singular and plural copy, notice in the shared shell on
  both tabs and aligned with the run header, clean report has no notice markup
  and keeps the neutral footer sentence.
- [ ] 2.7 CLI tests: one stderr warning when HTML is written, including
  `--out --json`; stdout, `--json`, `--ci` and exit codes unchanged; no warning
  for a clean run or for `--json` without HTML.
- [ ] 2.8 Browser test: notice visible and wrapping at 320, 1440 and 320 with
  200 % text zoom, on Report and Details, aligned with the run header.
- [ ] 2.9 Assert the compat shim forwards the warning in its `warnings` array.
- [ ] 2.10 Confirm the new tests fail for the right reason before
  implementation.

## 3. Implement

- [ ] 3.1 Classify attachment candidates and count outside-root skips once per
  attachment; return the count from the Playwright adapter.
- [ ] 3.2 Carry the summed count through the loader and `generateReport`; expose
  `skippedAttachments` on the result.
- [ ] 3.3 Render the shared notice inside the shell-mirroring wrapper, use the
  pending tokens, neutralise the footer sentence and rebuild the stylesheet.
- [ ] 3.4 Write the CLI stderr warning after a successful HTML write without
  touching stdout or exit codes; forward it from the compat shim.
- [ ] 3.5 Keep the summary shape, JSON keys, schema version and HTML for clean
  reports free of notice markup.

## 4. Docs

- [ ] 4.1 Document the count and notice in `docs/PLAYWRIGHT-JSON.md`, the skip
  paragraph in `docs/AGENT-INTERFACE.md`, and the limit in
  `docs/LIMITATIONS.md`; add the allowed-root and skipped-attachment entries to
  `GLOSSARY.md`.
- [ ] 4.2 Add one `docs/CHANGELOG.md` entry.
- [ ] 4.3 Keep the two deferred decisions in `docs/BACKLOG.md` with triggers and
  widen the `--ci` trigger to cover `--ci github --out`.

## 5. Verification and review

- [ ] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 5.2 Run the review swarm: SCR, CR, DAR, UXR, CMP.
- [ ] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [ ] 5.4 Update the #24 checklist, commit and push with the issue and change
  reference.
