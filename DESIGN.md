# Tolkira report design system

**Mode:** Operate. The report is a work surface for developers and QA, not a
landing page. The tool disappears into the task: find the failure, read the
error, inspect the screenshot, move on.

## Product job

Answer five questions in under thirty seconds:

1. Did everything pass?
2. What failed, and why?
3. What did it look like?
4. Can I find the relevant scenario?
5. Can I share one file with someone else?

The default report is simple and failed-first. Deeper analysis belongs in the
optional Details view, never in the way of the failure.

## Principles

- **One file, no network.** All CSS, scripts and attachments are inline. No
  CDN, no remote font, no telemetry.
- **Status is text, not only colour.** Every status has a label; colour is a
  second signal.
- **Evidence first.** A screenshot or attachment is part of the failure, not
  decoration.
- **Native disclosure.** Use `<details>`/`<summary>` with a visible chevron;
  search and filters open the features that contain matches.
- **Density with air.** Compact rows, but never cramped; 0.9375 rem body,
  0.75–0.875 rem metadata, 0.6875 rem minimum for functional text.
- **Accessible by default.** WCAG 2.2 AA, keyboard focus, reduced motion,
  200 % page zoom and 200 % text zoom, no colour-only status, no horizontal
  page scroll.
- **Test data is not UI copy.** Report chrome comes from the active locale
  catalog; names, steps, tags, errors and attachment content always render
  verbatim.

## Tokens

The source of truth is `src/render/styles.ts` (generated from the report CSS).
Use the token names, never raw colours.

| Token | Role |
| --- | --- |
| `--paper` | Page surface |
| `--canvas` | Page background |
| `--surface-2` | Secondary surface, row hover, panels |
| `--ink` | Primary text |
| `--muted` | Secondary text, labels, captions |
| `--line`, `--line-strong` | Hairline rules and control borders |
| `--accent`, `--accent-soft` | Brand, current selection, primary action |
| `--pass`, `--pass-soft` | Passed |
| `--fail`, `--fail-soft` | Failed |
| `--pending`, `--pending-soft` | Pending |
| `--undefined`, `--undefined-soft` | Undefined / missing step definition |
| `--skipped`, `--skipped-soft` | Skipped |
| `--radius`, `--shadow` | Panel radius and one elevation |

Dark mode is a token override under `prefers-color-scheme: dark`; it never
changes layout.

## Type

- System sans for body and display; system mono only for measurements,
  durations, file paths and error text.
- Body 0.9375 rem, line-height 1.5–1.55.
- Row title 0.8125–0.875 rem/600; metadata 0.6875–0.75 rem; step text
  0.75–0.8125 rem.
- Sentence case everywhere. No tracked capitals, no emoji icons.
- No fluid display headings in the report shell; fixed rem steps.

### Why rem, not fluid type

`rem` ties every text size to the root font size, so the browser's
font-size setting and text-only zoom actually work. Fluid `clamp()`/`vw`
typography is for marketing pages: in a dense report it makes text small on
phones and unpredictable at 200 % zoom.

Fixed `px` stays only where it is not text: 1 px hairlines, focus-ring
thickness, radii and the 1320 px page frame. Spacing, control heights, icon
size, thumbnails and the fixed thumbnail gutter use `rem` so they grow with
the text they sit next to. Media-query breakpoints stay in `px` because they
describe the viewport, not the font.

## Responsive

- Layout responds through content-driven primitives: `minmax()`, `flex-wrap`,
  `max-width`, two breakpoints (900 px, 560 px) and container queries at
  `16rem`. No fixed page width.
- The 720 × 450 browser test is **200 % page zoom** at a 1440 × 900 window, not
  a hardcoded layout size. 320 px and 390 px are separate phone checks.
- Text zoom is tested by doubling the root font size; the layout must reflow
  without horizontal page scroll. At `16rem` container width the feature and
  scenario rows stack and the run title steps down, so text zoom keeps a
  readable title column instead of squeezing it to zero.
- The shell is a document, not an app canvas: it has no viewport-height frame
  and no horizontal scroll region except tables and code blocks. Every
  horizontal scroll region is focusable (`tabindex="0"`, `role="region"`,
  accessible name) so keyboard users can reach clipped columns.

## Components

