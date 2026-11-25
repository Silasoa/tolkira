# Design

## Context

The approved B-055 package is a tooling change on 0.6.1. Measured on
2026-11-25 at `e5c002a`: Windows x64, Node 26.13.1, TypeScript 7.0.2, Vitest
5.1.1, oxlint 1.94.0 (from `^1.90.0`), esbuild 0.28.2. The evidence lives in
`docs/research/b055-lint-inventory.md` and
`docs/research/b055-tooling-plan.md`; this design turns it into the contract.

The gate is `npm run check` and is already the only command CI and the release
workflow call. The change adds work inside it, so no workflow file changes.

## Goals / Non-Goals

**Goals:**

- Make the typecheck strict without changing behaviour or report bytes.
- Guard the browser graph against Node globals with a separate program.
- Turn lint into a curated zero-warning gate with documented exceptions.
- Check formatting with a pinned formatter and a report-byte-safe scope.
- Fail an empty test selection and enforce a measured coverage floor.
- Keep one local and CI gate, and keep the added runtime under ten seconds.

**Non-Goals:**

- `oxlint --type-aware` / `oxlint-tsgolint`: evaluated, not adopted. It adds a
  per-platform binary dependency and 330 findings, 287 of them
  `no-unsafe-type-assertion` noise on fixtures, for about seven new signals.
- ESLint, a second formatter, or formatting Markdown and `openspec/`.
- Formatting generated sources, report CSS, fixtures, goldens or lockfiles.
- Any runtime, CLI, API, report, summary, attachment or package-entry change.
- Any version bump, tag, stage or publish.

## Decisions

### 1. Strict flags without widening the public types

Enable the six flags in `tsconfig.json` and fix the 86 errors by class:

| Class | Count | Rule |
| --- | --- | --- |
| TS18048 | 19 | Guard or default at the indexed read. |
| TS2345 | 21 | Same value as TS18048, narrowed once at the read. The high-leverage test edit is `compat-sidecar.test.ts`'s `happyFeatures()` returning one feature (throw on an empty fixture), which clears 12 + 5 + 5 combined findings across TS18048/TS2345/TS2379. |
| TS2379 | 14 | Conditional spreads at the call site; do **not** declare option properties as `T | undefined`. |
| TS2375 | 8 | Conditional spread or hoist a double call (`productLabel`, `timestampIso`) so narrowing holds. |
| TS2532 | 10 | Non-null assertion only where a preceding assertion proves presence; otherwise a local guard. |
| TS6133 / TS4114 | 12 / 2 | `_doc` parameter; `override` on the two stream methods. |

The inventory proposed widening the five public input option bags with
`| undefined` to clear seven TS2379 findings. That changes the emitted
declarations (`title?: string` becomes `title?: string | undefined`), which the
approved package rules out. The alternative is chosen: conditional spreads at
the CLI call sites (`title`, `metadata`, `logo`, `accent`, `historyLimit`) and
in `renderOptions()` for `metadata`, `logo`, `accent`, `locale`, `static`.
`GenerateReportOptions.historyLimit` stays `number | undefined` only as an
optional property; the CLI passes it conditionally. The cost is about 20 lines;
the public declaration stays byte-identical.

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

`tsconfig.build.json` and `tsconfig.compat-cjs.json` are untouched, so
declaration emit is byte-identical (56 files verified) and esbuild reads only
`tsconfig.json`. No `tsc -b`: it would write `*.tsbuildinfo` and turn
`tsconfig.json` into a solution file that esbuild and the build configs depend
on. The typecheck script runs two `tsc -p` passes (1.4 s + 1.1 s).

### 3. Curated lint with documented exceptions

`.oxlintrc.json` at the repo root, verified in shape by the research:

- plugins `typescript`, `unicorn`, `oxc`, `import`, `promise`, `node`,
  `vitest`; categories correctness `error`, suspicious `warn`, perf `warn`;
- `vitest/valid-expect` with `maxArgs: 2`; `vitest/expect-expect` with the five
  local assertion names; `eslint/no-underscore-dangle` allowing the two probe
  globals;
- off globally: `no-await-in-loop` (deliberate sequential input loading and
  ordered Playwright steps; `Promise.all` would change ordering, peak memory
  and error precedence), `unicorn/no-array-sort` (every site sorts a locally
  built array; `toSorted()` adds allocation for no observable change),
  `unicorn/consistent-function-scoping` (colocated fixtures),
  `vitest/no-conditional-expect` (all 17 are paired branches or environment
  guards, and the rewrite is where a test could be weakened),
  `oxc/no-map-spread` (cold paths, clearest form), `unicorn/prefer-set-has`
  (false positive: the value is a string);
- per-file off: `promise/no-callback-in-promise` in `src/stream.ts` and
  `src/compat/cucumber-html-reporter.ts` (Node callback contract);
  `eslint/no-shadow` in `src/compat/cucumber-html-reporter.cts` (the public CJS
  type names the `export =` namespace must redeclare).

Fix the remaining 62 findings mechanically: rename 19 shadowed bindings, add
`vi.fn<...>` type arguments (21), add `{ cause }` (11), add a stable throw
message to 8 assertions, spy on `localeCompare` instead of assigning to the
prototype (2), and return the discarded code in `cli.ts` (1).

Script: `oxlint --max-warnings=0 .`. Pin `oxlint` to `1.94.0` exactly so a new
minor cannot add rules or warnings to the gate without a deliberate bump; the
allowance is the same as Prettier's.

### 4. Formatting scope

