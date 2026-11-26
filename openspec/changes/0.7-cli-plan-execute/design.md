# Design

## Context

`src/cli.ts` is the only CLI entry (`esbuild.mjs` bundles it to `dist/cli.js`
with the shebang). It exports `CliIO` and `runCli`; 26 files import `runCli`:
24 test files (20 unit/integration, 4 e2e specs) plus 2 shared helpers
(`test/baseline-helpers.ts`, `test/e2e/helpers.ts`).
`test/render-report.test.ts` rebuilds and spawns the bundle.

The 0.6.0 architecture review and the 2026-11-24 second pass both put this
refactor in B-057. B-057's rule is explicit: one change at a time, and never a
refactor bundled with a behaviour or markup change. This design therefore moves
code and names a seam; it does not "improve" a check, a message or a write.

Relevant ADRs: ADR 0002 (one package, ESM, Node 22) and ADR 0005
(server-rendered shell, one renderer) are unchanged. The renderer, summary,
history, baseline, email and PDF modules are not touched.

## Observable contract: no externally visible change

For the same argv, cwd, filesystem state, clock and environment, the CLI
produces:

- the same exit code (0 success, 1 input/render/write failure, 2 usage);
- the same stdout bytes and the same stderr bytes, including warnings,
  confirmations and the `tolkira: ` prefix;
- the same CLI-written files, with the same bytes, in the same order;
- the same atomic-write behaviour and the same failure points (no partial
  file, `.tmp` name never printed);
- the same POSIX file mode: `writeAtomic` writes new files with 0600, so the
  tests assert it on POSIX and skip it on Windows;
- the accepted package delta: exactly five internal declarations in
  `dist/cli/{args,execute,logo,paths,plan}.d.ts`; `dist/cli.d.ts` changes only
  by the `CliIO` re-export; `dist/cli.js` and its map are rebuilt and their
  size delta is recorded; `dist/index.*` stays unchanged;
- the same help, version and capabilities bytes and the same precedence
  (`parseArgs` error → help → version → capabilities → everything else);
- the same public API: no new export from `src/index.ts`, `dist/index.d.ts`
  unchanged, `runCli(argv, io?)` signature and `CliIO` export unchanged;
- no new flag, environment variable, config file or runtime dependency.

Proof:

1. The existing CLI suite is the primary oracle and stays untouched:
   `test/cli.test.ts`, `cli-edge`, `cli-ci`, `cli-email`, `cli-pdf`,
   `cli-history`, `cli-history-window`, `cli-baseline`, `cli-static`,
   `cli-locale`, `cli-size-warning`, `cli-artifacts`, plus `capabilities`,
   `inputs`, `junit`, `messages-producers`, `metadata-links`,
   `parity-metadata`, `playwright`, `render-retry-evidence`,
   `size-diagnostics`, `baseline-helpers` and the e2e specs.
2. New plan-level tests pin the plan shape and the usage-error order.
3. New execute-level tests pin the branch, the write order and every failure
   point.
4. New equivalence tests pin exact stdout/stderr/exit codes and compare CLI
   artifacts with the direct API seams that produce them; the one-time gate
   (task 4.6) compares real CLI report, email, history, ci-out and manifest
   bytes to the 1.1 baseline on the same host, and the PDF through the same
   pinned host Chromium with only its embedded date/ID fields normalized.
5. A process check confirms the diff touches only `src/cli*`, the CLI tests,
   the two package-surface pins and docs — no renderer, summary, email, PDF,
   history or baseline module.

Report, email, history, ci-out and manifest bytes are compared once, in the
one-time gate, to the 1.1 baseline on the same host. The PDF is produced by
the pinned host Chromium; the gate compares it after normalizing only the
engine's embedded `/CreationDate`, `/ModDate` and `/ID` fields, so a page or
content difference still blocks. The permanent equivalence tests still compare
option objects and API seams (`renderReport`, `renderEmail`, `renderPdf`) and
use no cross-Node or cross-Intl goldens.

## Goals / Non-Goals

**Goals**

- One planning step that produces a validated `CliPlan` and never writes or
  prints.
- One execution step that owns all reads, writes, warnings and stdout.
- Every current `cli.ts` responsibility has exactly one new home.
- `src/cli.ts` becomes a small entry with the unchanged usage text and
  `runCli`.
- Existing tests keep importing the same entry and pass without expectation
  changes.
- The dependency graph stays acyclic and the resolved-input seam stays
  internal.

**Non-Goals**

- Redesigning path validation as a table with new reasons or slots (the
  research candidate is deferred).
- Adding a `cwd` parameter to `samePath`/`outputOverwritesInput`.
- Changing any usage check, message, write order, exit code or option.
- Fixing B-065 or B-056.
- Adding tests for unrelated untested behaviour.
- Any release work.

## Seam and module map

```
src/cli.ts                  entry: USAGE, DEFAULT_IO, runCli, main guard
  ├── src/cli/plan.ts       planCli + CliPlan/CliAction/CliPlanResult
  │     ├── src/cli/args.ts     parseArgs + scalar parsers
  │     ├── src/cli/paths.ts    identity/containment/collision checks
  │     └── src/cli/logo.ts     logo type/size/content -> data URI
  └── src/cli/execute.ts    executePlan + CliIO + writers + stdout
        └── src/cli/plan.ts (type import only)
```

Dependency direction: `cli.ts → {plan, execute}`, `plan → {args, paths, logo}`,
`execute → plan` (type only). `args`, `paths` and `logo` import only Node
built-ins and existing leaf modules (`output.ts`, `validation.ts`, `ci.ts`,
`history.ts`, `text.ts`, `render/i18n.ts`). `plan` and `execute` are peers and
never import each other's implementation; `execute` imports only the `CliPlan`
type from `plan`. No cycle.

