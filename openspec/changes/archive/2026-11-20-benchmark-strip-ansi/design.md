# Design

## Context

`stripAnsi` in `src/text.ts` is shared by the report model, the JSON summary,
the CI formatters and the Playwright adapter. It has two paths: an
`ANSI_CONTROLS` probe that returns plain text unchanged, and a scan with
chunked slicing for text that contains escapes or terminal controls. Both were
added for security hardening in `81f785a`; the speed gain was argued, not
measured. Issue #17 (B-014) closes that gap.

Data flow around the measured unit:

```
input files → Messages → stripAnsi (model/summary/CI) → HTML / JSON / CI text
```

The benchmark isolates the second step. It does not include parsing or
rendering, so a change in this benchmark is attributable to `stripAnsi` alone.
The tool stays a dev script in the single package (ADR 0002); the report is
still server-rendered (ADR 0005), so message sanitisation remains on the
request-free render path. This is a micro-benchmark, not an end-to-end report
performance claim; the stress script keeps that separate baseline.

## Benchmark shape

`scripts/bench-ansi.mjs` is a plain Node ESM script, run by
`npm run bench:ansi`.

- **Production code, not a copy.** The script bundles `src/text.ts` with the
  existing `esbuild` dev dependency and imports the result from a base64
  `data:` URL. The build contract is fixed: `bundle: true`, `write: false`,
  `format: 'esm'`, `platform: 'node'`, `target: 'node22'`, `sourcemap: false`,
  `logLevel: 'silent'`, entry via
  `fileURLToPath(new URL('../src/text.ts', import.meta.url))`. It therefore
  calls the shipped `stripAnsi`, `scanEscape` and `isEscapeIntroducer`. The
  scanner is shared; the reference wrappers copy the production loop and the
  control predicate, so output equivalence is the drift guard, not the import.
- **Fixed corpora.** The script builds 2,000 clean messages and 2,000
  escape-laden messages, each about 2 KiB, from index-based templates. No
  fixtures, input files, network or random seeds are involved. The clean corpus
  holds visible text, newlines and tabs. The escaped corpus covers 7-bit SGR,
  OSC-8, OSC-52, DCS/APC, 8-bit C1 CSI and OSC, two-byte designators and
  standalone controls, wrapped around the same visible text. CR is deliberately
  excluded (see the known divergence below).
- **References.** `stripAnsiScanOnly` repeats the production loop without the
  early return and uses the production `scanEscape` / `isEscapeIntroducer`.
  `stripAnsiCharAppend` repeats the scan but appends visible characters one by
  one instead of slicing chunks. `isControl` is not exported, so the references
  copy its three-line predicate; the module surface stays unchanged.
- **Measurement.** Two warm-up passes per function and corpus, then 9 measured
  iterations. Each result is the median wall-clock time for one pass over the
  corpus; throughput is UTF-8 bytes divided by the median. `performance.now()`
  is the clock. The budget is the median of 9 combined passes, each pass
  stripping the clean corpus and then the escaped corpus once. The median
  rejects a single GC or scheduler spike.
- **Output.** One JSON document on stdout: corpora (name, message count, UTF-8
  bytes, production median ms and MiB/s, scan-only median, char-append median),
  the production combined median, the fast-path ratio, the slicing ratio, the
  budget, the floor and the decision. No timestamp, path or host name is
  printed, so a CI log remains comparable.
- **Exit codes.** 0 for a completed measurement (including a `review`
  decision), 1 for a budget failure, an output mismatch, or a full-mode
  coherence-guard failure, 2 for usage errors.
  `--quick` uses a small corpus, `--budget-ms <n>` overrides the budget and
  `--ratio-floor <n>` overrides the decision threshold for tests.

## Budget and decision

- **Production budget: 500 ms** for the median of nine combined passes. The
  coherent full run measured a 27.709 ms combined median, roughly 18x headroom
  (500 / 27.709, rounded down). The budget is deliberately generous because it
  also runs on shared CI hosts; it catches regressions above roughly 18x on the
  reference host; a 10x regression would still pass. It is a regression ceiling,
  not a report-generation SLA.
