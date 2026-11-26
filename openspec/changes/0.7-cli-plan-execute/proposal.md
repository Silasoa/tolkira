# Proposal

## Why

`src/cli.ts` is a single 993-line module and `runCli` alone is about 598
lines, with 42 `return 2;` sites. It mixes option parsing, usage/exclusivity
checks, path collision checks, logo validation, input resolution, history and
baseline reads, the summary/generate branch, the write order, warnings,
manifest assembly and the stdout policy. Every new CLI flag has to be threaded
through that one function, and the write order and exit-code policy are only
visible by reading nested branches.

`docs/BACKLOG.md` B-057 records the 2026-11-26 user scope decision: the feature
bundle is done, then this CLI plan/execute step, then the report pipeline seam,
with the redesign last; the status vocabulary only if cheap, and the sidecar
reader, input pipeline, filter seam and ICU message parser deferred. The second
architecture pass (`docs/research/architecture-session-2026-11.md`, candidate 3)
adds the output path plan: seven blocks holding eight checks compare output
paths against each other, and two "overwrites an input" implementations exist.

This change is the CLI plan/execute slice of B-057. It is an internal refactor
with **no externally visible change**.

No remote tracking issue is open for this slice; the tracker is the local
backlog row B-057. If an issue is opened for this work, one independent IR
(Issue Review) runs before it is posted.

## What Changes

- Split `src/cli.ts` into one entry plus five internal modules:
  `src/cli/args.ts`, `src/cli/logo.ts`, `src/cli/paths.ts`,
  `src/cli/plan.ts` and `src/cli/execute.ts`.
- `planCli(argv)` becomes the single planning step. It turns argv and the
  process cwd into a validated `CliPlan` (parsed options, output paths, write
  order, expected confirmations, exit-code policy) or a structured usage
  failure. Planning is read-only: no writes, no stdout/stderr, no observable
  process mutation. Path containment and logo validation need filesystem facts, so
  planning performs read-only `stat`, `realpath`, directory-scan and logo
  reads; a mathematically pure function would have to reorder the usage errors.
- `executePlan(plan, io)` becomes the single execution step. It resolves the
  inputs once, reads history and the baseline, calls the summary or generate
  seam, writes in plan order, warns, prints and returns 0 or 1.
- `runCli(argv, io)` stays the CLI entry and keeps its signature and export.
  It only formats plan failures with the unchanged usage text, handles the
  help/version/capabilities actions, and delegates to `executePlan`.
- `docs/ARCHITECTURE.md` gets the `src/cli` module map; `GLOSSARY.md` gets the
  CLI plan/execute vocabulary.
- No new flag, no help/version/capabilities byte change, no changed
  stdout/stderr, no changed write order, no changed exit code, no changed
  atomic writer, no changed write messages and no public API change.

Out of scope: any behaviour, message or byte change; the research's
table-driven `validateOutputPaths` rewrite (this change moves the existing
checks verbatim, it does not redesign them); B-056 performance work; B-065
(output inside a scanned input directory); a `cwd` parameter threaded through
`samePath`/`outputOverwritesInput`; changes to `src/output.ts`; a general
constants module; test-helper consolidation beyond what the seam needs; a
version bump, changelog, tag, stage or publish.

## Capabilities

### New Capabilities

None. The change is an internal refactor and specs are skipped by design
(`skip_specs: true`).

### Modified Capabilities

None. The observable `cli-api` contract is unchanged: the same flags, help
text, messages, files, write order and exit codes. A spec delta would either
restate existing `cli-api` requirements (duplicating the spec without adding a
capability) or describe an internal module layout (not a product capability).
The invariant "no externally visible change" is enforced by the existing CLI
suite plus the targeted plan/execute and equivalence tests named in
`design.md`. This follows the precedent of `2026-11-20-split-report-renderer`,
which also uses `skip_specs: true` for a behaviour-preserving internal split,
keeps its public entry and updates the architecture map. The `cli-api` spec owns
the observable contract; this change preserves it.

## Impact

- `src/cli.ts`: reduced to the usage text, the CLI output port, `runCli` and
  the main-module guard, about 100 lines.
- New: `src/cli/args.ts`, `src/cli/logo.ts`, `src/cli/paths.ts`,
  `src/cli/plan.ts`, `src/cli/execute.ts`.
- New tests: `test/cli-plan.test.ts`, `test/cli-plan-paths.test.ts`,
  `test/cli-execute.test.ts`, `test/cli-equivalence.test.ts`.
- Existing tests do not change their imports: 26 files import `runCli`, namely
  24 test files (20 unit/integration, 4 e2e specs) plus the two shared helpers
  `test/baseline-helpers.ts` and `test/e2e/helpers.ts`.
  `test/render-report.test.ts` bundles `src/cli.ts` with esbuild,
  `test/tooling-config.test.ts` pins it as a knip entry and
  `test/package-manifest.test.ts` pins `dist/cli.js`.
- No new dependency, build-script, package-export or bin change. The esbuild
  entry and shebang stay. The declaration build emits exactly five new internal
  files, `dist/cli/{args,execute,logo,paths,plan}.d.ts`; the tarball gains
  exactly those five entries, and `dist/index.d.ts`, the public entries and the
  runtime bytes stay unchanged.
- This is part of 0.7.0. `package.json` keeps its current version in this
  change; there is no bump, changelog, tag, stage or publish.
- Documented risk: usage-error precedence, path identity semantics and the
  write order are the parts that are hard to keep identical. `design.md` names
  each mitigation and the fallback slice.

## Review gate

PIR and DXR run before implementation. The post-implementation set is SCR, CR,
DAR, STR and SEC (path checks and file writes move modules). PCA is not
triggered: the render/summary hot path is untouched and the CLI change is a
one-time argv pass. Implementation is a TDD pair; the gate is
`npm run hygiene` plus `npm run check`, the CLI/e2e suites and
`npm run package:check`. No release work.
