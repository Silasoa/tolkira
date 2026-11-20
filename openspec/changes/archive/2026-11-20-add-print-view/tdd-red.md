# TDD-Red record — add-print-view

Date: 2026-11-20. Issue #13, print slice; PIR/DXR fixes are folded into the
change. Scope: failing tests only. No `src/`, docs, config or existing product
test was changed; no characterization hash or golden was updated; nothing was
committed.

## Files written

- `test/render-print.test.ts` (new) — `REPORT_CSS` print block, `PRINT_SCRIPT`
  lifecycle and client-budget contract, and the no-new-catalog-key guard.
- `test/e2e/print.spec.ts` (new) — complete-print state, print media at A4
  width, dark-screen print, no-JS, no-history, German, failed-only and the PDF
  smoke.
- No helper or fixture edit was needed. The reports are built in `beforeAll`
  from existing fixtures; the history sidecar is a per-report copy of
  `test/fixtures/history/two-runs.json`.

Fixture composition:

| Report | Inputs | Purpose |
| --- | --- | --- |
| English, history | `legacy/happy.json`, `legacy/screenshot.json`, `legacy/failed.json`, `messages/attachments-presentation.ndjson` | Closed feature/scenario, tagged scenarios and a lazy thumbnail, failed rows and copy buttons, an ANSI log, a screenshot, three Trends rows. |
| German, history | `i18n/german-testdata.json`, `messages/attachments-presentation.ndjson` | German labels/plurals, a screenshot and the ANSI log at the A4 content width. |
| No history | `legacy/screenshot.json` | Report and Details only; no Trends view or tab. |

The English report deliberately mixes only legacy fixtures plus one Messages
fixture: two Messages fixtures carry duplicate gherkin ids and the loader
rejects the merge (`Duplicate Cucumber Messages gherkin id`), which is a
fixture constraint, not a print contract.

## Pinned print CSS

`REPORT_CSS` (generated from `src/render/report.css`) must contain an
`@media print` block **after** `@media (prefers-color-scheme: dark)`.

- Chrome hidden by explicit selectors: `.topbar`, `.toolbar`, `.search`,
  `.tagFilter`, `.filters`, `.filter`, `.presetFilter`, `.expand`,
  `.copyFailure`, `.copyLog`, `.view`, `.lightboxClose`, `.chev`, `.lightbox`;
  `video` and `audio` are hidden.
- No blanket `button { display: none }`; no `display: none` rule matching
  `.shotButton` or `.shot`, so screenshots print.
- The light palette is repeated with the same values as the first light
  `:root` block: all 45 light-palette custom properties, including `--pass`,
  `-soft` variants, the shared surface/ink/radius/shadow tokens and all 16
  `--ansi-fg-*` slots (`--ansi-fg-0` through `--ansi-fg-15`).
- Both `print-color-adjust: exact` and `-webkit-print-color-adjust: exact`
  appear in the print block.
- The `.printing .tabPanel` reveal sits inside the `@media print` block, not at
  screen level.
- `#tolkira-live` gets a print rule with `position: static` (the `.sr` filter
  marker becomes a normal block); no new string or catalog key.
- `#analysis-view` and `#trends-view` use `break-before: page`; `@page` sets
  `margin: 12mm`.
- All print tables inside `.tableWrap` reset `min-width: 0`, use `width: 100%`
  and 8 pt type; a child `th`/`td` rule resets `min-width` or width.
- The feature and matrix tables stay `table-layout: fixed`.
- The Trends table uses `table-layout: auto` with a 14% date column, nowrap
  headers, status pills and `Current` chip, and a wrapping title column. The
  narrow title column is accepted.

## Pinned print script

`PRINT_SCRIPT` (`src/render/print-script.ts`, a separate static inline script)
contains `beforeprint` and `afterprint`, `printing` (the body class that reveals
the panels), `.lightbox`, an `img[loading=…lazy…]` selector, `eager`,
`documentElement.style.overflow`, `close?.()` and the guarded `showModal`
restore. `CLIENT_SCRIPT` stays under 16,000 bytes and contains none of the print
lifecycle. No catalog key changed (the `client.*` key set stays at 19 entries,
and no key matches `/print/i`).

The browser spec pins the behaviour: `beforeprint` makes every `.tabPanel`
visible without changing the active panel's `hidden` attribute, opens closed
feature/scenario `<details>`, changes lazy images to `eager`, closes an open
lightbox (guarded) and releases the `html` overflow; `afterprint` restores the
panel, details, lazy loading, lightbox and overflow state in browsers that fire
it, and the print-scoped reveal keeps a missed event from stacking panels on
screen.

## E2E print contracts

- **State:** initial Report tab, closed feature/scenario, lazy thumbnails and an
  open lightbox all change for print and return afterwards.