- **Fast-path threshold: 1.5x.** The benchmark reports `keep` when the
  clean-corpus ratio is at least 1.5 and `review` below. The threshold is a
  one-time evidence rule, not a hard gate: a `review` result exits 0 and goes to
  PCA/CR as evidence. Removing the fast path is a separate change because it
  also removes the comparison and updates this contract; that is what avoids a
  permanent red benchmark after a removal.
- **Slicing evidence: no hard floor.** The character-append comparison is
  reported as evidence for the chunked-slicing choice. `slicingRatio` is the
  character-append median divided by the production median, so higher means
  production is faster. The reference builds a cons/rope string and the timed
  loop only reads `.length`, so it can defer flattening and is optimistic in
  char-append's favour; the ratio is rough evidence, not a gate. The full runs
  measured 0.65-1.21x (one noisier run 3.47x), so it did not show a reliable win
  there; a future change can revisit it without a second threshold that adds
  noise to CI.

## Measurement

Throwaway probe on 2026-11-19, Node 26.13.1, Windows; not committed and not
part of the change. Ratio is scan-only or char-append divided by production, so
higher is better:

| Corpus | Messages | Size | Production | Reference | Ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| clean | 2,000 | 3.94 MiB | 2.91 ms | 22.51 ms scan-only | 7.75x |
| escaped | 2,000 | 4.07 MiB | 26.66 ms | 41.84 ms char-append | 1.57x |

Final committed benchmark, same 2026-11-19 reference host (Windows, Node
26.13.1), after the measurement-order fix. Each value is the median of nine
measured passes after two warm-up passes. The recorded coherent run:

| Corpus | Messages | Size | Production | Reference | Ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| clean | 2,000 | 3.91 MiB | 3.201 ms | 30.701 ms scan-only | 9.59x |
| escaped | 2,000 | 4.03 MiB | 22.306 ms | 23.973 ms char-append | 1.07x |

Measurement order is clean production -> clean scan-only -> escaped production
-> combined production -> escaped scan-only -> clean char-append -> escaped
char-append; all production passes run first because the char-append references
build large strings that can trigger GC and distort a later production median.

The combined production median was 27.709 ms against a 25.507 ms clean plus
escaped sum. The per-corpus passes are measured separately and the combined
pass runs after them, so a small difference is expected; the observed combined
median is at least the largest component corpus; the guard tolerates measurement
noise down to 0.75x the largest component. Across the full runs on this host,
including phases under heavy local load, the combined median ranged 23.4-78.9 ms
and the clean ratio 6.3-9.6x (one noisier run 4.2x). The coherent run and the
earlier reference-host runs sit in the roughly 7-10x band, so the fast path
stays. The slicing ratio ranged 0.65-1.21x (one noisier run 3.47x) and did not
show a reliable win on this host; it is evidence only, has no floor and does not
affect the decision. Every run reported **keep** with `outputIdentical: true`
and stayed below the 500 ms budget. Full mode also guards coherence: it fails
when the combined median that would be printed is below 0.75x the largest
corpus median, using the same rounded values as the JSON. Quick mode skips the
guard because its corpus is too small for a stable component comparison.

## CI and gate

- Add `npm run bench:ansi` to the Node 22 Linux `check` job, directly after
  `npm run stress -- 1000`, guarded by `if: matrix.node == 22`. It is a
  blocking step for the budget and output checks; there is no
  `continue-on-error`.
- `npm run check` stays unchanged and keeps typecheck, lint, unit tests and
  build as its contract. The quick benchmark test in `npm test` covers the
  command shape on Node 22, 24 and 26 and on Windows/macOS dev machines. The
  full wall-clock budget runs once on Linux to keep the timing signal stable.
- `docs/ARCHITECTURE.md` gets the method, budget, reference host and numbers,
  and the failure policy in the existing Performance section. `README.md` lists
  it after the stress run; `CONTRIBUTING.md` lists it in Local checks.
