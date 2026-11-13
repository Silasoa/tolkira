# Design

## Context

See `proposal.md`. `buildReportModel` and `summarizeEnvelopes` receive the same
`Envelope[]` (Messages normalised from every input format) and currently build
parallel indexes with slightly different policies. The summary sanitises its
input; the model does not. Both select the latest started attempt per pickle
with the same attempt/timestamp ordering.

## Goals / Non-Goals

**Goals:**

- One indexed pass over envelopes for the shared facts.
- Identical public output from both consumers.
- A cross-check test that makes silent drift visible.

**Non-Goals:**

- A new summary schema or report-model field.
- Moving render, input or attachment-payload logic.
- Merging the two projections into one type.

## Decisions

### `indexRun(envelopes)` is a fact index, not a projection

`src/report/index-run.ts` exports `indexRun(envelopes: Envelope[]): RunIndex`.
It owns only data that both consumers currently rebuild:

- unique feature documents in first-appearance order, first feature per
  `uri || name`, last feature per URI, last feature per AST scenario id;
- AST scenario tree with its rule, outline examples rows and step nodes;
- pickles, test cases by id and by pickle, latest started attempt per pickle;
- test-step results and attachment envelopes grouped by owner;
- hooks and test-run hook starts/finishes;
- suggestion snippets and step definitions (raw pattern, URI and line).

It deliberately keeps both attachment groupings: the model excludes attachments
tagged with a run-hook start before grouping by test case start, while the
summary groups every attachment with a test case start id. The index also keeps
the full attachment list in input order for the summary's raw byte accounting.

It stores raw `Rule` nodes and raw definition locations. `model.ts` keeps rule
metadata formatting and the model's raw definition source string; `summary.ts`
keeps `displayUri` for definition sources. That avoids importing view types
into the index and preserves each consumer's existing output.

### Latest attempt

Both implementations already agree: choose the highest `attempt`, then the
latest timestamp, keeping the first candidate on a tie. The index computes it
once per pickle. Never-started pickles stay absent.

### Consumer policies stay local

`model.ts` keeps feature rows and ordering, provenance, environment, outlines,
rule metadata, attachment payload mapping and counting. `summary.ts` keeps
sorting, display URIs, overall status, hook-as-step rows and raw byte counting.
This keeps the refactor behavior-preserving and the index small. The model's
run-metadata pass (source, environment, start/finish timestamps) stays in
`model.ts` because no other consumer reads it.

### Cross-check test

`test/model-summary-cross-check.test.ts` feeds representative Messages, legacy
JSON and JUnit fixtures through both functions and asserts:

- equal feature, scenario, attachment and duration totals;
- equal per-scenario name, displayed URI, status, executed flag, attempt,
  duration, tags and step/hook status sequences;
- the summary overall status agrees with the model's executed worst status
  (run hooks may only worsen it).

## Risks

- The two consumers resolve a feature differently when duplicate Gherkin
  documents or malformed duplicate ids appear. The index keeps both feature
  lookup maps so the existing behavior survives; the cross-check covers valid
  representative input, not corrupt duplicates.
- A refactor can silently drop an omitted-field guard. The existing model and
  summary suites plus the cross-check are the guard; no guard is removed.

## ADRs

No ADR is needed: internal module seam, no public contract or dependency
change.
