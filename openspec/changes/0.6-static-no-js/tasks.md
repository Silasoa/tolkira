# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over the proposal, spec delta and design; fold blockers
  into the contract before Red.
- [ ] 1.2 Confirm the tab, details, lightbox, print and CSP seams, and that no
  new catalog key is needed.
- [ ] 1.3 Confirm the decisions: `--static`, dead controls removed, `data-*`
  attributes kept where the control remains, and `--pdf` stays explicit.

## 2. TDD-Red

- [ ] 2.1 Static render: no `<script>`, `script-src 'none'`, `connect-src
  'none'` with no source, no client-message block, no tab bar or tab roles, no
  dangling `aria-labelledby`/`aria-controls`, exactly one `<main>`, every
  `<details>` open (feature, scenario, hook group, earlier attempts, text
  attachment, triage rest), no lightbox or image button, no copy-failure button,
  no search/tag/status filter control.
- [ ] 2.2 Static views: Report and Details visible; Trends visible with two or
  more history runs and absent with zero or one.
- [ ] 2.3 Default characterization: the committed hashes and golden HTML are
  unchanged; scripts, controls, collapsed passed rows and the three `<main>`
  elements remain.
- [ ] 2.4 CLI/API: `--static` with `--out` and `--pdf`; no report surface exits
  2; `--static --json` writes nothing; `--static --baseline` composes once the
  baseline change lands.
- [ ] 2.5 Browser: JavaScript disabled at 320, 390, 768, 1024 and 1440 px and
  320 px at 200 % text; German labels; an image visible; a bookmarked
  `?query=`/`?hide=`/`?tag=` URL shows the full report; no horizontal overflow;
  print includes every section.
- [ ] 2.6 PDF: `--static --pdf` uses a script-free source and includes Details
  and Trends.
- [ ] 2.7 Size: record the static and default bytes for the standard fixture.
- [ ] 2.8 Confirm RED; no existing test is deleted or weakened.

## 3. Implement

- [ ] 3.1 Add `static` to the render options and the CLI, with the
  `--out`/`--pdf` requirement and the usage error.
- [ ] 3.2 Thread the mode through `html.ts`: omit both scripts, the client
  block, the tab bar, the lightbox and the dead toolbar/copy/image controls; set
  `script-src 'none'` and keep `connect-src 'none'`.
- [ ] 3.3 Open every `<details>` in `report.ts`, `attachments.ts` and
  `triage.ts`; stack the panels; remove the tab roles and dangling aria from all
  three panels; keep exactly one `<main>` and the three view IDs.
- [ ] 3.4 Document the mode, the no-JS/print result, the removed controls, the
  kept IDs, the architecture seam, the bookmarked-URL limit and the Jenkins
  note; fix the stale AGENT-INTERFACE static no-JS sentence; record the default
  multiple `<main>` as B-048.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [ ] 4.2 SCR, CR, DAR, UXR, STR and CMP; ILA if any label or layout changes.
- [ ] 4.3 Run the relevant `docs/DROP-IN-VALIDATION.md` rows on the final tree
  and record host, pin and result.
- [ ] 4.4 Record the static/default size delta, the client bundle size and the
  combined `--static --baseline` case after all four changes land.
- [ ] 4.5 Fix findings; record deferred decisions with a trigger.

Review findings (2026-11-23): PIR/DXR found the static mode contradicted nine
unmodified base requirements (B1) plus the Details-tab scenario in "Show summary
and detailed test results", the `<details>` list missed `attachments.ts`
and `triage.ts` (B2), the dead controls were kept (D5/I5), the Report panel kept
`role="tabpanel"` and a dangling `aria-labelledby` (I9), the print page break is
keyed by `#analysis-view`/`#trends-view` rather than `.tabPanel` (I8), "no
`connect-src`" was false (I10), and the default report's multiple `<main>` was
not recorded (D6). The delta now has one MODIFIED requirement per contradicted
base requirement, the design lists every `<details>` site, the dead toolbar,
copy-failure and image-lightbox controls are removed, all three panels drop the
tab roles and dangling aria while keeping their IDs, `connect-src 'none'` is
stated correctly, and the default three `<main>` elements stay unchanged with
B-048. The docs list gains `docs/PRODUCT.md` and `GLOSSARY.md` (D20). No
implementation task is marked done.

## Gate record

- PIR/DXR:
- Focused tests:
- `npm run hygiene`:
- `npm run check`:
- `npm run test:e2e`:
- Host rows:
- Size measurements:
- Review round:
