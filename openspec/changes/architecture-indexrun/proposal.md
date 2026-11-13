# Proposal

## Why

`src/report/model.ts` and `src/summary.ts` each scan the same Cucumber
Messages envelopes and build overlapping maps: features, pickles, test cases,
test case starts, latest attempts, results, attachments, suggestions and step
definitions. The two scans drift silently because no test compares their
counts or statuses. This is the `indexRun` candidate in
`docs/architecture/rewrite-list.md`.

No remote tracking issue exists; this change is a coordinator request.

## What Changes

- Add one shared envelope index (`src/report/index-run.ts`, `indexRun`) that
  projects features, pickles, test cases, latest attempts, results,
  attachments, suggestions and step definitions.
- Rewrite `buildReportModel` and `summarizeEnvelopes` to consume the index
  instead of scanning envelopes themselves.
- Keep each consumer's projection policy: model-only outlines, rules,
  environment, provenance and attachment payloads; summary-only sorting,
  display URIs, run-hook overall status and hook-as-step rows.
- Add a cross-check test that builds both projections from the same
  representative fixtures and asserts equal feature/scenario/attachment/
  duration counts and per-scenario status.

Out of scope: rendering, input loaders, summary schema, public API, new
dependencies, release, tagging and archiving.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a pure refactor; `skip_specs: true` is set because no spec-level
behavior changes.

## Impact

- New `src/report/index-run.ts`.
- `src/report/model.ts` and `src/summary.ts` consume the index; their public
  signatures and output stay unchanged.
- New `test/model-summary-cross-check.test.ts`.
- No runtime dependency, render, input or package change.

## Review gate

Implementation is a TDD slice: the cross-check test lands first, then the
refactor keeps it and the existing suites green. The coordinator owns review,
archive and release.