| Component | File / selector | Rule |
| --- | --- | --- |
| Top bar / tabs | `.topbar`, `.views`, `.view` | Report and Details, plus Trends when the report carries two or more history runs; active tab is a text state, not a card; one scrollable tab row on narrow screens |
| Run header | `.runHead`, `.health` | Title, metadata, pass rate, segmented status bar |
| Attachment notice | `.noticeShell`, `.attachmentWarning` | One shared warning above all views when path attachments were skipped; uses the pending tokens; hidden when the count is zero |
| Toolbar | `.toolbar`, `.search`, `.filter`, `.presetFilter` | Search and status filters; search opens matching features and scenarios; status chips only for present statuses; the `Failed only` preset appears when failed plus another present status, or when an unexecuted row can be hidden |
| Triage index | `.triage` | Needs-attention rows with status text, counts and up to three scenario links; five rows visible, up to fifteen more behind a disclosure |
| Source strip | `.sources` | Per-input cards for multi-file runs with real provenance; status, counts and a proportion bar; hidden at 560 px or narrower. The Report row's source badge hides at 900 px or narrower, so the Details matrix keeps the source label |
| Feature | `details.feature` | Native disclosure; status, name, counts, proportion bar, source badge (file path or `N spec files`), URI |
| Scenario | `details.scenario` | Fixed thumbnail gutter, status, name, tags, steps, duration |
| Step | `.step` | Status glyph plus screen-reader label, keyword, text, error, doc string, focusable table, attachments |
| Attachment | `.shot`, `.fileText`, `.fileLink` | Images inline; text in `<pre>`; binary as download; alt names the scenario and step |
| Details | `.analysis` | Feature-by-status matrix, status distribution, Run / Run environment / Custom metadata blocks, agent summary |
| Trends | `.trendsTable`, `.tableWrap`, `.spark` | Opt-in third view with two or more history runs: newest-first table of recorded time, title, status, passed/failed/skipped counts, scenario total, attempted pass rate and duration, plus a decorative pass-rate sparkline oldest to newest. The newest row is marked `Current`; the table sits in a labelled, focusable region, spans the panel and scrolls at 320 px; the sparkline is `aria-hidden` and skips runs without attempts |

### Renderer modules

- `html.ts` - shell, CSP and `renderHtml` assembly.
- `print-script.ts` - static `beforeprint`/`afterprint` lifecycle, imported only
  by `html.ts` and emitted as a second CSP-hashed inline script outside the
  interactive client bundle.
- `report.ts` - report header, toolbar, features, scenarios, steps, hooks and
  feature-row chrome.
- `details.ts` - Details header, run/environment panels and analysis layout.
- `trends.ts` - Trends header, recorded-runs table and pass-rate sparkline.
- `triage.ts` - needs-attention index and source strip.
- `matrix.ts` - feature-by-status matrix.
- `attachments.ts` - image, text, video, log and file rendering.
- `ci.ts` - CI header and detail rows.
- `format.ts` - status, duration, date, bar, count, health and tag helpers.
- `types.ts` - `RenderOptions`, `DisplayStatus` and `OrderedFeature`.
- `i18n.ts` - locale resolution, catalogs, translator and locale-aware number,
  percent, duration and date helpers; caches `Intl` formatters per translator.
- `client-i18n.ts` - browser formatter for the embedded `client.*` block, with
  every `Intl.PluralRules` category and numeric `#` parameters.

`report.ts`, `details.ts` and `trends.ts` are peers, as are `triage.ts`,
`matrix.ts`, `attachments.ts` and `ci.ts`; a module imports only from a lower
layer.

### Localisation

The visible shell is rendered from `src/i18n/locales/<locale>.json`. `renderHtml`
resolves `locale` once, sets `<html lang>` and `dir`, and passes one translator
to every view. One report carries one locale; there is no in-report switcher.
All visible counts are locale-formatted (English keeps raw digits), on the
server and in the client. The report always embeds the active
`client.*` messages as an inert JSON block; the browser bundle contains no
non-English catalog, and a missing block or key shows the key. Test data,
Gherkin keywords, tags, errors, attachment content and names, metadata and URIs
render verbatim in every locale; the JSON summary and CI text stay English. See
[`docs/I18N.md`](docs/I18N.md) for keys, fallback, the German glossary and the
translation checklist.

## Interaction rules

- Feature and scenario summaries are the only click targets that toggle; a
  click inside the detail does not close it.
- Chevron rotates on open; `prefers-reduced-motion` removes the transition.
- Search and filters: hide non-matches and open matching features; search also
  opens matching scenarios, update a polite live region, show an empty state
  when nothing matches.
- `Failed only` turns off every other present status chip and adds the
  `unexecuted` sentinel to `hide`, so statusless rows hide too; pressing it again
  restores every chip and drops the sentinel. Any manual chip change drops the
  sentinel, and the toggle is pressed only for the exact preset state. Pressed,
  it uses the ink mode style (paper text on ink, pill radius), not the failed
  status colour.
