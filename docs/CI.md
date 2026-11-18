# CI output

Tolkira can format the same stable summary it uses for `--json` as CI text.
The formatter is offline and deterministic: it reads the in-memory summary,
makes no HTTP, Git or telemetry request, and emits the same bytes for the same
input and options.

```shell
# GitHub Actions annotations on stdout
tolkira test-results/ --ci github

# Markdown on stdout
tolkira test-results/ --ci markdown

# Markdown in a standalone file, with or without HTML
tolkira test-results/ --ci markdown --ci-out tolkira-summary.md
tolkira test-results/ --out report.html --ci markdown --ci-out tolkira-summary.md
```

| Option | Meaning |
| --- | --- |
| `--ci github` | Print GitHub Actions workflow commands to stdout. |
| `--ci markdown` | Print a deterministic Markdown summary to stdout or `--ci-out`. |
| `--ci-out <file>` | Write the Markdown summary to a standalone file instead of stdout. Requires `--ci markdown`. |

`--ci` does not require `--out`. Without `--ci-out`, the CI text is the only
thing on stdout, so a redirect or a step summary receives clean output.

## GitHub Actions

GitHub only reads workflow commands from stdout. Run `--ci github` as a normal
step and do not redirect its stdout:

```yaml
- name: Cucumber annotations
  if: always()
  run: npx tolkira test-results/ --ci github

- name: Cucumber job summary
  if: always()
  run: npx tolkira test-results/ --ci markdown >> "$GITHUB_STEP_SUMMARY"
```

The first step adds an error annotation for every failed, undefined and
ambiguous scenario and a notice for skipped, pending and unknown scenarios.
A final `::notice title=Tolkira::` line reports the exact scenario counts and
the unexecuted count. An empty run produces one `No scenarios` notice.
Unexecuted scenarios are counted, never annotated individually.

The second step appends Markdown to the job summary. Use `>>`, not `>`, so the
content from earlier steps survives. Do not point `--ci-out` at
`$GITHUB_STEP_SUMMARY`: `--ci-out` replaces the whole file atomically, while
`>>` appends. `--ci-out` is for a dedicated Markdown file, a GitLab artifact or
a later upload step.

GitHub mode caps at 50 error annotations and 20 notice annotations. When a cap
is hit, one `::notice title=Tolkira::<N> more annotations omitted` line states
the remainder, and the final count notice keeps the exact totals. GitHub
Enterprise Server applies its own limits to notice annotations; individual
annotations can be dropped there, but the final count notice still carries the
exact numbers.

The summary URI is report-relative, not a CI workspace path, so annotations
carry no `file=` property. The feature, scenario name and first failure message
provide the identity.

## GitLab

GitLab does not understand GitHub workflow commands. Use Markdown in the job
log or keep it as an artifact:

```yaml
cucumber:
  script:
    - npx tolkira test-results/ --out report.html --ci markdown
  artifacts:
    when: always
    paths:
      - report.html
```

To keep the summary as its own artifact:

```yaml
cucumber-summary:
  script:
    - npx tolkira test-results/ --ci markdown --ci-out tolkira-summary.md
  artifacts:
    when: always
    paths:
      - tolkira-summary.md
```

Markdown mode writes a heading, a complete counts table, the failed scenarios
and the skipped scenario names. Dynamic names, URIs and messages are rendered
as inert code spans or fenced blocks, never as links, images or raw HTML. The
failed list is capped at 50 scenarios, each failure message at 500 raw
characters before formatting, and the skipped name list at 20 names. The counts
stay complete and every omitted count is stated.

## stdout contract

`--json` and CI text both target stdout, so they combine only when CI goes to a
file:

| `--ci` | `--json` | `--ci-out` | stdout |
| --- | --- | --- | --- |
| yes | no | no | CI text only |
| yes | no | yes | normal report confirmation, or nothing without `--out` |
| yes | yes | yes | JSON summary only |
| yes | yes | no | usage error |

The human `Report written to ...` line is suppressed whenever CI text goes to
stdout, so annotations and Markdown are never mixed with other output.

`--ci-out` must not overwrite an input file, the logo or the `--out` file. The
check uses resolved paths and runs before report generation, so a rejected
combination writes neither HTML nor the CI file. The CI file is written
atomically as a standalone file: the contents are replaced, not appended.

## Exit codes

CI output does not change the exit codes:

| Code | Meaning |
| --- | --- |
| 0 | Report or CI text generated; tests may still have failed |
| 1 | An input could not be parsed or rendered, or a file could not be written |
| 2 | Invalid usage, including an invalid `--ci` combination |

A failed test run still exits 0 so the report and annotations can be published.
Use the annotations, the Markdown counts or the JSON summary for the test
outcome. A `--ci-out` write failure exits 1 after the HTML report has been
written.

## Messages are not redacted

Failure messages, scenario names and URIs are copied from the input verbatim.
Tolkira does not redact secrets. GitHub masks registered secrets in annotations
and summaries, but GitLab does not, and a local Markdown file does not either.
Keep credentials out of test data, or review the raw results before enabling CI
output on a public repository. If a message may contain secret material, write
the CI output to a restricted artifact instead of the job log.

The formatter never fetches a remote asset and never calls a CI provider API.
The text is derived from the in-memory summary only.
