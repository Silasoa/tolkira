# B-055 typecheck and lint inventory

Evidence for the strict-type and curated-lint half of B-055. Research only; no
`src/`, `test/`, CI or config was changed.

- Repo state `e5c002a`; untracked `.oxlintrc.probe.json` is the probe config.
- Pins: oxlint **1.94.0** (from `^1.90.0`), TypeScript **7.0.2**, Node
  **26.13.1**, Windows 11 / PowerShell.
- `npm run typecheck` (no extra flags) exits 0, so all errors below come from
  the six flags. Plain `oxlint .` is green; the findings come from the probe.

## 1. Typecheck inventory

```
npx tsc --noEmit --noUncheckedIndexedAccess --exactOptionalPropertyTypes \
  --noImplicitOverride --noUnusedLocals --noUnusedParameters --noImplicitReturns
```

**86 errors in 21 files (9 src, 12 test).** A 22nd "file" is a PowerShell UTF-8
BOM glued to the first line, not a real file.

| Code | Count | Where | Fix class | Effort |
| --- | --- | --- | --- | --- |
| TS18048 | 19 | 4 src, 15 test | guard/default at the index read | S |
| TS2345 | 21 | 1 src, 20 test | same value as TS18048, narrowed once | S |
| TS2379 | 14 | 7 src, 7 test | input option bags accept `undefined` | S |
| TS6133 | 12 | test only | `_doc` parameter | S |
| TS2532 | 10 | 2 src, 8 test | non-null with local proof | S |
| TS2375 | 8 | 8 src | conditional spread / hoist const | S–M |
| TS4114 | 2 | src only | `override` | S |

### TS18048 (19)

```
s:attachment.ts:110,111,113 | s:compat/cucumber-html-reporter.ts:99
t:ci.test.ts:483,956 | t:compat-sidecar.test.ts:73,78,116,120,130,139,140,151,272,277,422,427
t:flaky-visibility.test.ts:295
```

- `attachment.ts:106-113`: the fallback `MEDIA_TYPES[mediaType] ??
  MEDIA_TYPES['application/octet-stream']` is itself an unchecked index. Fix:
  hoist `const DEFAULT_MEDIA_TYPE = MEDIA_TYPES['application/octet-stream']!`
  and use it. Real fix; the key exists.
- `compat/cucumber-html-reporter.ts:96-99`: `findIndex` does not narrow an
  index. Fix: `const candidate = parsed[index]!` (the `index !== -1` proof is
  already there) or a guard that throws the same collision error.
- Tests: `const [line] = annotationLines(...)` and
  `catalog['report.flakySummary']`. Fix with a guard or `?? ''`; see Hand-off.

### TS2345 (21)

```
s:compat/cucumber-html-reporter.ts:98
t:ci.test.ts:470,484,500,566 | t:compat-sidecar.test.ts:171,184,248,323,478
t:e2e/email.spec.ts:117 | t:e2e/helpers.ts:309(x2),316,317,318,351,367,397
t:e2e/responsive.spec.ts:316 | t:release-workflow.test.ts:19
```

One undefined index value flowing into a parameter: `annotationMessage(line)`,
`writeFeature(..., happy)`, `parseInt(match[1])`, `copyFile(fixtures[0], ...)`,
`jobs.set(header[1], ...)`. Fix at the read (`const [line = ''] = ...`,
`if (!match) ...`, `fixtures[0]!`), not on the callee.

### TS2379 (14) — exact optional properties at a call boundary

```
s:cli.ts:679,688,703,723,756 | s:run.ts:93 | s:stream.ts:28
t:compat-sidecar.test.ts:196,224,302,307,338 | t:dom-contract.test.ts:187
t:stream.test.ts:43
```

1. **Input option bags** are `title?: string` while callers pass the CLI's
   `string | undefined`. Declare the inputs as `title?: string | undefined`
   (likewise `metadata`, `logo`, `accent`, `locale`, `static`,
   `GenerateReportOptions.historyLimit`). Clears `cli.ts:679/688/703/723/756`
   and `stream.test.ts:43`.