`src/cli.ts` keeps:

- `USAGE` verbatim (same bytes);
- `DEFAULT_IO` and `isMainModule`;
- exported `interface CliIO` (re-exported from `execute.ts`, so the module
  surface is unchanged);
- exported `runCli(argv, io = DEFAULT_IO): Promise<number>`;
- the main-module invocation.

`runCli` body after the split:

```ts
const planned = await planCli(argv);
if (!planned.ok) {
  io.stderr(
    planned.kind === 'usage' ? USAGE : `tolkira: ${planned.message}\n\n${USAGE}`,
  );
  return 2;
}
switch (planned.action.kind) {
  case 'help':
    io.stdout(USAGE);
    return 0;
  case 'version':
    io.stdout(`${version}\n`);
    return 0;
  case 'capabilities':
    io.stdout(capabilitiesJson());
    return 0;
  case 'run':
    return executePlan(planned.action.plan, io);
}
```

The bare-usage case (`inputs.length === 0` or no output) is the only failure
without a `tolkira: ` line; it stays that way.

## The plan type

`CliOutputKind`, `CliConfirmationKind`, `CliAction` and `CliPlanResult` stay
module-private (no `export`); only `plan.ts` and its tests use them and knip
would flag an unused export. `CliPlan` is the only exported plan type:
`execute.ts` imports it, and `planCli`'s private return type is still emitted
into the module's `.d.ts` without an export.

```ts
type CliOutputKind =
  | 'report'
  | 'pdf'
  | 'email'
  | 'history'
  | 'ci-markdown'
  | 'manifest';

type CliConfirmationKind = Extract<
  CliOutputKind,
  'report' | 'pdf' | 'email' | 'manifest'
>;

export interface CliPlan {
  /** 'summary' when no report/PDF is generated, 'generate' otherwise. */
  mode: 'summary' | 'generate';
  inputs: string[];

  report?: string;
  pdf?: string;
  email?: string;
  history?: string;
  ciOut?: string;
  manifest?: string;
  baseline?: string;

  json: boolean;
  ci?: CiFormat;
  title?: string;
  locale?: string;
  metadata: Record<string, string>;
  accent?: string;
  /** Validated data URI, not a path. */
  logoDataUri?: string;
  static: boolean;
  maxSizeMb: number;
  pdfTimeout?: number;
  historyLimit?: number;

  /** Declared file order, stdout excluded. */
  writes: readonly CliOutputKind[];
  /** Who owns stdout, and which confirmations print when it is free. */
  stdout: {
    machine: 'json' | 'ci' | null;
    confirmations: readonly CliConfirmationKind[];
  };
  /** Execute returns success or failure; usage never produces a plan. */
  exitCodes: { readonly success: 0; readonly failure: 1 };
}

type CliAction =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'capabilities' }
  | { kind: 'run'; plan: CliPlan };

type CliPlanResult =
  | { ok: true; action: CliAction }
  | { ok: false; kind: 'message'; message: string }
  | { ok: false; kind: 'usage' };

export async function planCli(argv: string[]): Promise<CliPlanResult>;
```

The first-commit `planOptions` is exported for
`test/cli-plan-options.test.ts`; it returns the internal `CliOptions`: the
validated values from checks 1–23 (inputs, output paths, flags, parsed
scalars, locale and CI format) before any path check or metadata/logo read.
The raw `--meta`, `--max-size`, `--accent` and `--logo` values travel in
`CliOptions` unparsed, so checks 32–35 can parse them later without reading
argv again; only the parsed products (`metadata`, `maxSizeMb`, `accent`,
`logoDataUri`) stay out of it. Actions are resolved inside `planOptions`
(checks 2–4), and its exported result is the named
`CliOptionsResult = { ok: true; action: 'help' | 'version' | 'capabilities' } |
{ ok: true; options: CliOptions } | { ok: false; kind: 'message'; message:
string } | { ok: false; kind: 'usage' }`; `planCli` maps the action arm to
`CliAction`. `CliOptions` never crosses the execute seam; `planCli` builds
`CliPlan` from it.

The plan carries options and policy. It must **not** carry:

- `ResolvedInputs`, file groups, envelopes, a run index or a report model;
- a `ReportSummary`, HTML, PDF bytes, CI text, manifest text or history runs;
- a baseline summary (only the path);
- `CliIO`, writer functions, open handles, timers or a mutable write ledger;
- execution results, warnings already printed, or stdout text.

`metadata` is always an object (empty when no `--meta`). Optional keys are only
present when the current code would pass them; `exactOptionalPropertyTypes`
keeps that honest. `title: ''` stays a present empty title, exactly as today.

Field mapping from the current `runCli` locals: `report`←`output`,
`pdf`←`pdfPath`, `email`←`emailPath`, `history`←`historyFile`,
`ciOut`←`ciOut`, `manifest`←`manifestFile`, `baseline`←`baselineFile`,
`logoDataUri`←`logo`, and the rest keep their names (`title`, `locale`,
`metadata`, `accent`, `static`, `maxSizeMb`, `pdfTimeout`, `historyLimit`,
`json`, `ci`, `inputs`). No value is re-derived in execute.

`writes` derivation:

- generate mode: `report`, `pdf`, `email`, `history`, `ci-markdown`,
  `manifest`, in that order, each only when requested;
- summary mode: `email`, `ci-markdown`, `manifest`, each only when requested.

