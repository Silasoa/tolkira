# Open questions and autonomous status

2026-11-03. Working notes while the user is away. Research is in
`docs/research/`; production changes are committed separately.

## Research status

- `report-tools.md` — done. 11 report tools, table stakes, complaints,
  requested features, fit for Tolkira.
- `reporter-compatibility.md` — done. Old reporter APIs/options, mapping,
  two reproduced gaps, recommended shim.
- `framework-reporting.md` — running. Non-Cucumber frameworks, their HTML
  reporters, input formats (JUnit XML, CTRF, TAP, Allure), and whether a
  generic adapter is worth it.

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

## Fixed while waiting

Commit `97ea2ea`:

- input directories are scanned recursively (depth 20, symlinks skipped,
  `node_modules`/`.git`/`.hg`/`.svn` ignored);
- the output parent directory is created before the atomic write.

Both were reproduced against `cucumber-html-reporter@7.2.0` behaviour and are
covered by tests.

## Compatibility shim (recommended, not started)

Proposed shape:

- `tolkira/compat/cucumber-html-reporter` with the old
  `generate(options, callback?)` signature.
- `tolkira/compat/multiple-cucumber-html-reporter` with async
  `generate(options)`.
- `tolkira compat <reporter> --options <file> --dry-run`.
- Mapping: inputs, `output`/`reportPath`, title, metadata, logo; themes,
  charts, external screenshots, custom CSS/JS, i18n, email and browser launch
  warn and are ignored. No transformation of old HTML.

Decision needed: v0.1 or v0.2. Default if no answer: v0.1 only if it stays a
thin adapter; otherwise v0.2 with split assets.

## Framework expansion (pending research)

Question: should Tolkira become an HTML formatter for non-Cucumber frameworks,
and if so via a generic input format (JUnit XML, CTRF, TAP, Allure results) or
per-framework adapters?

Default until `framework-reporting.md` lands: keep the Cucumber core, do not
add a second input family. A generic JUnit XML adapter is the likely second
path, but it loses Gherkin steps and most screenshots, so it is a product
decision, not a quick adapter.

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
Update after the framework research is in; do not change the wedge statement.

## For the user (non-blocking)

1. Compatibility shim: v0.1 or v0.2? Default: v0.1 thin adapter.
2. Framework expansion: Cucumber-first or generic input? Waiting for research;
   default Cucumber-first.
3. Analysis tab: rename to Details for v0.1? Default: yes.
4. Production UI: implement A after reviewing the updated prototype? Default:
   wait for the user's go-ahead because it is a visible character change.
