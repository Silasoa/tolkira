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

CI itself runs the check gate on Linux (Node 22/24/26), Windows (Node 22) and
macOS (browser and package). A Windows check failure blocks the workflow; the
host rows below remain separate, live-project evidence.

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
| Seed-Test | 2026-11-22 | Pass | Pin `ce2cad8` (AI branch), packed 0.5.0 tarball (557,569 B). `tsc -b` and `report.service.spec.ts` 35/35. The story (1 feature / 3 scenarios) and group (2 features / 4 scenarios) 0.5 reports show the `CI run` metadata link and the report-file, decoded-attachment and exact report-HTML rows; the group sidecar holds 2 stories. No overflow at 1440 or 390 and no console errors. The compat shim has no `--history`; live cucumber-js, the full backend and Linux/Node 22 remain unrun. |
| Cucumber-js host | 2026-11-22 | Pass | Official `@cucumber/cucumber@13.3.0` host artifacts rendered with the 0.5.0 CLI: 2 scenarios (1 passed/1 failed), 2 steps, 2 PNG attachments; legacy and Messages summaries identical (counts and 156 attachment bytes); size rows; no overflow at 1440 or 390. Shim ESM named/await and CJS are covered by the CI tests. |
| Playwright movies-app | 2026-11-22 | Pass | Pin `5d2cdf0`; 0.5.0 CLI over `playwright.json`: 8/8 tests, 36/36 steps, 3 attachments / 85 B; all 8 scenario source lines match the JSON locations; size rows; no retries or failures; no overflow at 1440 or 390; flaky 0. |
| Spring PetClinic | 2026-11-22 | Pass | Pin `500158f`; 0.5.0 CLI over the 12 Surefire XML files: 15 features / 59 scenarios / 59 passed, 9 attachments / 19,456 B; size rows; no overflow at 1440 or 390; all-green. |
| Cucumber-JVM examples | 2026-11-22 | Pass | Pin `f71480f`; 0.5.0 CLI over `cucumber.json`: 3 features / 9 scenarios / 52 results, all passed; 12 hook results / 372 B render as text attachments; size rows; no overflow at 1440 or 390; all-green. |
| `cucumber-html-reporter@7.2.0` reference | 2026-11-20 | Content PASS | Same fixture; screenshots at 1440/390; no visual parity; old install 144 packages / 7 vulnerabilities. The 0.5 shell was not compared to CHR. |

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
