# Design

> Superseded for report rendering by `openspec/changes/simple-report-shell/`.
> The input normalisation and security decisions below still apply.

## Context

See `proposal.md` for why. The relevant constraints:

- The old reporter is unmaintained; forking its templates would import
  Bootstrap 3, jQuery, Google Charts and a duplicate Cucumber 9 dependency.
- The official `@cucumber/html-formatter` and `@cucumber/react-components`
  render Gherkin, steps, errors, attachments, search, filters and tags from
  Cucumber Messages.
- Legacy Cucumber JSON is still widely used and carries screenshots as
  `embeddings`, which the canonical converter does not preserve.
- The output must be one self-contained HTML file suitable for CI artefacts and
  iframe embedding.

## Goals / Non-Goals

**Goals**

- One CLI/API, one package, one HTML output.
- Legacy JSON + Messages input, merged deterministically.
- Screenshots and attachments preserved from both formats.
- Official renderer for Gherkin and attachments; small Tolkira shell for title,
  metadata, summary and theme.
- No CDN, no network requests, no telemetry.
- A security baseline that treats names, metadata and attachments as untrusted.
- A test suite with real fixtures and a browser-level check.

**Non-Goals**

- History/trends, PDF/email, localisation, JUnit/Playwright adapters, plugins.
- A custom Gherkin renderer or a fork of the old reporter templates.
- A 1:1 visual clone of the old Bootstrap themes.
- A server, database or live report.

## Decisions

### D1: Normalise both formats to Cucumber Messages

The renderer consumes one internal representation. Legacy JSON is converted to
Messages, including embeddings → attachments. This is the core of the hybrid.
See ADR 0004.

### D2: Vendor/adapt the legacy converter; do not depend on the stale package

`@cucumber/json-to-messages` is MIT-licensed and useful as a reference, but it
is old and drops embeddings. We will use its structure where helpful, update it
to current Messages, and add a focused attachment mapping. Attribution stays.

### D3: Use the official HTML formatter for v0.1

Start with `CucumberHtmlStream` from `@cucumber/html-formatter`:

- one self-contained HTML file;
- official Gherkin/attachment/search/filter UI;
- custom CSS/JS/icon paths are supported.

A custom React shell on `@cucumber/react-components` is a later step if the
official template cannot carry the metadata/summary shell cleanly.

### D4: Shell injection, not a fork

Tolkira adds a small shell around the official output:

- replace the hard-coded `<title>Cucumber</title>` with the requested title;
- inject a metadata/summary block via custom CSS/JS;
- theme tokens via CSS variables;
- optional logo.

If this becomes fragile, the fallback is a small React shell using the official
components, not a fork of the old reporter.

### D5: Single file by default

Attachments are inline in the HTML for v0.1. This matches CI artefacts, email
and iframe embedding. External attachments and split assets are a later change
for large media. A restrictive CSP is injected into every report; split-assets
mode is not part of v0.1.

### D6: Security boundary

- Escape title, metadata, feature/scenario/step names and attachment names.
- Do not render HTML/SVG attachments as active content; show text or sandboxed
  content.
- Validate media types and size.
- No remote assets, fonts, analytics or telemetry.
- Avoid path traversal when writing output.
- A split-assets/external-attachment mode is planned, not v0.1.
- Inline attachments are capped (50 MB each, 100 MB total).

### D7: One package and a small toolchain

ESM, Node >= 22, TypeScript, esbuild, Vitest, oxlint, Playwright. No monorepo,
no CLI framework, no lodash/fs-extra/uuid. See ADR 0002.

### D8: Fixtures and tests are first-class

- Messages fixture with a screenshot attachment.
- Legacy JSON fixtures from cucumber-js, cucumber-jvm, cucumber-ruby and Behave.
- Golden HTML assertions for structure and escaped content.
- One Playwright test: render, expand failure, open screenshot, search/filter.
- ISTQB-style edge cases: status decision table, empty input, unicode, long
  names, duplicate IDs, missing fields, large attachments.

### D9: Release

npm package `tolkira`, trusted publishing with provenance, CI matrix Node
22/24/26, Windows path handling tested.

## Risks / Trade-offs

- **Legacy adapter complexity** — the main risk. Mitigation: isolate it, start
  with cucumber-js and cucumber-jvm fixtures, test attachments explicitly.
- **Official component API changes** — pin versions, test upgrades, keep the
  adapter independent.
- **Shell injection fragility** — test the title/metadata replacement; fall back
  to a React shell if needed.
- **Single-file size** - warn above 10 MB by default (`--max-size`); external
  attachments later.
- **Legacy JSON variants** — support the documented implementations first; add
  fixtures for each.
- **Name/trademark** — formal clearance pending; rename before public release if
  a conflict appears.

## Migration Plan

New project; no data migration. Existing legacy JSON pipelines keep working
through the adapter. A future Messages pipeline can be used immediately. No
database or report format migration.

## Open Questions

- Is `CucumberHtmlStream` + custom JS enough for the metadata/summary shell, or
  do we need a React shell earlier?
- Which legacy implementation is the second fixture after cucumber-js:
  cucumber-jvm or Behave?
- Is external-attachment mode required for v0.1, or can it wait? Answer: wait.
- What is the size threshold for the warning? Answer: 10 MB default,
  configurable with `--max-size`.
