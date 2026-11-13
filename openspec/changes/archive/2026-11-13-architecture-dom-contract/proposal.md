# Proposal

## Why

The browser script is untyped JavaScript outside the TypeScript program. It
reads data attributes that the server writes as hand-copied strings, and it
reaches the search helpers through the `TolkiraSearch` global. A rename fails
silently in the browser instead of at build time. `data-status` also means two
different things: a scenario result and a filter button's toggle value.

This is the first slice of the Typed DOM contract candidate in
`docs/architecture/rewrite-list.md` (architecture review, 2026-11-13). It is an
internal refactor with no intended user-visible change.

## What Changes

- Convert `src/render/report-client.js` to TypeScript so it joins typecheck.
- Import the search helpers directly; remove the `TolkiraSearch` global.
- Bundle the client and its imports in one esbuild pass, keeping the generated
  client at or below the existing 16,000-byte budget.
- Add a browser-safe `src/render/dom-contract.ts` for scenario facts:
  `encodeScenario` / `decodeScenario` and pure visibility decisions.
- Use the contract from both the server templates and the client.
- Name the IDs shared by the server and client in the contract.
- Rename the filter button attribute from `data-status` to
  `data-filter-status`; `data-status` then means a result status everywhere.
- Add a Node round-trip test through rendered HTML.

Out of scope: external attachments, report shell restructuring, changes to the
input, model or summary layers, new runtime dependencies, release work, and a
general constants module for CSS classes or static heading IDs.

## Capabilities

### New Capabilities

None. This is an internal refactor; specs are skipped by design
(`skip_specs: true`).

### Modified Capabilities

None at the product level. Existing report-rendering behavior and the generated
HTML contract remain stable apart from the filter attribute rename.

## Impact

- `src/render/report-client.ts` (replaces `report-client.js`),
  `src/render/dom-contract.ts`, `src/render/html.ts`,
  `scripts/build-search.mjs`.
- `test/dom-contract.test.ts`, render tests, search e2e selectors and the
  architecture note.
- Generated `src/render/client-bundle.ts` changes; its byte budget does not.
- No dependency, CLI, summary or model change.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair. The
bundled client must stay at or below 16,000 bytes and `npm run check` must be
green.