2. `renderOptions()` (`src/options.ts:23-32`) copies absent values straight
   through, so its return type is `string | undefined` for five fields that
   `RenderOptions` (exact, internal) rejects. Add conditional spreads, the idiom
   `run.ts` already uses. Clears `run.ts:93` and `stream.ts:28` except
   `provenance`; fix that at `run.ts:99` with the same pattern.
3. `compat-sidecar` clears when `happyFeatures()` returns one feature (Hand-off).
4. `dom-contract.test.ts:187` wants a truly absent status:
   `const { status: _status, ...withoutStatus } = facts;`.

**Public surface:** item 1 widens emitted `.d.ts` option properties with
`| undefined` — additive, runtime-free; note it in the changelog. Alternative
(conditional spreads at 5 CLI sites) avoids the d.ts change but adds ~20 lines.
Policy: inputs accept `undefined`, output models never carry undefined-valued
keys.

### TS2375 (8) — explicit undefined in constructed model objects

```
s:input/legacy.ts:501,508,513 | s:input/playwright.ts:263
s:report/model.ts:371,483,767 | s:run.ts:73
```

| Site | Property | Fix |
| --- | --- | --- |
| legacy.ts:501/508/513 | `line` | conditional spread |
| playwright.ts:263 | `location.file/line/column` | conditional spreads |
| model.ts:371 | `dataUri` (and `text`) | conditional spreads, as model.ts:359 |
| model.ts:483 | `producer` | hoist `productLabel(...)`; the double call defeats narrowing |
| model.ts:767 | `startedAt` | hoist `timestampIso(...)` (double call) |
| run.ts:73 | `provenance` | conditional spread |

No model type needs widening.

### TS2532 (10)

```
s:render/triage.ts:63(x2) | t:ci.test.ts:168 | t:cli-size-warning.test.ts:171
t:compat-sidecar.test.ts:129,131,151,496 | t:e2e/helpers.ts:304
t:render-diagnostics.test.ts:113
```

- `triage.ts:63`: `split(/\r?\n/)[0]` always exists. Hoist
  `const firstLine = reasonMessage.split(/\r?\n/)[0] ?? ''`. Same output.
- Tests (`sizes[0]`, `codespace[1]`, `merged[0]`, `snippets[0]`): local guard
  or `!` where a preceding assertion already proves presence.

### TS6133 (12) / TS4114 (2)

- `baseline-reader.test.ts:160..226` (10x): unused `doc` parameter → `_doc`.
- `stream.ts:18,27`: add `override` to `_transform` and `_flush`. No behaviour.

### Does any fix change public behaviour or report bytes?

No. Consumers of every touched shape use `??`/truthiness, never key presence or
`Object.keys`: `attachment.text ?? ''` (render/attachments.ts:115),
`attachment.dataUri` truthiness (:150/:154/:157), `locationText(error.location)`,
`startedAt` re-spread conditionally at model.ts:914. `JSON.stringify` drops
undefined-valued keys, so HTML and summary bytes are unchanged.

Two non-byte effects to declare: the d.ts widening above, and
`preserve-caught-error` adding `cause` to error objects (§2) — messages and
stderr unchanged.

## 2. Lint inventory

```
npx oxlint -c .oxlintrc.probe.json .        # 565 findings, 104 files
```

Probe: ignore dist/node_modules/playwright-report/test-results/.opencode;
plugins typescript, unicorn, oxc, import, promise, node, vitest; correctness
error, suspicious/perf warn; `vitest/valid-expect` maxArgs 2.
Split: **54 error, 511 warning**.

| Rule | Count | Files | Verdict | Effort |
| --- | --- | --- | --- | --- |
| eslint/no-await-in-loop | 355 | 49 | **disable** | — |
| unicorn/no-array-sort | 69 | 39 | **disable** | — |
| unicorn/consistent-function-scoping | 36 | 25 | **disable** | — |
| eslint/no-shadow | 21 | 12 | fix 19; scoped off in `.cts` (2) | S |
| vitest/require-mock-type-parameters | 21 | 6 | fix | S |
| vitest/no-conditional-expect | 17 | 5 | **disable** | — |
| eslint/preserve-caught-error | 11 | 7 | fix | S |
| oxc/no-map-spread | 8 | 8 | **disable** | — |
| vitest/require-to-throw-message | 8 | 2 | fix | S |
| eslint/no-underscore-dangle | 7 | 4 | keep, `allow` two globals | — |
| promise/no-callback-in-promise | 4 | 2 | scoped off | — |
| vitest/expect-expect | 4 | 4 | keep, `assertFunctionNames` | — |
| eslint/no-extend-native | 2 | 1 | fix with `vi.spyOn` | S |
| unicorn/prefer-set-has | 1 | 1 | **disable** (false positive) | — |
| promise/always-return | 1 | 1 | fix | S |

