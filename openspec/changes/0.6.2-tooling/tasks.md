# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over this proposal, the `test-infrastructure` delta and the
  design. Check every base requirement that names the gate, Windows CI, the
  release workflow, characterization hashes and the public API for a
  contradiction, and check ADR 0002 and ADR 0004. Fold blockers into the
  contract before Red. First round: PIR and DXR both returned FAIL; the two
  blockers (the "uncommitted release candidate" sentence and the
  `unicorn/no-useless-spread` finding from single-property spreads) and all
  accepted should-fix items are folded in. Re-check the revised contract.
- [ ] 1.2 Re-confirm the seams and counts on the contract commit: 86 strict
  errors in 21 files, 62 curated lint findings in 27 files, the five-file
  browser graph and the coverage baseline. The formatting count is the
  `e5c002a` baseline of 156 tracked files; re-measure it after Red, when the new
  test file and configs exist. Confirm no runtime dependency, CLI/API option,
  report byte, entry point or workflow edit is part of the change, and that
  `tsconfig.build.json` and esbuild are untouched.
- [ ] 1.3 Record the decisions before Red: conditional spreads instead of
  widening the public optional input types; the ternary object form where a bag
  has one optional field; no `oxlint --type-aware`; exact pins for `oxlint` and
  Prettier and the exact Vitest coverage peer; the coverage scope and
  93/86/95/95 floors; the formatting scope, the LF checkout policy and the
  report-byte proof; the isolated formatting commit; the internal
  `options.d.ts` return-shape delta and the scoped public-declaration proof. The
  `preserve-caught-error` `cause` effect is declared as internal-only.
- [ ] 1.4 Confirm the approved B-055 package covers this contract and the
  version stays 0.6.1. Draft the GitHub issue (area:test, priority:p2), run IR,
  fix blockers and post it; `docs/BACKLOG.md` B-055 stays the local intake
  record and the issue references this change.

## 2. TDD-Red

- [ ] 2.1 Add `test/tooling-config.test.ts`: assert the six flags, the two
  typecheck programs, the client program's `types: []`, `lib` and five-file
  list, the curated lint plugins/categories/severities/exceptions, the retained
  and extended `ignorePatterns`, the `--max-warnings=0` script, the Prettier
  config and every ignore entry, the `.gitattributes` `* text=auto eol=lf`
  line, the coverage provider/scope/exclude/thresholds, the removed
  `passWithNoTests`, the `check` order and the exact dev-dependency pins.
- [ ] 2.2 Add the behavioural probes in the same file, each with its positive
  control and an explicit 30 s/40 s timeout: a temporary TypeScript file that
  violates `noUncheckedIndexedAccess` (`values[0].toUpperCase()`) fails the
  strict program with TS18048 while a compliant copy passes (the probe config
  sets `types: []`, so TS18048 is the failure and not a missing-types error); a
  temporary browser-graph module that reads `process` fails the client program
  with TS2591 while a DOM-only copy passes (temp config extends
  `tsconfig.client.json` and lists the five repo files plus the module); a
  warning-severity `eslint/no-shadow` finding makes `--max-warnings=0` exit
  non-zero while plain `oxlint` exits zero on it, and both exit zero on a clean
  copy; an unformatted source copy fails
  `prettier --check <file> --config <repo>/.prettierrc.json` while a formatted
  copy passes; a nonexistent test pattern fails when `passWithNoTests` is gone
  while a matching pattern passes; a one-file coverage run with
  `--coverage.thresholds.lines=100` fails on a 0 % control while the measured
  file passes. Use a temp directory outside the repo and resolve the repo
  binaries from the repo root; skip a probe only with a written reason.
- [ ] 2.3 Confirm RED for 2.1 and 2.2 while the existing suite stays green. No
  existing test is deleted, skipped or weakened. ISTQB: decision tables over
  flag present/absent, warning present/absent, formatted/unformatted, test
  matched/empty, coverage above/below; boundary at a single warning and a single
  matching test.

## 3. Implement

- [ ] 3.1 Enable the six strict flags in `tsconfig.json` and fix the source
  errors: index guards/defaults, `override` on the two stream methods,
  conditional spreads for TS2375, the ternary object for the two single-field
  `formatCiOutput` bags, hoisted calls for `productLabel` and `timestampIso`,
  local proofs for TS2532. Keep `renderOptions()` fields conditional and pass
  the CLI option bags conditionally, including `locale` at the email call
  sites. `tsc --noEmit` green in `src`; the public entry declaration is
  unchanged and the only declaration diff is the internal `options.d.ts`
  return shape.
- [ ] 3.2 Fix the test-side type errors: the `happyFeatures()` tuple return
  with an empty-fixture throw (keeps all 16 call sites), index guards in the
  sidecar and Playwright tests, `_doc` unused parameters, `vi.fn`-adjacent
  index reads, `test/stream.test.ts:43` and the truly absent status fixture.
  `tsc --noEmit` green over `test`.