- The local gate lists in `AGENTS.md`, `docs/agents/review.md` and
  `GLOSSARY.md` stay unchanged because `npm run check` is unchanged; the
  benchmark is an extra blocking step in the Node 22 CI check job. The
  full-mode coherence guard is exercised by the Node 22 Linux full run, not the
  quick unit suite; quick mode deliberately skips it.

## Failure policy

When the budget fails, investigate the regression; do not raise the budget or
threshold silently. A budget change needs a reason and a recorded measurement.
When the fast-path decision is `review`, keep the fast path for now, record the
numbers, and open a separate change that removes it and the comparison. A
`review` result never reds CI. If the full-mode coherence guard exits 1, re-run
once; if it persists, investigate the measurement order or host load before
publishing any number.

## Alternatives considered

- **`vitest bench`.** Reports throughput but has no budget or decision
  assertion and needs a second test configuration. The black-box script keeps
  one command and one exit code.
- **Benchmark through the public API or CLI.** Parsing and rendering dominate
  the time and hide the measured unit.
- **A copied JavaScript `stripAnsi` in the script.** Cheap to write, but it
  measures the copy, not production code.
- **A timing assertion in the normal unit suite.** Cross-OS timing noise and a
  slower gate for a 30 ms operation; the quick command test is enough there.
- **A hard 1.5x gate.** It becomes self-contradictory once the fast path is
  removed; the report-only `keep`/`review` decision avoids that loop.
- **A third-party benchmark dependency.** Not justified for one corpus loop;
  `performance.now()` and a median are enough.

## Risks

- **Timing noise.** The 18x budget headroom of the coherent run, warm-up and
  median make the test robust; the full run is Linux-only and the quick test
  never asserts a hard wall clock.
- **Data-URL import.** The script depends on esbuild emitting a self-contained
  ESM bundle. The contract above pins it; `src/text.ts` has no external
  imports, and a failure is loud at startup. This is dev-only and does not
  touch package output.
- **Corpus realism.** Synthetic 2 KiB messages favour the fast path more than a
  short failure stack does. They are a regression guard, not a claim about
  every real report; the existing fixtures still cover real inputs.
- **Reference drift.** The references copy the loop and control predicate and
  are compared against production output on every corpus message, so a scanner
  change cannot silently make the baseline measure something else.
- **The budget can hide a 10x regression on the reference host.** 500 ms is a
  ceiling, not a target; the printed medians and ratios are the review
  evidence.
- **CR-only text is a known pre-existing fast-path divergence.** The probe
  regex excludes CR while the scan strips it, so a CR-only message is returned
  unchanged and a message with CR plus another control loses CR. The benchmark
  excludes CR to keep this change behaviour-neutral. Recorded as B-018 with a
  trigger; it is not part of #17.

## Deferred findings

Recorded in `docs/BACKLOG.md` under "ANSI benchmark follow-ups"; not part of
this change:

- **Caching the quick document across tests.** The quick suite runs in about
  3 s; caching would restructure the tests for little gain.
- **A full-mode structural unit test.** The Node 22 Linux CI step runs the full
  mode; a second spawn would only repeat it.
- **The coherence guard's failure path is untested by the quick unit suite.**
  The guard check is exercised only by the full run; its failure branch is not
  asserted anywhere. Trigger: the guard fires in CI or the benchmark changes.
- **A fault-injected output-equivalence path.** Production and the references
  share the scanner, so injection tests the harness, not the parser.
- **Host metadata and Linux calibration.** The JSON stays host-neutral so CI
  logs remain comparable; the fixed Linux CI run is the stable signal.
- **A `review` job-summary line.** A `review` decision exits 0 by design; a
  summary line would split the failure policy between CI and the script.

## Security

SEC reviews the change because `stripAnsi` is a sanitisation boundary. The
benchmark adds no parser, network access, input-file read or shell execution;
it reads only repository source through esbuild, generates fixed strings and
imports the bundle in-process. The production escape grammar, control handling
and output are unchanged, and the existing hostile-input tests stay the
contract. No new dependency is added.
