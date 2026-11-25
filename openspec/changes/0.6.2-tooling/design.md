# Design

## Context

The approved B-055 package is a tooling change on 0.6.1. Measured on
2026-11-25 at `e5c002a`: Windows x64, Node 26.13.1, TypeScript 7.0.2, Vitest
5.1.1, oxlint 1.94.0 (from `^1.90.0`), esbuild 0.28.2, Prettier 3.10.1. The
evidence lives in `docs/research/b055-lint-inventory.md` and
`docs/research/b055-tooling-plan.md`; this design turns it into the contract.
PIR and DXR reviewed the first draft; their findings are folded in below.

The gate is `npm run check` and is already the only command CI and the release
workflow call. The change adds work inside it, so no workflow file changes.

## Goals / Non-Goals

**Goals:**

- Make the typecheck strict without changing behaviour or report bytes.
- Guard the browser graph against Node globals with a separate program.
- Turn lint into a maximal zero-warning gate with type-aware rules and
  documented exceptions.
- Check formatting with a pinned formatter and a report-byte-safe scope, with
  the same result on every operating system.
- Fail an empty test selection and enforce a measured coverage floor.
- Keep one local and CI gate and name the added runtime honestly: the tooling
  steps plus one probe test file.

**Non-Goals:**

- ESLint, a second formatter, or formatting Markdown and `openspec/`.
- Formatting generated sources, report CSS, fixtures, goldens or lockfiles.
- Any runtime, CLI, API, report, summary, attachment or package-entry change.
- Any version bump, tag, stage or publish.

## Decisions

### 1. Strict flags without widening the public types

Enable the six flags in `tsconfig.json` and fix the 86 errors by class. On the
user's 2026-11-25 decision the set grows to every sensible compiler check, so
five more are added: `noUncheckedSideEffectImports`,
`noFallthroughCasesInSwitch`, `allowUnreachableCode: false`,
`allowUnusedLabels: false` and `isolatedModules`. Measured on the same tree:
0, 0, 2, 0 and 0 errors. The two `allowUnreachableCode` hits are dead `break`
statements after the `never`-returning `invalidJson()` in `src/input/load.ts`
(182, 238); both are removed. The total is 88 errors in 21 files.

| Class | Count | Rule |
| --- | --- | --- |
| TS18048 | 19 | Guard or default at the indexed read. |
| TS2345 | 21 | Same value as TS18048, narrowed once at the read. The high-leverage test edit is `compat-sidecar.test.ts`'s `happyFeatures()`, which returns `Promise<[LegacyFeature, ...LegacyFeature[]]>` (throw on an empty fixture). The tuple keeps all 16 destructuring call sites and is a single-function edit. |
| TS2379 | 14 | Conditional spreads at the call site; do **not** declare option properties as `T \| undefined`. Includes `test/stream.test.ts:43`. |
| TS2375 | 8 | Conditional spread or hoist a double call (`productLabel`, `timestampIso`) so narrowing holds. |
| TS2532 | 10 | Non-null assertion only where a preceding assertion proves presence; otherwise a local guard. |
| TS6133 / TS4114 | 12 / 2 | `_doc` parameter; `override` on the two stream methods. |

The inventory proposed widening the five public input option bags with
`| undefined` to clear seven TS2379 findings. That changes the emitted
declarations (`title?: string` becomes `title?: string | undefined`), which the
approved package rules out. The alternative is chosen: conditional spreads at
the CLI call sites (`title`, `metadata`, `logo`, `accent`, `locale`,
`historyLimit`) and in `renderOptions()` for `metadata`, `logo`, `accent`,
`locale`, `static`. `GenerateReportOptions.historyLimit` stays a plain optional
property; the CLI passes it conditionally. The cost is about 20 lines; the
public input declarations stay byte-identical.

Where a bag has exactly one optional field, `formatCiOutput`'s `title` at two
call sites, a spread would also trip `unicorn/no-useless-spread` (correctness,
error). Pass a ternary object instead:
`title === undefined ? {} : { title }`. The research re-checked that this keeps
the base total at 62 findings.

The one emitted declaration that changes is the inferred return type of the
internal `renderOptions()` helper (`dist/options.d.ts`): five fields move from
required `T | undefined` to optional `T`. `renderOptions` is not exported from
the package entry; `dist/index.d.ts`, the run/stream/email/pdf declarations and
both compat declarations stay unchanged, and no public input interface changes.
The proof in task 3.3 is scoped to that.

