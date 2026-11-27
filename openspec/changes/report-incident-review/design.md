# Design

## 1. Context

The Report view currently renders: header, toolbar, live region, optional
baseline panel, triage block, source strip, feature index and footer
(`src/render/report.ts`, `renderReportView`). The incident panel is inserted
below the toolbar and above the baseline and triage block. The 0.7 direction
chosen on 2026-11-26 is **Incident review**: resolve the first incident after
the controls, and make the scenario row a link to it instead of a second
disclosure. The visual language is refreshed to a chart-neutral shell; the
toolbar-first order is the reviewed deviation from the mockup, so the search
and filters stay reachable with a long detail.

The report stays one self-contained file: no client script, no network, no new
dependency. The panel is server-rendered and works in the default, static,
print and PDF forms.

## 2. Selection

- The incident set is the executed scenarios whose final status is `failed`,
  `undefined`, `ambiguous` or `pending`. `skipped` is an intentional non-run
  and `unknown` means no result; neither triggers the panel. This is narrower
  than the triage's attention set by design: the triage lists every executed
  non-passed row, the panel resolves the first incident.
- The incident is the first scenario in the ordered feature/scenario list the
  triage and the index use (`orderFeatures`: the existing severity order within
  features and scenarios), not the flat model list. The index may group
  outline/rule rows into nested markup and move the visible row; selection
  follows the ordered list, not the visual nesting. `unknown` is excluded from
  the incident set; the triage remains broader because it includes `skipped`.
  No second sort and no new model field.
- The selector walks that ordered list once, O(n) in the scenarios.
- Existing fields only: feature/scenario names, outline label, status, steps,
  hooks, `attachments` (which already includes step, hook and extra
  attachments), `extraAttachments`, tags, duration, source, attempt, start
  time and the baseline `change`.

## 3. Evidence ownership

The panel **reuses the existing scenario detail** (`scenarioBody`, with its
props assembled by `renderScenario`; extract one helper used by both the panel
and the non-incident rows): chronological steps and hooks by `order`, passed
hooks in the existing collapsed group, doc strings, data tables,
undefined/ambiguous diagnostics, step/hook attachments, extra attachments,
earlier attempts, metadata and the copy actions. There is no bespoke timeline
and no second evidence block.

The reused detail carries `data-copy-failure` and `data-copy-log`. The panel
wraps the detail in a `data-copy-scope` container (not a `[data-scenario]`, so
the index filters leave it alone). The scope carries the feature title,
scenario name and facts; the existing `failureText` resolves the nearest copy
scope **only for the failure text**. The copy-log handler keeps its nearest
attachment `details` and is unchanged, so it copies the log, not the panel's
first `<pre>`. The client module is edited for this one scope; the generated
client bundle is rebuilt and its delta measured. Both clipboard texts (failure
and log) are asserted in the e2e test.

The incident scenario's row in the index stays visible with its status, name,
tags, thumbnail and duration, but its disclosure is replaced by a link to the
panel (`href="#incident"`, `Shown above` label, no chevron and no second
detail). The change applies to the rendered row wherever the grouping places
it (standalone or nested outline/example row). Other non-passing rows keep
their existing disclosure. The row keeps its `scenarioId` anchor so triage
links still work; the panel has the `incident` id and `tabindex="-1"` for the
link target.

Consequences:

- The largest duplicated payload (the detail and its inline data URIs) is not
  duplicated; the row's thumbnail remains as today, so a screenshot still
  appears once as the thumbnail and once in the panel's detail, exactly as the
  current open row renders it. The size check measures this duplicated payload
  with a screenshot fixture and records the delta. The report grows by the
  panel chrome (heading, summary) and the CSS, not by a second detail.
- The full scenario detail can be long. The panel's top summary (feature,
  scenario, status, first failing step or diagnostic, error) is the
  above-the-fold minimum; the rest follows. No step window, no "N more" line,
  and no collapsed passed hooks beyond the existing group.
