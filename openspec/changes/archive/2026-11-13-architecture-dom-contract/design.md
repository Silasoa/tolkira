# Design

## Context

See `proposal.md` and `docs/architecture/rewrite-list.md` (Typed DOM contract).
ADR 0005 keeps the shell server-rendered; this change does not introduce a
second renderer.

The report server writes the scenario facts the browser reads. Today the
attribute names exist only as literals in `html.ts` and `report-client.js`.
The client is not in the TypeScript program and calls the search helpers
through an IIFE global, so typecheck cannot catch a mismatch.

## Goals / Non-Goals

**Goals:**

- One definition of the scenario facts crossing the DOM boundary.
- The client is typechecked; the global is gone.
- The bundle stays at or below 16,000 bytes.
- Filter controls and result rows stop sharing `data-status`.
- A Node test round-trips facts through real rendered HTML.

**Non-Goals:**

- Moving CSS class names out of `report.css`.
- A general DOM constants bag for every static heading or control.
- Changing report behavior, selectors used by users, or the report model.
- Replacing the server-rendered shell.

## Decisions

### Scenario facts are the contract

`dom-contract.ts` exports:

- `ScenarioFacts` — `status`, `name`, `uri`, `tags`, `example`,
  `examplesName`, `search`.
- `encodeScenario(facts)` — returns ordered `[name, value]` attribute pairs.
  The caller escapes values.
- `decodeScenario(source)` — takes any object with `getAttribute(name)`; an
  `Element` in the browser, a test adapter in Node.
- `scenarioVisible(facts, filter)` — hidden status, selected tag, tag
  expression and substring search in one pure decision.
- `featureId` / `scenarioId` — the two generated anchor prefixes.
- `DOM_IDS` — the seven IDs the client looks up.
- `SCENARIO_ATTRIBUTE`, `STATUS_ATTRIBUTE`, `FILTER_STATUS_ATTRIBUTE`.

`encodeScenario` emits the same attributes in the same order as before:
`data-status` (only when executed), `data-uri`, `data-scenario-name`,
`data-example` / `data-examples-name` (grouped rows only), `data-tags`,
`data-search`.

### One bundle, direct imports

`report-client.ts` imports `compileTagExpression`, `parseUrlState`,
`rememberHiddenOpen`, `rowsToOpen` and `serializeUrlState` from `search.ts`.
`scripts/build-search.mjs` bundles the client entry once with esbuild instead
of concatenating a search IIFE and a transformed script. Unused exports such as
`evaluateTagExpression` are tree-shaken; the `TolkiraSearch` global disappears.
The 16,000-byte guard stays in the script.

### `data-status` overload

`data-status` becomes a result status only: scenario rows, step rows and hook
rows. Filter buttons use `data-filter-status`, because their value is a filter
control, not a result. This is the smallest resolution; it keeps the scenario
selectors that the tests and user tooling already rely on. The client, unit
tests and e2e selectors are updated together.

### IDs and text hooks

Shared IDs move into `DOM_IDS`. Generated anchors use `featureId` and
`scenarioId` so triage links and row IDs cannot drift.

Text hooks are explicitly excluded. Class names such as `.scenarioName`,
`.stepText`, `.kw`, `.error` and `.hookLabel` are owned by `report.css` and the
templates; moving them into the contract would create a second owner for CSS.
Static heading IDs (`triage-heading`, `sources-heading`,
`run-hooks-heading`) and tab button IDs are server-only and also excluded.

## Data flow

```
ReportModel
  -> html.ts renderScenario
       encodeScenario(facts) -> data-* attributes in the HTML
  -> one HTML file
       browser report-client.ts
         decodeScenario(scenarioElement) -> ScenarioFacts
         scenarioVisible(facts, query/tag/hidden/expression) -> match
```

## Risks

- **Bundle growth.** The contract and typecheck helpers could eat the 854-byte
  headroom. Mitigation: one bundle instead of two wrappers, tree-shaking, and
  the existing hard budget in `build-search.mjs`.
- **Behavior drift in the client rewrite.** Mitigation: keep the existing
  algorithm and add the pure-decision table plus the rendered round-trip test;
  the browser suite stays the behavior seam.
- **Selector consumers.** `data-filter-status` changes a selector that e2e and
  possibly external users target. Mitigation: scenario and result selectors
  stay unchanged; the report has no documented stable DOM API.
- **Escaping.** `encodeScenario` returns raw values so the server keeps a
  single escaping point. The round-trip test decodes HTML entities and compares
  raw facts.