Two compiler checks stay off, each with a measured reason:

- `noPropertyAccessFromIndexSignature`: 364 findings, all bracket-access
  rewrites. It is purely syntactic — under `noUncheckedIndexedAccess` the type
  is already `T | undefined` either way — so it buys consistency, not safety,
  at the cost of the JSON-heavy readers.
- `erasableSyntaxOnly`: two sites, both deliberate (a parameter property in
  `src/stream.ts` and the `export =` namespace in the public CJS compatibility
  declaration). The project ships emitted JavaScript, not Node type stripping,
  and the compat declaration is a published API surface.

No fix changes report bytes: every consumer uses `??` or truthiness, never key
presence, and `JSON.stringify` drops undefined-valued keys. The two non-byte
effects are declared: `preserve-caught-error` adds `cause` to error objects
while messages and stderr stay identical, and `no-extend-native` replaces a
direct `String.prototype.localeCompare` assignment with `vi.spyOn`, same patch
and restore.

### 2. Client program with no Node types

The browser graph is authoritative from the build metafile: the entry
`src/render/report-client.ts` reaches `client-i18n.ts`, `search.ts`,
`dom-contract.ts` and (type-only) `src/report/status.ts`. There is no shared
project: `search.ts` needs `URL`/`URLSearchParams`, so a no-DOM program cannot
hold it; the client program keeps DOM and drops Node types.

`tsconfig.json` stays the server and test project unchanged as a base (it keeps
DOM because `src/pdf.ts` legitimately runs page code in a browser context).
`tsconfig.client.json` extends it with `types: []`, `lib: ["ES2022", "DOM"]`,
and exactly those five files. Its entry pulls the rest; the list documents the
boundary.

`tsconfig.build.json` and `tsconfig.compat-cjs.json` are untouched, so the
emitted declarations change only where a source type changes (the internal
`options.d.ts` helper above). Prettier does not format generated sources, so no
generated file is rewritten. esbuild reads only `tsconfig.json`. No `tsc -b`:
it would write `*.tsbuildinfo` and turn `tsconfig.json` into a solution file
that esbuild and the build configs depend on. The typecheck script runs two
`tsc -p` passes (1.4 s + 1.1 s).

### 3. Maximal lint with documented exceptions

On the user's 2026-11-25 decision the lint set is the maximal one that reports
defects rather than preference. Extend the scaffolded `.oxlintrc.json` at the
repo root; keep its existing `ignorePatterns` (`dist/**`, `node_modules/**`,
`playwright-report/**`, `test-results/**`, `.opencode/**`) and add `coverage/**`
and `.openchamber/**`, so the gate does not lint its own output. Measured with
every non-nursery category on, the tree yields 31,605 findings; most are
preference rules (`one-var` 4,965, `no-magic-numbers` 4,823, `sort-keys`
2,184), which is why the set is curated by category and documented exception
instead of "all":

- plugins `typescript`, `unicorn`, `oxc`, `import`, `promise`, `node`,
  `vitest`; categories correctness `error`, suspicious, perf and pedantic
  `warn`; type-aware rules on with `oxlint --type-aware` and a pinned
  `oxlint-tsgolint`;
- `vitest/valid-expect` with `maxArgs: 2`; `vitest/expect-expect` with the five
  local assertion names; `eslint/no-underscore-dangle` allowing the two probe
  globals; `typescript/no-unsafe-type-assertion` off in `test/**` only, because
  the fixtures build malformed inputs with deliberate casts (228 of the 330
  type-aware findings);
- off globally as threshold rules with no defect signal: `max-lines` (76),
  `max-lines-per-function` (304), `max-depth` (17), `max-statements` and
  `max-dependencies` (16);
- off globally as preference or modernization without a defect signal:
  `require-unicode-regexp` (956; every pattern would need its own Unicode
  review and the internal patterns are ASCII — revisit on a Unicode defect),
  `escape-case` (109), `no-useless-undefined` (77), `no-negated-condition` (32),
  `prefer-dom-node-dataset` (28), `explicit-length-check` (27),
  `prefer-query-selector` (20), `prefer-single-call` (11),
  `prefer-number-coercion` (6), `prefer-top-level-await` (4), `prefer-at` (3),
  `no-hex-escape` (3), `new-for-builtins` (2),
  `no-object-as-default-parameter` (2), `prefer-import-meta-properties` (1);
