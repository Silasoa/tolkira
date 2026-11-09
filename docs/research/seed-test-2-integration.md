# Seed-Test 2.0 integration plan for Tolkira

**Status:** 2026-11-09. Research note, not a product commitment.
**Target:** Seed-Test branch `AI-integration-prototype`, commit
`ce2cad890bfda23f49cb9b2c47182f49df846f20` (2026-11-02), backend version
2.0.0.
**Tolkira:** 0.1.2, compat entry point
`tolkira/compat/cucumber-html-reporter`.
**Method:** source inspection of the branch, a `npm pack` install in a temporary
project, probes on Node 22.23.4, 24.22.2 and 26.13.0, and a TypeScript compile
with Seed-Test's `NodeNext` settings (TypeScript 6.0.3). No Seed-Test or Tolkira
production files were edited.

## 1. What is actually on GitHub

There is no `2.0.0/dev/AI` branch. The branch that matches the stated 2.0.0 ESM
direction is `AI-integration-prototype`; the `dev` branch is still backend
1.8.1, CommonJS. This guide assumes `AI-integration-prototype` is the intended
2.0 branch. If that assumption is wrong, the ESM direction still applies, but
the exact file locations must be re-checked.

On this branch:

- `backend/package.json` has `"type": "module"`, version `2.0.0`, Node engines
  `^22.23.4 || ^24.22.1 || ^26.12.1`, and still depends on
  `cucumber-html-reporter@^7.2.0`.
- `backend/tsconfig.json` uses `module: NodeNext`,
  `moduleResolution: NodeNext`, `target: es2024`, `strict: true`,
  `preserveSymlinks: true`.
- `backend/src/helpers/reporting.ts` no longer exists. Its report-generation
  logic moved to `backend/src/services/report.service.ts`. The old file is
  still on `master`; the sidecar behaviour described below is the same.
- The CI workflow `.github/workflows/CI_Tests_and_Report.yaml` runs the Docker
  stack on Node 22, 24 and 26.
- `backend/Dockerfile` runs `npm ci --ignore-scripts -w backend -w shared`
  from the repository root, so the root `package-lock.json` must stay in sync.

## 2. Exact import and call shape

Tolkira's compat entry point has a named export and is asynchronous. It is
ESM-only; there is no default export and no CommonJS `require` condition in the
package `exports` map.

```ts
import {
  generate,
  type CucumberHtmlReporterOptions,
  type CompatResult,
} from 'tolkira/compat/cucumber-html-reporter';

const options: CucumberHtmlReporterOptions = {
  theme: 'bootstrap',
  jsonFile: 'features/report.json',
  output: 'features/report.html',
  name: 'Seed-Test Report: report',
  metadata: { Platform: process.platform },
};

const result: CompatResult = await generate(options);
// result.output, result.warnings, result.summary are now available,
// and the HTML file is complete.
```

The callback form still exists (`generate(options, callback)`), but Seed-Test
does not need it. The promise is the primary contract.

Node 22.23.4 is the oldest Node version in Seed-Test's engine range and is
supported by Tolkira (`engines.node >= 22`). The probe ran on 22.23.4, 24.22.2
and 26.13.0 with identical results.

## 3. Options Seed-Test passes and how they map

`setHtmlOptions` in `backend/src/services/report.service.ts` builds this object:

```ts
{
  theme: 'bootstrap',
  output: '<dir>/<reportName>.html',
  reportSuiteAsScenarios: true,
  launchReport: false,
  storeScreenshots: false,
  screenshotsDirectory: 'features/screenshots/',
  metadata: {
    'App Version': '1.8.1',
    'Test Environment': 'STAGING',
    Parallel: 'Scenarios',
    Executed: 'Remote',
    Platform: process.platform,
  },
  name: 'Seed-Test Report: <reportName>',
  jsonFile: '<reportName>.json',   // story/scenario mode
  jsonDir: '<group directory>',    // group mode, jsonFile is undefined
}
```

