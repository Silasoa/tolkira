# ADR 0001 — Use the official Cucumber renderer, own the adapters and shell

- Status: accepted
- Date: 2026-11-02

## Context

The old `cucumber-html-reporter` is effectively unmaintained and carries old
templates, CDN assets and a duplicate Cucumber 9 dependency. Forking it would
mean owning Bootstrap 3, jQuery, Google Charts and the legacy JSON parser
forever.

The official `@cucumber/html-formatter` and `@cucumber/react-components` are
MIT-licensed, maintained by the Cucumber project and already render Gherkin,
steps, errors, attachments, search, status filters and tags. They consume
Cucumber Messages only.

## Decision

Use the official Cucumber components as the rendering engine. Tolkira owns:

- input adapters (legacy JSON + Messages),
- normalisation to Messages, including attachments,
- the shell (title, metadata, summary, theme, logo),
- the CLI and API,
- security and output policy.

Do not fork the old reporter’s templates. Do not write a Gherkin renderer.

## Consequences

- Less renderer code to maintain; upstream fixes flow in.
- We depend on the official component API; pin versions and test upgrades.
- The legacy JSON adapter is the main bespoke risk.
- The visual result is Tolkira’s shell, not a 1:1 clone of the old Bootstrap
  report.
- We must keep MIT attribution for the Cucumber components.