Curated result: **62 findings (29 error, 33 warning) in 27 files**, all
mechanical. Post-fix the gate is 0.

### no-await-in-loop — 355, disable

src: `input/load.ts`(12), `input/playwright.ts`(8), `compat/options.ts`(2),
`output.ts`(2), `history.ts`, `input/files.ts`, `cli.ts`, `baseline.ts`,
`compat/cucumber-html-reporter.ts`. Rest: e2e (email 54, trends 23, report 17,
size-diagnostics 16, attachments 16, responsive 16, visual-evidence 14,
landmarks 14, locale 14, static 13, baseline 10, print 10, …) and scripts
(`bench-compare` 20, `baseline-bytes` 14).

```ts
for (const file of inputs) {
  const features = await readFeatures(file);   // compat/cucumber-html-reporter.ts:86
```

The loader is deliberately sequential: deterministic order, bounded memory on
large inputs, shared error context. The rule's fix (`Promise.all`) changes
ordering, peak memory and error precedence — product behaviour. E2E loops are
ordered Playwright actions. At 63 % of all findings it would drown the gate.

### no-array-sort — 69, disable

39 files: `render/report.ts`(3), `render/format.ts`(2), `render/trends.ts`(2),
`report/model.ts`, `input/load.ts`, plus tests/scripts.

```ts
merged[0].elements.map((element) => element.id).sort()   // compat-sidecar:129
```

Every sampled site (and every src site) sorts an array it built locally from
`Object.keys`, `.map` or `.filter`; keeping `sort()` is the zero-risk option.
`toSorted()` only adds an allocation per sort; 69 rewrites for zero observable
change. Node 22 supports it — a style choice, not a capability gap.

### consistent-function-scoping — 36, disable

25 files, mostly tests (`model.test.ts` 6, …), plus `render/ansi.ts`'s
`component`/`channel`.

```ts
describe('…', () => { function mixedReport() { … } })
```

Hoisting breaks the colocated-fixture style, risks collisions across 25 files,
and saves nothing: these run once per test.

### no-shadow — 21, fix 19 + scoped off 2

```
src/render/format.ts:56,142,152 | src/render/i18n.ts:93,97 | src/baseline.ts:507
src/input/playwright.ts:1289 | src/compat/cucumber-html-reporter.cts:21,23
test/render-markdown.test.ts:18,19,46,47 | test/render-source-strip.ts:174,198
test/history-window.test.ts:77,441 | test/playwright-source-line.ts:214
test/render-locale.ts:315 | test/legacy.test.ts:412 | test/junit.test.ts:236
```

Rename the inner binding (`count`→`valueCount`, `name`→`stepName`, …); no
external references. Exception: the `.cts` re-declares the public CJS type
names inside `namespace compat` for `export =`; renaming changes the public
type surface.

### require-mock-type-parameters — 21, fix

`pdf.test.ts`(12), `cli-size-warning`(4), `input-resolve-scan`(2),
`cli-baseline`(1), `cli-static`(1), `cli-pdf`(1).

```ts
const page = { route: vi.fn(), pdf: vi.fn() };          // pdf.test.ts:8-11
readFile: vi.fn(actual.readFile),                        // cli-size-warning:31
```

Add `vi.fn<(html: string) => Promise<void>>()` and
`vi.fn<typeof actual.readFile>(actual.readFile)`. Type-only, runtime identical.

### no-conditional-expect — 17, disable

`dom-contract`(10), `size-diagnostics`(3), `model-summary-cross-check`(2),
`baseline-reader`(1), `compat-cjs`(1).

```ts
if (facts.status === undefined) expect(names).not.toContain('data-status');
else expect(encoded).toContainEqual(['data-status', facts.status]);
```

