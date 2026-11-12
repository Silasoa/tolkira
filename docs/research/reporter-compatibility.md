# Migration compatibility: cucumber-html-reporter → Tolkira

**Status:** 2026-11-03.
**Question:** can scripts keep options and swap renderers?

**Method:** read Tolkira's docs, CLI and adapter; installed both old
reporters into a temporary directory; inspected their published types, source
and READMEs; ran them against legacy fixtures on Node 26.13.0.

Sources:

- [`cucumber-html-reporter@7.2.0`](https://www.npmjs.com/package/cucumber-html-reporter/v/7.2.0),
  published 2024-10-01; [repository](https://github.com/gkushang/cucumber-html-reporter).
  Inspected `index.d.ts`, `lib/reporter.js`, `lib/jsonDir.js`, `README.md`.
- [`multiple-cucumber-html-reporter@4.5.0`](https://www.npmjs.com/package/multiple-cucumber-html-reporter/v/4.5.0),
  published 2026-10-18; [repository](https://github.com/WasiqB/multiple-cucumber-html-reporter).
  Inspected `dist/types.d.ts`, `dist/generate-report.js`, `dist/cli/index.js`, `README.md`.
- Tolkira: [`docs/PRODUCT.md`](../PRODUCT.md), [`docs/AGENT-INTERFACE.md`](../AGENT-INTERFACE.md),
  `src/cli.ts`, `src/index.ts`, `src/input/load.ts`, `src/input/legacy.ts`.

## 1. What the old reporter exposes

`cucumber-html-reporter@7.2.0` is CommonJS, has no CLI, and exports one function:
`generate(options, callback?)`. Users write a Node script after the Cucumber run.
`multiple-cucumber-html-reporter@4.5.0` is ESM, Node ≥ 22, and exports an async
`generate(options)`; it also ships an `mchr` CLI that reads a config file
(`.multiple-cucumber-html-reporter.json`, `.js`, `.ts` or `.yaml`).

Options:

| Option | Package | Default / behaviour |
| --- | --- | --- |
| `theme` | chr | **Required** by the type and by the template path; one of `bootstrap`, `hierarchy`, `foundation`, `simple`. Omitting it crashes. |
| `jsonFile` / `jsonDir` | chr | Input file or directory. `jsonDir` searches recursively and merges features by `uri`. |
| `output` | chr | Exact HTML file path. Parent directories are created. |
| `reportSuiteAsScenarios`, `scenarioTimestamp`, `columnLayout`, `failedSummaryReport` | chr | Layout switches; mostly bootstrap-only. |
| `storeScreenshots`, `screenshotsDirectory`, `noInlineScreenshots` | chr | Falsy; external screenshot files instead of inline images. |
| `launchReport` | chr | Falsy; opens the report in the default browser. |
| `ignoreBadJsonFile` | chr | Falsy; with `jsonDir`, skip empty/non-array JSON files. |
| `name`, `brandTitle` | chr | Project name (falls back to `package.json`) and report brand. |
| `metadata` | chr | Flat key/value metadata. |
| `jsonDir`, `reportPath` | mchr | Directory of legacy JSON and **output directory**. Both required. |
| `reportName`, `pageTitle` | mchr | Header name and HTML page title. |
| `metadata`, `customData`, `metadataFilePath` | mchr | Nested metadata, run info (project/release/build/environment), or metadata from a file. |
| `brandLogo`, `customStyle`, `customScript`, `overrideStyle` | mchr | Branding and custom assets. |
| `externalizeMedia` | mchr | Write image/video attachments to `assets/media/` instead of inlining. |
| `language` | mchr | `en`, `es`, `fr`, `ar`. |
| `emailReport`, `openReportInBrowser`, `useCDN`, `staticFilePath`, `saveCollectedJSON` | mchr | Extra artifacts / delivery modes. |
| `display*`, `duration*`, `hideMetadata`, `pageFooter`, `attachmentLayout`, `modal*` | mchr | Presentation controls. |

`customData` is mchr-only; `chr@7.2.0` lacks it.

Both expect the same legacy Cucumber JSON: a top-level array of features, each
with `uri` and `elements`; steps carry `result.status`, `result.duration`
(nanoseconds), `result.error_message`, and `embeddings[]` with `data` plus
`mime_type` or `media.type`. `cucumber-html-reporter` also mutates that array in
memory and writes `output + '.json'` when `jsonDir` is used.

## 2. What Tolkira already accepts

Tolkira reads that format. Probe:

- `chr@7.2.0` rendered `test/fixtures/legacy/happy.json` in all four themes;
  `mchr@4.5.0` rendered it from an isolated directory (38 KB `index.html`);
  Tolkira rendered it to 39 KB.
- `test/fixtures/legacy/screenshot.json` kept 3 attachments / 8,590 bytes, so
  base64 images survive.
- Tolkira was more tolerant than `mchr@4.5.0`, which crashed on
  `behave.json` with `scenario.description.replace is not a function` because a
  legacy description can be an array. Tolkira accepts `string | string[]`.

Gaps:

1. **Directory recursion.** Old `jsonDir` uses `find.fileSync(/\.json$/)`
   recursively. Tolkira's `loadEnvelopes` uses a non-recursive `readdir`. A JSON
   file one directory below the input produced `No supported report files found`.
2. **Output parent creation.** Old reporters create the output directory.
   Tolkira's `writeAtomic` assumes the parent exists. The shim must `mkdir -p`.

Differences: Tolkira's core is ESM and Node ≥ 22; `chr` is CommonJS with no
engine floor. From 0.3.0 the compat subpath also has a CommonJS `require`
wrapper; the core and CLI stay ESM-only. Tolkira caps inputs at 100 MB and
attachments at 50 MB each / 100 MB total, and always inlines attachments;
split assets are a later item.

## 3. Proposed shim

Do **not** transform the old generated HTML. It is a rendered artifact with
embedded Bootstrap/jQuery/chart state; parsing it is lossy, fragile and would
force Tolkira to clone old themes. The shim consumes the same **input JSON and
options object** and renders with Tolkira.

**Node helpers** (the import and call shape change):

```js
// before
const reporter = require('cucumber-html-reporter');
reporter.generate(options);

// after
import { generate } from 'tolkira/compat/cucumber-html-reporter';
await generate(options);
```

```ts
// before
import { generate } from 'multiple-cucumber-html-reporter';
await generate(options);

// after
import { generate } from 'tolkira/compat/multiple-cucumber-html-reporter';
await generate(options);
```

`generate` for the `chr` helper keeps the old `(options, callback?)` signature
and calls the callback with an error on failure. It is async: `await
generate(options)` returns `{ output, warnings, summary }`, the option type is
`CucumberHtmlReporterOptions`, and callers must read the HTML only after the
promise settles. In 0.3.0 a CommonJS `require` of this compat subpath is
available; 0.2.0 only has the ESM import. The core stays ESM-only.

**CLI** for config-driven runs:

```shell
tolkira compat cucumber-html-reporter --options ./report-options.json
tolkira compat multiple-cucumber-html-reporter --options ./.multiple-cucumber-html-reporter.json
```

Add `--out`, `--json`, `--dry-run` (print resolved inputs, options and warnings;
write nothing; JSON configs only in v0.1). `--dry-run` is the main migration aid.

### Mapping

| Old option | Tolkira mapping | Status |
| --- | --- | --- |
| `jsonFile`, `jsonDir` (chr); `jsonDir` (mchr) | positional `inputs` | Supported; shim recursively expands directories and applies `ignoreBadJsonFile`. If both `jsonFile` and `jsonDir` are set, use `jsonFile` and warn. |
| `output` (chr) | `--out` | Exact file path. |
| `reportPath` (mchr) | `--out <reportPath>/index.html` | Single file replaces the old folder. Warn that `features/` and `assets/` are not produced. |
| `brandTitle`, `name` (chr); `reportName`, `pageTitle` (mchr) | `--title` | Use `brandTitle`/`reportName` first, then `name`/`pageTitle`; warn when two values differ. Tolkira does not read `package.json`. |
| `metadata` (both), `customData` (mchr), `metadataFilePath` (mchr) | `--meta k=v` / `metadata` | Flatten known scalar fields (`browser`, `platform`, `app`, `device`, `projectName`, `release`, `testCycle`, `buildNumber`, `environment`, `ciPipeline`, …). Warn on per-feature metadata maps and array-shaped metadata. |
| `brandLogo` (mchr) | `--logo` / `logo` | Read the file, enforce Tolkira's type/2 MB validation. |

No old option maps to `--accent`; `--json` and `--max-size` are Tolkira-only
additions.

### Ignored options (warn once each, continue)

| Options | Reason |
| --- | --- |
| `theme`, `columnLayout`, `reportSuiteAsScenarios`, `scenarioTimestamp`, `failedSummaryReport` (chr); all `display*`, `duration*`, `attachmentLayout`, `modal*`, `pageFooter`, `plainDescription` (mchr) | Presentation choices with no Tolkira equivalent. Tolkira always shows scenario and feature counts and uses its own shell. |
| `storeScreenshots`, `screenshotsDirectory`, `noInlineScreenshots` (chr); `externalizeMedia` (mchr) | The input JSON still contains the embedding bytes, so no screenshots are lost; Tolkira always inlines them. Warn about report size and the 10 MB `--max-size` warning. Split assets are later. |
| `launchReport` (chr); `openReportInBrowser` (mchr) | Tolkira never opens a browser. |
| `customStyle`, `customScript`, `overrideStyle` (mchr) | Custom JS/CSS conflicts with the CSP/security baseline. |
| `language` (mchr) | English-only in v0.1. |
| `emailReport` (mchr) | Email/PDF is later. |
| `useCDN`, `staticFilePath` (mchr) | Tolkira is always one offline file. |
| `saveCollectedJSON` (mchr) | No merged JSON side effect in v0.1. |
| `customMetadata` array (mchr) | No per-feature metadata model. |
| `theme` templates / `templateDir` (chr) | Undocumented template override; out of scope. |

Unknown keys are warned and ignored.

**Warnings contract:** every ignored or approximated option produces one line
`compat: warning: <source option>: <reason>` on stderr. Exit codes stay
Tolkira's: 0 for a generated report even when tests failed, 1 for parse/render
failure, 2 for invalid usage. Warnings never change the exit code.

**Deprecation:** mark `tolkira/compat/*` experimental in v0.1, freeze the
option set, and add no features to it. Review at v1.0; remove no earlier than two
minor releases after a deprecation notice. Publish the mapping table as a docs
page, not only in release notes.

## 4. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Visual parity is impossible; old themes/charts will look different. | High | Say so early; offer `--dry-run`. Do not clone themes. |
| Inline-only attachments enlarge reports; size caps can reject runs the old reporter accepted. | High | Warn on external-media options; document caps; split assets later. |
| mchr produces a multi-page site; the shim produces only `index.html`. | Medium | Write `<reportPath>/index.html`; warn that deep links and `assets/` are gone. |
| `jsonDir` recursion and `ignoreBadJsonFile` semantics differ. | Medium | Shim expands directories and filters bad files; test nested/malformed fixtures. |
| Old `chr` scripts are CommonJS and synchronous; Tolkira is async and Node ≥ 22. The compat `require` path exists from 0.3.0, not in 0.2.0. | Medium | Document the named import/require, the `await` and the Node 22 requirement; ship the wrapper for the compat subpath only. |
| Tolkira validates statuses/shapes more strictly; old `chr` maps unknown statuses to skipped. | Medium | Keep validation; report file/field; add quirk fixtures. |
| Users may expect the old merged `output + '.json'` file. | Low | Warn; defer `--save-json`. |

## 5. Recommendation

**v0.1 shim:**

1. Shared mapper + warning collector.
2. `tolkira/compat/cucumber-html-reporter` and
   `tolkira/compat/multiple-cucumber-html-reporter` Node helpers.
3. Recursive directory expansion, `mkdir -p`, `ignoreBadJsonFile` filtering,
   metadata flattening, title/logo mapping.
4. `tolkira compat <reporter> --options <json>` with `--dry-run`.
5. One docs page with the mapping table.

**Defer:** external screenshots/split assets, themes/charts, custom CSS/JS,
i18n, email reports, browser launch, merged-JSON output, and any transformation
of old HTML. Revisit after later split-assets work, which removes the largest
behavioural gap.
