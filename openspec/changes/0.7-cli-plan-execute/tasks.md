# Tasks

## 1. Baseline and guardrails

- [ ] 1.1 Record the pre-refactor baseline at the current `main` commit on
  fixed fixtures (`test/fixtures/messages/screenshot.ndjson` plus
  `test/fixtures/history/two-runs.json`), with a frozen clock and English
  (`--locale en`): one generate run with report + PDF + email + history +
  ci-out + manifest and one summary run with email + ci-out + manifest. Record
  every artifact's bytes/SHA-256 and `{ code, stdout, stderr }`; note whether
  the PDF engine is the `cli-pdf` mock or the pinned host Chromium. The
  reference must not be regenerated after the split.
- [ ] 1.2 Re-run the existing CLI suite (`npx vitest run test/cli*.test.ts
  test/capabilities.test.ts test/inputs.test.ts`: the 12 CLI files plus
  `capabilities`, `inputs` and the shared helpers) on the baseline commit and
  record the green result as the control for 4.1; no test is edited.
- [ ] 1.3 Run the pre-implementation PIR + DXR on this proposal and design;
  fix blockers in the contract before any code. After these fixes, re-run the
  same reviewers as a delta check over the contract diff and record the result
  in this change; no code until that delta is closed.

Implementation does not start until the user approves this contract and the
PIR/DXR blockers are closed.

## 2. TDD-Red (failing tests first)

- [ ] 2.1a `test/cli-plan.test.ts`: plan shape/defaults, write order, stdout
  policy, exit policy, help/version/capabilities actions, plan purity (no
  files, no output, no argv mutation). RED because `src/cli/plan.ts` does not
  exist. ≤2h.
- [ ] 2.1b `test/cli-plan.test.ts`: the single-defect message table, including
  bare usage, the metadata → max-size → accent → logo order in one argv,
  repeated `--meta` last-wins and the `--max-size`/`--pdf-timeout`/
  `--history-limit` equivalence classes. RED for the plan API; the expected
  strings are the baseline. ≤2h.
- [ ] 2.2a `test/cli-plan.test.ts`: two-defect precedence table, same-family
  and cross-family in both directions (early scalar/dependency over later path
  collision; path over `--meta`/`--max-size`/`--accent`). RED. ≤2h.
- [ ] 2.2b `test/cli-plan.test.ts`: boundary values for
  `--history-limit`/`--pdf-timeout`/`--max-size`/`--meta`/`--ci`/`--accent`
  named in `design.md`. RED. ≤2h.
- [ ] 2.3 `test/cli-plan-paths.test.ts`: identity, containment, peer
  collisions, manifest relative expressibility, logo validation; platform
  guards for case folding, junctions and cross-drive. RED.
- [ ] 2.4 `test/cli-execute.test.ts`: summary/generate branches, resolved input
  once, option-object equality, the mode-split failure table, warning order,
  manifest ledger. RED because `executePlan` does not exist.
- [ ] 2.5a `test/cli-equivalence.test.ts`: the compact mode × stdout matrix
  with exact code/stdout/stderr. GREEN as a control before the split and after
  it. ≤2h.
- [ ] 2.5b `test/cli-equivalence.test.ts`: machine-byte API equivalence
  (`summarizeReport`, `formatCiOutput`, `buildRunManifest`), report/email API
  equivalence, mocked PDF pass-through, built-CLI spawn, file-set and
  determinism checks. GREEN as a control. ≤2h.
- [ ] 2.6 Confirm every new seam test fails for the right reason (missing
  module/API), and every equivalence test is green on the baseline. No existing
  test is edited.

## 3. Implementer (move code, keep bytes)

- [ ] 3.1 First implementation commit (unconditional, also the fallback): add
  `src/cli/args.ts` with `parseCliArgs`, `parseMetadata`, `parseMaxSize`,
  `parsePdfTimeout`, `parseHistoryLimit`, `parseCiFormat` and `parseAccent`
  moved verbatim, and `src/cli/plan.ts` with the partial `CliOptions` type and
  `planOptions(argv)` covering checks 1–23; `src/cli.ts` calls it and continues
  with the current path checks. About 300 lines (~211 pre-path + ~92 parsers).
  Green on the checks 1–23 subset of 2.1/2.2 and the existing CLI suite;
  3.4/3.5 turn the rest green. Stop here if a later step breaks identity.
- [ ] 3.2 Add `src/cli/logo.ts`: move `MAX_LOGO_BYTES`, `LOGO_MIME` and
  `readLogo` verbatim. Covered by 2.3.
