# Tasks

## 1. Shared plumbing

- [ ] 1.1 RED: test that `tolkira/compat/cucumber-html-reporter` maps
  `jsonFile`, `output`, `brandTitle` and `metadata` to a report.
- [ ] 1.2 Extract `writeAtomic` from `src/cli.ts` into `src/output.ts`; keep the
  CLI behaviour and tests.
- [ ] 1.3 Export the recursive input collector from `src/input/load.ts` for the
  compat pre-filter.
- [ ] 1.4 GREEN: add the shared options mapper and warning collector.

## 2. cucumber-html-reporter helper

- [ ] 2.1 GREEN: `generate(options, callback?)` writes the report and returns
  `{ output, warnings, summary }`.
- [ ] 2.2 RED/GREEN: map `jsonFile` and `jsonDir`; `jsonFile` wins with a
  warning when both are set.
- [ ] 2.3 RED/GREEN: warn once for `theme`, layout switches, external
  screenshots, browser launch and unknown keys.
- [ ] 2.4 RED/GREEN: `ignoreBadJsonFile` skips malformed JSON files and
  reports them.
- [ ] 2.5 RED/GREEN: callback success and error paths.

## 3. multiple-cucumber-html-reporter helper

- [ ] 3.1 RED/GREEN: async `generate(options)` maps `jsonDir`, `reportPath`,
  `reportName`/`pageTitle`, `metadata`, `customData` and `brandLogo`.
- [ ] 3.2 RED/GREEN: write `<reportPath>/index.html`; warn that `assets/`,
  deep links and the folder report are not produced.
- [ ] 3.3 RED/GREEN: custom CSS/JS, i18n, email, CDN and browser-open options
  warn and are ignored.

## 4. CLI

- [ ] 4.1 RED/GREEN: `tolkira compat cucumber-html-reporter --options <file>`
  and `--dry-run`.
- [ ] 4.2 RED/GREEN: `tolkira compat multiple-cucumber-html-reporter
  --options <file>` and `--dry-run`.
- [ ] 4.3 Ensure warnings go to stderr and never change the exit code.

## 5. Packaging and docs

- [ ] 5.1 Add the two `./compat/*` entries to `package.json` exports and verify
  `npm pack`.
- [ ] 5.2 Add `docs/COMPATIBILITY.md` with the mapping table, examples and the
  visual-parity caveat; link it from the README.
- [ ] 5.3 Mark the subpaths experimental; document the deprecation policy.
- [ ] 5.4 Run `npm run check`, `npm run test:e2e`, `npm pack --dry-run` and
  `openspec validate reporter-compatibility-shim --strict`.
