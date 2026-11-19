# Proposal

## Why

Tolkira is one run per report. Users who keep the HTML artifacts cannot see
whether pass rate, failures or duration improve across runs without opening
several files or building their own table. A hosted dashboard or telemetry is
out of scope; the product promise is one self-contained offline file.

## What Changes

- Add an opt-in `--history <file>` sidecar, used with `--out`. Without the flag
  nothing changes and no file is created.
- Store aggregate run entries only (recorded time, resolved title, status,
  scenario/step counts, features, duration, attachment totals), never scenario
  names, paths or attachments. `schemaVersion: 1`, documented.
- Keep the last 30 runs, append atomically, skip an identical last run (identity
  ignores the recorded time), and fail with a clear error on a corrupt,
  oversized or unsupported file instead of overwriting it.
- Render a Trends tab when at least two runs are available: a static table and
  an inline SVG sparkline of the pass rate. The tab needs JavaScript like
  Details; the static report stays the Report view.
- Keep the one-file default, the summary schema, CI text, exit codes and the
  network-free promise unchanged.

Out of scope: a default sidecar path, a server or database, telemetry,
scenario-level history, external assets, summary schema changes, and trend
charts beyond a simple sparkline.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-api`: add the opt-in history option, sidecar schema, validation, atomic
  write, retention and dedupe.
- `report-rendering`: add the conditional Trends tab, table and sparkline.

## Impact

- `src/history.ts` (new), `src/render/trends.ts` (new), `src/cli.ts`,
  `src/index.ts`, `src/options.ts`, `src/render/html.ts`,
  `src/render/format.ts`, `src/render/report-client.ts`,
  `src/render/dom-contract.ts`, `src/render/report.css`,
  `src/render/styles.ts` and `src/render/client-bundle.ts` (generated),
  unit/render/e2e tests, `docs/AGENT-INTERFACE.md`, `docs/LIMITATIONS.md`,
  `docs/COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `DESIGN.md`, `README.md`,
  `GLOSSARY.md`, `docs/CHANGELOG.md`.
- No runtime dependency, no summary/CI change, no network access.

## Review gate

PIR and DXR before implementation; implementation is a TDD pair; review swarm is
SCR, CR, DAR, UXR and CMP, plus a focused SEC pass on the sidecar as a new local
file read and its strings in the report. PCA is covered by the fixed 30-run cap.
Refs #10 and B-007.
