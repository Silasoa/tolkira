# Tasks

## 1. Gate

- [x] 1.1 Validate the spec and design; confirm the header and Details link
  rule, the `safeHttpUrl` oracle and no schema/locale/dependency change.
- [x] 1.2 Confirm the existing CI link pattern, metadata filters and header
  `.meta` wrapping rule.

## 2. TDD-Red

- [x] 2.1 Header and Details: a safe URL becomes an anchor with the normalized
  href, escaped label and `rel="noopener noreferrer"`; one run asserts both
  surfaces.
- [x] 2.2 The three normalized forms (`http:example.com`,
  `https:\\example.com`, `https://example.com/a b`) link; unsafe schemes,
  scheme-less values, malformed URLs and plain text stay escaped text.
- [x] 2.3 A value with an internal tab, line feed or carriage return stays
  text (no spoofed label); empty entries stay omitted; a URL with `&`/quotes is
  escaped; a numeric shim value stays text.
- [x] 2.4 CLI `--meta` and the compat shim `metadata` object render the link
  through the real HTML path (not only options mapping); the JSON summary and
  email/CI bytes are unchanged.
- [x] 2.5 A long Actions URL does not overflow the header or Details at 320 px
  and 200 % zoom.
- [x] 2.6 Confirm RED for the missing links; the existing metadata tests stay
  green.

## 3. Implement

- [x] 3.1 Add `metadataValueHtml` and use it in the header and Details.
- [x] 3.2 Prove the existing `.meta span`/`.metaList dd` wrap rules at 320 px
  and 200 % with a long URL. Add `min-width: 0`/`overflow-wrap: anywhere` to
  `src/render/report.css` only if the measured test fails, rebuild the generated
  `styles.ts`, and update goldens intentionally.
- [x] 3.3 Update README (link rule, `CI run`/`Commit`/`Browser`/`Project`
  keys, full URL not a raw SHA, normalized href vs label),
  `docs/AGENT-INTERFACE.md` (option table, CI metadata note and the raw-SHA
  example) and `docs/COMPATIBILITY.md` (shim metadata link).
- [x] 3.4 Update the Metadata row in `docs/research/cucumber-html-parity.md`
  after shipping to record safe http(s) links (the official formatter links its
  structured CI job and GitHub commit; CHR/MCHR print text; Playwright links
  through its linkifier).
- [x] 3.5 Keep the summary schema, CI/email bytes, locale catalogs and
  dependencies unchanged.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 4.2 Re-run the Seed-Test shim smoke with a URL metadata value (or record
  the written reason the focused shim/CLI tests cover it) and the relevant
  Playwright 320/1440 layout check; record host, pin and result in
  `docs/DROP-IN-VALIDATION.md`.
- [x] 4.3 Run SCR, CR, DAR, UXR, SEC (metadata links) and CMP.
- [x] 4.4 Fix findings; record deferred decisions.
- [x] 4.5 Commit and push; no release before the separate release approval.

## Gate record

- Hygiene: ok (668 tracked files, 269 commits).
- Check: 73 files, 1088 passed, 4 skipped; typecheck, lint, build and i18n
  green.
- E2E: 361 passed, 8 skipped (Chromium, Firefox and WebKit; 320/390/768/1024/
  1440 and 320 at 200% text zoom).
- Host: Seed-Test 2026-11-22, pin `ce2cad8`, working-tree tarball 540,724 B;
  `report.service.spec.ts` 35/35; story and group reports link the temporary
  `CI run` URL in header and Details with normalized href and
  `rel="noopener noreferrer"`; no overflow at 1440/390/320 + 200% and no
  console errors. The unrun limits are recorded in the DROP-IN note.
- Reviews: SCR, CR, DAR, UXR, SEC, CMP and STR PASS after the fixer and
  rechecks.
- Deferred: B-039 long metadata links in Details at 320 px/200% (readability,
  not overflow); the backslash label/href mismatch, userinfo/IDN links and the
  unstripped LRM/RLM/ALM/ZWSP are documented. Direct-ESM numeric metadata now
  renders as text instead of being dropped (small untyped-caller behaviour
  change).
- No schema, locale, dependency or CSS/golden change. Report HTML changes only
  where a safe URL is linked; JSON summary, CI and email bytes are unchanged.
