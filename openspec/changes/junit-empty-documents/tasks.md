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

- [ ] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [ ] 4.2 Re-pack the 0.5.1 tarball and re-run the required host rows on the
  final tree; record host, pin and result. Row 4 must render the full
  `mvn test` artifact that was red before.
- [x] 4.3 Docs: `docs/JUNIT-XML.md` directory rule, 0.5.1 changelog bullet,
  B-047 resolved, `GLOSSARY.md` zero-test entry, `docs/BACKLOG.md` wording,
  proposal/design/spec aligned with the narrower guard.
- [ ] 4.4 Host record updated with the task 4.2 PetClinic full-suite numbers;
  the current `docs/DROP-IN-VALIDATION.md` row stays marked as the pre-change
  0.5.1 tarball result (578,651 B).
- [ ] 4.5 Present 0.5.1 for the user's per-version approval. Tag, stage and
  publish only after that approval.

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