- **Print media:** 794 px for chrome and screenshots; 703 px (794 minus the two
  12 mm margins) for the stricter matrix/Trends overflow check
  (`scrollWidth - clientWidth <= 1`) and no document overflow; 320 px asserts
  hidden chrome, present content and no clipped table.
- **Table layout:** the feature and matrix tables use fixed layout. The Trends
  table uses auto layout with a 14% date column, nowrap headers/status
  pills/`Current` chip and wrapping titles.
- **Dark screen + print:** sample relative luminance through a 1×1 canvas.
  Light screen: body/chip/ANSI panel light, ANSI ink dark. Dark screen: the
  opposite. Dark print: light body/chip/ANSI panel and dark ink again, with all
  16 ANSI foreground slots in the light palette.
- **No JS:** `javaScriptEnabled: false`, print media; Report visible, Details
  and Trends hidden, topbar/toolbar hidden, a closed feature stays closed and
  the screenshot stays visible.
- **No history:** Report and Details print, `#trends-view` and the Trends tab do
  not exist.
- **German:** German footer, plural counts (`2 Features`,
  `3 Szenarien mit Ergebnissen`), `Laufdetails`, `Feature-Statusmatrix`,
  `Aufgezeichnete Läufe`, `3 Läufe`; no `print` catalog key in the embedded
  client block; no matrix, Trends or document overflow at 703 px or 320 px;
  headers and status pills do not split. Manual PDF check: 6 A4 pages /
  161,307 B, with `Fehlgeschlagen`, `Übersprungen`, `Erfolgsquote` and
  `Aufgezeichnet am` intact under `pdftotext`.
- **Failed-only:** the preset stays active, only failed rows are visible, the
  `#tolkira-live` marker is `position: static` and wider than 1 px, and Details
  and Trends still show their full content.
- **PDF smoke:** Chromium only, because `page.pdf` does not exist in Firefox or
  WebKit. Chromium `page.pdf` fires `beforeprint`; the spec still dispatches it
  explicitly as a guarded, idempotent pre-step. It asserts `%PDF` and at least
  three `/Type /Page` objects (Report, Details, Trends) for the history fixture.
  The measured English history output is 20 A4 pages / 237,221 B. The long
  attachment can fragment pagination by one page (20 vs 21), so pagination
  beyond the smoke remains the dated manual check named in the design.

## Red commands and observed failures

```
npx vitest run test/render-print.test.ts
```

Result: 1 file failed; **9 failed, 1 passed** at the initial Red run.

The final suite holds **13/13**: the client/print split added the lifecycle
test, and review coverage added the every-`.tableWrap`-table test and the
print-only reveal test. The Red failures were unchanged; the added contracts
passed after implementation.

| Test | Observed failure | Right reason |
| --- | --- | --- |
| `ships a print media block after the dark-scheme palette` | `print block: expected -1 to be greater than -1` | `REPORT_CSS` has no `@media print` at all. |
| `hides the interactive chrome by explicit selector` | `REPORT_CSS has no @media print block` | There is no print block to hold the chrome rules. |
| `does not hide every button and keeps screenshots printable` | same | No print block exists yet. |
| `repeats the light status and ANSI palette in print` | same | No print palette exists yet. |
| `keeps colours exact … print-color-adjust` | same | No print block exists yet. |
| `turns the visible-count filter marker into a printable block` | same | No `#tolkira-live` print rule exists yet. |
| `starts the Details and Trends panels on a new printed page` | same | No page-break or `@page` rule exists yet. |
| `fits the matrix and Trends tables to the printed page` | same | No print table rules exist yet. |
| `stays inside the client budget and listens for print events` | `expected '"use strict";…' to contain 'beforeprint'` | The client has no print lifecycle handler yet. |
| `adds no catalog key for the print view` | **passed** | The guard is green before implementation; it must stay green after it. |

```
npx playwright test test/e2e/print.spec.ts --project=chromium
```

Result: **8 failed (8)**, 0 skipped on Chromium.

| Test | Observed failure | Right reason |
| --- | --- | --- |
| `opens the complete report for print and restores the previous state` | `#analysis-view` still `hidden` after `beforeprint` | The client does not open the panels/details yet. |
| `prints without interactive chrome and fits the A4 tables` | `.topbar:visible` count is `1` | The print block does not hide the chrome yet. |
| `prints the light palette from a dark screen` | `printed body stays light`: luminance `0.0049` (dark paper) | The print block does not repeat the light palette yet. |
| `prints the active Report without JavaScript` | `.topbar:visible` count is `1` | The no-JS print still shows the chrome; the print CSS is missing. |
| `prints Report and Details only when the report has no history` | `#analysis-view` still `hidden` after `beforeprint` | The handler does not reveal Details for print yet. |
| `prints the German history report at the A4 content width` | `#analysis-view` still `hidden` after `beforeprint` | Same missing handler; the German labels and counts before it pass. |
| `prints the failed-only filter, its marker and full Details and Trends` | marker position is `absolute`, not `static` | `#tolkira-live` is still the clipped `.sr` element in print. |
| `writes a multi-page A4 PDF with the complete print state` | `#analysis-view` still `hidden` before `page.pdf` | The handler is missing, so the explicit `beforeprint` step is a no-op; the PDF is not exercised as a complete report yet. |

