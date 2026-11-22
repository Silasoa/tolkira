# Tasks

## 1. Gate

- [x] 1.1 Validate the spec/design; confirm the skip is per final attempt and
  the run-level count/warning stays.
- [x] 1.2 Confirm the existing notice key is reused, no schema/CI/email/dependency
  change, and hook attachments already render.

## 2. TDD-Red

- [x] 2.1 Playwright tests: final-attempt outside-root count/notice, inside-root
  no notice, earlier-attempt skip with clean final no notice.
- [x] 2.2 Hook test: failed hook with an attachment renders beside the hook and
  in the scenario attachment list.
- [x] 2.3 Confirm RED for the per-scenario count/notice; keep the hook test as a
  pinned guard if it already passes.

## 3. Implement

- [x] 3.1 Add the attempt/scenario skipped count and the on-skip callback; keep
  the run-level count.
- [x] 3.2 Render the per-scenario notice with the existing key/style; keep the
  run-level notice and hook attachments.
- [x] 3.3 Update `docs/PLAYWRIGHT-JSON.md`, `docs/LIMITATIONS.md`,
  `docs/DROP-IN-VALIDATION.md` and `docs/CHANGELOG.md`; no new catalog key.
- [x] 3.4 Keep JSON/CI/email bytes, the one-file rule and dependencies unchanged.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [x] 4.2 Run SCR, CR, DAR, UXR, SEC and CMP; ILA is not triggered (no new key).
- [x] 4.3 Fix findings; record deferred decisions.
- [x] 4.4 Commit and push; no release.

## Gate record

- Hygiene: ok (641 tracked files, 261 commits).
- Check: 70 files, 1057 passed, 4 skipped; typecheck, lint, assets and build
  green.
- E2E: 355 passed, 8 skipped; attachments 9/9 across Chromium, Firefox and
  WebKit.
- Host: Playwright movies-app 2026-11-22, 8/8, 36/36 steps, 3 attachments, all
  source lines, no false per-scenario notice, no overflow at 1440/390.
- Reviews: SCR, CR, DAR, UXR, SEC and CMP PASS after the fixer/recheck rounds;
  CR's forged-envelope blocker is fixed by the out-of-band WeakMap plus the
  positive-safe-integer guard.
- Deferred: the count is process-local and would be lost if envelopes were
  serialized/reloaded (fails closed); run and scenario notices repeat the same
  wording; per-attachment names and missing/unreadable-file warnings remain
  deferred. No schema, locale, dependency, JSON, CI or email change.
