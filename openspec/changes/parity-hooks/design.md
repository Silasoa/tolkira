# Design

## Context

See `proposal.md` for motivation. `buildReportModel` currently pushes every
`testStep.hookId` result into `ReportScenario.steps` with `keyword: "Hook"` and
a type label. `scenario.steps.length` therefore counts hooks as steps, hook
names are discarded, and `testRunHookStarted`/`testRunHookFinished` are parsed
but ignored. `summarizeEnvelopes` is separate and still represents hooks as
steps; this slice deliberately leaves that contract alone.

ADR 0004 normalises legacy JSON to Messages. Legacy hooks already arrive as
Hook envelopes and per-scenario test steps; legacy JSON has no test-run hooks.
ADR 0005 keeps the shell server-rendered, so hook rows and the run-hooks section
must be in the generated HTML.

## Goals / Non-Goals

**Goals:**

- Separate hooks from steps in the model and the HTML.
- Preserve hook order, names, status, duration, errors and attachments.
- Collapse passed hooks; keep non-passing hooks inline.
- Render BeforeAll/AfterAll in a separate Hooks section.
- Keep the JSON summary stable and legacy/JUnit behaviour best effort.

**Non-Goals:**

- Diagnostics and auto-expansion (G4/G5/G6), rules/backgrounds/tags (G9),
  empty-run semantics (G7), Markdown (G8), tag expressions/URL state (G10),
  `meta.ci` (G11), attachment polish (G12), stream adapter (G14), parameter
  highlighting (G15), hook source-location links and summary schema changes.

## Decisions

### Add explicit hook types instead of reusing steps

Add:

- `ReportHook`: id, type label, name, status, durationMs, message, attachments.
- `ReportRunHook`: id, type label, name, status, durationMs, message,
  attachments.
- `ReportScenario.hooks: ReportHook[]`.
- `ReportModel.runHooks: ReportRunHook[]`.

Remove the hook-only fields from `ReportStep`. `scenario.steps` then contains
only ordinary steps, and `counts.steps` no longer includes hooks. The scenario
subtitle and the feature/run bars use scenario status, not hook counts.

Alternative considered: keep hooks in `steps` and filter at render time. It
would leave every consumer (summary, counts, tests, search) with two meanings
for `steps`. Rejected.

### Collect per-scenario hooks from test steps

When iterating `testCase.testSteps`, a `hookId` result goes to `hookRows`, not
`stepRows`. Resolve `hooks.get(hookId)` for type and name, map status and
duration as before, and map attachments from the test step. Keep test-case
order. A failed hook still contributes to the scenario's worst status because
the existing `rawResults` worst-status calculation includes all test-step
results.

Hook attachments are part of `scenario.attachments` for thumbnails, feature
counts and the run summary, but are rendered inside the hook row. They are not
added to `extraAttachments`, which remains for attachments without a step or
hook.

### Collect run hooks from start/finish envelopes

Build maps for `testRunHookStarted` by id and `testRunHookFinished` by
`testRunHookStartedId`. Resolve the Hook envelope by `hookId`; use its name and
type. Attachments with `testRunHookStartedId` belong to that run hook. Sort rows
by start timestamp, then input order. A start without a finish is kept with
status `unknown`; a finish without a start is ignored. Missing Hook metadata
falls back to a generic `Hook` label.

### Render scenario hooks around the steps

The scenario subtitle becomes `N steps · M hooks` when hooks exist. Before
hooks render before the steps list and after hooks after it. In each position:

- non-passing hooks render inline as hook rows;
- passed hooks sit inside `<details class="hookGroup">` with a `N hooks`
  summary.

A hook row shows the type/name label, status text, duration, error and
attachments. `Before: name`, `After: name`, `BeforeStep: name` and
`AfterStep: name` are the labels; without a name, the type alone is shown. The
group is omitted when there are no hooks. Skipped hooks stay visible because
they explain a skipped result; this is a deliberate difference from the
official step filter and is documented.

### Render run hooks below the feature list

A `Hooks` section with `data-run-hooks` renders below the feature list when
`model.runHooks` is non-empty. Each row shows the hook name when present,
otherwise `BeforeAll`/`AfterAll`, plus status, duration, error and attachments.
The section is static HTML and works without JavaScript. The empty section is
omitted; the official formatter always shows it with an empty message. That
difference is deliberate and documented.

### Count hook time and attachments once

`scenario.durationMs` sums steps and hooks. `feature.durationMs` and the run
duration inherit it. Hook attachments are part of the scenario aggregate for
thumbnails and counts, but render only in the hook row. Run-hook attachments
are indexed by `testRunHookStartedId` and excluded from `runAttachments`, so
they are not repeated in the run attachments list.

### Use failed hooks in triage and copy failure

`renderTriageRow` and `failureText()` first look for a failed step, then for a
failed hook. A hook-only failure shows the hook label and first error line in
the triage reason and copied text. The scenario remains failed because the
existing worst-result calculation includes hook results.

### Keep search and summary contracts

`scenarioText` adds hook names and messages (capped like step messages) so a
hook failure remains findable. When a search matches a scenario, its hook
groups open so a matching passed hook is visible; the existing 20-match cap
applies. Run hooks are not part of the scenario search; they are a run-level
section.

The JSON summary remains computed from envelopes and keeps its version-1
hook-as-step representation. Add an optional `name` to hook summary entries
(additive, no schema bump), and fold test-run hook results into the overall
summary status so a failed BeforeAll/AfterAll cannot produce a green summary.
`docs/AGENT-INTERFACE.md` states that summary steps and counts include hooks
while the HTML separates them, and the Details view labels both totals.

### Legacy and JUnit fallbacks

Legacy hooks already normalise to Hook envelopes with a type, status, duration,
error and attachments; they become per-scenario hook rows. Legacy has no
test-run hooks. JUnit has no hooks. A Messages hook without a Hook envelope uses
the generic label and still renders.

## Risks / Trade-offs

- **Step counts diverge** → HTML step counts exclude hooks; summary steps and
  counts include them. Label both totals and document the difference.
- **A failed run hook could stay green in the summary** → fold test-run hook
  results into the summary status and cover a passing-scenarios/failed-AfterAll
  case.
- **Hook order and triage** → before hooks render before steps, after hooks
  after; a failed hook must feed the triage reason and copy-failure text.
- **Attachments counted twice** → hook attachments are included in the
  scenario aggregate but rendered only in the hook row; run-hook attachments
  are excluded from `runAttachments`; assert counts and no duplicate rendering.
- **Run-hook metadata is incomplete** → fallback labels and unknown status;
  cover a missing Hook envelope.
- **Search grows with hook errors** → cap hook messages like step messages,
  open matching hook groups and keep the existing 20-match expansion cap.
- **Passed hooks hidden** → the disclosure summary is keyboard operable and
  non-passing hooks stay inline; cover keyboard and no-JS.
- **Legacy expectations** → legacy has no run hooks and often no names; the
  report must not invent either.

## Migration Plan

No schema, CLI or API change. The HTML output changes; the JSON summary keeps
its current shape. Rollback is a revert of the slice.

## Open Questions

None. The summary-schema change is deliberately deferred; it is a separate
product decision.