- If the scenario has no attachments, the panel renders the localized
  no-evidence line above the detail.

## 4. Top summary

The panel is a `<section class="incident" id="incident" tabindex="-1"
aria-labelledby="incident-heading">` with:

- heading `What happened` (`h2`, id `incident-heading`);
- a status badge (`Run failed` for `failed`, `Needs attention` otherwise);
- feature name, scenario name with the outline label through the shared
  `scenarioLabel` helper (moved to `format.ts`), status, step count and
  duration;
- a short cause line: the first failing step or hook text and the **first
  line** of its message, or the first diagnostic lead when the status is
  `undefined`/`ambiguous`, or the status label when neither exists; the full
  error lives in the detail below and is not repeated in the summary;
- tags, source, attempt, start time and the baseline `change` badge;
- the localized remaining plural line when more incidents exist.

The full `scenarioBody` detail follows inside an `.incidentDetail` wrapper that
resets the detail's left padding and background. The summary and detail
builders are extracted from `renderScenario` and shared with the panel, and an
`incidentId` is threaded through `renderFeature`, `renderFeatureItem`,
`renderOutline`, `renderScenario`, `renderExamples` and `renderRuleBlock` so the
link row works standalone and under a rule/outline. The existing test helpers
and the `details.scenario` e2e selectors are migrated with the row form.

## 5. Placement and filtering

Order: header, toolbar, live region/search note, incident panel (when
present), baseline panel, triage block, source strip, feature index, run
hooks, footer. The toolbar stays above the panel so the search and filters
remain reachable when the reused detail is long; the panel is the first
content object after the controls. The baseline panel keeps its current
position after the toolbar.

The panel is server-rendered and is not hidden by the toolbar search or
status/tag filters; it is not part of the filtered index and has **no CTA into
the index**. The triage block and source strip keep their existing client
hiding when a filter is active. The filtered empty state is scoped to the
feature index: its copy says no scenarios **in the list** match and the
incident panel remains visible. The triage's first-incident link points at the
panel (`#incident`); the rest point at their rows. The selected incident id is
passed to `renderTriage` as a parameter; the selector stays in `report.ts`, so
no import cycle is introduced. The client changes are the failure copy scope,
the scenario-scoped expand/collapse controls, the list-scoped empty copy and
the row highlight guard (behaviour preserved: the incident row is no longer an
open `<details>`, so the guard follows the markup).

The panel detail stays open and is not a disclosure; the toolbar's expand and
collapse controls are scoped to the scenario rows ("scenarios") so they do not
promise to collapse the incident panel. The controls and the empty copy are
retranslated in both catalogs.

Several incidents: the panel shows the first and the remaining count; the
others stay reachable through the triage block and the index. No selector.

## 6. Visual language

Chart-neutral paper and ink, one system sans for UI, mono for measurements,
timestamps, error text, paths, source and code (tags keep their mono as today),
compact chips, one-pixel rules, and no **new** elevated/shadowed containers. A
card here means an elevated container with a shadow; the incident panel is a
full-border tinted block, not a card. Existing full-border panels (source
strip, Details panels) keep a full border and the shared 6 px radius; the
lightbox is exempt from the radius/shadow assertion.

The source of truth is `src/render/report.css`; `src/render/styles.ts` is
generated from it (`npm run styles`, part of `npm run assets`) and is
byte-checked. Edit the CSS and regenerate; never edit `styles.ts` directly.

Target tokens (light):

