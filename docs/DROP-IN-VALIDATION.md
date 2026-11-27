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

| Host | Last release run | Result | Notes |
| --- | --- | --- | --- |
| Seed-Test | 2026-11-24 | Pass (`0.6.0`) | Pin `ce2cad8` (AI branch), host-validated tarball (631,852 B). `tsc -b` and `report.service.spec.ts` 35/35. Story: 1 feature / 3 scenarios (2 passed, 1 failed), 12 step rows, 1 attachment / 5,234 B, report 88,679 B; group: 2 features / 4 scenarios (3 passed, 1 failed), 16 step rows, 2 attachments / 10,468 B, report 106,291 B; shim group sidecar 21,579 B / 2 stories, deep-equal to the old reporter's sidecar; the old reporter adds one trailing newline (21,580 vs 21,579 B). Static 69,290 B, baseline 1 new failure / 1 fixed, history 3 runs. No overflow, no console errors, no external requests. The +170 B default delta is the measured scroll-offset script; other report bytes move with ids and durations. Limits: per-story JSON synthetic (no live backend/MongoDB), native `cucumber-html-reporter` HTML compared by content counts only. |
| Cucumber-js host | 2026-11-24 | Pass (`0.6.0`) | Official `@cucumber/cucumber@13.3.0` on Node 26.13.1 / npm 10.8.2: 2 scenarios (1 passed, 1 failed), 5 steps (4 passed, 1 failed), 2 inline PNGs / 140 B. `out.json` 3,302 B, `out.ndjson` 9,974 B; reports 72,452 / 72,578 B; the two summaries are byte-identical (2,191 B, same SHA-256). Static 53,322 B with one `<main>`, no `<script>` and all details open; baseline 1 new failure / 1 fixed; history 3 runs / Trends. No overflow, console errors or external requests. Native Cucumber HTML not generated. |
| Playwright movies-app | 2026-11-24 | Pass (`0.6.0`) | Pin `5d2cdf0`, host Playwright 1.62.1; full `npx playwright test --reporter=list,json`: 123 tests (121 passed, 2 skipped, 0 failed/flaky/retries), 113 explicit steps, 5 host attachments / 161 B of which one has an empty body, so Tolkira renders 4 / 161 B. Tolkira: 3 features / 123 scenarios, 236 step rows, report 281,439 B; 123/123 scenario source lines match `spec.file:spec.line`. Static 262,907 B; baseline 2 fixed plus a supplemental 1 not-in-run list; history 3 runs. 1440/390/320 at 200 % and print clean; no overflow, console errors or external requests. Native HTML report not generated. |
| Spring PetClinic | 2026-11-24 | Pass (`0.6.0`) | Pin `500158f`; full `mvn -B test` with Docker off (18 XMLs, 937,554 B): 79 tests / 77 passed / 2 skipped / 0 failed, `PostgresIntegrationTests` emits the zero-test Surefire document. Tolkira on the host-validated tarball: 20 features / 79 scenarios / 77 passed / 2 skipped, 79 step rows, 28 attachments / 67,901 B, report 280,900 B; all 79 scenario names match, `PostgresIntegrationTests` appears in neither JSON nor HTML. Static 262,735 B; baseline 76 fixed; history 3 runs. No overflow, console errors or external requests. The system has only JRE 25 and no Maven, so the run used JDK 21.0.9 (JetBrains JBR) and Maven 3.9.9 provisioned into the evidence directory. |
| Cucumber-JVM examples | 2026-11-24 | Pass (`0.6.0`) | Pin `f71480f`, `calculator-java-junit-jupiter` with a temp-only `cucumber.properties` adding `json:target/cucumber.json` (14,760 B): 3 features / 8 scenarios / 8 passed; 30 scenario steps + 6 background steps + 18 hooks = 54 results; Tolkira renders 36 step rows + 18 hooks and 18 text attachments / 498 B, report 94,666 B. Static 76,113 B with one `<main>`, no `<script>` and 37/37 details open; baseline 3 fixed plus one ambiguous legacy-JSON group; history 3 runs. No overflow, console errors or external requests. JDK 21.0.9 and Maven 3.9.9 were provisioned into the evidence directory; the 8/54 record reproduces, the earlier 9/52 one does not. |
| `cucumber-html-reporter@7.2.0` reference | 2026-11-20 | Content PASS | Same fixture; screenshots at 1440/390; no visual parity; old install 144 packages / 7 vulnerabilities. The 0.5 shell was not compared to CHR. |