All 17 are paired branches (both sides assert), environment guards
(`if (dist exists)`) or optional-argument helpers (`if (reason)`); nothing is
silently skipped. Rewriting to computed expectations is M effort and the one
place a fix can weaken a test.

### preserve-caught-error — 11, fix

`cli.ts`(5), `input/messages.ts`, `history.ts`, `input/load.ts`,
`input/legacy.ts`, `input/junit.ts`, `pdf.ts`.

Add `{ cause: error }` as `new Error(message, { cause })`; each catch already
binds the error. Message and stderr unchanged; `cause` is added.

### require-to-throw-message — 8, fix

`compat-sidecar:63,188,332,361,457,472`, `i18n.test.ts:215,233`. Add the stable
substring already asserted nearby (e.g. `/must not overwrite an input file/`).
Strengthens, never weakens.

### no-map-spread — 8, disable

`compat/cucumber-html-reporter.ts:110`, `attempt-diagnostics.ts:51`,
`index-run.ts:282`, `summary.ts:276`, `report/model.ts:645`,
`size-diagnostics.spec.ts:32`, `playwright-source-line.test.ts:151`,
`bench-ansi.mjs:179`.

```ts
.map((element) => ({ ...(element as object), retried: 0 }))
```

Alternative is mutation or `Object.assign`; arrays are one-per-element, no
measurable size/time effect, spread is clearest.

### no-underscore-dangle — 7, keep with `allow`

`helpers.ts:468,473,497`, `diagnostics.spec.ts:151,166`,
`parity-metadata.spec.ts:109`, `attachments.spec.ts:63`. `__tolkiraXss` /
`__tolkiraCopied` also appear in fixture payloads (`window.__tolkiraXss=1`), so
renaming the test side alone would make the assertion vacuous. `allow` clears
all 7 (verified).

### Remaining small rules

- `promise/no-callback-in-promise` 4: `stream.ts:34,36` and
  `compat/cucumber-html-reporter.ts:190,192` are the Node callback contract.
  Per-file override.
- `expect-expect` 4: `expectStep`, `expectNoSidecar`, `validatePair`,
  `expectRejectedTarget` — local assertion helpers the rule cannot follow.
  `assertFunctionNames` (exact names, `expectNoSidecar` included) clears all 4
  without touching a test (verified).
- `no-extend-native` 2 (`render-report.test.ts:678,712`): replace the
  `String.prototype.localeCompare` assignment with `vi.spyOn(...)
  .mockImplementation(...)`; same patch, existing restore.
- `prefer-set-has` 1 (`baseline-helpers.ts:266`): `tag` is a **string**;
  `String#includes` is correct. False positive; disable.
- `always-return` 1 (`cli.ts:798`): add `return code;` to the `.then` callback
  (value ignored). Also clears type-aware `no-floating-promises` at that line.

### Output/behaviour neutrality

No lint fix changes report bytes or CLI output: renames, `override`s, `_`
parameters and mock type arguments are compile-time only; `preserve-caught-error`
adds `cause` but keeps `message`; `no-extend-native` applies the same patch via
a spy; `require-to-throw-message` only tightens assertions; `always-return`
returns a value the caller discards. Disables change nothing.

## 3. Proposed `.oxlintrc.json`

Repo root; `oxlint .` picks it up. Verified shape (comments are not valid JSON,
so reasons follow).

```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "ignorePatterns": ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**", ".opencode/**"],
  "plugins": ["typescript", "unicorn", "oxc", "import", "promise", "node", "vitest"],
  "categories": { "correctness": "error", "suspicious": "warn", "perf": "warn" },
  "rules": {
    "vitest/valid-expect": ["error", { "maxArgs": 2 }],
    "vitest/expect-expect": ["error", { "assertFunctionNames": ["expect", "expectStep", "expectRejectedTarget", "expectNoSidecar", "validatePair"] }],
    "eslint/no-await-in-loop": "off",
    "eslint/no-underscore-dangle": ["warn", { "allow": ["__tolkiraXss", "__tolkiraCopied"] }],
    "unicorn/no-array-sort": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/prefer-set-has": "off",
    "oxc/no-map-spread": "off",
    "vitest/no-conditional-expect": "off"
  },
  "overrides": [
    { "files": ["src/stream.ts", "src/compat/cucumber-html-reporter.ts"], "rules": { "promise/no-callback-in-promise": "off" } },
    { "files": ["src/compat/cucumber-html-reporter.cts"], "rules": { "eslint/no-shadow": "off" } }
  ]
}
```