| Role | Value |
| --- | --- |
| `--paper` | `#f5f3ec` |
| `--canvas` | `#eeece4` |
| `--surface-2` | `#fbfaf6` |
| `--surface-3` | `#e9e5da` |
| `--ink` | `#1c1b17` |
| `--ink-2` | `#33312a` |
| `--muted` | `#625e53` |
| `--line` | `#dbd6c8` |
| `--line-strong` | `#c3bcab` |
| `--accent` / `--accent-text` / `--accent-soft` | `#9a6b1f` / `#7a5318` / `#f0e6d2` |
| `--pass` / `--pass-soft` | `#2e6a45` / `#e7efe8` |
| `--fail` / `--fail-soft` | `#b02a1f` / `#f4e3df` |
| `--pending` / `--pending-soft` | `#7a5318` / `#f0e6d2` |
| `--undefined` / `--undefined-soft` | `#6b4f8a` / `#ece6f2` |
| `--ambiguous` / `--ambiguous-soft` | `#6f6b60` / `#e9e5da` |
| `--skipped` / `--skipped-soft` | `#6f6b60` / `#e9e5da` |
| `--unknown` / `--unknown-soft` | `#6f6b60` / `#e9e5da` |
| `--radius` / `--shadow` | `6px` / `none` |

The token names stay as they are (`--paper`, `--canvas`, `--surface-2/3`,
`--ink`, `--ink-2`, `--muted`, `--line`, `--line-strong`, `--accent`,
`--accent-text`, `--accent-soft`, `--pass*`, `--fail*`, `--pending*`,
`--undefined*`, `--ambiguous*`, `--skipped*`, `--unknown*`, ANSI); only the
values change. All `--ansi-*` values stay unchanged in light, dark and print.
Dark maps the same roles to `#1a1915`, `#14130f`, `#211f1a`, `#2a2620`,
`#efece2`, `#d8d2c4`, `#a8a294`, `#37342c`, `#4b463b`, `#f09386`, `#8fc9a2`
and the matching soft tints. Print resets to the light values, the 6 px radius
and the unchanged ANSI values. `--accent` is non-text (focus, selection, rules);
all accent text uses `--accent-text`. Text roles are checked on paper,
surface-2 and surface-3 (the status text uses muted on surface-3), in light,
dark and print. Muted is the lowest at 5.14:1 on surface-3; pending and
accent-text are the lowest status/accent texts at 6.14:1 on paper. All stay at
or above 4.5:1.

The existing dark values for accent, accent-text, pass, fail, pending,
undefined, ambiguous, skipped, unknown and their soft tints stay: accent/pending
`oklch(82% .15 80)`, accent-text `oklch(82% .15 80)`, pass
`oklch(76% .15 150)`, fail `oklch(70% .17 25)`, undefined
`oklch(78% .12 300)`, ambiguous/skipped/unknown `oklch(71% .012 85)`, with their
current soft tints; ANSI stays. Only the listed dark base surfaces/ink/line
values change. Dark contrast is asserted too, including accent-text; the
existing dark muted `#a8a294` is 5.92:1 on surface-3.

Type: body 0.875 rem/1.5; run title 1.65 rem/1.08 at 650; feature title
1 rem at 650; scenario name 0.8125 rem at 550; meta 0.6875 rem; mono
0.6875 rem for durations, timestamps, errors, paths and source. No serif; no
functional text below 0.6875 rem.

The token retune is a separate commit from the panel, and each commit re-pins
the report characterization hashes because every report changes with the
tokens. Details, Trends, baseline and tag styles inherit the tokens; no layout
change there beyond the shared radius/border/type. The panel styles live in
`report.css` (added in the panel commit, then `npm run styles`); no new
stylesheet file. The module maps in `docs/ARCHITECTURE.md`, `DESIGN.md` and
`GLOSSARY.md` are updated if the shell's module/visual description changes;
the README hero screenshot is refreshed with raster provenance.

## 7. Edge cases

- No incident status: no panel, no empty artifact.
- Skipped only or unknown only: no panel; the triage keeps its existing
  attention list.
- `undefined`/`ambiguous`: the top summary uses the first diagnostic lead; the
  detail renders the full diagnostics.
- Failed After hook: the detail's chronological order places it after the
  steps; the summary names it; passed hooks stay in their group.
