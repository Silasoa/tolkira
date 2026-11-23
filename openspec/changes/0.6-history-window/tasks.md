# Tasks

## 1. Gate

- [x] 1.1 PIR + DXR over the proposal, spec delta and design; fold blockers
  into the contract before Red. (2026-11-23)
- [x] 1.2 Confirm the history read/append/write signatures, the 1 MiB cap and
  the default byte parity; no new schema or dependency. (2026-11-23)
- [x] 1.3 Confirm the maximum (365), the flag name and the destructive lower
  limit with the user. (2026-11-23; the user approved the four specs.)

## 2. TDD-Red

- [x] 2.1 Unit: read, append and write with limits 1, 5, 30, 31, 40 and 365;
  the newest entries survive; dedupe keeps the old timestamp; an omitted limit
  is exactly 30.
- [x] 2.2 Retention: a 31-entry file read with 10 returns 10 and the next write
  stores 10; read with 40 returns 31 and the next write stores 32; a 40-entry
  file with 40 appends and stores 40 of 41; lower then raise cannot restore.
- [x] 2.3 Schema: a default write on a schema-1 file stays schema 1; a write
  with limit 40 writes schema 2; a schema-2 file read with the default stays
  schema 2; the 0.5 reader rejects schema 2 without a rewrite; the writer prunes
  to 1,048,576 bytes and the newest entry remains.
- [x] 2.4 CLI: smaller, larger and one-run windows; the default report/CI/email
  bytes are identical; the default JSON is byte-identical in the current tree,
  and the additive outline `example` is the only final 0.6.0 delta, owned by the
  baseline change; `0`, `366`, `1.5`, `abc`, `05`, empty and no `--history`
  exit 2; no `--out` keeps the existing error.
- [x] 2.5 API: each function with a limit; `generateReport` returns the bounded
  list; `renderReport` renders a 40-entry list unchanged; an invalid limit
  throws.
- [x] 2.6 Trends: five rows for a five-run window; no Trends tab for one run;
  the sparkline still plots the bounded list.
- [x] 2.7 Limits: a file above 1 MiB and an invalid entry still reject without a
  rewrite.
- [x] 2.8 Size: record the Trends bytes for a 365-run report. Command
  `node scripts/history-window.mjs` after `npm run build`. Windows 11 Pro
  10.0.26300, Node v26.13.1, 2026-11-23: report 206,525 bytes at
  `--history-limit 365` vs 83,286 bytes at the default 30 (delta 123,239 bytes
  for 365 vs 30 Trends rows); 365-run schema-2 sidecar 297,151 bytes and
  367,596 bytes with 200-character titles, both below the 1,048,576-byte cap,
  no writer prune. The 365-run report is far below the 10 MB (10,485,760-byte)
  default `--max-size` threshold, so no report-size warning fires. These replace
  the earlier ad-hoc numbers (206,601 / 83,289 / 295,045 / 365,490); the script
  pins the synthetic summary shape and the difference is measurement input, not
  behaviour.