Reasons: (1) sequential I/O is deliberate; (2) in-place sort of local arrays;
(3) colocated test fixtures; (4) false positive on `String#includes`;
(5) cold paths, clearest form; (6) paired branch/environment guards;
(7) Node stream callback contract (2 files); (8) public CJS type names required
by `export =`; (9) four tests assert through helpers; (10) probe globals are
fixture contract names.

Script change in the same change: `"lint": "oxlint --max-warnings=0 ."`.
`overrides.files` resolve relative to the config file; the §5 copy lived outside
the repo, so it used `**/src/...` prefixes.

## 4. `oxlint --type-aware` evaluation

- Flag exists in 1.94.0: `--type-aware` ("rules that require type information")
  and `--type-check` ("includes TypeScript compiler diagnostics").
- Without the companion package it hard-fails, exit 1: `Failed to find
  type-aware linter executable. You may need to add the 'tsrs' or
  'oxlint-tsgolint' package to your project?`
- `oxlint-tsgolint` exists on npm (`7.0.2008`, bin `tsgolint`, per-platform
  optional binaries, "powered by typescript-go"). Installed into `%TEMP%` and
  put on `PATH` (no repo dependency), the same command ran in **1.9 s**:
  565 → **895 findings (330 new)**.
- New: `no-unsafe-type-assertion` 228, `no-unnecessary-type-assertion` 59,
  `require-array-sort-compare` 7, `no-unnecessary-boolean-literal-compare` 7,
  `no-unnecessary-type-conversion` 6, `no-unnecessary-template-expression` 4,
  `no-unsafe-enum-comparison` 3, `no-floating-promises` 3,
  `no-unsafe-enum-assignment` 2, `await-thenable` 2, `unbound-method` 2,
  `no-misused-spread` 2, `restrict-template-expressions` 2,
  `no-unnecessary-type-arguments` 1, `no-base-to-string` 1,
  `consistent-return` 1.
- Value over strict `tsc`: real but small and non-overlapping —
  `no-floating-promises` (`cli.ts:798`, the `promise/always-return` site, plus
  two tests), `await-thenable` (2 tests), `unbound-method` (2 tests, one the
  `localeCompare` reference), `no-misused-spread` (2 PDF class spreads). The
  other 287 are assertion-style rules that flag every fixture `as`; three enum
  findings sit on `@cucumber/messages` types; `consistent-return` and
  `no-base-to-string` look like tsgolint false positives (`fail()` throws,
  `String(value ?? '')`).
- **Recommendation: do not adopt in B-055.** It needs a new dev dependency with
  per-platform binaries on every CI host, adds 330 findings, and the ~7 new
  signals are partly covered by the fixes above. Revisit as an opt-in,
  non-blocking job after B-055 with the two assertion rules off (43 findings
  left). `--type-check` duplicates `npm run typecheck`.

## 5. `--max-warnings=0` proof

On the curated config, with the to-fix error rules temporarily off so only
warnings remain (42 in that copy):

```
npx oxlint -c <curated> .                       # exit 0
npx oxlint -c <curated> --max-warnings=0 .      # exit 1
```

Observed: the plain run prints the same warnings and exits 0; `--max-warnings=0`
exits 1 as soon as any warning exists (`test/junit.test.ts:236 no-shadow`). The
probe config also exits 1 with the flag (it already has 54 errors). Since the
curated set is meant to reach 0, the flag is a tripwire for future warnings, not
a way to pass with debt.

## Hand-off

- Order: six flags + 86 fixes (src first, then test helpers), lint config + 62
  fixes, `--max-warnings=0`, then coverage / Prettier / `passWithNoTests`.
- Highest-leverage test edit: make `compat-sidecar.test.ts`'s `happyFeatures()`
  return one `LegacyFeature` (throw when the fixture is empty) instead of an
  array. Clears 12 TS18048 + 5 TS2345 + 5 TS2379.
- Re-measure both counts in the change; use these commands as the recipe.
