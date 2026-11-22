# Tasks

## 1. Gate

- [x] 1.1 Validate the spec/design and confirm the Windows job does not
  duplicate or replace the Linux/macOS matrix.

## 2. Implement

- [x] 2.1 Add the `check-windows` job to `.github/workflows/ci.yml`.
- [x] 2.2 Add the changelog and DROP-IN-VALIDATION CI note.

## 3. Verification and review

- [x] 3.1 Run `npm run hygiene` and `npm run check` locally.
- [x] 3.2 Push and confirm the Windows job runs green.
- [x] 3.3 Run DAR/STR (no product code); fix findings.
- [x] 3.4 Commit and push; archive after the CI run.

## Gate record

- Local: `npm run check` green (74 files, 1157 passed, 4 skipped); hygiene ok.
- CI run 45065922883 on `aa30720`: hygiene, check (22/24/26), check-windows,
  package, e2e and e2e-macos all green. The Windows `check-windows` job
  completed successfully.
- Reviews: DAR and STR PASS; the macOS wording nit was fixed before this
  record.
- No product code, dependency, schema or report change.
