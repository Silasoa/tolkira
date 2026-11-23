# Tasks

## 1. Gate

- [x] 1.1 PIR + DXR over the proposal, spec deltas and design on 2026-11-23.
  Both returned "not clean": PIR 5 blockers, DXR 4 blockers + 5 optional. All
  findings were folded into the contract before Red: PIR (seam target,
  wide/print German layout, 560/561 boundary, attachment call site, catalog
  description) and DXR (version surface, host matrix and pre-release audit,
  `format.bytes` scope).
- [x] 1.2 Confirm the current German selector and the `format.bytes` call
  sites; no catalog key or message, schema or dependency change.

## 2. TDD-Red

- [x] 2.1 German catalog seam: `exactSizeLabel(MIB, deSeam)` returns
  `1.048.576 Bytes (1,0 MB)`; `sizeLabel(MIB - 1, deSeam)` returns
  `1.048.575 Bytes`; English seam returns `1048576 Bytes (1.0 MB)`; 1 and 2
  select `one` and `other`.
- [x] 2.2 Attachment call site: `renderAttachment` with a binary attachment and
  the German plural catalog; 1 → `1 Byte`, 2 → `2 Bytes`, 1 MiB grouped.
- [x] 2.3 Default output parity: `sizeLabel(1_000_000, de)` is
  `1.000.000 Byte`; existing exact-size and MB strings stay green;
  `bytesLabel` stays as the independent old-path oracle.
- [x] 2.4 E2E German Details: open the Details tab, wait for `.sizeMeta`, then
  assert one used-px track at 560 px with the value under its label, two tracks
  at 1440 px, and at 320 px / 200 % a >1 MiB grouped byte count keeps one
  client rect with no horizontal overflow.
- [x] 2.5 Confirm RED for the seam, attachment and narrow-layout expectations;
  no existing test is deleted or weakened.

## 3. Implement

- [x] 3.1 Add the narrow-only German `.sizeMeta` override; leave the wide and
  A4 print layout unchanged.
- [x] 3.2 Pass raw byte counts to `format.bytes` in `sizeLabel`,
  `exactSizeLabel` and the attachment size row; update the `en.json`
  `format.bytes` description (description only; no key or message change).
- [x] 3.3 Resolve B-046 and B-045 in `docs/BACKLOG.md`; note that B-039 stays
  open and that `format.megabytes` keeps the deferred pattern; document the
  numeric `format.bytes` contract in `docs/I18N.md`.

## 4. Verification and review

- [x] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [x] 4.2 SCR, CR, DAR, UXR, ILA and STR; CMP is optional because no
  competitor-facing output changes. SEC is not triggered (no new input path).
- [x] 4.3 Fix findings; record deferred decisions.
- [ ] 4.4 Host rows: run the five required `docs/DROP-IN-VALIDATION.md` rows on
  the final tree and record host, pin and result, or record a written exception
  the user approves for this version.
- [x] 4.5 Version surface 0.5.1: `package.json`, both `package-lock.json`
  version fields, `src/index.ts`, `test/smoke.test.ts`, README release line and
  dated `docs/CHANGELOG.md`; commit and push.
- [ ] 4.6 Pre-release audit (identities, secret scan, GitHub alerts, secrets
  list, npm maintainers, committed screenshots).
- [ ] 4.7 Tag and stage only after the user's per-version approval.

## Gate record

- Focused: `npx vitest run test/size-diagnostics.test.ts
  test/render-characterization.test.ts test/render-golden.test.ts
  test/stream.test.ts` — 4 files, 46 tests passed.
- `npm run hygiene` — ok, 756 tracked files and 307 commits.
- `npm run check` — `i18n:check` 24/24; assets 191 keys / 2 locales, styles
  41,013 bytes, client bundle 15,268 / 16,000 bytes; typecheck and lint clean;
  build clean; unit tests 78 files, 1,214 passed, 5 skipped.
- `npm run test:e2e` — 388 passed, 8 skipped, 2.0 min, Chromium, Firefox and
  WebKit. The new German Details row passed at 560 px (one used track, value
  below label), 1440 px (two used tracks) and 320 px / 200 % (one client rect,
  no horizontal overflow).
- German report row for a 1,268,967-byte report (`locale: 'de'`):
  `1.268.967 Byte (1,2\u00a0MB)`.
- Note: the first cold-cache `npm run check` timed out five unrelated unit
  tests at 5,000 ms while 78 workers spawned; `npx vitest run` and the next
  `npm run check` were green with the numbers above (machine load, not a test
  failure).
- Review round 2026-11-23: SCR, CR, DAR, UXR, ILA and STR found no behavioural
  defect in the shipped fix; the findings were test gaps and documentation
  precision, fixed in the fixer pass. CMP is running.
- 0.5.1 version surface committed after the review fixes: `package.json` and
  both `package-lock.json` fields at 0.5.1, `src/index.ts` and
  `test/smoke.test.ts` at 0.5.1, README release line and a dated changelog
  section. `npm run check` on the bumped tree: 78 files, 1,214 passed, 5
  skipped; `npm run test:e2e`: 388 passed, 8 skipped, Chromium, Firefox and
  WebKit. Packed tarball `tolkira-0.5.1.tgz` 578,651 bytes for the host rows.
- Reviewed range artifact: the `docs: research Tolkira placement venues and
  rules` and `docs: research the 0.6.0 baseline anchor` commits are inside the
  reviewed range but are not part of this change.
- Mutation check 2026-11-23 (throwaway spec, not committed): baseline 1440 px
  124.469 / 186.719 px (share 0.400), 561 px 180 / 270 px (0.400), 560 px one
  475 px track. Replacing the German wide rule with the base auto/1fr fallback
  gave 124.094 / 325.906 px at 561 px (share 0.276, fails the 0.4 ± 0.02
  assertion) and 124.094 / 187.109 px at 1440 px (share 0.399, because the
  right-column panel is only 311 px wide there); forcing two tracks at 560 px
  gave 190 / 285 px (fails the one-track assertion). The 561 px boundary
  assertion is the one that catches the deleted German rule.
