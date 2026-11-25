# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over this proposal, the `test-infrastructure` delta and the
  design. Check every base requirement that names the gate, Windows CI, the
  release workflow, characterization hashes and the public API for a
  contradiction, and check ADR 0002 and ADR 0004. Fold blockers into the
  contract before Red.
- [ ] 1.2 Re-confirm the seams and counts on the contract commit: 86 strict
  errors in 21 files, 62 curated lint findings in 27 files, 156 formatted files,
  the five-file browser graph and the coverage baseline. Confirm no runtime
  dependency, CLI/API option, report byte, entry point or workflow edit is part
  of the change, and that `tsconfig.build.json` and esbuild are untouched.
- [ ] 1.3 Record the decisions before Red: conditional spreads instead of
  widening the public optional input types; no `oxlint --type-aware`; exact pins
  for `oxlint` and Prettier and the exact Vitest coverage peer; the coverage
  scope and 93/86/95/95 floors; the formatting scope and the report-byte proof;
  the isolated formatting commit. The `preserve-caught-error` `cause` effect is
  declared as internal-only.
- [ ] 1.4 Confirm the approved B-055 package covers this contract, no remote
  issue exists, and the version stays 0.6.1. `docs/BACKLOG.md` B-055 is the
  tracking record.

## 2. TDD-Red

- [ ] 2.1 Add `test/tooling-config.test.ts`: assert the six flags, the two
  typecheck programs, the client program's `types: []`, `lib` and five-file
  list, the curated lint plugins/categories/severities/exceptions, the
  `--max-warnings=0` script, the Prettier config and every ignore entry, the
  coverage provider/scope/exclude/thresholds, the removed `passWithNoTests`, the
  `check` order and the exact dev-dependency pins.
- [ ] 2.2 Add the behavioural probes in the same file: a temporary TypeScript
  file that violates `noUncheckedIndexedAccess` fails the strict program; a
  temporary browser-graph module that reads `process` fails the client program;
  a suspicious lint finding makes `--max-warnings=0` exit non-zero while a clean
  file exits zero; an unformatted source copy fails `format:check`; a
  nonexistent test pattern fails when `passWithNoTests` is gone. Use a temp
  directory outside the repo and resolve the repo binaries from the repo root;
  skip a probe only with a written reason.
- [ ] 2.3 Confirm RED for 2.1 and 2.2 while the existing suite stays green. No
  existing test is deleted, skipped or weakened. ISTQB: decision tables over
  flag present/absent, warning present/absent, formatted/unformatted, test
  matched/empty; boundary at a single warning and a single matching test.

## 3. Implement

- [ ] 3.1 Enable the six strict flags in `tsconfig.json` and fix the source
  errors: index guards/defaults, `override` on the two stream methods,
  conditional spreads for TS2375, hoisted calls for `productLabel` and
  `timestampIso`, local proofs for TS2532. Keep `renderOptions()` output keys
  conditional and pass the CLI option bags conditionally. `tsc --noEmit` green
  in `src`; no emitted declaration change.
- [ ] 3.2 Fix the test-side type errors: the `happyFeatures()` single-feature
  return, index guards in the sidecar and Playwright tests, `_doc` unused
  parameters, `vi.fn`-adjacent index reads and the truly absent status fixture.
  `tsc --noEmit` green over `test`.
- [ ] 3.3 Add `tsconfig.client.json` with `types: []` and the five-file
  browser graph; change `typecheck` to the two-project command. Prove the client
  program fails on a Node global and stays green on the current graph; prove
  declaration emit and both esbuild bundles are unchanged.
- [ ] 3.4 Add `.oxlintrc.json` with the curated plugins, categories, severities,
  exceptions and per-file overrides; pin `oxlint` to 1.94.0 and run with
  `--max-warnings=0`. Fix the 62 findings: rename 19 shadowed bindings, add
  `vi.fn` type arguments, add `{ cause }`, add stable throw messages, spy on
  `localeCompare`, return the discarded code. No assertion is loosened.
- [ ] 3.5 Add `.prettierrc.json` (single quotes, width 80), `.prettierignore`
  with the full scope, pin Prettier 3.10.1 and add `format:check`/`format`.
  Format the 156 tracked files in one isolated commit, rebuild assets, and
  prove generated sources, both report CSS files, fixtures and goldens are
  unchanged; render the legacy and Messages fixtures before and after and
  compare bytes.
- [ ] 3.6 Add `@vitest/coverage-v8` exactly 5.1.1, remove `passWithNoTests`,
  add the coverage scope/exclude/thresholds and `test:coverage`, and put it last
  in `check`. Prove an empty test selection fails and the measured suite passes
  the floor.
- [ ] 3.7 Docs: `docs/CHANGELOG.md` (tooling only, no runtime change, the
  dev-only dependencies, the public declaration unchanged, the `cause` effect),
  `docs/ARCHITECTURE.md` (gate composition and the two typecheck programs) and
  `CONTRIBUTING.md`/`AGENTS.md` if they name the old scripts. Record the
  `oxlint --type-aware` evaluation and its trigger in `docs/BACKLOG.md`. Do not
  bump the version.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check` and `npm run test:e2e` are green.
  Record the exact counts, the added gate time, the client bundle size, the
  coverage numbers, the 86/62/156 baselines and the unchanged nine
  characterization hashes and two golden files.
- [ ] 4.2 Independent reviewers in one batch: SCR (both spec deltas and the
  preserved gate/release requirements), CR (type and lint fixes, no assertion
  weakened), DAR (docs and the evaluation record), SEC (dev-only dependency
  surface, pins, no new runtime/network path), PCA (gate runtime, coverage cost,
  formatter split) and STR (config layout, test health, no duplicated
  contract). UXR, CMP and ILA are not triggered because no report byte changes;
  prove it with the hashes. A failing review spawns a fixer.
- [ ] 4.3 Confirm no host row is required: this change touches no input adapter,
  report shell, print/PDF/email path or compatibility shim, and the report
  bytes are proven unchanged. Record that decision in the gate record.
- [ ] 4.4 Gate record in `tasks.md`: commands, results, the strict-error and
  lint tables, the formatting and coverage proof, the config excerpts and the
  reviewer outcome. Deferred findings get a backlog trigger; nothing is dropped
  silently.
- [ ] 4.5 Fix every review finding or record a decision with a trigger; re-run
  the gate after fixes.

## 5. Release boundary

- [ ] 5.1 Do not bump the version, tag, stage or publish. 0.6.2 preparation and
  approval remain a separate user decision after this change is complete and
  reviewed.
