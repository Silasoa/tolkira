# TDD-Red — stripAnsi benchmark

Status: RED confirmed on 2026-11-19 for issue #17 / B-014. This handoff adds
only the failing black-box test and this record. No `scripts/`, `src/`,
`package.json`, CI or docs change is part of it. This worker did not commit.

## Command and result

```text
npx vitest run test/bench-ansi.test.ts

Test Files  1 failed (1)
Tests       9 failed (9)
Duration    504ms
Exit code   1
```

All nine failures are the missing benchmark command:

- `package.json` has no `scripts["bench:ansi"]` (`undefined`).
- Every spawned run exits 1 with Node's
  `Cannot find module '.../scripts/bench-ansi.mjs'` (`MODULE_NOT_FOUND`).
  The helper's message surfaces the script path and Node's stderr.
- `--quick --budget-ms 0` exits 1 for the same missing module; the budget
  assertion fails because stderr never mentions the budget.
- The unknown-argument run exits 1 instead of 2 because Node fails before the
  script can parse arguments.

This is not an unrelated import or type error:

- `npx tsc --noEmit` exits 0 with no output, so the new test typechecks.
- `npx oxlint test/bench-ansi.test.ts` exits 0 with no findings.
- `npx vitest run test/ansi.test.ts test/ansi-stripping.test.ts` is green
  (24/24). Existing ANSI tests were not edited or weakened.

Environment note: the worktree had no `node_modules`; `npm ci` was run to get
Vitest. That changes no tracked file. Local Node is v26.13.1 / Windows; the
full wall-clock benchmark still belongs to the Node 22 Linux CI job.

## Files added

- `test/bench-ansi.test.ts`
- `openspec/changes/benchmark-strip-ansi/tdd-red.md`

Nothing else was touched. `package.json`, `scripts/`, `src/`, `.github/` and
the docs are unchanged.

## Red tests and reasons

### `bench:ansi command` — 1 failure

- `exposes a bench:ansi npm script that runs scripts/bench-ansi.mjs` —
  `scripts["bench:ansi"]` is `undefined`; expected a string containing
  `scripts/bench-ansi.mjs`.

### `bench-ansi quick mode` — 8 failures

All spawn
`spawnSync(process.execPath, [scripts/bench-ansi.mjs, ...args], { encoding: 'utf8', timeout: 30_000 })`
with `cwd` set to the repository root resolved from `import.meta.url`.

- `exits 0 and prints one stripAnsi benchmark document` — exits 1,
  `Cannot find module`. Asserts `benchmark: "stripAnsi"`, `mode: "quick"`,
  integer `iterations > 0`, integer `warmup >= 0`, `budgetMs: 500`,
  `ratioFloor: 1.5`, and that stdout parses as exactly one JSON object.
- `reports both corpora with message counts, bytes, timing and throughput` —
  exits 1. Asserts two corpora named `clean` and `escaped` (order not fixed),
  positive integer `messages` and `bytes`, and positive numeric `medianMs`,
  `mibPerSecond`, `scanOnlyMs`, `charAppendMs` per corpus, plus
  `outputIdentical: true`.
- `reports the production median and both reference ratios` — exits 1.
  Asserts positive, finite `productionMedianMs`, `fastPathRatio` and
  `slicingRatio`.
- `reports a decision consistent with the printed ratio and floor` — exits 1.
  Asserts
  `decision === (fastPathRatio >= ratioFloor ? "keep" : "review")`, so either
  measured branch is accepted and only an inconsistent document fails.
- `reports the same corpus message counts and bytes on two quick runs` —
  exits 1. Two independent `--quick` runs must report identical
  `name`/`messages`/`bytes` tuples, sorted by name. No timing value is
  compared.
- `exits 1 and names the budget and measured time when the budget is exceeded`
  — exits 1, but for `MODULE_NOT_FOUND`, so stderr has no `budget` text.
  Required: exit 1, stderr matches `/budget/i` and contains a digit.
- `exits 0 and reports review when the ratio is below the printed floor` —
  exits 1. With `--quick --ratio-floor 1000` the command must exit 0, echo
  `ratioFloor: 1000`, keep the decision consistent with the printed values,
  and report `decision: "review"`.
- `exits 2 and prints usage for an unknown argument` — exits 1 instead of 2.
  With `--quick --unknown-option` it must exit 2 and print `usage`
  (case-insensitive) on stdout or stderr.

Each `it` passes an explicit `30_000` ms Vitest timeout. The spawn also has a
`30_000` ms timeout, and a timeout is surfaced as a clear error. No test
asserts a hard wall-clock value; only exit codes, structure, budget flags and
reproducible corpus sizes.

## Contract details the implementer must not miss

1. **npm script**
   - `scripts["bench:ansi"]` must be a string containing
     `scripts/bench-ansi.mjs` (the `node ` prefix is not asserted).
2. **Stdout shape**
   - The whole trimmed stdout must parse as one JSON object. Extra lines
     before or after the document fail the test; pretty-printing and a
     trailing newline are fine.
   - Field names are exact:
     `benchmark`, `mode`, `iterations`, `warmup`, `budgetMs`, `ratioFloor`,
     `corpora`, `productionMedianMs`, `fastPathRatio`, `decision`,
     `slicingRatio`, `outputIdentical`.
   - Each corpus entry has exact field names `name`, `messages`, `bytes`,
     `medianMs`, `mibPerSecond`, `scanOnlyMs`, `charAppendMs`.
   - Quick-mode defaults are `budgetMs: 500` and `ratioFloor: 1.5`. The
     `--budget-ms` and `--ratio-floor` overrides are echoed as numbers.
3. **Corpora**
   - Exactly two entries named `clean` and `escaped`. Order is not asserted.
   - Quick-mode sizes are not pinned. They must be positive and identical
     across runs. Do not derive any printed size from timing or randomness.
4. **Decision**
   - `decision` is exactly `keep` when `fastPathRatio >= ratioFloor`, else
     `review`. A `review` result still exits 0.
5. **Exit codes and streams**
   - 0 for a completed measurement, including `review`.
   - 1 for an exceeded budget; stderr must contain `budget` (case-insensitive)
     and a number (the measured time). The test does not pin the unit or
     wording beyond that.
   - 2 for an unknown argument; stdout or stderr must contain `usage`
     (case-insensitive).
   - `--budget-ms 0` must be accepted as a value and fail the budget, not the
     argument parser.

## Deliberate gaps

- No per-corpus ratio field is asserted; the design does not fix per-corpus
  ratio names. Only the top-level `fastPathRatio` and `slicingRatio` are
  contractual here.
- Quick-mode iteration count is not pinned beyond a positive integer; the
  design allows fewer than the full nine measured iterations.
- The full corpus (2,000 messages per corpus, nine passes, 500 ms budget) is
  not asserted in this unit test. It stays with the Node 22 Linux CI step.
- No test asserts stderr is silent on success, no specific `message` wording
  beyond the budget/usage matches, and no JSON indentation style.
- The test does not import `src/text.ts`; the reference implementations and
  `outputIdentical: true` remain the script's internal drift guard.
