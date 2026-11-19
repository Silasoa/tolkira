# Proposal

## Why

#24 finding 3: Playwright path attachments are embedded only when they resolve
inside the input file's folder or the working directory. When the JSON is read
from outside the project root, files under `test-results` are dropped without a
signal. The comparison run from the fixture folder had 4 attachments / 123 bytes
and no screenshots; from the project root 8 / 788,715 bytes. The report still
claims screenshots are embedded, so it looks complete when it is not.

## What Changes

- Count path attachments that exist but resolve outside every allowed root, once
  per attachment, for final attempts only. Trace zips stay excluded by design.
- Carry one summed count per run to the HTML shell and render a static, escaped
  notice visible on Report and Details. The notice names the count and the roots
  by role, never an absolute path.
- Replace the footer's blanket “Screenshots are embedded.” with “Attachments are
  embedded when available.” for every report.
- Write one warning line to stderr when the CLI writes HTML with skipped
  attachments. stdout, `--json`, `--ci` and exit codes stay unchanged.
- Push the same warning into the compat shim's existing `warnings` array.
- Expose the count on the `generateReport` result and document the warning.

Out of scope: external or split assets (#11), a `warnings` field in summary v2,
missing-file detection, and per-attachment names or paths. The `--json`/`--ci`
silence and the missing-file silence are recorded as backlog decisions with
triggers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `input-formats`: count Playwright path attachments skipped outside the roots
  and expose the count from the adapter.
- `report-rendering`: show the skipped-attachment notice and adjust the footer.
- `cli-api`: warn on stderr and expose the count from `generateReport`.

## Impact

- `src/input/playwright.ts`, `src/input/load.ts`, `src/index.ts`,
  `src/warnings.ts` (new), `src/render/html.ts`,
  `src/render/report.css`/`src/render/styles.ts`, `src/cli.ts`,
  `src/compat/cucumber-html-reporter.ts`, unit/render/e2e tests,
  `docs/PLAYWRIGHT-JSON.md`, `docs/AGENT-INTERFACE.md`, `docs/LIMITATIONS.md`,
  `GLOSSARY.md`, `docs/CHANGELOG.md`, `docs/BACKLOG.md`.
- No runtime dependency, no summary schema change, no network access, no exit
  code change.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair; review
swarm is SCR, CR, DAR, UXR and CMP. Refs #24 and #26.