- [ ] 3.3 Add `tsconfig.client.json` with `types: []` and the five-file
  browser graph; change `typecheck` to the two-project command. Prove the client
  program fails on a Node global and stays green on the current graph; prove
  `dist/index.d.ts`, the public input declarations, both compat declarations
  and the client esbuild bundle are unchanged, and that the `dist/options.d.ts`
  diff is limited to the five helper fields.
- [ ] 3.4 Extend `.oxlintrc.json` with the curated plugins, categories,
  severities, exceptions, per-file overrides and the retained plus extended
  ignore patterns; pin `oxlint` to 1.94.0 and run with `--max-warnings=0`.
  Assert the config in the tooling test.
- [ ] 3.5 Rename the 19 shadowed bindings. No assertion changes; the test suite
  stays green after the rename-only commit.
- [ ] 3.6 Add `vi.fn<...>` type arguments (21) and a stable throw message to 8
  `require-to-throw-message` assertions. No assertion is loosened.
- [ ] 3.7 Add `{ cause }` to the 11 `preserve-caught-error` sites, spy on
  `localeCompare` instead of assigning to the prototype (2), and return the
  discarded code in `cli.ts` (1). Extend one existing error-path test to assert
  the wrapped error keeps its cause.
- [ ] 3.8 Prepend `* text=auto eol=lf` to `.gitattributes` (before the fixture
  lines, so their attributes keep precedence) and renormalize the six tracked
  files with CRLF or mixed index endings: five archived OpenSpec files and
  `docs/adr/0007-optional-pdf-engine.md` (line-ending-only commit). Then add
  `.prettierrc.json` (single quotes, width 80), `.prettierignore` with the full
  scope, pin Prettier 3.10.1 and add `format:check`/`format`. Put `format:check`
  in `check` before `build`. Land the config, scripts, the `format:check`
  wiring and the formatted tree in one commit, so the gate is green at every
  commit; rebuild assets, and prove generated sources, both report CSS files,
  fixtures and goldens are unchanged; render the legacy and Messages fixtures
  before and after and compare bytes.
- [ ] 3.9 Add `@vitest/coverage-v8` exactly 5.1.1, remove `passWithNoTests`,
  add the coverage scope/exclude/thresholds and `test:coverage`, and put it last
  in `check`. Prove an empty test selection fails and the measured suite passes
  the floor.
- [ ] 3.10 Docs: `docs/CHANGELOG.md` (tooling only, no runtime change, the
  dev-only dependencies, the public input declarations unchanged, the internal
  `options.d.ts` diff, the `cause` effect), `docs/ARCHITECTURE.md` (gate
  composition, the two typecheck programs and the LF policy) and
  `CONTRIBUTING.md`/`AGENTS.md` if they name the old scripts. Record the
  `oxlint --type-aware` evaluation and its trigger in `docs/BACKLOG.md`. Do not
  bump the version.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check` and `npm run test:e2e` are green.
  Record the exact counts, the tooling-step and probe-file gate time separately,
  the unit and browser totals, the client bundle size, the coverage numbers, the
  re-measured formatting count, the 86/62 baselines and the unchanged nine
  characterization hashes and two golden files. Record the browser wall clock
  and per-test duration sum with the machine, OS, core count, worker count, Node
  and Playwright versions and the exact command, as the base runtime
  requirement asks. State that the new test file is the justified delta in the
  unit total. Run `npm pack --dry-run --json` for the file list and
  `npm view tolkira@0.6.1 bin exports dependencies --json` for the published
  metadata, and compare both with the 0.6.1 package.
- [ ] 4.2 Independent reviewers in one batch: SCR (the spec delta and the
  preserved gate/release requirements), CR (type and lint fixes, no assertion
  weakened), DAR (docs and the evaluation record), SEC (dev-only dependency
  surface, pins, no new runtime/network path), PCA (gate runtime, coverage cost,
  formatter split, probe cost) and STR (config layout, test health, no
  duplicated contract). UXR, CMP and ILA are not triggered because no report
  byte changes; prove it with the hashes. A failing review spawns a fixer.
- [ ] 4.3 Confirm no host row is required: the only PDF contact is the
  `preserve-caught-error` `cause` addition in `src/pdf.ts`, and the compat
  contacts are the two scoped rule overrides in
  `src/compat/cucumber-html-reporter.ts` and `.cts`. They change no output, no
  attachment path and no shim behaviour, and the existing PDF and e2e tests
  cover those flows. Record that decision in the gate record.
- [ ] 4.4 Gate record in `tasks.md`: commands, results, the strict-error and
  lint tables, the formatting, LF, coverage and package proof, the config
  excerpts and the reviewer outcome. Deferred findings get a backlog trigger;
  nothing is dropped silently.
- [ ] 4.5 Fix every review finding or record a decision with a trigger, using a
  separate fixer rather than the implementer of record; re-run the gate after
  fixes.

## 5. Release boundary

- [ ] 5.1 Do not bump the version, tag, stage or publish. 0.6.2 preparation and
  approval remain a separate user decision after this change is complete and
  reviewed.