| Seed-Test value | Tolkira behaviour |
| --- | --- |
| `jsonFile` | Single input file. |
| `jsonDir` | Directory scanned recursively for `.json` files. |
| `output` | Exact HTML path. Missing parent directories are created. |
| `name` | Report title. `brandTitle` would win if both were set; Seed-Test does not set it. |
| `metadata` | Flat string/number/boolean values become report metadata. Seed-Test's five values are all strings. |
| `theme: 'bootstrap'` | Warned and ignored; Tolkira uses its own shell. |
| `reportSuiteAsScenarios: true` | Warned and ignored. |
| `screenshotsDirectory` | Warned and ignored; attachments stay inline. |
| `launchReport: false` | No warning; Tolkira never opens a browser. |
| `storeScreenshots: false` | No warning; Tolkira always inlines attachments. |
| `ignoreBadJsonFile` | Not passed. Seed-Test repairs corrupt JSON before calling the reporter. |
| Unknown keys | Warned once each when truthy, then ignored. |

The table describes the shim's native handling. In the recommended group fix
below, Seed-Test replaces `jsonDir` with `jsonFile` pointing at the merged
sidecar, so the directory scan is not used for group reports.

Warnings are returned in `result.warnings`; they are not printed by Tolkira.
Seed-Test currently ignores the return value. Log them in `generateHtmlReport`
so ignored options are visible:

```ts
const result = await generate(reportOptions);
for (const warning of result.warnings) logger.warn(`Tolkira: ${warning}`);
```

The visual result is not the old Bootstrap report. Tolkira's report shell and
Details view replace the old theme. That is a product decision, not a bug.

## 4. Group mode and the `output + '.json'` sidecar

This is the only part that needs more than an import and an `await`.

### Current flow

Cucumber writes one JSON report per story into the group directory:

```text
features/<group>/
  <reportName-story-a>.json
  <reportName-story-b>.json
```

`resolveAndSaveReport` computes:

```ts
jsonPath = path.join(reportPathBase, groupDirName, `${groupDirName}.html.json`);
```

and calls `generateHtmlReport(groupDirName, jsonPath, true)`. With the old
reporter, `jsonDir` mode merges all per-story JSON files and writes a sidecar at
`output + '.json'`:

```text
output   = features/<group>/<group>.html
sidecar  = features/<group>/<group>.html.json   // == jsonPath
```

Seed-Test then reads that sidecar in two places:

- `analyzeGroupReport` reads `jsonPath` to compute status, scenario counts and
  step counts.
- `uploadReport` reads `reportOptions.jsonFile`, which
  `resolveAndSaveReport` explicitly sets to `jsonPath` for group reports, and
  stores it in MongoDB.

The HTML file is read separately in `handleReportResult` from
`features/<group>/<group>.html`.

### What Tolkira does

Tolkira's compat shim generates the group HTML from the directory, but it does
not write `output + '.json'`. The probe confirmed this:

```text
features/<group>/
  <group>.html
  story-a.json
  story-b.json
  (no <group>.html.json)
```

Consequences without a fix:

- The group HTML is generated and returned to the frontend, so the visible
  report works.
- `analyzeGroupReport` fails to read the sidecar, catches `ENOENT`, and returns
  a `GroupReport` with `status: false`, no `storyStatuses` and zero counts.
- `uploadReport` logs "Report JSON not available ... storing metadata only".
- Group status, report history and issue-tracker comments are wrong even though
  the HTML looks fine.

This is a major integration gap, not a rendering failure.

### Smallest fix: build the sidecar in Seed-Test

Rebuild the old reporter's merged file before rendering, then feed it to
Tolkira as a single `jsonFile`. This matches the old `jsonDir` merge semantics
and avoids Tolkira scanning the sidecar as an extra input.

```ts
if (isGroup) {
  const groupDir = reportOptions.jsonDir ?? path.dirname(jsonPath);
  const validCount = validateReportJsonFiles(groupDir);
  if (validCount === 0) {
    logger.error(`No valid JSON report files found for group ${reportName}`);
    return null;
  }

  // cucumber-html-reporter's jsonDir mode wrote this merged sidecar.
  // Tolkira does not, so create it before rendering.
  const merged: unknown[] = [];
  for (const file of fs.readdirSync(groupDir)) {
    const fullPath = path.join(groupDir, file);
    if (!file.endsWith('.json') || path.resolve(fullPath) === path.resolve(jsonPath)) {
      continue;
    }
    merged.push(...(JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown[]));
  }
  fs.writeFileSync(jsonPath, JSON.stringify(merged), 'utf8');

  reportOptions.jsonFile = jsonPath;
  reportOptions.jsonDir = undefined;
}
```

