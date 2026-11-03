# Open questions and autonomous status

2026-11-03. Working notes while the user is away. Research is in
`docs/research/`; production changes are committed separately.

## Research status

- `report-tools.md` — done. 11 report tools, table stakes, complaints,
  requested features, fit for Tolkira.
- `reporter-compatibility.md` — done. Old reporter APIs/options, mapping,
  two reproduced gaps, recommended shim.
- `framework-reporting.md` — done. Non-Cucumber frameworks, input formats
  (JUnit XML, CTRF, TAP, Allure, Playwright JSON), and a clear
  Cucumber-first recommendation.

## What the research changed

**Single-file is no longer a differentiator.** Allure 3 supports
`--single-file` through its Awesome plugin, and
`multiple-cucumber-html-reporter` 4.x ingests Cucumber Messages. Tolkira's
wedge is the combination: Cucumber-native legacy **and** Messages, one small
file, no telemetry, no server, embeddable, plus the agent-readable summary.

**The compatibility shim is cheap, but it is a migration aid, not the main
growth lever.** The old reporters and Tolkira already read the same legacy
JSON; the shim is an options mapper plus two gaps that are now fixed in core:
recursive input directories and output-parent creation.

**Breadth is not the strategy.** `framework-reporting.md` recommends staying
Cucumber-native. Playwright JSON is the one framework adapter candidate; CTRF
is a watch item; Karate and Reqnroll already fit via Cucumber JSON/Messages.
A generic JUnit XML renderer would lose steps and screenshots and turn the
product into a CI test list.

## Fixed while waiting

Commit `97ea2ea`:

- input directories are scanned recursively (depth 20, symlinks skipped,
  `node_modules`/`.git`/`.hg`/`.svn` ignored);
- the output parent directory is created before the atomic write.

Both were reproduced against `cucumber-html-reporter@7.2.0` behaviour and are
covered by tests.

## Compatibility shim (first slice shipped)

Shipped: `tolkira/compat/cucumber-html-reporter` with the old
`generate(options, callback?)` signature, option mapping, warnings,
`ignoreBadJsonFile`, docs and tests. `theme`, charts, external screenshots,
browser launch and unknown options warn and are ignored; the old HTML is never
transformed.

Still pending:

- `tolkira/compat/multiple-cucumber-html-reporter` with async
  `generate(options)` and `reportPath` mapping.
- `tolkira compat <reporter> --options <file> --dry-run`.

Decision needed: finish both in v0.1 or defer to v0.2. Default: finish the
multiple-cucumber-html-reporter helper and CLI only if the first slice gets
real use; otherwise v0.2.

## Framework expansion (research complete)

`framework-reporting.md` answers the question: **do not become a generic
multi-framework formatter.** Stay Cucumber-native.

- **Playwright JSON** is the one framework adapter candidate: largest e2e
  audience, steps/retries/projects/errors/attachment references in one file.
  Costs: no schema version, path-based attachments. Keep it the only adapter.
- **CTRF** is the best generic model (steps, retries, one base64 screenshot,
  attachment paths) but pre-1.0 and small. Watch it; spike behind an
  experimental flag at 1.0.
- **Free wins:** Karate emits Cucumber JSON (`outputCucumberJson(true)`) and
  Reqnroll emits Cucumber Messages. Document both with fixtures; no adapter.
- **Reject:** a generic JUnit XML renderer as the flagship, TAP, Allure-results
  ingestion, pytest-html HTML/JSON scraping, Cypress Cloud/Test Replay, and a
  .NET TRX parser. JUnit XML is a lossy fallback only.

Default until the user says otherwise: Cucumber-first, no second input family.
Playwright JSON is a candidate for v0.2, not v0.1.

## UI

- The user prefers A. The lead record was removed; every scenario row now
  reserves a thumbnail column (also on mobile); the mobile feature header and
  the grid-area leak are fixed; search opens collapsed features; empty state
  added.
- Production UI change is **not started**. The updated prototype should be
  reviewed first.
- The Analysis tab is currently detail duplication. Default for v0.1: rename
  it to **Details** and add an environment block (producer, runtime, OS, CPU,
  protocol version, user metadata). Trends/charts/history stay Advanced.

## Metadata

- Producer, runtime, OS, CPU and protocol version come from the Messages
  `meta` envelope and can be shown automatically.
- Browser and run mode are not in Messages; the old reporter also only showed
  them when passed as `metadata`. Keep `--meta "Browser=..."` and
  `--meta "Mode=..."`, and make the environment block visible.

## Advanced backlog

- Multi-select with checkboxes/Shift, select all, copy/download selected
  scenarios as JSON.
- A visible action menu (not a right-click-only menu) for keyboard and touch.
- Screenshot lightbox with zoom/download.
- Retry-aware rows, slowest scenarios panel, optional local history file.
- Status donut (inline SVG) in Details if the old pie-chart feel is wanted.

## Product docs

`docs/PRODUCT.md` still says Allure 3 is not single-file and
`multiple-cucumber-html-reporter` is legacy-JSON only. Both are outdated.
Update after the user confirms the positioning correction; do not change the
wedge statement.

## For the user (non-blocking)

1. Compatibility shim: v0.1 or v0.2? Default: v0.1 thin adapter.
2. Playwright JSON adapter: v0.2 or later? Research says it is the only
   framework adapter worth building; default: after the Cucumber core, not
   v0.1.
3. Analysis tab: rename to Details for v0.1? Default: yes.
4. Production UI: implement A after reviewing the updated prototype? Default:
   wait for the user's go-ahead because it is a visible character change.
5. PRODUCT.md competitive facts: update to Allure 3 single-file and MCHR
   Messages support? Default: yes, factual correction only.