**`0.7.0` pre-release run (2026-11-27, `ce105aa`).** All five required rows ran
on the packed pre-release tarball `tolkira-0.6.1.tgz` (707,008 B, 94 entries,
SHA-256 `DC4C0DBC0D8A75319D4B3F39000C59CFA0283937304AC43536E5CBEFA9C812F2`);
the tarball carries the `0.6.1` version literal because the 0.7.0 bump follows
this matrix. Windows 11 Pro, Node 26.13.1, npm 10.8.2, JDK 21.0.9 (JetBrains
JBR) and Maven 3.9.9 for the two Java hosts (the system has only JRE 25 and no
Maven), Docker daemon not running, Playwright 1.65.1 on Chromium (the Playwright
host used its own 1.62.1 / Chromium 151) for the report checks. Screenshots at
1440x900, 390x844 and 320 px at 200 % text were captured in the temporary
evidence roots and are not committed. All rows were clean installs into
temporary projects, no repo link.

- **Seed-Test** `ce2cad8` (AI branch): `tsc -b` exit 0 and
  `report.service.spec.ts` 35/35. Story: 1 feature / 3 scenarios (2 passed,
  1 failed) / 12 step rows / 1 attachment 5,234 B, report 97,492 B; group:
  2 features / 4 scenarios (3 passed, 1 failed) / 16 step rows / 2 attachments
  10,468 B, report 115,210 B via sidecar and 116,191 B via directory; shim
  story 98,075 B, group 116,660 B, group sidecar 21,579 B against the old
  reporter's 21,580 B, deep-equal except one trailing LF. Static 76,459 B;
  baseline 99,074 B (1 new failure, 1 fixed); history 97,519 / 101,290 /
  101,672 B, three newest-first runs. 11 browser checks: exactly one `<main>`,
  overflow −15 px (scrollbar gutter), 0 console/page errors, 0 http(s)
  requests, search 3→1→3, inline PNGs loaded. The skipped-attachment notice was
  not triggered (0 skipped attachments). Limits: per-story JSON synthetic (no
  live backend/MongoDB), native old HTML compared by content counts only.
- **Cucumber-js host** `@cucumber/cucumber@13.3.0`: `out.json` 3,302 B and
  `out.ndjson` 9,974 B, 1 feature / 2 scenarios (1 passed, 1 failed) / 5 steps
  / 2 attachments 140 B. Legacy JSON reports: 79,318 default, 58,418 static,
  81,202 German, 80,711 baseline, 83,031 history; Messages: 79,636 / 58,736 /
  81,545 / 81,029 / 83,349. Both summaries are 2,191 B and byte-identical; the
  baseline summary is 2,464 B with 0 new / 1 still failing, the history sidecar
  1,655 B / 2 runs. 30 browser combinations (5 forms × 2 inputs × 3 viewports):
  one `<main>`, max overflow −15 px, zero console/page/http errors; row link
  83.23×28 px at 1440/390 and 164.47×56 px at 320/200 %. The notice comment
  appears once in all four scripted forms and not in static.
- **Playwright movies-app** `5d2cdf0`, host Playwright 1.62.1 / Chromium 151:
  full suite 123 tests (121 passed, 2 skipped, 0 failed/flaky/retries), 113
  explicit steps, 5 host attachments / 161 B of which one has an empty body, so
  Tolkira renders 4 / 161 B. Tolkira: 3 features / 123 scenarios / 121 passed /
  2 skipped / 236 step rows, 123/123 scenario source lines match
  `spec.file:spec.line`, 0 retries. Reports: 289,651 default, 269,496 static,
  291,417 baseline, history 289,651 / 293,365 / 293,729 B. Baseline 0 new /
  2 fixed / 0 still failing / 1 not in run; Trends 3 rows; tag panel 6 rows.
  1440/390/320 at 200 % and print clean, one `<main>`, no overflow, 0
  console/page errors and 0 external requests; static has 0 scripts and 131/131
  details open. The first full host attempt hit one host-only timing flake
  (`network-abort-search`); the clean full rerun is recorded. Native Playwright
  HTML not compared; print checked by media emulation.
