# TDD-Red record — add-report-localisation

Date: 2026-11-20. Issue #12, spec approved. Scope: failing tests and fixtures
only. No `src/`, no docs other than this record, no config, no product tests
were weakened, no characterization hash or golden was updated, nothing was
committed.

## Files written

- `test/i18n.test.ts` (new) — formatter, resolver, translator and escaping.
- `test/i18n-catalog.test.ts` (new) — catalog rules, bad fixtures and the
  generated-module staleness check.
- `test/render-locale.test.ts` (new) — German report chrome, test-data
  verbatim, Trends formatting, client block, no-JS and API rejection.
- `test/cli-locale.test.ts` (new) — `--locale` CLI contract and machine output.
- `test/dom-contract.test.ts` (test-only edit) — `DOM_IDS.i18nMessages` and the
  inert client block.
- `test/render-modules.test.ts` (test-only edit) — `i18n` added to `foundation`.
- `test/e2e/helpers.ts` (test-only edit) — optional fourth `locale` argument on
  `writeReport`.
- `test/e2e/locale.spec.ts` (new) — German report at the gate viewports,
  search/filter/copy, test data and no-JS.
- `test/fixtures/i18n/german-testdata.json` (new) — German test data with a
  hostile feature name.
- `test/fixtures/i18n/bad-*.json` (new, 9 files) — one fixture per catalog rule.

## Pinned API for `src/render/i18n.ts`

The tests define the module; the implementer must match. `src/i18n/catalogs.ts`
is generated and owns `MessageKey`.

```ts
export const SUPPORTED_LOCALES: readonly string[]; // contains 'en' and 'de'

export interface ResolvedLocale {
  requested: string; // canonical requested tag, e.g. 'de-AT'
  lang: string;      // value for <html lang>; equals requested
  dir: 'ltr' | 'rtl';
  catalog: string;   // matched catalog, e.g. 'de'
}

export function resolveLocale(tag?: string): ResolvedLocale;
// no tag or 'en' -> { requested: 'en', lang: 'en', dir: 'ltr', catalog: 'en' }
// 'de'          -> { requested: 'de', lang: 'de', dir: 'ltr', catalog: 'de' }
// 'de-AT'       -> { requested: 'de-AT', lang: 'de-AT', dir: 'ltr', catalog: 'de' }
// unknown, empty or malformed tags throw an Error naming the supported tags

export function formatMessage(
  message: string,
  params: Record<string, string | number>,
  locale: string,
): string;

export interface TranslatorOptions {
  /** Test seam: replaces the active catalog for the locale. */
  catalog?: Record<string, string>;
}

export interface Translator {
  locale: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  t(key: MessageKey, params?: Record<string, string | number>): string;
  number(value: number): string;
  percent(value: number): string;
  duration(milliseconds: number): string;
  date(iso: string | undefined): string;
  /** Serialized, escaped JSON for the client.* keys only. */
  clientMessages(): string;
}

export function createTranslator(
  locale?: string,
  options?: TranslatorOptions,
): Translator;

export type { MessageKey }; // re-exported from the generated catalogs module
```

### Formatter contract

- Supported: `{name}`, `{count, plural, one {...} other {...}}`, `#` inside a
  plural (`#` is raw for English and `Intl.NumberFormat` for non-English), and
  simple placeholders inside plural branches.
- `#` inside a plural is raw for English (`1234`) and `Intl`-formatted for
  German (`1.234`). English visible numbers stay as today; only non-English
  locales use `Intl`.
- A missing plural category renders the `other` branch.
- Throws: unbalanced `{`/`}`, empty `{}`, a stray `}`, unsupported placeholder
  types (`number`, `select`, ...), plural without `other`, nested plural, and
  any `<` or `>` in a message. The thrown message text is not asserted; only
  the throw.
- Parameter values are inserted literally in one pass and are not re-parsed.
- Parsing may be cached, but a cached result must not leak a locale or params
  (the tests format the same message in `en` and `de` and for different counts).

### Translator contract

- `createTranslator()` is English; `createTranslator('de')` uses the German
  catalog. `lang` keeps a regional tag (`de-AT`).
- A missing key falls back to the English message, then to the key itself.
- The `options.catalog` seam replaces the target catalog for that translator
  (it does not merge), so a partial catalog exercises the English fallback and
  a hostile `client.*` value exercises escaping.
- `number` returns the raw value for English (`1234.5`, existing output
  unchanged) and uses `Intl.NumberFormat(locale)` only for non-English
  (`1.234,5`).
- `percent(value)` takes a percentage number (0–100) and formats `value / 100`
  as `Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })`.
  German therefore yields `44,4\u00a0%`; English stays `44.4%`.
