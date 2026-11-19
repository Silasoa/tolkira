# Proposal

## Why

`stripAnsi` runs over every step and hook message in the report model, the JSON
summary and the CI formatters. Commit `81f785a` added a no-escape fast path and
chunked slicing, but the gain was reasoned, not measured. There is no committed
benchmark and no budget, so a future refactor can regress the hot path without
noticing, and the optimisation cannot be kept or removed on evidence.

Issue #17 (B-014) asks for a small benchmark over large step/hook message sets,
a documented budget and a measured decision on the fast path.

## What Changes

- Add `npm run bench:ansi`: a reproducible benchmark over fixed clean and
  escape-laden corpora of large step/hook messages. It exercises the production
  `stripAnsi`, compares it with an otherwise identical scan-only reference and
  a character-append reference, and checks that all three produce the same
  output.
- Enforce a documented 500 ms budget for the production workload. Report the
  fast-path ratio and a `keep`/`review` decision against a 1.5x threshold; the
  ratio is evidence for the keep/remove decision, not a second hard gate.
- Run the benchmark in the Node 22 Linux CI check job next to the stress run.
  `npm run check` stays unchanged.
- Record the method, reference-host numbers, decision and failure policy in the
  contributor and architecture docs.
- Keep `stripAnsi` behaviour and output identical; add only a comment that
  points at the measured evidence. The existing ANSI tests remain the contract.

Out of scope: changing the escape grammar, `renderAnsiLog`, attachment limits,
report HTML/summary/CLI output, a benchmark framework or new dependency, a
hard ratio gate or automatic fast-path removal, and timing the full renderer or
other operating systems.

## Capabilities

### New Capabilities

- `performance`: a reproducible message-text stripping benchmark with a
  documented budget and an evidence-based fast-path decision.

### Modified Capabilities

None.

## Impact

- `scripts/bench-ansi.mjs`, `test/bench-ansi.test.ts`, `package.json`,
  `.github/workflows/ci.yml`, `README.md`, `CONTRIBUTING.md`,
  `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`, `docs/CHANGELOG.md` and a comment
  in `src/text.ts`.
- Dev-only use of `esbuild`; no runtime dependency, public export, report,
  summary or CLI change.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair.
Post-implementation review: SCR, CR, DAR, STR, PCA and SEC. UXR and CMP are not
triggered because no report markup or user-facing report behaviour changes.
Refs #17 and B-014.
