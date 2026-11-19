# TDD-Red — CI annotations

Status: RED confirmed on 2026-11-18. No `src/` or production change is part of
this handoff. This worker did not commit.

## Command and result

```text
npx vitest run test/ci.test.ts test/cli-ci.test.ts test/cli.test.ts
Test Files  2 failed | 1 passed (3)
Tests       12 failed | 14 passed (26)
```

- `test/ci.test.ts`: 0 tests, suite fails to load with
  `Cannot find module '../src/ci.js'`. That is the expected Red: the formatter
  module does not exist yet.
- `test/cli-ci.test.ts`: 12 tests, all 12 fail on missing `--ci`/`--ci-out`
  options and flow.
- `test/cli.test.ts`: 14 tests, all green. Existing behavior is not weakened.

`npx tsc --noEmit` reports exactly one error:
`test/ci.test.ts(14,8): error TS2307: Cannot find module '../src/ci.js'`.
There is no other type error in the new tests.

## Files added

- `test/ci.test.ts`
- `test/cli-ci.test.ts`
- `openspec/changes/add-ci-annotations/tdd-red.md`

No fixture file was added. Formatter tests reuse
`messages/all-statuses.ndjson`, `messages/empty.ndjson`,
`messages/empty-none.ndjson`, `messages/empty-all-unexecuted.ndjson` and
`legacy/failed.json`. Caps, truncation, injection and hostile Markdown text
use in-memory `ReportSummary` objects, because the existing `ci-full`,
`ci-mixed`, `ci-partial`, `ci-unsafe`, `ci-ssh` and `ci-url-only` fixtures are
CI-metadata fixtures whose scenario names are not hostile. They stay untouched.

## Red tests and reasons

### `test/ci.test.ts` — suite does not load

The file imports the future `src/ci.ts`:

- `formatGitHubAnnotations(summary, options?)`
- `formatMarkdownSummary(summary, options?)`
- `formatCiOutput(summary, format, options?)` with `title` in options.

Every test in the file is the implementation contract:

**GitHub**

- `annotates a failed scenario with its identity and first failure message`
  — first non-passed step message wins, earlier passed-step messages are
  ignored, no `file=` property, final count notice present.
- `covers errors, notices and unexecuted scenarios in separate buckets`
  — failed/undefined/ambiguous are `::error`, skipped/pending/unknown are
  `::notice`, unexecuted never gets an individual annotation, and the final
  notice lists every non-zero bucket plus the unexecuted count.
- `escapes properties and messages with their own rules` — exact title and
  message escaping for `%`, CR, LF, `:` and `,`.
- `keeps workflow-command injection inside the original annotation` — a name
  or message containing `\n::error title=x::` stays in one line and one
  annotation.
- `distinguishes an empty run from an all-unexecuted run` — empty is exactly
  `::notice title=Tolkira::No scenarios`; all-unexecuted reports
  `0 scenarios` plus `1 unexecuted` and never “No scenarios”.
- `caps error annotations at 50 and states the remainder` — 50 errors, first
  50 in summary order, `::notice title=Tolkira::5 more annotations omitted`,
  final count keeps `55 failed`, repeated calls are byte-identical.
- `caps notice annotations at 20 and states the remainder` — same rule for
  skipped notices.
- `truncates raw failure text before escaping` — 4,001 raw characters become
  4,000 raw characters plus `[truncated]`, then escaping runs. The `%` tail
  proves the order.
- `dispatches both formats and forwards options` — `formatCiOutput` matches
  the direct formatter and forwards `title`.

**Markdown**

- `reports complete counts and the failed scenarios` — heading, counts table
  with every status and unexecuted, steps failed/skipped, duration,
  attachments total/bytes, and the real failure message.
- `uses --title as the heading`.
- `states an empty run with zero counts`.
- `keeps an all-unexecuted run distinct from an empty run`.
- `renders names, URIs and messages as inert code` — hostile
  `<script>`, link, image and backtick text stays verbatim inside code spans
  or fenced blocks. After stripping code, no `<script`, `](` or `![` remains;
  a message containing three backticks forces a fence of at least four.
- `caps the failed list at 50 while keeping the count complete` — first 50
  names, count still 55, omitted count stated, deterministic.
- `truncates the raw failure message at 500 characters` — first 500 raw
  characters stay, text beyond is absent, truncation stated.
- `caps the skipped names at 20 while keeping the count` — first 20 names,
  count still 25, omitted count stated.

### `test/cli-ci.test.ts` — 12 failures

All fail because `--ci` is currently an unknown option:

1. `emits GitHub annotations on stdout without writing HTML` — code 2, expected
   0.
