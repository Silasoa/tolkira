# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over the proposal, spec delta and design; fold blockers
  into the contract before Red.
- [ ] 1.2 Confirm the history read/append/write signatures, the 1 MiB cap and
  the default byte parity; no new schema or dependency.
- [ ] 1.3 Confirm the maximum (365), the flag name and the destructive lower
  limit with the user.

## 2. TDD-Red

- [ ] 2.1 Unit: read, append and write with limits 1, 5, 30, 31, 40 and 365;
  the newest entries survive; dedupe keeps the old timestamp; an omitted limit
  is exactly 30.
- [ ] 2.2 Retention: a 31-entry file read with 10 returns 10 and the next write
  stores 10; read with 40 returns 31 and the next write stores 32; a 40-entry
  file with 40 appends and stores 40 of 41; lower then raise cannot restore.
- [ ] 2.3 Schema: a default write on a schema-1 file stays schema 1; a write
  with limit 40 writes schema 2; a schema-2 file read with the default stays
  schema 2; the 0.5 reader rejects schema 2 without a rewrite; the writer prunes
  to 1,048,576 bytes and the newest entry remains.
- [ ] 2.4 CLI: smaller, larger and one-run windows; the default report/CI/email
  bytes are identical; the default JSON differs only by the additive outline
  `example`; `0`, `366`, `1.5`, `abc`, `05`, empty and no `--history` exit 2; no
  `--out` keeps the existing error.
- [ ] 2.5 API: each function with a limit; `generateReport` returns the bounded
  list; `renderReport` renders a 40-entry list unchanged; an invalid limit
  throws.
- [ ] 2.6 Trends: five rows for a five-run window; no Trends tab for one run;
  the sparkline still plots the bounded list.
- [ ] 2.7 Limits: a file above 1 MiB and an invalid entry still reject without a
  rewrite.
- [ ] 2.8 Size: record the Trends bytes for a 365-run report.
- [ ] 2.9 Confirm RED; no existing test is deleted or weakened.

## 3. Implement

- [x] 3.1 Add the limit constant, validation and the optional parameter to
  `readHistory`, `appendHistory` and `writeHistory`; add the schema-1/2 reader
  and writer choice and the writer's 1 MiB prune.
- [x] 3.2 Add `--history-limit` parsing, the `--history` requirement and the
  CLI wiring; pass the same limit to read, generate and write.
- [x] 3.3 Add `GenerateReportOptions.historyLimit`; keep `renderReport` and the
  stream rendering the list as given.
- [ ] 3.4 Document the window, the 1 to 365 range, the destructive lower limit,
  the schema-1/2 rule, the 0.5 reader rejection, the writer's 1 MiB prune, the
  architecture seam and the 1 MiB cap; fix the stale "30 runs" text in
  `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`,
  `docs/PRODUCT.md:109` and `GLOSSARY.md:175-178`; record the 365-run size
  measurement. Still open after the implementation slice; the 365-run size
  measurement is not recorded yet.

## 4. Verification and review

- [x] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e` for the Trends
  browser spec.
- [ ] 4.2 SCR, CR, DAR, STR, CMP and UXR (320 px and 200 % text with a
  365-point sparkline); PCA if the sparkline/table loop changes.
- [ ] 4.3 Run the relevant `docs/DROP-IN-VALIDATION.md` rows on the final tree
  and record host, pin and result.
- [ ] 4.4 Record the 365-run Trends bytes and the default byte parity.
- [ ] 4.5 Fix findings; record deferred decisions with a trigger.

Review findings (2026-11-23): PIR/DXR found the retention scenarios ignored the
appended current run (B4/D4), "default bytes match" contradicted the
unconditional outline `example` (B5), the schema change was missing, so an older
reader would silently truncate a larger window (D2/B8), the writer could exceed
the 1 MiB read cap (D3/I11), the path list omitted `--baseline` (I7/D15), and
the docs list omitted `GLOSSARY.md` and `docs/PRODUCT.md` (I13/I14/D20). The
retention rule is now read n → append unless dedupe → keep newest n, readers
accept schema 1 and 2 with schema 2 only above 30 or on an already schema-2 file,
the writer prunes to 1,048,576 bytes, the path list includes `--baseline`, and
the reviewer set adds CMP and a 320 px UXR check. No implementation task is
marked done.

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

## Gate record

- PIR/DXR: see the review findings above (2026-11-23).
- Focused tests: `npx vitest run test/history-window.test.ts
  test/cli-history-window.test.ts test/history.test.ts
  test/cli-history.test.ts` — 120 passed, 1 skipped.
- `npm run hygiene`: ok (790 tracked files, 330 commits).
- `npm run check`: ok (typecheck, lint and build green; vitest 1313 passed,
  5 skipped in 82 files).
- `npm run test:e2e`: ok (388 passed, 8 skipped; includes the Trends, print, PDF
  and locale specs).
- Host rows: the manual 0.5.0 older-reader check above; the full
  `docs/DROP-IN-VALIDATION.md` matrix runs at release.
- Size measurements: open (4.4).
- Review round: not run yet (4.2).