- off globally as deliberate design: `no-await-in-loop` (355; sequential input
  loading and ordered Playwright steps, where `Promise.all` would change
  ordering, peak memory and error precedence), `no-conditional-in-test` (363;
  cross-engine and environment guards), `no-array-sort` (69; every site sorts a
  locally built array and `toSorted()` adds allocation),
  `require-await` (41; the flagged functions are async for the Playwright and
  Vitest interfaces), `unicorn/consistent-function-scoping` (36; colocated
  fixtures), `vitest/no-conditional-expect` (17; paired branches),
  `oxc/no-map-spread` (8; cold paths, clearest form),
  `unicorn/prefer-set-has` (1; false positive, the value is a string);
- per-file off: `promise/no-callback-in-promise` in `src/stream.ts` and
  `src/compat/cucumber-html-reporter.ts` (Node callback contract);
  `eslint/no-shadow` in `src/compat/cucumber-html-reporter.cts` (the public CJS
  type names the `export =` namespace must redeclare).

Fix the 62 base findings as before: rename 19 shadowed bindings, add
`vi.fn<...>` type arguments (21), add `{ cause }` (11), add a stable throw
message to 8 assertions, spy on `localeCompare` instead of assigning to the
prototype (2), and return the discarded code in `cli.ts` (1). Then fix the
pedantic remainder that reports a defect: `unicorn/prefer-string-replace-all`
(102), `unicorn/prefer-code-point` (20; surrogate-pair correctness),
`unicorn/no-array-callback-reference` (11), `eslint/no-inner-declarations` (7),
`eslint/no-loop-func` (5), `unicorn/prefer-type-error` (4),
`eslint/no-promise-executor-return` (1), `eslint/no-redeclare` (1), `eqeqeq`
(1). Finally fix the type-aware findings other than the scoped assertion rule:
`no-floating-promises` (3), `await-thenable` (2), `unbound-method` (2),
`no-misused-spread` (2), `restrict-template-expressions` (2),
`no-base-to-string` (1), `consistent-return` (1), the enum comparisons and
assignments (5), `require-array-sort-compare` (7) and the `no-unnecessary-*`
cleanups (about 77).

Script: `oxlint --type-aware --max-warnings=0 .`. Pin `oxlint` to `1.94.0` and
`oxlint-tsgolint` to `7.0.2008` exactly, so a new minor cannot add rules or
warnings to the gate without a deliberate bump. The type-aware pass adds 1.9 s.
`test/tooling-config.test.ts` asserts the categories, the scoped override and
every exclusion, so a silent weakening of the gate fails the suite and needs a
reviewed contract change.

### 4. Formatting scope

`.prettierrc.json`: `{ "singleQuote": true, "printWidth": 80 }`, Prettier
3.10.1 pinned. Everything else is 3.x default and matches `.editorconfig`.
`endOfLine` keeps Prettier's default `lf`.

That default makes the check checkout-dependent: `windows-latest` runs with
`core.autocrlf=true`, and `.gitattributes` currently pins only
`test/fixtures/**`. Prepend `* text=auto eol=lf` (before the existing lines, so
the fixture attributes keep precedence) and renormalize the six tracked files
whose index holds CRLF or mixed line endings: five archived OpenSpec files and
`docs/adr/0007-optional-pdf-engine.md`. It is a line-ending-only commit; without
it the Windows check job fails on every text file.

`.prettierignore` excludes: `node_modules`, `dist`, `coverage`,
`playwright-report`, `blob-report`, `test-results`, Playwright caches,
`.openchamber`, `.opencode`, `.tmp`, `.cache`, `openspec/`, `test/fixtures/`,
`docs/comparison/`, `docs/ui-loop/`, `package-lock.json`, `*.tgz`, `*.png`,
`*.webm`, the three generated sources (`src/render/client-bundle.ts`,
`src/render/styles.ts`, `src/i18n/catalogs.ts`), the two report CSS files
`src/render/report.css` and `src/render/baseline.css`, and `*.md`.

`*.md` is excluded so the formatting commit stays code-only; docs may follow as
their own commit. The CSS files are copied verbatim into report strings, and
the fixtures include the two golden HTML files. Formatting any of them would
change report bytes, which the contract forbids.