- Switching tabs scrolls to the top; the previous panel's scroll position is
  not restored. Each tab toggles the panel named by its `aria-controls`, so
  Report, Details and the conditional Trends tab share one path; a missing panel
  is ignored.
- Trends shows attempted (non-skipped) pass rates and `—` when a run had no
  attempt. The sparkline is decorative and skips those runs; two points form a
  line only when they are adjacent in time.
- The lightbox locks background scrolling, restores focus to its trigger on
  Escape, Close, backdrop click and padding click, and reserves header space so
  Close never covers the screenshot.
- Print is a CSS mode plus a small static inline script, emitted beside the
  client as a second CSP-hashed inline script; the interactive client bundle
  stays at 15,268 bytes with 732 bytes of headroom under its 16 KB budget.
  `beforeprint` adds `body.printing`; its reveal rule lives inside
  `@media print`, so it cannot change the screen, and `afterprint` removes it.
  The handler stores the originally closed details, the open lightbox and the
  `html` overflow, opens every `<details>`, requests lazy thumbnails eagerly
  (`loading=eager`) and restores the lazy state, closes an open lightbox with a
  guarded `close()` and releases the scroll lock. The active panel's `hidden`
  state is never touched: removing `printing` restores it. `afterprint` returns
  the previous state in browsers that fire it; a missed event cannot stack
  panels on screen because the reveal is print-scoped. The print stylesheet
  hides interactive chrome through explicit selectors (screenshots are buttons
  and must print), repeats the light palette including all 16 ANSI foreground
  slots for dark-mode screens, fits every `.tableWrap` table including the
  German Trends case, and starts each present view on a new page. Without
  JavaScript the active Report prints with its closed state; a print button,
  repeated print title and custom page numbers are deliberately absent.
- Status is never colour-only: scenario badges carry text, step markers carry a
  shape glyph plus a screen-reader label, and forced-colours mode keeps the
  glyph, marker border and disclosure chevron visible.
- The failure is open by default; screenshot-bearing scenarios and their
  features also open; everything else is scannable when collapsed.
- No right-click-only actions; use visible buttons or a `…` menu. Keyboard and
  touch must reach the same actions.
- No modal for a task that inline disclosure can solve.

## Styling policy

**Plain CSS with tokens, not Tailwind.** The report is generated as one HTML
string with inline CSS; Tailwind would add a build step, content scanning of
TypeScript template strings, and safelists for dynamic status classes. The
report has ~20 components and a 15 KB stylesheet. A small, explicit token
system is easier for agents to read, test and change than utility soup in
template strings. A local utility layer is fine when it removes repetition.

## Agent workflow

1. Read `docs/PRODUCT.md`, this file, `src/report/model.ts`,
   `src/render/report.ts`, `src/render/details.ts` and
   `src/render/styles.ts`.
2. Change the view model first if the data is missing; keep `src/summary.ts`
   independent.
3. Use tokens and existing component classes; do not add a UI framework.
4. Add a unit test for the model/HTML and a browser test for the interaction.
5. Render a real fixture at 1440×900 and 390×844; check focus, overflow,
   reduced motion, 200 % text zoom and dark mode.
6. Run `npm run check` and `npm run test:e2e`.
7. For a new visual world, use the Hallmark/Impeccable loop in
   `docs/ui-loop/`; for a normal change, stay inside this system.

## Current status

Direction A is implemented in production:

- warm paper tokens, hairline sections and monospace measurements;
- fixed thumbnail gutter on every scenario row, also on mobile;
- chevrons, failed-first disclosures and search that opens matching features;
- exception-first Report order, a triage index and a source strip;
- feature counts/proportion bars and a feature-by-status matrix in Details;
- `undefined` is a distinct status, not a neutral one;
- Details tab with producer, runtime, OS, CPU, protocol and user metadata;
- Trends tab with an aggregate run table and pass-rate sparkline when the report
  carries two or more history runs;
- English and German report chrome from one catalog, with test data verbatim;
- empty state for search/filter results;
- screenshot lightbox with a close button and Escape support;
- browser print/Save as PDF for the complete text and screenshot archive: all
  views and details by default (an active filter still narrows the Report
  view), light palette, fitted tables and page breaks, with the screen state
  restored where `afterprint` fires and a no-JavaScript fallback for the active
  Report.

CSS lives in `src/render/report.css`; `scripts/build-styles.mjs` generates
`src/render/styles.ts` for the inline report.

Still open: chart lenses in Details and optional map/compact lenses.

## Non-goals

- React, Tailwind, Bootstrap, jQuery, CDN fonts or charts.
- Old reporter themes.
- A server, watch mode, telemetry or test-management workflows.
- Right-click-only context menus.
