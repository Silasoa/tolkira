# Tasks

## 1. TDD-Red

- [x] 1.1 Add `test/dom-contract.test.ts`: encode/decode round-trip table for
  executed and unexecuted scenarios, tags, examples and search text.
- [x] 1.2 Add the visibility decision table: hidden status, exact tag match,
  tag expression, case-insensitive substring across scenario and group search,
  expression bypasses text search, unexecuted row never hidden.
- [x] 1.3 Add the rendered-HTML round-trip: every `[data-scenario]` row decodes
  to its own facts, encoded attributes re-decode identically, scenario and
  feature IDs are unique and triage links resolve.
- [x] 1.4 Add selector assertions: filter buttons use `data-filter-status`;
  scenario, step and hook rows keep `data-status` as a result status.

## 2. Implementer

- [x] 2.1 Add `src/render/dom-contract.ts` with `encodeScenario`,
  `decodeScenario`, `scenarioVisible`, `featureId`, `scenarioId`, `DOM_IDS` and
  the shared attribute names.
- [x] 2.2 Convert `report-client.js` to `report-client.ts`, import the search
  helpers directly, delete the `TolkiraSearch` global and use the contract for
  scenario facts, IDs and visibility.
- [x] 2.3 Use the contract in `html.ts`; rename filter buttons to
  `data-filter-status`; keep scenario, step and hook `data-status`.
- [x] 2.4 Bundle `report-client.ts` once in `scripts/build-search.mjs`; keep
  the 16,000-byte guard and measure the delta against 15,146 bytes.
- [x] 2.5 Update render, search-state and e2e selectors for
  `data-filter-status`; keep behavior assertions unchanged.

## 3. Verification and docs

- [x] 3.1 Run the targeted Vitest files, typecheck, lint and the browser gate.
- [x] 3.2 Run `npm run check`; record bundle size and report size delta.
- [x] 3.3 Update the `src/render` paragraph in `docs/ARCHITECTURE.md`; record
  text-hook and static-ID exclusions in this change.
- [x] 3.4 Commit and push; report commit hash, tests, bundle delta and deferred
  items. Do not archive the change.

## Results

- Client bundle: 13,667 bytes, down from 15,146 bytes (-1,479, -9.8%); 2,333
  bytes under the 16,000-byte guard.
- Report HTML: no scenario attribute changed. Filter buttons add 7 bytes each
  (`data-filter-status` instead of `data-status`).
- Gate: typecheck, lint, build, 501 Vitest tests and 228 Playwright tests in
  Chromium, Firefox and WebKit pass.

## Deferred

- Full DOM constants module for every control and static ID.
- Text-hook constants shared with `report.css`.
- Further `html.ts` view seams; this change only touches the scenario contract.