2. `writes Markdown to stdout without --out` — code 2, expected 0.
3. `writes Markdown to --ci-out and creates missing directories` — code 2.
4. `writes HTML and stdout Markdown without a human confirmation` — code 2.
5. `rejects GitHub annotations bound to --ci-out before writing anything` —
   code 2, but stderr is the unknown-option error and never names
   `--ci-out`.
6. `rejects empty, unknown and case-mismatched --ci values` — code 2, but the
   error never names the allowed values.
7. `rejects --ci-out without --ci and an empty --ci-out path` — unknown option,
   no “requires” diagnostic; the empty-path case does not reach `--ci-out`.
8. `rejects --json and --ci on stdout but allows both with --ci-out` — conflict
   has the wrong diagnostic; the allowed combination exits 2.
9. `rejects a --ci-out path that resolves to --out, an input or the logo` —
   unknown option before any collision check. The `--out` case uses an
   unnormalised `nested/../report.html` alias where neither file exists.
10. `keeps HTML byte-identical with --ci and exits 0 for a failed run` — the
    annotated run exits 2. Both runs use the fixed-timestamp
    `messages/screenshot.ndjson`, not legacy JSON, so the comparison is not
    affected by the legacy adapter's run clock.
11. `returns 1 when the CI file cannot be written but keeps the HTML` — exits
    2 instead of 1. A file blocks the `--ci-out` parent directory.
12. `keeps --logo dependent on --out when --ci is present` — exits 2, but with
    the unknown-option error instead of `--logo requires --out`.

The collision cases also assert that no HTML, input or logo file is modified,
so a later implementation that validates too late fails them.

## Contract details the implementer must not miss

1. **GitHub escaping**
   - Properties: `%` → `%25` first, then CR → `%0D`, LF → `%0A`,
     `:` → `%3A`, `,` → `%2C`.
   - Messages: only `%`, CR and LF.
   - Error title is the escaped `feature: name` string, so the separator colon
     is `%3A` too.
   - Truncate raw failure messages at 4,000 characters and append
     `[truncated]` before escaping.
2. **GitHub buckets**
   - Error: failed, undefined, ambiguous.
   - Notice: skipped, pending, unknown, but only when `executed` is true.
   - Unexecuted scenarios are counted in the final notice only.
   - Empty means `counts.scenarios.total === 0 && scenarios.length === 0`.
   - Final notice: `<total> scenarios` plus every non-zero status bucket plus
     `<unexecuted> unexecuted`.
3. **Caps**
   - GitHub: 50 error and 20 notice annotations, each followed by one
     `::notice title=Tolkira::<N> more annotations omitted` when capped. The
     final count notice keeps the exact totals.
   - Markdown: 50 failed scenarios, 500 raw message characters, 20 skipped
     names. Counts stay complete and the omitted count is stated.
4. **Markdown inertness**
   - Names, feature names and URIs use code spans; messages use fenced blocks.
   - A message containing triple backticks needs a longer fence and must stay
     verbatim.
   - No active link, image or raw HTML may survive outside code.
5. **CLI flow**
   - `--ci` may replace `--out`: summary only, CI text on stdout.
   - Without `--ci-out`, CI text is the only stdout. With `--out` and
     `--ci-out`, stdout is the normal confirmation.
   - `--json` plus `--ci` requires `--ci-out`; then stdout is JSON only.
   - `--ci github` with `--ci-out` is a usage error.
   - Empty, unknown and case-mismatched `--ci` values name `--ci` and the
     allowed values. Empty `--ci-out` names the file path requirement.
   - Validate conflicts before `generateReport`, so no HTML or CI file is
     written on a usage error.
   - `--ci-out` collision checks use resolved paths and include `--out`, even
     when neither file exists, plus inputs and the logo.
   - A failed test run still exits 0.
   - HTML bytes must be identical with and without `--ci`.
   - A CI write failure exits 1 after the HTML has been written.

## Deliberate notes

- The Markdown table labels used by the tests are `Scenarios`, `Passed`,
  `Failed`, `Skipped`, `Pending`, `Undefined`, `Ambiguous`, `Unknown`,
  `Unexecuted`, `Steps failed`, `Steps skipped`, `Attachments` and
  `Attachment bytes`. `Duration` is checked by row label only because its unit
  text is not fixed by the design.
- The GitHub annotation tests pin summary order, not an invented sort order.
- No test asserts the internal formatter helper names beyond the three exported
  functions named in the design.
- The `--logo` test is a preserved behavior guard; it is red today only because
  `--ci` is still an unknown option.
