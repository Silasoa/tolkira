# ADR 0002 — One package, ESM, Node 22+

- Status: accepted
- Date: 2026-11-02

## Context

Tolkira is a CLI plus a small library. A monorepo would add release overhead
before there is a second consumer. Node 22 is the oldest supported LTS line;
the CI matrix covers 22, 24 and 26.

## Decision

- One npm package: `tolkira`.
- ESM (`"type": "module"`), TypeScript, `engines.node >= 22`.
- CLI and API in the same package.
- `esbuild` for the bundle; runtime dependencies stay external and explicit.
- npm trusted publishing with provenance; no long-lived token.

## Consequences

- Simple releases and onboarding.
- Breaking changes to the package are visible in one version line.
- If a second package is ever needed, split only when a real consumer exists.
