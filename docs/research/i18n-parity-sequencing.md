# i18n parity and sequencing: #12 before #13?

Research note, 2026-11-20, `main` at `9327e0c` (`0.3.0`). Should German UI
(#12) precede PDF/email summary (#13), and how should localisation be designed
so agents add locales cheaply?

## 1. String inventory

One key per distinct user-facing message; plural variants count once; repeated
labels share a key. Test data is excluded.

| Category | ~Keys | Examples |
| --- | ---: | --- |
| Report chrome | 34 | `Report`, `Details`, `Trends`, `Expand all`, `Failed only` |
| Accessibility labels | 18 | `Report views`, `Search scenarios`, `Steps and hooks`, `Not executed` |
| Empty/error states | 9 | `No scenarios in this report.`, `No step definition found.` |
| Details, Trends, matrix labels | 38 | `Run details`, `Test time`, `Recorded`, `Pass rate` |
| Attachment UI | 7 | `Copy log`, `View full size:`, `Screenshot for` |
| Status labels, counts, plurals | 12 | `Passed`...`Unknown`, `N steps`, `N features · M scenarios` |
| Client script | 16 | `X of Y scenarios visible`, `Copied`, `Copy failed`, `URI:` |
| CLI usage/errors/warnings | 26 | usage block, 14 option lines, `--history requires --out` |
| CI/summary output | 20 | Markdown metric labels, `Failed scenarios`, `::error` text |
| **Total** | **~180** | **no message catalog** |

Except `USAGE`, attachment warnings and the status maps, all are inline
literals.

Gaps: `<html lang="en">` is hardcoded and there is no `dir`; `dateLabel()`
hardcodes `YYYY-MM-DD HH:MM UTC`; `durationLabel()` hardcodes `ms`/`s` and dot
decimals; the client cannot read server strings. English is also the test
contract (`render-golden` compares exact HTML), so unchanged English output is
the safest refactor gate.

## 2. Size baseline

| Artifact | Bytes |
| --- | ---: |
| Report, `minimal.json` | 62,524 |
| Report, `all-statuses.ndjson` / `happy.json` | 77,435 / 81,647 |
| Report, `attachments-large.ndjson` | 588,273 |
| Base chrome: CSS 40,358 + script 14,437 + shell 7,725 | 62,520 |
| Client budget (`build-search.mjs`) | 16,000 |
| npm tarball | 423.4 kB, 67 files (1.8 MB unpacked) |

A 180-key locale is roughly 7-9 KB minified, **+11-14% on the smallest
report**. Five locales for a switch cost 35-45 KB; one locale per build is the
cheap default. There are **no `@media print` rules** today.

## 3. Competitor parity

| Tool | UI languages | Switch | Print/PDF/email | Source |
| --- | --- | --- | --- | --- |
| Playwright HTML reporter | English-only JSX labels (`Search tests`, `Settings`) | No locale option | Report folder served by `show-report`; no print stylesheet in the reviewed CSS, no PDF/email documented | [docs](https://playwright.dev/docs/test-reporters#html-reporter), [source](https://github.com/microsoft/playwright/blob/main/packages/html-reporter/src/headerView.tsx) |
| `@cucumber/html-formatter` | English UI | No; customisation is title, icon, CSS, JS | Browser page; no PDF/email documented | [README](https://github.com/cucumber/html-formatter) |
| Allure 2 | Bundled translations; `--lang de` since 2.28.0, plus a report setting | Yes | No PDF export documented; browser print. Allure 3 adds a `mail` plugin for HTML email | [PR #2476](https://github.com/allure-framework/allure2/pull/2476), [Allure 3](https://allurereport.org/docs/v3/configure/) |
| MCHR 4.x | en, es, fr, pt, ar; Arabic RTL | Yes: `language`, CLI `--language`/`--lang` | Email-able report (`--email`); no PDF documented | [README](https://github.com/WasiqB/multiple-cucumber-html-reporter), [options](https://multiple-cucumber-html-reporter.com/docs/options#main-options) |
| ReportPortal | No locale setting documented; English in practice | No | Hosted UI; no static file, print or PDF documented | [docs](https://reportportal.io/docs/configuration/) |
| pytest-html | English; no locale option | No | Self-contained HTML; no PDF/email; browser print | [guide](https://pytest-html.readthedocs.io/en/latest/user_guide.html) |

MCHR makes locale a differentiator; Allure 2 proves `--lang` plus bundled
catalogs. **None of these ships PDF**; email HTML is the established summary
(MCHR, Allure 3), which favours email and print.

## 4. Sequencing #12 vs #13

### What #13 would lock in

| Option | English strings locked | Cost | Reversible? |
| --- | --- | --- | --- |
| Print CSS | Print header/footer, date, page numbers | Small; closed `<details>` need a `beforeprint` expansion | Easy |
| Email HTML | Subject, preheader, table labels, `Open full report` | Small-medium; a second template, since email strips scripts/CSS | Medium |
| PDF engine (`--pdf`) | Page chrome, fonts, direction, hyphenation, break rules, dependency | Large; Chromium-class dependency conflicts with the small surface | Hard |

Only the PDF engine hard-codes English structurally: it snapshots rendered
HTML, so locale, direction and fonts must resolve first. Print CSS and email
are reversible.

### What #12 changes

- `src/i18n/`: typed `en` source of truth, `de`, `translate(locale)`. Missing
  keys fall back to English; a parity test makes fallback a net.
- `locale?: string` in `RenderOptions` and `--locale <bcp47>` in the CLI
  (`de-*` -> `de`); unknown values list supported locales.
- Thread the catalog through the eight render modules and the client subset.
  No model, summary, JSON schema or exit-code change.
- `Intl.DateTimeFormat` (UTC), `Intl.NumberFormat`, `Intl.PluralRules`; machine
  values stay numeric. `lang`/`dir` on `<html>`.
- Serialise ~16 client keys into a JSON `<script>`; the CSP loop already hashes
  every script. Do not bundle a catalog per locale into the client.
- Tests: key parity, English byte-identical, German render, `--json`/`--ci`
  unchanged, mixed-language fixture.

### Recommended order

1. **#12a:** catalog + German report UI; no RTL, switch, CLI/CI. It changes how
   strings are authored, so first avoids double translation.
2. **#13a, print CSS:** cheap and locale-agnostic; add `beforeprint` expansion
   and a German print fixture. Gives "Save as PDF" for free.
3. **#13b, email HTML:** reuse `ReportSummary` and the catalog; add subject and
   preheader keys. No new runtime dependency.
4. **#12b, RTL + switch (conditional):** only if Arabic or in-report switching
   is required. RTL needs logical CSS and all locales embedded; a switch cannot
   fetch (CSP `connect-src 'none'`).
5. **#13c, PDF engine:** only with an ADR and approval; prefer browser
   print-to-PDF unless server-side PDF is proven necessary.

### Minimal #12 slice

- All three tabs, toolbar, status labels, counts/plurals, attachment and a11y
  labels, empty/error states, footer. Exclude CLI/CI, compat shim and test data.
- `--locale de`, default `en`, one locale per report, no switch. English stays
  byte-identical so existing goldens prove no drift.
- Seed German terms in `GLOSSARY.md` (`Szenario`, `Fehlgeschlagen`,
  `Übersprungen`, `Anhang`, `Lauf`).
- Acceptance: parity test; `de` at 320, 390, 768, 1024, 1440 px and 320 px at
  200% in all three engines; `--json`/`--ci` unchanged; delta <= 10 KB;
  `npm run hygiene`, `npm run check`, `npm run test:e2e` green.

## 5. Product risks

- **RTL is not free.** The CSS uses physical `left`/`right`, `text-align`,
  `margin-left` and `border-left` in about 33 declarations, plus a
  right-anchored close button. RTL needs logical properties, mirrored chevrons,
  `dir`, bidi isolation for test data and a chart-direction decision. Do not
  promise Arabic in #12a.
- **Number/date formats.** Trends shows date, counts, pass rate and duration.
  German uses `1.234,5` and `20.11.2026, 14:05`; the code emits `1234.5` and
  ISO UTC. Use `Intl` with `timeZone: 'UTC'`, keep sort keys numeric, test
  decimal separators.
- **320 px and 200% zoom.** German is longer (`Fehlgeschlagen`, `Alle
  ausklappen`). Fixed widths already bite: status badge 3.875rem, scenario grid
  5.5rem + 6rem + 1.25rem, Trends `min-width: 44rem`, matrix `34rem`, plus
  `nowrap` durations. German must wrap or scroll, never clip.
- **Report size.** +7-9 KB per locale is fine; a switch multiplies it. Keep one
  locale per build and embed no fonts; Arabic/CJK then depends on recipient
  fonts, another reason to defer RTL and PDF.
- **Test data is untouchable.** Names, steps, tags, doc strings, tables,
  errors, attachment names, metadata and URIs render verbatim. Add a German
  test-data fixture under an English UI (and vice versa); search and
  copy-failure keep original text.

## Recommendation

**Yes, #12 before #13, but narrow both.** Ship #12 as a catalog seam plus one
German report locale, not a language switch. Then #13's print CSS (small, and
covers browser "Save as PDF"), then an email HTML summary reusing the catalog.
Defer a PDF engine: it hard-codes English chrome, fonts and direction, and adds
the only heavy dependency.

## Open questions

1. Is German the only near-term target, or is Arabic/RTL required? That decides
   whether the CSS logical-property pass is in #12a or #12b.
2. Is per-build `--locale de` enough, or do users need a switch in one shared
   report? A switch needs every locale embedded (+35-45 KB).
3. Should CLI/CI follow `--locale` or stay English for stable logs and agent
   contracts? Recommendation: stay English.
4. Which #13 artifact is actually forwarded: browser print/PDF or an email
   body? Is a PDF engine dependency acceptable at all?
5. German tag and glossary (`de` or `de-DE`/`de-AT`, terms for feature/run/
   attachment); do compat-shim errors stay English?
