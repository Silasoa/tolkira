# Proposal

## Why

The quality gate is weaker than it looks: TypeScript strict mode is partial, the
lint config runs only the default correctness category, an empty test glob can
pass, there is no formatter and no coverage floor. A second audit and the
approved B-055 package measured the gap: strict flags expose 88 errors in 22
files, the lint set exposes mechanical findings, and coverage sits at 94.65 /
88.04 / 96.86 / 96.05 percent. On the user's 2026-11-25 decision the target is
the maximal sensible strictness, so the change also adopts the pedantic
category, type-aware rules and the free compiler checks. This closes the gap
now, before the 0.7 parity work adds code on top.

## What Changes

- Enable the strict TypeScript checks: `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`,
  `noUnusedParameters`, `noImplicitReturns`, `noUncheckedSideEffectImports`,
  `noFallthroughCasesInSwitch`, `allowUnreachableCode: false`,
  `allowUnusedLabels: false` and `isolatedModules`.
- Split the typecheck into a server/test project and a browser project with no
  Node types, so the embedded client cannot reach a Node global.
- Replace the default oxlint run with the maximal sensible config: correctness
  as error, suspicious, performance and pedantic as warning, the import,
  promise, node, TypeScript, unicorn and oxc plugins, type-aware rules, and only the
  documented exceptions. Run with `--max-warnings=0`.
- Remove `passWithNoTests`, so an empty or mistyped test glob fails.
- Add a v8 coverage floor on `src/**/*.ts` with the browser entry excluded and
  the measured headroom: 93 statements, 86 branches, 95 functions, 95 lines.
- Add Prettier with one formatting-only commit and a `format:check` gate. The
  formatting commit touches no generated asset, CSS, fixture, golden or report
  byte.
- Keep `npm run check` as the single local and CI gate; the added steps run
  inside it.

Out of scope: ESLint; `noPropertyAccessFromIndexSignature` and
`erasableSyntaxOnly` with the measured reasons in the design. No runtime
dependency, no CLI/API option, no report, summary, attachment or package-entry
change. No version bump, tag or publish.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `test-infrastructure`: the quality gate gains the maximal strict TypeScript
  checks, the browser typecheck project, the maximal zero-warning lint run with
  type-aware rules, the formatting check, the coverage floor and an empty-suite
  failure, without changing the existing hygiene, browser and Windows/release
  gates.

## Impact

Affected: `tsconfig.json`, a new `tsconfig.client.json`, `.oxlintrc.json`,
`.prettierrc.json`, `.prettierignore`, `.gitattributes`, `vitest.config.ts`,
`package.json` scripts and dev dependencies, `ci.yml` (no edit expected: it
already runs `npm run check`), 88 type-error sites in 22 files, the lint sites
across the base, pedantic and type-aware passes, the 156 tracked files measured
as the formatting baseline, and six tracked files renormalized to LF (five
archived OpenSpec files and one ADR). No production behaviour, report byte,
public API or tarball entry point changes; the one emitted declaration diff is
the inferred return type of the internal `renderOptions()` helper, which the
package entry does not export. Dev-only dependencies grow by Prettier, the
Vitest coverage provider and the pinned type-aware lint binary; runtime
dependencies stay unchanged.

Tracking: local backlog B-055. A GitHub issue is opened from this contract
after IR; B-055 remains the local intake record.
