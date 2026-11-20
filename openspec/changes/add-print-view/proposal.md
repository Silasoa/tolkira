# Proposal

## Why

Users want a printable copy of a run. A hosted report or a PDF service is out
of scope, but every browser can print the self-contained report to PDF today.
The current print output is poor: it captures only the open tab, keeps the
interactive toolbar and tab bar, leaves closed features collapsed and clips the
wide tables. The localisation research selected print CSS as the first #13
slice: cheap, offline, no dependency and no new delivery format.

This slice is an **archival print of the complete report by default** (all views
and details; an active filter still narrows the Report view), not the concise
summary the issue title mentions; the failures-only filter plus print is the
archival short route in this slice, and the concise email/PDF summary belongs to
#13b. The scope decision is confirmed with the user before TDD-Red.

## What Changes

- Add a `@media print` stylesheet: hide the tab bar, toolbar, search, filters,
  copy/expand/lightbox controls; use a light page palette; keep status colours
  legible; remove horizontal table scrolling; add page-break rules and start
  each view on a new page.
- Add a small static `beforeprint`/`afterprint` print script as a second
  hashed inline script: print the Report, Details and Trends panels and open
  every closed `<details>`; restore the previous panel, detail and lightbox
  state in browsers that fire `afterprint`, with the print-only reveal scoped so
  a missed event cannot stack panels on screen.
- Keep the no-JS fallback honest: the active view prints with the chrome hidden;
  closed details stay closed. The documentation states the limit.
- Keep the report one file, offline and dependency-free; the interactive client
  bundle stays within its 16 KB budget and the print lifecycle rides in the
  separate inline script. No new catalog strings and no server/PDF engine.

Out of scope: email HTML (#13b), a server-side PDF engine (#13c), a print
button or custom print dialog, per-page headers/footers or page numbers, a
forced landscape page, and print-specific filtering beyond the current search
and filter state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: add the print view, the beforeprint/afterprint state and
  the print CSS constraints.

## Impact

- `src/render/report.css` (print block), generated `src/render/styles.ts`,
  `src/render/print-script.ts` (static print lifecycle), `src/render/html.ts`
  (print script embed and German print overrides in `localeCss`), generated
  `src/render/client-bundle.ts` (back to its baseline), tests and e2e,
  `README.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`,
  `docs/COMPATIBILITY.md`, `docs/CHANGELOG.md`, `docs/PRODUCT.md`,
  `docs/BACKLOG.md`.
- No new runtime dependency, no CLI/API change, no network access, no summary
  or CI change. The screen output stays visually unchanged; the embedded CSS,
  the added print script and the second CSP hash move the English
  goldens/hashes intentionally.

## Review gate

PIR and DXR before implementation; implementation is a TDD pair; review swarm is
SCR, CR, DAR, UXR and CMP, plus PCA for the print of large reports and the
client/CSS budget. ILA is not triggered (no new strings); SEC is not triggered
(no new input or trust boundary). Refs #13 (print slice).