Blast radius is the ~156 tracked files measured at `e5c002a` (36 `src`, 109
`test`, 7 `scripts`, 3 `.github`, 1 `tsconfig.json`). Re-measure after Red:
`test/tooling-config.test.ts`, `tsconfig.client.json` and `.prettierrc.json`
exist by then. Formatting all of `src` in a copy and rebuilding gives identical
report bytes for the legacy and Messages fixtures and an unchanged minified
client bundle. Non-minified `dist/*.js` whitespace changes on the next rebuild;
that is a formatting-only difference and the release rebuild is the documented
point.

Scripts: `format:check` and `format`. `format:check` runs inside `check` before
build. The formatting is one isolated commit, never mixed with a logic change.

### 5. Coverage and empty-suite guard

Remove `passWithNoTests`. Add `@vitest/coverage-v8` exactly `5.1.1` (the
installed Vitest is 5.1.1 and the peer is exact; bump both together). Coverage
scope is `src/**/*.ts`, excluding `src/render/report-client.ts` (the browser
entry, 0 % in Node, covered by the Playwright suite; a new e2e-only module would
need the same explicit decision). Measured baseline: 94.65 statements, 88.04
branches, 96.86 functions, 96.05 lines. Thresholds: 93 / 86 / 95 / 95, which is
one point of headroom except branches (two, the noisiest metric). If the
Node 22/24/26 matrix drifts, lower a threshold by one in a documented
follow-up rather than dropping the gate.

Add `test:coverage` and use it as the last check step. `npm run test` stays the
plain suite for local runs. The coverage run adds about three to five seconds.

### 6. Gate composition

```json
"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.client.json",
"lint": "oxlint --type-aware --max-warnings=0 .",
"format:check": "prettier --check .",
"format": "prettier --write .",
"test:coverage": "vitest run --coverage",
"check": "npm run i18n:check && npm run assets && npm run typecheck && npm run lint && npm run format:check && npm run build && npm run test:coverage"
```

`prepublishOnly` keeps calling `check`, so a release also needs formatting and
the coverage floor. `ci.yml` and `release.yml` need no edit: every check job
already runs `npm run check`.

The tooling steps add nine to twelve seconds: the typecheck passes, the
type-aware lint pass (+1.9 s) and the formatter. The new probe test file adds
four to six on top; its spawns get explicit 30 s/40 s timeouts so a cold Windows
CI does not hit the default 5 s test timeout. Gate time is recorded as tooling
steps and probe file separately, and the base rule that investigates a >20 %
runtime increase is answered by that split, not waived.

### 7. Work order and commits

1. Strict flags and the 88 fixes (src first, then tests), green under
   `tsc --noEmit`.
2. The client project and the typecheck script.
3. The lint config with the type-aware pin, the 62 base fixes and then the
   pedantic and type-aware fixes, `--max-warnings=0`.
4. The LF policy in `.gitattributes` with the six renormalized files; then
   Prettier config, ignore, scripts and the formatting-only commit; then rebuild
   assets and confirm no generated diff.
5. Coverage provider, remove `passWithNoTests`, thresholds, `test:coverage`
   and the `check` order.
6. Docs and gate record.

