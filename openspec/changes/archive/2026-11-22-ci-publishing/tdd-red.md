# TDD-Red — ci-publishing

Status: RED confirmed on 2026-11-22. No `src/`, docs, config, fixture or existing
test was changed. This worker did not commit.

## Added

- `test/ci.test.ts`: 14 Azure formatter tests in a new `Azure DevOps
  annotations` block, using the existing `makeSummary`/`scenario`/`step`
  helpers.
- `test/cli-ci.test.ts`: 5 `CLI --ci azure` tests, using the existing
  `cli`/`tempDir`/`missing` helpers.
- `openspec/changes/ci-publishing/tdd-red.md`

The initial Red lived in a separate `test/ci-publishing.test.ts`; the tests
were moved into the two existing files above and the separate file was deleted.

## Command and result

Initial Red run, before the move, on the then-separate file:

```text
npx vitest run test/ci-publishing.test.ts
Test Files  1 failed (1)
Tests       17 failed | 4 passed (21)
```

After the move the same 21 tests run with:

```text
npx vitest run test/ci.test.ts test/cli-ci.test.ts
```

`npx tsc --noEmit` reports exactly one error in `test/ci.test.ts`:
`Argument of type '"azure"' is not assignable to parameter of type
'CiFormat'.`

## Why this is the correct Red

- `formatCiOutput(summary, 'azure')` falls through to Markdown, so all 14
  formatter expectations fail on `## Tolkira report` instead of `##vso[...]`
  or `##[section]Tolkira:`.
- `--ci azure` exits 2 (`Invalid --ci "azure"`); `--ci azure --ci-out` never
  reaches the azure stdout rejection; `--json --ci azure` has no `drop`
  remediation; `--ci yaml`/`Azure` and `--help` omit `azure`.
- The type error is the missing `CiFormat` member, fixed by task 3.1.

## Green guards

- GitHub/Markdown dispatcher output equals the direct formatters.
- CLI GitHub/Markdown runs still exit 0.
- No `##vso[task.complete` or `sourcepath`; a failed run with a scenario
  error adds no second run error. These pass today because Markdown lacks the
  strings; they guard the implementation.

## Contract details pinned

- Error: `##vso[task.logissue type=error]<identity> — <message>` (literal em
  dash, per design line 10); warning: `<identity> was <status>`.
- Final: `##[section]Tolkira: <total> scenarios: <buckets>; <N> unexecuted`;
  all-unexecuted uses `0 executed scenarios`; failed adds `; run failed`.
- 50/20 caps, one aggregated omitted warning, 4000-code-point truncation of the
  raw message before escaping, `%AZP25`/`%5D`/`%0D`/`%0A`, percent escaped first;
  the tool-generated `[truncated]` marker is appended after escaping and stays
  literal.
- `--json --ci azure` may name `--ci markdown ... --ci-out` but must not say
  `add --ci-out`.