- `duration`: `< 1000 ms` uses `Intl.NumberFormat(locale, { maximumFractionDigits: 2 })`
  plus ` ms`; otherwise `Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
  of seconds plus ` s`. Non-finite or negative values yield `0 ms`. English
  stays `1.50 s` / `12.35 ms`.
- `date`: English keeps `YYYY-MM-DD HH:MM UTC`; other locales use
  `Intl.DateTimeFormat(locale, { timeZone: 'UTC', day/month/year: '2-digit'|'numeric',
  hour/minute: '2-digit', hourCycle: 'h23' })` parts as `DD.MM.YYYY, HH:MM UTC`.
  Empty or invalid input returns `''`.
- `clientMessages()` returns a JSON string of the active catalog's `client.*`
  entries (filter by key prefix; not a hard-coded key list, so the test seam's
  hostile values are included), with `<`, `>`, `&`, U+2028 and U+2029 written as
  JSON escapes (`\u003c`, `\u2026`); `JSON.parse` restores the literal text.
  `renderHtml` must embed exactly this string in
  `<script type="application/json" id="tolkira-messages">`.

## Catalog contract

- `src/i18n/locales/en.json`: `{ "<key>": { "message": "...", "description": "..." } }`.
- `src/i18n/locales/de.json`: `{ "<key>": "..." }` (value only).
- Both files are flat, dotted keys, sorted with the default
  `Array.prototype.sort()`.
- Key parity, a non-empty English description per key, non-empty values,
  identical placeholder sets, `other` on every plural, only
  `Intl.PluralRules(locale).resolvedOptions().pluralCategories` branches, and no
  `<`/`>`/`select` syntax in values.
- `src/i18n/catalogs.ts` exports `en` (message strings), `de` and
  `MessageKey = keyof typeof en`; the test re-reads the JSON and fails when the
  generated module is stale.

Bad fixtures live in `test/fixtures/i18n/` as `{ "en": {...}, "de": {...} }`
pairs and prove each rule trips with the file and key in the error:

| Fixture | Rule |
| --- | --- |
| `bad-missing-key.json` | key parity |
| `bad-missing-description.json` | English description |
| `bad-empty-value.json` | non-empty values |
| `bad-placeholder.json` | placeholder equality |
| `bad-missing-other.json` | plural `other` |
| `bad-category.json` | active plural categories |
| `bad-unsorted.json` | sorted keys |
| `bad-html.json` | no HTML |
| `bad-select.json` | no select |

The validator is test code in `test/i18n-catalog.test.ts`; it also accepts a
valid plural with placeholders inside branches, so the rules do not produce a
false positive on the design's example.

## Render contract as pinned by the tests

`renderHtml(envelopes, options)`; `RenderOptions` does not carry `locale` yet, so
`test/render-locale.test.ts` casts:

```ts
const options = {
  title: 'Tolkira report',
  locale: 'de',
} as RenderOptions & { locale: string };
```

The cast is the Red contract; `src/render/types.ts` must gain `locale?: string`.

German literals asserted (the catalog must contain these values or render them
through the matching key):

- Tabs: `Bericht`, `Details`, `Trends`; tablist `aria-label="Berichtsansichten"`.
- Toolbar: `Szenario, Feature oder Tag suchen`, `Szenarien durchsuchen`, `Tag`,
  `Alle Tags`, `Nur fehlgeschlagene`, `Alle ausklappen`, `Alle einklappen`.
- Empty states: `Keine Szenarien in diesem Bericht.` and
  `Keine Szenarien entsprechen der aktuellen Suche oder den Filtern.`
- Footer: `Erstellt von Tolkira. Eine Datei. Keine Netzwerkanfragen. Anhänge sind eingebettet, wenn verfügbar.`
- Status: `Bestanden`, `Fehlgeschlagen`, `Übersprungen`, `Ausstehend`,
  `Undefiniert`, `Mehrdeutig`.
- Header/health: `1 Feature`, `2 Szenarien mit Ergebnissen`, `Testzeit`,
  `1 von 2 ausgeführten Szenarien bestanden`.
- Triage: `Aufmerksamkeit erforderlich`, `Erster Fehler:`.
- Scenario detail: `Fehler kopieren`, `Schritte`, `Schritte und Hooks`,
  `Versuch: `, `Gestartet: `; `Feature: ` stays technical.
- Lightbox: `Anhang in voller Größe`, `Schließen`.
- Details: `Laufdetails`, `Lauf`, `Schritte (ohne Hooks)`, `Anhänge`,
  `Anhangsgröße`, `Quelle`, `Laufumgebung`, `Statusverteilung`,
  `Die Erfolgsquote zählt ausgeführte (nicht übersprungene) Szenarien`,
  `Feature-Statusmatrix`, `Nur ausgeführte Szenarien. Für alle Statusspalten scrollen.`,
  `Agenten-Zusammenfassung`, `Agenten-Zusammenfassung JSON`,
  `Vollständige Zusammenfassung:`.
- Trends: `Aufgezeichnet`, `Titel`, `Gesamt`, `Erfolgsquote`, `Dauer`,
  `Neueste zuerst`, `Aufgezeichnete Läufe`, `Aktuell`, dates
  `05.01.2026, 09:30 UTC` / `05.02.2026, 09:30 UTC`, durations `12,35 s` /
  `9,88 s`, pass rates from `Intl` (`66,7\u00a0%`, `100\u00a0%`).
- Client copy: live count `1 von 2 Szenarien sichtbar`, empty result as above,
  `Fehler kopieren`, copied label `Kopiert`, clipboard labels `Szenario: ` and
  `Schritt: `.
- Always: `<html lang="de" dir="ltr">`, default title `Tolkira report` in every
  locale, `<script type="application/json" id="tolkira-messages">`.
- Test data is never translated: German names, step text, Gherkin keywords
  (`Angenommen`, `Wenn`, `Dann`, `Und`), tags and the hostile
  `Kontoeröffnung <img src=x onerror="alert(1)"> & "Zitat"` render verbatim and
  escaped; English data under the German UI does the same.

`test/dom-contract.test.ts` pins `DOM_IDS.i18nMessages === 'tolkira-messages'`
and exactly one inert JSON block on a report without history.
`test/render-modules.test.ts` reads `src/render/i18n.ts` through the
`foundation` set and requires it to import no layered render module.

`test/e2e/helpers.ts` gains a fourth parameter:

```ts
writeReport(inputs, title = '', prefix = 'tolkira-e2e-', locale = '')
```

Existing callers keep their meaning; a non-empty locale adds `--locale <tag>`.

## Red commands and observed failures

```
npx vitest run test/i18n.test.ts test/i18n-catalog.test.ts test/render-locale.test.ts \
  test/cli-locale.test.ts test/dom-contract.test.ts test/render-modules.test.ts