Each commit is one logical change and runs `npm run hygiene`; the formatting
commit never mixes with logic. Commits and pushes run per completed step; only
version, tag, stage and publish wait for the user's approval.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Coverage thresholds flake across Node 22/24/26 or Windows. | One to two points of headroom; lower by one in a documented follow-up; never drop the gate. |
| The client project guards only five named files. | Anything reached from the browser entry is pulled in; re-check the list when the entry changes. The metafile is the source of truth. |
| The server project keeps DOM, so it alone would not catch `document` in server code. | Accepted: `pdf.ts` needs DOM within `page.evaluate`. The client program is the no-Node guard; the no-DOM probe fails only on `pdf.ts` and the browser entry. |
| Formatting the ~156 baseline files obscures `git blame`. | One isolated commit, optional `.git-blame-ignore-revs`, never mixed with logic. |
| A wrong ignore pattern changes report bytes or is reverted by the build. | The proof step runs `npm run assets` and `git diff --exit-code` on the generated files; CSS, fixtures and goldens are explicitly out of scope. |
| Prettier's LF default fails on a CRLF checkout. | `* text=auto eol=lf` prepended in `.gitattributes`, six tracked files renormalized, Windows job proven by CI. |
| Rebuilding `dist` after formatting changes non-minified whitespace. | Accepted and recorded; report bytes, behaviour, API and shipped file list are unchanged. |
| The internal `options.d.ts` return shape changes. | Not exported from the package entry; the public entry, compat declarations and input interfaces are proven unchanged. |
| Pinning `oxlint` exactly delays rule updates. | Deliberate: a new rule set is a reviewed bump commit, the same policy as Prettier. |
| `oxlint-tsgolint` adds a per-platform binary and 330 findings, 228 of them assertion casts in fixtures. | Dev-only exact pin; the assertion rule is scoped off in `test/**`; the 102 real fixes are part of the change. |
| The pedantic and type-aware fixes touch tests mechanically. | Each rule group is its own task and commit; `prefer-code-point` is reviewed per site because surrogate behaviour can differ; assertions are not weakened. |
| `preserve-caught-error` adds a `cause` property. | Internal only; messages and stderr are unchanged and no consumer reads error keys. |
| Removing `passWithNoTests` breaks an ad-hoc mistyped `vitest run`. | Intended; every package script names a real file or the full glob. |
| The coverage provider install hits an npm 10.8.2 arborist bug without the lockfile. | Add it as a normal dev dependency with the lockfile; use `--legacy-peer-deps` only if npm fails, then `npm ci`. |
| The probe file slows the unit suite past the base 20 % rule. | Explicit timeouts, recorded split, and the increase is investigated and explained rather than hidden. |

## Tests

- `test/tooling-config.test.ts` (new) asserts the eleven flags, the two-project
  typecheck, the client program's `types: []` and file list, the maximal lint
  plugins/categories/severities/exceptions and the retained `ignorePatterns`,
  the type-aware script and the `oxlint-tsgolint` pin, the scoped
  `no-unsafe-type-assertion` override, the `--max-warnings=0` script, the
  Prettier config and ignore entries, the `.gitattributes` LF policy, the
  coverage provider/scope/thresholds, the removed `passWithNoTests`, the `check`
  order and the exact dev-dependency pins.
- Behavioural probes, each with a positive control: a temporary TypeScript file
  that violates `noUncheckedIndexedAccess` (`values[0].toUpperCase()` yields
  TS18048) fails the strict program while a compliant copy passes (the probe
  config sets `types: []` and the assertion names TS18048, so it cannot pass for
  the wrong reason); a temporary browser-graph module that reads `process`
  fails the client program while a DOM-only copy passes (temp config lists the
  five repo files plus the module); a floating promise in a temporary module
  fails the type-aware lint while an awaited copy passes; a warning-severity
  `eslint/no-shadow` finding makes `--max-warnings=0` exit non-zero while plain
  `oxlint` exits zero on it and both exit zero on a clean copy; an unformatted
  source copy fails `prettier --check <file> --config <repo>/.prettierrc.json`
  while a formatted copy passes; a nonexistent test pattern fails when
  `passWithNoTests` is gone while a matching pattern passes; a one-file coverage
  run with `--coverage.thresholds.lines=100` fails on a 0 % control while the
  measured file passes, which keeps the probe at four to six seconds.
- Existing tests are untouched by the tooling change except the mechanical fixes
  above. The lint fixes never weaken an assertion: `require-to-throw-message`
  only adds a stable message, and `no-extend-native` keeps the same spy.
- Report characterization: the nine hashes and both golden files must stay
  unchanged; the proof renders the legacy and Messages fixtures before and
  after formatting. Package content is proven with `npm pack --dry-run --json`
  for the file list and `npm view tolkira@0.6.1 bin exports dependencies
  --json` for the published metadata.

## ADRs

- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md): one package,
  Node 22+, few dependencies; the new packages are dev-only.
- [ADR 0004](../../../docs/adr/0004-normalize-to-messages.md): tooling must not
  change the one-model renderer or its output.

## Open questions

1. **Contract approval.** The B-055 package was approved on 2026-11-24. This
   contract adds no scope beyond it; the one decision that reverses the
   research recommendation (conditional spreads instead of widening the public
   optional types) keeps the approved "no public API change" rule. No product
   question is open.
