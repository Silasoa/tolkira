# CI output

Tolkira can format the same stable summary it uses for `--json` as CI text.
The formatter is offline and deterministic: it reads the in-memory summary,
makes no HTTP, Git or telemetry request, and emits the same bytes for the same
input and options.

```shell
# GitHub Actions annotations on stdout
tolkira test-results/ --ci github

# Azure DevOps logging commands on stdout
tolkira test-results/ --ci azure

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
| `--ci azure` | Print Azure DevOps logging commands to stdout. |
| `--ci markdown` | Print a deterministic Markdown summary to stdout or `--ci-out`. |
| `--ci-out <file>` | Write the Markdown summary to a standalone file instead of stdout. Requires `--ci markdown`. |
| `--title <text>` | Report title; also the Markdown heading, escaped so it stays one inert heading. |
| `--logo <file>` | Embed a logo in the HTML report. Requires `--out`. |

`--ci` does not require `--out`. Without `--ci-out`, the CI text is the only
thing on stdout, so a redirect or a step summary receives clean output.
`--json` and `--ci markdown` share stdout only with `--ci-out`; GitHub and Azure
annotations always own stdout and reject `--ci-out`.

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

## Azure DevOps

Azure Pipelines reads logging commands from stdout. Run `--ci azure` in a step
that also runs after a failure, and let the command own stdout:

```yaml
- script: npx tolkira test-results/ --ci azure
  condition: succeededOrFailed()
  displayName: Cucumber annotations
```

Tolkira emits `##vso[task.logissue type=error]` for every executed failed,
undefined and ambiguous scenario, with the feature, scenario and first failure
message (`Feature: Scenario — message`). Executed skipped, pending and unknown
scenarios become `##vso[task.logissue type=warning]Feature: Scenario was
<status>`. A failed run status without a scenario-level error adds one
`##vso[task.logissue type=error]Run failed: ...` command. The final
`##[section]Tolkira:` line states the exact counts and the unexecuted total; an
all-unexecuted run says `0 executed scenarios`, an empty run says
`No scenarios`, and a run-level failure appends `; run failed`.

Unexecuted scenarios are counted, never annotated. Azure mode caps error
commands at 50 and warnings at 20; one warning line states the total omitted.
All emitted commands (up to 50 errors and 20 warnings) reach the job log, but
Azure's Issues view may list at most 10 issues per severity; use the log, the
final section or the JSON summary for the complete picture. Each complete
dynamic message is truncated at 4,000 code points before escaping, ANSI
sequences are stripped first, and `%`, `]`, CR, LF, U+2028 and U+2029 become
`%AZP25`, `%5D`, `%0D` and `%0A`, so every command stays one inert line. A message of many `%` characters can grow to roughly 24 KB
after escaping; Azure's per-line limit is provider-specific, so the 4,000 limit
counts code points, not bytes.

Tolkira emits no `##vso[task.complete]` command and no `sourcepath`: the summary
URI is report-relative and would mislead Azure's file mapping. It emits no
task-result command itself, but Azure may still mark the step failed because
`type=error` logging commands can fail a step. The CLI exit code stays 0 even
when tests fail. Publish the report and other artifacts in a later step with
`condition: succeededOrFailed()` so a failed annotation step cannot skip them,
and read the final section, the annotations or the JSON summary for the test
outcome.

Azure DevOps Server versions can parse logging commands differently; stdout is
the contract. The format is documented and unit-tested, not live-tested against
an Azure pipeline. `--ci-out` is Markdown-only, so `--ci azure --ci-out` is a
usage error, and `--json --ci azure` is rejected because both write to stdout.

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

## Jenkins HTML Publisher

Jenkins can archive the one-file report and publish it from a `post` block that
also runs after a failed test step. Generate the report inside that block,
before `archiveArtifacts` and `publishHTML`: a failed test step stops later
normal steps, so generation belongs in `post { always { ... } }`. This recipe is
documented, not live-tested:

```groovy
post {
  always {
    catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
      sh 'npx tolkira test-results/ --out report/report.html ' +
        '--ci markdown --ci-out report/tolkira-summary.md'
    }
    archiveArtifacts artifacts: 'report/report.html', allowEmptyArchive: true
    publishHTML(target: [
      allowMissing: true,
      alwaysLinkToLastBuild: true,
      reportDir: 'report',
      reportFiles: 'report.html',
      reportName: 'Tolkira'
    ])
  }
}
```

`reportDir` is resolved inside the job workspace, so keep it relative and
workspace-safe (`report/`, not an absolute agent path). `allowMissing: true` and
`allowEmptyArchive: true` handle missing files, but they do not keep the post
block going after a failed generation; `catchError` (or
`sh(returnStatus: true)`) does. `alwaysLinkToLastBuild: true` keeps the last
successful report linked from the job page. On Windows agents, use a `bat` step
with the same arguments.