`jsonPath` is already `output + '.json'`, so no new path convention is
introduced. `validateReportJsonFiles` still repairs truncated files first.

Why pre-merge instead of writing the sidecar after Tolkira runs:

- Tolkira would otherwise see both the per-story files and the sidecar on a
  retry and count features twice.
- Tolkira treats multiple input files as multiple input groups and adds a
  provenance block. The probe measured 67,516 bytes for the directory input
  versus 66,704 bytes for the single merged input. Pre-merge matches the old
  reporter's merged-array result.
- Seed-Test already needs an async change, so the merge helper is a small
  addition rather than a second architectural change.

### Alternative: write the sidecar in the compat shim

A Tolkira-side change is possible in `src/compat/cucumber-html-reporter.ts`:
after `resolveInputs`, merge the arrays and `writeAtomic(output + '.json', ...)`
when `jsonDir` is set. This would make group mode work with only the async
change in Seed-Test.

It is not recommended for this integration:

- `docs/COMPATIBILITY.md` explicitly says Tolkira does not write the sidecar.
  Adding it changes the compat contract and needs tests and documentation.
- It can duplicate features when an old sidecar already exists in the directory.
- It adds a large in-memory merge to the shim for one legacy side effect.
- Seed-Test must change anyway for `await`; the sidecar merge is the smaller
  total diff.

Choose the shim route only if Seed-Test must stay untouched apart from the
import and `await`.

## 5. Error handling and waiting for the report

`generate` rejects on missing input, invalid JSON, render failure or write
failure. It resolves only after the HTML file is complete.

Required call-site changes:

- `generateHtmlReport` becomes `async` and awaits `generate`.
- `resolveAndSaveReport` awaits `generateHtmlReport` in both the group and
  non-group branches.
- `report.controller.regenerateReport` awaits `generateHtmlReport` before
  reading the HTML.
- `handleReportResult` already runs after `await resolveAndSaveReport`, so once
  the service awaits generation, the subsequent `fs.promises.readFile(htmlPath)`
  sees the finished file.

If any call site is left synchronous, the HTML read races the renderer. The
observed failure mode is `ENOENT` on the HTML path and a 500 response. A
floating promise also loses the error path if `generateHtmlReport` throws
before its own `try/catch`.

Seed-Test's existing `try/catch` in `generateHtmlReport` still works:

```ts
try {
  await generate(reportOptions);
  return reportOptions;
} catch (e) {
  logger.error(`Could not generate HTML Report for ${reportName}. Error: ${String(e)}`);
  return null;
}
```

This preserves the current behaviour: a failed HTML render does not abort the
analysis/upload path. For non-group reports, the JSON is still available, so
status analysis can still succeed. For group reports, the sidecar is written
before rendering, so analysis can still succeed; the HTML read in
`handleReportResult` is the step that fails if rendering failed.

The shim writes atomically and creates parent directories, so Seed-Test does
not need its own `mkdir -p`.

## 6. Node and TypeScript settings

Seed-Test's backend settings are already correct for Tolkira:

- `"type": "module"` in `backend/package.json`.
- `module: NodeNext`, `moduleResolution: NodeNext` in
  `backend/tsconfig.json`.
- `target: es2024`; Tolkira emits ES2022-compatible code, so this is not a
  problem.
- Node engines include 22.23.4, 24.22.1 and 26.12.1. Tolkira requires Node 22
  or later.

Things to watch:

- Tolkira's `exports` map has only `import` and `types` conditions. Do not use
  `require('tolkira/...')`; it will fail.
- `verbatimModuleSyntax` is not enabled in Seed-Test. Type-only imports are
  erased normally. If it is enabled later, keep `import type` for
  `CucumberHtmlReporterOptions`.
- `preserveSymlinks: true` is set. Install Tolkira from the registry or a
  packed tarball, not through a symlinked `npm link`/workspace link, unless
  that combination has been tested.
- `backend/Dockerfile` uses root `npm ci`; update the root `package-lock.json`
  together with the backend dependency. An out-of-sync lockfile fails the
  Docker build before any tests run.