`--history` forces generate mode (it requires `--out`); `--static` requires
`--out` or `--pdf`, and `--logo` requires `--out`; summary mode can never carry
them.

`stdout` derivation:

- `machine = 'json'` when `--json`; else `'ci'` when `--ci` is set and
  `--ci-out` is absent; else `null`;
- `confirmations` is empty when `machine !== null`;
- generate mode confirmations: `report`, `pdf`, `email`, `manifest` (present
  ones, in that order);
- summary mode confirmations: `email`, `manifest` (present ones).

This reproduces the current stdout rules exactly: machine bytes win; a
standalone `--ci` owns stdout; `--ci-out` frees stdout; the manifest line is
suppressed by `--json`/stdout-CI.

## Ordered usage checks (preserved verbatim)

`planCli` keeps the current first-error order. This is the part that a naive
"pure first, filesystem later" split would break. The order is:

| # | Current check | Current site (`src/cli.ts` at `8f4a493`) | New owner |
| --- | --- | --- | --- |
| 1 | `parseArgs` failure → `tolkira: <detail>` | `390` | `plan.ts` |
| 2 | `--help` | action / no site (`return 0`) | `plan.ts` action |
| 3 | `--version` | action / no site (`return 0`) | `plan.ts` action |
| 4 | `--capabilities`, including the "no input and no other option" error | `412` | `plan.ts` action/message |
| 5 | empty `--out`, `--pdf`, `--baseline`, `--manifest` | `430`, `435`, `440`, `445` | `plan.ts` |
| 6 | `--static` requires `--out` or `--pdf` | `450` | `plan.ts` |
| 7 | `--pdf-timeout` requires `--pdf` | `455` | `plan.ts` |
| 8 | `--pdf-timeout` value | `464` | `args.ts` via `plan.ts` |
| 9 | empty `--email` | `469` | `plan.ts` |
| 10 | `--locale` resolution | `479` | `plan.ts` via `resolveLocale` |
| 11 | `--locale` requires `--out`, `--pdf` or `--email` | `490` | `plan.ts` |
| 12 | `--ci` value | `499` | `args.ts` via `plan.ts` |
| 13 | empty `--ci-out` | `504` | `plan.ts` |
| 14 | `--ci-out` requires `--ci` | `509` | `plan.ts` |
| 15 | `--ci github/azure` rejects `--ci-out` | `517` | `plan.ts` |
| 16 | `--json` + stdout `--ci` conflict | `531` | `plan.ts` |
| 17 | `--baseline` requires a surface | `545` | `plan.ts` |
| 18 | `--history-limit` requires `--history` | `553` | `plan.ts` |
| 19 | non-empty `--history` requires `--out` | `558` | `plan.ts` |
| 20 | at least one input and one output → bare usage | `571` | `plan.ts` (`kind: 'usage'`) |
| 21 | empty `--logo`; `--logo` requires `--out` | `576`, `581` | `plan.ts` |
| 22 | empty `--history` requires a path | `586` | `plan.ts` |
| 23 | `--history-limit` value | `595` | `args.ts` via `plan.ts` |
| 24 | `--manifest` collision with inputs/logo/out/pdf/email/history/ci-out/baseline | `617` | `paths.ts` via `plan.ts` |
| 25 | `--manifest` relative expressibility for out/pdf/email/history/ci-out | `636` | `paths.ts` via `plan.ts` |
| 26 | `--history` collision | `658` | `paths.ts` via `plan.ts` |
| 27 | `--baseline` collision | `678` | `paths.ts` via `plan.ts` |
| 28 | `--out` overwrites an input or the logo | `686` | `paths.ts` via `plan.ts` |
| 29 | `--ci-out` collision with `--out`, an input or the logo | `692`, `699` | `paths.ts` via `plan.ts` |
| 30 | `--email` collision with `--out`, `--ci-out`, inputs, logo | `706`, `710`, `717`, `724` | `paths.ts` via `plan.ts` |
| 31 | `--pdf` collision with `--out`, `--ci-out`, `--email`, logo, inputs | `731`, `735`, `739`, `746`, `753` | `paths.ts` via `plan.ts` |
| 32 | `--meta` value | `769` (shared catch with 33–35) | `args.ts` via `plan.ts` |
| 33 | `--max-size` value | `769` (shared catch with 32, 34, 35) | `args.ts` via `plan.ts` |
| 34 | `--accent` value | `769` (shared catch with 32, 33, 35) | `args.ts` via `plan.ts` |
| 35 | logo type/size/content | `769` (shared catch with 32–34) | `logo.ts` via `plan.ts` |
| 36 | input resolution | no exit-2 site; catch `971`–`974` returns 1 | `execute.ts` |
| 37 | early input size scan and warning | action / no site (stderr warning) | `execute.ts` |
| 38 | history read | no exit-2 site; catch `971`–`974` returns 1 | `execute.ts` |
| 39 | baseline read | no exit-2 site; catch `971`–`974` returns 1 | `execute.ts` |
| 40 | summary/generate branch | action / no site (branch) | `plan.mode` + `execute.ts` |
| 41 | report, PDF, email, history, `--ci-out`, manifest writes | no exit-2 site; catch `971`–`974` returns 1 | `execute.ts` |
| 42 | max-size and skipped-attachment warnings | action / no site (stderr warnings) | `execute.ts` |
| 43 | CI text formatting and write | no exit-2 site; catch `971`–`974` returns 1 | `execute.ts` |
| 44 | manifest build/serialize | no exit-2 site; catch `971`–`974` returns 1 | `execute.ts` |
| 45 | stdout ownership and confirmations | action / no site (stdout) | `plan.stdout` + `execute.ts` |
| 46 | caught error → `tolkira: <detail>\n`, exit 1 | `971`–`974` (`return 1`, the error sink) | `execute.ts` |
| 47 | main-module guard | action / no site | `cli.ts` |

