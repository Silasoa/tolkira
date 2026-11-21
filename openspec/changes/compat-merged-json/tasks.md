# Tasks

## 1. Gate

- [x] 1.1 Validate the proposal/spec/design; check the path/atomic/`retried`
  decisions against the old reporter and Seed-Test's group read.
- [x] 1.2 Record the optional dependency/behavior reason: no new dependency, no
  core change, compatibility-only sidecar.

## 2. TDD-Red

- [x] 2.1 Failing tests for the two-feature `jsonDir` sidecar, merge by `uri`,
  `retried: 0`, pretty-print, `jsonFile` no sidecar and sidecar collision.
- [x] 2.2 Failing test for no partial sidecar when the HTML write fails.
- [x] 2.3 Confirm RED for the right reason.

## 3. Implement

- [x] 3.1 Add the compat-only merge/write helper and call it only for `jsonDir`
  without `jsonFile`.
- [x] 3.2 Keep the core CLI/API, one-file default, report/JSON/CI/email bytes and
  dependency surface unchanged.
- [x] 3.3 Update `docs/COMPATIBILITY.md`, `docs/DROP-IN-VALIDATION.md` and
  `docs/BACKLOG.md` (B-032).
- [x] 3.4 Re-run the Seed-Test-shaped group probe from the host validation.
- [x] 3.5 Exclude and replace a previous sidecar inside `jsonDir` when every
  feature URI is represented; keep the unique-source refusal.
- [x] 3.6 Preflight the reserved sidecar path: refuse invalid or unique-source
  inputs before the HTML; replace only a valid previous sidecar.
- [x] 3.7 Strip one leading UTF-8 BOM on compat parses and preflight every
  sidecar input as a legacy feature array before the HTML.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [x] 4.2 Run SCR, CR and DAR; SEC only if the path/atomic write needs it.
- [x] 4.3 Fix findings; record deferred decisions.
- [x] 4.4 Commit and push with the change reference; no release.

## Gate record

- Hygiene: ok (624 tracked files, 254 commits).
- Check: 68 files, 1035 passed, 4 skipped.
- E2E: 355 passed, 8 skipped.
- Compat sidecar: 17 tests; merge by uri, `retried: 0`, BOM, first/second run,
  subdirectory, non-array/non-object/non-legacy refusal, unique-source
  collision, `ignoreBadJsonFile`, no sidecar for `jsonFile`.
- Reviews: SCR PASS; CR, SEC and DAR PASS after the fixer rounds.
- Deferred: a live Seed-Test group run still needs a real
  `features/<name>.json` or the running stack. No core CLI/API, report-byte or
  dependency change; no release.
