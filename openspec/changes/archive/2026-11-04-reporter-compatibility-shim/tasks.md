# Tasks

## 1. Shared plumbing

- [x] 1.1 RED: test that `tolkira/compat/cucumber-html-reporter` maps
  `jsonFile`, `output`, `brandTitle` and `metadata` to a report.
- [x] 1.2 Extract `writeAtomic` from `src/cli.ts` into `src/output.ts`; keep the
  CLI behaviour and tests.
- [x] 1.3 Extract the recursive input collector into `src/input/files.ts` for
  the compat pre-filter.
- [x] 1.4 GREEN: add the shared options mapper and warning collector.

## 2. cucumber-html-reporter helper

- [x] 2.1 GREEN: `generate(options, callback?)` writes the report and returns
  `{ output, warnings, summary }`.
- [x] 2.2 RED/GREEN: map `jsonFile` and `jsonDir`; `jsonFile` wins with a
  warning when both are set.
- [x] 2.3 RED/GREEN: warn once for `theme`, layout switches, external
  screenshots, browser launch and unknown keys.
- [x] 2.4 RED/GREEN: `ignoreBadJsonFile` skips malformed JSON files and
  reports them.
- [x] 2.5 RED/GREEN: callback success and error paths.

## 3. Descoped: multiple-cucumber-html-reporter helper

- [x] 3.1 Descoped by user decision: no MCHR helper until demand appears.
- [x] 3.2 Descoped with 3.1: no folder report or `assets/` output.
- [x] 3.3 Descoped with 3.1: the shared mapper still warns on ignored options.

## 4. Descoped: CLI

- [x] 4.1 Descoped by user decision: no `tolkira compat` subcommand.
- [x] 4.2 Descoped with 4.1.
- [x] 4.3 Not applicable: the helper returns warnings instead of printing them.

## 5. Packaging and docs

- [x] 5.1 Add the `./compat/cucumber-html-reporter` entry to `package.json`
  exports and verify `npm pack`.
- [x] 5.2 Add `docs/COMPATIBILITY.md` with the mapping table, examples and the
  visual-parity caveat; link it from the README.
- [x] 5.3 Mark the subpath experimental; document the deprecation policy.
- [x] 5.4 Run `npm run check`, `npm run test:e2e`, `npm pack --dry-run` and
  `openspec validate reporter-compatibility-shim --strict`.
