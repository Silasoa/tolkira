# Proposal

## Why

#24 finding 7: the Report toolbar exposes one toggle chip per present status.
To see only failures, a user must switch off every other chip, and the reduced
view has no name or shortcut. The comparison run had passed, failed and skipped
rows, where the common “show me the failures” task took several clicks.

## What Changes

- Add a `Failed only` preset toggle to the status filter group when the run has
  failed plus another present status or an unexecuted row. It switches the
  failed chip on and every other present status chip off.
- Add an `unexecuted` sentinel to the hidden set; the sentinel, not the toggle
  state, hides statusless rows. The chips alone keep their current behaviour.
- Encode the preset with the existing `hide` list plus the sentinel, so reload
  restores it and a shared URL keeps the view; prune the sentinel on restore
  unless the preset chip state is present. No new URL parameter and no second
  filter model. A manual chip change clears the sentinel.
- Keep the toggle in sync with the state, keep search and tag combinable, update
  the live count, and support keyboard use.
- Update the design inventory, the feature list and the changelog.

Out of scope: a single-select chip model, a `?status=failed` parameter, hiding
unexecuted rows outside the preset, a flaky-only filter (the flaky status is
deferred), and filtering without JavaScript.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: add the failed-only preset, its URL state and its
  statusless-row behaviour.

## Impact

- `src/render/html.ts`, `src/render/report-client.ts`,
  `src/render/dom-contract.ts`, `src/render/search.ts`,
  `src/render/report.css`, the regenerated `src/render/styles.ts` and
  `src/render/client-bundle.ts`, unit and browser tests, `DESIGN.md`,
  `README.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`,
  `docs/AGENT-INTERFACE.md` (`?hide=` note), `docs/CHANGELOG.md`.
- No runtime dependency, no summary/CLI change, no network access.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair; review
swarm is SCR, CR, DAR, UXR and CMP. Refs #24 and #27.
