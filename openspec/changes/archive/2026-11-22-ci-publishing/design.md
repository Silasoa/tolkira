# Design

## Azure formatter

Extend `CiFormat` with `'azure'`. `formatCiOutput` dispatches to a new
`formatAzure` that reuses the existing `ERROR_STATUSES`, `NOTICE_STATUSES`,
scenario identity, failure-message selection, executed guard and 50/20 caps. It
emits, in order:

1. `##vso[task.logissue type=error]Feature: Scenario — message` for executed
   failed/undefined/ambiguous, up to 50.
2. `##vso[task.logissue type=warning]Feature: Scenario was <status>` for
   executed skipped/pending/unknown, up to 20; `<status>` is the actual status.
3. `##vso[task.logissue type=error]Run failed: ...` when the run failed without a
   scenario error (for example a global hook).
4. `##vso[task.logissue type=warning]Tolkira: <N> more annotations omitted` when
   a cap dropped one.
5. `##[section]Tolkira: <counts>; <N> unexecuted`, plus `; run failed` when
   the run failed without a scenario error. An empty failed run emits the
   run-failed error and `##[section]Tolkira: No scenarios; run failed`.

The empty-run failed case emits the run-failed error before the `No scenarios`
section. The final counts are exact. Do not emit `##vso[task.complete]` or any
task-result command: the CLI keeps exit 0 so the report can be published. Azure
may still mark the step failed because `type=error` logging commands can fail a
step, so artifact publishing belongs in a later `condition: succeededOrFailed()`
step. Do not
emit `sourcepath`: the summary URI is report-relative and would mislead Azure's
file mapping, matching the GitHub no-`file=` rationale.

### Escaping and caps

`AZURE_MESSAGE_LIMIT = 4000`; strip ANSI from the complete dynamic message
(`identity + status` or `identity + failure message`), truncate that text to 4000
code points, then escape it. The tool-generated `[truncated]` marker is not
input data: it is appended after escaping and stays literal, so its `]` is not
escaped. A long feature/scenario identity is therefore bounded too.
`escapeAzureMessage` runs on the truncated dynamic message:

- `%` → `%AZP25`
- `\r` → `%0D`
- `\n`, U+2028, U+2029, NEL → `%0A`
- `]` → `%5D`

Replace `%` first, then the rest, so the introduced percent sequences are not
escaped again. Every command is one line. The message is after the first `]`, so
an escaped bracket stays data. Cap at 50 errors and 20 warnings; add one omitted
warning with the total omitted count. `##[section]` is only the final count
line; the omitted line is a warning annotation.

## CLI

- Usage: `--ci <format> Print a CI summary: github, azure or markdown`.
- `parseCiFormat` accepts `azure`; invalid list names all three.
- Reject `--ci azure --ci-out` like GitHub:
  `--ci azure writes annotations to stdout; --ci-out is only for --ci markdown`.
- `--json --ci azure` without `--ci-out` says: drop one, or use
  `--ci markdown` with `--ci-out`. It must not suggest `--ci-out` for azure.
  The usage tail says `--json` and `--ci markdown` share stdout only with
  `--ci-out`; `github`/`azure` annotations always own stdout.
- No change to exit codes, report, JSON, email, history or PDF.

## Docs

`docs/CI.md` gains:

- **Azure DevOps**: a pipeline step with `condition: succeededOrFailed()` and
  `--ci azure`, the command mapping, the caps, and the exit-0/read-the-summary
  note. State that Azure DevOps Server versions can parse logging commands
  differently; stdout is the contract. Add the azure exception to the stdout
  contract table.
- **Jenkins HTML Publisher**: a `post { always { ... } }` step with
  `archiveArtifacts`, `publishHTML` (`allowMissing: true`,
  `alwaysLinkToLastBuild: true`, a workspace-safe `reportDir` such as
  `report/`, `reportFiles: 'report.html'`) and
  `--out report/report.html --ci markdown --ci-out report/tolkira-summary.md`.
  State that stock Jenkins CSP (`sandbox allow-same-origin; default-src 'none';`)
  blocks inline CSS, `data:` images and scripts, so the published view is
  archive-only and the safe default is to download the archived HTML artifact.
  An admin-approved
  `hudson.model.DirectoryBrowserSupport.CSP` override can allow inline styles
  and `data:` images, but it is controller-wide and weakens every published
  artifact on that controller; require admin approval and a trusted controller.
  Link the report's own stricter CSP and say the recipe is documented, not
  live-tested.
  Without JS the active Report displays and native `<details>` rows still open,
  including the triage box, which is rendered open; tabs, filters, search, the
  lightbox and some client-side views need JS. The all-expanded static mode is
  deferred (B-042) under the narrowed trigger: scripts remain blocked after a
  CSP relaxation, or a reader needs an expanded static view. It would not fix
  blocked CSS or `data:` images.
- **Sharded runs**: real split flags (`cucumber-js --shard ${SHARD}/${TOTAL}`,
  Cucumber 12.2+, quoted `json:path`; `playwright test --shard=${SHARD}/${TOTAL}`)
  and one JSON file per shard, uploaded as job artifacts; a later job downloads
  them into separate `cucumber/` and `playwright/` directories and runs one
  `tolkira shards/ --out report.html`. Keep the producers separate for clarity
  and attachment paths, not because mixing is unsupported. Native JSON
  attachment paths need the screenshot directories uploaded too, or the blob +
  `merge-reports` path with the output written to `shards/playwright/merged.json`.
  Distinguish native Playwright JSON from blob `merge-reports` (a different
  command/format); Tolkira needs the JSON, not a blob. Label the recipe
  documented, not live-tested.
- GitLab stays the existing Markdown artifact recipe; no GitLab annotation
  format is invented.

Also update `docs/AGENT-INTERFACE.md` (CLI option rows and the CI enum),
`docs/ARCHITECTURE.md` (the CI format list), README (the CI bullet and options),
CHANGELOG (Unreleased) and BACKLOG B-042 "Static all-expanded no-JS mode" with
the narrowed trigger "scripts remain blocked after a CSP relaxation, or a reader
needs an expanded static view"; state it would not fix blocked CSS or `data:`
images.

## Tests

- Azure failure/warning/final/empty/unexecuted/run-failed/caps/newline/`%`/`]`/
  ANSI/long-identity/truncate-before-escape/Unicode-separator cases.
- `--ci azure --ci-out` exits 2; `--ci azure` is accepted; invalid `--ci` lists
  `azure`; `--json --ci azure` remediation.
- GitHub and Markdown full output strings are unchanged for the same summary.
- No task-result command appears; failed scenarios still exit 0.
- CI CLI tests live in `test/cli-ci.test.ts`, formatter tests in
  `test/ci.test.ts`.
- Docs are reviewed by DAR; no locale key is added.

## Host and risks

No DROP-IN host row: the change is deterministic CLI text and documentation, not
an input adapter, report shell, print/PDF/email or compatibility-shim change.
Jenkins itself is not run here; the recipe labels the stock CSP behavior and
the download default. The CI text is covered by unit tests.

Risks: Azure logging-command behavior can differ across Azure DevOps Server
versions; the docs state stdout/no-sourcepath. A `]`/newline/percent is escaped
as data. Jenkins CSP behavior is documented from Jenkins's default header, not
measured on a live host; the artifact download path is the safe default. The
large all-expanded no-JS mode is explicitly out of scope.
