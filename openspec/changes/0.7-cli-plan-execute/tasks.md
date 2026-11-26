# Tasks

## 1. Baseline and guardrails

- [x] 1.1 Record the pre-refactor baseline at the current `main` commit on
  fixed fixtures (`test/fixtures/messages/screenshot.ndjson` plus
  `test/fixtures/history/two-runs.json`), with a frozen clock and English
  (`--locale en`): one generate run with report + PDF + email + history +
  `--ci markdown --ci-out` + manifest, one summary run with email +
  `--ci markdown --ci-out` + manifest, one `<input> --json` run whose stdout
  is kept as `b.json` (the explicit earlier baseline for gate rows 15/22), and
  the four process outputs `--help`, `--version`, `--capabilities` and one
  usage failure (row 5, bare usage). Record every artifact's bytes/SHA-256 and
  `{ code, stdout, stderr }`. The PDF baseline uses the
  pinned host Chromium (record the `playwright-core` and Chromium versions),
  never the `cli-pdf` mock; the mock stays a permanent unit seam. The reference
  must not be regenerated after the split.
- [x] 1.2 Re-run the existing CLI suite (`npx vitest run test/cli*.test.ts
  test/capabilities.test.ts test/inputs.test.ts`: the 12 CLI files plus
  `capabilities`, `inputs` and the shared helpers) on the baseline commit and
  record the green result as the control for 4.1; no test is edited.
- [x] 1.3 Run the pre-implementation PIR + DXR on this proposal and design;
  fix blockers in the contract before any code. Five delta rounds closed
  (`f73a7b4`, `21ebded`, `33782c9`, `05ff933`, `88d79af`, `3904040`); PIR and
  DXR both PASS on `3904040`. No code until the user approves this contract.

Implementation does not start until the user approves this contract and the
PIR/DXR blockers are closed.

## 2. TDD-Red (failing tests first)

- [x] 2.1a `test/cli-plan-options.test.ts`: the exported `planOptions` shape,
  defaults, purity and the checks 1–23 single-defect messages, precedence and
  boundary classes. RED because `planOptions` does not exist; GREEN at the
  3.1b fallback. ≤2h.
- [x] 2.1b `test/cli-plan.test.ts`: the full plan shape/defaults, write order,
  stdout policy, exit policy, help/version/capabilities actions and purity.
  RED until 3.4/3.5. ≤2h. The checks 1–23 message table stays in 2.1a, not a
  second copy here.
- [x] 2.1c `test/cli-plan.test.ts`: the messages added by checks 32–34 (path
  collisions 24–31, the logo message 35 and the four-way parse order are in
  2.3), `--meta` `=x`/`k=`/`k=v=w` plus last-wins, the `--max-size` classes
  and the same- and cross-family precedence pairs that involve 24–34.
  The `--pdf-timeout`/`--history-limit` boundary forms stay in 2.1a. RED for
  the full plan API; the expected strings are the baseline. ≤2h.
- [x] 2.3 `test/cli-plan-paths.test.ts`: identity, containment, peer
  collisions (messages 24–31), manifest relative expressibility, logo
  validation (message 35), the four-way `--meta` → `--max-size` → `--accent` →
  `--logo` order, out collision vs logo; platform guards for case folding,
  junctions and cross-drive. RED.
- [x] 2.4 `test/cli-execute.test.ts`: summary/generate branches, resolved input
  once, option-object equality, the mode-split failure table, warning order,
  manifest ledger. RED because `executePlan` does not exist.
- [x] 2.5a `test/cli-equivalence.test.ts`: the compact mode × stdout matrix
  with exact code/stdout/stderr. GREEN as a control before the split and after
  it. ≤2h.
- [x] 2.5b `test/cli-equivalence.test.ts`: machine-byte API equivalence
  (`summarizeReport`, `formatCiOutput`, `buildRunManifest`), report/email API
  equivalence, mocked PDF pass-through, file-set and determinism checks, and a
  built-CLI spawn from a temporary esbuild bundle (the `render-report` pattern;
  `npm test` does not build, so never `dist/cli.js` here). The spawned probes
  are `--help`, `--version`, `--capabilities` and row 5 (bare usage). GREEN as
  a control. ≤2h.
- [x] 2.6 Confirm every new seam test fails for the right reason (missing
  module/API), and every equivalence test is green on the baseline. No existing
  test is edited.

## 3. Implementer (move code, keep bytes)

- [x] 3.1a First implementation commit, part 1: add `src/cli/args.ts` with
  `parseCliArgs`, `parseMetadata`, `parseMaxSize`, `parsePdfTimeout`,
  `parseHistoryLimit`, `parseCiFormat` and `parseAccent` moved verbatim;
  `src/cli.ts` imports them. Green on the existing CLI suite; 2.1a turns green
  at 3.1b. ≤2h.
- [x] 3.1b First implementation commit, part 2 (the fallback stop point): add
  `src/cli/plan.ts` with the internal `CliOptions` type and `planOptions(argv)`
  covering checks 1–23; `src/cli.ts` calls it and continues with the current
  path checks. About 300 lines across 3.1a/3.1b (~92 parsers + ~211 pre-path
  plus imports and types). Green on 2.1a, the existing CLI suite and the 2.5
  control; 2.1b/2.1c stay RED until 3.4/3.5, 2.3 until 3.2/3.3 and
  2.4 until 3.6. Commit here; stop if a later step breaks identity. ≤2h.
- [x] 3.2 Add `src/cli/logo.ts`: move `MAX_LOGO_BYTES`, `LOGO_MIME` and
  `readLogo` verbatim. Covered by 2.3.