Site check: `grep -n 'return 2;' src/cli.ts` at `8f4a493` yields 42
lines and every one appears in the table. Rows 24–31 are the seven
path blocks holding eight checks (the manifest block holds collision plus
relative expressibility) and sixteen sites. Row 5 holds four sites, rows
21/29/30/31 hold 2/2/4/5, and rows 32–35 share the one catch at 769.
Rows marked action/no site are help/version actions, warnings, the branch or
stdout, or the main guard; the failing rows among 36–46 terminate in the single
catch at 971–974 with exit 1, not 2.

Steps 32–35 stay in one `try`/`catch` that maps any failure to a usage message,
exactly as today. Path-check throws are **not** newly caught: today they escape
`runCli` (the path helpers catch `stat`/`realpath` internally); `planCli`
must let the same unexpected throws escape.

The inner order of rows 24–31 is also normative. Keep the current sequence:

- `--manifest`: `pathConflicts(...)` against inputs, logo, `--out`, `--pdf`,
  `--ci-out`, `--email`, `--history`, then a separate `--baseline` `samePath`;
  then the relative-expressibility loop in the order `--out`, `--pdf`,
  `--email`, `--history`, `--ci-out`.
- `--history`: `pathConflicts(...)` with `--baseline` as the peer.
- `--baseline`: `pathConflicts(...)` with `--history` as the peer.
- `--out`: one `outputOverwritesInput(inputs, out, logo)` check.
- `--ci-out`: `--out` `samePath`, then `outputOverwritesInput`.
- `--email`: `--out` `samePath`, `--ci-out` `samePath`,
  `conflictsWithInputs`, then `outputOverwritesInput`.
- `--pdf`: `--out` `samePath`, `--ci-out` `samePath`, `--email` `samePath`,
  logo `samePath`, then `conflictsWithInputs`.

Each keeps its current message; no message is merged or reworded.

Planning is "pure" in the observable sense: no writes, no stdout/stderr, no
observable process mutation, no network. It does read filesystem metadata and
the logo
because steps 24–35 are part of the usage contract. A strictly mathematical
pure function would have to move step 32 after the path checks and reorder
observable errors, which this change forbids.

## Execute order (preserved verbatim)

```
try
  resolveInputFiles(plan.inputs)               // once
  scanInputBytes(resolved.files)               // advisory, errors swallowed
  warning if >= 50 MiB
  readHistory(history, historyLimit)           // before baseline
  readBaseline(baseline)
  if plan.mode === 'summary':
      summarizeRunFromResolved(resolved, baseline)
      write email                                  (if requested)
      format CI text; write --ci-out               (if requested)
      write manifest                               (if requested)
      stdout
      return 0
  generateReportFromResolved(resolved, options)
  write report
  write PDF
  write email
  write history                                  (only when generated.history)
  max-size warning
  skipped-attachment warning
  format CI text; write --ci-out
  write manifest
  stdout
  return 0
catch
  stderr `tolkira: <detail>\n`
  return 1
```

Input resolution, history read and baseline read fail before the first write:
exit 1, no stdout and no `.tmp`; only the early input warning may already be on
stderr. Every writer failure keeps the earlier completed writes and leaves no
`.tmp`.

The five writers (`writeReport`, `writePdf`, `writeEmailSummary`,
`writeCiOutput`, `writeManifest`, plus the `errorCode` helper) move verbatim,
with the same `oneLine`/500-character rules and the same `writeAtomic` leaf.
The manifest artifact ledger is built from the writes that actually happened,
in order (`report`, `pdf`, `email`, `history`, `ci-markdown`), so the summary
and generate branches cannot drift. `plan.writes` is the declared contract;
the execute tests assert that the successful ledger equals `plan.writes`
without `manifest`.

Options passed to `generateReportFromResolved` keep the current
conditional-spread shape:

```ts
{
  ...(plan.title === undefined ? {} : { title: plan.title }),
  metadata: plan.metadata,
  ...(plan.logoDataUri === undefined
    ? {}
    : { logo: plan.logoDataUri }),
  ...(plan.accent === undefined ? {} : { accent: plan.accent }),
  ...(plan.historyLimit === undefined ? {} : { historyLimit: plan.historyLimit }),
  ...(plan.static ? { static: true } : {}),
  ...(plan.locale === undefined ? {} : { locale: plan.locale }),
  ...(history === undefined ? {} : { history }),
  ...(baseline === undefined ? {} : { baseline }),
}
```

Email options keep `path.basename(plan.report ?? plan.pdf ?? '')` and
`now: new Date()`; the summary-only branch keeps no `reportName`, exactly as
today.

## Responsibility map

