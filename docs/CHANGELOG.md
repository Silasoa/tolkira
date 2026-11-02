# Changelog

All notable changes to Tolkira are recorded here. The format follows
Keep a Changelog and the project uses semantic versioning.

## [Unreleased]

### Added

- Initial repository scaffold: product context, architecture, glossary,
  governance, review protocol, ADRs and OpenSpec bootstrap change.
- Toolchain: TypeScript 7 strict, oxlint, Vitest 5, esbuild, Playwright, CI
  matrix for Node 22/24/26 and npm release workflow.
- Cucumber Messages input and single-file HTML rendering via the official
  Cucumber formatter.
- Legacy Cucumber JSON adapter with features, scenarios, steps, tags, hooks,
  outlines, doc strings, data tables, statuses, durations and embeddings.
- Screenshot/text attachment preservation and a safe HTML attachment check.
- CLI and API: multiple inputs, directory input, title and repeated metadata.
- Escaped title/metadata, metadata bar, offline/no-CDN check.
- Fixtures for messages, legacy JSON, failed/pending/undefined/skipped statuses,
  screenshots and HTML attachments.
- Unit, golden-ish and Playwright browser tests.

### Not yet implemented

- Branding/dark-mode controls, external attachment mode, full edge-case matrix,
  JVM/Ruby/Behave fixtures beyond the adapter tests, release 0.1.0.
