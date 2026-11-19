# Proposal

## Why

`src/render/html.ts` is about 1,300 lines and mixes the shell, status formatting,
CI metadata, attachments, triage, matrix, details and the whole report view.
The longest template returns are 1-1.5 KB single lines, so a change to one view
is hard to find, review and test. Every report change touches the same file,
which also makes the module boundaries invisible to agents.

## What Changes

- Split the renderer into focused modules: shared formatting, CI metadata,
  attachments, triage, matrix, details and the report view. `html.ts` keeps the
  public `renderHtml` entry, the shell, the CSP and the assembly.
- Move shared view types and helpers to small modules with a one-way dependency
  direction (no cycles).
- Reflow the longest template returns by extracting semantic fragments, not by
  adding whitespace inside the strings.
- Keep the rendered HTML byte-identical for a representative fixture set, keep
  every public export, and leave CSS, generated assets, the client bundle and
  the CSP unchanged.
- Update the architecture module map.

Out of scope: behavior, markup, CSS, options, summary/CLI changes, a new build
seam, generated assets, and splitting helpers that have no independent owner.

## Acceptance criteria

- The committed golden test (`test/render-golden.test.ts`, two file snapshots)
  stays byte-identical, and the eight-fixture SHA-256 set is unchanged.
- No public export or type path changes; `renderHtml` and `RenderOptions` keep
  their current consumers (`src/index.ts`, `src/stream.ts`).
- No change to CSS, `styles.ts`, `client-bundle.ts`, the CSP, package exports or
  dependencies.
- Every new module has a one-way dependency on the layers below it and no cycle;
  `src/render/html.ts` is shell and assembly only.
- `npm run check` and `npm run test:e2e` stay green.
- `docs/ARCHITECTURE.md` and `DESIGN.md` name the new module owners.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is an internal refactor with a characterization baseline instead of a
behavior spec delta; archive it with `--skip-specs`.

## Impact

- `src/render/html.ts` and new modules under `src/render/`, `docs/ARCHITECTURE.md`.
- No public export, dependency, output or CSS change.

## Review gate

PIR and DXR before implementation. No TDD-Red: there is no behavior to specify;
the committed golden, the full unit suite and the 273 browser tests are the
safety net. Review swarm: SCR, CR, DAR and STR. SEC is not triggered because the
output is byte-identical and no input or attachment path changes. Refs #7 and
B-004.
