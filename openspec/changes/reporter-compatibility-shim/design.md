# Design

## Shape

A shared mapper turns the old options object into Tolkira options and a list
of warnings. One thin entry point keeps the old call signature; it contains no
rendering logic.

```
old options ──► compat/options.ts ──► generateReport() ──► writeAtomic()
                     │
                     └── warnings (stderr or returned)
```

## Entry points

### `tolkira/compat/cucumber-html-reporter`

```ts
generate(options, callback?): Promise<CompatResult>
```

- Keeps the old CommonJS-era `(options, callback?)` shape.
- On failure, calls `callback(error)`; on success, `callback()`.
- Also returns a promise with `{ output, warnings, summary }` for new code.
- `output` is required; `jsonFile` or `jsonDir` is required.

### Descoped: multiple-cucumber-html-reporter and the CLI

The MCHR helper and a `tolkira compat` subcommand are out of scope until real
demand appears. The mapper and `writeAtomic` are shared, so adding them later
does not require a rewrite.

## Mapping

| Old option | Tolkira |
| --- | --- |
| `jsonFile`, `jsonDir` | input file / recursive directory |
| `output` | exact HTML path |
| `brandTitle`, `name`, `reportName`, `pageTitle` | title |
| `metadata`, `customData` | flat scalar `--meta` entries |
| `brandLogo` | logo |
| `ignoreBadJsonFile` | skip malformed JSON files in a directory |
| `theme`, `columnLayout`, `reportSuiteAsScenarios`, `scenarioTimestamp`, `failedSummaryReport` | warn, ignore |
| `storeScreenshots`, `screenshotsDirectory`, `noInlineScreenshots`, `externalizeMedia` | warn, inline anyway |
| `launchReport`, `openReportInBrowser` | warn, never open a browser |
| `customStyle`, `customScript`, `overrideStyle` | warn, ignore (CSP/security) |
| `language`, `emailReport`, `useCDN`, `staticFilePath`, `saveCollectedJSON` | warn, ignore |

Metadata values must be strings, numbers or booleans. Nested objects, arrays
and per-feature maps warn and are skipped.

## Warnings

One line per ignored or approximated option:

```
compat: warning: theme: ignored; Tolkira uses its own theme
```

Warnings never change the exit code. They are returned in `CompatResult` and
printed to stderr by the CLI. Unknown keys warn once each.

## Error handling

- Missing `output`, `jsonFile` and `jsonDir`: clear usage error.
- Both `jsonFile` and `jsonDir`: use `jsonFile`, warn.
- `ignoreBadJsonFile`: only valid JSON arrays are passed to the renderer;
  each skipped file produces a warning.
- Input parse/render failures keep Tolkira's normal error text.
- The old `output + '.json'` side effect is not reproduced in v0.1; warn if
  the option that triggered it is present.

## Reuse

- Extract `writeAtomic` from `src/cli.ts` into `src/output.ts` so the compat
  helpers and the CLI share one atomic write.
- Export `collectReportFiles` from `src/input/load.ts` for the
  `ignoreBadJsonFile` pre-filter; the core keeps its recursive scan.
- No new runtime dependency.

## Security

The shim only maps options; it does not bypass escaping, attachment
sanitisation, CSP, size limits or remote-asset rejection. Custom CSS/JS and
CDN options are refused because they would weaken the single-file,
no-network baseline.
