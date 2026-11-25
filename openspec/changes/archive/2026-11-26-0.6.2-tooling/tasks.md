# Tasks

## 1. Gate

- [x] 1.1 PIR + DXR over this proposal, the `test-infrastructure` delta and the
  design. Check every base requirement that names the gate, Windows CI, the
  release workflow, characterization hashes and the public API for a
  contradiction, and check ADR 0002 and ADR 0004. Fold blockers into the
  contract before Red. First round: PIR and DXR both returned FAIL; the two
  blockers (the "uncommitted release candidate" sentence and the
  `unicorn/no-useless-spread` finding from single-property spreads) and all
  accepted should-fix items are folded in. Re-check the revised contract.
- [x] 1.2 Re-confirm the seams and counts on the contract commit: 88 strict
  errors in 22 files, the re-measured lint baseline at 3.4 (335 findings: 63
  base, 156 pedantic, 116 type-aware; 21 pinned per line and 314 fixed), the
  five-file browser graph and the coverage baseline. The formatting count is
  re-measured after Red, when the new test file and configs exist. Confirm no
  runtime dependency, CLI/API option, report byte, entry point or workflow edit
  is part of the change, and that `tsconfig.build.json` and esbuild are
  untouched.
- [x] 1.3 Record the decisions before Red: conditional spreads instead of
  widening the public optional input types; the ternary object form where a bag
  has one optional field; the user's 2026-11-25 maximal-sensible decision — the
  pedantic category with the measured exclusions, type-aware rules with the
  assertion rule scoped off in `test/**`, the five extra compiler checks, and
  `noPropertyAccessFromIndexSignature`/`erasableSyntaxOnly` left off with their
  measured reasons; exact pins for `oxlint`, `oxlint-tsgolint`, `vitest`,
  `@vitest/coverage-v8` and the formatter (Oxfmt 0.80.0; Prettier 3.10.1 was the
  first choice until the 2026-11-26 switch); the coverage scope and 93/86/95/95
  floors; the
  formatting scope, the LF checkout policy and the report-byte proof; the
  isolated formatting commits; the internal `options.d.ts` return-shape delta and
  the scoped public-declaration proof. The `preserve-caught-error` `cause`
  effect is declared as internal-only.
- [x] 1.4 Confirm the approved B-055 package covers this contract and the
  version stays 0.6.1. Draft the GitHub issue (area:test, priority:p2), run IR,
  fix blockers and post it; `docs/BACKLOG.md` B-055 stays the local intake
  record and the issue references this change.

## 2. TDD-Red

- [x] 2.1 Add `test/tooling-config.test.ts`: assert the eleven flags, the two
  typecheck programs, the client program's `types: []`, `lib` and five-file
  list, the maximal lint plugins/categories/severities/exceptions and the
  scoped `no-unsafe-type-assertion` override, the retained and extended
  `ignorePatterns`, the `--type-aware --max-warnings=0` script, the
  `oxlint-tsgolint` pin, the Oxfmt config options and the exact `ignorePatterns`, the
  `.gitattributes` `* text=auto eol=lf` line, the coverage
  provider/scope/exclude/thresholds, the removed `passWithNoTests`, the `check`
  order and the exact dev-dependency pins.
- [x] 2.2 Add the behavioural probes in the same file, each with its positive
  control and an explicit 30 s/40 s timeout: a temporary TypeScript file that
  violates `noUncheckedIndexedAccess` (the two-line
  `const first = values[0]; first.toUpperCase()` form; the chained call is
  TS2532) fails the strict program with TS18048 while a compliant copy passes
  (the probe config
  sets `types: []`, so TS18048 is the failure and not a missing-types error); a
  temporary browser-graph module that reads `process` fails the client program
  with TS2591 while a DOM-only copy passes (temp config extends
  `tsconfig.client.json` and lists the five repo files plus the module); a
  floating promise in a temporary module fails the type-aware lint while an
  awaited copy passes, and an awaited non-thenable fails while a thenable
  passes; a temporary tree with `src/unsafe.ts` and `test/unsafe.ts` holding the
  same unsafe cast fails for the `src` file and passes for the `test` file under
  the scoped override; a warning-severity `eslint/no-shadow` finding makes
  `--max-warnings=0` exit non-zero while plain `oxlint` exits zero on it, and
  both exit zero on a clean copy; an unformatted source copy fails
  `oxfmt --check <file> -c <repo>/.oxfmtrc.json` while a formatted
  copy passes; a nonexistent test pattern fails when `passWithNoTests` is gone
  while a matching pattern passes; a one-file coverage run with
  `--coverage.thresholds.lines=100` fails on a 0 % control while the measured
  file passes. Use a temp directory outside the repo and resolve the repo
  binaries from the repo root; skip a probe only with a written reason.
- [x] 2.3 Confirm RED for 2.1 and 2.2 while the existing suite stays green. No
  existing test is deleted, skipped or weakened. ISTQB: decision tables over
  flag present/absent, warning present/absent, floating/awaited, formatted/
  unformatted, test matched/empty, coverage above/below; boundary at a single
  warning and a single matching test.

## 3. Implement

- [x] 3.1 Enable the eleven strict checks in `tsconfig.json` and fix the source
  errors: index guards/defaults, `override` on the two stream methods,
  conditional spreads for TS2375, the ternary object for the two single-field
  `formatCiOutput` bags, hoisted calls for `productLabel` and `timestampIso`,
  local proofs for TS2532, and the two dead `break` statements after
  `invalidJson()` in `src/input/load.ts`. Keep `renderOptions()` fields
  conditional and pass the CLI option bags conditionally, including `locale` at
  the email call sites. `tsc --noEmit` green in `src`; the public entry
  declaration is unchanged and the only declaration diff is the internal
  `options.d.ts` return shape.
- [x] 3.2 Fix the test-side type errors: the `happyFeatures()` tuple return
  with an empty-fixture throw (keeps all 16 call sites), index guards in the
  sidecar and Playwright tests, `_doc` unused parameters, `vi.fn`-adjacent
  index reads, `test/stream.test.ts:43` and the truly absent status fixture.
  `tsc --noEmit` green over `test`.
- [x] 3.3 Add `tsconfig.client.json` with `types: []` and the five-file
  browser graph; change `typecheck` to the two-project command. Prove the client
  program fails on a Node global and stays green on the current graph; prove
  `dist/index.d.ts`, the public input declarations, both compat declarations
  and the client esbuild bundle are unchanged, and that the `dist/options.d.ts`
  diff is limited to the five helper fields.
- [x] 3.4 Extend `.oxlintrc.json` with the maximal plugins, categories
  (correctness error; suspicious, perf and pedantic warn), the type-aware script
  and pin, the exceptions, the scoped `no-unsafe-type-assertion` override and
  the retained plus extended ignore patterns; pin `oxlint` to 1.94.0 and
  `oxlint-tsgolint` to 7.0.2008 and run with `--type-aware
  --max-warnings=0`. Assert the config in the tooling test. Record the
  final-config baseline on the strict-fixed tree: 335 findings (63 base, 156
  pedantic, 116 type-aware).
- [x] 3.5 Rename the 19 shadowed bindings. No assertion changes; the test suite
  stays green after the rename-only commit.
- [x] 3.6 Add `vi.fn<...>` type arguments (21) and a stable throw message to 8
  `require-to-throw-message` assertions. No assertion is loosened.
- [x] 3.7 Add `{ cause }` to the 11 `preserve-caught-error` sites, spy on
  `localeCompare` instead of assigning to the prototype (2), and return the
  discarded code in `cli.ts` (1). Extend one existing error-path test to assert
  the wrapped error keeps its cause.
- [x] 3.8 Fix `unicorn/prefer-string-replace-all` (98): a global regex
  `replace` becomes `replaceAll`, same match set. Re-measure after the group.
- [x] 3.9 Fix `unicorn/prefer-code-point` (20), reviewed per site because
  surrogate-pair behaviour can differ; keep any `charCodeAt` that asserts a code
  unit and record why.
- [x] 3.10 Fix the small pedantic group: `unicorn/no-array-callback-reference`
  (11), `unicorn/prefer-number-coercion` (6), `eslint/no-inner-declarations`
  (5), `unicorn/prefer-type-error` (4), `eslint/no-loop-func` (4),
  `unicorn/no-object-as-default-parameter` (2), `unicorn/new-for-builtins` (2),
  `eslint/no-redeclare` (1), `eslint/no-promise-executor-return` (1),
  `eqeqeq` (1) and the `eslint/require-await` fix in `src/cli.ts` (1). No
  assertion is weakened; re-measure the remainder.
- [x] 3.11 Fix the type-aware findings: the `src` `no-unsafe-type-assertion`
  casts except the six byte-pinned ones in the browser files,
  `typescript/no-floating-promises` (2), `typescript/await-thenable` (2),
  `typescript/unbound-method` (2), `typescript/no-misused-spread` (2),
  `typescript/restrict-template-expressions` (2), `typescript/prefer-includes`
  (1), the enum comparisons and assignments (5) and
  `typescript/require-array-sort-compare` (7). Each fix
  keeps behaviour; a floating promise is awaited or explicitly handled, never
  silenced. `typescript/no-base-to-string` and `typescript/consistent-return`
  are fixed; if a site proves the rule wrong, record the deviation and update the
  table in 1.2.
- [x] 3.12 Fix the `no-unnecessary-*` cleanups (about 77).
- [x] 3.13 Prepend `* text=auto eol=lf` to `.gitattributes` (before the fixture
  lines, so their attributes keep precedence) and renormalize the seven tracked
  files with CRLF or mixed index endings: five archived OpenSpec files,
  `docs/adr/0007-optional-pdf-engine.md` and `src/render/escape.ts`
  (line-ending-only commit).
- [x] 3.14 Add `.oxfmtrc.json` (`printWidth: 80`, `singleQuote: true`,
  `sortImports: false`, `sortPackageJson: false`, the exact `ignorePatterns`),
  pin Oxfmt 0.80.0 and add `format:check`/`format`; put `format:check` in
  `check` before `build`. Do not commit the config alone.
- [x] 3.15 Format the re-measured tracked files and land the config, scripts, the
  `format:check` wiring and the formatted tree in one commit, so the gate is
  green at every commit. Rebuild assets, prove generated sources, both report
  CSS files, fixtures and goldens are unchanged, and render the legacy and
  Messages fixtures before and after to compare bytes.
- [x] 3.16 Add `@vitest/coverage-v8` exactly 5.1.1, remove `passWithNoTests`,
  add the coverage scope/exclude/thresholds and `test:coverage`, and put it last
  in `check`. Prove an empty test selection fails and the measured suite passes
  the floor.
- [x] 3.17 Docs: `docs/CHANGELOG.md` (tooling only, no runtime change, the
  dev-only dependencies, the public input declarations unchanged, the internal
  `options.d.ts` diff, the `cause` effect), `docs/ARCHITECTURE.md` (gate
  composition, the two typecheck programs, the maximal lint set and the LF
  policy) and `CONTRIBUTING.md`/`AGENTS.md` if they name the old scripts.
  Record the `oxlint --type-aware` decision and the pinned binary in
  `docs/BACKLOG.md`. Do not bump the version.
- [x] 3.18 Scope the byte-pinned browser findings per line: remove the four
  file-level headers, keep the 14 browser `oxlint-disable-next-line` entries
  with rule and reason, restore `eslint/require-await` to the two per-file
  overrides, and pin the exact global `off` set and the exact 26-entry
  inline-suppression set (including the `.cts`, gate-test and test directives)
  in the tooling test. Prove `src/render/client-bundle.ts` stays byte-identical.
- [x] 3.19 Review fixes: scan `src/**` and `test/**` for `.ts`/`.cts`/`.mts`
  with the line-start directive regex and reject the no-space file-level form;
  pin the exact override map, the exact seven `check` steps and the 26-entry
  suppression map; read the browser graph from `tsconfig.client.json`; assert
  the Vitest `No test files found` message; restore exact `Object.is` boolean
  assertions; drop `ENOENT` from the sidecar alternation; pin the mixed
  array/object legacy table as no data table; pin `vitest` to 5.1.1; remove the
  two redundant probes; assert PNG precedence and the accurate `text.ts`
  reasons. Commit `4b8717c`.
