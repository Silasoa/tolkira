# ADR 0002 — One package, ESM, Node 22+

- Status: accepted
- Date: 2026-11-02, amended 2026-11-12

## Context

Tolkira is a CLI plus a small library. A monorepo would add release overhead
before there is a second consumer. Node 22 is the oldest supported LTS line;
the CI matrix covers 22, 24 and 26.

## Decision

- One npm package: `tolkira`.
- ESM (`"type": "module"`), TypeScript, `engines.node >= 22`.
- Narrow exception: the compatibility subpath
  (`tolkira/compat/cucumber-html-reporter`) also ships a tracked `.cts` wrapper
  that emits `.cjs` plus `.d.cts`. The wrapper dynamically imports the ESM shim
  and exposes async `generate(options, callback?)` with no default export. The
  package root, core API and CLI stay ESM-only.
- CLI and API in the same package.
- `esbuild` for the bundle; runtime dependencies stay external and explicit.
- npm trusted publishing with provenance; no long-lived token.

## Consequences

- Simple releases and onboarding.
- Breaking changes to the package are visible in one version line.
- CommonJS projects migrating from `cucumber-html-reporter` can require the
  compatibility shim without a dual ESM/CJS build of the package.
- The wrapper adds one build artifact and one export condition that must stay
  aligned with the ESM shim.
- If a second package is ever needed, split only when a real consumer exists.