- **Spring PetClinic** `500158f`: full `mvn -B test` with Docker disabled
  (`DOCKER_HOST=tcp://127.0.0.1:1`) BUILD SUCCESS, 18 XMLs / 938,743 B: 79
  tests / 77 passed / 2 skipped / 0 failed; the zero-test
  `PostgresIntegrationTests` document is present. Tolkira: 20 features / 79
  scenarios (77 passed, 2 skipped) / 79 step rows, 28 attachments / 69,184 B,
  all 79 scenario names match, `PostgresIntegrationTests` appears in neither
  JSON nor HTML. Reports: 284,753 default, 264,944 static, 290,459 baseline,
  288,917 history; the JSON is 44,080 B in every form. Baseline 77 fixed / 0
  new; history 3 runs plus Trends. 8 browser cases: one `<main>`, max overflow
  −15 px, zero console/page errors and external requests. The XML and
  attachment byte deltas against the 0.6.0 baseline (+1,189 / +1,283) are
  run-specific absolute paths and timestamps, not content differences.
- **Cucumber-JVM examples** `f71480f`, `calculator-java-junit-jupiter` with a
  temp-only `cucumber.properties` adding `json:target/cucumber.json` (14,774 B):
  8/8 scenarios passed; 30 scenario + 6 background + 18 hooks = 54 results.
  Tolkira: 36 step rows + 18 hooks + 18 text attachments / 498 B; summary 3
  features / 8/8 scenarios / 54/54 steps. Reports: 101,872 default, 81,674
  static, 103,410 baseline, 105,985 three-run history. Static: one `<main>`, no
  `<script>`, 37/37 details open; baseline 0 new / 2 fixed / 0 still failing
  plus one ambiguous legacy-JSON group; Trends 3 rows. 1440x900 and 390x844:
  no overflow, console/page errors or external requests. The default report is
  7,206 B larger than the 0.6.0 reference at identical counts, the expected
  0.7.0 shell growth (incident panel, notice, toolbar fix).

**`0.6.1` release run (2026-11-25, tag `v0.6.1` at `3bd2c87`).** Release run
`45649497193` passed: the Linux gate ran hygiene, check and the three-engine
browser suite, the macOS gate ran the three-engine browser suite, and the
publish job built, packed, installed and smoke-tested the CLI before staging
the package. The host evidence for this release is the `0.6.1-hardening` block
above: its five rows ran on a tarball from `c791898` whose `src/`, `scripts/`
and `test/fixtures` are identical to the tag, so only the version literal,
tests and docs differ; no row was re-run on the 0.6.1 literal. CI packed 80
entries, 657.3 kB, npm shasum
`9ed6f3a5adfb627be285e4f81fdba18d5de962ff`, staged `tolkira@0.6.1` with id
`234439a9-bfea-4597-89c4-4a9e60537076` and tag `latest`; the provenance
statement reached log index `4106198783`. The maintainer approved the staged
package on 2026-11-25 and the registry now serves `latest: 0.6.1`. The published
tarball is 657,269 B with SHA-256
`89E9993C30B4D09111FA4FCB98C977F795A3F9396A72D2416E23C232DD616C54` (80
entries; `dist/cli.js` and `dist/index.js` present), its npm shasum and
integrity match the staged values, and `npm audit signatures` verified 17
registry signatures and 7 attestations. A global install of the published
package printed `0.6.1`, rendered the fixture default report at 66,371 B, the
static report at 47,783 B without a `<script>` and a 1,039 B `--json` summary.
The table above keeps its last full release run (0.6.0).

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

