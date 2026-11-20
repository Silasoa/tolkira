# Design

## Context

The report is a server-rendered shell with three tab panels (Report, Details,
Trends), `<details>` for features and scenarios, the client script, a small
static print script and one embedded stylesheet. The screen view is unchanged.
Printing is a CSS mode plus a small static inline script: no model, summary, CLI
or API change.

Approved on 2026-11-20: this slice prints the complete report by default (all
views and details); an active search or filter still narrows the Report view and
is not cleared silently, so the docs say to clear it for the whole run. The
failures-only filter plus print is the failures-only archival print, and the
concise email/PDF summary is #13b. Browser headers/footers stay user-controlled;
a repeated print title is a backlog trigger.

Data flow: the browser calls `beforeprint` -> the print script adds
`body.printing` (a print-media-only CSS rule reveals all panels without touching
their `hidden` state), opens every `<details>` and requests lazy thumbnails
eagerly -> the print CSS lays out the complete report -> `afterprint` removes the
class and restores the panel, detail, image and lightbox state in browsers that
fire it. Without JavaScript the active panel prints; the CSS still hides the
chrome and fits the tables, and a missed `afterprint` leaves the print complete
but cannot stack panels on screen.

## Print CSS

Add a `@media print` block at the end of `src/render/report.css`, after the
dark-scheme rules so it wins for both colour schemes. `src/render/styles.ts` is
regenerated.

- **Palette:** repeat the complete light palette through the existing custom
  properties, including status, `-soft` and all 16 `--ansi-fg-*` values, plus
  `color-scheme: light` and a white body, so printing from dark mode cannot
  render dark chips or logs on white. Status, legend and spark colours keep
  `print-color-adjust: exact` and `-webkit-print-color-adjust: exact`.
- **Chrome:** hide the topbar, toolbar, search, tag filter, filters, preset,
  expand/collapse, copy controls, chevrons and lightbox through explicit
  selectors (`.topbar`, `.toolbar`, `.search`, `.tagFilter`, `.filters`,
  `.filter`, `.presetFilter`, `.expand`, `.copyFailure`, `.copyLog`, `.view`,
  `.lightboxClose`, `.chev`, `.lightbox`); never hide every `button`, because
  screenshots are `button.shotButton > img.shot` and must print. Keep the
  skipped-attachment notice, headings, tags, screenshots and footer. Hide
  `video` and `audio`; the docs say they cannot print.
- **Filter marker:** the existing `#tolkira-live` visible count is `sr` on
  screen; in print make it a normal block above the feature list so a filtered
  PDF is marked. No new key or string. The triage index stays hidden under an
  active filter, as on screen.
- **Layout:** `.shell` max-width none and no horizontal padding; `.runHead` one
  column; `.analysisGrid` one column; the panels stack. `.printing .tabPanel`
  lives inside the `@media print` block, so it reveals panels for print without
  touching their `hidden` attributes and cannot affect the screen if
  `afterprint` is missed.
- **Tables:** `.tableWrap` overflow visible; all print tables get min-width 0,
  width 100%, 8 pt type, reset **child** widths/mins and wrap their cells. The
  feature and matrix tables use `table-layout: fixed`. Unusually wide matrices
  may need landscape; the docs say so.
- **Trends table:** `table-layout: auto` with a 14% date column; headers, status
  pills and the `Current` chip stay nowrap, and the title column wraps. The title
  column is deliberately narrow and wraps titles (accepted).
- **Pagination:** `#analysis-view` and `#trends-view` start on a new page; the
  Report is the first page. `break-after: avoid` for headings, `break-inside:
  avoid` for scenarios, legend rows, table rows and summaries; not on a panel
  or a feature that can exceed a page. `pre`/logs wrap. `@page { margin: 12mm }`;
  the PDF smoke uses `preferCSSPageSize` so the CSS margin is exercised.
- **Lightbox/overflow:** `beforeprint` closes an open lightbox with a guarded
  `close()` (the handler runs when a dialog may not exist) and resets the `html`
  overflow that the dialog sets; `afterprint` restores both.
