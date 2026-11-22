# Tasks

## 1. Gate

- [ ] 1.1 Validate the spec/design and confirm the Windows job does not
  duplicate or replace the Linux/macOS matrix.

## 2. Implement

- [ ] 2.1 Add the `check-windows` job to `.github/workflows/ci.yml`.
- [ ] 2.2 Add the changelog and DROP-IN-VALIDATION CI note.

## 3. Verification and review

- [ ] 3.1 Run `npm run hygiene` and `npm run check` locally.
- [ ] 3.2 Push and confirm the Windows job runs green.
- [ ] 3.3 Run DAR/STR (no product code); fix findings.
- [ ] 3.4 Commit and push; archive after the CI run.

## Gate record

To be filled after verification.