```

Result: 6 files failed; 11 failed, 28 passed (39). Three suites fail to load
because their contract module does not exist; that is the intended first Red.

| File | Observed failure | Why it is red for the right reason |
| --- | --- | --- |
| `test/i18n.test.ts` | `Cannot find module '../src/i18n/catalogs.js'` (then `../src/render/i18n.js`) | The generated catalog module and the translator module do not exist; the suite tests that contract. |
| `test/i18n-catalog.test.ts` | `Cannot find module '../src/i18n/catalogs.js'` | Same; once it exists, the suite reads `src/i18n/locales/en.json`/`de.json` and fails on missing/unsorted/partial catalogs and on a stale generated module. |
| `test/render-locale.test.ts` | `Cannot find module '../src/render/i18n.js'` | The render contract needs the translator. Once present, `beforeAll` renders English because `locale` is ignored, so every German literal and `<html lang="de">` fails. |
| `test/cli-locale.test.ts` | 8 × `Unknown option '--locale'` (exit 2 where 0 is expected); the English test fails with `expected '…<html lang="en">…' to contain '<html lang="en" dir="ltr">'` | The CLI does not accept, validate or thread the option; the rejection tests fail because the supported list (`en, de`) is absent; the English test fails only on the intentional `dir="ltr"` change. |
| `test/dom-contract.test.ts` | `expected undefined to be 'tolkira-messages'` (1 failed, 8 passed) | `DOM_IDS.i18nMessages` is missing and no inert block is emitted; the rest of the DOM contract still passes. |
| `test/render-modules.test.ts` | `ENOENT … src/render/i18n.ts` (1 failed, 20 passed) | The foundation guard reads the new module; it is red until the module exists and imports only the generated catalog. |

```
npx playwright test test/e2e/locale.spec.ts --project=chromium
```

Result: 5 failed (5 workers). Every test fails in `beforeAll` at
`test/e2e/helpers.ts:48` because `writeReport(..., 'de')` runs the CLI and it
exits 2 with `Unknown option '--locale'`. The English report builds first, so
the fixture is proven to parse; the German build is the intended blocker.

## Notes for the implementer

- Do not weaken or delete a Red assertion. The German strings above are the
  approved copy contract; add missing keys to `en.json` and `de.json` rather
  than changing a test.
- `test/i18n.test.ts` deliberately rejects a stray `}` and any `<`/`>` in a
  message; keep the parser strict.
- `clientMessages()` is a string, not an object, so the escaping test can prove
  the serialized bytes are inert.
- English output changes only by `dir="ltr"`, the inert client block, the
  generated client script and its CSP hash. Characterization hashes and goldens
  were not touched and will need the intentional update in task 3.8.
- `npm run i18n:check` should run `test/i18n-catalog.test.ts` before `assets`;
  the suite is self-contained and reads only the JSON source and the generated
  module.
