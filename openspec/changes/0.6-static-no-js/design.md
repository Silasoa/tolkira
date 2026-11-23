# Design

## Seam

`RenderReportOptions` gains `static?: boolean` (default `false`). The CLI
validates `--static` and passes it through `generateReport`/`renderReport`; the
stream gets the same option for parity. `renderHtml` resolves it once into a
small render mode and passes it to the three views. No model, summary, catalog
or input change.

The mode is a shell/DOM switch, not a second renderer:

- `html.ts`: omit the tab bar, the lightbox dialog, both inline scripts and the
  `application/json` client-message block; the CSP then has `script-src 'none'`.
- `report.ts`: emit `open` on every feature, scenario and hook-group `<details>`
  and on the earlier-attempts block; omit the search/filter toolbar, the
  copy-failure button and the image lightbox button while keeping the image;
  drop `role="tabpanel"` and the dangling `aria-labelledby="view-report"` from
  the Report panel while keeping `id="report-view"` and its `<main>`.
- `attachments.ts`: open the text-attachment `<details>` and drop the image
  lightbox button wrapper.
- `triage.ts`: open the triage rest `<details>`; the triage box already renders
  open.
- `details.ts` / `trends.ts`: remove `hidden`, the `tabpanel` role and the
  `aria-labelledby` from the panel; use a plain container instead of a second
  `<main>`. Keep the `tabPanel` class and the `analysis-view`/`trends-view` IDs
  so the panel styles and the print page-break rule still apply.

The default path is untouched: every branch is `static ? ... : ...`, and the
existing characterization hashes must stay green.

## DOM and accessibility

A static document has:

- no `<script>`, no tab bar and no `role="tab"`/`role="tabpanel"`;
- exactly one `<main>`: the Report view keeps it; Details and Trends use a
  `<div class="shell analysis">` inside a plain panel;
- every `<details>` with `open`, so passed scenarios, hooks, earlier attempts,
  text attachments and the triage rest list are visible without a click;
- the lightbox removed; full images are visible inside the open detail bodies,
  and no thumbnail button is rendered;
- no copy-failure button and no search, tag, status or preset filter control;
- no `aria-labelledby` or `aria-controls` that points at a removed element;
- the same headings, counts, tables, status text and localized labels as the
  default report.

The views are read top to bottom: Report, Details, Trends. The tab bar is
removed because it would claim a selection that no longer exists. The dead
controls are removed instead of left inert: an inert button or filter claims an
action the static report cannot perform.

Print and PDF follow the existing print CSS. The page-break rule is keyed by
`#analysis-view, #trends-view`, not by `.tabPanel`, so keeping the three IDs is
what keeps each view on a new page. With no `hidden` panels and no scripts, the
active print includes every section. The PDF engine sets lazy images eager, so
screenshots below the fold still print.

A bookmarked filtered URL (`?query=`, `?hide=`, `?tag=`) opens the full static
report: the parameters are ignored because no script restores them.

## Security and size

The CSP keeps `default-src 'none'`, `img-src data: blob:`, `media-src data:
blob:`, inline styles and `font-src data:`, sets `script-src 'none'`, and keeps
`connect-src 'none'` with no allowed source. There is no client script and no
network request. Attachments are still escaped and rendered by the existing
attachment renderer.

The static output removes the client bundle, the print script, the client
message block, the tab bar, the toolbar, the copy-failure button and the
lightbox, and adds one `open` attribute per `<details>`. The net size is
measured for the standard fixtures and recorded in the tasks; no new CSS is
added. The client bundle artifact is still built and stays under its 16 KB
budget because the default report still uses it.

## Failure modes

- `--static` without `--out` or `--pdf`: usage error (2), nothing written.
- `--static` with `--json`/`--ci`/`--email` but no report surface: the same
  usage error.
- `--static --baseline` with a valid baseline: both apply; the baseline panel is
  server-rendered and visible without JavaScript. The baseline change lands last
  and owns the interaction; this change pins the composition.
- A report with no history: no Trends section; Report and Details are visible.
- A report with history but fewer than two runs: no Trends section, matching the
  default tab rule.
- A PDF engine failure: the existing PDF failure path; the report stays.

## Tests

- Unit: a static render of the standard fixture has no `<script>`, no tab
  roles, no dangling `aria-labelledby`/`aria-controls`, no `hidden` panel, one
  `<main>`, every `<details>` open (feature, scenario, hook group, earlier
  attempts, text attachment, triage rest), no toolbar, no copy-failure button,
  no image button or lightbox, and the CSP `script-src 'none'` with
  `connect-src 'none'`; a default render keeps the scripts, the controls and
  collapsed passed rows, and its three `<main>` elements.
- Unit: a report with two history runs shows the Trends section in static mode;
  no history or one run omits it.
- Browser: static report with JavaScript disabled at 320, 390, 768, 1024 and
  1440 px and 320 px at 200 % text; no horizontal overflow; all sections and a
  screenshot visible; a bookmarked `?query=`/`?hide=`/`?tag=` URL shows the full
  report; print includes all sections; German labels.
- Characterization: the default HTML hashes are unchanged, including the three
  `<main>` elements.
- PDF: `--static --pdf` produces a PDF whose source has no scripts and includes
  the Details/Trends sections.
- Combined: `--static --baseline` renders the static report with the comparison
  panel visible and no scripts (verified after the baseline change lands).
- Size: record the static and default bytes for the standard fixture.

## Risks

- The default report already has three `<main>` elements; that is a pre-existing
  defect, not this change's. It stays unchanged and is recorded as B-048 with a
  trigger. The static mode has exactly one.
- Removing the tab bar changes the DOM contract; tests that query tab buttons
  must use the default mode. The static mode has its own expectations.
- The mode is explicit. A host that blocks scripts still needs the user or CI to
  pass the flag; no detection is attempted.
- The compat shim treats `static` as an unknown legacy option: it warns once and
  ignores it, like every other unknown key.
- The inert toolbar/copy controls are gone, so the static document no longer
  carries controls that do nothing. No open question remains.

## ADRs

- [ADR 0005](../../../docs/adr/0005-server-rendered-shell.md): the shell is
  server-rendered; the static mode is another shell form, not a client app.
- [ADR 0006](../../../docs/adr/0006-inline-attachments.md): images stay inline
  and offline; the lightbox is the only removed viewer.
- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md): no new
  dependency.

## Open questions

None. Decided: the name is `--static`; the dead controls are removed; the
`data-*` client attributes are kept where the control remains; `--pdf` does not
default to static mode.

## Out of scope

- CSP repair, a server, a viewer, a print button, custom page numbers, a second
  renderer, a new dependency, schema/catalog changes, or any change to the
  default report bytes.
- Restoring search, filters, copy or the lightbox in the static report.

## Rollout order

D1: early-size → history → static → baseline. This change lands third; the
baseline change lands last and owns the `--static --baseline` interaction.