**`0.6.1-hardening` host check (2026-11-25, pre-release tarball).** All five
required rows ran on the packed pre-release tarball (`tolkira-0.6.0.tgz`,
656,762 B, SHA-256
`1DF81A0CCC3284DB6BED17B477F985219862C6D55025916DD80EAC7E1115A22C`, packed from
`c791898`; `--version` prints `0.6.0`), except Cucumber-JVM, which used a second
pack of the same tree from `1b74ec0` (657,262 B, SHA-256
`90EAE945924388DECF706DC0EA447698D3D2FDE1E5417A0C286155D1A3C67F99`) that differs
in docs only (`git diff c791898..HEAD -- src` is empty). Windows 11 Pro
10.0.26300, Node 26.13.1, npm 10.8.2, JDK 21.0.13.1 (Temurin) and Maven 3.9.9
for the two Java hosts, Docker daemon not running, Playwright 1.65.1 /
Chromium 159.0.8154.6. Screenshots at 1440x900, 390x844 and 320 px at 200 % text
stayed in the temporary evidence roots. Counts and statuses are unchanged
against the 0.6.0 row on every host; report bytes move with run-specific ids,
durations and host text plus the approved shell and legacy-date changes. Every
view check recorded exactly one `<main>`, exactly one banner, no horizontal
overflow (the raw -15 px is the scrollbar gutter), no console or page error and
no http/https request; every static report has no `<script>`, no tab roles and
all details open. Print, PDF and email were not re-run.

**Seed-Test.** At `ce2cad8` (AI branch, detached) `tsc -b` and the backend
`report.service.spec.ts` passed 35/35, and the host artifacts are byte-identical
to the 0.6.0 row (story 9,782 B; group 9,033 and 8,956 B). Story report
88,758 B (1 feature / 3 scenarios, 2 passed and 1 failed / 12 step rows /
1 attachment of 5,234 B) and group merged sidecar 106,214 B with the directory
cross-check at 107,195 B (2 features / 4 scenarios, 3 passed and 1 failed /
16 step rows / 2 attachments of 10,468 B). The summaries are 3,497 B
(`114398C08B7D4C08B44D2E1AD646D67962AA44680823DFA70A1A040015DC542C`) and 4,446 B
(`94AE7BD7AD97030CF95C914D20BA021F04C397A7428D83B931F96FF7266D896F`), with the
directory and merged-sidecar summaries byte-identical. Static 69,371 / 87,575 B,
baseline 90,273 / 108,710 B (1 new failure and 1 fixed each) and history
88,788 / 92,664 / 93,099 B and 107,225 / 111,009 / 111,398 B with three
newest-first Trends rows. The shim story is 89,185 B and the group 107,622 B;
the 21,579 B sidecar is deep-equal to the old reporter's 21,580 B sidecar (one
trailing LF), a second run with the sidecar present keeps 2 features /
6 elements, and the native old HTML is 59,954 / 87,798 B. The 48 HTML, JSON,
Markdown and stdout files contain no local user name, `Users\`, `file:` or
absolute path, including `--json` and `--ci markdown`; `file:///C:/Users/<profile>/...`
and `file:///home/<account>/...` display as `features/Login<id>.feature` and
`features/login.feature`, and the copied failure text is clean. No run date, no
date cell and no `1970`. Summary scenarios are UTF-16 ordered, the tag strip puts
`@Apple` before `@zebra`, the all-passed probe renders `Zebra/apple/Öpfel`, and
the failed-first feature/source order is the unchanged triage order; two
identical runs are byte-identical. Attachment parity 1/1/1 and 2/2/2. Limits:
the per-story JSON is synthetic (no live backend/MongoDB), native HTML was
compared by content and print/PDF/email were not re-run.

**Cucumber-js.** Official `@cucumber/cucumber@13.3.0` on Node 26.13.1 /
npm 10.8.2 produced `out.json` 3,156 B and `out.ndjson` 9,742 B (1 feature /
2 scenarios, 1 passed and 1 failed / 5 steps / 2 inline PNGs of 140 B) and
exited 1 from the expected failure. Tolkira wrote legacy 72,023 B and Messages
72,299 B; both summaries are 2,091 B and byte-identical (SHA-256
`c10cfe87ecb5f4e2d744e86623ced5527c54c64b42a00e9f31291ca13a2ae650`). Static
53,089 B, baseline 73,538 B (1 new failure, 1 fixed, 0 still failing, 0 not in
this run), history 72,023 / 75,761 / 76,127 B with three Trends rows, CI
Markdown 611 B and the baseline CI line 75 B. The `2026-11-24 23:57 UTC` header
matches `testRunStarted` and no `1970` appears; scenario names are UTF-16 sorted
and stable; attachment parity is 2/2/2. Privacy: the display URI is
`features/host.feature` with no `file:` URL or absolute input/output path in the
metadata, but the literal whole-surface check is red on the producer's failure
stack, which carries the local user segment and
`C:\Users\<user>\...\steps.js:18:9` into the HTML error block and `data-search`,
the `--json` step message, the CI Markdown and the copied failure text; see the
approved exception below. Native Cucumber HTML was not generated.