- The CI matrix runs Node 22, 24 and 26. The local probe covered 22.23.4,
  24.22.2 and 26.13.0. Linux was not run locally.

## 7. Minimal Seed-Test diff sketch

This is a sketch only. No production file was changed. It assumes
`tolkira@^0.1.2` is published or installed from a packed tarball.

### `backend/package.json`

```diff
-    "cucumber-html-reporter": "^7.2.0",
+    "tolkira": "^0.1.2",
```

Remove the now-dead root override in `package.json`:

```diff
-  "_comment": "Bitte bei cucumber-html-reporter > 7.2.0 wieder entfernen!",
-  "overrides": {
-    "cucumber-html-reporter": {
-      "@cucumber/cucumber": "^13.3.0",
-      "semver": "^7.5.2"
-    }
-  }
```

Then regenerate the root `package-lock.json` (`npm install` at the repository
root). Do not hand-edit the lockfile.

### `backend/src/services/report.service.ts`

```diff
-import reporter from 'cucumber-html-reporter'; // Import the reporter
+import {
+  generate,
+  type CucumberHtmlReporterOptions,
+} from 'tolkira/compat/cucumber-html-reporter';
@@
-const baseHtmlReporterOptions = {
+const baseHtmlReporterOptions: CucumberHtmlReporterOptions = {
@@
-function setHtmlOptions(reportName: string, jsonPath: string, isGroup: boolean = false): reporter.Options {
-	const myOptions = JSON.parse(JSON.stringify(baseHtmlReporterOptions)) as reporter.Options;
+function setHtmlOptions(reportName: string, jsonPath: string, isGroup: boolean = false): CucumberHtmlReporterOptions {
+	const myOptions = JSON.parse(JSON.stringify(baseHtmlReporterOptions)) as CucumberHtmlReporterOptions;
@@
-export function generateHtmlReport(reportName: string, jsonPath: string, isGroup: boolean = false): reporter.Options | null {
+export async function generateHtmlReport(reportName: string, jsonPath: string, isGroup: boolean = false): Promise<CucumberHtmlReporterOptions | null> {
 	const reportOptions = setHtmlOptions(reportName, jsonPath, isGroup);
 	try {
 		if (isGroup) {
 			// Validate JSON files before generation — removes truncated files that would crash the reporter
 			const groupDir = reportOptions.jsonDir ?? path.dirname(jsonPath);
 			const validCount = validateReportJsonFiles(groupDir);
 			if (validCount === 0) {
 				logger.error(`No valid JSON report files found for group ${reportName}`);
 				return null;
 			}
+			// cucumber-html-reporter's jsonDir mode wrote this merged sidecar.
+			// Tolkira does not, so create it before rendering.
+			const merged: unknown[] = [];
+			for (const file of fs.readdirSync(groupDir)) {
+				const fullPath = path.join(groupDir, file);
+				if (!file.endsWith('.json') || path.resolve(fullPath) === path.resolve(jsonPath)) continue;
+				merged.push(...(JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown[]));
+			}
+			fs.writeFileSync(jsonPath, JSON.stringify(merged), 'utf8');
+			reportOptions.jsonFile = jsonPath;
+			reportOptions.jsonDir = undefined;
 		} else 
 			// Validate single JSON file before generation
 			JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
 		
-		reporter.generate(reportOptions);
+		await generate(reportOptions);
 		logger.info(`Generated HTML report at: ${reportOptions.output}`);
 		return reportOptions;
 	} catch (e) {
 		logger.error(`Could not generate HTML Report for ${reportName}. Error: ${String(e)}`);
 		return null;
 	}
@@
-		generateHtmlReport(groupDirName, jsonPath, true);
+		await generateHtmlReport(groupDirName, jsonPath, true);
@@
-		generateHtmlReport(reportName, jsonPath, false);
+		await generateHtmlReport(reportName, jsonPath, false);
```

### `backend/src/controllers/report.controller.ts`

```diff
-		reportService.generateHtmlReport(reportName, tempJsonPath);
+		await reportService.generateHtmlReport(reportName, tempJsonPath);
```

### `backend/src/models/models.ts`