- **Lazy images:** `beforeprint` sets `loading="eager"` on `img[loading="lazy"]`
  (the data-URI thumbnails), which requests them eagerly; `afterprint` restores
  the lazy state. It does not claim the browser has finished loading them.
- **Browser chrome:** page headers/footers, URL and page numbers stay
  user-controlled in the browser print dialog; the docs warn that the default
  footer can expose local paths and suggest turning it off for shared PDFs.
  Pages after the first have no repeated report title; the browser header can
  supply it, and a print-only repeated title is a backlog trigger.
- **German print:** `localeCss` is appended after `REPORT_CSS` and its
  `:lang(de)` selectors can win on specificity; any German print override lives
  there. `html.ts` is therefore in scope. Verified at A4 width: the German
  history PDF is 6 A4 pages / 161,307 B, and `pdftotext` keeps
  `Fehlgeschlagen`, `Übersprungen`, `Erfolgsquote` and `Aufgezeichnet am`
  intact.

## Print script

`src/render/print-script.ts` exports a static `PRINT_SCRIPT` with no imports.
`renderHtml` embeds it beside the client script as a second static inline
CSP-hashed script; `inlineScriptHashes` hashes both, so the CSP `script-src`
carries the client and print hashes. Keeping it out of the interactive bundle is
what returns `CLIENT_SCRIPT` to 15,268 B with 732 B headroom under its 16 KB
gate. The print script:

```
details = every <details>; lazy = every img[loading="lazy"]; lightbox = .lightbox
beforeprint: if state return; store the originally closed details, whether the
  lightbox was open and the html overflow; add body.printing (the print-scoped
  CSS hook reveals every .tabPanel without touching hidden), open every detail,
  set lazy images eager, close the lightbox with b?.close?.() and reset the html
  overflow.
afterprint: if no stored state return; remove body.printing, re-close the stored
  details, restore lazy, the overflow and the lightbox (only when showModal is
  available); clear the state.
```

`afterprint` is the named restore dependency: the state returns in browsers that
fire it, and the print-only reveal keeps a missed event harmless on screen.

The filter marker is the existing `#tolkira-live` text; no new strings. No new
catalog keys or `DOM_IDS`. `PRINT_SCRIPT` is 716 B inline (950 B source file).
`html.ts` stays under 100 lines and escapes `</script` for both scripts.

The 320 px German rules stay as they are; the print page is wider (A4), so the
German feature chip/status, Trends table and matrix use the existing wide
layout. The print CSS must still be verified with the German report because the
`:lang(de)` screen rules have higher specificity; add print-specific German
overrides in `localeCss` (and only there) where the computed layout needs them.
A 320 px print check asserts the chrome is hidden, the content is present and no
horizontally clipped table remains. `html.ts` is in scope for that.

## Tests

- Unit (13 tests): `REPORT_CSS` contains `@media print`; every `.tableWrap table`
  gets the print fit; all 45 light-palette properties (including all 16 ANSI
  slots) are pinned; the `printing` reveal sits inside the print block;
  `PRINT_SCRIPT` contains the print listeners, selectors and guarded lightbox
  close/restore; the client bundle stays under 16 KB and carries no print
  handler; no catalog key changed.
- Browser (Chromium, Firefox, WebKit): open a report, dispatch `beforeprint`,
  assert every `.tabPanel` is visible, a closed feature/scenario `<details>` is
  open, a lazy thumbnail is eager and an open lightbox is closed, and the active
  tab's `hidden` state was never changed; dispatch `afterprint` and assert the
  previous panel/detail/image/lightbox state.
- Print media: `page.emulateMedia({ media: 'print' })` at a **794 px** viewport
  (A4 at 96 dpi; a ~703 px content width after the 12 mm margins) for layout;
  assert the topbar, toolbar, filters, copy buttons, chevrons and lightbox are
  hidden; screenshots stay visible; the filter count is visible; every
  `.tableWrap` table does not overflow. At 320 px assert chrome hidden, content
  present and no horizontally clipped table.
- German print: the A4-width fixture with history; the labels/numbers are
  unchanged; no new strings; the Trends headers and status pills stay on one
  line, and the `localeCss` overrides do not clip at the A4 content width or
  320 px. The measured PDF is 6 A4 pages / 161,307 B, with
  `Fehlgeschlagen`, `Übersprungen`, `Erfolgsquote` and `Aufgezeichnet am`
  intact under `pdftotext`.
