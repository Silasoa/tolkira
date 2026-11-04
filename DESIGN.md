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
- **Density with air.** Compact rows, but never cramped; 16 px body, 12–14 px
  metadata, 11 px minimum for functional text.
- **Accessible by default.** WCAG 2.2 AA, keyboard focus, reduced motion,
  200 % text zoom, no colour-only status, no horizontal page scroll.

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
- Body 15–16 px, line-height 1.5–1.55.
- Row title 13–14 px/600; metadata 11–12 px; step text 12–13 px.
- Sentence case everywhere. No tracked capitals, no emoji icons.
- No fluid display headings in the report shell; fixed rem steps.

## Components

| Component | File / selector | Rule |
| --- | --- | --- |
| Top bar / tabs | `.topbar`, `.view` | Report and Details; active tab is a text state, not a card |
| Run header | `.runHead`, `.health` | Title, metadata, pass rate, segmented status bar |
| Toolbar | `.toolbar`, `.search`, `.filter` | Search and status filters; search opens matching features |
| Feature | `details.feature` | Native disclosure; status, name, path, counts, duration |
| Scenario | `details.scenario` | Fixed thumbnail gutter, status, name, tags, steps, duration |
| Step | `.step` | Marker, keyword, text, error, doc string, table, attachments |
| Attachment | `.shot`, `.fileText`, `.fileLink` | Images inline; text in `<pre>`; binary as download |
| Details | `.analysis` | Feature table, status distribution, environment, agent summary |

## Interaction rules

- Feature and scenario summaries are the only click targets that toggle; a
  click inside the detail does not close it.
- Chevron rotates on open; `prefers-reduced-motion` removes the transition.
- Search and filters: hide non-matches, open features with matches, update a
  polite live region, show an empty state when nothing matches.
- The failure is open by default; everything else is scannable when collapsed.
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
- `undefined` is a distinct status, not a neutral one;
- Details tab with producer, runtime, OS, CPU, protocol and user metadata;
- empty state for search/filter results;
- screenshot lightbox with a close button and Escape support.

CSS lives in `src/render/report.css`; `scripts/build-styles.mjs` generates
`src/render/styles.ts` for the inline report.

Still open: a 200 % text-zoom pass with real content, and charts/trends in
Advanced.

## Non-goals

- React, Tailwind, Bootstrap, jQuery, CDN fonts or charts.
- Old reporter themes.
- A server, watch mode, telemetry or test-management workflows.
- Right-click-only context menus.
