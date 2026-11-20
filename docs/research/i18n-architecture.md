# i18n architecture for the Tolkira report

Research note, 2026-11-20, `main` at `9327e0c` (`0.3.0`). Scope: German first,
agent-translatable catalogs, no package or 16 KB client-script bloat. Issue #12
requires German and English, a fallback locale, no 320 px regressions, and docs
([#12](https://github.com/Silasoa/tolkira/issues/12)).

## Constraints that decide the design

- The report is server-rendered into one HTML string; the browser script only
  filters, tabs and copies ([`docs/ARCHITECTURE.md`](../ARCHITECTURE.md),
  [`src/render/html.ts`](../../src/render/html.ts)).
- The client bundle is currently **14,437 bytes against a 16,000-byte budget**
  ([`scripts/build-search.mjs`](../../scripts/build-search.mjs)).
- Official Node 22+ binaries ship full ICU, so `Intl.NumberFormat`,
  `Intl.DateTimeFormat` and `Intl.PluralRules` cover every locale without the
  app bundling CLDR data ([Node.js Intl docs](https://nodejs.org/api/intl.html)).
- The package declares three runtime dependencies; a fourth needs a written
  reason ([`package.json`](../../package.json), [`AGENTS.md`](../../AGENTS.md)).

## Option comparison

| Option | Plural / select / gender | Numbers and dates | Fallback and negotiation | Added runtime (min / gzip) | Verdict |
| --- | --- | --- | --- | --- | --- |
| Plain catalog + `t()` | `Intl.PluralRules` categories via `key.one`/`key.other`; select via key variants | Native `Intl` at the call site | Per-key lookup, app-owned | **475 B / 316 B** | Smallest; covers this UI |
| ICU MessageFormat runtime (`intl-messageformat`) | Full ICU `plural`, `select`, `selectordinal` ([FormatJS](https://formatjs.github.io/docs/intl-messageformat/)) | Native `Intl`; no CLDR bundled | Locale resolution via `supportedLocalesOf` | **34.5 KB / 10.3 KB** | Feature-heavy, 30x the need |
| ICU precompiled AST | Same as ICU | Same | Same | **8.7 KB / 3.0 KB** | Cheaper, needs a build step |
| Fluent (`@fluent/bundle`) | Numeric selectors match CLDR plural categories ([Fluent selectors](https://projectfluent.org/fluent/guide/selectors.html)) | `NUMBER()`/`DATETIME()` over native `Intl` ([fluent-bundle](https://github.com/projectfluent/fluent.js/tree/main/fluent-bundle)) | One bundle per locale; negotiation is app code or `@fluent/langneg` | **11.7 KB / 4.3 KB** | Second syntax for translators |
| i18next | CLDR suffixes via `Intl.PluralRules`; without `Intl`, only English-style forms resolve (v24+) ([i18next](https://www.i18next.com/translation-function/plurals)) | `Intl` formatters | `fallbackLng` chain, namespaces, plugins ([config](https://www.i18next.com/overview/configuration-options)) | **50.2 KB / 16.1 KB** | Overkill for a static file |
| Compile-time extraction | None by itself | — | — | Build tooling only | Does not remove a runtime |

Two notes. FormatJS `extract` targets descriptor calls, not template-literal
HTML ([CLI](https://formatjs.github.io/docs/tooling/cli)), so it would force
every call site into a descriptor; extraction produces catalogs, not a smaller
runtime. Precompiled ICU reaches 3.0 KB only by aliasing the parser to
`no-parser.js` ([FormatJS](https://formatjs.github.io/docs/intl-messageformat/)),
and `@formatjs/cli compile` needs native Rust bindings per OS/arch
([CLI](https://formatjs.github.io/docs/tooling/cli)), adding CI matrix friction
for a 200-string catalog.

### Measured sizes

Method: throwaway directory outside the repo; esbuild 0.28.2, minified browser
ESM, gzip 9; Node 26.13.1. Catalog: 136 German strings modelled on the current
UI. Measured:

| Artifact | min | gzip |
| --- | ---: | ---: |
| Plain helper (lookup, interpolation, `PluralRules`) | 475 B | 316 B |
| `intl-messageformat` 12.2.0 | 34,450 B | 10,286 B |
| `intl-messageformat` AST + no-parser | 8,653 B | 2,955 B |
| `@formatjs/intl` 6.2.0 | 46,492 B | 13,487 B |
| `@fluent/bundle` 0.19.1 | 11,747 B | 4,291 B |
| `i18next` 27.2.2 | 50,229 B | 16,078 B |
| 136-string German catalog (JSON) | 4,783 B | 1,661 B |

Unpacked registry sizes: `intl-messageformat` 117 KB, `@formatjs/intl` 116 KB,
`@fluent/bundle` 139 KB, `i18next` 608 KB,
`@formatjs/icu-messageformat-parser` 261 KB, `@formatjs/cli` 1.47 MB
([registry](https://registry.npmjs.org/intl-messageformat/latest)).
They would run in Node, so gzip describes install/startup weight, not report
bytes.

At 200 strings the catalog is roughly 7 KB raw / 2.4 KB gzip; at 300, about
10.5 KB / 3.5 KB (linear extrapolation). Longer German text adds roughly
0.6–1.5 KB to a 62–81 KB report — an estimate, since no second locale exists
yet.

## Single-file constraint

| Model | Report cost | Cost to change language | Verdict |
| --- | --- | --- | --- |
| All locales embedded, switch in-page | One catalog per locale in every report | Client must re-render or swap every string; new client code near the 16 KB ceiling | Reject |
| One locale per build (`--locale`) | No catalog; only rendered text | Regenerate the report | **Recommend** |
| Runtime fetch | — | Needs network | Rejected by the product contract |

A switcher is expensive: the HTML is already materialised, so switching means
shipping every catalog plus `data-i18n` and re-rendering, or duplicating the
DOM. One report per locale is deterministic, diffable in CI, and matches the
single-file promise; two languages means running the CLI twice.

Negotiation should be explicit, as #12 requires: `--locale de` or
`RenderOptions.locale`, default `en`, no `navigator.language` (implicit
detection would make identical input produce different artifacts). Resolve with
RFC 4647 lookup — `de-AT` → `de` → `en`
([§3.4](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.4)) — and
canonicalise with `Intl.getCanonicalLocales`
([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/getCanonicalLocales)).
An unknown tag exits 2 with the supported set.

## What to localise

| Surface | Localise? | Why |
| --- | --- | --- |
| Report chrome: tabs, headings, toolbar, filters, buttons, empty states, footer | Yes | Human-facing |
| Accessibility names, `aria-live`, sr-only text | Yes | Same readers |
| Counts, percentages, durations, dates | Format with `Intl` | German needs `1.000`, `42 %`, `0,5 s` |
| `<html lang>`/`dir` | Set from locale | Correct hyphenation, spelling, bidi |
| Test data: feature/scenario/step names, Gherkin keywords, tags, doc strings, tables, error text, attachment names, metadata, URIs | **No** | Translating results would falsify them |
| CLI usage, errors, warnings, exit codes | No | Developers search and paste them |
| `--json` summary and CI Markdown/GitHub text | No | Machine-stable contract for agents ([`docs/AGENT-INTERFACE.md`](../AGENT-INTERFACE.md), [`docs/CI.md`](../CI.md)) |
| Default title `Tolkira report` | No | The title feeds the history hash; changing it per locale splits one run into two history entries ([`src/history.ts`](../../src/history.ts)) |

One string needs splitting: `attachmentWarning()` feeds the report notice and
CLI stderr ([`src/warnings.ts`](../../src/warnings.ts)); localise the report
copy, keep the CLI copy English.

## Recommendation

Use a **typed TypeScript catalog per locale plus a ~30-line helper**, with
native `Intl`. No i18n dependency, no ICU parser, no extraction tooling.

- `src/render/i18n/en.ts` is the source of truth (`as const`); `de.ts` is
  `satisfies Record<MessageKey, string>`, so a missing or extra key fails
  `tsc`.
- `index.ts` exports `SUPPORTED_LOCALES` (`{ tag, direction }`),
  `getCatalog(tag)`, `t(catalog, key, params)` for `{name}` interpolation,
  and `plural(catalog, 'scenario.count', n)` which appends the
  `Intl.PluralRules` category (`other` is always defined in CLDR —
  [TR35](https://www.unicode.org/reports/tr35/tr35-numbers.html#Language_Plural_Rules)).
  Keys use `key.one`/`key.other`; a select/gender helper is five lines and
  should wait for a string that needs it.
- Format at the call site: `Intl.NumberFormat` for counts and percentages,
  `Intl.DateTimeFormat` with `timeZone: 'UTC'` (local time would break
  determinism), and units for durations.
- Inject the ~16 client strings as a JSON map into the inline script through a
  placeholder in `html.ts`; `inlineScriptHashes()` runs after assembly, so the
  CSP hash covers it. The 16,000-byte check stays on the constant; the map is
  per-report data.
- `--locale` and `locale` in `RenderOptions`; no switcher; keep the CLI,
  summary, CI text and errors in English.

**Budget.** About +0.3 KB gzip runtime, +1.7 KB gzip per 136-string locale
(~2.4 KB at 200), +0.6–1.5 KB raw per report, and no catalog in the HTML. The
client bundle stays under 16 KB.

### Failure modes

| Failure | Behaviour | Guard |
| --- | --- | --- |
| Missing key | English, then the key | Key-parity test; typed catalogs |
| Missing plural form | `other` | Test asserts `other` plus the locale's category set |
| Placeholder mismatch | Literal `{name}` shows | Test compares `{…}` sets against `en` |
| RTL | `dir="rtl"` flips text, but CSS is physical (`margin-left`, `border-left`, `text-align: left`, ~25 declarations) | Do not ship an RTL locale before a logical-property pass and browser test ([MDN `dir`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir)) |
| 320 px | Longer German labels hit the fixed `6rem` grid column and `nowrap` rows | Playwright at 320 px and 200 % zoom, per the merge gate |

## Open questions

1. Which locales follow German, and does any require RTL? That triggers the
   CSS pass; `dir` plumbing lands with German.
2. Do we need `de-AT`/`de-CH` vocabulary, or is `de` mapping enough?
3. Who reviews German copy? A native pass on UI labels is still required.
4. Keep the default title stable in every locale, as recommended, or localise
   it and accept the history split?
5. Ship locales inside `tolkira` (+1.7 KB gzip each) or as a separate package?
   One package matches the contract.