| Current `cli.ts` responsibility | New home |
| --- | --- |
| `USAGE`, `CliIO`, `DEFAULT_IO`, main guard | `src/cli.ts` |
| `parseCliArgs`, `parseMetadata`, `parseMaxSize`, `parsePdfTimeout`, `parseHistoryLimit`, `parseCiFormat`, `parseAccent` | `src/cli/args.ts` |
| `MAX_LOGO_BYTES`, `LOGO_MIME`, `readLogo` | `src/cli/logo.ts` |
| `isInside`, `conflictsWithInputs`, `pathConflicts`, `cannotExpressRelative` | `src/cli/paths.ts` |
| help/version/capabilities precedence | `src/cli/plan.ts` actions; `src/cli.ts` prints |
| empty-path, dependency and exclusivity checks | `src/cli/plan.ts` |
| metadata/max-size/accent parsing and logo validation in one try/catch | `src/cli/plan.ts` calling `args.ts`/`logo.ts` |
| `resolveLocale` call | `src/cli/plan.ts` |
| path-check sequence | `src/cli/plan.ts` calling `paths.ts` |
| plan construction (mode, writes, stdout, exit policy) | `src/cli/plan.ts` |
| `resolveInputFiles`, `scanInputBytes`, early warning | `src/cli/execute.ts` |
| history/baseline reads | `src/cli/execute.ts` |
| summary/generate branch | `src/cli/execute.ts` driven by `plan.mode` |
| five writers and `errorCode` | `src/cli/execute.ts` |
| size and attachment warnings | `src/cli/execute.ts` |
| CI formatting, manifest build/serialize | `src/cli/execute.ts` |
| stdout machine bytes and confirmations | `src/cli/execute.ts` driven by `plan.stdout` |
| exit 0/1 | `src/cli/execute.ts` returning `plan.exitCodes` |
| exit 2 | `src/cli.ts` formatting a `CliPlanResult` failure |

## Internal seams and exports

- The resolved-input seam stays internal: `plan.inputs` are the raw
  positionals; `executePlan` calls `resolveInputFiles` once and passes the
  resulting `ResolvedInputs` to `generateReportFromResolved` or
  `summarizeRunFromResolved`. `ResolvedInputs` never enters `CliPlan`, and no
  resolved list becomes a package type.
- `src/index.ts` is untouched. No new name is exported from the package.
- `src/cli/args.ts`, `logo.ts`, `paths.ts`, `plan.ts` and `execute.ts` are
  reachable only from `src/cli.ts` (and tests). Knip keeps them alive through
  the existing `src/cli.ts` entry.
- `CliIO` moves to `execute.ts` and is re-exported as a type from
  `src/cli.ts`; `runCli` keeps its parameter default and return type.
- No `cwd` parameter: all relative paths resolve against the process cwd
  exactly as today. Threading a cwd through `samePath`/`outputOverwritesInput`
  would change a shared leaf for no observable gain and is deferred.

## Callers and test surface

Everything below keeps working without an import change:

- 20 unit/integration test files import `runCli` directly:
  `capabilities.test.ts`, `cli-artifacts`, `cli-ci`, `cli-edge`, `cli-email`,
  `cli-history-window`, `cli-history`, `cli-locale`, `cli-pdf`,
  `cli-size-warning`, `cli-static`, `cli.test.ts`, `inputs`, `junit`,
  `messages-producers`, `metadata-links`, `parity-metadata`, `playwright`,
  `render-retry-evidence`, `size-diagnostics`; the first shared helper
  `test/baseline-helpers.ts` imports it for `cli-baseline`.
- E2E: 4 specs import `runCli` directly — `baseline.spec.ts`,
  `metadata-links.spec.ts`, `responsive.spec.ts` and `visual.spec.ts`. The
  second shared helper is `test/e2e/helpers.ts`; the other specs depend
  through it.
- Bundle/tooling: `test/render-report.test.ts` builds `src/cli.ts` with
  esbuild and spawns it; `test/tooling-config.test.ts` pins `src/cli.ts` as a
  knip entry; `test/package-manifest.test.ts` pins `dist/cli.js`.

## TDD plan

Two workers: TDD-Red writes the failing tests from this design; the
implementer makes them green without weakening them. Existing CLI tests are not
edited except for a genuine import change, which this design does not expect.

### Slice 1a — options (`test/cli-plan-options.test.ts`, checks 1–23)

- `planOptions` shape/defaults for the checks 1–23 values: inputs, output
  paths, `json`, `ci`, title (including empty), locale (`de-AT` keeps its
  tag), `static`, `pdfTimeout`, `historyLimit`, the baseline path and the raw
  `meta`/`max-size`/`accent`/`logo` strings. The parsed products are not part
  of `CliOptions`.
- Action precedence: parse error vs help; help vs version; version vs
  capabilities; capabilities alone vs capabilities plus input/valid flag;
  unknown flag still fails at `parseArgs`. The action flags are consumed
  inside `planOptions` and surface only through the `action` arm.
- Purity: a valid `planOptions` call creates no file/directory, prints
  nothing and does not mutate argv.
- Single-defect messages 1–23, pinned exactly, including bare usage.
- Precedence pairs within 1–23: `--out=`+`--pdf=`, `--manifest=`+`--static`,
  `--static`+`--pdf-timeout`, `--pdf-timeout`+`--email=`, `--locale`+`--ci`,
  `--ci`+`--ci-out=`, `--json --ci`+`--baseline`, no-input/no-output vs
  earlier/later checks.
- Boundary values owned by 1–23: `--history-limit` 1, 365, 0, 366, `01`,
  `1.5`, `abc`, `''`; `--pdf-timeout` 1, 2,147,483,647, 2,147,483,648, `0`,
  `01`; `--ci` case and unknown.

### Slice 1b — full plan (`test/cli-plan.test.ts`)

- Full `CliPlan` shape/defaults for every flag: mode, paths, `json`, `ci`,
  title (including empty), locale, metadata merge, accent, logo data URI,
  `static`, `maxSizeMb` (default 10), `pdfTimeout`, `historyLimit`, baseline
  path, `writes`, `stdout`, `exitCodes`.
- The four actions through `planCli` and purity (no file/directory, no
  output, no argv mutation).