**Playwright movies-app.** Pin `5d2cdf08e12a454132b6c86b3f72718d257ca460` with
the host's Playwright 1.62.1: the full suite ran 123 tests (121 passed,
2 skipped, 0 failed or flaky, 0 retries) with 113 nested steps and 5 host
attachments / 161 B of which one has an empty body, so Tolkira counts 4 / 161 B;
the extracted JSON input is 192,551 B. Tolkira wrote 3 features / 123 scenarios
/ 236 step rows in 281,542 B, `--json` 73,605 B, static 263,012 B, baseline
283,081 B (2 fixed and 2 ambiguous groups) with the supplemental 279,783 B
report listing 1 not in this run, history 281,541 / 285,295 / 285,669 B with
three Trends rows and CI Markdown 482 B. All 123 scenario source lines equal
`spec.file:spec.line` byte-for-byte and stay relative; the final statuses are
121 passed and 2 skipped, every scenario start date matches its final result,
the header is `2026-11-25 00:01 UTC` and no `1970` appears. No local user name,
`file:` URL or absolute path appears in HTML, JSON, Markdown, the 16,157 copied
characters or the visible text, and the clean run has no copy surface. Two
renders are byte-identical (SHA-256
`b9475ab862405ec4557432aa42ae5d8cc5587a66f66b85c606de14fd02b9aa1f`), the
feature/matrix/tag order equals the prior host report, tags are UTF-16 sorted,
and a single input has no source strip. Attachment parity 4/4/4; the native
Playwright HTML is 855,603 B and matches 123 tests / 121 passed / 0 failed /
0 flaky / 2 skipped across the three projects. Limits: the host uses its
deterministic local mock (no live TMDB) and the native report was compared by
content counts, not pixels.

**Spring PetClinic.** At `500158f` a full `mvn -B test` with Docker off wrote
18 Surefire XMLs / 1,089,965 B and ran 79 tests (77 passed, 2 skipped, 0 failed,
`BUILD SUCCESS`); `MySqlIntegrationTests` skips its two Docker tests and
`PostgresIntegrationTests` writes a zero-test document. The XML total above the
0.6.0 row is properties only (`java.class.path` and `surefire.test.class.path`
each carry the longer temp `m2` path, +4,245 B each). Tolkira on
`target/surefire-reports`: 20 features / 79 scenarios (77 passed, 2 skipped) /
79 step rows / 28 attachments / 67,650 B, default 277,371 B, static 259,208 B,
baseline 283,077 B (0 new failures, 77 fixed, 0 still failing, 0 not in this
run; CI line 76 B) and history 277,371 / 281,133 / 281,490 B with three
newest-first rows; `--json` is 44,076 B and `--ci markdown` 540 B. All 79
scenario names match the 80 Surefire `<testcase>` elements (the extra is the
zero-test placeholder) and `PostgresIntegrationTests` appears in neither JSON
nor HTML. Crafted entity cases: a bare `&` in an attribute or text, `&nbsp;` and
200 bare `&` each exit 1 with `invalid entity reference` and write no report;
the five named entities and `&#160;`, `&#xA0;`, `&#x1F600;` decode; rejection
leaves a pre-existing output file byte-identical. Display URIs are bare
`TEST-*.xml` for relative and absolute inputs, and the JSON and CI text have no
user name, `file:` or drive prefix. There is no date cell or Details date row
(header: `JUnit XML / Tolkira report`, `Tolkira report`, `20 features`,
`79 scenarios with results`, `Test time 6.79 s`, `JUnit XML`) and no `1970` in
HTML, JSON, CI or Trends. Feature, scenario, source, tag (0) and matrix (20
rows) order is identical between runs 1 and 3, and the JSON scenario order is
stable. Attachment parity 28/28/28. The baseline shows 77 fixed against the
0.6.0 row's 76 because that row does not record how its baseline was built; a
status flip of all 77 passed scenarios yields 77. The report is 3,529 B smaller
than the 0.6.0 row because the host's own `system-out` text is shorter, not
because of a shell change. Privacy is red only for nine copied Spring Boot
`system-out` lines naming the OS user (see the approved exception); copied
failure text was not exercised because no scenario failed. Limits:
Docker/Testcontainers off, native Surefire HTML not generated (content
comparison only).