```diff
-import type { Options as HtmlReporterOptions } from 'cucumber-html-reporter';
+import type { CucumberHtmlReporterOptions } from 'tolkira/compat/cucumber-html-reporter';
@@
-	reportOptions!: HtmlReporterOptions & Record<string, unknown>;
+	reportOptions!: CucumberHtmlReporterOptions & Record<string, unknown>;
```

### `backend/src/types/report.types.ts`

```diff
-import type reporter from 'cucumber-html-reporter';
+import type { CucumberHtmlReporterOptions } from 'tolkira/compat/cucumber-html-reporter';
@@
-	reportOptions?: reporter.Options & Record<string, unknown>;
+	reportOptions?: CucumberHtmlReporterOptions & Record<string, unknown>;
```

### Tests that must follow

`backend/src/services/report.service.spec.ts` currently mocks
`cucumber-html-reporter` as a default export and calls `generateHtmlReport`
without `await`. Change the mock to the named Tolkira export and await the
async calls:

```diff
-vi.mock('cucumber-html-reporter', () => ({ default: mockReporter }));
+vi.mock('tolkira/compat/cucumber-html-reporter', () => ({ generate: mockReporter.generate }));
```

```diff
-const result = reportService.generateHtmlReport('test', '/features/test.json', false);
+const result = await reportService.generateHtmlReport('test', '/features/test.json', false);
```

The existing `fs` mock already provides `readdirSync`, `readFileSync` and
`writeFileSync`, so the merge helper can be exercised without touching the real
filesystem.

## 8. Test harness sketch

The probe used a packed Tolkira tarball, not the repository source. This proves
the published entry point and `exports` map, not just the local build.

```shell
npm pack --pack-destination /tmp/tolkira-probe
mkdir /tmp/tolkira-probe/app && cd /tmp/tolkira-probe/app
npm init -y
npm pkg set type=module
npm install ../tolkira-0.1.2.tgz
node probe.mjs
```

```js
// probe.mjs
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { generate } from 'tolkira/compat/cucumber-html-reporter';

const fixtures = '/path/to/tolkira/test/fixtures/legacy';
const out = path.resolve('out/story.html');

const result = await generate({
  theme: 'bootstrap',
  jsonFile: path.join(fixtures, 'happy.json'),
  output: out,
  reportSuiteAsScenarios: true,
  launchReport: false,
  storeScreenshots: false,
  screenshotsDirectory: path.resolve('out/screenshots/'),
  metadata: {
    'App Version': '1.8.1',
    'Test Environment': 'STAGING',
    Parallel: 'Scenarios',
    Executed: 'Remote',
    Platform: process.platform,
  },
  name: 'Seed-Test Report: story',
});

const html = await readFile(out, 'utf8');
console.log({
  bytes: html.length,
  hasHtml: /<!doctype html>/i.test(html),
  scenarios: result.summary.counts.scenarios.total,
  warnings: result.warnings,
  sidecar: await readdir(path.dirname(out)),
});
```

Group probe:

```js
// Copy two legacy fixtures into out/group as per-story JSON files first.
const groupDir = path.resolve('out/group');
const groupOut = path.join(groupDir, 'group_My_Group_123.html');

const group = await generate({
  theme: 'bootstrap',
  jsonDir: groupDir,
  output: groupOut,
  name: 'Seed-Test Report: group_My_Group_123',
});

console.log({
  bytes: (await readFile(groupOut, 'utf8')).length,
  files: await readdir(groupDir),
  // Expect no group_My_Group_123.html.json here.
});
```

Observed results:

| Probe | Node | Result |
| --- | --- | --- |
| Single legacy file | 22.23.4, 24.22.2 and 26.13.0 | 65,252-byte HTML, 6 scenarios / 30 steps, 3 warnings, no sidecar. |
| Group directory, Tolkira only | 22.23.4, 24.22.2 and 26.13.0 | 67,516-byte HTML, no `<group>.html.json`. |
| Group pre-merge, then Tolkira | 22.23.4 | 66,704-byte HTML, sidecar with 2 features / 7 scenarios / 31 steps. |
| TypeScript Seed-Test shape | TypeScript 6.0.3 and 7.0.2 | `tsc` with `NodeNext`, `target es2024`, `strict`, `preserveSymlinks` passed. |
| Old reporter reference | 26.13.0 | `cucumber-html-reporter@7.2.0` wrote `group_My_Group_123.html.json` with 2 features. |

