# Proposal

## Why

The 0.7 redesign direction chosen on 2026-11-26 is **Incident review**: the
Report view should resolve the first non-passing scenario as an incident above
the index, instead of leaving the failure as a row that is only visible after a
scan or a click. The product job is five questions in under thirty seconds;
the current order answers "did everything pass" and then puts the failing
step, its error and its evidence behind the row's disclosure. The triage block
lists attention but does not resolve it.

The visual-language half is the same decision: a chart-neutral shell with one
system sans, mono for measurements, error text and paths, compact one-pixel
rules and no cards or shadows. It is deliberately quiet, so the failure stays
the loudest object on the page.

Tracking: no remote issue; this is the 0.7 redesign slice under B-057.

## What Changes

- Add a server-rendered **incident panel** below the toolbar and above the
  baseline and triage block for the first scenario in the ordered
  feature/scenario list (the triage and index order) whose executed status is
  `failed`, `undefined`, `ambiguous` or `pending`. The panel owns that
  scenario's evidence: it reuses the existing scenario detail (steps, hooks,
  diagnostics, doc strings, data tables, step/hook/extra attachments, earlier
  attempts, copy actions) rather than a bespoke timeline. The panel is narrower
  than the triage: executed `skipped` and `unknown` rows do not trigger it.
- The incident scenario's row in the index stays present as a **link to the
  panel** instead of a second disclosure; its detail is not rendered twice.
  Other non-passing rows keep their existing disclosure. The triage block and
  the index stay unchanged as navigation.
- A short summary at the top of the panel names the feature, scenario, status,
  the first failing step and the first line of its error (or the diagnostic
  lead and the baseline badge); the full detail follows. The panel is not
  affected by the toolbar search or status/tag filters and has no CTA into the
  filtered index. The client changes are the failure copy scope (failure copy
  only; the log copy keeps its attachment details), the scenario-scoped
  expand/collapse controls and the list-scoped empty copy; the bundle delta is
  measured. The expand/collapse controls are scoped to scenario rows so the
  panel stays open; the filtered empty copy names the list; the triage's first
  link points at the panel.
- When several scenarios need attention, the panel shows the first and a
  localized remaining count; the rest stay in the triage block and the index.
  No selector and no new script; those three small client deltas are the only
  client change.
- Render the panel in the default, static, print and PDF forms.
- Apply the Incident review visual language in a **separate commit** from the
  panel: chart-neutral paper and ink, one system sans, mono for measurements,
  error text, paths, source and code, compact chips, one-pixel rules, no new
  elevated/shadowed containers. Edit `src/render/report.css` and regenerate
  `src/render/styles.ts` in each commit; Details, Trends and the static form
  inherit the tokens. Each commit re-pins the report characterization hashes.

Out of scope: no summary, JSON, CI, email, manifest or history schema change; no
new client script file (three small existing-client changes: failure copy scope,
scenario-scoped expand/collapse, list-scoped empty copy); no input,
attachment-policy or path change; no Details/Trends layout change beyond shared
tokens; no removal of the triage block; no run-level hook panel
(BeforeAll/AfterAll stay in the existing run hooks section); no dependency; no
release.

## Capabilities

### Modified Capabilities

- `report-rendering`: the Report view gains the incident panel and the Incident
  review visual language.
- `localisation`: new report chrome keys in English and German.

## Impact

The report HTML changes by design: the incident scenario's detail moves from
the row into the panel, the row becomes a link, and the shell gains the new
tokens. There is no second copy of the detail; a screenshot still appears as
the row thumbnail and in the panel detail, exactly as today's open row renders
it, and that duplicated payload is measured with a screenshot fixture. The JSON
summary, CI output, email, manifest and history bytes stay unchanged. The
client bundle changes only by the three small client deltas, measured. Every host row and
the three-engine browser matrix apply because the report shell changes.
