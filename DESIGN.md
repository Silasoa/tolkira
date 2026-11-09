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
| Top bar / tabs | `.topbar`, `.view` | Report and Details; active tab is a text state, not a card |
| Run header | `.runHead`, `.health` | Title, metadata, pass rate, segmented status bar |
| Toolbar | `.toolbar`, `.search`, `.filter` | Search and status filters; search opens matching features and scenarios; filters only for present statuses |
| Triage index | `.triage` | Needs-attention rows with status text, counts and up to three scenario links; five rows visible, up to fifteen more behind a disclosure |
| Source strip | `.sources` | Per-input cards for multi-file runs with real provenance; status, counts and a proportion bar; hidden below 560 px, where the feature source badge remains |
| Feature | `details.feature` | Native disclosure; status, name, counts, proportion bar, source badge, URI |
| Scenario | `details.scenario` | Fixed thumbnail gutter, status, name, tags, steps, duration |
| Step | `.step` | Status glyph plus screen-reader label, keyword, text, error, doc string, focusable table, attachments |
| Attachment | `.shot`, `.fileText`, `.fileLink` | Images inline; text in `<pre>`; binary as download; alt names the scenario and step |
| Details | `.analysis` | Feature-by-status matrix, status distribution, Run / Cucumber environment / Custom metadata blocks, agent summary |

## Interaction rules

- Feature and scenario summaries are the only click targets that toggle; a
  click inside the detail does not close it.
- Chevron rotates on open; `prefers-reduced-motion` removes the transition.
- Search and filters: hide non-matches and open matching features; search also
  opens matching scenarios, update a polite live region, show an empty state
  when nothing matches.
- Switching tabs scrolls to the top; the previous panel's scroll position is
  not restored.
- The lightbox locks background scrolling, restores focus to its trigger on
  Escape, Close, backdrop click and padding click, and reserves header space so
  Close never covers the screenshot.
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
   `src/render/html.ts` and `src/render/styles.ts`.
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
- empty state for search/filter results;
- screenshot lightbox with a close button and Escape support.

CSS lives in `src/render/report.css`; `scripts/build-styles.mjs` generates
`src/render/styles.ts` for the inline report.

Still open: charts/trends in Details and optional map/compact lenses.

## Non-goals

- React, Tailwind, Bootstrap, jQuery, CDN fonts or charts.
- Old reporter themes.
- A server, watch mode, telemetry or test-management workflows.
- Right-click-only context menus.
