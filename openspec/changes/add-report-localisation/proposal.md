# Proposal

## Why

The report UI is English-only. German is the first real second locale and the
trigger issue #12 names. Localisation must be designed once, so agents can add
locales cheaply, and it must not weaken the single-file, offline promise or the
16 KB client budget. The research in `docs/research/i18n-*.md` compares the
options and recommends a narrow first slice.

## What Changes

- Add `--locale <tag>` and `locale` on the render API. The default is `en`;
  `de` is the first supported locale; `de-AT` resolves to `de`; an unknown or
  empty tag is a usage error with the supported list.
- Render report chrome, accessibility labels, empty/error states, Trends labels
  and the client-script messages from a locale catalog. Test data, Gherkin
  keywords, tags, attachment names, metadata and URIs render verbatim.
- Keep CLI usage, errors, `--json` and `--ci` output in English as a stable
  machine contract.
- Use ICU MessageFormat JSON catalogs: one flat file per locale, English with
  descriptions, other locales value-only. A small in-repo formatter handles
  interpolation, plural and `#` without a runtime dependency.
- Use native `Intl` for German numbers, percentages, durations and UTC dates.
  English visible text stays byte-identical apart from `dir="ltr"`, the inert
  client-message block, the generated client script and its CSP hash.
- Set `<html lang>` and `dir`; one locale per report, no in-report switcher and
  no host auto-detection.
- Keep the report single-file and offline: only the active locale's client
  messages are embedded; no catalog ships in the client bundle and nothing is
  fetched.
- Add an agent guide (`docs/I18N.md`), a German glossary and a catalog check.

Out of scope: RTL locales, an in-report language switcher, CLI/CI/summary
translation, translating test data, print/email/PDF (#13), a pseudo-locale, TMS
integration, and a localized default report title.

## Impact

- `src/i18n/locales/en.json`, `de.json` (source) and the generated
  `src/i18n/catalogs.ts`; `scripts/build-i18n.mjs`.
- `src/render/i18n.ts` (translator, formatter, locale helpers),
  `src/render/html.ts`, `report.ts`, `details.ts`, `trends.ts`, `triage.ts`,
  `matrix.ts`, `ci.ts`, `attachments.ts`, `markdown.ts`, `format.ts`,
  `report-client.ts`, `dom-contract.ts`, generated `client-bundle.ts`.
- `src/warnings.ts` (report notice vs CLI copy), `src/cli.ts`, `src/options.ts`,
  `src/index.ts`, `src/stream.ts`.
- `test/i18n.test.ts`, `test/i18n-catalog.test.ts` (new),
  `test/render-modules.test.ts`,
  `test/dom-contract.test.ts`, render/CLI/e2e tests, characterization hashes,
  goldens and `test/e2e/helpers.ts`.
- `docs/I18N.md` (new), `README.md`, `DESIGN.md`, `GLOSSARY.md`, `llms.txt`,
  `docs/README.md`, `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`,
  `docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md`, `docs/PRODUCT.md`,
  `docs/CHANGELOG.md`, `docs/BACKLOG.md`, `package.json`.
- No new runtime dependency and no network access. Budget: at most 10 KB extra
  for the smallest report and at most 5 KB gzip extra in the package.

## Capabilities

### New Capabilities

- `localisation`: catalog format, locale resolution, fallback, formatting,
  validation and the single-file size/offline budget.

### Modified Capabilities

- `cli-api`: the `--locale` option, API fields, stream parity and the
  report-only boundary.
- `report-rendering`: localized shell, chrome, accessibility, empty states,
  Trends labels and client messages; `lang`/`dir`.

## Review gate

PIR and DXR before implementation; implementation is a TDD pair; review swarm is
SCR, CR, DAR, UXR, ILA, STR and CMP, plus SEC on the catalog/injection trust
boundary and PCA on the size budget. A native German copy review is required
before the change closes. Refs #12 and B-009.
