# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, specs and design; fix blockers.
- [x] 1.2 Link the change to #12 and B-009; record the research notes.
- [x] 1.3 Get user sign-off on the German term sheet, address form and
  failed-chip form before TDD-Red.

## 2. TDD-Red

- [ ] 2.1 Formatter tests: `{name}`, plural in `en` and `de`, `#`, `other`
  fallback, malformed input, cache and escaping; select and nesting fail.
- [ ] 2.2 Catalog tests and fixtures: key parity, placeholders, plural
  categories via `Intl.PluralRules`, empty values, missing description,
  missing `other`, sorted keys, complete German catalog, and a stale generated
  `catalogs.ts` compared with the JSON source.
- [ ] 2.3 Locale tests: default `en`, `de`, `de-AT` -> `de` with
  `lang="de-AT"`, unsupported and empty tags, `--locale` without `--out`,
  `--json`/`--ci` byte-identical, no environment detection, API rejection.
- [ ] 2.4 Render tests: German tabs/toolbar/filters/empty states/aria/footer
  in `html`, `report`, `details`, `trends`, `triage`, `matrix`, `ci`,
  `attachments` and `markdown`; test data verbatim; German
  numbers/dates/durations; one status-label key set; clipboard labels and
  synthetic labels; client map with only `client.*` keys and JSON-escaped
  values; `DOM_IDS.i18nMessages`; no-JS Report; 320 px.
- [ ] 2.5 Browser test: German at 320, 390, 768, 1024 and 1440 px plus 320 px
  at 200 % text zoom; search/filter/copy; no-JS; test data unchanged.
- [ ] 2.6 Confirm the new tests fail for the right reason; record the Red
  contract in `tdd-red.md`.

## 3. Implement

- [ ] 3.1 Add the `en`/`de` JSON catalogs, `scripts/build-i18n.mjs`, the
  generated `src/i18n/catalogs.ts`, and wire generation into `npm run assets`.
- [ ] 3.2 Add `src/render/i18n.ts` with the formatter, resolver, translator and
  locale helpers; add it to the layer guard's foundation set.
- [ ] 3.3 Thread the translator through the shell and every view module; add
  `locale` to `RenderOptions`, `RenderReportOptions`, `renderOptions`,
  `renderReport`, `generateReport` and `CucumberHtmlStream`. Keep the requested
  tag for `<html lang>` and the matched catalog for text.
- [ ] 3.4 Add `--locale` to the CLI usage and pre-flight validation (exit 2);
  require `--out`; keep `--json`/`--ci`, summary keys and exit codes unchanged.
- [ ] 3.5 Inject the `client.*` messages as an escaped inert JSON block
  (`DOM_IDS.i18nMessages`) and update `report-client.ts` with the existing
  literals as fallbacks and one/other plural only.
- [ ] 3.6 Restructure `report.ts`/`triage.ts` concatenations into full
  sentences; split the report notice in `warnings.ts` from the CLI copy.
- [ ] 3.7 Add `test/i18n.test.ts` and `npm run i18n:check`; run it before
  `assets` in `npm run check` and `npm test`.
- [ ] 3.8 Regenerate `client-bundle.ts`, update the characterization hashes and
  goldens intentionally; confirm the English text diff is only `dir`, the
  client block, the client script and its CSP hash.

## 4. Docs

- [ ] 4.1 Add `docs/I18N.md` (schema, keys, adding a locale, fallback,
  untranslatable list, German glossary, agent checklist); update
  `GLOSSARY.md`, `README.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`,
  `docs/README.md` and `llms.txt`.
- [ ] 4.2 Update `docs/AGENT-INTERFACE.md` (CLI/API/stream `locale`), `docs/
  LIMITATIONS.md`, `docs/COMPATIBILITY.md`, `docs/PRODUCT.md` (localisation is
  now in scope), `package.json` (`docs/I18N.md`), and one
  `docs/CHANGELOG.md` entry.
- [ ] 4.3 Add backlog triggers for a pseudo-locale, a localized default title,
  RTL and an in-report switcher.

## 5. Verification and review

- [ ] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 5.2 Run the review swarm: SCR, CR, DAR, UXR, ILA, STR and CMP, plus SEC
  on the catalog/injection boundary and PCA on the size budget; get a native
  German copy review.
- [ ] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [ ] 5.4 Commit and push with #12 and the change reference.

## Gate record

- PIR and DXR: PASS after two review rounds. Copy approved by the user on
  2026-11-20 (neutral address, `Fehlgeschlagen`, `Trends`, stable
  `Tolkira report`, term sheet).

To be filled after verification: unit/e2e counts, German report size delta,
review verdicts and any deferred item.
