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

- [x] 3.1 Classify attachment candidates and count outside-root skips once per
  attachment; return the count from the Playwright adapter.
- [x] 3.2 Carry the summed count through the loader and `generateReport`; expose
  `skippedAttachments` on the result.
- [x] 3.3 Render the shared notice inside the shell-mirroring wrapper, use the
  pending tokens, neutralise the footer sentence and rebuild the stylesheet.
- [x] 3.4 Write the CLI stderr warning after a successful HTML write without
  touching stdout or exit codes; forward it from the compat shim.
- [x] 3.5 Keep the summary shape, JSON keys, schema version and HTML for clean
  reports free of notice markup.

## 4. Docs

- [x] 4.1 Document the count and notice in `docs/PLAYWRIGHT-JSON.md`, the skip
  paragraph in `docs/AGENT-INTERFACE.md`, and the limit in
  `docs/LIMITATIONS.md`; add the allowed-root and skipped-attachment entries to
  `GLOSSARY.md`.
- [x] 4.2 Add one `docs/CHANGELOG.md` entry.
- [x] 4.3 Keep the deferred decisions in `docs/BACKLOG.md` with triggers,
  including the summary/annotation channel and per-attachment diagnosis.

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 5.2 Run the review swarm: SCR, CR, DAR, UXR, CMP and SEC.
- [x] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [x] 5.4 Update the #24 checklist, commit and push with the issue and change
  reference.

## Gate record

2026-11-19: `npm run hygiene` ok; `npm run check` 614 passed, 2 skipped;
`npm run test:e2e` 240 passed (Chromium, Firefox, WebKit). Review swarm: SCR,
CR, DAR, UXR, CMP and SEC pass; CMP's stderr-hint blocker and the SCR/CR test
gaps were fixed and re-checked. Deferred with triggers in `docs/BACKLOG.md`:
the warning in `--json`/`--ci` without HTML, missing or unreadable files, and
per-attachment diagnosis.
