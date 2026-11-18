# Design

## Context

The CLI already builds `ReportSummary` for `--json` and HTML reports. The CI
mode is a pure formatting layer over that summary: no network, no HTML, no
schema change. GitHub annotations use the workflow-command grammar; GitLab and
GitHub step summaries use Markdown.

## Module and API

Add `src/ci.ts` with pure functions:

- `formatGitHubAnnotations(summary, options?)`
- `formatMarkdownSummary(summary, options?)`
- `formatCiOutput(summary, format, options?)` as the small dispatcher.

`CiFormat` is `'github' | 'markdown'`. `options.title` is used by the Markdown
heading. The module is internal; no new public package export unless a second
consumer needs it.

## Status coverage

The summary has more than pass/fail/skip: `pending`, `undefined`, `ambiguous`,
`unknown`, and scenarios with `executed: false`. Cucumber treats undefined and
ambiguous as failures. Define:

- error annotations: `failed`, `undefined`, `ambiguous`;
- notice annotations: `skipped`, `pending`, `unknown` (an executed unknown is
  worth surfacing, but not as a red failure);
- unexecuted scenarios (`executed: false`) are counted separately and never
  silently disappear;
- the final notice/total line includes every non-zero status bucket and the
  unexecuted count;
- “empty” means `counts.scenarios.total === 0 && summary.scenarios.length === 0`;
  “all unexecuted” is its own case.

## GitHub annotations

- Error scenario: `::error title=<escaped feature: name>::<escaped message>`.
  Do not emit a `file` property: the summary URI is report-relative, already
  reduced, and cannot be mapped reliably to the CI workspace. Title and message
  carry the identity; a future schema can add a real source path.
- Notice scenario: `::notice title=Skipped::<escaped feature: name> was skipped`
  (or Pending/Unknown).
- Final line: `::notice title=Tolkira::<total> scenarios: <non-zero buckets>,
  <unexecuted> unexecuted`; empty run: `::notice title=Tolkira::No scenarios`.
- Two escapers: **properties** (`title`) escape `%` -> `%25`, CR ->
  `%0D`, LF -> `%0A`, `:` -> `%3A`, `,` -> `%2C`; **messages** escape only `%`,
  CR and LF. Escaping `:`/`,` in a message would render literally.
- Use the first non-passed step message for a failure; fall back to
  `Scenario failed`. Truncate the raw message at 4,000 characters before
  escaping, with an explicit `[truncated]` suffix.
- Cap at 50 error annotations and 20 notice annotations; add one
  `::notice title=Tolkira::<N> more annotations omitted` when capped. The final
  count notice always has the exact counts.
- One annotation per line; deterministic summary order. Test names/messages
  containing `\n::error title=x::` must remain data, not a second command.

## Markdown

- Heading: `## <title>` (default `Tolkira report`); `--title` feeds this value.
- Counts table: scenarios total, passed, failed, skipped, pending, undefined,
  ambiguous, unknown and unexecuted; steps failed/skipped, duration,
  attachments total/bytes.
- Failed section: up to 50 scenarios, each with feature, name, URI and first
  failure message. Treat all dynamic text as inert: render names/URIs in code
  spans and messages in fenced code blocks; escape backticks and choose a fence
  longer than any run in the message. No active links, images or raw HTML.
- Skipped section: count and up to 20 names, or only the count if empty.
- Empty run: zero counts and “No scenarios in this report.”
- Counts are complete even when a list is capped; state the omitted count.
- Format integers with `String(n)`; do not add locale-sensitive formatting.
- No timestamp, random value or environment-dependent text.
- Messages are verbatim, not redacted. Docs warn that GitHub masks registered
  secrets in summaries while GitLab does not; use a job log or artifact there.

## CLI flow

Add options:

```
--ci <github|markdown>  Format the summary for CI
--ci-out <file>        Write CI text to a file instead of stdout
```

Validation:

- `--ci` must be `github` or `markdown`.
- `--ci-out` requires `--ci`; an empty path is invalid.
- `--json` and `--ci` may share stdout only when `--ci-out` is present.
- `--ci github` with `--ci-out` is a usage error: GitHub only reads workflow
  commands from stdout. `--ci-out` is for Markdown/GitLab files.
- `--ci-out` must not overwrite an input, the logo or `--out`. Check a
  `path.resolve`/realpath equality against `--out` even when neither file exists
  yet; `outputOverwritesInput` alone is not enough because it returns early for
  a missing target and does not know `--out`.
- Validate `--ci`/`--ci-out` conflicts before `generateReport`, so a rejected
  combination writes no HTML and no CI file.
- `--ci` may run without `--out`; it then calls `summarizeReport`.
- With `--out`, the existing `generateReport` path produces HTML and summary;
  CI formatting happens after the report is written.
- `--logo` with `--ci` and no `--out` remains a usage error.

stdout contract:

| `--ci` | `--json` | `--ci-out` | stdout |
| --- | --- | --- | --- |
| yes | no | no | CI text only |
| yes | no | yes | normal confirmation only |
| yes | yes | yes | JSON summary only |
| yes | yes | no | usage error |

`--out` and `--ci-out` are independent files; both may be written.

Writing:

- stdout: one UTF-8 string; when CI goes to stdout, no human confirmation.
- `--ci-out`: `writeAtomic` to a **standalone** file (replace, not append),
  same directory temp + rename, 0600 mode. For `$GITHUB_STEP_SUMMARY`, docs use
  `--ci markdown >> "$GITHUB_STEP_SUMMARY"` so earlier steps' content is kept;
  do not point `--ci-out` at a shared summary file.
- Exit codes unchanged: a failed test run still returns 0 for a generated
  report/annotation; usage and render errors keep their current codes.
- Add `docs/CI.md` to `package.json` `files`, `docs/README.md` and `llms.txt`.

## Alternatives considered

- **A separate `tolkira ci` command.** Cleaner separation, but the summary is
  already produced by the main command and `--ci` keeps one invocation in CI.
- **Parse `--json` stdout in a shell step.** Requires jq/Node glue and doubles
  parsing; a built-in formatter is smaller and deterministic.
- **Call the GitHub/GitLab APIs.** Violates offline/no-network; users can pipe
  stdout or a file to their own step.
- **Annotate every step.** Too noisy for the check UI; scenario-level
  annotations plus a count notice are the useful granularity.

## Risks

- GitHub workflow-command escaping is easy to get subtly wrong; tests pin `%`,
  `:`, `,`, CR and LF.
- Markdown can be huge with many failures; cap the list and message length while
  keeping counts exact.
- `--ci-out` is a standalone file, not an append target. Docs send Markdown to
  `$GITHUB_STEP_SUMMARY` with `>>` on stdout so other steps' content survives;
  atomic rename only protects the dedicated file from a partial write.
