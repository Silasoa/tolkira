# Design

## Context

`src/cli.ts` is the only CLI entry (`esbuild.mjs` bundles it to `dist/cli.js`
with the shebang). It exports `CliIO` and `runCli`; 26 test files import
`runCli` directly (21 unit/integration, 5 e2e), the other e2e specs reach it
through `test/e2e/helpers.ts`, and `test/render-report.test.ts` rebuilds and
spawns the bundle.

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
- the same files, with the same bytes, in the same order;
- the same atomic-write behaviour and the same failure points (no partial
  file, `.tmp` name never printed);
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
   artifacts with the direct API seams that produce them.
5. A process check confirms the diff touches only `src/cli*`, the CLI tests
   and docs — no renderer, summary, email, PDF, history or baseline module.

Report HTML, email and PDF bytes are not re-golden-hashed. Their producers are
untouched; the CLI change is the option object passed into them, which the
equivalence tests prove directly (`renderReport`, `renderEmail`,
`renderPdf`), avoiding brittle cross-Node/Intl goldens.

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

```ts
export type CliOutputKind =
  | 'report'
  | 'pdf'
  | 'email'
  | 'history'
  | 'ci-markdown'
  | 'manifest';

export type CliConfirmationKind = Extract<
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

export type CliAction =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'capabilities' }
  | { kind: 'run'; plan: CliPlan };

export type CliPlanResult =
  | { ok: true; action: CliAction }
  | { ok: false; kind: 'message'; message: string }
  | { ok: false; kind: 'usage' };

export async function planCli(argv: string[]): Promise<CliPlanResult>;
```

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

| # | Current check | New owner |
| --- | --- | --- |
| 1 | `parseArgs` failure → `tolkira: <detail>` | `plan.ts` |
| 2 | `--help` | `plan.ts` action |
| 3 | `--version` | `plan.ts` action |
| 4 | `--capabilities`, including the "no input and no other option" error | `plan.ts` action/message |
| 5 | empty `--out`, `--pdf`, `--baseline`, `--manifest` | `plan.ts` |
| 6 | `--static` requires `--out` or `--pdf` | `plan.ts` |
| 7 | `--pdf-timeout` requires `--pdf` | `plan.ts` |
| 8 | `--pdf-timeout` value | `args.ts` via `plan.ts` |
| 9 | empty `--email` | `plan.ts` |
| 10 | `--locale` resolution | `plan.ts` via `resolveLocale` |
| 11 | `--locale` requires `--out`, `--pdf` or `--email` | `plan.ts` |
| 12 | `--ci` value | `args.ts` via `plan.ts` |
| 13 | empty `--ci-out` | `plan.ts` |
| 14 | `--ci-out` requires `--ci` | `plan.ts` |
| 15 | `--ci github/azure` rejects `--ci-out` | `plan.ts` |
| 16 | `--json` + stdout `--ci` conflict | `plan.ts` |
| 17 | `--baseline` requires a surface | `plan.ts` |
| 18 | `--history-limit` requires `--history` | `plan.ts` |
| 19 | non-empty `--history` requires `--out` | `plan.ts` |
| 20 | at least one input and one output → bare usage | `plan.ts` (`kind: 'usage'`) |
| 21 | empty `--logo`; `--logo` requires `--out` | `plan.ts` |
| 22 | empty `--history` requires a path | `plan.ts` |
| 23 | `--history-limit` value | `args.ts` via `plan.ts` |
| 24 | `--manifest` collision with inputs/logo/out/pdf/email/history/ci-out/baseline | `paths.ts` via `plan.ts` |
| 25 | `--manifest` relative expressibility for out/pdf/email/history/ci-out | `paths.ts` via `plan.ts` |
| 26 | `--history` collision | `paths.ts` via `plan.ts` |
| 27 | `--baseline` collision | `paths.ts` via `plan.ts` |
| 28 | `--out` overwrites an input or the logo | `paths.ts` via `plan.ts` |
| 29 | `--ci-out` collision with `--out`, an input or the logo | `paths.ts` via `plan.ts` |
| 30 | `--email` collision with `--out`, `--ci-out`, inputs, logo | `paths.ts` via `plan.ts` |
| 31 | `--pdf` collision with `--out`, `--ci-out`, `--email`, logo, inputs | `paths.ts` via `plan.ts` |
| 32 | `--meta` value | `args.ts` via `plan.ts` |
| 33 | `--max-size` value | `args.ts` via `plan.ts` |
| 34 | `--accent` value | `args.ts` via `plan.ts` |
| 35 | logo type/size/content | `logo.ts` via `plan.ts` |
| 36 | input resolution | `execute.ts` |
| 37 | early input size scan and warning | `execute.ts` |
| 38 | history read | `execute.ts` |
| 39 | baseline read | `execute.ts` |
| 40 | summary/generate branch | `plan.mode` + `execute.ts` |
| 41 | report, PDF, email, history, `--ci-out`, manifest writes | `execute.ts` |
| 42 | max-size and skipped-attachment warnings | `execute.ts` |
| 43 | CI text formatting and write | `execute.ts` |
| 44 | manifest build/serialize | `execute.ts` |
| 45 | stdout ownership and confirmations | `plan.stdout` + `execute.ts` |
| 46 | caught error → `tolkira: <detail>\n`, exit 1 | `execute.ts` |
| 47 | main-module guard | `cli.ts` |

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

