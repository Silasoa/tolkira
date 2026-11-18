# Proposal

## Why

The first Playwright OSS comparison (#24) showed that a native-run report reads
wrong in several places although the underlying data is correct. A reported skip
inflates the pass-rate denominator, so 11 passed of 13 reads as 84.6 % while one
of the 13 never ran. A project feature that spans four spec files names one
arbitrary file. The expected-failure block prints its location twice. The
Details tab calls the environment “Cucumber” for a Playwright-only run. The
displayed duration is a sum but reads like wall-clock time.

## What Changes

- Treat a reported skip as an executed result in the contract: `executed` stays
  `true`, the definition in `docs/AGENT-INTERFACE.md` and `GLOSSARY.md` is
  broadened, and the summary shape stays unchanged.
- Compute the Report and Details pass ratios over attempted (non-skipped)
  scenarios. Skipped scenarios stay in counts, pills, filters and proportion
  bars, and are still named in the feature text. A skipped-only run says `No
  scenarios attempted`; an empty run keeps `0%` and `0 / 0`.
- Show `N scenarios with results` in the header and name unexecuted rows
  separately instead of calling every result “executed”.
- Show `N spec files` when a feature's scenarios reduce to several display
  URIs; keep the single path otherwise. The Report row, triage title and
  Details matrix use the same label.
- Emit each Playwright error location once, for `<file>:<line>:<column>` and the
  shorter forms.
- Rename the environment heading to `Run environment` for all producers, label
  the run duration `Test time` and the matrix column `Scenario time`, and
  explain the sums in Details and the docs.
- Update unit tests, browser tests and the affected docs.

Out of scope: attachment-loss warnings, flaky status and retry history, a
failed-only filter, summary schema changes, changes to Cucumber or JUnit data,
and triage behaviour for skipped results.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: pass ratios, reported/unexecuted counts, multi-file
  feature source, environment heading, duration labels and the summary-v2
  `executed` definition.
- `input-formats`: one source-location line per Playwright error.

## Impact

- `src/render/html.ts`, `src/input/playwright.ts`, unit and browser tests,
  `docs/AGENT-INTERFACE.md`, `docs/PLAYWRIGHT-JSON.md`, `GLOSSARY.md`,
  `docs/CHANGELOG.md`.
- No runtime dependency, no summary schema change, no network access, no new
  option.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair; review
swarm is SCR, CR, DAR, UXR and CMP. Refs #24 and #25.
