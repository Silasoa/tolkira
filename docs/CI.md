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

# Report, PDF and CI file in one run; confirmations go to stdout
tolkira test-results/ --out report.html --pdf report.pdf \
  --ci markdown --ci-out tolkira-summary.md
```

| Option | Meaning |
| --- | --- |
| `--ci github` | Print GitHub Actions workflow commands to stdout. |
| `--ci markdown` | Print a deterministic Markdown summary to stdout or `--ci-out`. |
| `--ci-out <file>` | Write the Markdown summary to a standalone file instead of stdout. Requires `--ci markdown`. |
| `--title <text>` | Report title; also the Markdown heading, escaped so it stays one inert heading. |
| `--logo <file>` | Embed a logo in the HTML report. Requires `--out`. |

`--ci` does not require `--out`. Without `--ci-out`, the CI text is the only
thing on stdout, so a redirect or a step summary receives clean output.
`--json` and `--ci` share stdout only when `--ci-out` keeps the CI text out of
stdout.

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
ambiguous scenario and a notice for executed skipped, pending and unknown
scenarios. A final `::notice title=Tolkira::` line reports the exact scenario
counts and the unexecuted count. An empty run produces one `No scenarios`
notice; when the run status is failed, the run error is emitted before it.
Unexecuted scenarios are counted, never annotated individually. When the run
status is failed but no scenario produced an error, for example because a
global hook failed, Tolkira emits one
`::error title=Tolkira::Run failed: ...` annotation and marks the final notice
as `run failed`.

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
provide the identity. Scenarios that share a feature and name are therefore
indistinguishable in annotations; the final count notice still includes them.

## GitLab

GitLab does not understand GitHub workflow commands. Keep the Markdown summary
as an artifact:

```yaml
cucumber:
  script:
    - npx tolkira test-results/ --out report.html --ci markdown --ci-out tolkira-summary.md
  artifacts:
    when: always
    paths:
      - report.html
      - tolkira-summary.md
```

A GitLab job that only runs Tolkira stays green even when tests failed, because
the report command exits 0 by design. Do not read the job status as the test
outcome: read the counts from the artifact, or let the test runner fail the job
separately.

Or without HTML, keep only the summary as the artifact:

```yaml
cucumber-summary:
  script:
    - npx tolkira test-results/ --ci markdown --ci-out tolkira-summary.md
  artifacts:
    when: always
    paths:
      - tolkira-summary.md
```

Markdown mode writes a heading, a complete counts table including the overall
status, the failed scenarios and the skipped scenario names. Dynamic names,
URIs and messages are rendered as inert code spans or fenced blocks, never as
links, images or raw HTML; line breaks in a name, URI or feature collapse to a
space so they cannot start a new Markdown block. The failed list is capped at
50 scenarios, each failure message at 500 raw characters before formatting, and
the skipped name list at 20 names. The counts stay complete and every omitted
count is stated.

## stdout contract

`--json` and CI text both target stdout, so they combine only when CI goes to a
file:

| `--ci` | `--json` | `--ci-out` | `--email` | stdout |
| --- | --- | --- | --- | --- |
| yes | no | no | any | CI text only |
| yes | no | yes | no | `Report written to ...`, or nothing without `--out` |
| yes | no | yes | yes | `Report written to ...` and `Email written to ...`, or the email line alone without `--out` |
| yes | yes | yes | any | JSON summary only |
| yes | yes | no | any | usage error |

The human confirmation lines (`Report written to ...`,
`PDF written to ...`, `Email written to ...`) are suppressed whenever CI text or
the JSON summary owns stdout, so annotations, Markdown and JSON are never mixed
with other output. `--email` and `--pdf` write their files whenever the command
is accepted and change neither the CI text nor the JSON bytes. Their own
confirmations appear only when stdout is free; `--json --ci-out` suppresses the
PDF line too. The PDF is written after the report and before the email, history
and CI file, so a PDF failure keeps the report and skips the later outputs;
`PDF written to` appears between the report and email lines. `--pdf-timeout`
overrides the PDF render deadline without changing any CI output.

Report warnings, such as skipped path attachments, go to stderr when HTML or a
PDF is written. They never enter stdout, the JSON summary or the CI text.

`--ci-out` must not overwrite an input file, the logo, the `--out` file, the
`--pdf` file or the
`--email` file. The check resolves each path through its nearest existing
ancestor, so a symlinked or junctioned directory cannot hide a target that does
not exist yet, and it treats paths as the same file regardless of case on Windows
and macOS. It runs before report generation, so a rejected combination writes
neither HTML nor the CI file. The CI file is written atomically as a standalone
file: the contents are replaced, not appended.

## Exit codes

CI output does not change the exit codes:

| Code | Meaning |
| --- | --- |
| 0 | Report or CI text generated; tests may still have failed |
| 1 | An input could not be parsed or rendered, or a file could not be written |
| 2 | Invalid usage, including an invalid `--ci` combination |

A failed test run still exits 0 so the report and annotations can be published.
Use the annotations, the Markdown counts or the JSON summary for the test
outcome. A status mail step must derive its subject from the summary status, not
from the job status, for the same reason. A `--ci-out` write failure exits 1 after
the HTML report has been written.

## Messages are not redacted

Failure messages, scenario names and URIs are copied from the input verbatim.
Tolkira does not redact secrets. Do not rely on CI masking for annotations:
keep credentials out of test data. GitLab does not mask them, a local Markdown
file never does, and GitHub masking applies to registered secrets in the job
log, not as a guarantee for every annotation. If a message may contain secret
material, write the CI output to a restricted artifact instead of the job log.

The formatter never fetches a remote asset and never calls a CI provider API.
The text is derived from the in-memory summary only.
