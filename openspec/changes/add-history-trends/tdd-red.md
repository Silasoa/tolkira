# TDD-Red record — add-history-trends

Scope: failing tests and fixtures only. No `src/`, docs, config or commit.
Issue #10, spec approved. The implementer owns making these green without
weakening them.

## Files

New:

- `test/history.test.ts` — `src/history.ts` contract (18 tests).
- `test/cli-history.test.ts` — `--history` CLI flow, validation, collisions,
  write failure, dedupe and the no-flag guard (11 tests).
- `test/render-trends.test.ts` — Trends tab, table, pass rate, sparkline,
  escaping and no-JS panel state (9 tests).
- `test/e2e/trends.spec.ts` — two reports over one temp history, keyboard tabs,
  320/1440 px and 320 px at 200 % text (2 tests).
- `test/fixtures/history/two-runs.json` — two documented entries.
- `test/fixtures/history/thirty-runs.json` — 30 entries for read retention.
- `test/fixtures/history/corrupt.json` — truncated JSON.
- `test/fixtures/history/wrong-schema.json` — `schemaVersion: 2`.
- `test/fixtures/history/malformed-entry.json` — non-ISO `recordedAt`.

Changed:

- `test/dom-contract.test.ts` — always-present ids and the conditional
  `trendsView` are separate; new assertion for the constant and its absence.
- `test/render-modules.test.ts` — `trends` added at layer 1.
- `test/e2e/helpers.ts` — `writeReportWithHistory` writer.

## Red commands

```
npx vitest run test/history.test.ts test/cli-history.test.ts test/render-trends.test.ts test/dom-contract.test.ts test/render-modules.test.ts
npx playwright test test/e2e/trends.spec.ts --project=chromium
```

### Current result (red)

Vitest: 5 files failed, `21 failed | 27 passed`; the 18 history tests do not
load. Playwright: 2 failed.

Red reasons, all for the right reason:

- `test/history.test.ts` — `Cannot find module '../src/history.js'`
  (`ERR_MODULE_NOT_FOUND`). The whole suite waits on `src/history.ts`.
- `test/cli-history.test.ts` — 10 of 11 fail because `parseArgs` rejects
  `Unknown option '--history'` (exit 2 instead of 0/1). The collision and
  containment tests start with a control run that proves the flag works, so
  they fail on the missing option instead of passing on a false positive.
  The 11th test (no flag) passes by design: it is the unchanged-behaviour
  guard and must stay green after the implementation.
- `test/render-trends.test.ts` — 8 of 9 fail because `renderHtml` ignores the
  extra `history` option: `viewTabs` is `['report','analysis']`, and
  `id="trends-view"` is absent. The 0/1-entry test passes by design and must
  stay green.
- `test/dom-contract.test.ts` — `DOM_IDS.trendsView` is `undefined`, expected
  `'trends-view'`. The always-present id loop still passes.
- `test/render-modules.test.ts` — the module set has 9 entries, expected 10,
  and `src/render/trends.ts` is missing (`ENOENT`).
- `test/e2e/trends.spec.ts` — `runCli` exits 2 with the same unknown-option
  usage text, so no report with history can be generated yet.

## Contracts the tests pin

These are the details the design leaves open. Tests and fixtures are the
contract; do not change them to fit an implementation.

1. Sidecar shape: `{ "schemaVersion": 1, "runs": [HistoryRun] }`, UTF-8 JSON
   with a trailing newline on write.
2. `HistoryRun` has exactly `id`, `recordedAt`, `title`, `status`, `counts`
   (`features`, `scenarios`, `steps` as the full `StatusCounts`), `durationMs`,
   `attachments` (`total`, `bytes`). `readHistory` returns these documented
   fields only: unknown fields are ignored, not copied. The read path does not
   recompute or verify `id` (fixtures use synthetic 64-hex ids).
3. `--history` usage errors name the option and exit 2: empty value gives
   `--history requires a file path`; without `--out` names both options. The
   usage text lists `--history <file>`.
4. Sidecar read failures (invalid JSON, wrong schema, above 1 MB, malformed
   entry) exit 1, name the file and write nothing: no HTML, no file change.
5. The first run stores the resolved title (`Tolkira report` when `--title` is
   absent) and the summary aggregates. The second run renders both entries, the
   new one included.
6. Write failure happens after the HTML and leaves it in place with no temp
   file. The test makes replacement fail portably: POSIX refuses the temp file
   in a `0555` directory, Windows refuses the rename over a `0444` file.
7. Renderer: third tab `data-view="trends"` with
   `aria-controls="trends-view"`; panel `id="trends-view"`,
   `aria-labelledby="view-trends"`, `role="tabpanel"`, server-rendered
   `hidden`. Rendered only with `history.length >= 2`.
8. Table: rows in `<tbody>` newest first by `recordedAt`; the table sits in a
   `.tableWrap` element with `tabindex="0"`, `role="region"` and a non-empty
   `aria-label`; every `<th>` has `scope="col"`; pass rate is attempted
   (`total - skipped`) with one decimal and `—` for zero attempts.
9. Sparkline: one `<svg>` with `aria-hidden="true"` and a fixed
   `viewBox="0 0 <w> <h>"`; one `<circle class="sparkPoint">` per plotted run
   with `cx` ascending oldest-to-newest; segments as
   `<polyline class="sparkLine">` with `vector-effect="non-scaling-stroke"`.
   A run with zero attempts draws no point and breaks the segment, so two
   isolated points draw no line. These class names are the test contract.
10. `DOM_IDS.trendsView = 'trends-view'`, conditional; the other ids stay
    unconditional.
11. The E2E reports use `messages/second.ndjson` then
    `messages/all-statuses.ndjson`, titled `Trends first` and `Trends second`;
    the second report lists both, newest first. Keyboard: Report →
    ArrowRight → Details → ArrowRight → Trends, then `Home` back to Report.

## Notes for the implementer

- `test/render-trends.test.ts` declares `TrendRun` locally and passes
  `RenderOptions & { history?: TrendRun[] }`. Replace it with the real
  `HistoryRun`/`RenderOptions.history` and drop the local interface once they
  exist; keep the assertions unchanged.
- `RenderReportOptions` and `RenderOptions` both need the optional `history`
  list, and `RenderReportOptions` needs the resolved title used by
  `buildHistoryRun` (the CLI default is `Tolkira report`).
- Keep `writeAtomic` for the sidecar; `writeHistory` must not leave a `.tmp`
  file on success or failure.
