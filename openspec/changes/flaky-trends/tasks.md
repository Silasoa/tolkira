# Tasks

## 1. Gate

- [x] 1.1 Validate the spec and design; confirm the retry-passed branch,
  tag-or-retry definition, pure old-file read, history schema 1 and unchanged
  summary schema.
- [x] 1.2 Confirm the history/trends/print/i18n seams and the host fixture.

## 2. TDD-Red

- [ ] 2.1 History: tag-only, retry-passed, retry-failed, tagged+retried+failed,
  both-once, unexecuted/skipped excluded; old absent and append leaves old
  field-less; present round-trips; lower-bound 0; invalid rejected; id changes;
  old last entry plus two identical runs appends once then dedupes.
- [ ] 2.2 Trends: Flaky/Flaky share columns, 2/40 -> 2 and 5%, 0/40 -> 0 and 0%,
  skipped/empty -> `—`, old history `—`, 1/2001 and 1/1001 -> `<0.1%`,
  1/1000 -> `0.1%`, hostile above-attempted clamp, note.
- [ ] 2.3 Summary/CI/email have no flaky field; `--history` writes the count;
  two different counts append.
- [ ] 2.4 en/de keys; 1440/390/320 + 200% screen cell width and print/A4
  column widths.
- [ ] 2.5 Legacy tag-only and Playwright retry-passed fixtures; confirm RED for
  the missing field/columns; existing tests stay green.

## 3. Implement

- [ ] 3.1 Add optional `HistoryRun.flaky`, compute/parse/validate/hash it; keep
  schema 1 and old entries field-less on append.
- [ ] 3.2 Add the Trends columns, share/tiny-share/clamp and note; update
  `trends.tableHint`; 72rem screen min-width; fixed A4 print columns; new en/de
  keys; asset build.
- [ ] 3.3 Update AGENT-INTERFACE/ARCHITECTURE/DESIGN/LIMITATIONS/GLOSSARY/I18N/
  README/CHANGELOG; add BACKLOG B-043 and reconcile the existing flaky entry.
- [ ] 3.4 Keep summary schema, report header, JSON, CI, email, dependencies and
  the one-file rule unchanged.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 4.2 Re-run the Playwright (`5d2cdf0`) 320/1440/200% report-shell check
  with a two-run tagged fixture; the Seed-Test compat shim has no `--history`
  option, so its report-shell row from size-diagnostics still applies. Record
  host, pin and result.
- [x] 4.3 Run SCR, CR, DAR, UXR, SEC (history parsing), ILA (new keys), CMP and
  STR.
- [x] 4.4 Fix findings; record deferred decisions.
- [x] 4.5 Commit and push; archive after the gate.

## Gate record

- Hygiene: ok (694 tracked files, 275 commits).
- Check: 74 files, 1157 passed, 4 skipped; typecheck, lint, build and i18n
  green.
- E2E: 373 passed, 8 skipped (Chromium, Firefox and WebKit; 320/390/768/1024/
  1440 and 320 at 200% text zoom).
- Host: Playwright movies-app pin `5d2cdf0`, two CLI runs over the host JSON and
  a temporary `@flaky` copy with a shared history; Trends shows Flaky `0`/`1`,
  Flaky share `0%`/`12.5%`; no document overflow at 1440/390/320 + 200%, the
  table scrolls internally, no console errors. Seed-Test has no `--history`;
  its report-shell row from size-diagnostics still applies. A4 print is covered
  by the print e2e with fixed columns.
- Reviews: SCR, CR, DAR, UXR, SEC, ILA, CMP and STR PASS after the fixer and
  rechecks.
- Deferred: B-043 first-attempt evidence; the share is a flagged proxy, not a
  probability; old history entries show `—`; older readers drop `flaky` on
  rewrite and one duplicate append after upgrade is possible; 7 pt print stays
  the A4 trade-off.
- No summary schema, report header, JSON, CI, email or dependency change. The
  history sidecar stays schema 1 with an optional field; Trends, i18n, CSS and
  goldens change.
