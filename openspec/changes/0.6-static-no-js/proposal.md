# 0.6-static-no-js

## Why

B-042 asks for a static all-expanded no-JS mode. No remote issue exists; B-042
is the local backlog row. Without JavaScript the current report still shows the
active Report view and native `<details>` still work, but the tabs, search,
filters and lightbox are inert, passed scenarios stay collapsed, and
Details/Trends stay hidden. A reader on a host that blocks scripts, or an
archivist who wants one expanded document, cannot see the whole run without
clicking every row.

This is a report form, not a CSP fix: a static report still cannot repair CSS or
`data:` images blocked by a host CSP. It makes the report readable when scripts
are blocked or deliberately off.

## What Changes

- Add an opt-in `--static` report mode and a matching API option. It requires
  `--out` or `--pdf`; the default report is unchanged.
- The static report contains no `<script>` element, no client-message block and
  no print script; its CSP uses `script-src 'none'` and keeps `connect-src
  'none'` with no allowed source.
- Every `<details>` is open, including passed scenarios, hook groups, earlier
  attempts, text attachments and the triage rest list. Report, Details and
  Trends render as stacked visible sections; the tab bar, tab roles, lightbox,
  copy-failure buttons and the search/filter toolbar are gone.
- The static document has exactly one `<main>`; Details and Trends use ordinary
  containers and keep the `report-view`, `analysis-view` and `trends-view` IDs.
  Images render inline in the open details.
- `--static --baseline` composes: the comparison panel is server-rendered and
  visible without JavaScript.
- The default report keeps its bytes, its client bundle budget, its current
  no-JS behaviour and its pre-existing three `<main>` elements. The default
  multiple `<main>` defect is recorded as B-048 and is not fixed in this release.

## Rollout order

D1: early-size → history → static → baseline. This change lands third; the
baseline change lands last and owns the `--static --baseline` interaction.

## Impact

- Capability: `report-rendering`.
- Code: `src/cli.ts`, `src/options.ts`, `src/index.ts`, `src/render/html.ts`,
  `src/render/report.ts`, `src/render/details.ts`, `src/render/trends.ts`,
  `src/render/attachments.ts`, `src/render/triage.ts`.
- Tests: a static render unit suite, the default characterization hashes, a
  no-JS/print browser spec, a `--static --baseline` composition case and a PDF
  case.
- Docs: `docs/AGENT-INTERFACE.md` (the static no-JS paragraph that still says
  the inert control stays), `docs/ARCHITECTURE.md`, `docs/CI.md` (Jenkins
  note), `docs/LIMITATIONS.md`, `docs/PRODUCT.md`, `GLOSSARY.md` and
  `docs/BACKLOG.md` at archive time.
- No new catalog key, schema, dependency, network request or always-on CSS.

## Out of scope

- Fixing CSS or `data:` images blocked by a host CSP; restoring scripts.
- Auto-detecting a blocked host and switching the mode; a server or viewer.
- A print button, custom page numbers or a second print pipeline.
- Restoring search, filters, copy or the lightbox in the static report.
- Changing the default report, its three `<main>` elements or the JSON/CI/email
  bytes.

## Decisions

- The name is `--static` (API `static`).
- The dead controls are removed, not left inert.
- The `data-*` client attributes stay where the control remains.
- `--pdf` does not default to static mode; the mode is explicit.