- [x] 3.3 Add `src/cli/paths.ts`: move `isInside`, `conflictsWithInputs`,
  `pathConflicts`, `cannotExpressRelative` verbatim, keeping `samePath`,
  `outputOverwritesInput` and `collectReportFiles` imports. Covered by 2.3.
- [x] 3.4 Add the exported `CliPlan` type and the module-private `CliAction`,
  `CliPlanResult`, `CliOutputKind` and `CliConfirmationKind`; complete
  `planCli` over `planOptions` with checks 24–31 (path collisions and manifest
  relative expressibility). No new message. Covered by 2.1c/2.3. ≤2h.
- [x] 3.5 Complete `planCli` with checks 32–35 (metadata/max-size/accent,
  logo), the plan construction (`mode`, `writes`, `stdout`, `exitCodes`) and
  the `cli.ts` switch to `planCli`. Covered by 2.1b/2.1c. ≤2h.
- [x] 3.6a Add `src/cli/execute.ts`: `CliIO`, `executePlan`, `errorCode`,
  resolve once, the summary/generate branches and the read failures. Covered
  by 2.4. ≤2h.
- [x] 3.6b Add the five writers, warning order, CI/manifest and stdout to
  `execute.ts`. Covered by 2.4 and the existing CLI suite. ≤2h.
- [x] 3.7 Reduce `src/cli.ts` to `USAGE`, `DEFAULT_IO`, re-exported `CliIO`,
  `runCli` orchestration and the main guard. Keep `runCli` signature, default
  IO, usage bytes and exit formatting. Covered by 2.5.
- [x] 3.8 Delete the moved code from `src/cli.ts`; confirm no duplicated
  helper remains and the import graph is `cli → {plan, execute}`,
  `plan → {args, paths, logo}`, `execute → plan (type)`. Covered by 2.5 and
  knip.
- [x] 3.9 Update `docs/ARCHITECTURE.md`: the `src/cli` module map, the
  dependency direction (`cli → {plan, execute}`, `plan → {args, paths, logo}`,
  `execute → plan` type only), "plan never writes or prints", "execute owns all
  reads, writes, warnings and stdout", and the add-an-output rule (plan slot →
  write order → confirmation → manifest ledger → test matrix). Add the CLI
  plan/execute entry to `GLOSSARY.md`. Covered by DAR and 2.1a.
- [x] 3.10 Pin the package delta: add `dist/cli/args.d.ts`,
  `dist/cli/execute.d.ts`, `dist/cli/logo.d.ts`, `dist/cli/paths.d.ts` and
  `dist/cli/plan.d.ts` to `requiredEntryFiles` in `scripts/package-check.mjs`
  and to `distFiles` in `test/package-manifest.test.ts`; derive the npm-12
  80-entry fixture's fillers as `80 - (packedPaths.length - 1)` so the shape
  test follows the list. No other tarball change.

## 4. Verification and reviews

- [x] 4.1 Run the targeted suite: `npx vitest run test/cli*.test.ts
  test/capabilities.test.ts` plus the five new files. All green, no edited
  expectations.
- [x] 4.2 Run `npm run hygiene` and `npm run check` (i18n, assets, typecheck,
  lint, knip, format, build, coverage). Coverage floors unchanged.
- [x] 4.3 Run `npm run test:e2e`; the e2e helpers and four direct specs use
  `runCli`. No browser change is expected, but the CLI is the entry.
- [x] 4.4 Run `npm run package:check`; expect exactly the five new internal
  declarations `dist/cli/{args,execute,logo,paths,plan}.d.ts` (+5 tarball
  entries), `dist/cli.d.ts` changed only by the `CliIO` re-export,
  `dist/index.*` and the CLI-observable bytes intact, and no other unexpected
  tarball path. After `npm run build`, spawn the real `node dist/cli.js` for
  `--help`, `--version`, `--capabilities` and row 5 (bare usage); compare bytes
  and exit codes to the 1.1 baseline.
- [x] 4.5 Verify the diff surface: `git diff --name-only` touches only
  `src/cli.ts`, `src/cli/**`, the new CLI tests, `docs/ARCHITECTURE.md`,
  `GLOSSARY.md`, `scripts/package-check.mjs`, `test/package-manifest.test.ts`
  and `openspec/changes/0.7-cli-plan-execute/**`. No renderer, summary, email,
  PDF, history, baseline, input or output module changed.
- [x] 4.6 Run the one-time gate and record it in this change: the 23-row
  matrix in design "Slice 4" through `test/cli-equivalence-gate.test.ts` (the
  15 non-★ rows rerun; the eight ★ results come from 2.5a; commit the file for
  the run, then remove it after recording; `npx vitest run
  test/cli-equivalence-gate.test.ts`), and
  the 1.1 comparison on the same host: report, email, history, ci-out and
  manifest bytes exactly; PDF through the same pinned Chromium with only
  `/CreationDate`, `/ModDate` and `/ID` normalized. Record the line counts per
  module, the delta against the baseline, the `dist/cli.js`/`.map` and
  `dist/cli.d.ts` deltas, the bundle size delta and the exact
  commands/results. Stop and escalate if a stop condition in `design.md` was
  hit.
- [ ] 4.7 Run the post-implementation review set: SCR, CR, DAR, STR and SEC
  (path checks and file writes moved). PCA is not triggered unless the bundle
  grows more than 2%; a failing review spawns a fixer, then re-review.
- [x] 4.8 Commit and push after each completed step with a conventional
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