`.prettierrc.json`: `{ "singleQuote": true, "printWidth": 80 }`, Prettier
3.10.1 pinned. Everything else is 3.x default and matches `.editorconfig`.

`.prettierignore` excludes: `node_modules`, `dist`, `coverage`,
`playwright-report`, `blob-report`, `test-results`, Playwright caches,
`.openchamber`, `.opencode`, `.tmp`, `.cache`, `openspec/`, `test/fixtures/`,
`docs/comparison/`, `docs/ui-loop/`, `package-lock.json`, `*.tgz`, `*.png`,
`*.webm`, the three generated sources (`src/render/client-bundle.ts`,
`src/render/styles.ts`, `src/i18n/catalogs.ts`), the two report CSS files,
`src/render/baseline.css` and `*.md`.

`*.md` is excluded so the formatting commit stays code-only; docs may follow as
their own commit. The CSS files are copied verbatim into report strings, and
the fixtures include the two golden HTML files. Formatting any of them would
change report bytes, which the contract forbids.

Blast radius is 156 tracked files: 36 `src`, 109 `test`, 7 `scripts`, 3
`.github` issue templates, 1 `tsconfig.json`. Formatting all of `src` in a copy
and rebuilding gives identical report bytes for the legacy and Messages
fixtures and an unchanged minified client bundle. Non-minified `dist/*.js`
whitespace changes on the next rebuild; that is a formatting-only difference
and the release rebuild is the documented point.

Scripts: `format:check` and `format`. The formatting is one isolated commit,
never mixed with a logic change.

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
"lint": "oxlint --max-warnings=0 .",
"format:check": "prettier --check .",
"format": "prettier --write .",
"test:coverage": "vitest run --coverage",
"check": "npm run i18n:check && npm run assets && npm run typecheck && npm run lint && npm run format:check && npm run build && npm run test:coverage"
```

`prepublishOnly` keeps calling `check`, so a release also needs formatting and
the coverage floor. `ci.yml` and `release.yml` need no edit: every check job
already runs `npm run check`. The whole gate grows by seven to ten seconds.

### 7. Work order and commits

1. Strict flags and the 86 fixes (src first, then tests), green under
   `tsc --noEmit`.
2. The client project and the typecheck script.
3. The curated lint config, the 62 fixes, the pin and `--max-warnings=0`.
4. Prettier config, ignore, scripts and the formatting-only commit; then rebuild
   assets and confirm no generated diff.
5. Coverage provider, remove `passWithNoTests`, thresholds, `test:coverage`
   and the `check` order.
6. Docs and gate record.

Each commit is one logical change, runs `npm run hygiene`, and never mixes the
formatting commit with logic. The change itself stays uncommitted as a release
candidate until the user approves a version.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Coverage thresholds flake across Node 22/24/26 or Windows. | One to two points of headroom; lower by one in a documented follow-up; never drop the gate. |
| The client project guards only five named files. | Anything reached from the browser entry is pulled in; re-check the list when the entry changes. The metafile is the source of truth. |
| The server project keeps DOM, so it alone would not catch `document` in server code. | Accepted: `pdf.ts` needs DOM within `page.evaluate`. The client program is the no-Node guard; the no-DOM probe fails only on `pdf.ts` and the browser entry. |
| Formatting 156 files obscures `git blame`. | One isolated commit, optional `.git-blame-ignore-revs`, never mixed with logic. |
| A wrong ignore pattern changes report bytes or is reverted by the build. | The proof step runs `npm run assets` and `git diff --exit-code` on the generated files; CSS, fixtures and goldens are explicitly out of scope. |
| Rebuilding `dist` after formatting changes non-minified whitespace. | Accepted and recorded; report bytes, behaviour, API and shipped file list are unchanged. |
| Pinning `oxlint` exactly delays rule updates. | Deliberate: a new rule set is a reviewed bump commit, the same policy as Prettier. |
| `preserve-caught-error` adds a `cause` property. | Internal only; messages and stderr are unchanged and no consumer reads error keys. |
| Removing `passWithNoTests` breaks an ad-hoc mistyped `vitest run`. | Intended; every package script names a real file or the full glob. |
| The coverage provider install hits an npm 10.8.2 arborist bug without the lockfile. | Add it as a normal dev dependency with the lockfile; use `--legacy-peer-deps` only if npm fails, then `npm ci`. |

## Tests

- `test/tooling-config.test.ts` (new) asserts the six flags, the two-project
  typecheck, the client program's `types: []` and file list, the curated lint
  categories/plugins/severities/exceptions, the `--max-warnings=0` script, the
  Prettier config and ignore entries, the coverage provider/scope/thresholds,
  the removed `passWithNoTests`, the `check` order and the exact dev-dependency
  pins.
- Behavioural probes, not only config reads: one temporary TypeScript file that
  violates `noUncheckedIndexedAccess` fails the strict program; one temporary
  browser-graph module that reads `process` fails the client program; a
  suspicious lint finding makes `--max-warnings=0` exit non-zero while a clean
  file exits zero; an unformatted source copy fails `format:check`; a
  nonexistent test pattern fails when `passWithNoTests` is gone.
- Existing tests are untouched by the tooling change except the mechanical fixes
  above. The 62 lint fixes never weaken an assertion: `require-to-throw-message`
  only adds a stable message, and `no-extend-native` keeps the same spy.
- Report characterization: the nine hashes and both golden files must stay
  unchanged; the proof renders the legacy and Messages fixtures before and after
  formatting.

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