Stock Jenkins serves published HTML with a restrictive CSP
(`sandbox allow-same-origin; default-src 'none';`) that blocks the report's
inline CSS, `data:` images and scripts. The published view is therefore
archive-only: unstyled HTML with no screenshots and no interactivity. The safe
default is to download the archived HTML artifact and open it locally, where
the report's own [hash-based CSP](AGENT-INTERFACE.md#current-limits) and inline
assets apply. An admin can relax `hudson.model.DirectoryBrowserSupport.CSP`, but
the setting is controller-wide and weakens every published artifact on that
controller; require admin approval and a trusted controller before using it.
The alternative is to keep the Markdown summary as the Jenkins-visible
artifact.

Without JavaScript the active Report still displays and native `<details>` rows
open, including the triage box, which is rendered open. Tabs, filters, search,
the lightbox and some client-side views need JavaScript. The deferred static
all-expanded mode ([B-042](BACKLOG.md)) is only for expanding every detail
panel; it would not fix CSS or `data:` images blocked by Jenkins, and it does
not restore scripts.

## Sharded runs

Shards produce one result file per shard. Split the producer itself, upload each
shard's result file (and its screenshots) as a job artifact, download them in a
later job into separate producer directories, and run Tolkira once over the
parent directory. This recipe is documented, not live-tested.

```shell
# Cucumber 12.2 or newer: quote the json:path value
npx cucumber-js --shard "${SHARD}/${TOTAL}" \
  --format "json:shard-${SHARD}.json"

# Playwright: native JSON reporter and the same shard split
PLAYWRIGHT_JSON_OUTPUT_NAME=playwright-shard-${SHARD}.json \
  npx playwright test --shard=${SHARD}/${TOTAL} --reporter=json
```

Keep every shard's `shard-N.json` side by side rather than overwriting one file,
so every shard is counted once. Download the artifacts into separate producer
roots, for example:

```yaml
# GitHub Actions
- uses: actions/download-artifact@v4
  with:
    name: cucumber-shard-${{ matrix.shard }}
    path: shards/cucumber
- uses: actions/download-artifact@v4
  with:
    name: playwright-shard-${{ matrix.shard }}
    path: shards/playwright
```

```yaml
# Azure Pipelines, one job after the matrix jobs
- task: DownloadPipelineArtifact@2
  inputs:
    buildType: current
    patterns: 'cucumber-shard-*/**'
    targetPath: 'shards/cucumber'
- task: DownloadPipelineArtifact@2
  inputs:
    buildType: current
    patterns: 'playwright-shard-*/**'
    targetPath: 'shards/playwright'
```

```groovy
// Jenkins, Copy Artifact plugin, one call per shard
copyArtifacts(
  projectName: 'cucumber-shards',
  selector: specific("${BUILD_NUMBER}"),
  filter: 'shard-*.json',
  target: 'shards/cucumber'
)
```

Then run one report over the parent directory:

```shell
npx tolkira shards/ --out report.html
```

Keep Cucumber and Playwright files in separate directories for clarity and
attachment handling, not because mixing them is unsupported: Tolkira detects
each file by content and can read both adapters from one directory, but separate
producer roots keep each shard's screenshot base unambiguous. Native Playwright
JSON records attachment paths from the shard workspace, so upload the screenshot
directories alongside the JSON; those paths must still resolve after download.
Use the blob path below when those paths cannot be uploaded or resolved.

Tolkira reads native Playwright JSON, not the Playwright blob archive.
`--reporter=blob` writes a zip that must first be merged, and the merged JSON
must be written under the directory Tolkira scans:

```shell
npx playwright merge-reports --reporter=json blob-report \
  > shards/playwright/merged.json
npx tolkira shards/ --out report.html
```

Merge-reports with blob input carries each shard's attachments through the merge
step, so upload each shard's blob report and merge in the later job instead of
uploading screenshot trees. The merge recipe is documented, not live-tested.

## stdout contract

`--json` and CI text both target stdout, so they combine only when CI goes to a
file:

| `--ci` | `--json` | `--ci-out` | `--email` | stdout |
| --- | --- | --- | --- | --- |
| yes (github or markdown) | no | no | any | CI text only |
| yes (azure) | no | no | any | Azure logging commands only |
| markdown | no | yes | no | `Report written to ...`, or nothing without `--out` |
| markdown | no | yes | yes | `Report written to ...` and `Email written to ...`, or the email line alone without `--out` |
| markdown | yes | yes | any | JSON summary only |
| yes | yes | no | any | usage error |

`--ci-out` exists only for `--ci markdown`; GitHub and Azure annotations always
own stdout, so `--ci azure --ci-out` is a usage error. A failed test run still
exits 0 in every row.

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
file never does, GitHub masking applies to registered secrets in the job log,
and Azure DevOps masking also covers only registered secrets; none is a
guarantee for every annotation. If a message may contain secret
material, write the CI output to a restricted artifact instead of the job log.

The formatter never fetches a remote asset and never calls a CI provider API.
The text is derived from the in-memory summary only.
