# Migration from cucumber-html-reporter

**Status: experimental.** The compatibility subpath accepts the legacy options
object and renders with Tolkira. It is a migration aid, not a promise of visual
parity.

## Before and after

```js
// before
const reporter = require('cucumber-html-reporter');

reporter.generate({
  theme: 'bootstrap',
  jsonFile: 'reports/cucumber.json',
  output: 'reports/report.html',
  brandTitle: 'Checkout acceptance',
  metadata: { Browser: 'Chrome', Environment: 'Staging' },
});
```

```js
// after
import { generate } from 'tolkira/compat/cucumber-html-reporter';

await generate({
  theme: 'bootstrap',
  jsonFile: 'reports/cucumber.json',
  output: 'reports/report.html',
  brandTitle: 'Checkout acceptance',
  metadata: { Browser: 'Chrome', Environment: 'Staging' },
});
```

Only the import changes. `theme` is ignored with a warning; everything else
maps to Tolkira. The callback form still works:

```js
generate(options, (error) => {
  if (error) console.error(error);
});
```

## Mapping

| Old option | Tolkira behaviour |
| --- | --- |
| `jsonFile` | Input file. |
| `jsonDir` | Directory scanned recursively for `.json` files. |
| `output` | Exact HTML path; missing parent directories are created. |
| `brandTitle` / `name` | Report title. `brandTitle` wins if both differ. |
| `metadata` | Flat string/number/boolean values become report metadata. |
| `ignoreBadJsonFile` | Invalid or non-array `.json` files are skipped with a warning. |
| `theme` | Warned, ignored. Tolkira uses its own theme. |
| `reportSuiteAsScenarios`, `scenarioTimestamp`, `columnLayout`, `failedSummaryReport` | Warned, ignored. |
| `storeScreenshots`, `screenshotsDirectory`, `noInlineScreenshots` | Warned, ignored; attachments stay inline. |
| `launchReport` | Warned, ignored; Tolkira never opens a browser. |
| Unknown keys | Warned once, ignored. |

`jsonFile` wins when both `jsonFile` and `jsonDir` are set. If both are missing,
generation fails with a usage error.

## What is not reproduced

- **Themes and charts.** The old Bootstrap, hierarchy and Foundation themes are
  not cloned. The report keeps Tolkira's simple shell and Details view.
- **External screenshots.** `storeScreenshots`, `screenshotsDirectory` and
  `noInlineScreenshots` are ignored because Tolkira always inlines attachments.
  Very large runs can hit the 10 MB size warning; split assets are a v0.2 item.
- **The old rendered HTML.** The shim consumes the input JSON and options, not
  the generated HTML. If you only have the old HTML, export the JSON again.
- **The `output + '.json'` side effect.** Tolkira does not write a merged JSON
  copy next to the report.
- **Custom CSS/JS, i18n, email reports, CDN mode and browser launch.** These
  conflict with the single-file, no-network baseline or are out of scope.

## Limits

- The shim accepts legacy Cucumber JSON. It does not turn Messages into legacy
  JSON or vice versa.
- The usual Tolkira limits apply: 100 MB total input, 50 MB per attachment,
  100 MB total attachments.
- The shim is experimental. The option set is frozen; new features are added to
  the core CLI/API, not to the shim.

## `multiple-cucumber-html-reporter`

A dedicated MCHR helper and a `tolkira compat` CLI were deliberately left out
until there is real demand. If you use MCHR today, the core CLI covers the
common shape:

```shell
tolkira path/to/jsonDir --out reports/index.html --title "My report"
```

Map `jsonDir` to the input directory, `reportPath`/`reportName` to `--out`,
`metadata` to `--meta key=value` and `brandLogo` to `--logo`. Dashboard,
history, trends, i18n and the old folder report are not reproduced.