- 21 unit/integration files import `runCli` directly: `baseline-helpers.ts`,
  `capabilities.test.ts`, `cli-artifacts`, `cli-ci`, `cli-edge`, `cli-email`,
  `cli-history-window`, `cli-history`, `cli-locale`, `cli-pdf`,
  `cli-size-warning`, `cli-static`, `cli.test.ts`, `inputs`, `junit`,
  `messages-producers`, `metadata-links`, `parity-metadata`, `playwright`,
  `render-retry-evidence`, `size-diagnostics`; `cli-baseline` reaches it
  through `baseline-helpers.ts`.
- E2E: 5 files import `runCli` directly — `test/e2e/helpers.ts`,
  `baseline.spec.ts`, `metadata-links.spec.ts`, `responsive.spec.ts` and
  `visual.spec.ts`. The other specs depend through the helpers.
- Bundle/tooling: `test/render-report.test.ts` builds `src/cli.ts` with
  esbuild and spawns it; `test/tooling-config.test.ts` pins `src/cli.ts` as a
  knip entry; `test/package-manifest.test.ts` pins `dist/cli.js`.

## TDD plan

Two workers: TDD-Red writes the failing tests from this design; the
implementer makes them green without weakening them. Existing CLI tests are not
edited except for a genuine import change, which this design does not expect.

### Slice 1 — plan unit (`test/cli-plan.test.ts`)

- Plan shape and defaults for every flag: mode, paths, `json`, `ci`, title
  (including empty), locale (`de-AT` keeps its tag), metadata merge, accent,
  logo data URI, `static`, `maxSizeMb` (default 10), `pdfTimeout`,
  `historyLimit`, baseline path, `writes`, `stdout`, `exitCodes`.
- Action precedence: parse error vs help; help vs version; version vs
  capabilities; capabilities alone vs capabilities plus input/valid flag;
  unknown flag still fails at `parseArgs`.
- Purity: a valid `planCli` call creates no file/directory, prints nothing and
  does not mutate argv.
- Decision table for single usage defects: every message string in the
  existing suite, pinned exactly, including bare usage.
- Precedence pairs (two defects, first one must win): at least
  `--out=`+`--pdf=`, `--manifest=`+`--static`, `--static`+`--pdf-timeout`,
  `--pdf-timeout`+`--email=`, `--locale`+`--ci`, `--ci`+`--ci-out=`,
  `--json --ci`+`--baseline`, no-input/no-output vs earlier/later checks,
  manifest collision vs invalid `--meta`, history collision vs out collision,
  out collision vs logo, ci-out collision vs email collision, email collision
  vs pdf collision.
