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
   - attachments/screenshots, including inline images;
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
| Seed-Test | 2026-11-20 static + 2026-11-21 compat probe | Blocked on real data | ESM AI branch: `import reporter from 'tolkira/compat/...'` fails at module linkage (`does not provide an export named 'default'`); a namespace import without `await` races and crashes on errors. Group mode now gets `output + '.json'` from the shim (B-032 resolved; matches the probe output with `retried: 0`; the old filename-derived retry counter is not reproduced). The second same-directory run, subdirectory sidecar and strict-path collision behavior are covered by `test/compat-sidecar.test.ts`; no live Seed-Test group run yet. `ignoreBadJsonFile: true` skips an invalid reserved-path file and replaces the sidecar; the strict path refuses unchanged before the HTML. Needs `features/<name>.json` or a running stack. |
| Cucumber-js host | 2026-11-21 | Pass | 2 scenarios (1 passed/1 failed), 2 steps, 2 PNG attachments; legacy and Messages summaries byte-identical; shim ESM named/await and CJS callback both work; warnings for `theme`, `reportSuiteAsScenarios` and `screenshotsDirectory`; metadata and images render. The group sidecar, second-run replacement and strict-path refusal are covered by the shim tests; the live host run was single-file, not a second group run. |
| Playwright movies-app | 2026-11-21 | Pass with documented gaps | 8 tests / 9 executions; 7 passed / 1 failed (host test rot: TMDB images missing). Final attempt, projects, failure text, screenshots/video/error-context, rule path and counts match; the scenario and feature source labels are covered by the unit render test (B-035 resolved), host row not re-run. Gaps: no retry history, failed results lose their steps upstream in Playwright 1.62, no trace viewer, no git metadata. |
| Spring PetClinic | 2026-11-21 | Pass with grouping gap | 59 tests / 12 features (Surefire has 15 class rows because nested `Outer$Nested` classes are folded into the outer feature; B-036). Counts match; duration is the sum of testcase times vs Surefire's suite wall time (B-037 documented in `docs/JUNIT-XML.md`). All selected tests passed; failure/error/skip rendering not exercised. |
| Cucumber-JVM examples | 2026-11-21 | Pass with adapter fix | 3 features / 9 scenarios / 52 step results; hooks, backgrounds, tags, outline expansion and nanoseconds correct. Cucumber-JVM `name` on attachments is now mapped; hook output is not rendered (B-034). The host is all-green, so failure/skip/retry coverage stays limited. |
| `cucumber-html-reporter@7.2.0` reference | 2026-11-20 | Content PASS | Same fixture; screenshots at 1440/390; no visual parity; old install 144 packages/7 vulnerabilities. |

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
