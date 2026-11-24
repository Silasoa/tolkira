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
| Seed-Test | 2026-11-23 | Pass (0.5.1; not re-run for `static-no-js`) | Pin `ce2cad8` (AI branch), final 0.5.1 tarball (581,397 B). `tsc -b` in `backend/` and `report.service.spec.ts` 35/35. Story: 1 feature / 3 scenarios (2 passed, 1 failed), 12 step rows, 1 attachment / 5,234 B, report 89,092 B. Group: 2 features / 4 scenarios (3 passed, 1 failed), 16 step rows, 2 attachments / 10,468 B, CLI report 106,590 B (shim group HTML 107,571 B); sidecar `group-mode.html.json` 21,579 B with 2 stories. Metadata, inline PNG, failure text, source row, search/filter, 1440/390 no overflow, no console errors. Report bytes move with ids, names and durations (-400 B story, -1,530 B group CLI, +262 B sidecar) and are not content loss. Limits: per-story JSON synthetic (no live backend/MongoDB), the shim has no `--history`, no native `cucumber-html-reporter` HTML compared, Linux/Node 22 unrun. |
| Cucumber-js host | 2026-11-23 | Pass (`static-no-js`) | Official `@cucumber/cucumber@13.3.0`: 2 scenarios (1 passed, 1 failed), 5 steps (4 passed, 1 failed), 1 PNG / 5,234 B. `out.json` 9,801 B, `out.ndjson` 16,277 B; reports 84,917 B / 85,044 B. Legacy and Messages summaries are byte-identical (same SHA-256): 1 feature, 2 scenarios, 5 steps, 5,234 attachment bytes. No overflow, no console errors. Native Cucumber HTML not generated; shim ESM named/await and CJS stay covered by the CI tests. |
| Playwright movies-app | 2026-11-23 | Pass (0.5.1; not re-run for `static-no-js`) | Pin `5d2cdf0`, host Playwright 1.62.1; full `npx playwright test --reporter=json`: 123 tests (121 passed, 2 skipped, 0 failed/flaky/retries), 113 explicit steps, 5 attachments / 265 B. Tolkira: 3 features / 123 scenarios (121 passed, 2 skipped), 236 step rows (113 + 123 documented synthetic overhead rows), 5 attachments / 265 B, report 281,486 B; 123/123 scenario source lines match `spec.file:spec.line`. 1440/390 no overflow, no console errors. The first full run was red on two 30 s host-side timeouts; a targeted rerun passed 3/3 and the second full run passed 121/2, so the red is host cold-start load, not Tolkira. The earlier 4 attachments / 161 B record had one 0-byte inline attachment; this run wrote 104 B for the same attachment and all five rendered. Native HTML report not generated. |
| Spring PetClinic | 2026-11-23 | Pass (0.5.1 full suite; not re-run for `static-no-js`) | Pin `500158f`; full `mvn -B test` with Docker off (18 XMLs, 940,097 B): 79 tests / 77 passed / 2 skipped / 0 failed, `PostgresIntegrationTests` emits the zero-test Surefire document. Tolkira on the final 0.5.1 tarball (581,397 B): 20 features / 79 scenarios / 77 passed / 2 skipped, 79 step rows, 28 attachments / 67,797 B, report 280,632 B; all 79 scenario names match the summary, `PostgresIntegrationTests` appears in neither JSON nor HTML. B-047 acceptance passed. Attachment bytes differ by -220 B from the earlier exclusion render (67,797 vs 68,017): the attachments are Testcontainers `<system-out>` text with timestamps and absolute paths, so the total is run-specific; no attachment is missing. No overflow, no console errors, no external requests. |
| Cucumber-JVM examples | 2026-11-23 | Pass (0.5.1; not re-run for `static-no-js`) | Pin `f71480f`, `calculator-java-junit-jupiter` with a temp-only `cucumber.properties` adding `json:target/cucumber.json` (14,686 B): 3 features / 8 scenarios / 8 passed; 30 scenario steps + 6 background steps + 18 hooks = 54 results; Tolkira renders 36 step rows + 18 hooks and 18 text attachments / 498 B, report 94,480 B. The earlier 9/52/12-hook record does not reproduce at this pin. No overflow, no console errors. |
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
next release.

**`baseline-comparison` host check (2026-11-24, Windows).** Official
`@cucumber/cucumber@13.3.0` artifact from the `static-no-js` host (Node 26.13.1,
npm 10.8.2): `out.ndjson` 6,991 B, 1 feature / 2 scenarios (1 passed, 1 failed) /
2 steps / 2 inline PNG attachments (140 B). A fresh producer run in a new temp
project hit a Cucumber-side support-code loader error before executing any
scenario (`Given` reported status `PENDING`), so the artifact was reused; the
change does not touch the input adapters. A baseline projection with the two
statuses flipped plus one removed scenario produced a valid comparison. The
current tree's CLI wrote default 71,746 B and baseline 73,469 B (+1,723 B,
including the 1,058 B conditional `BASELINE_CSS`); the baseline JSON is 2,457 B
against 1,976 B default (+481 B), and the static baseline report is 54,451 B.
The CI line read `Baseline: 1 new failure · 1 fixed · 0 still failing · 1 not
in this run` (75 B with its newline). The baseline file's bytes and mtime were
unchanged. Playwright 1.65.1 / Chromium at 1440x900 and 390x844: the panel,
`Not in this run` and the fixed badge are visible, no document overflow
(-15 px scrollbar offset at both widths) and no console or page errors; print
media keeps the panel and list. The other required host rows and the
Linux/macOS runs were not re-run for this slice; they stay pending for CI or the
next release.

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

## Release rule

Before a tag, stage or publish:

- run every required host row;
- record the host, pin, artifact and result in this page;
- a red host blocks the release or gets a written exception approved by the
  maintainer;
- re-run the rows affected by the release's changes, not only the happy path.

The same rule applies to a large feature touching an adapter, the report shell,
print, PDF, email or the compatibility shim.