- Boundary values: `--history-limit` 1, 365, 0, 366, `01`, `1.5`, `abc`, `''`;
  `--pdf-timeout` 1, 2,147,483,647, 2,147,483,648, `0`, `01`; `--max-size`
  `0`, negative, `Infinity`, `NaN`, tiny positive; `--meta` `=x`, `k=`,
  `k=v=w`, repeat; `--ci` case and unknown; `--accent` valid/invalid forms.

### Slice 2 — plan paths and logo (`test/cli-plan-paths.test.ts`)

- `samePath` identity through missing files, symlinked/junctioned parents and
  case folding on Windows/macOS (platform-guarded, mirroring existing tests).
- Input file, input directory (existing and missing target inside it), logo,
  each output peer, baseline and manifest collisions; exact message per flag.
  Pin the asymmetry: `--out`/`--ci-out` only fail on an existing file/logo
  replacement, while
  `--email`/`--pdf`/`--history`/`--baseline`/`--manifest` also fail for a
  missing target inside an input directory.
- Manifest relative expressibility: absolute artifact passes; a relative
  artifact that cannot be expressed fails with the exact per-flag message;
  cross-drive case guarded to Windows.
- Logo validation: missing file, unsupported extension, >2 MB, wrong magic per
  extension, valid PNG/JPEG/GIF/WebP/SVG with XML declaration and BOM-free
  handling; exact messages.

### Slice 3 — execute (`test/cli-execute.test.ts`)

- Summary mode: email-only, `--ci-out`, manifest-only, email+manifest,
  `--json` suppression; confirmations and machine bytes.
- Generate mode: report-only, PDF-only, email-only-with-report, history,
  ci-out, manifest; option object equality, `reportName` basename, PDF timeout
  pass-through.
- Resolved input once: `resolveInputFiles` is called once and its result is
  the object handed to `generateReportFromResolved`/`summarizeRunFromResolved`.
- Failure-point state table: fail report → no PDF/email/history/ci-out/
  manifest/stdout; fail PDF → report stays, later absent; fail email → report
  and PDF stay, history/ci-out/manifest/stdout absent; fail history → earlier
  stay, ci-out/manifest/stdout absent; fail ci-out → earlier stay, manifest/
  stdout absent; fail manifest → earlier stay, stdout empty. No `.tmp` remains.
- Warning order: max-size then skipped-attachment, after writes and before
  ci-out/manifest/stdout; early input warning before parse; exact bytes.
- Manifest ledger: report, PDF, email, history, ci-markdown in write order;
  history only when written; summary mode email/ci-markdown only.

### Slice 4 — end-to-end equivalence (`test/cli-equivalence.test.ts`)

- A compact argv matrix through `runCli`: help, version, capabilities,
  `--json`, report, report+json, PDF-only (mocked engine), email-only,
  ci-github, ci-azure, ci-markdown, ci-markdown+ci-out, history, baseline,
  manifest, static, locale, and representative usage failures. Pin exact code,
  stdout and stderr; the expected values are recorded from the pre-refactor
  commit before implementation.
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
- File-set proof: before/after directory listing equals the expected outputs;
  no `.tmp`, no extra directory; existing files survive a failed write.
- Determinism: two runs with the same argv and frozen clock produce identical
  bytes for JSON, CI, manifest and history.

ISTQB coverage: equivalence classes for summary vs generate and for stdout
ownership; boundary values above; decision tables for option combinations and
single errors; state transitions for the six failure points; pairwise
combinations for output collisions (`manifest × peer`, `email ×
ci-out/history/pdf`, `baseline × surface`).

## Size, stop condition and fallback

Expected result:

- `src/cli.ts`: 993 → about 100–130 lines.
- `args.ts` ~110, `logo.ts` ~60, `paths.ts` ~70, `plan.ts` ~370,
  `execute.ts` ~360.