- Dark screen + print: `emulateMedia({ colorScheme: 'dark', media: 'print' })`;
  the body/background is light, a status chip uses the light palette and an ANSI
  log with the full 16-colour slots does not use the dark colours.
- No JS: `javaScriptEnabled: false`, print media; the Report is visible, the
  Details/Trends are hidden, the chrome is hidden, closed details stay closed.
- PDF smoke: `test.skip(browserName !== 'chromium')`, guarded explicit
  `beforeprint`, `page.pdf({ format: 'A4', printBackground: true,
  preferCSSPageSize: true })`; assert `%PDF` and at least three page objects
  (Report, Details, Trends) for a known fixture with history. The measured
  English history output is 20 A4 pages / 237,221 B. A long attachment can shift
  the count by one page (20 vs 21), so pagination beyond the ≥3-page smoke stays
  a dated manual check. Chromium `page.pdf` fires `beforeprint` itself; the
  explicit dispatch is defensive and guarded by the script's double-entry
  state.
- The current search/filter state: print media keeps the filtered rows, shows
  the visible-count marker and hides the filter buttons; Details/Trends print
  in full.

## Docs

`README.md` gets a "Print or Save as PDF" section: browser print includes all
views and details with JavaScript, hides the chrome, uses a light palette and
fits the tables; the current search/filter state carries into print and must be
cleared for the whole run; without JavaScript the active Report view prints;
very wide matrices may need landscape; video/audio cannot print, so the result is
a text and screenshot archive; the failed-only filter plus print is the
failures-only archival print, not the #13b summary; the previous state returns
where `afterprint` fires; the browser's header/footer (and its URL, which can
expose local paths) and page numbers are user-controlled and should be turned
off for shared PDFs, which also removes page identity because no repeated title
ships. Replace the stale "printing captures the open tab" sentence. `DESIGN.md`
gets the print mode and state handler; `docs/LIMITATIONS.md` and
`docs/COMPATIBILITY.md` state the boundaries; `docs/CHANGELOG.md` one entry;
`docs/PRODUCT.md` marks the print slice; `docs/BACKLOG.md` triggers for email
(#13b), a PDF engine (#13c), a print button, a repeated print title/page header
and custom page numbers. Record the expected CSS delta (about 2-4 KB per report)
in the gate record.

## Alternatives considered

- **Print the active tab only:** no handler, but an incomplete PDF; rejected.
- **A print button:** new UI, new strings and a catalog key for a browser-native
  action; rejected for the first slice.
- **Override `[hidden]` in print CSS:** would also reveal filtered rows and
  empty states; rejected in favour of the state handler.
- **A PDF engine:** heavy, server-side and order-sensitive for locale/fonts;
  #13c with an ADR.
- **Forced landscape:** not appropriate for every report; the user can pick
  landscape in the print dialog; documented.
- **A separate print HTML:** a second artifact; contradicts the one-file
  default.

## Risks

- `beforeprint`/`afterprint` support varies; without `beforeprint` the active
  view prints with closed details, and without `afterprint` the print-expanded
  details/lazy state persist, but the print-scoped `.printing` rule cannot stack
  panels on screen. Both fallbacks are documented.
- Opening every detail on a very large report costs print time and pages: PCA
  measured 2,000 scenarios at about 5 s and 670 A4 pages, 4,000 at about 21 s,
  and 10,000 at about 2.7 min and 3,337 pages. There is no print cap beyond the
  10 MB warning; large suites are steered to the failures-only print.
- Nearly empty attachment-only content can leave sparse pages; documented as a
  known cosmetic limit.
- The A4 matrix may need landscape for unusually wide runs; documented.
- Dark-mode printing must force the light surfaces; the print block sits after
  the dark rules.
- The German `:lang(de)` screen rules can override print layout; verify the
  German print in all engines.
- The print script is a second inline script and CSP hash; keep it small and
  hashed. It sits outside the interactive client budget, which returns to
  15,268 B with 732 B headroom.
