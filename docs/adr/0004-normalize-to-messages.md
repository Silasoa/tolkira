# ADR 0004 — Normalise legacy JSON to Cucumber Messages

- Status: accepted
- Date: 2026-11-02

## Context

Tolkira must support both legacy Cucumber JSON and modern Messages. Two
renderers (one for each format) would double the UI surface and inevitably
diverge. A single renderer needs a single internal representation.

Cucumber Messages is the canonical, implementation-independent model and the
official renderer consumes it directly. The canonical
`@cucumber/json-to-messages` converter exists, but it does not preserve
`embeddings` (screenshots/attachments), which are essential for UI tests.

## Decision

Normalise legacy JSON into Cucumber Messages, including attachments, and render
both inputs through the same official renderer.

- Use the canonical converter as a reference and vendor/adapt its MIT-licensed
  logic where useful.
- Add a focused embedding → attachment mapping.
- Validate the generated envelopes with the current `@cucumber/messages`.
- Keep the adapter isolated and heavily tested with real legacy fixtures.

## Consequences

- One renderer, one report shell, one UI.
- The adapter is the hardest part of the project and the main differentiator.
- Legacy JSON support can be dropped only if the adapter becomes unmaintainable;
  it is a product requirement for v0.1.
- Attachments must be tested explicitly; text-only success is not enough.
