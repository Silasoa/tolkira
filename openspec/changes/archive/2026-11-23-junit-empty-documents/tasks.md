# Tasks

## 1. Contract

- [x] 1.1 Proposal, spec delta and design written.
- [x] 1.2 PIR/DXR over the spec and design; no blockers. PIR: a valid
  directory renders the same bytes, the explicit-file error and exit code are
  unchanged, and the skipped file stays in the input list. DXR: the seam is the
  existing parser options object; the loader already knows `explicit`; the
  `junit-validation` path stays strict; the all-empty check already exists. One
  wording decision recorded: an all-empty directory uses the generic
  `No supported report files found.` error.

## 2. TDD

- [x] 2.1 TDD-Red writes the failing acceptance and edge tests from this spec;
  prove RED and record them in `tdd-red.md`.
- [x] 2.2 Implementer makes the Red tests green without weakening them, adds
  any missing tests, and completes the slice.

## 3. Review

- [x] 3.1 SCR, CR, DAR and SEC (input adapter).
- [x] 3.2 Fix findings; record deferred decisions.

Review findings (2026-11-23): all four reviews flagged one blocker — the skip
was wider than "no test cases", so a wrapper root, a multi-root document or a
`<testcase>` under an unknown element was silently dropped in a directory. The
guard now requires exactly one recognised root and no `<testcase>` anywhere.
Cheap optionals fixed: explicit-duplicate dedup bypass, six missing boundary
tests, and the doc/spec wording. Deferred: none.

Fixer pass (2026-11-23): `src/input/junit.ts` guard helpers,
`src/input/load.ts` dedup re-validation, seven new tests in
`test/junit.test.ts`, docs and contract wording. Details in the Gate record.

## 4. Gate and release

- [x] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [x] 4.2 Re-pack the 0.5.1 tarball and re-run the required host rows on the
  final tree; record host, pin and result. Row 4 must render the full
  `mvn test` artifact that was red before.
- [x] 4.3 Docs: `docs/JUNIT-XML.md` directory rule, 0.5.1 changelog bullet,
  B-047 resolved, `GLOSSARY.md` zero-test entry, `docs/BACKLOG.md` wording,
  proposal/design/spec aligned with the narrower guard.
- [x] 4.4 Host record updated with the task 4.2 PetClinic full-suite numbers.
- [x] 4.5 Present 0.5.1 for the user's per-version approval. Tag, stage and
  publish only after that approval.
- [x] 4.6 Release: tag `v0.5.1` pushed, GitHub release created, release workflow
  staged `tolkira@0.5.1` with provenance (stage id
  `68011086-571d-48d0-b4b7-7c154310fc69`). The maintainer approves the staged
  package with 2FA; `latest` stays 0.5.0 until then.

## Gate record

Implementer slice, 2026-11-23 (Windows, Node per the repo toolchain). No tag or
publish; slice committed; review and host rows below remain open.

- Focused: `npx vitest run test/junit.test.ts` — 28/28 passed (1 file,
  692 ms). All 6 Red tests green, the 3 guards unchanged and green.
- Types: `npx tsc --noEmit` — clean.
- Lint: `npx oxlint src/input/junit.ts src/input/load.ts test/junit.test.ts`
  — clean.
- `npm run check` — green: i18n catalog 24/24, assets, typecheck, lint,
  build (esbuild + `tsconfig.build.json` + compat CJS), full suite 78 files,
  1223 passed, 5 skipped (1228). No test changed or skipped.
- `openspec validate junit-empty-documents --strict` — "Change
  'junit-empty-documents' is valid".
- Not run here (coordinator): `npm run hygiene`, `npm run test:e2e`, host
  matrix, release docs.

Fixer pass, 2026-11-23 (Windows, Node per the repo toolchain). No tag, stage,
push or publish; the coordinator commits this slice.

- Focused: `npx vitest run test/junit.test.ts` — 35/35 passed (1 file,
  637 ms). 7 tests added, none removed, skipped, loosened or changed.
- Types: `npx tsc --noEmit` — clean.
- Lint: `npx oxlint src/input/junit.ts src/input/load.ts test/junit.test.ts`
  — clean.
- `npm run check` — green: i18n catalog 24/24, assets, typecheck, lint,
  build (esbuild + `tsconfig.build.json` + compat CJS), full suite 78 files,
  1230 passed, 5 skipped (1235). No test changed or skipped.
- `openspec validate junit-empty-documents --strict` — "Change
  'junit-empty-documents' is valid".
- Not run here (coordinator): `npm run test:e2e`, host matrix, the task 4.2
  PetClinic full-suite re-run.

Coordinator gate and host record, 2026-11-23 (Windows, Node 26.13.1, npm
10.8.2). Slice committed as `7258110`; no tag, stage, push or publish.

- `npm run hygiene` — ok (764 files, 317 commits).
- `npm run check` — green: i18n catalog 24/24, assets, typecheck, lint,
  build, full suite 78 files, 1230 passed, 5 skipped (1235).
- `npm run test:e2e` — green: 388 passed, 8 skipped (396) across Chromium,
  Firefox and WebKit at the documented viewports.
- Final tarball `tolkira-0.5.1.tgz`: 581,397 B, SHA-256
  `C584C33B704BAC7539910916ABF280A8030CBB0E08432916BFB691A191234364`.
- All five required host rows passed on that tarball; records in
  `docs/DROP-IN-VALIDATION.md`. PetClinic ran the full `mvn -B test`
  (18 XMLs, 79 tests / 77 passed / 2 skipped, zero-test document present) and
  rendered 20 features / 79 scenarios / 77 passed / 2 skipped, so the B-047
  acceptance passed. Other rows kept their counts; only run-specific bytes
  moved.
- Pre-release audit: identities are the project identities only; no secret
  pattern in the tree or the 2,573 history blobs; 0 open secret-scanning
  alerts; `gh secret list` holds only `NPM_TOKEN`; npm maintainer is the
  project address.