- Total across the six files: about 1,050–1,100 lines, +60 to +110 over today
  (imports, types and the plan object), not a rewrite.

Stop conditions — stop and return to the design/user if any holds:

- an existing CLI test needs an expectation, message or order change;
- any `git diff` outside `src/cli.ts`, `src/cli/**`, the new CLI tests,
  `docs/ARCHITECTURE.md`, `GLOSSARY.md` and this change appears (except a
  mechanical import change);
- the plan/execute boundary needs a new catch, a new validation, a new
  message, or a reordered check to compile;
- total line growth exceeds +20% (about 1,190 lines) or a module other than
  `cli.ts` exceeds 430 lines;
- the write-order or failure-point table cannot be reproduced without adding
  a hook or abstraction.

Fallback first slice (if the full split cannot stay identical): extract
`src/cli/args.ts` and a pure `planOptions(argv)` covering only the contiguous
block that ends before the filesystem path checks (parse, help/version/
capabilities, empty paths, option dependencies, `--pdf-timeout`, locale, CI,
`--history-limit`, at-least-one, logo/history empty checks, history-limit
value). Return a partial `CliPlan` and leave path checks, metadata/logo reads
and execution in `cli.ts` untouched. That removes about 450 lines, establishes
the plan type and keeps the exact error order because the extracted block is
contiguous at the top. Deferred to a follow-up: path plan, execute split,
write ledger and the execute/equivalence test slices.

## Risks

1. **Usage-error precedence drift.** 38 exit-2 sites are interleaved with
   filesystem checks. Moving all pure checks before path checks (or the
   reverse) changes which error a multi-defect argv sees. Mitigation: the
   ordered table above is normative; precedence-pair tests; side-by-side diff.
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
   errors. PIR/DXR should confirm this is acceptable.
8. **Unhandled-rejection parity.** Path checks currently sit outside the exit-1
   catch. Do not add a catch around them; only the metadata/max-size/accent/
   logo block maps to exit 2.
9. **Bundle/type surface.** New internal `dist/cli/*.d.ts` files appear.
   `src/index.ts` and `dist/index.d.ts` must stay unchanged; `npm run
   package:check` confirms the tarball has no unexpected path change beyond
   `dist/` contents.
10. **Coverage and suite bloat.** Four new test files must cover the new
    modules without duplicating the 12 existing CLI files. Mitigation: plan/
    execute/equivalence scopes only; STR reviews test health.
11. **Cross-platform tests.** Case folding, junctions and cross-drive paths
    differ by host. Mitigation: platform guards like the existing suite.
12. **Golden brittleness.** No HTML/email byte goldens across Node/Intl
    versions; use direct API equivalence and frozen clocks for machine bytes.

## PIR / DXR questions

PIR (Parity & Vision):

- Is every user-visible CLI surface (flags, help, capabilities, errors, write
  order, exit codes) explicitly covered by the no-visible-change contract?
- Does the refactor accidentally modernize path validation or reorder errors
  in a way a user or script could observe?
- Are B-056, B-065 or the research's table-driven path plan being smuggled in?
  (They must not be.)
- Is any report, email, PDF or summary byte affected? (No module outside the
  CLI seam is touched.)
- Is the fallback slice small enough to be safe if the full split is not
  provably identical?

DXR (Developer Experience & Integration):

- Can a fresh agent find the seam from `docs/ARCHITECTURE.md`, `GLOSSARY.md`
  and the module names, and add a new output in one place (plan slot → write
  order → confirmation → test matrix)?
- Does every existing importer, e2e helper, bundle entry and package check
  keep working with no import change?
- Is the failure model clear: plan failure = 2 with usage text, execute
  failure = 1 with `tolkira:`, success = 0?
- Does the resolved-input seam stay internal, and is the public `.d.ts`
  unchanged?
- Are the new tests the right size, or do they duplicate the existing CLI
  suite?
- Is the bundle still built from `src/cli.ts` with the shebang and no new
  dependency?
