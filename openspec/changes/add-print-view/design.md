# Design

## Context

The report is a server-rendered shell with three tab panels (Report, Details,
Trends), `<details>` for features and scenarios, a small client script and one
embedded stylesheet. The screen view is unchanged. Printing is a CSS mode plus a
small DOM-state handler in the client: no model, summary, CLI or API change.

Approved on 2026-11-20: this slice prints the **complete archive** (all views and
details); the short-PDF route is the failed-only filter plus print, and the
concise email/PDF summary is #13b. Browser headers/footers stay user-controlled;
a repeated print title is a backlog trigger.

Data flow: the browser calls `beforeprint` -> the handler remembers the tab and
detail state, opens every `.tabPanel` and `<details>` -> the print CSS lays out
the complete report -> `afterprint` restores the state. Without JavaScript the
active panel prints; the CSS still hides the chrome and fits the tables.

## Print CSS

Add a `@media print` block at the end of `src/render/report.css`, after the
dark-scheme rules so it wins for both colour schemes. `src/render/styles.ts` is
regenerated.

- **Palette:** repeat the complete light palette through the existing custom
  properties, including status, `-soft` and `--ansi-fg-*` values, plus
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
  column; `.analysisGrid` one column; the panels stack.
- **Tables:** `.tableWrap` overflow visible; `.featureTable` and
  `.trendsTable` min-width 0, width 100%, `table-layout: fixed`, 8 pt type,
  wrapping headers/cells and **child** widths/mins reset (the Trends date/title
  columns otherwise keep 10/18/7 rem). Unusually wide matrices may need
  landscape; the docs say so.
- **Pagination:** `#analysis-view` and `#trends-view` start on a new page; the
  Report is the first page. `break-after: avoid` for headings, `break-inside:
  avoid` for scenarios, legend rows, table rows and summaries; not on a panel
  or a feature that can exceed a page. `pre`/logs wrap. `@page { margin: 12mm }`;
  the PDF smoke uses `preferCSSPageSize` so the CSS margin is exercised.
- **Lightbox/overflow:** `beforeprint` closes an open lightbox and resets the
  `html` overflow that the dialog sets; `afterprint` restores both.
- **Lazy images:** `beforeprint` sets `loading="eager"` on `img[loading="lazy"]`
  (the data-URI thumbnails); `afterprint` restores it.
- **Browser chrome:** page headers/footers, URL and page numbers stay
  user-controlled in the browser print dialog; the docs warn that the default
  footer can expose local paths and suggest turning it off for shared PDFs.
  Pages after the first have no repeated report title; the browser header can
  supply it, and a print-only repeated title is a backlog trigger.
- **German print:** `localeCss` is appended after `REPORT_CSS` and its
  `:lang(de)` selectors can win on specificity; any German print override lives
  there. `html.ts` is therefore in scope. Verify the German print at the A4
  width.

## Client handler

Add to `src/render/report-client.ts`:

```
const panels = [...document.querySelectorAll<HTMLElement>('.tabPanel')];
const details = [...document.querySelectorAll<HTMLDetailsElement>('details')];
const lazy = [...document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')];
const lightbox = document.querySelector<HTMLDialogElement>('.lightbox');
let printState: { panels: boolean[]; details: boolean[]; lazy: string[]; lightbox: boolean } | null = null;

beforeprint: if printState return; store hidden/open/loading/lightbox and the
  html overflow style; set panels hidden=false, details open=true, images eager,
  close an open lightbox and reset html overflow.
afterprint: restore the stored arrays, loading attributes, lightbox and overflow;
  clear printState.
```

The filter marker is the existing `#tolkira-live` text; no new strings. No new
catalog keys or `DOM_IDS`. The handler is a few hundred bytes; the client bundle
is 15,268 B with 732 B headroom, so the 16 KB check remains the budget. If it
does not fit, trim the handler rather than raising the budget.

The 320 px German rules stay as they are; the print page is wider (A4), so the
German feature chip/status and the matrix use the existing wide layout. The
print CSS must be verified with the German report because the `:lang(de)`
screen rules have higher specificity; add print-specific German overrides in
`localeCss` (and only there) where the computed layout needs them. `html.ts` is
in scope for that.

## Tests

- Unit: `REPORT_CSS` contains `@media print`; the generated client bundle
  contains the print listeners; no catalog key changed.
- Browser (Chromium, Firefox, WebKit): open a report, dispatch `beforeprint`,
  assert every `.tabPanel` is visible, a closed feature/scenario `<details>` is
  open, a lazy thumbnail is eager and an open lightbox is closed; dispatch
  `afterprint` and assert the previous panel/detail/image/lightbox state.
- Print media: `page.emulateMedia({ media: 'print' })` at a **794 px** viewport
  (A4 at 96 dpi; a ~703 px content width after the 12 mm margins) for layout;
  assert the topbar, toolbar, filters, copy buttons, chevrons and lightbox are
  hidden; screenshots stay visible; the filter count is visible; the print
  tables do not overflow. At 320 px only assert chrome hidden and content
  present (the screen mobile rules are not the page layout).
- German print: the A4-width fixture with history; the labels/numbers are
  unchanged; no new strings; the German `localeCss` overrides do not clip.
- Dark screen + print: `emulateMedia({ colorScheme: 'dark', media: 'print' })`;
  the body/background is light, a status chip uses the light palette and an ANSI
  log does not use the dark colours.
- No JS: `javaScriptEnabled: false`, print media; the Report is visible, the
  Details/Trends are hidden, the chrome is hidden, closed details stay closed.
- PDF smoke: `test.skip(browserName !== 'chromium')`, dispatch `beforeprint`
  explicitly, `page.pdf({ format: 'A4', printBackground: true,
  preferCSSPageSize: true })`; assert `%PDF`, more than one page object and a
  known fixture with history yields at least the Report, Details and Trends
  pages. Pagination is a dated manual check; the PDF API does not fire
  `beforeprint` itself.
- The current failed-only filter: print media keeps the filtered rows, shows
  the visible-count marker and hides the filter buttons; Details/Trends print
  in full.

## Docs

`README.md` gets a "Print or Save as PDF" section: browser print includes all
views and details with JavaScript, hides the chrome, uses a light palette and
fits the tables; without JavaScript the active Report view prints; very wide
matrices may need landscape; video/audio cannot print; the failed-only filter
plus print is the short-PDF route; the browser's header/footer (and its URL,
which can expose local paths) and page numbers are user-controlled and should
be turned off for shared PDFs; no PDF engine, no email. Replace the stale
"printing captures the open tab" sentence. `DESIGN.md` gets the print mode and
state handler; `docs/LIMITATIONS.md` and `docs/COMPATIBILITY.md` state the
boundaries; `docs/CHANGELOG.md` one entry; `docs/PRODUCT.md` marks the print
slice; `docs/BACKLOG.md` triggers for email (#13b), a PDF engine (#13c), a print
button, a repeated print title/page header and custom page numbers. Record the
expected CSS delta (about 2-4 KB per report) in the gate record.

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

- `beforeprint` support varies; the no-JS/unsupported fallback prints the active
  view with closed details and is documented.
- Opening every detail on a very large report costs print time/memory; the
  complete print is the requirement; PCA checks a large fixture.
- The A4 matrix may need landscape for unusually wide runs; documented.
- Dark-mode printing must force the light surfaces; the print block sits after
  the dark rules.
- The German `:lang(de)` screen rules can override print layout; verify the
  German print in all engines.
- The client budget has 732 B headroom; measure after the handler and keep the
  16 KB gate.
