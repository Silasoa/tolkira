# Spec Delta

## ADDED Requirements

### Requirement: Benchmark ANSI stripping over message sets

Tolkira SHALL provide a reproducible benchmark for `stripAnsi` over large step
and hook message sets. The benchmark SHALL use deterministic, in-memory corpora,
SHALL exercise the production implementation and SHALL report per-corpus
measurements and the fast-path comparison.

#### Scenario: Fixed corpora

- **WHEN** `npm run bench:ansi` runs
- **THEN** it generates a clean corpus and an escape-laden corpus from fixed
  parameters, without fixtures, network access or random seeds
- **AND** every message is stripped with the production `stripAnsi`
- **AND** it reports message count, UTF-8 size, median time and throughput for
  each corpus

#### Scenario: Fast-path comparison

- **WHEN** the benchmark compares the production implementation with an
  otherwise identical scan-only reference on the clean corpus
- **THEN** both produce identical output
- **AND** it reports the fast-path ratio (scan-only median divided by production
  median, higher is better)
- **AND** it reports `keep` when the ratio is at least 1.5 and `review` below
- **AND** a `review` decision does not fail the benchmark by itself

#### Scenario: Chunked-slicing evidence

- **WHEN** the benchmark compares the production implementation with a
  character-append reference on the escape-laden corpus
- **THEN** both produce identical output
- **AND** it reports the chunked-slicing ratio as evidence

### Requirement: Enforce an ANSI stripping budget

The benchmark SHALL enforce a documented wall-clock budget for the fixed
production workload and SHALL fail with a clear message when the budget is
exceeded.

#### Scenario: Budget met

- **WHEN** `npm run bench:ansi` runs with the full corpus
- **THEN** the median of nine measured passes, each pass stripping both corpora
  once, completes within 500 ms
- **AND** the full-mode coherence guard passes
- **AND** the command exits 0 and prints the measurement document

#### Scenario: Budget exceeded

- **WHEN** the measured production median exceeds the documented budget
- **THEN** the benchmark exits non-zero and names the budget and the measured
  time
- **AND** it does not change the report HTML, JSON summary, CI text, CLI or the
  `npm run check` command

#### Scenario: Incoherent full-mode measurement

- **WHEN** the full-mode combined production median is below 0.75x the largest
  corpus median
- **THEN** the benchmark exits non-zero and names the combined median and the
  largest corpus median
- **AND** quick mode skips the check because its corpus is too small for a
  stable component comparison

#### Scenario: CI gate

- **WHEN** the Node 22 Linux check job runs
- **THEN** it runs the benchmark after the stress run
- **AND** a budget failure fails that job

### Requirement: Keep message stripping behavior unchanged

The benchmark change SHALL NOT alter `stripAnsi` output, the report HTML, the
JSON summary, the CI text or the CLI.

#### Scenario: Output equivalence

- **WHEN** the production fast path and the scan-only reference strip the clean
  and escape-laden corpora
- **THEN** their outputs are identical

#### Scenario: Existing contract

- **WHEN** the change is complete
- **THEN** the existing ANSI escape-family, control and fast-path tests stay
  green
- **AND** `npm run check` and `npm run test:e2e` stay green