The single-file probe's warnings were exactly the expected three:
`theme`, `reportSuiteAsScenarios` and `screenshotsDirectory`.

What was not run:

- The full Seed-Test backend with MongoDB, authentication and browser runners.
- A real `runGroup` / `runSanityTest` request through Seed-Test.
- The Seed-Test unit suite after the diff, because this research task is
  read-only for production files.
- Linux. The probe ran on Windows with Node 22.23.4, 24.22.2 and 26.13.0.
- `npm ci` with an updated lockfile and the Docker build.

## 9. Blockers, majors and minors

**Blockers if left unchanged**

1. **Async call shape.** `generate` returns a promise. Every
   `generateHtmlReport` call must be awaited. Without it, Seed-Test reads the
   HTML before it exists and returns a 500.
2. **ESM named import and types.** `cucumber-html-reporter`'s default import and
   `reporter.Options` type must be replaced. Tolkira has no default export and
   no CommonJS entry point.

**Major**

1. **Group sidecar.** Tolkira does not write `output + '.json'`. Group HTML
   works, but status analysis, report history and MongoDB report data are wrong.
   The Seed-Test pre-merge is the smallest fix.
2. **Dependency and lockfile.** Replacing the dependency requires a root
   `package-lock.json` update. The Docker build uses `npm ci`, so an out-of-sync
   lockfile is a hard CI failure.

**Minor**

1. **Warnings are invisible.** Tolkira returns ignored-option warnings; log
   `result.warnings` if users should see why `theme` and
   `reportSuiteAsScenarios` have no effect.
2. **Visual change.** The old Bootstrap theme is gone. This is expected but
   user-visible.
3. **Directory scan.** Tolkira scans `jsonDir` recursively and has no
   `ignoreBadJsonFile` in Seed-Test's call. Seed-Test repairs parse errors
   first, so this is covered for normal Cucumber output.
4. **Sidecar ordering.** Pre-merge avoids Tolkira reading the sidecar as a
   second input. If the sidecar is written after generation instead, a retry
   in the same directory can duplicate features.
5. **Linux not locally tested.** The code uses `path.join`/`path.resolve` and
   Node 22 APIs; the CI matrix covers Linux on Node 22, 24 and 26.

## Sources inspected

- Tolkira: `docs/COMPATIBILITY.md`, `docs/research/reporter-compatibility.md`,
  `src/compat/cucumber-html-reporter.ts`, `src/compat/options.ts`,
  `src/input/files.ts`, `src/output.ts`, `src/index.ts`, `package.json`,
  `test/compat.test.ts`.
- Seed-Test: branch `AI-integration-prototype` at commit `ce2cad8`,
  `backend/package.json`, `backend/tsconfig.json`,
  `backend/src/services/report.service.ts`,
  `backend/src/controllers/report.controller.ts`,
  `backend/src/controllers/testExecution.controller.ts`,
  `backend/src/controllers/sanity.controller.ts`,
  `backend/src/testing/test-runner.service.ts`,
  `backend/src/models/models.ts`, `backend/src/types/report.types.ts`,
  `backend/Dockerfile`, `.github/workflows/CI_Tests_and_Report.yaml`.
- Reference run: `cucumber-html-reporter@7.2.0` in a temporary project with two
  legacy fixtures, confirming `output + '.json'`.

## 10. Verdict

Seed-Test 2.0 can use Tolkira with a small Seed-Test change. The shim does not
need new work for single-story, scenario or story mode.

The unavoidable Seed-Test work is:

- replace the default `cucumber-html-reporter` import with Tolkira's named
  `generate`;
- make `generateHtmlReport` async and await it at its three call sites;
- replace the `reporter.Options` type references in `report.service.ts`,
  `models.ts` and `report.types.ts`;
- build the group sidecar before rendering;
- update the dependency and lockfile.

That is roughly 30–50 lines of production code plus the lockfile, with no
Tolkira source change. The alternative is to add sidecar writing to Tolkira's
compat shim, which would shrink the Seed-Test diff but expand Tolkira's
documented contract and still require the async Seed-Test change.

The integration is therefore viable as a Seed-Test-led change. It is not a
zero-change drop-in because of the async contract and the group sidecar.