**Cucumber-JVM.** At `f71480f`, module `calculator-java-junit-jupiter`, a
temp-only `cucumber.properties` (`cucumber.plugin=json:target/cucumber.json`,
restored afterwards): JDK 21.0.13.1 and Maven 3.9.9 ran 8/8 tests with
`BUILD SUCCESS`. The JSON is 14,625 B; three reruns gave 14,607-14,663 B, so the
earlier 14,760 B is a run-specific duration sample, not a content difference.
Tolkira: 3 features / 8 scenarios / 8 passed, 36 step rows (30 scenario + 6
background) and 18 hooks, 18 text attachments / 498 B, report 94,369 B, `--json`
11,145 B (SHA-256
`AC6CF0695FED8E0D3E7109B49D88E73028E30BC5173671E859CBAF3760EAB24C`), static
75,818 B, baseline 95,795 B / summary 11,385 B (0 new, 0 fixed, 0 still failing,
0 not in this run, 1 ambiguous legacy-JSON group; a supplemental three-failure
baseline reproduces the prior row's 3 fixed / 1 ambiguous), history
94,369 / 98,098 / 98,480 B with a 2,492 B sidecar and three newest-first rows,
CI Markdown 341 B. Every `classpath:com/example/...` URI is unchanged and no
drive path, `file:`, user name, `AppData` or temp root appears. There is no
header date and no `Started:` cell and no `1970`: the JVM JSON has scenario
`start_timestamp` values but no `options.startedAt`, and the hardened legacy
adapter invents no run date. Two default runs are byte-identical (SHA-256
`203640BDEBBB0AFCFAC72CBE1CA6F83F43DFDB49360B5BE2E36D26398EEAA8E5`) and the
three host reruns keep the same feature, tag, source and matrix order.
Attachment parity 18 / 498 B. Limits: Chromium only for this row; the artifact
has no absolute or file-URL URIs and no failing scenario, so the display-URI
rule and copied failure text were not exercised there.

**`0.7-tag-overview` host check (2026-11-26, pre-release tarball).** The change
touches the report shell only (a Details tag overview); the input adapters are
unchanged, so the five required rows reused the producer artifacts recorded for
`0.6.1-hardening` instead of re-running the host suites. Seed-Test pin `ce2cad8`
(AI branch): story 9,782 B, 1 feature / 3 scenarios (2 passed, 1 failed),
12 step rows, 1 attachment 5,234 B, report 90,559 B, static 71,172 B, tag panel
3 rows with the failing tag first; group 17,989 B, 2 features / 4 scenarios
(3 passed, 1 failed), 16 step rows, 2 attachments 10,468 B, report 109,258 B,
static 89,638 B, panel 4 rows. Cucumber-js `@cucumber/cucumber@13.3.0`:
`out.json` 3,302 B and `out.ndjson` 9,974 B, both 1 feature / 2 scenarios
(1 passed, 1 failed) / 5 steps / 2 inline PNGs 140 B, summaries byte-identical
(2,191 B), reports 72,411 / 72,687 B, static 53,157 / 53,433 B; untagged, so no
panel, no `.tagTable` and no tag CSS. Playwright movies-app pin `5d2cdf0`
(host 1.62.1, 232,903 B): 3 features / 123 scenarios (121 passed, 2 skipped),
236 step rows, 4 attachments 161 B, report 283,833 B, static 265,303 B, panel
6 rows (`@agent` 58/0/0, `@mocking` 4/0/0, `@fixme` 1/0/1, `@iframe` 1/0/0,
`@movies` 1/0/0, `@skip` 1/0/1). Spring PetClinic pin `500158f` (18 XMLs
937,554 B): 20 features / 79 scenarios (77 passed, 2 skipped), 79 step rows,
28 attachments 67,901 B, report 277,629 B, static 259,466 B; untagged, and the
zero-test `PostgresIntegrationTests` document appears in neither JSON nor HTML.
Cucumber-JVM pin `f71480f`, module `calculator-java-junit-jupiter` (14,760 B):
3 features / 8 scenarios / 8 passed, 36 step rows + 18 hooks, 18 attachments
498 B, report 96,017 B, static 77,466 B, one `@foo` row 6/0/0 (a duplicate tag
on one scenario dedupes). Every case: Chromium at 1440x900, 390x844 and
320x700 at 200 % text, print media and static; one `<main>`, no console or page
error, no http(s) request, no page-level horizontal overflow; the named
focusable tag region appears only with a tag panel, the panel is visible in
print and the table scrolls inside the wrapper at 320 px. No host exceeds 50
tags, so the cap sentence is correctly absent; unit and e2e cover that path.
The first pass ran on the pre-fix tarball (680,584 B, SHA-256 `8705B2AD...`);
the final pre-release tarball (`tolkira-0.6.1.tgz`, 680,642 B, SHA-256
`A1CB4936CE6D39A89E1DC9D3A03C958119CAB07D847841843B4D227222086EAC`) was
re-rendered for all seven inputs: every report matches the validated file except
the intended `tbody ` selector (+12 B) and the self-reported report size, and
the untagged reports are byte-identical. Limits: Chromium only, print checked by
media emulation, host suites not re-run.

**Approved exception - producer payload (2026-11-25).** The display-URI rule is
scoped to the URIs Tolkira renders itself. Two rows miss the literal "no local
user name in report/JSON/copied text" wording only through text the producer
wrote: the Cucumber-js failure stack (local user segment and
`C:\Users\<user>\...\steps.js:18:9` in the HTML error block and `data-search`,
the `--json` step message, the CI Markdown and the copied failure text) and nine
PetClinic `system-out` lines (`started by <user> in C:\Users\...`) copied into
attachment bodies. Both exist in the 0.5.1 and 0.6.0 reports, and the display
URIs themselves are clean. The maintainer approved the limit for 0.6.1 on
2026-11-25; `SECURITY.md` and `docs/LIMITATIONS.md` state it and B-068 tracks an
opt-in redaction mode. Apart from that payload, every host row passed.

**Final 0.6.1 artifact check (2026-11-25).** A clean export of the release-prep
commit (`7c32d41`) contains no `dist/`; `npm ci`, `npm run build` and
`npm pack` produced `tolkira-0.6.1.tgz` with 81 entries, 658,026 B and SHA-256
`3867F9AD5CACF8FAD142C7D04E8A460D989824C852D69CA382C4E0059FBEB4E0` (Windows
pack: Node 26.13.1, npm 10.8.2; the Linux CI pack hash will differ and is
recorded after the tag). A global install printed `0.6.1`, `--help` started with
`Usage: tolkira`, and the legacy `minimal.json` fixture rendered a 66,362 B
report containing `Minimal feature`. The tarball carries `dist/cli.js`,
`dist/index.js` and their type declarations, and no tests, fixtures, scripts,
openspec or lock file. The five required host rows above were run on the
pre-release tarball from `c791898`; `git diff c791898..HEAD -- src scripts
test/fixtures` is empty and the package manifests differ only in the version
literal, so those rows stand as this release's host evidence. No host row was
re-run on the 0.6.1 literal. The publish job now builds before it packs; the
workflow test fails if that step is missing or moved after `npm pack`.

## Release rule

Before a tag, stage or publish:

- run every required host row;
- record the host, pin, artifact and result in this page;
- a red host blocks the release or gets a written exception approved by the
  maintainer;
- re-run the rows affected by the release's changes, not only the happy path.

The same rule applies to a large feature touching an adapter, the report shell,
print, PDF, email or the compatibility shim.