- [x] 3.20 Switch the formatter to Oxfmt 0.80.0 on the user's 2026-11-26
  decision: replace the Prettier dependency, config and ignore file, reformat
  the tree, swap the test assertions and probe, and prove the client bundle stays
  byte-identical and `format:check` drops from 5.3 s to 0.67 s. Commit
  `b2e9da2`.

## 4. Verification and review

- [x] 4.1 Green on 2026-11-26. Host: Windows 11 (10.0.26300), 12 cores,
  Node 26.13.1, npm 10.8.2, Playwright 1.65.1, default Vitest workers.
  `npm run hygiene`: ok (860 files, 470 commits). `npm run check`: exit 0,
  29.8 s warm. `npm run test:e2e`: exit 0, 174.4 s, 454 passed / 8 skipped on
  Chromium, Firefox and WebKit. Unit: 93 files, 1,796 passed / 10 skipped; the
  new tooling file is the justified delta (30 tests, 5.2 s standalone,
  +2.6-3.2 s inside the suite). Strict: 88 errors in 22 files before, 0 after,
  both programs green. Lint: 335 findings at 3.4 (63 base, 156 pedantic, 116
  type-aware), 314 fixed, 21 pinned, 0 remaining; 26 inline directives with
  reasons, exact-pinned. Formatting: Oxfmt 0.80.0, `.oxfmtrc.json` (printWidth
  80, singleQuote, sortImports and sortPackageJson off) with the 25-entry exact
  ignore list; `format:check` 0.67 s warm (Prettier was 5.3 s); the protected
  tree (generated sources, catalogs, both CSS, fixtures, both goldens; 170
  files) is byte-identical, the nine characterization hashes and both goldens
  are unchanged. LF: seven files renormalized; six files were reformatted
  beyond Prettier's output. Coverage: 94.67 / 87.61 / 96.95 / 96.13 against
  93 / 86 / 95 / 95. Bundle: 15,438 B, sha256 `c018a0c3404018a1…`, unchanged.
  Pack: 81 entries, 664,104 B; `bin`, `exports`, `files`, `dependencies` and
  version unchanged from 0.6.1; the published 0.6.1 tarball has 80 entries and
  omits `docs/README.md`, recorded as B-071 and not caused by this change. Gate
  delta: ~7 s warm, attributed to coverage (2.1-4.5), the probe file
  (2.6-3.2), lint (1.3), typecheck (0.6) and the formatter (0.67); the base
  >20 % rule is answered by the split.
- [x] 4.2 Two independent batches. First: SCR, CR, DAR and STR FAIL; SEC and
  PCA PASS. All findings were fixed in `4b8717c` (26-entry pin across
  `src`/`test` `.ts`/`.cts`/`.mts`, exact overrides, exact check steps, client
  graph from `tsconfig`, exact boolean assertions, mixed legacy rows, Vitest
  5.1.1, redundant probes) or recorded (the line-start scan limit). The Oxfmt
  switch is `b2e9da2`. Delta re-check: SCR, STR and DAR PASS; CR PASS with one
  low residual (the `eslint-disable` spellings), closed in `d09dfcf`. UXR, CMP
  and ILA are not triggered; the hashes prove no report byte changes.
- [x] 4.3 No host row is required. The only PDF contact is the
  `preserve-caught-error` `cause` addition in `src/pdf.ts`; the compat contacts
  are the scoped rule overrides in `src/compat/cucumber-html-reporter.ts` and
  `.cts`. They change no output, attachment path or shim behaviour, the report
  bytes are proven unchanged and the PDF/e2e tests cover those flows.
- [x] 4.4 Gate record: 4.1-4.3 above, design §3 (lint table, suppressions,
  exact configs), §4 (formatting scope and LF), §6 (gate composition) and the
  package proof. Deferred findings: B-071 (0.6.1 tarball and `docs/README.md`,
  release, trigger before the next tag) and B-072 (tsdown, 0.7). Nothing is
  dropped.
- [x] 4.5 Every review finding is fixed in `4b8717c` or `d09dfcf`, or recorded
  as the documented line-start scan limit; the gate was re-run after both.

## 5. Release boundary

- [ ] 5.1 Do not bump the version, tag, stage or publish. 0.6.2 preparation and
  approval remain a separate user decision after this change is complete and
  reviewed.