- [x] 2.9 Confirm RED; no existing test is deleted or weakened. (Red phase; the
  round-2 dedupe and fixture adaptations are mapped under "Red tests were not
  weakened".)

## 3. Implement

- [x] 3.1 Add the limit constant, validation and the optional parameter to
  `readHistory`, `appendHistory` and `writeHistory`; add the schema-1/2 reader
  and writer choice and the writer's 1 MiB prune.
- [x] 3.2 Add `--history-limit` parsing, the `--history` requirement and the
  CLI wiring; pass the same limit to read, generate and write.
- [x] 3.3 Add `GenerateReportOptions.historyLimit`; keep `renderReport` and the
  stream rendering the list as given.
- [x] 3.4 Document the window, the 1 to 365 range, the destructive lower limit,
  the schema-1/2 rule, the 0.5 reader rejection, the writer's 1 MiB prune, the
  architecture seam and the 1 MiB cap; fix the stale "30 runs" text in
  `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`,
  `docs/PRODUCT.md:109` and `GLOSSARY.md:175-178`; record the 365-run size
  measurement. Done in the 2026-11-23 documentation slice, including the
  `README.md`, `docs/CI.md`, `docs/CHANGELOG.md` and `docs/BACKLOG.md` updates;
  the size record is under 2.8 and 4.4.

## 4. Verification and review

- [x] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e` for the Trends
  browser spec.
- [x] 4.2 SCR, CR, DAR, STR, CMP and UXR (320 px and 200 % text with a
  365-point sparkline); PCA if the sparkline/table loop changes. Round 2 closed
  on 2026-11-23; every finding is fixed or recorded under "Review findings
  (round 2)" below. UXR blocker: the 320 px / 200 % tab strip clips the third
  tab; user decision 2026-11-23 defers it to `0.6-static-no-js` task 3.5.
- [x] 4.3 Run the relevant `docs/DROP-IN-VALIDATION.md` rows on the final tree
  and record host, pin and result. No host row is required: the change touches
  the CLI, the sidecar and the Trends list, not an adapter, the report shell,
  print, PDF, email or the shim. The record is the `history-window` re-check in
  `docs/DROP-IN-VALIDATION.md` plus the 0.5.0 older-reader check below. Written,
  user-approved exception (2026-11-23): this change is report-level (the Trends
  tab appears at two or more runs), so `test/e2e/trends.spec.ts` runs, but the
  320 px / 200 % tab-visibility row stays red until `0.6-static-no-js` task 3.5
  fixes the pre-existing tab-strip clipping. That row did not pass.
- [x] 4.4 Record the 365-run Trends bytes and the default byte parity. Command
  `node scripts/history-window.mjs` after `npm run build`; Windows 11 Pro
  10.0.26300, Node v26.13.1, 2026-11-23: 365-run report 206,525 bytes vs 83,286
  bytes at the default 30 (delta 123,239 bytes for 365 vs 30 Trends rows); the
  365-run schema-2 sidecar is 297,151 bytes (367,596 with 200-character titles),
  below the 1,048,576-byte cap, and the writer pruned nothing. The 365-run
  report is far below the 10 MB default `--max-size` threshold, so no size
  warning fires. Default parity: implicit default and explicit
  `--history-limit 30` produce byte-identical report, email, CI and sidecar
  bytes, pinned by `test/cli-history-window.test.ts`; the default window is
  still 30. Against the published `tolkira@0.5.1` package, the default report,
  CI and JSON with `test/fixtures/history/thirty-runs.json` were byte-identical;
  the email differed only in its generated timestamp (same byte length). The
  current tree's JSON is byte-identical; the additive outline `example` field is
  the only final 0.6.0 delta and is owned by the baseline change.
- [x] 4.5 Fix findings; record deferred decisions with a trigger. Round 2
  closed 2026-11-23: all 33 findings are fixed or explicitly recorded; the
  accepted no-actions are the O(n²) prune (bounded by 365 entries; SEC measured
  ≤ 584 ms worst synthetic case), the BOM strip (B-049), the `wrong-schema.json`
  fixture name (Red file, cosmetic) and the test-helper extraction (~60 lines,
  would touch Red files for no coverage gain).

Review findings (2026-11-23): PIR/DXR found the retention scenarios ignored the
appended current run (B4/D4), "default bytes match" contradicted the
unconditional outline `example` (B5), the schema change was missing, so an older
reader would silently truncate a larger window (D2/B8), the writer could exceed
the 1 MiB read cap (D3/I11), the path list omitted `--baseline` (I7/D15), and
the docs list omitted `GLOSSARY.md` and `docs/PRODUCT.md` (I13/I14/D20). The
retention rule is now read n → append unless dedupe → keep newest n, readers
accept schema 1 and 2 with schema 2 only above 30 or on an already schema-2 file,
the writer prunes to 1,048,576 bytes, the path list includes `--baseline`, and
the reviewer set adds CMP and a 320 px UXR check. 3.1–3.4 are implemented and
recorded below; the documentation slice closes 3.4.

## Review findings (round 2, 2026-11-23)

Post-implementation reviews (SCR, CR, DAR, STR, CMP, UXR). Every finding is
fixed or explicitly recorded; nothing is silently dropped.

### Code

- A1 Writer/reader mismatch: fixed in `src/history.ts`. The field rules moved
  behind a shared `parseRun` validator that read and write both call; `writeHistory`
  caps titles, validates every stored run, rejects an id longer than
  `HISTORY_MAX_ID = 128` and, after the prune loop, throws
  `Cannot write history file <file>: ...` when the serialized result is still
  above 1,048,576 bytes. The reader still accepts longer ids from older files.
  Tests: over-long id (new file and existing file), NaN duration, oversized,
  malformed and unsupported-schema targets, largest valid window, exact cap.
  The "newest single entry above the cap" case is not constructible through the
  public API: the id and title caps bound one entry to about 2 KB and a 365-run
  file to about 640 KB. The guard stays as defence in depth and the
  largest-window test pins that precondition instead; recorded, not skipped
  silently.
- A1 follow-up (2026-11-23): `parseRun` no longer rejects a stored title longer
  than 200 characters on read, so the reader is as permissive about titles as
  0.5.1 and the spec's invalid-entry list stays the whole rule set. `capTitle`
  in `writeHistory` is the single enforcement point and still stores at most 200
  characters. Pinned by "reads a hand-edited long title and caps it on the next
  write" in `test/history-window.test.ts`.
- A2 Unbounded schema peek: fixed. One internal `readSidecar` (non-blocking
  open, `fstat`, regular-file check, 1 MiB cap, bounded read) serves
  `readHistory` and `storedSchema`; `readHistory(file, limit?)` is unchanged.
  `ENOENT` is schema 1; oversized, unreadable, invalid JSON or an unsupported
  schema throws `Cannot write history file <file>: ...` instead of downgrading.
  Documented in `docs/AGENT-INTERFACE.md`. Tests cover the oversized, malformed
  and unsupported-schema target; schema 2 preservation stays pinned by the
  existing never-downgrades test.
- A3 `HISTORY_SCHEMA_VERSION` clarified: `HISTORY_SCHEMA_VERSION_MAX = 2` is
  exported from `src/index.ts` and documented as the highest accepted version;
  `HISTORY_MAX_ID` is exported too. `dist/index.d.ts` only gains those names.
- A4 `src/cli.ts` wraps the `--history-limit` value in `oneLine`.
- A5 `historyWindow` uses `excerpt` (number-aware), so a string `'10'` is quoted
  and `NaN` reads `"NaN"`, not `"null"`; a unit test pins both messages.
- A6 The `--history-limit` requirement check moved above the generic usage check
  (model: `--pdf-timeout`); the post-parse duplicate is gone, so
  `tolkira in --history-limit 10` names both options. The test covers both the
  with-`--out` and the bare form.
- A7 The help line is built from `HISTORY_LIMIT` and `HISTORY_LIMIT_MAX`; the
  help test asserts the rendered range text.
- A8 `historyConflicts` takes `pdfPath`; the error names `--pdf`.

### Tests

- B9 Duplicate CLI blocks: fixed. The `--pdf` and `--email` collision rows moved
  into `test/cli-history.test.ts`; both blocks in
  `test/cli-history-window.test.ts` are deleted. Mapping below.
- B10 CLI error tests assert the first stderr line (the exact
  `Invalid --history-limit ...` / `--history-limit requires --history` text),
  not a substring that the usage dump also contains.
- B11 Cap boundary: `readHistory` accepts a file of exactly 1,048,576 bytes and
  rejects 1,048,577; the largest accepted window is written whole without
  pruning. A writer output at exactly the cap is not constructible for the same
  cap reason as A1; the two constructible halves are pinned.
- B12 The default test is renamed to implicit-vs-explicit-30 parity in the same
  build; the previous-release evidence stays under 4.4.
- B13 The five-run CLI test now asserts five `sparkPoint` markers as well as
  five Trends rows.

### Contract and docs

- C14 The delta gains a MODIFIED "Document the history schema" requirement
  (reader 1/2, writer 1 by default and 2 above 30 or on an existing schema-2
  file, 0.5 rejects 2, id/title caps, cap guard). `openspec validate --strict`
  passes. The main spec's "last 30 runs" lines (324-331, 354-358) are covered by
  the already-MODIFIED "Keep an opt-in run history", whose Retention scenario
  now says "the newest configured number".
- C15 The Default scenario now says report and CI match the previous release,
  the email matches except its generated timestamp, and the JSON is
  byte-identical today with the outline `example` owned by the baseline change.
- C16 `scripts/history-window.mjs` reproduces the measurement; the numbers in
  this file and the docs are updated to 206,525 / 83,286 / 123,239 / 297,151 /
  367,596 and the record says the earlier ad-hoc numbers were replaced.
- C17 B-044 is in the canonical Resolved list; the slice note is trimmed to a
  pointer.
- C18 `docs/AGENT-INTERFACE.md` and `docs/ARCHITECTURE.md` add `--pdf` to the
  history path list and note that `--baseline` arrives with the baseline change.
- C19 The measurement host is named in `docs/CHANGELOG.md` and
  `docs/ARCHITECTURE.md`.
- C20 `design.md` and `proposal.md` replace the open questions with the
  user-approved decisions.
- C21 2.4 and 4.4 state that the current JSON is byte-identical and the outline
  `example` is the final 0.6.0 delta owned by the baseline change.
- C22 The docs state the id/title caps and that the writer validates runs and
  rejects an oversized result, so the "never writes a file the reader would
  reject" guarantee is now true as written.
- C23 `docs/ARCHITECTURE.md` documents `historyLimit` on `generateReport`.
- C24 The delta's path-safety row marks `--baseline` as owned by
  `0.6-baseline-comparison`; the note stays in both tasks files.
- C25 The proposal Impact list drops `src/options.ts` and adds `README.md`,
  `docs/CI.md`, `docs/CHANGELOG.md` and the measurement script.
- C26 The changelog splits the option (Added) from the schema-2 write, the
  destructive lower limit and the writer validation (Changed).
- C27/C32 The `docs/LIMITATIONS.md` window row is shortened and says "the oldest
  runs beyond the new window".
- C28 The size record states that 206,525 bytes is below the 10 MB default
  `--max-size` threshold, so no warning fires. The review note said 1 MB; the
  report threshold is 10 MB (the 1 MiB figure is the sidecar cap), so the record
  uses the correct threshold.
- C29 The docs say "a 0.5 reader" instead of "0.5.x"; the older-reader check
  pins 0.5.0, the parity run used 0.5.1, and both share the reader.
- C30 The glossary says "The history limit sets it."
- C31 The unverified default-window byte sentence is removed from
  `docs/CI.md`.
- C33 The `history-window` re-check is recorded in
  `docs/DROP-IN-VALIDATION.md`: no host row is required, with the 0.5.0
  older-reader check as the compatibility evidence.

### Shell findings (no code change here)

- UXR blocker: at 320 px / 200 % text the tab strip clips the third tab
  (`src/render/report.css:72-74`, `.views` nowrap plus `overflow-x: auto`). User
  decision 2026-11-23: deferred to `0.6-static-no-js` task 3.5, because the
  clipping is pre-existing since 0.5.0 when the third tab landed, is not caused
  by the history window, and the static change rewrites the tab bar. Trigger:
  task 3.5. This change does not claim the row passed (see 4.3).
- D The three UXR minors (print header mid-word, `Current` tag wrapping, 200 %
  sparkline letterboxing) are recorded in `0.6-static-no-js` task 3.5. The
  roving-tabindex and sparkline `aria-hidden` notes are recorded there as
  decisions with no action.

### Accepted, no action

- O(n²) prune: bounded by 365 entries; SEC measured ≤ 584 ms in the worst
  synthetic case.
- BOM strip: pre-existing; filed as B-049 with a trigger.
- `test/fixtures/history/wrong-schema.json` name: Red file, cosmetic.
- Test-helper extraction: about 60 lines; it would touch Red test files for no
  coverage gain.

### Red tests were not weakened

The Red tests from `e8093fc` were not loosened. Deleted duplicate blocks and
their assertion mapping:

- `test/cli-history-window.test.ts` "CLI history path safety with a window"
  (input, logo, `--out`, `--pdf`, `--email`, `--ci-out`, missing path and nested
  missing path inside an input directory; control run; output never written):
  mapped to `test/cli-history.test.ts` "rejects a history path that names an
  input, the logo, --out, --pdf, --email or --ci-out" (control, input/logo
  bytes, all four output collisions, ENOENT for every output) and "rejects a
  history path inside an input directory even when it is missing" (missing and
  nested missing paths). The `--history` message assertion survives in "reports
  the history path conflict before reading the logo".
- `test/cli-history-window.test.ts` "exits 1 and keeps the HTML when the sidecar
  cannot be written": mapped to `test/cli-history.test.ts` "exits 1 and keeps
  the HTML when the sidecar cannot be written", which now passes
  `--history-limit 5` so the limit × write-failure pairwise row survives. The
  oversized/malformed-with-limit-40 `it.each` in the window file is kept because
  it is not duplicated.
- `test/history-window.test.ts` "prunes the oldest entries to 1 MiB": its
  fixture (400 runs with 6,006-character ids) is now rejected by the id cap, so
  the prune path is unreachable for accepted input. The replacement asserts the
  same guarantees on the largest accepted window (bytes ≤ cap, schema 2, all 365
  entries kept, ids match, re-reads), plus the exact cap boundary and the caps
  themselves. No assertion was loosened; the changed expectation (`365 kept`
  instead of `< 365`) follows from the new caps and is stronger for the
  reachable contract.
- `test/history.test.ts` "writes schema version 1 JSON atomically": the "stale
  content" fixture became a valid older sidecar because a malformed target is
  now rejected by contract; every assertion is unchanged.

## Implementation record (2026-11-23)

- Red baseline at `e8093fc`: 50 failing tests and 8 passing regression guards in
  `test/history-window.test.ts` and `test/cli-history-window.test.ts`. No Red
  test was edited, skipped or loosened; 3.1-3.3 and 4.1 are now green.
- Implementation: `src/history.ts` (limit validation, schema 1/2 read and write,
  writer 1 MiB prune), `src/run.ts` (`GenerateReportOptions.historyLimit`),
  `src/index.ts` (`HISTORY_LIMIT_MAX`, `GenerateReportOptions` export) and
  `src/cli.ts` (`--history-limit`, its requirement checks and help text).
- `--baseline` does not exist yet. The `0.6-baseline-comparison` change owns the
  `--baseline` path-collision row and adds `--baseline` to the history path list
  when the flag lands; the same note is recorded in its `tasks.md`.
  `--history-limit` is a number, not a path, so it adds no collision row.
- The "0.5 reader rejects schema 2 and leaves it untouched" scenario has no
  public seam: the guard is private and the published 0.5 package is the only
  0.5 reader. It was verified once manually instead of with a test that imports
  a private guard. No test was added for it.
- Round 2: `src/history.ts` gains the shared `parseRun` validator used by read
  and write, `HISTORY_MAX_ID = 128`, `HISTORY_SCHEMA_VERSION_MAX = 2`, the
  shared bounded `readSidecar` used by `readHistory` and the schema peek, and
  the post-prune cap guard; `src/cli.ts` builds the help line from the
  constants, wraps the limit value in `oneLine`, checks the requirement before
  the generic usage text and includes `--pdf` in the history collision;
  `src/index.ts` exports `HISTORY_MAX_ID` and `HISTORY_SCHEMA_VERSION_MAX`.

### Manual older-reader check

- Package pin: `tolkira@0.5.0`, integrity
  `sha512-Ml6BUCmRdNDqXA3yPrgpQof+t8YcGegruXaQDdft4gr8FU4jXs2iI0OUTrhCN07eumjZylHQYkqe+YhYuWx6UQ==`.
- Host: Windows 11 Pro 10.0.26300, Node v26.13.1, npm 10.8.2, 2026-11-23.
- Setup: a valid sidecar based on `test/fixtures/history/two-runs.json` with
  `schemaVersion` set to 2, plus `test/fixtures/messages/second.ndjson`.
- Command: `npx --yes tolkira@0.5.0 <input> --out <report.html> --history
  <sidecar>`.
- Result: exit 1; stderr `Invalid history file <sidecar>: unsupported schema
  version "2"`; sidecar SHA-256 unchanged; no report written. Pass.

### Size measurement (2026-11-23)

- Command: `npm run build` then `node scripts/history-window.mjs`.
- Host: Windows 11 Pro 10.0.26300, Node v26.13.1, 2026-11-23.
- Output:

  ```json
  {
    "host": "Windows 11 Pro 10.0.26300, Node v26.13.1",
    "runs": 365,
    "reportBytes": {
      "default": 83286,
      "atMax": 206525,
      "delta": 123239,
      "maxSizeThreshold": 10485760
    },
    "sidecar": {
      "bytes": 297151,
      "cap": 1048576,
      "pruned": false,
      "title200Bytes": 367596,
      "title200Pruned": false
    }
  }
  ```

- The script builds the 365-run sidecar through the real `buildHistoryRun`,
  `appendHistory` and `writeHistory` API with a fixed clock and deterministic
  synthetic summaries, then renders `test/fixtures/messages/second.ndjson` at
  `--history-limit 365` and at the default 30 from copies of the same sidecar.
- The report is 206,525 bytes at 365 runs and 83,286 at 30 (delta 123,239),
  below the 10 MB (10,485,760-byte) default `--max-size` threshold, so no
  report-size warning fires. The sidecar is schema 2, 297,151 bytes with short
  titles and 367,596 with 200-character titles, below the 1,048,576-byte cap;
  the writer pruned nothing.
- These numbers replace the earlier ad-hoc measurement (206,601 / 83,289 /
  295,045 / 365,490). The synthetic summary shape is now fixed in the script, so
  the record is reproducible; the difference is the measurement input, not a
  behaviour change.
- The sidecar and reports are generated in a temp directory and not committed.

## Gate record

- PIR/DXR: see the round-1 review findings above (2026-11-23).
- Post-implementation reviews (round 2): see "Review findings (round 2)".
- Focused tests: `npx vitest run test/history-window.test.ts
  test/cli-history-window.test.ts test/history.test.ts
  test/cli-history.test.ts` — 127 passed, 1 skipped.
- `npm run hygiene`: ok (790 tracked files, 332 commits).
- `npm run check`: ok (typecheck, lint and build green; vitest 1320 passed,
  5 skipped in 82 files).
- `npm run test:e2e test/e2e/trends.spec.ts`: 15 passed on Chromium, Firefox
  and WebKit. The 320 px / 200 % tab-visibility row stays red under the
  user-approved exception in 4.3; the spec that runs there pins `nowrap` and one
  row, not third-tab visibility.
- `openspec validate 0.6-history-window --strict` and
  `openspec validate 0.6-static-no-js --strict`: both valid.
- Host rows: no new host row required (see 4.3); the manual 0.5.0 older-reader
  check above is the compatibility evidence.
- Size measurements: see 2.8, 4.4 and the size measurement above.
- Review round: closed 2026-11-23 (4.2).

### Documentation slice (2026-11-23)

- `npm run hygiene`: ok (790 tracked files, 331 commits).
- `npm run check`: ok (typecheck, lint and build green; vitest 1313 passed,
  5 skipped in 82 files).
- `npm run test:e2e` was not run: this slice changes docs and records a
  measurement, not the report shell or an input adapter.
