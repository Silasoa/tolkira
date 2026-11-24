# Drop-in host validation

Fixtures and the unit/e2e gate prove that Tolkira parses, renders and writes its
own reports. They do not prove that a real project can migrate from another
reporter, or that a real producer's artifact survives the adapter unchanged.
This page is the list of real hosts used for that proof.

## When to run

Run the required hosts:

- before every tag, stage or publish;
- before and after a change to an input adapter, the report shell, print, PDF,
  email or the compatibility shim;
- when a release claims a new producer or a drop-in migration.

This is not part of every pull request. A small code change can rely on the
fixture/e2e gate; record in the change why the host rows were not run.

CI itself runs the check gate on Linux (Node 22/24/26) and Windows (Node 22).
Linux runs the browser gate and package smoke; macOS runs the browser and
package checks. A Windows check failure blocks the workflow; the host rows below
remain separate, live-project evidence.

## Required hosts

| # | Coverage | Host and pin | Artifact | Why this host |
| --- | --- | --- | --- | --- |
| 1 | Cucumber legacy JSON and the `cucumber-html-reporter` shim | [`adessoSE/Seed-Test`](https://github.com/adessoSE/Seed-Test), branch `AI-integration-prototype` at `ce2cad890bfda23f49cb9b2c47182f49df846f20` (ESM, Node >= 22.23.4) | `features/<name>.json`; old report HTML; Tolkira HTML | The real seed project that uses the legacy reporter and group/story modes. The `master` branch is CJS/Node 20; use the AI branch for the ESM migration. |
| 2 | Cucumber legacy JSON and Messages | official `@cucumber/cucumber@13.3.0` host; a feature with a screenshot and a passing/failing scenario | `out.json` and `out.ndjson` from `--format json:... --format message:...` | Official producer; the smallest reproducible host for both Cucumber formats. Seed-Test supplies the integration shape. |
| 3 | Playwright JSON | [`debs-obrien/playwright-movies-app`](https://github.com/debs-obrien/playwright-movies-app) at `5d2cdf08e12a454132b6c86b3f72718d257ca460` | Playwright JSON and the native HTML report | Real Next.js + Playwright OSS project with projects, retries, attachments and a deterministic local mock. |
| 4 | JUnit XML | [`spring-projects/spring-petclinic`](https://github.com/spring-projects/spring-petclinic) at `500158f732419217507c7656904b8e6aa1bcc0d6` | Surefire `target/surefire-reports/*.xml`; Surefire HTML for comparison | Popular, safe Java/Maven host; run unit tests in a Maven container, no application database required. |
| 5 | Cucumber JSON from Cucumber-JVM | [`cucumber/cucumber-jvm-examples`](https://github.com/cucumber/cucumber-jvm-examples) at `f71480fba12239cc10c8d1a87fab69cfcf31686c` | `target/cucumber.json` | Official JVM producer; completes the Cucumber producer coverage beyond Node. |

## Optional producer variants

Run these when a release claims that producer, or when a producer-specific field
is suspected. They all feed an existing format adapter; they are not separate
input formats.

| Producer | Host | License | Output |
| --- | --- | --- | --- |
| Behave | [`behave/behave`](https://github.com/behave/behave) examples | BSD-2-Clause | Cucumber JSON (`-f json`) |
| Behat | Behat documentation examples | MIT | Cucumber JSON/Behat JSON |
| cucumber-ruby | [`cucumber/cucumber-ruby`](https://github.com/cucumber/cucumber-ruby) examples | MIT | Cucumber JSON |
| Reqnroll | Reqnroll official examples | MIT | Cucumber JSON via its formatter |
| Karate | Karate official examples | Apache-2.0 | JUnit XML / Cucumber JSON where configured |

## Reference comparisons

These are not hosts; they are the old output we migrate from.

- `cucumber-html-reporter@7.2.0` on the same legacy JSON. The old reporter is
  a visual reference only: 144 installed packages, 7 audit vulnerabilities and
  Bootstrap/jQuery/3D charts in the throwaway probe. Tolkira is one file, no
  CDN and no chart clone. Do not treat pixel parity as a gate.
- `cucumber-html-reporter-SeedTest` is the prototype patch for the official
  Cucumber Messages HTML formatter, not a reporter fork. Its `demo-report.html`
  has no source NDJSON, so it cannot be regenerated as a Tolkira report.

## Protocol

1. Clone the pinned host into a temporary directory or container. Do not modify
   the host repository and do not copy its `.env`, tokens or databases.
2. Run the host's own test suite and capture the native artifact and, where one
   exists, the native HTML report.
3. Run Tolkira on the artifact and, for coverage 1, run the compat shim with the
   host's exact options. For Seed-Test also verify the group-mode
   `output + '.json'` sidecar.
4. Compare content, not pixels:
   - feature/scenario/step counts and statuses;
   - retries/attempts, hooks, expected/unexpected outcomes;
   - metadata, source strip and run-level errors;
   - attachments/screenshots, including inline images and the scenario-level
     skipped-attachment notice;
   - search/filter, responsive layout at 1440x900 and 390x844;
   - print/PDF/email where the change touches them.
5. Capture full-page screenshots at 1440x900 and 390x844 in the temporary
   directory. Do not commit host screenshots or generated artifacts.
6. Record gaps as an issue or a `docs/BACKLOG.md` item. A failing host blocks a
   release or needs a written, approved exception.

Visualisation is partly functional: aggregate counts, per-feature progress,
status matrix, trends and attachment visibility must survive. Charts, pies and
the old Bootstrap shell are not cloned; if a chart carries information that no
Tolkira view carries, record that functional gap.

## Host status

| Host | Last run | Result | Notes |
| --- | --- | --- | --- |
| Seed-Test | 2026-11-24 | Pass (`0.6.0`) | Pin `ce2cad8` (AI branch), host-validated tarball (631,852 B). `tsc -b` and `report.service.spec.ts` 35/35. Story: 1 feature / 3 scenarios (2 passed, 1 failed), 12 step rows, 1 attachment / 5,234 B, report 88,679 B; group: 2 features / 4 scenarios (3 passed, 1 failed), 16 step rows, 2 attachments / 10,468 B, report 106,291 B; shim group sidecar 21,579 B / 2 stories, deep-equal to the old reporter's sidecar; the old reporter adds one trailing newline (21,580 vs 21,579 B). Static 69,290 B, baseline 1 new failure / 1 fixed, history 3 runs. No overflow, no console errors, no external requests. The +170 B default delta is the measured scroll-offset script; other report bytes move with ids and durations. Limits: per-story JSON synthetic (no live backend/MongoDB), native `cucumber-html-reporter` HTML compared by content counts only. |
| Cucumber-js host | 2026-11-24 | Pass (`0.6.0`) | Official `@cucumber/cucumber@13.3.0` on Node 26.13.1 / npm 10.8.2: 2 scenarios (1 passed, 1 failed), 5 steps (4 passed, 1 failed), 2 inline PNGs / 140 B. `out.json` 3,302 B, `out.ndjson` 9,974 B; reports 72,452 / 72,578 B; the two summaries are byte-identical (2,191 B, same SHA-256). Static 53,322 B with one `<main>`, no `<script>` and all details open; baseline 1 new failure / 1 fixed; history 3 runs / Trends. No overflow, console errors or external requests. Native Cucumber HTML not generated. |
| Playwright movies-app | 2026-11-24 | Pass (`0.6.0`) | Pin `5d2cdf0`, host Playwright 1.62.1; full `npx playwright test --reporter=list,json`: 123 tests (121 passed, 2 skipped, 0 failed/flaky/retries), 113 explicit steps, 5 host attachments / 161 B of which one has an empty body, so Tolkira renders 4 / 161 B. Tolkira: 3 features / 123 scenarios, 236 step rows, report 281,439 B; 123/123 scenario source lines match `spec.file:spec.line`. Static 262,907 B; baseline 2 fixed plus a supplemental 1 not-in-run list; history 3 runs. 1440/390/320 at 200 % and print clean; no overflow, console errors or external requests. Native HTML report not generated. |
| Spring PetClinic | 2026-11-24 | Pass (`0.6.0`) | Pin `500158f`; full `mvn -B test` with Docker off (18 XMLs, 937,554 B): 79 tests / 77 passed / 2 skipped / 0 failed, `PostgresIntegrationTests` emits the zero-test Surefire document. Tolkira on the host-validated tarball: 20 features / 79 scenarios / 77 passed / 2 skipped, 79 step rows, 28 attachments / 67,901 B, report 280,900 B; all 79 scenario names match, `PostgresIntegrationTests` appears in neither JSON nor HTML. Static 262,735 B; baseline 76 fixed; history 3 runs. No overflow, console errors or external requests. The system has only JRE 25 and no Maven, so the run used JDK 21.0.9 (JetBrains JBR) and Maven 3.9.9 provisioned into the evidence directory. |
| Cucumber-JVM examples | 2026-11-24 | Pass (`0.6.0`) | Pin `f71480f`, `calculator-java-junit-jupiter` with a temp-only `cucumber.properties` adding `json:target/cucumber.json` (14,760 B): 3 features / 8 scenarios / 8 passed; 30 scenario steps + 6 background steps + 18 hooks = 54 results; Tolkira renders 36 step rows + 18 hooks and 18 text attachments / 498 B, report 94,666 B. Static 76,113 B with one `<main>`, no `<script>` and 37/37 details open; baseline 3 fixed plus one ambiguous legacy-JSON group; history 3 runs. No overflow, console errors or external requests. JDK 21.0.9 and Maven 3.9.9 were provisioned into the evidence directory; the 8/54 record reproduces, the earlier 9/52 one does not. |
| `cucumber-html-reporter@7.2.0` reference | 2026-11-20 | Content PASS | Same fixture; screenshots at 1440/390; no visual parity; old install 144 packages / 7 vulnerabilities. The 0.5 shell was not compared to CHR. |

**`0.5.1` release run (2026-11-23, final tarball).** All five required rows ran
on the packed 0.5.1 tarball (`tolkira-0.5.1.tgz`, 581,397 B, SHA-256
`C584C33B704BAC7539910916ABF280A8030CBB0E08432916BFB691A191234364`) in
temporary directories outside the repo: Node 26.13.1, npm 10.8.2, JDK
21.0.13.1 (Temurin) and Maven 3.9.9, Docker daemon not running. Screenshots at
1440x900 and 390x844 were captured in the temporary evidence root and are not
committed. Baselines were re-measured because the 0.5.0 numbers came from
subsets or other invocations: Playwright runs the full 123-test suite,
Cucumber-JVM uses the `calculator-java-junit-jupiter` module, and PetClinic now
runs the full `mvn test` (18 XMLs, 79 tests) rather than its earlier unit
scope. That full suite was the B-047 acceptance: the zero-test
`PostgresIntegrationTests` Surefire document is skipped and the directory
renders 20 features / 79 scenarios / 77 passed / 2 skipped. Report bytes and
attachment totals move with run-specific ids, timestamps and absolute paths;
counts and statuses match the earlier baseline on every row.

**`0.6.0` release run (2026-11-24, host-validated tarball).** All five required
rows ran on the packed 0.6.0 tarball (`tolkira-0.6.0.tgz`, 631,852 B,
SHA-256 `7946DF21455E1899D7AC4E6B609B54C37A0BA870C522162195C98BD6BCE2A928`) in
temporary directories outside the repo: Windows 11 Pro 10.0.26300, Node 26.13.1,
npm 10.8.2, JDK 21.0.9 (JetBrains JBR) and Maven 3.9.9 for the two Java hosts
(the system has only JRE 25 and no Maven), Docker daemon not running, Playwright
1.65.1 on Chromium for the report checks. Screenshots at 1440x900, 390x844 and
320 px at 200 % text were captured in the temporary evidence roots and are not
committed. The default report is 170 B larger than in 0.5.1 because the client
script measures the wrapped sticky bar; other byte movement comes from
run-specific ids, durations and absolute paths. Counts and statuses are
unchanged on every row. Each row also ran `--static`, `--baseline` and a
three-run `--history`: static reports have one `<main>`, no `<script>`, no tab
roles and every `<details>` open; baseline panels show the localized badges and
the four tracked counts; Trends shows three newest-first rows. The baseline
"Not in this run" list has no entries in the requested projections because a
row removed from the baseline is classified as `added`; the Playwright row
closed that gap with a supplemental run where the current input lacked the
removed scenario. No check produced a console error, a page error, horizontal
overflow (the raw `-15` is the scrollbar gutter) or an http/https request.
The final repack (632,712 B, SHA-256
`C016225E1E73DF1E19281947C3771162286727F96831078B4F696AA5879587B7`) is a
documentation-only correction to the shipped docs plus one source comment, with
rebuilt bundles and no behaviour change. Its install smoke on a fresh directory
passed: `--version` `0.6.0`, a default report of 70,428 B with the scroll-offset
script, and a `--static` report of 51,229 B with no `<script>`. The host rows
above ran on the same code.

**`history-window` re-check (2026-11-23).** The change touches the CLI, the
history sidecar and the Trends list only: no input adapter, report shell, print,
PDF, email or compat-shim code changed, so no host row is required. The
compatibility evidence is the 0.5.0 older-reader check in the change's
`tasks.md`: a schema-2 sidecar exits 1 with `unsupported schema version "2"` and
keeps its SHA-256; the default report, CI and JSON stay byte-identical against
the 0.5.1 tarball, and the email differs only in its generated timestamp. The
`test/e2e/trends.spec.ts` run covers the two-run Trends tab. The 320 px /
200 % tab-visibility exception (user-approved, 2026-11-23) is closed:
`0.6-static-no-js` task 3.5 wraps the strip and the updated trends spec passes on
Chromium, Firefox and WebKit at 320, 390 and 320/200 %.

**`static-no-js` host check (2026-11-24, Windows).** Official
`@cucumber/cucumber@13.3.0` temp host on Node 26.13.1 / npm 10.8.2: one feature
with a passing and a failing scenario, each attaching a 70 B inline PNG.
`out.json` is 2,456 B and `out.ndjson` 6,991 B; the summary is 1 feature /
2 scenarios (1 passed, 1 failed) / 2 steps / 2 attachments (140 B). The current
tree's CLI wrote default 71,761 B, default with three history runs 75,552 B,
static without history 52,761 B and static with three runs 56,691 B.
Playwright 1.65.1 on Chromium, Firefox and WebKit: the static report at 320,
390, 768, 1024 and 1440 px and 320 px at 200 % text shows one `<main>`, no tab
roles, every `<details>` open, the inline image and Report/Details/Trends, with
no document overflow and no network request; print shows all three sections and
no topbar. The default report keeps three tabs, the toolbar and search, with no
overflow at 1440/390 and no page errors. The other four required host rows and
the Linux/macOS runs were not re-run for this slice; the table marks those four
0.5.1 rows as not re-run for `static-no-js`, and they stay pending for CI or the
next release. The 0.6.0 release run above closes that pending state.

**`baseline-comparison` host check (2026-11-24, Windows).** Official
`@cucumber/cucumber@13.3.0` artifact from the `static-no-js` host (Node 26.13.1,
npm 10.8.2): `out.ndjson` 6,991 B, 1 feature / 2 scenarios (1 passed, 1 failed) /
2 steps / 2 inline PNG attachments (140 B). A fresh producer run in a new temp
project hit a Cucumber-side support-code loader error before executing any
scenario (`Given` reported status `PENDING`), so the artifact was reused; the
change does not touch the input adapters. A baseline projection with the two
statuses flipped plus one removed scenario produced a valid comparison. On the
final tree the CLI wrote default 71,746 B and baseline 73,471 B (+1,725 B,
including the 1,058 B conditional `BASELINE_CSS`); the baseline JSON is 2,457 B
against 1,976 B default (+481 B), and the static baseline report is 54,453 B.
The CI line read `Baseline: 1 new failure · 1 fixed · 0 still failing · 1 not
in this run` (75 B with its newline). The baseline file's bytes and mtime were
unchanged. Playwright 1.65.1 / Chromium at 1440x900 and 390x844: the panel,
`Not in this run` and the fixed badge are visible, no document overflow
(-15 px scrollbar offset at both widths) and no console or page errors; print
media keeps the panel and list. The other required host rows and the
Linux/macOS runs were not re-run for this slice; they stayed pending for CI or
the next release. The 0.6.0 release run above closes that pending state.

The earlier +1,723 B and 1,690 B figures are superseded. The 1,690 B value was
not reproducible from a named fixture or artifact. The final host delta is
+1,725 B (1,058 B `BASELINE_CSS` + 667 B panel/badges/plural copy). The
one-run standard-fixture measurement with
`node scripts/baseline-bytes.mjs` (the script fixes the title `Byte check` and
prints its host/date; reports embed the generation date) is +1,426 B
for `test/fixtures/messages/examples-tables.ndjson` and +1,393 B for
`test/fixtures/legacy/failed.json`. Those deltas differ by panel content length,
not by a missing stylesheet: both include the same 1,058 B `BASELINE_CSS`.

**`size-details-followups` host check (2026-11-23).** The Seed-Test story
artifact rendered with the 0.5.1 tarball and `--locale de` (90,842 B): at
560x900 the Details Run panel is one 475 px track and the exact byte row
(`90.842 Byte`) stays on one line; at 1440x900 two tracks at 124.469 / 186.719
px (first-track share 0.39998); A4 print emulation (703 px content) two tracks
at 257.594 / 386.406 px (share 0.39999); 320 px at 200 % text keeps the row on
one line. No horizontal overflow and no console or page errors. The A4 check
used print-media emulation, not a generated PDF file.

**`metadata-links` re-check (2026-11-22).** Seed-Test pin `ce2cad8` was re-run
with the unreleased `metadata-links` working-tree tarball (540,724 B, package
version 0.4.0). The patched host compiles with `tsc -b` and passes
`report.service.spec.ts` 35/35. The story report is 115,005 B and the group
report 116,054 B plus its sidecar. A temporary `CI run` URL was added to the
temporary host only; the header and Details links carry the normalized `href`
and `rel="noopener noreferrer"` in both reports. No overflow at 1440, 390 or
320 + 200 % text zoom, and no console errors. The Seed-Test row's unrun limits
still apply: live cucumber-js, MongoDB/auth/full backend, Linux/Node 22; the
per-story JSON is synthetic and the ESM AI branch still needs the named/await
import.

**`size-diagnostics` re-check (2026-11-22).** Seed-Test pin `ce2cad8` with the
unreleased `size-diagnostics` working-tree tarball (546,574 B, package version
0.4.0): `tsc -b` and `report.service.spec.ts` 35/35. The story report (116,113
B) and group report (117,137 B) show the input row, decoded attachment row,
exact report HTML row and largest-attachment list; the group input is the
20,550 B sidecar, with 2 attachments / 13,295 B and the top two listed. No
overflow at 1440, 390 or 320 + 200% and no console errors. The Playwright
movies-app host at `5d2cdf0` (`playwright.json`, Playwright 1.65.0 / Chromium
158, 8/8 tests) renders 24,760 B input, 3 attachments / 85 B, the three largest
and 89,904 B exact report HTML; no overflow at the same widths. The temporary
`CI run` metadata from the metadata-links check remains in the temp host only.
The Seed-Test row's unrun limits apply.

**`flaky-trends` re-check (2026-11-22).** Playwright movies-app pin `5d2cdf0`:
two CLI runs over the host JSON and a temporary copy with one `@flaky` tag,
sharing a history sidecar. The Trends table shows two rows, Flaky `0`/`1` and
Flaky share `0%`/`12.5%`, plus the proxy note; no document overflow at 1440,
390 or 320 + 200%, the table scrolls internally (947/1895 px), and there are no
console errors. The Seed-Test compat shim has no `--history` option, so the
Trends host check uses the Playwright artifact; the Seed-Test report-shell row
from size-diagnostics still applies. A4 print is covered by
`test/e2e/print.spec.ts` with the 7 pt Trends table.

**`attachment-skip-reasons` re-check (2026-11-22).** Local Playwright 1.65.0
JSON fixture rendered with the built 0.5.0 CLI: one outside-root, one missing
and one Windows-locked unreadable path attachment. The run counts 3 and the
report lists `outside.png` / `missing.png` / `locked.png` with reasons outside /
missing / unreadable; the names lose their `shots/` prefix and no absolute
fixture, outside or working-directory path appears in the HTML. The stderr
warning stays count-only. The run-level count now includes missing, unreadable,
not-regular and non-local paths. Playwright movies-app pin `5d2cdf0` over
`playwright.json`: 8/8 scenarios, no document overflow at 1440 or 390 and no
console errors.

**`report-css-minify` re-check (2026-11-22).** Playwright movies-app pin
`5d2cdf0`, `playwright.json` (24,760 B; 8/8 tests, 36/36 steps, 3 attachments /
85 B), rendered with the minified report from the current tree (`--title
"Movies app size"`): 84,752 B. Playwright 1.62.1 / Chromium 151.0.7922.34 at
1440x900 and 390x844: no document overflow (1425/1440 and 375/390 px), all 8
scenarios expand, no console or page errors. Locally `REPORT_CSS` is 46,344 B
source -> 40,290 B minified, 6,054 B (13.06 %) smaller.

**`retry-evidence` re-check (2026-11-22).** Checked-in
`test/fixtures/playwright/retry-evidence.json` (2,616 B, synthetic Playwright
JSON shape per `test/fixtures/playwright/PROVENANCE.md`, config version 1.65.0)
rendered with the built 0.5.0 CLI (`--title "Retry evidence"`): 1 scenario, 1
earlier attempt, 67,516 B report. Playwright 1.65.1 / Chromium 159.0.8154.6 at
1440x900 and 390x844: the collapsed `Earlier attempts (1)` block shows a failed
attempt, 1.2 s and `Error: payment gateway timed out`, expands to exactly one
image, and the final summary keeps its own attachment count. No document
overflow (1425/1440 and 375/390 px), no earlier-block overflow and no console or
page errors.

**`report-size-units` small-change record (2026-11-23).** Small change, relies
on the fixture/e2e gate. No host row was re-run for this slice. The maintainer
approved this documented exception for 0.5.0 on 2026-11-23 as part of the
release approval; the next release re-runs every required row. The last recorded
final host reports are Seed-Test 116,113/117,137 B and Playwright movies-app
89,904 B, largest 117,137 B. The two Java hosts (PetClinic, Cucumber-JVM) were
not re-measured for this slice; their reports embed the same ~40 KB stylesheet
and client bundle, so they stay far below 1 MiB. The changed ≥1 MiB branch is
covered by the 1.1 MB unit and e2e fixtures; the sub-1 MiB branch is
byte-identical.

The 2026-11-20 wild-install probe is separate from this matrix but recorded
here: the packed tarball is 522,870 B with three runtime dependencies; a clean
consumer install is 6.71 MB and has no playwright; global, npx, pnpm and Yarn PnP
PDF runs worked with a project peer; `chromiumSandbox: true` worked on Windows.

**`0.6.1-quality-pass` host check (2026-11-24, pre-release tarball).** The
tarball packed from the `4414826` tree (`tolkira-0.6.0.tgz`, 641,686 B, SHA-256
`7C21915BD364A2EBD8F5103856B36E76F071D8BEDE66466482B8004E67B5172C`) installed
as 0.6.0 and printed `0.6.0` from `--version` in all three host tools.
Seed-Test at `ce2cad8` (AI branch) passed `tsc -b` and
`report.service.spec.ts` 35/35: story 88,794 B (1 feature / 3 scenarios, 2
passed and 1 failed / 12 step rows / 1 attachment of 5,234 B), group 106,406 B
(2 features / 4 scenarios, 3 passed and 1 failed / 16 step rows / 2 attachments
of 10,468 B), directory cross-check 107,387 B, shim story 89,377 B and shim
group 107,856 B plus the 21,579 B sidecar, deep-equal to the old reporter's
21,580 B sidecar (one trailing newline; old HTML 59,954 / 87,798 B). Static was
69,407 B, baseline 90,309 B (1 new failure, 1 fixed) and history 88,821 /
92,591 / 92,973 B with three runs; the eight summary payloads are byte-identical
to the 0.6.0 row. The official `@cucumber/cucumber@13.3.0` host on Node 26.13.1
/ npm 10.8.2 produced `out.json` 3,302 B and `out.ndjson` 9,974 B (2 scenarios,
1 passed and 1 failed / 5 steps / 2 inline PNGs of 140 B): legacy 72,569 B and
Messages 72,695 B with both 2,191 B summaries byte-identical (SHA-256
`9A8F9CB22707A97621E0E22AF571C33E3712587EE0F4BA78A66A6AC72B456C06`), static
53,315 B, baseline 74,084 B (1 new failure, 1 fixed, 0 not in this run) and
history 72,722 / 76,482 / 76,859 B with three runs. Playwright movies-app at
`5d2cdf0` with its host Playwright 1.62.1 ran the full suite: 123 tests (121
passed, 2 skipped, 0 failed or flaky, 0 retries), 113 explicit steps and 5 host
attachments / 161 B of which one has an empty body, so Tolkira counts 4 / 161 B;
3 features / 123 scenarios / 236 step rows / 281,547 B report, 123/123 scenario
source lines match `spec.file:spec.line`, the final statuses are 121 passed and
2 skipped, every scenario start date matches its final result, the header is
`2026-11-24 21:37 UTC` and no `1970` remains; static 263,017 B, baseline 283,086
B (2 fixed and 2 ambiguous groups, with the supplemental not-in-run report
279,789 B listing 1 not in this run) and history 281,541 / 285,291 / 285,663 B
with three Trends rows. Playwright 1.65.1 / Chromium 159.0.8154.6 checked all
45 report/viewport combinations (default and static reports at 1440x900,
390x844 and 320x700 at 200 % text): exactly one `<main>`, exactly one banner,
every `runHead` and every Report/Details/Trends panel inside `main` with the
panel IDs and `tabpanel` roles intact (static: no tab roles, no `<script>`, all
details open), no horizontal overflow (the raw -15 px is the scrollbar gutter),
no console or page errors, no http/https requests, and summary/report/Details
attachment parity (Seed-Test 1/1/1 and 2/2/2, Cucumber-js 2/2/2, Playwright
4/4/4). Counts and statuses are unchanged against the 0.6.0 row; default report
bytes moved by +115 B on Seed-Test, +117 B on Cucumber-js and +108 B on
Playwright (static +117 / -7 / +110 B, history +113..+115, +126..+133 and
+106 B) with run-specific ids, durations and the approved shell changes. The
Seed-Test per-story JSON remains synthetic (no live backend/MongoDB) and the
native reporter HTML was compared by content only.

## Release rule

Before a tag, stage or publish:

- run every required host row;
- record the host, pin, artifact and result in this page;
- a red host blocks the release or gets a written exception approved by the
  maintainer;
- re-run the rows affected by the release's changes, not only the happy path.

The same rule applies to a large feature touching an adapter, the report shell,
print, PDF, email or the compatibility shim.
