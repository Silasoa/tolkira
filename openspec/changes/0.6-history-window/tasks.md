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

- [ ] 3.1 Add the limit constant, validation and the optional parameter to
  `readHistory`, `appendHistory` and `writeHistory`; add the schema-1/2 reader
  and writer choice and the writer's 1 MiB prune.
- [ ] 3.2 Add `--history-limit` parsing, the `--history` requirement and the
  CLI wiring; pass the same limit to read, generate and write.
- [ ] 3.3 Add `GenerateReportOptions.historyLimit`; keep `renderReport` and the
  stream rendering the list as given.
- [ ] 3.4 Document the window, the 1 to 365 range, the destructive lower limit,
  the schema-1/2 rule, the 0.5 reader rejection, the writer's 1 MiB prune, the
  architecture seam and the 1 MiB cap; fix the stale "30 runs" text in
  `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`,
  `docs/PRODUCT.md:109` and `GLOSSARY.md:175-178`; record the 365-run size
  measurement.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e` for the Trends
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

## Gate record

- PIR/DXR:
- Focused tests:
- `npm run hygiene`:
- `npm run check`:
- `npm run test:e2e`:
- Host rows:
- Size measurements:
- Review round:
