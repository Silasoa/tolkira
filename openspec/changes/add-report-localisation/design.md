# Design

## Context

The report is server-rendered into one HTML string; the browser script only
filters, tabs and copies. ADR 0005 (server-rendered shell) and ADR 0006 (inline
attachments) still apply. The research notes in `docs/research/i18n-*.md`
compare the options. The architecture note optimised runtime size and proposed
typed TypeScript catalogs; the agent-workflow note prioritised translator
context and standard tooling. This design chooses ICU JSON for the catalogs and
keeps the TypeScript build clean by generating a typed module from the JSON.

Data flow: CLI pre-validates `--locale` -> `resolveLocale` keeps the requested
tag and picks the catalog -> the generated catalogs are bundled -> render
functions receive a translator -> server HTML -> the active client messages are
serialised into an inert JSON block -> one file. No fetch, no catalog in the
client bundle, no host detection.

## Catalog source and generated module

`src/i18n/locales/en.json` is the source of truth; `de.json` is the shipped
translation. One flat sorted file per locale, dotted keys grouped by area
(`report.*`, `details.*`, `trends.*`, `client.*`).

```json
{
  "report.tab": {
    "message": "Report",
    "description": "Top navigation tab that shows the test report"
  },
  "report.scenarioCount": {
    "message": "{count, plural, one {# scenario} other {# scenarios}}",
    "description": "Scenario count in the run summary; count is a non-negative integer"
  }
}
```

```json
{
  "report.tab": "Bericht",
  "report.scenarioCount": "{count, plural, one {# Szenario} other {# Szenarien}}"
}
```

- English entries are objects with `message` and `description`; targets are
  value-only strings.
- `scripts/build-i18n.mjs` reads the JSON and writes the committed
  `src/i18n/catalogs.ts` with `en` (`as const`), `MessageKey = keyof typeof en`
  and `de` (`satisfies Record<MessageKey, string>`). The type lives in the
  generated module, so the catalog never imports the renderer. `npm run assets`
  runs it, like the styles and client bundles. No runtime or declaration
  imports JSON, so the esbuild bundle and `tsc` declarations stay clean and the
  package needs no JSON copy.
- `test/i18n.test.ts` re-reads the JSON source and fails if the generated
  module is stale. `npm run i18n:check` runs that file **before** `assets` in
  `npm run check` and `npm test`, so a forgotten regeneration fails instead of
  being silently refreshed.
- The formatter supports `{name}` and `{name, plural, ...}` with `#` and an
  `other` branch. Branches may contain placeholders, not nested plural/select.
  Select, nesting and HTML are catalog errors. A select/gender helper waits for
  a string that needs it (backlog trigger).
- Messages are parsed once per unique string and cached. Parse errors name the
  file and key. The catalog is trusted local data, not user input.

## Modules

`src/render/i18n.ts` is a render foundation module (imports the generated
catalogs only), so the existing layer guard sees it and `html.ts`/`format.ts`
can depend on it:

- `src/render/i18n.ts`: `SUPPORTED_LOCALES`, `resolveLocale(tag)`,
  `createTranslator(locale)`, the re-exported `MessageKey`, the formatter and
  the locale-aware `number`, `percent`, `duration` and `date` helpers. Add
  `i18n` to the guard's `foundation` set; it must not import a layered render
  module.
- `src/i18n/locales/en.json`, `de.json` (data; not scanned by the guard).
- `src/i18n/catalogs.ts` (generated, committed; owns `MessageKey`).
- `scripts/build-i18n.mjs` (generation).
- `test/i18n.test.ts`: formatter, resolver, fallback, escaping and the catalog
  checks. `npm run i18n:check` runs this file before `assets`.

`RenderOptions` gains `locale?: string`; `renderOptions()` is the single
CLI/API/stream seam and must pass it through. `renderHtml` resolves it once and
passes the translator to the shell and views.

## Locale resolution

- `Intl.getCanonicalLocales(tag)`; invalid tags throw a usage error.
- Exact match in `SUPPORTED_LOCALES` (`en`, `de`), then primary subtag
  (`de-AT` -> `de`). Default `en`.
- Keep the requested canonical tag for `<html lang>` (`de-AT`); use the
  matched catalog for text. `dir` comes from the locale entry (`ltr` for
  en/de).
- The CLI validates in the pre-flight usage block, before generation, and exits
  2 with `en, de`. Generation errors stay exit 1. The API throws a `UsageError`
  with the same message.
- No environment or `navigator.language` detection; one locale per report.
- `--locale` requires `--out`; with `--json`/`--ci` only it is a usage error.
  The summary, JSON and CI text are not localized.

## Which text is localized

| Module | Text |
| --- | --- |
| `html.ts` | shell, tablist label, report notice from `warnings.ts` |
| `report.ts` | toolbar, search placeholder, expand/collapse, failed-only, empty state, footer, steps label, copy failure |
| `details.ts` | run details, metadata labels, counts, attachments |
| `trends.ts` | headings, table headers, status labels, hint, caption, current |
| `triage.ts` | needs-attention heading, need/needs sentence, show-more features |
| `matrix.ts` | matrix heading and labels |
| `ci.ts` | revision, branch, tag, CI labels and values |
| `attachments.ts` | view/download/copy labels, full-size label |
| `markdown.ts` | any user-facing fallback or label |
| `format.ts` | status labels, pass rate, durations, dates |
| `report-client.ts` | search/filter/copy/visible-count/empty-result and clipboard labels |

