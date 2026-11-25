# Proposal

## Why

The quality gate is weaker than it looks: TypeScript strict mode is partial, the
lint config runs only the default correctness category, an empty test glob can
pass, there is no formatter and no coverage floor. A second audit and the
approved B-055 package measured the gap: six strict flags expose 86 errors in
21 files, a curated lint set exposes 62 mechanical findings, and coverage sits
at 94.65 / 88.04 / 96.86 / 96.05 percent. This change closes the gap now,
before the 0.7 parity work adds code on top.

## What Changes

- Enable six strict TypeScript flags: `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`,
  `noUnusedParameters`, `noImplicitReturns`.
- Split the typecheck into a server/test project and a browser project with no
  Node types, so the embedded client cannot reach a Node global.
- Replace the default oxlint run with a curated config: correctness as error,
  suspicious and performance as warning, the import, promise, node and vitest
  plugins, and the documented rule exceptions. Run with `--max-warnings=0`.
- Remove `passWithNoTests`, so an empty or mistyped test glob fails.
- Add a v8 coverage floor on `src/**/*.ts` with the browser entry excluded and
  the measured headroom: 93 statements, 86 branches, 95 functions, 95 lines.
- Add Prettier with one formatting-only commit and a `format:check` gate. The
  formatting commit touches no generated asset, CSS, fixture, golden or report
  byte.
- Keep `npm run check` as the single local and CI gate; the added steps run
  inside it.

Out of scope: `oxlint --type-aware` is evaluated and not adopted in this change
(330 extra findings, 287 on type assertions in fixtures, and a new
platform-binary dependency); ESLint is not introduced. No runtime dependency,
no CLI/API option, no report, summary, attachment or package-entry change. No
version bump, tag or publish.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `test-infrastructure`: the quality gate gains the strict TypeScript flags,
  the browser typecheck project, the curated zero-warning lint run, the
  formatting check, the coverage floor and an empty-suite failure, without
  changing the existing hygiene, browser and Windows/release gates.

## Impact

Affected: `tsconfig.json`, a new `tsconfig.client.json`, `.oxlintrc.json`,
`.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `package.json`
scripts and dev dependencies, `ci.yml` (no edit expected: it already runs
`npm run check`), 86 type-error sites in 21 files, 62 lint sites in 27 files and
156 formatted tracked files. No production behaviour, report byte, public API
or tarball entry point changes. Dev-only dependencies grow by Prettier and the
Vitest coverage provider; runtime dependencies stay unchanged.

Tracking: local backlog B-055. No remote issue exists; the approved backlog
entry is the tracking record.