- Write order and stdout policy: the `writes` list per mode; machine bytes
  win; a standalone `--ci` owns stdout; `--ci-out` frees it; the manifest
  line is suppressed by `--json`/stdout-CI; summary confirmations are email,
  manifest.

### Slice 1c — added messages and precedence (`test/cli-plan.test.ts`)

- Single-defect messages 32–34: invalid metadata, max-size and accent. The
  path-collision messages 24–31 and the logo message 35 are pinned in Slice 2
  (2.3), not here.
- Cross-family precedence, both directions: early scalar errors beat a later
  path collision (`--pdf <path> --pdf-timeout abc`, invalid `--locale` with a
  valid surface, invalid `--ci`, `--history <path> --history-limit abc`, each
  plus a colliding `--out`); an early dependency error also beats a later path
  collision (`--pdf-timeout 5` without `--pdf` plus a colliding `--out`); path
  errors beat later `--meta`/`--max-size`/`--accent` parsing (a manifest
  collision plus an invalid `--meta`).
- Precedence pairs that involve 24–34: manifest collision vs invalid
  `--meta`, history collision vs out collision,
  ci-out collision vs email collision, email collision vs pdf collision. The
  out-collision-vs-logo pair is in 2.3.
- Parse order inside the shared catch (rows 32–34): one argv with an invalid
  `--meta`, `--max-size` and `--accent` reports `--meta` first, then max-size,
  then accent; the logo step of that order is in 2.3.
- `--meta` forms: `=x` is a usage error, `k=` keeps an empty value, `k=v=w`
  keeps `v=w`, and `--meta k=1 --meta k=2` keeps the last value (`{ k: '2' }`).
- `--max-size` equivalence classes: `1e3`, `0x10` and `" 5 "` are accepted by
  `Number()`; `""`, `0`, negative, `NaN` and `Infinity` are usage errors.
- The `--pdf-timeout`/`--history-limit` boundary forms stay in 1a; they are
  not repeated here.

### Slice 2 — plan paths and logo (`test/cli-plan-paths.test.ts`)

- `samePath` identity through missing files, symlinked/junctioned parents and
  case folding on Windows/macOS (platform-guarded, mirroring existing tests).
- Input file, input directory (existing and missing target inside it), logo,
  each output peer, baseline and manifest collisions; exact message per flag.
  Pin the asymmetry: `--out`/`--ci-out` only fail on an existing file/logo
  replacement, while
  `--email`/`--pdf`/`--history`/`--baseline`/`--manifest` also fail for a
  missing target inside an input directory.
- Manifest relative expressibility: an absolute artifact passes; a relative
  artifact inside the manifest's directory is expressible and passes; one that
  cannot be expressed fails with the exact per-flag message; cross-drive case
  guarded to Windows.
- `samePath` with UNC paths and trailing separators (platform-guarded).
- Logo validation: missing file, unsupported extension, >2 MB, wrong magic per
  extension, valid PNG/JPEG/GIF/WebP/SVG with XML declaration and BOM-free
  handling; exact messages. The four-way parse order `--meta` → `--max-size` →
  `--accent` → `--logo` and the out-collision-vs-logo pair also live here.

### Slice 3 — execute (`test/cli-execute.test.ts`)

- Summary mode: email-only, `--ci-out`, manifest-only, email+manifest,
  `--json` suppression; confirmations and machine bytes.
- Generate mode: report-only, PDF-only, email-only-with-report, history,
  ci-out, manifest; option object equality, `reportName` basename, PDF timeout
  pass-through.
- Resolved input once: `resolveInputFiles` is called once and its result is
  the object handed to `generateReportFromResolved`/`summarizeRunFromResolved`.
- Failure-point state table, split by mode. Summary order: summarize → email
  → ci-out → manifest → stdout. Generate order: generate → report → PDF →
  email → history → max-size warning → attachment warning → ci-out → manifest
  → stdout.

  | Mode | Failed step | Prior writes stay | Later steps | stdout |
  | --- | --- | --- | --- | --- |
  | summary | summarize | none | email, ci-out, manifest absent | empty |
  | summary | email | none | ci-out, manifest absent | empty |
  | summary | ci-out | email | manifest absent | empty |
  | summary | manifest | email, ci-out | — | empty |
  | generate | generate | none | report, PDF, email, history, ci-out, manifest absent | empty |
  | generate | report | none | PDF, email, history, ci-out, manifest absent | empty |
  | generate | PDF | report | email, history, ci-out, manifest absent | empty |
  | generate | email | report, PDF | history, ci-out, manifest absent | empty |
  | generate | history | report, PDF, email | ci-out, manifest absent | empty |
  | generate | ci-out | report, PDF, email, history | manifest absent | empty |
  | generate | manifest | report, PDF, email, history, ci-out | — | empty |

  Read failures (input resolution, history read, baseline read) happen before
  any write: exit 1, no files, no stdout; only the early input warning may
  already be on stderr. Every failure leaves no `.tmp` and keeps every
  completed earlier write.
- Warning order: max-size then skipped-attachment, after writes and before
  ci-out/manifest/stdout; early input warning before parse; exact bytes.
- Manifest ledger: report, PDF, email, history, ci-markdown in write order;
  history only when written; summary mode email/ci-markdown only.

### Slice 4 — compact end-to-end equivalence (`test/cli-equivalence.test.ts`)

The permanent file is compact: it covers only what the 12 existing CLI files do
not pin — the mode × stdout cross-product (the ★ rows below), the built-CLI
spawn and the file-set/determinism checks. The full matrix and the baseline
artifact comparison are the one-time gate (task 4.6), not a duplicate
permanent suite. The gate file is committed for the run and removed after the
result is recorded; the rows below and the recorded outputs are the audit
trail.