- [ ] 3.3 Add `src/cli/paths.ts`: move `isInside`, `conflictsWithInputs`,
  `pathConflicts`, `cannotExpressRelative` verbatim, keeping `samePath`,
  `outputOverwritesInput` and `collectReportFiles` imports. Covered by 2.3.
- [ ] 3.4 Add the exported `CliPlan`, `CliAction` and `CliPlanResult` types and
  the module-private `CliOutputKind`/`CliConfirmationKind`; complete `planCli`
  over `planOptions` with checks 24–31 (path collisions and manifest relative
  expressibility). No new message. Covered by 2.2a/2.3. ≤2h.
- [ ] 3.5 Complete `planCli` with checks 32–35 (metadata/max-size/accent,
  logo), the plan construction (`mode`, `writes`, `stdout`, `exitCodes`) and
  the `cli.ts` switch to `planCli`. Covered by 2.1a/2.1b/2.2a/2.2b. ≤2h.
- [ ] 3.6a Add `src/cli/execute.ts`: `CliIO`, `executePlan`, `errorCode`,
  resolve once, the summary/generate branches and the read failures. Covered
  by 2.4. ≤2h.
- [ ] 3.6b Add the five writers, warning order, CI/manifest and stdout to
  `execute.ts`. Covered by 2.4 and the existing CLI suite. ≤2h.
- [ ] 3.7 Reduce `src/cli.ts` to `USAGE`, `DEFAULT_IO`, re-exported `CliIO`,
  `runCli` orchestration and the main guard. Keep `runCli` signature, default
  IO, usage bytes and exit formatting. Covered by 2.5.
- [ ] 3.8 Delete the moved code from `src/cli.ts`; confirm no duplicated
  helper remains and the import graph is `cli → {plan, execute}`,
  `plan → {args, paths, logo}`, `execute → plan (type)`. Covered by 2.5 and
  knip.
- [ ] 3.9 Update `docs/ARCHITECTURE.md`: the `src/cli` module map, the
  dependency direction (`cli → {plan, execute}`, `plan → {args, paths, logo}`,
  `execute → plan` type only), "plan never writes or prints", "execute owns all
  reads, writes, warnings and stdout", and the add-an-output rule (plan slot →
  write order → confirmation → manifest ledger → test matrix). Add the CLI
  plan/execute entry to `GLOSSARY.md`. Covered by DAR and 2.1a.
- [ ] 3.10 Pin the package delta: add `dist/cli/args.d.ts`,
  `dist/cli/execute.d.ts`, `dist/cli/logo.d.ts`, `dist/cli/paths.d.ts` and
  `dist/cli/plan.d.ts` to `requiredEntryFiles` in `scripts/package-check.mjs`
  and to `distFiles` in `test/package-manifest.test.ts`; derive the npm-12
  80-entry fixture's fillers as `80 - (packedPaths.length - 1)` so the shape
  test follows the list. No other tarball change.

## 4. Verification and reviews

- [ ] 4.1 Run the targeted suite: `npx vitest run test/cli*.test.ts
  test/capabilities.test.ts` plus the four new files. All green, no edited
  expectations.
- [ ] 4.2 Run `npm run hygiene` and `npm run check` (i18n, assets, typecheck,
  lint, knip, format, build, coverage). Coverage floors unchanged.
- [ ] 4.3 Run `npm run test:e2e`; the e2e helpers and four direct specs use
  `runCli`. No browser change is expected, but the CLI is the entry.
- [ ] 4.4 Run `npm run package:check`; expect exactly the five new internal
  declarations `dist/cli/{args,execute,logo,paths,plan}.d.ts` (+5 tarball
  entries), with `dist/cli.js`, `dist/index.d.ts`, public entries and runtime
  bytes intact and no other unexpected tarball path. After `npm run build`,
  spawn `node dist/cli.js` for `--help`, `--version`, `--capabilities` and one
  usage failure; compare bytes and exit codes to the 1.1 baseline.
- [ ] 4.5 Verify the diff surface: `git diff --name-only` touches only
  `src/cli.ts`, `src/cli/**`, the new CLI tests, `docs/ARCHITECTURE.md`,
  `GLOSSARY.md`, `scripts/package-check.mjs`, `test/package-manifest.test.ts`
  and `openspec/changes/0.7-cli-plan-execute/**`. No renderer, summary, email,
  PDF, history, baseline, input or output module changed.
- [ ] 4.6 Run the one-time gate and record it in this change: the full ~20-row
  argv matrix, the 1.1 artifact comparison (report, PDF, email, history,
  ci-out and manifest bytes/SHA-256 on the same host), the line counts per
  module, the delta against the baseline, the bundle size delta and the exact
  commands/results. Stop and escalate if a stop condition in `design.md` was
  hit.
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
