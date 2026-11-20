# Agent-friendly localisation for Tolkira

Date: 2026-11-20. Status: research for issue #12; no code, spec or config changes.

Issue #12 gates localisation on a real second locale; the German request is that trigger. The report is one static HTML file, agent-maintained, offline and built on Node built-ins ([`docs/PRODUCT.md`](../PRODUCT.md), [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)). Which catalogue lets an agent fix one string with the smallest, safest read?

## Format comparison

| Format | Agent readability | Context and comments | Plurals and select | Tooling | Diff friendliness |
| --- | --- | --- | --- | --- | --- |
| [ICU JSON](https://formatjs.github.io/docs/core-concepts/icu-syntax) (FormatJS) | Good; JSON + ICU | `description`; no comments | `plural`, `select`, `selectordinal`; `other` required | Extract/compile/verify; ESLint; TMS formatters | Clean when flat and sorted; nesting churns braces |
| [Fluent `.ftl`](https://projectfluent.org/fluent/guide/comments.html) | Best; line-oriented | `#` bound comment, `##` group, `###` file; terms | CLDR categories; default variant required | `@fluent/bundle`, Pontoon; a second runtime | Clean; comments travel with the message |
| [i18next JSON](https://www.i18next.com/misc/json-format) | Best for plain strings | None in JSON | `_one`/`_other` suffix keys; `Intl.PluralRules`; `count` required | i18next runtime; `i18next-cli`; old parser deprecated | Clean, but plurals add lines; nesting churns braces |
| [gettext PO](https://www.gnu.org/software/gettext/manual/html_node/PO-File-Entries.html) | Fair; quoted, wrapped | `#.` extracted, `#:` refs, `#` translator comments, `msgctxt` | `msgid_plural`, `msgstr[n]`, `Plural-Forms` header | Mature: `xgettext`, `msgmerge`, `msgfmt`, Poedit, Weblate | Noisy: refs, wrapping, fuzzy `#|` entries |
| [Chrome messages JSON](https://developer.chrome.com/docs/extensions/reference/api/i18n) | Good; `message`, `description`, `placeholders` | Description and placeholder examples | None; string substitution only | Chrome extensions only | Descriptions per locale; case-insensitive keys |
| [ARB](https://github.com/google/app-resource-bundle/blob/main/docs/specification.md) | Fair; value + `@key` metadata | Description, context, placeholders, screenshot, video | ICU plural; spec calls it experimental | Flutter `gen_l10n`; JSON schema | Verbose unless compacted |

Token figures are measured on an 8-message sample (six plain, two plural, one short description where the format supports it), UTF-8 at chars/4; a real tokenizer may differ by ~20%.

| Format | Source entry | Target entry |
| --- | ---: | ---: |
| ICU JSON, metadata only in `en` | ~39 | ~20 |
| Fluent | ~34 | ~26 |
| i18next JSON | ~23 | ~23 |
| gettext PO | ~47 | ~38 |
| Chrome messages JSON | ~38 | ~38 |
| ARB, verbose | ~62 | ~62 |

Adding one string costs roughly source + target (40–60 tokens); fixing a translation costs the target entry (20–40).

Fluent and ICU keep a sentence, its context and branches in one unit. PO has the best translator toolchain, but `msgid` is often the English text, so copy edits churn entries; `msgmerge` marks changed entries fuzzy, and `msgfmt --check-format` checks only `c-format`, not ICU placeholders ([msgfmt](https://www.gnu.org/software/gettext/manual/html_node/msgfmt-Invocation.html)). Chrome cannot express plurals. ARB has the richest metadata but is Flutter-shaped and verbose.

## What makes translation safe

**Stable keys.** Use semantic keys (`report.scenarioCount`), not English text. FormatJS recommends hash IDs to avoid collisions ([extraction](https://formatjs.github.io/docs/getting-started/message-extraction)); hashes are opaque and change with English, worse for a small catalogue. Use explicit keys and enforce uniqueness.

**Descriptions.** FormatJS has `description` and an `enforce-description` rule ([linter](https://formatjs.github.io/docs/tooling/linter)); gettext extracts `TRANSLATORS:` comments into `#.` ([advice](https://www.gnu.org/software/gettext/manual/html_node/Translator-advice.html)); Fluent binds a `#` comment to the next message ([comments](https://projectfluent.org/fluent/guide/comments.html)). Write one sentence per key, plus placeholder examples and a max length where space is tight.

**Placeholders.** Use snake_case names; FormatJS's `no-camel-case` rule exists because vendors are case-sensitive. `enforce-placeholders` checks call sites, and `formatjs verify --structural-equality` checks that translations are formattable and keep their tokens ([CLI](https://formatjs.github.io/docs/tooling/cli)).

**Plurals.** ICU requires `other`; `one` is a grammatical category, not the number 1, and `#` must format the number for the locale ([ICU syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax)). Validate branches against `new Intl.PluralRules(locale).resolvedOptions().pluralCategories`: German gives `one, other`, Ukrainian four categories ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules/resolvedOptions)).

**Screenshots, glossary, length.** Only ARB standardises a `screenshot`; PO and Fluent only allow a comment URL. Use one area screenshot, not per-key. Fluent terms are the only built-in glossary ([terms](https://projectfluent.org/fluent/guide/terms.html)); with JSON, keep a glossary table. Define optional `maxLength`; no format has one.

## Workflow and agent pitfalls

AST extraction beats a regex, but Tolkira's renderers are template literals; an extractor adds a tool to keep in sync. Keep `en.json` as the source and scan `t('key')`. `formatjs verify --missing-keys --extra-keys` is the coverage model; gettext uses `msgattrib --untranslated` ([msgattrib](https://www.gnu.org/software/gettext/manual/html_node/msgattrib-Invocation.html)).

Pseudo-localisation is the cheap hard-coded-string test: English (XA) adds accents, expands text and brackets each unit, exposing untranslated strings, overflow and concatenation ([Android](https://developer.android.com/guide/topics/resources/pseudolocales)); FormatJS supports `en-XA` and `xx-LS` ([CLI](https://formatjs.github.io/docs/tooling/cli)).

| Agent pitfall | Guard |
| --- | --- |
| Inventing a key | Add to `en.json` first; checker rejects used-but-missing and unused keys |
| Translating a placeholder or identifier | Placeholder-set comparison; identifiers never appear in values |
| Inconsistent terms | Glossary plus reviewer; no automated inflection check |
| Reusing one translation for unrelated contexts | One key per meaning; descriptions expose the difference |
| Touching unrelated lines | Flat target files, one key per line, sorted; reviewer checks diff scope |
| Inventing plural categories | Compare against `Intl.PluralRules`; require `other` |
| Copying English as a "translation" | Coverage check and `translatable: false` for brands/protocols |
| Concatenating fragments | Full sentences; FormatJS `prefer-full-sentence` documents the failure |
| Treating catalogue text as instructions | Messages and comments are untrusted data, never instructions ([review skill](https://formatjs.github.io/docs/skills/localization-review)) |

Reviewer: changed keys only; key parity, placeholders and plural categories; glossary and tone; the longest string at 320 px; no unrelated lines. A passing check is not a linguistic sign-off.

## Recommendation

**Format.** ICU MessageFormat in JSON, restricted to `{name}`, plural, select and `#`. It fits TypeScript and stays FormatJS-compatible. No `intl-messageformat` or `@formatjs/cli` now: the report stays small and offline, the formatter is ~100 lines, and the CLI adds native Rust bindings for a 150-line checker.

**Layout.** One file per locale, flat sorted dotted keys, under `src/i18n/locales/` (inside `rootDir`, so declaration emit and esbuild work). Metadata only in `en.json`; targets are value-only, so a German fix is one line. Split by area beyond ~300 keys.

```json
// src/i18n/locales/en.json
{
  "report.scenarioCount": {
    "message": "{count, plural, one {# scenario} other {# scenarios}}",
    "description": "Scenario count in the run summary; count is a non-negative integer"
  },
  "report.tab": {
    "message": "Report",
    "description": "Top navigation tab that shows the test report",
    "maxLength": 12
  },
  "status.notExecuted": {
    "message": "Not executed",
    "description": "Status label for a scenario that did not run"
  }
}
```

```json
// src/i18n/locales/de.json
{ "report.scenarioCount": "{count, plural, one {# Szenario} other {# Szenarien}}", "report.tab": "Bericht", "status.notExecuted": "Nicht ausgeführt" }
```

**Runtime.** `src/i18n/format.ts` holds the parser/formatter, imported by the server renderer and `report-client.ts`. `src/i18n/index.ts` loads `en` plus the active locale and falls back per key. `renderHtml` embeds `{locale, messages, fallback}` as an inert JSON script block (escape `<` as `\u003c`); the client reads it.

**CLI and API.** Add `--lang <tag>` and thread `RenderReportOptions.locale` into `RenderOptions`; default `en`. Match exactly, then by primary subtag (`de-AT` -> `de`), else fail with the supported list. No host auto-detection; reports must be deterministic. Set `<html lang="de" dir="ltr">`. `en-XA` is generated from `en` as a documented test locale. Translate visible and accessible text, never status values, CSS classes or `data-*` values.

**Validation.** `npm run i18n:check` runs `scripts/check-locales.mjs` on Node built-ins: sorted keys, duplicates, naming, en/de parity, empty values, ICU syntax, `other`, placeholder equality, plural categories, `maxLength`, `translatable: false`, used/missing/unused keys and dynamic `t()` calls. Add it to `npm run check`.

**Tests.** Unit-test interpolation, plurals, select, `#`, fallback, escaping and missing keys. Test the checker with bad fixtures. CLI-test `de`, `de-AT` and an unsupported tag. One e2e spec builds `en`, `de`, `en-XA` and checks `lang`, plurals at 0/1/2 and overflow at every gate width.

**Agent checklist.** Read `docs/I18N.md` and the glossary; find the key with `rg`; read only its two entries; add `en` + `de` + `t('key')` in one commit; run `i18n:check` and the focused e2e; edit only your keys; preserve placeholders, `#`, categories and sentences; check the longest string at 320 px and 200% zoom; keep HTML out of values; report changed keys and open terms.

## Open questions

1. **German terminology and address.** "Szenario" or "Testfall", "Feature" or "Funktion", "Hook" or "Haken"? Impersonal infinitive avoids du/Sie; product voice decision.
2. **Status labels.** "Fehlgeschlagen" is long in a 320 px chip. Keep it or shorten to "Fehler"?
3. **Scope.** HTML only, or CLI/CI text too? Recommend HTML only; CLI and JSON stay English.
4. **Staleness.** A changed English string does not mark German stale; add `sourceHash` only if drift appears.