#### One-time gate matrix (task 4.6)

Row 4 passes a placeholder positional; rows 6–23 use the 1.1 input fixture;
rows 1–3 and 5 use no input. All rows run with the frozen clock and English
unless the row names another locale (row 19).
`r`, `e`, `ci`, `h` and `m` are gate-output paths; `b` is the baseline artifact
recorded in 1.1 and only read here.

| # | argv | expected |
| --- | --- | --- |
| 1 | `--help` | USAGE, exit 0 |
| 2 | `--version` | version line, exit 0 |
| 3 | `--capabilities` | capabilities JSON, exit 0 |
| 4 | `--capabilities <input>` | usage error, exit 2 |
| 5 | no args | bare usage, exit 2 |
| 6 | `<input> --json` | summary JSON, exit 0 |
| 7 | `<input> --out r.html` | report + confirmation, exit 0 |
| 8 | `<input> --out r.html --json` | JSON, report confirmation suppressed, exit 0 |
| 9 | `<input> --pdf r.pdf` | real Chromium PDF + confirmation, exit 0 |
| 10 | `<input> --email e.html` | summary email + confirmation, exit 0 |
| 11 | `<input> --out r.html --ci github` ★ | GitHub body on stdout, no confirmation, exit 0 |
| 12 | `<input> --out r.html --ci azure` ★ | Azure body on stdout, exit 0 |
| 13 | `<input> --out r.html --ci markdown --ci-out ci.md` ★ | Markdown file + confirmation, exit 0 |
| 14 | `<input> --out r.html --history h.json` | report + history, exit 0 |
| 15 | `<input> --out r.html --json --baseline b.json` ★ | JSON with the earlier baseline, exit 0 |
| 16 | `<input> --out r.html --manifest m.json` | report + manifest confirmation, exit 0 |
| 17 | `<input> --out r.html --json --manifest m.json` ★ | JSON wins, manifest line suppressed, exit 0 |
| 18 | `<input> --out r.html --static` | static report, exit 0 |
| 19 | `<input> --out r.html --locale de` | German report, exit 0 |
| 20 | `<input> --out r.html --ci nope` | usage error, exit 2 |
| 21 | `<input> --ci github` (no `--out`) ★ | summary + GitHub body on stdout, exit 0 |
| 22 | `<input> --json --baseline b.json` (no `--out`) ★ | summary JSON + baseline, exit 0 |
| 23 | `<input> --ci markdown --ci-out ci.md` (no `--out`) ★ | summary Markdown file, exit 0 |

- The eight ★ rows are permanent in 2.5a with exact code/stdout/stderr (the
  mode × stdout cross-product); the gate reuses those recorded results instead
  of running them twice.
- Built-CLI equivalence from a temporary esbuild bundle of `src/cli.ts` (the
  `render-report` pattern): rows 1, 2, 3 and row 5 (bare usage, pinned as the
  single usage-failure probe everywhere) return the pinned bytes and exit
  codes. `npm test` does not build, so the permanent test must not depend on
  `dist`; the real `node dist/cli.js` spawn belongs to 4.4.
- Machine-byte proof: `--json` stdout equals
  `${JSON.stringify(await summarizeReport(inputs), null, 2)}\n`; Markdown
  stdout/file equals `formatCiOutput(summary, 'markdown', { title })`; the
  manifest equals `serializeRunManifest(buildRunManifest(...))` with the same
  inputs; history bytes are frozen-clock deterministic.
- Report/email/PDF proof: CLI report bytes equal
  `renderReport(inputs, options)`; CLI email bytes equal
  `renderEmail(summary, { title, locale, reportName, accent, now })` under the
  same frozen clock; the mocked `renderPdf` receives the exact CLI HTML and
  writes its bytes atomically.
- File-set proof: before/after directory listing equals the expected outputs
  and the same directory state as today, including `writeAtomic`'s `mkdir`
  before a failed write; no `.tmp` remains and existing files survive a failed
  write. On POSIX, assert mode 0600 on each created file; skip the mode
  assertion on Windows.
- Determinism: two runs with the same argv and frozen clock produce identical
  bytes for JSON, CI, manifest and history.

ISTQB coverage: equivalence classes for summary vs generate and for stdout
ownership; boundary values above; decision tables for option combinations and
single errors; state transitions for the mode-split failure table; pairwise
combinations for output collisions (`manifest × peer`, `email ×
ci-out/history/pdf`, `baseline × surface`).

## Size, stop condition and first-commit fallback

Expected result:

- `src/cli.ts`: 993 → about 100–130 lines.
- `args.ts` ~110, `logo.ts` ~60, `paths.ts` ~70, `plan.ts` ~370,
  `execute.ts` ~360.
- Total across the six files: about 1,050–1,100 lines, +60 to +110 over today
  (imports, types and the plan object), not a rewrite.

Stop conditions — stop and return to the design/user if any holds:

- an existing CLI test needs an expectation, message or order change;
- any `git diff` outside `src/cli.ts`, `src/cli/**`, the new CLI tests,
  `docs/ARCHITECTURE.md`, `GLOSSARY.md`, `scripts/package-check.mjs`,
  `test/package-manifest.test.ts` and this change appears (except a mechanical
  import change);
- a move needs a new `oxlint-disable` or knip suppression directive
  (`test/tooling-config.test.ts` pins every directive);
- the plan/execute boundary needs a new catch, a new validation, a new
  message, or a reordered check to compile;
- total line growth exceeds +20% (about 1,190 lines) or a module other than
  `cli.ts` exceeds 430 lines;
