# Proposal

## Why

Teams still depend on the unmaintained `cucumber-html-reporter` and on legacy
Cucumber JSON, while the official Cucumber HTML formatter is modern but
Messages-only. There is no lightweight tool that produces one embeddable,
offline HTML report from **both** legacy JSON and Messages and preserves
screenshots. Tolkira closes that gap.

The tracking issue does not exist yet because the GitHub remote has not been
created. This proposal is the planning contract until the issue exists.

## What Changes

- Introduce a CLI and a programmatic API that turn one or more test-result
  inputs into a single self-contained HTML file.
- Add a **Messages input adapter** for NDJSON produced by official Cucumber
  implementations.
- Add a **legacy Cucumber JSON adapter** that normalises features, scenarios,
  steps, hooks, statuses, durations, tags, tables, doc strings and
  **embeddings/attachments** into Messages.
- Add a **report shell** around the official Cucumber React components:
  title, metadata, summary, search/status/tag filters, dark mode, logo and
  brand colours.
- Add a **security baseline**: escape user content, handle attachments safely,
  no HTML execution, no network requests and no telemetry.
- Add a test suite with real fixtures from cucumber-js, cucumber-jvm,
  cucumber-ruby and Behave, golden HTML checks and one Playwright browser test.
- Prepare the package for npm publication with provenance and a Node
  22/24/26 CI matrix.

Not in this change: history/trends, PDF/email, JUnit/Playwright adapters,
localisation, plugins, SaaS or a live server.

## Capabilities

### New Capabilities

- `input-formats`: reading and merging legacy Cucumber JSON and Cucumber
  Messages, including auto-detection and attachment-preserving normalisation.
- `report-rendering`: producing the single-file HTML report, its shell,
  metadata, summary, filtering, theme and security policy.
- `cli-api`: the command-line interface and programmatic API, including exit
  codes, input discovery and output handling.

### Modified Capabilities

None; this is the initial change.

## Impact

- New npm package `tolkira` (ESM, Node >= 22).
- Runtime dependencies: `@cucumber/html-formatter`, `@cucumber/messages`.
- Dev dependencies: TypeScript, esbuild, Vitest, ESLint, Playwright.
- New repository docs, OpenSpec contract, ADRs, CI and release workflow.
- No migration of existing data; legacy JSON support is additive.
