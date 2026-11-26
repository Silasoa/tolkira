# Tasks

## 1. Baseline and guardrails

- [ ] 1.1 Record the pre-refactor baseline at the current `main` commit: run
  `npx vitest run test/cli*.test.ts test/capabilities.test.ts` and keep the
  exact `{ code, stdout, stderr }` and artifact bytes for the equivalence
  matrix as the reference for 2.5 (fixtures, frozen clock, English locale).
  The reference must not be regenerated after the split.
- [ ] 1.2 Re-run the existing CLI suite on the baseline commit and record the
  green result as the control for 4.1; no test is edited.
- [ ] 1.3 Run the pre-implementation PIR + DXR on this proposal and design;
  fix blockers in the contract before any code.

Implementation does not start until the user approves this contract and the
PIR/DXR blockers are closed.

## 2. TDD-Red (failing tests first)

- [ ] 2.1 `test/cli-plan.test.ts`: plan shape/defaults, write order, stdout
  policy, exit policy, help/version/capabilities actions, plan purity (no
  files, no output), and the single-defect message table. RED because
  `src/cli/plan.ts` does not exist.
- [ ] 2.2 `test/cli-plan.test.ts`: two-defect precedence table (at least the
  pairs named in `design.md`) and boundary values for
  `--history-limit`/`--pdf-timeout`/`--max-size`/`--meta`/`--ci`/`--accent`.
  RED for the plan API; the expected strings are the baseline.
- [ ] 2.3 `test/cli-plan-paths.test.ts`: identity, containment, peer
  collisions, manifest relative expressibility, logo validation; platform
  guards for case folding, junctions and cross-drive. RED.
- [ ] 2.4 `test/cli-execute.test.ts`: summary/generate branches, resolved input
  once, option-object equality, all six failure points, warning order, manifest
  ledger. RED because `executePlan` does not exist.
- [ ] 2.5 `test/cli-equivalence.test.ts`: the argv matrix with exact
  code/stdout/stderr, machine-byte API equivalence (`summarizeReport`,
  `formatCiOutput`, `buildRunManifest`), report/email API equivalence, mocked
  PDF pass-through, file-set and determinism checks. GREEN as a control before
  the split and after it.
- [ ] 2.6 Confirm every new seam test fails for the right reason (missing
  module/API), and every equivalence test is green on the baseline. No existing
  test is edited.

## 3. Implementer (move code, keep bytes)

- [ ] 3.1 Add `src/cli/args.ts`: move `parseCliArgs`, `parseMetadata`,
  `parseMaxSize`, `parsePdfTimeout`, `parseHistoryLimit`, `parseCiFormat`,
  `parseAccent` verbatim; export them for `plan.ts`. Covered by 2.1/2.2.
- [ ] 3.2 Add `src/cli/logo.ts`: move `MAX_LOGO_BYTES`, `LOGO_MIME` and
  `readLogo` verbatim. Covered by 2.3.
- [ ] 3.3 Add `src/cli/paths.ts`: move `isInside`, `conflictsWithInputs`,
  `pathConflicts`, `cannotExpressRelative` verbatim, keeping `samePath`,
  `outputOverwritesInput` and `collectReportFiles` imports. Covered by 2.3.
- [ ] 3.4 Add `src/cli/plan.ts` types (`CliPlan`, `CliOutputKind`,
  `CliConfirmationKind`, `CliAction`, `CliPlanResult`) and the `planCli`
  actions plus checks 1–23: parse, help/version/capabilities, empty paths,
  option dependencies, scalar values, bare usage. No new message. Covered by
  2.1/2.2.
- [ ] 3.5 Complete `planCli` with checks 24–35 (path collisions, manifest
  relative, metadata/max-size/accent, logo) and the plan construction (`mode`,
  `writes`, `stdout`, `exitCodes`). Covered by 2.2/2.3.
- [ ] 3.6 Add `src/cli/execute.ts`: `CliIO`, `executePlan`, the five writers
  and `errorCode` moved verbatim; resolve once; summary/generate branches;
  warnings; CI/manifest; stdout. Covered by 2.4 and the existing CLI suite.
- [ ] 3.7 Reduce `src/cli.ts` to `USAGE`, `DEFAULT_IO`, re-exported `CliIO`,
  `runCli` orchestration and the main guard. Keep `runCli` signature, default
  IO, usage bytes and exit formatting. Covered by 2.5.
- [ ] 3.8 Delete the moved code from `src/cli.ts`; confirm no duplicated
  helper remains and the import graph is `cli → {plan, execute}`,
  `plan → {args, paths, logo}`, `execute → plan (type)`. Covered by 2.5 and
  knip.
- [ ] 3.9 Update `docs/ARCHITECTURE.md` (`src/cli` module map and read-only
  planning note) and add the CLI plan/execute entry to `GLOSSARY.md`. Covered
  by DAR and 2.1.

## 4. Verification and reviews

- [ ] 4.1 Run the targeted suite: `npx vitest run test/cli*.test.ts
  test/capabilities.test.ts` plus the four new files. All green, no edited
  expectations.
- [ ] 4.2 Run `npm run hygiene` and `npm run check` (i18n, assets, typecheck,
  lint, knip, format, build, coverage). Coverage floors unchanged.
- [ ] 4.3 Run `npm run test:e2e`; the e2e helpers and four direct specs use
  `runCli`. No browser change is expected, but the CLI is the entry.
- [ ] 4.4 Run `npm run package:check`; confirm `dist/cli.js` and
  `dist/index.d.ts` behaviour/paths are intact and no unexpected tarball path
  appears.
- [ ] 4.5 Verify the diff surface: `git diff --name-only` touches only
  `src/cli.ts`, `src/cli/**`, the new CLI tests, `docs/ARCHITECTURE.md`,
  `GLOSSARY.md` and `openspec/changes/0.7-cli-plan-execute/**`. No renderer,
  summary, email, PDF, history, baseline, input or output module changed.
- [ ] 4.6 Record the line counts per module, the delta against the baseline,
  the bundle size delta and the exact commands/results in this change. Stop and
  escalate if a stop condition in `design.md` was hit.
- [ ] 4.7 Run the post-implementation review set: SCR, CR, DAR, STR and SEC
  (path checks and file writes moved). PCA is not triggered unless the bundle
  grows more than 2%; a failing review spawns a fixer, then re-review.
- [ ] 4.8 Commit and push after each completed step with a conventional
  message and the B-057/change reference; run `npm run hygiene` before every
  commit. Do not close an issue, archive the change, bump the version, tag or
  publish.

## Deferred

- The research's table-driven `validateOutputPaths(options) -> Plan | slot`
  rewrite: a separate change after this seam exists; it may change first-error
  order and needs its own contract.
- Path plan for input/output overlap and B-065 (output inside a scanned input
  directory): separate change with B-058's path policy.
- `cwd` as an explicit parameter through `samePath`/`outputOverwritesInput`:
  only if a caller needs it.
- Test-helper consolidation from B-057 beyond the moved CLI writers: separate
  test-health change.