The CLI CI formatter `src/ci.ts`, CLI usage/errors and the summary stay English.
`warnings.ts` splits the report notice from the CLI copy. `triage.ts` and
`report.ts` concatenations become full sentences with ICU plural branches.
Status labels live in one key set used by both `format.ts` and `trends.ts`.
Clipboard labels ("Feature:", "Scenario:", "Step: ") are localized; the copied
feature/scenario/step text is not. The synthetic labels (`Feature:`,
`Scenario:`, `Attempt:`, `Started:`, `Rule:`, `Steps`) are chrome; input
keywords and names are test data and stay verbatim.

## English stays stable

The English visible text, numbers, percentages, durations and dates stay as
today. The German path uses `Intl`; the English path keeps the existing
helpers. The intentional English byte changes are `dir="ltr"`, the inert
client-message block, the client script and its CSP hash. The JSON block is
excluded from `inlineScriptHashes` (it is inert data), so only the client
script hash moves. German percentages come from `Intl` (a no-break space before
`%`); tests compare the `Intl` output, not an ASCII space.

Formatting rules for German: `Intl.NumberFormat('de-DE')` for counts; pass rate
with `maximumFractionDigits: 1`; durations with the existing unit labels and a
German decimal comma; recorded time as `DD.MM.YYYY, HH:MM UTC` from
`Intl.DateTimeFormat` parts with `timeZone: 'UTC'`. Rounding follows the `Intl`
default and is asserted against the `Intl` output, not a hand-written string.

The default title stays `Tolkira report` in every locale (a brand string; it
feeds the history id). `--title` still overrides. A localized default is a
backlog trigger, not this change.

## Copy and terms

The German term sheet lives in `docs/I18N.md` and `GLOSSARY.md`: `Bericht`,
`Details`, `Trends`, `Szenario`, `Schritt`, `Anhang`, `Lauf`, `Bestanden`,
`Fehlgeschlagen`, `Übersprungen`, `Ausstehend`, `Erfolgsquote`. The address form
is impersonal; no `du`/`Sie`. `Feature`, `Hook`, `Rule` and `URI` keep their
technical meaning. Approved on 2026-11-20: neutral address, full
`Fehlgeschlagen` in the chip with wrapping (no short form), `Trends`, and the
stable `Tolkira report` title. `de` is the generic catalog and `de-AT` uses it.

## Client messages

Only the `client.*` keys are embedded, as
`<script type="application/json" id="tolkira-messages">` (add
`DOM_IDS.i18nMessages`). `<`, `>`, `&`, U+2028 and U+2029 are escaped as JSON
escapes, not HTML entities, so the client displays the literal text. The block
is inert and always present.

The client reads and parses it, uses the existing English literals as per-key
fallbacks, and supports only `{name}` and `one`/`other` plural branching; the
visible-count plural agrees with the total, not the visible count. The client
does not import the server formatter or any catalog. Search, filters, tabs,
copy and keyboard handling stay unchanged. If CSP blocks the data block in a
browser test, move the map to a `data-` attribute on the shell; the client API
stays the same. The 16 KB budget check remains; the headroom is about 1.5 KB,
so the map and parser must stay small. A bundle test asserts the client build
contains no German catalog string and stays under 16 KB.

## Validation

`test/i18n.test.ts` checks key parity, placeholders, the active plural
categories from `Intl.PluralRules`, non-empty values, English descriptions,
`other`, sorted keys, the complete German catalog and the stale generated
module. A crafted partial catalog covers a missing plural category. Bad
fixtures cover each failure. `npm run i18n:check` runs it before `assets` in
`npm run check` and `npm test`, so a forgotten regeneration fails.

A German URL-state round-trip test filters with `?hide=passed`, reloads and
asserts the same scenarios are hidden while the label is German. A mixed
fixture with German test data under an English UI (and vice versa) proves test
data is never translated, including a hostile name.

## Docs and agent workflow

`docs/I18N.md` documents the schema, key naming, adding a locale, the fallback
rule, the untranslatable list, the German glossary and a short agent checklist:
read the guide, find the key with `rg`, edit only that key in `en` and the
target, run `npm run i18n:check` and the focused tests, preserve placeholders
and `#`, and check the longest string at 320 px and 200 % zoom. `GLOSSARY.md`
gets the shared German terms; the research notes stay as the rationale.
`package.json` ships `docs/I18N.md`; `docs/README.md` and `llms.txt` link it.

## Alternatives considered

- **Typed TypeScript catalogs** (the architecture note's first choice): smallest
  runtime, but strings live in code, lose per-key descriptions and cannot be
  read by external tools; rejected in favour of the agent-facing JSON source
  above.
- **Plain JSON with plural suffixes**: a smaller helper, but plural branches are
  split across keys and lose the full-sentence context; rejected.
- **`intl-messageformat`/Fluent/i18next**: 10-16 KB gzip and a dependency for a
  ~180-string catalog; rejected.
- **All locales in one report with a switcher**: +35-45 KB at five locales and
  a second render path; rejected for this change.
- **Host auto-detection**: non-deterministic artifacts; rejected.
- **CLI/CI translation**: breaks the machine contract and log search; rejected.

## Risks

- German length against fixed chips and the 44 rem Trends table; test 320,
  390, 768, 1024, 1440 px and 320 px at 200 % in three engines.
- The formatter is new parsing code; keep the grammar small and test every
  branch, fallback and error.
- The client JSON block must stay inert and escaped; add a hostile-translation
  test and a CSP/no-JS browser test.
- Catalog drift between en and de; the test runs in `npm run check`.
- The generated catalog module must be regenerated with the assets; the stale
  check catches a forgotten run.
- English goldens and characterization hashes move for `dir`, the JSON block and
  the client script; update them in one intentional commit and verify the text
  diff is only those changes.
- `de-AT` vocabulary is not separate in this change; the `de` catalog is used.
- Test data must never be translated; add a mixed-language fixture.
