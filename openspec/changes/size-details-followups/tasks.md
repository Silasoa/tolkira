# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over the proposal, spec deltas and design; fold the PIR
  findings (seam target, wide/print German layout, 560/561 boundary,
  attachment call site, catalog description) and the DXR findings (version
  surface, host matrix and pre-release audit, `format.bytes` scope).
- [ ] 1.2 Confirm the current German selector and the `format.bytes` call
  sites; no catalog key or message, schema or dependency change.

## 2. TDD-Red

- [ ] 2.1 German catalog seam: `exactSizeLabel(MIB, deSeam)` returns
  `1.048.576 Bytes (1,0 MB)`; `sizeLabel(MIB - 1, deSeam)` returns
  `1.048.575 Bytes`; English seam returns `1048576 Bytes (1.0 MB)`; 1 and 2
  select `one` and `other`.
- [ ] 2.2 Attachment call site: `renderAttachment` with a binary attachment and
  the German plural catalog; 1 → `1 Byte`, 2 → `2 Bytes`, 1 MiB grouped.
- [ ] 2.3 Default output parity: `sizeLabel(1_000_000, de)` is
  `1.000.000 Byte`; existing exact-size and MB strings stay green;
  `bytesLabel` stays as the independent old-path oracle.
- [ ] 2.4 E2E German Details: open the Details tab, wait for `.sizeMeta`, then
  assert one used-px track at 560 px with the value under its label, two tracks
  at 1440 px, and at 320 px / 200 % a >1 MiB grouped byte count keeps one
  client rect with no horizontal overflow.
- [ ] 2.5 Confirm RED for the seam, attachment and narrow-layout expectations;
  no existing test is deleted or weakened.

## 3. Implement

- [ ] 3.1 Add the narrow-only German `.sizeMeta` override; leave the wide and
  print layout unchanged.
- [ ] 3.2 Pass raw byte counts to `format.bytes` in `sizeLabel`,
  `exactSizeLabel` and the attachment size row; update the `en.json`
  `format.bytes` description (description only; no key or message change).
- [ ] 3.3 Resolve B-046 and B-045 in `docs/BACKLOG.md`; note that B-039 stays
  open and that `format.megabytes` keeps the deferred pattern; document the
  numeric `format.bytes` contract in `docs/I18N.md`.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [ ] 4.2 SCR, CR, DAR, UXR, ILA and STR; CMP is optional because no
  competitor-facing output changes. SEC is not triggered (no new input path).
- [ ] 4.3 Fix findings; record deferred decisions.
- [ ] 4.4 Host rows: run the five required `docs/DROP-IN-VALIDATION.md` rows on
  the final tree and record host, pin and result, or record a written exception
  the user approves for this version.
- [ ] 4.5 Version surface 0.5.1: `package.json`, both `package-lock.json`
  version fields, `src/index.ts`, `test/smoke.test.ts`, README release line and
  dated `docs/CHANGELOG.md`; commit and push.
- [ ] 4.6 Pre-release audit (identities, secret scan, GitHub alerts, secrets
  list, npm maintainers, committed screenshots).
- [ ] 4.7 Tag and stage only after the user's per-version approval.

## Gate record

- Pending.
