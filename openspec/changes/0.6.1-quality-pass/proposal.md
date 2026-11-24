# 0.6.1-quality-pass

## Why

Three accepted P3 defects remain after 0.6.0, plus one test-only gap. No remote
issue exists; the tracking rows are local backlog items B-048, B-039, B-049 and
B-054.

- B-048: the default report renders three `<main>` elements (Report, Details,
  Trends), which is invalid HTML. The static report already has one; the
  default form still has three.
- B-039: at 320 px and 200 % text the Details metadata list squeezes its label
  column and turns long value links into a narrow, ragged column.
- B-049: a UTF-8 BOM before the history sidecar JSON makes `readHistory` reject
  an otherwise valid file.
- B-054: a green e2e run leaves no visual evidence. Playwright captures a
  screenshot only for a failed test, so the shell is never recorded at the gate
  viewports for a passing run.

The static change deliberately left B-048 as the default report's recorded
defect. This patch closes it, the two smaller reader/layout defects, and adds
the capture that would have shown the shell at each gate viewport, before the
next report-shell change has to carry them.

## What Changes

- The default report has exactly one `<main>`, on the Report view. Details and
  Trends become plain containers and keep the `tabPanel` class,
  `role="tabpanel"`, the `analysis-view`/`trends-view` IDs and the
  `#analysis-view, #trends-view` print page-break rule. The static report keeps
  its one `<main>`.
- The Details metadata list stacks label over value at 320 px and 200 % text,
  with start-aligned values; long unbroken URLs wrap and the page does not
  scroll horizontally. At 320 px and 390 px and wider at 100 % text, and at
  768 px and wider at the gate, the existing two-column layout is unchanged.
- The shared sidecar read strips exactly one leading U+FEFF, so `readHistory`
  and the schema peek used by `writeHistory` accept a BOM-prefixed file. A
  BOM-only file and a BOM followed by invalid JSON still fail with the existing
  `not valid JSON` error, and a read never rewrites the file. The writer emits
  no BOM and its next successful write normalises a BOM-prefixed file.
- One e2e test writes viewport captures of the default and the static report
  under `test-results/visual/<engine>/` (1440 and 390 px, plus 320 px at 200 %
  text for both forms), so a green run leaves images to inspect. No pixel
  assertions, no committed image, no new dependency.
- `docs/CHANGELOG.md` gains a `0.6.1` section. The package version stays 0.6.0
  and this change creates no tag, stage or publish.

## Impact

- Capabilities: `report-rendering` and `cli-api`.
- Code: `src/render/details.ts`, `src/render/trends.ts`,
  `src/render/report.css` (regenerate `src/render/styles.ts`),
  `src/render/html.ts` (German narrow override) and `src/history.ts`.
- Tests: the default/static render suites, the characterization hashes, the two
  golden HTML files, `test/history.test.ts`, the report-shell viewport and
  metadata e2e suites, and one new visual-capture e2e test. All nine default
  characterization hashes and the two-run history hash are intentionally
  re-pinned.
- Docs: `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`,
  `docs/LIMITATIONS.md`, `docs/BACKLOG.md` (B-039, B-048, B-049, B-054) and
  `docs/CHANGELOG.md`.
- The report HTML changes by the two wrapper replacements and the narrow CSS
  string. The JSON summary, CI text, email, history output, CLI options, public
  API signatures, summary schema, dependency surface and network behaviour do
  not change.

## Out of scope

- A version bump, release preparation, tag, stage or publish; the 0.6.1 section
  is written in this change but the release remains a separate user decision.
- Normalising a BOM-prefixed sidecar on a read; the normalisation happens only
  when the next successful write replaces the file.
- Other encodings (UTF-16, BOM after whitespace, more than one BOM).
- A tab-shell redesign, removing tab roles, or changing the active-view
  behaviour.
- A header metadata layout change; B-039 covers the Details list, not the
  header.
- The remaining backlog rows, including B-050 to B-053.
- Re-running the full five-host release matrix; the two shell-relevant rows
  named in the tasks are the minimum for this patch.

## Decisions

- The Report view keeps the only `<main>`; Details and Trends use a `<div>` with
  the existing `shell` class so no CSS box or print break changes.
- The narrow metadata fix is only active in the 320 px / 200 % text condition;
  normal text keeps the two-column, right-aligned list.
- The BOM fix strips exactly one BOM in the shared bounded sidecar read, so the
  reader and the writer's schema peek accept it; the writer stays BOM-free and
  normalises on the next successful write. This matches the baseline reader's
  one-BOM rule.