## Implementation note (2026-11-20)

Two e2e targeting defects were corrected during implementation without
weakening an assertion:

- `details.feature:not([open])` and `details.scenario:not([open])` stop matching
  once the handler opens the element, so the test could not assert the opened
  state. It now captures the ids and asserts the same feature and scenario.
- `Feature-Statusmatrix` is the matrix region's `aria-label`, not visible text;
  the German test asserts the attribute instead of `toContainText`.

Every print contract in this record still holds, and no assertion was skipped.

### Bundle-headroom follow-up (2026-11-20)

The handler was reduced before review. Panel expansion moved from a script-side
`.tabPanel` query to a `body.printing` class plus
`.printing .tabPanel { display: block !important }` inside the `@media print`
block; the panel `hidden` attributes are never touched, so removing the class
restores the active tab exactly. Only originally closed `<details>` are stored
and re-closed, and lazy images are restored to `lazy` instead of storing each
value. The lightbox close/restore is guarded, and the `html` overflow and
double-entry guard are unchanged. The unit string contract now pins `printing`
instead of `.tabPanel`; the e2e panel/open/restore assertions are unchanged.

### Print script follow-up (2026-11-20)

The lifecycle moved out of the interactive client into
`src/render/print-script.ts`, embedded by `renderHtml` as a second CSP-hashed
inline script. The unit test now checks `PRINT_SCRIPT` for the listeners and
selectors and asserts `CLIENT_SCRIPT` contains none of them; the client bundle
returns to its 15,268 B baseline. The e2e assertions are unchanged.

### Final contract adjustments (2026-11-20)

Review fixes tightened the Red contract without deleting a test:

- The palette contract pins all **45** light-palette properties, including the
  status/soft tokens and all 16 `--ansi-fg-*` slots, at their exact light values.
- `.printing .tabPanel` moved inside the `@media print` block. The active panel's
  `hidden` attribute is still never touched, and a missed `afterprint` now
  cannot stack panels on screen.
- The lightbox close is guarded (`b?.close?.()`) and its restore checks
  `showModal` support, so a report without the dialog cannot throw during print.
- Table fit covers **every** `.tableWrap table`, not only the matrix. The
  feature and matrix tables stay fixed.
- The Trends table uses auto layout with a 14% date column, nowrap headers,
  status pills and `Current` chip, and a wrapping title column. The narrow title
  column is accepted.
- A 320 px print check asserts hidden chrome, present content and no clipped
  table.
- The PDF smoke asserts at least **three** page objects (Report, Details,
  Trends) for the history fixture; Chromium `page.pdf` fires `beforeprint`, and
  the explicit dispatch remains as a guarded, idempotent defensive step. The
  measured English history output is 20 A4 pages / 237,221 B; the long
  attachment can shift pagination by one page (20 vs 21), so pagination stays a
  dated manual check.
- The German history PDF measures 6 A4 pages / 161,307 B; `pdftotext` keeps
  `Fehlgeschlagen`, `Übersprungen`, `Erfolgsquote` and `Aufgezeichnet am`
  intact.
- Coverage explicitly includes the untouched active tab, the open lightbox and
  the full 16-slot ANSI palette in dark-screen print.
- The client-budget test checks the 16 KB limit and the absence of the print
  lifecycle; it no longer pins incidental minified client text.
- Final gate: 13/13 print unit tests; print e2e 34 passed / 2 skipped (PDF
  Chromium-only); full `npm run check` 906 passed / 3 skipped; full e2e 337
  passed / 2 skipped. `PRINT_SCRIPT` is 716 B inline (950 B source file);
  `CLIENT_SCRIPT` stays at 15,268 B with 732 B headroom.

## Notes for the implementer

- The observed failures after the first fixture run were a duplicate gherkin id
  from two Messages fixtures; that was corrected in the fixture list before
  this record. No product code was involved.
- Do not weaken or delete a Red assertion. The palette keys, selector list,
  8 pt table type, 12 mm page margin and 16,000-byte client budget are pinned
  by the approved design.
- The existing English screen output must not change; only the print block and
  hook, the added print script, the CSP hash and the intentional
  characterization/golden updates in task 3.4 move. `client-bundle.ts` returns
  to its baseline.
- Firefox and WebKit will run the browser tests; only the PDF smoke skips there.
  The screen/print media emulation is engine-portable.