- Failed step without a message: summary shows the step text and status; no
  empty error block.
- Long error: the existing pre-wrap error block; no second scroll region.
- Image, text, video attachments: the existing safe `renderAttachment` path;
  skipped path attachments keep their notice.
- Outline example: the panel names the example row; the row anchor stays.
- Baseline comparison: the existing `change` badge.
- Run-level hook failure (BeforeAll/AfterAll): no panel; the existing run
  hooks section shows the error. Deferred follow-up.
- Locale `de`: all new copy translated; plurals via the existing ICU
  convention; test data verbatim.
- Static/print/PDF: same panel, no controls, link text prints.
- 320 px / 200 %: panel and reused detail wrap without horizontal page scroll.

## 8. Hard parts and risks

- The row's link changes a disclosure into a link for one scenario; keyboard
  and screen-reader tests must prove the row and the panel are both reachable
  and the triage anchor still works.
- Panel height: a long failure pushes the index down. The above-the-fold
  minimum is the summary and the first failing step, not the whole detail.
- CSS blast radius: the token retune reaches Details, Trends, baseline and
  print; separate commits and the host rows attribute regressions.
- Duplication with the triage is navigation, not evidence; the triage stays.
- Report bytes: the detail moves, it is not duplicated; the size delta is
  measured. JSON/CI/email/manifest/history bytes stay unchanged; the client
  bundle changes only by the four small client deltas, measured.
- CMP parity records only the intended report differences.

## 9. Acceptance criteria

- AC1: The incident panel renders if and only if at least one executed
  scenario has status `failed`, `undefined`, `ambiguous` or `pending`; skipped
  and unknown alone do not trigger it.
- AC2: It resolves the first such scenario in the ordered feature/scenario
  list used by the triage and the index; `failed` leads by the existing
  severity order; grouping may move the visible row; no new sort or model
  field.
- AC3: It reuses the existing scenario detail (`scenarioBody`): chronological
  steps/hooks, diagnostics, doc strings, tables, step/hook/extra attachments,
  earlier attempts, metadata and the working copy actions; the failure copy
  uses the panel scope, the log copy keeps its own attachment details; no
  bespoke timeline.
- AC4: The incident scenario's row becomes a link to the panel with the
  `Shown above` label, standalone or under a rule/outline; its detail is not
  rendered twice; other rows keep their disclosure; the `scenarioId` anchor
  still serves triage links.
- AC5: The top summary names feature, scenario, status, the first failing
  step/hook text and the first line of its message or diagnostic lead, and the
  baseline badge; the remaining-count line renders when several incidents
  exist.
- AC6: Default, static, print and PDF render the panel; it is not filtered; no
  new client script or network request is added; the four small client
  deltas keep the copy actions working.
- AC7: No evidence yields the localized no-evidence line; attachments use the
  existing safe path; escaping is unchanged.
- AC8: English and German catalogs carry every new key; plurals use the
  existing ICU convention; test data is verbatim.
- AC9: WCAG 2.2 AA, keyboard, no colour-only status, 320 px and 200 % text
  zoom, no horizontal page scroll.
- AC10: The Incident review tokens apply to Report, Details, Trends, static and
  print; no new elevated/shadowed containers, no external assets; existing
  full-border panels keep a full border and the 6 px radius (lightbox exempt);
  contrast holds on paper, surface-2 and surface-3, including status text, in
  light, dark and print.
- AC11: Report HTML changes by design; summary, JSON, CI, email, manifest and
  history bytes are unchanged; the client bundle changes only by the four
  small client deltas, measured; the report-size delta is recorded; characterization
  hashes are re-pinned per commit; host rows 1-5, the three-engine matrix and
  CMP are recorded.
- AC12: The toolbar's expand/collapse controls are scoped to scenario rows; the
  incident panel stays open, and the filtered empty copy names the list, not
  the panel.