- the write-order or failure-point table cannot be reproduced without adding
  a hook or abstraction.

First implementation slice (unconditional, and also the fallback), split into
two ≤2-hour commits (tasks 3.1a/3.1b): add `src/cli/args.ts` with the parsers
moved verbatim, then `src/cli/plan.ts` with `planOptions(argv)` and the
`CliOptions` type covering checks 1–23 — the contiguous block that ends before
the filesystem path checks (parse, help/version/capabilities, empty paths,
option dependencies, `--pdf-timeout`, locale, CI, `--history-limit`,
at-least-one, logo/history empty checks and the history-limit value).
`src/cli.ts` calls it and then continues with the current path checks,
metadata/logo reads and execution. About 300 lines (~211 pre-path + ~92
parsers, plus imports and types). The slice is green on the existing CLI suite,
the 2.5 equivalence control and `test/cli-plan-options.test.ts` (2.1a) for
checks 1-23; the full-plan tests (2.1b/2.1c), path tests and execute tests
stay RED until 3.3–3.5/3.6. If a later step breaks byte identity, stop at
3.1b and return to the design/user; that commit then stands as the fallback
with only 2.1a and the equivalence control, while the later tests are dropped
from that branch. The follow-up gets the path plan, execute split, write
ledger and the execute/equivalence test slices.

## Risks

1. **Usage-error precedence drift.** 42 exit-2 sites are interleaved with
   filesystem checks across the 47 ordered checks. Moving all pure checks
   before path checks (or the reverse) changes which error a multi-defect argv
   sees. Mitigation: the ordered table above is normative; precedence-pair
   tests in both directions; side-by-side diff.
2. **Path semantics drift.** `isInside`, `conflictsWithInputs`, `pathConflicts`
   and `cannotExpressRelative` are copied verbatim with the same signatures.
   `samePath` and `outputOverwritesInput` stay untouched. The rules are
   deliberately asymmetric: `--out` and `--ci-out` only fail when they would
   replace an existing file or the logo, while
   `--email`/`--pdf`/`--history`/`--baseline`/`--manifest` also fail inside an
   input directory even when the target is missing. Do not unify them.
   Mitigation: move only, no "cleanup"; existing symlink/junction/case tests
   plus new helper tests.
3. **Write-order or partial-output drift.** A misplaced `await` changes which
   files survive a failure. Mitigation: failure-point state table for every
   writer; manifest ledger; stdout suppression tests.
4. **Manifest ledger drift.** The history artifact is conditional on
   `generated.history`, summary and generate have different sets. Mitigation:
   ledger records actual writes; tests for all five artifact kinds.
5. **Stdout ownership drift.** `--json`, stdout CI, `--ci-out`, confirmations
   and manifest suppression are easy to combine wrongly. Mitigation: plan
   `stdout` policy plus exact byte equivalence tests.
6. **Plan too fat or too thin.** If the plan carries resolved inputs or
   generated content, the seam is fake; if it drops validated options,
   execution re-validates and drifts. Mitigation: the plan type above is
   normative; execute maps 1:1 and never re-parses.
7. **"Pure" misunderstanding.** Planning reads filesystem metadata and the
   logo. This is deliberate and documented; a strict-pure split would reorder
   errors. The 2026-11-26 PIR/DXR review accepted this.
8. **Unhandled-rejection parity.** Path checks currently sit outside the exit-1
   catch. Do not add a catch around them; only the metadata/max-size/accent/
   logo block maps to exit 2.
9. **Bundle/type surface.** Accept exactly five new internal declarations,
   `dist/cli/{args,execute,logo,paths,plan}.d.ts` (+5 tarball entries); the
   rebuilt `dist/cli.js`/`.map` and the `dist/cli.d.ts` `CliIO` re-export are
   recorded, while `dist/index.*` and the CLI-observable bytes stay fixed.
   `scripts/package-check.mjs` pins the five as required entries and
   `test/package-manifest.test.ts` pins the same list; its 80-entry npm-12
   fixture derives fillers as `80 - (packedPaths.length - 1)` so the shape
   check follows the list. Mitigation: `npm run package:check` and the manifest
   test.
10. **Coverage and suite bloat.** The permanent equivalence file stays compact:
    mode × stdout cross-product, built-CLI spawn and file-set/determinism; the
    full 23-row matrix is the one-time gate in task 4.6. The existing 12 CLI
    files are not edited. Mitigation: intended scopes only; STR reviews test
    health.
11. **Cross-platform tests.** Case folding, junctions and cross-drive paths
    differ by host. Mitigation: platform guards like the existing suite.
12. **Golden brittleness.** No permanent HTML/email byte goldens across
    Node/Intl versions; the one-time gate compares on the same host, and the
    permanent tests use direct API equivalence and frozen clocks for machine
    bytes.

## Review outcome (2026-11-26)

PIR and DXR ran on the contract at `8f4a493`. Both returned blockers: PIR-1
(B-057's order contradicted the 2026-11-26 user scope decision) and DXR-1
(knip would flag exported `CliOutputKind`/`CliConfirmationKind` with no
external consumer). The remaining findings are folded into this contract: the
corrected counts and per-site table, the split-report-renderer precedent, the
one-time byte gate, the mode-split failure table, the unconditional first
extract, the ISTQB pairs, the 0600/tarball delta, the five pinned declarations,
the built-CLI spawn, the mode × stdout matrix, the architecture-doc rules, the
stop conditions and the compact equivalence suite. A PIR/DXR delta re-check
runs after these fixes; implementation waits for that and the user's approval.
