# Tolkira architecture review, November 2026

Status: research note. No source, test, spec, config or package file was
changed, staged or committed.

Scope: `src/` at commit `41c1a3b` on `main` (0.6.0), plus `package.json`,
`tsconfig*.json`, `esbuild.mjs`, `docs/` and a read-only look at `dist/`.
Every `src/**/*.ts` file was read, not sampled.

Method: the deep-module vocabulary from the codebase-design skill: **module**,
**interface**, **seam**, **depth**, **leverage**, **locality**. Depth is
judged as leverage at the interface, not as implementation size.

Measured totals: 60 files in `src/`, 15,733 lines. Of these, 56
TypeScript/CTS files hold 14,076 lines, 638 lines are CSS and 1,019 lines are
locale JSON. Counted with the commands in Appendix A.

The short answer: the codebase is unusually disciplined for its size. Its
weakest points are not type escapes or dependencies; they are a few wide
interfaces at the seams where the CLI, the input pipeline and the renderer
meet, and a set of duplicated vocabularies that no module owns.

---

## 1. Map

`in` is the number of `src` modules that import the module; tests are
excluded. `out` is the number of distinct modules or packages it imports. A
dynamic `import()` counts as an edge. Type-only edges count.

### 1.1 Layer totals

| Layer | Files | Lines | Share of `src` |
|---|---:|---:|---:|
| CLI and run assembly | 5 | 1,072 | 6.8% |
| Input adapters | 9 | 3,952 | 25.1% |
| Model and shared leaves | 7 | 1,597 | 10.2% |
| Report renderer (TS) | 20 | 3,543 | 22.5% |
| i18n (TS + catalogs) | 3 | 1,072 | 6.8% |
| Output and derived artifacts | 9 | 2,420 | 15.4% |
| Compatibility shim | 3 | 420 | 2.7% |
| CSS and locale data | 4 | 1,657 | 10.5% |

The input layer is the largest code layer; the renderer is the largest
hand-written cluster after it. The model is small because it is a view model;
the adapters carry the normalisation cost.

### 1.2 CLI and run assembly

| Module | LOC | in/out | Responsibility and callers |
|---|---:|---:|---|
| `src/cli.ts` | 779 | 0/19 | Arg parsing, path validation, output order, warnings. `bin` entry (`package.json:40`); 11 CLI test files. |
| `src/index.ts` | 73 | 2/9 | Public API facade, version, re-exports. Called by `cli` (version) and `compat`; package entry. |
| `src/run.ts` | 149 | 2/9 | Load, sanitise, index, compare, summarise, render. Called by `cli` and `index`. |
| `src/stream.ts` | 39 | 1/4 | `CucumberHtmlStream` Transform; buffers and renders on flush. Exported by `index`. |
| `src/options.ts` | 32 | 3/2 | Public report option types and `renderOptions` projection. Used by `index`, `run`, `stream`. |

### 1.3 Input adapters

| Module | LOC | in/out | Responsibility and callers |
|---|---:|---:|---|
| `src/input/load.ts` | 318 | 4/10 | Resolve, read, dedupe, dispatch, duplicate-id check, provenance. Called by `cli`, `index`, `run`, `compat/options`. |
| `src/input/detect.ts` | 119 | 1/3 | Pure content sniffing into nine decision kinds. Called by `load`. |
| `src/input/files.ts` | 41 | 3/2 | Directory scan with depth, symlink and extension rules. Called by `load`, `output`, `compat/options`. |
| `src/input/messages.ts` | 264 | 2/1 | NDJSON parse and strict envelope validation. Called by `load`, `detect`. |
| `src/input/legacy.ts` | 932 | 2/2 | Legacy Cucumber JSON to Messages, attachments included. Called by `load`, `junit`. |
| `src/input/junit.ts` | 429 | 2/3 | JUnit XML to legacy-shaped values, then through `legacy`. Called by `load`, `detect`. |
| `src/input/playwright.ts` | 1,729 | 1/6 | Playwright JSON to Messages, retries and path attachments. Called by `load`. |
| `src/input/sanitize.ts` | 108 | 3/2 | Trust boundary: remote/external attachments, caps, remote Markdown images. Called by `run`, `summary`, `render/html`. |
| `src/input/background.ts` | 12 | 2/1 | WeakSet mark for synthetic legacy backgrounds. Called by `legacy`, `report/model`. |

### 1.4 Model and shared leaves

| Module | LOC | in/out | Responsibility and callers |
|---|---:|---:|---|
| `src/report/model.ts` | 902 | 10/9 | `ReportModel`: features, scenarios, steps, hooks, counts. Called by every renderer view and `run`, `html`, `format`, `types`. |
| `src/report/index-run.ts` | 311 | 5/1 | Shared envelope index; a second pass keeps attempt order. Called by `model`, `run`, `summary`, `html`, `types`. |
| `src/report/status.ts` | 51 | 9/1 | `ReportStatus`, severity order, worst executed status. Called by model, summary, baseline, renderer. |
| `src/attachment.ts` | 115 | 6/1 | Caps, media allowlist, byte accounting, fallback names, text format. Called by input, model, summary, renderer. |
| `src/text.ts` | 152 | 12/0 | ANSI/bidi/control stripping and `oneLine`. Bottom of the graph; no project imports. |
| `src/attempt-diagnostics.ts` | 52 | 3/0 | Non-protocol skip and retry-evidence marks in WeakMap/WeakSet. Called by Playwright adapter, model, report view. |
| `src/result-message.ts` | 14 | 2/1 | Picks the readable message from a step result. Called by model and summary. |

### 1.5 Report renderer

| Module | LOC | in/out | Responsibility and callers |
|---|---:|---:|---|
| `src/render/html.ts` | 98 | 2/17 | Shell, CSP hashes, assembly, size post-process. Called by `run`, `stream`. |
| `src/render/report.ts` | 839 | 1/14 | Report view: header, toolbar, features, scenarios, steps, hooks, baseline join. Called by `html`. |
| `src/render/details.ts` | 145 | 1/10 | Details view plus `applyReportSize`. Called by `html`. |
| `src/render/trends.ts` | 224 | 1/7 | Trends table and sparkline. Called by `html`. |
| `src/render/triage.ts` | 165 | 1/7 | Needs-attention index and source strip. Called by `report`. |
| `src/render/matrix.ts` | 43 | 1/5 | Feature-by-status matrix. Called by `details`. |
| `src/render/attachments.ts` | 168 | 2/6 | Image, video, audio, text, log and file rendering. Called by `report`, `details`. |
| `src/render/ci.ts` | 109 | 2/5 | CI header and detail rows. Called by `report`, `details`. |
| `src/render/baseline.ts` | 84 | 1/6 | Comparison panel and row badges. Called by `report`. |
| `src/render/format.ts` | 301 | 9/7 | Status, duration, date, size, bar, pass-rate and tag helpers. Called by most views and `email`. |
| `src/render/types.ts` | 37 | 5/6 | `RenderOptions`, `DisplayStatus`, `OrderedFeature`. Type surface for the shell. |
| `src/render/escape.ts` | 20 | 13/1 | HTML escaping plus bidi stripping. Widely used foundation. |
| `src/render/markdown.ts` | 95 | 1/3 | Restricted Markdown for descriptions. Called by `report`. |
| `src/render/dom-contract.ts` | 108 | 6/2 | Server/client data attributes, ids and visibility decisions. Called by views and the client. |
| `src/render/search.ts` | 170 | 2/1 | Tag expression, URL state and open-row helpers. Called by `dom-contract`, `report-client`. |
| `src/render/ansi.ts` | 234 | 1/3 | ANSI log to safe HTML. Called by `attachments`. |
| `src/render/report-client.ts` | 694 | 0/3 | Browser entry: tabs, filters, highlight, copy, lightbox, URL state. Client bundle entry. |
| `src/render/print-script.ts` | 4 | 1/0 | Minified print lifecycle string. Called by `html`. |
| `src/render/styles.ts` | 3 | 1/0 | Generated CSS strings. Called by `html`. |
| `src/render/client-bundle.ts` | 2 | 1/0 | Generated client script string. Called by `html`. |

### 1.6 i18n

| Module | LOC | in/out | Responsibility and callers |
|---|---:|---:|---|
| `src/render/i18n.ts` | 399 | 13/1 | Locale resolution, message parser, translator, Intl caches. Called by every view and `email`. |
| `src/render/client-i18n.ts` | 51 | 1/0 | Browser-side formatter for embedded `client.*` messages. Called by `report-client`. |
| `src/i18n/catalogs.ts` | 622 | 1/0 | Generated `MessageKey` union and catalogs. Called by `render/i18n`. |
| `src/i18n/locales/en.json` | 814 | 1/0 | Source catalog with descriptions; fallback. Read by the build. |
| `src/i18n/locales/de.json` | 205 | 1/0 | German catalog. Read by the build. |

The two catalogs have 203 keys each. The generated union is the single key
contract (`src/i18n/catalogs.ts:1`), and the client bundle contains no
non-English catalog.

### 1.7 Output and derived artifacts

| Module | LOC | in/out | Responsibility and callers |
|---|---:|---:|---|
| `src/summary.ts` | 432 | 14/8 | Stable schema-2 JSON summary. Called by `run`, `cli`, `ci`, `email`, `history`, renderer types. |
| `src/baseline.ts` | 530 | 8/4 | Read-only baseline reader, matcher and classification. Called by `cli`, `run`, `render`, `options`. |
| `src/history.ts` | 466 | 6/6 | History sidecar schema, validation, append, atomic write. Called by `cli`, `run`, `index`, `render/trends`. |
| `src/ci.ts` | 469 | 1/2 | GitHub, Azure and Markdown CI formatting. Called by `cli`. |
| `src/email.ts` | 236 | 2/6 | HTML email summary. Called by `cli`, `index`. |
| `src/pdf.ts` | 142 | 2/3 | Optional Playwright PDF. Called by `cli`, `index`. |
| `src/output.ts` | 93 | 3/5 | Atomic write, path identity, overwrite check. Called by `cli`, `history`, `compat`. |
| `src/warnings.ts` | 36 | 2/0 | Shared warning copy. Called by `cli`, `compat`. |
| `src/validation.ts` | 16 | 3/0 | Accent and logo data-URI validation. Called by `cli`, `html`, `email`. |

`src/ci.ts` and `src/render/ci.ts` share a name and nothing else: one formats
workflow commands, the other renders header/detail markup.

### 1.8 Compatibility shim

| Module | LOC | in/out | Responsibility and callers |
|---|---:|---:|---|
| `src/compat/cucumber-html-reporter.ts` | 201 | 1/5 | `generate(options, callback?)` shim, sidecar merge. Called by the CJS wrapper. |
| `src/compat/options.ts` | 193 | 2/6 | Option mapping, ignored-option warnings, input resolution. Called by the shim and wrapper types. |
| `src/compat/cucumber-html-reporter.cts` | 26 | 0/2 | CJS `export =` wrapper with dynamic ESM import. Require condition. |

### 1.9 Graph notes

- The main direction is `input -> model -> render`, with `run` above all
  three and `cli`/`index` above `run`.
- Fan-in hubs: `summary.ts` (14), `render/i18n.ts` (13), `render/escape.ts`
  (13), `text.ts` (12), `report/model.ts` (10), `render/format.ts` (9),
  `report/status.ts` (9).
- Fan-out leaders: `cli.ts` (19), `render/html.ts` (17), `render/report.ts`
  (14).
- The only internal cycle is `baseline.ts -> summary.ts -> baseline.ts`
  (`src/baseline.ts:3`, `src/summary.ts:10-14`). The `summary -> baseline`
  half is type-only; `verbatimModuleSyntax` erases it, so the runtime graph
  is one-way. A future runtime import in that direction would create a real
  cycle.
- Three upward or sideways edges break the stated layer order:
  `render/html.ts` imports `input/sanitize.ts` (`src/render/html.ts:3`);
  `render/types.ts` imports model, summary, baseline, history and index types;
  `email.ts` imports `render/format.ts` and `render/i18n.ts`.
- `output.ts` imports `input/files.ts` (`src/output.ts:5`) so the overwrite
  check can scan a directory. It is a path utility living in the input layer.

---

## 2. Verdict against 2026 TypeScript practice

The criteria are the expectations a published TypeScript library is held to
now: strictness without escape hatches, an explicit module and package shape,
a small typed public surface, a clean CLI/library seam, a typed error
taxonomy, disciplined async I/O, a small dependency surface, single owners
for shared vocabulary, navigable file sizes, tests at the public seam,
generated artifacts that cannot drift, a build that matches the source graph,
and documentation an agent can act on.

### 2.1 Strictness and type escapes

**Verdict: weak, close to pass.**

`strict: true` is on (`tsconfig.json:7`), `verbatimModuleSyntax` is on
(`tsconfig.json:12`), and the source contains no `any` type annotation. A
text search finds `any` only in comments and one local variable named `any`
(`src/render/report-client.ts:180`). There is no `@ts-ignore`,
`@ts-expect-error` or `@ts-nocheck` anywhere in `src`. The two lint
suppressions are for control-character regexes and carry a reason
(`src/text.ts:3`, `src/text.ts:13`).

There are only three non-null assertions in hand-written code:
`src/input/junit.ts:147`, `src/input/junit.ts:204` and
`src/compat/options.ts:154`. Each is guarded by a preceding check, but each is
still an assertion the compiler cannot see.

Most of the roughly 90 `as` expressions (the scan includes comment prose, so
treat that as an upper bound) sit at untrusted-input boundaries where the
value has just been shape-checked: `src/baseline.ts:188`,
`src/history.ts:130`, `src/input/messages.ts:94`. That is the right place for
casts. The weak part is the compiler settings around them:

- `noUncheckedIndexedAccess` is absent (`tsconfig.json:2-15`). Indexed access
  is therefore typed as the element type, and the code compensates with
  `as string` on `text[index]` in the scanners (`src/text.ts:82`,
  `src/render/i18n.ts:139`, `src/render/search.ts:42`). Turning the flag on
  would find real edge cases, especially in the parsers, but it is a large
  diff.
- `exactOptionalPropertyTypes` is absent, while the code relies heavily on
  conditional spreads to avoid writing `undefined` into optional fields
  (`src/report/model.ts:754-790` is the clearest example). The style suggests
  the flag was intended; enabling it would make that intent enforceable.
- One `tsconfig.json` serves both Node and browser code. `lib` includes `DOM`
  and `types` includes `node` (`tsconfig.json:4`, `tsconfig.json:14`), so the
  server can use `document` and the client can use `process` without a type
  error. `src/pdf.ts:112-122` legitimately uses DOM types inside
  `page.evaluate`; `src/render/report-client.ts` legitimately uses DOM. A
  separate client config (`lib: ["DOM"]`, no `node` types) and a server
  config without `DOM` would enforce the seam that the file layout already
  suggests.
- `target` is `ES2022` (`tsconfig.json:3`) while `engines.node` is `>=22`
  (`package.json:37`). This is harmless but leaves ES2023/2024 built-ins
  unused.

### 2.2 ESM and module shape

**Verdict: pass.**

`"type": "module"` (`package.json:5`), `module`/`moduleResolution` both
`NodeNext` (`tsconfig.json:5-6`), `.js` specifiers in relative imports, and
`verbatimModuleSyntax`. There are no path aliases and no build-time module
rewriting. The root package is ESM-only, and the single CommonJS exception is
isolated in `src/compat/cucumber-html-reporter.cts` with its own tsconfig and
export condition, as ADR 0002 requires.

The only cycle is type-only (Section 1.9). That is acceptable but fragile:
`src/baseline.ts` imports `displayUri` as a runtime value from
`src/summary.ts:3`, while `src/summary.ts` imports baseline types. The
architecture document already records the direction
(`docs/ARCHITECTURE.md:224-227`); the risk is that a future runtime helper in
`summary.ts` that calls into `baseline.ts` would close the loop.

One dependency-classification defect belongs here: `src/render/search.ts:1`
imports `@cucumber/tag-expressions` as a runtime value, but the package is a
devDependency (`package.json:107`). esbuild bundles it, so the published
artifact works today (`esbuild.mjs:12` only externalises `dependencies` and
`playwright-core`). Any future decision to externalise it, or any consumer
who compiles the source, would fail at runtime. The dependency belongs in
`dependencies`, or the tag-expression parser should be treated as part of the
browser bundle only.

### 2.3 Public API surface and `.d.ts`

**Verdict: weak.**

The facade is small and coherent: `src/index.ts` is 73 lines, and the built
`dist/index.d.ts` exposes 20 value exports and 13 type exports. The five
functions are `generateReport`, `renderReport`, `summarizeReport`,
`renderEmail` and `renderPdf`; `CucumberHtmlStream` is the stream adapter
(`src/index.ts:46-73`). Passing a validated `BaselineSummary` instead of a
path is the right API decision (`src/options.ts:18-21`), and the history
helpers are exported deliberately (`src/index.ts:25-37`).

The weak points are packaging, not naming:

- `version` is hardcoded at `src/index.ts:12` and duplicates
  `package.json:3`. `phase = 'development'` at `src/index.ts:13` is internal
  state exposed as public API. A build-time define for the version and no
  `phase` would be smaller and safer.
- Declarations are emitted per module (`tsconfig.build.json:4-8`), so
  `dist/index.d.ts` re-exports from `./run.js`, `./summary.js` and the other
  internal modules. Every internal `.d.ts` ships. The `exports` map blocks
  deep imports (`package.json:42-58`), so this is not a leak, but it is a
  larger type surface than the 73-line source suggests and it exposes
  internal module names to editors and agents.
- `renderHtml` and `RenderOptions` are not public, although 31 test files
  import `render/html.js`. That is a deliberate internal seam, but it means
  the real renderer interface is only discoverable by reading the source.
  Either publish a supported renderer entry or state explicitly that the
  renderer is private.

### 2.4 Boundary between CLI and library

**Verdict: weak.**

The good half: the library owns input resolution, history and baseline
reading, and output formatting; it returns strings and bytes and writes only
when asked (`writeHistory`). The CLI owns file writing, the PDF/email order
and the human confirmations. No library module imports the CLI.

The weak half is that the CLI knows the pipeline stages. It imports
`resolveInputFiles`, `scanInputBytes`, `generateReportFromResolved` and
`summarizeReportFromResolved` directly (`src/cli.ts:17-24`), because the
early warning and the one-resolve contract require it. That is documented
(`docs/ARCHITECTURE.md:346-356`), but it means the "library facade" is not
one call; it is three entry points plus the loader.

Output-path safety is only in the CLI. `pathConflicts` takes eight positional
parameters (`src/cli.ts:194-211`), and the collision checks are six top-level
blocks with nested checks (`src/cli.ts:501-612`). An API caller who writes
`generateReport(...).html` has no equivalent guard, and a new output flag
must edit several blocks. The matrix is currently complete for the documented
flags, but its shape invites omissions.

The trust boundary is enforced twice. `run.loadRun` sanitises the flattened
envelopes (`src/run.ts:66-68`), then `renderHtml` sanitises the same array
again (`src/render/html.ts:53`). `sanitizeEnvelopes` is idempotent, so the
result is correct, but the renderer is both presentation and input gate, and
the CLI path pays for two passes over every attachment.

### 2.5 Error taxonomy and exit codes

**Verdict: pass for the CLI contract, weak for library consumers.**

The CLI contract is clear and documented: 0 success, 1 parse/render/write
error, 2 usage error (`docs/AGENT-INTERFACE.md:34-38`). The implementation
matches: usage errors return 2 before any write (`src/cli.ts:314-316`),
runtime failures return 1 with one line (`src/cli.ts:756-759`), and success
returns 0. `oneLine` keeps paths and messages on one line
(`src/text.ts:12-15`).

The weak half is the taxonomy inside the library. `BaselineValidationError`
and `HistoryValidationError` are private classes used for control flow
(`src/baseline.ts:64`, `src/history.ts:51`). A library caller gets a plain
`Error` with prose, no `code`, no exported class and no distinction between
"bad file", "bad option" and "I/O failed". Exit codes are the only stable
machine signal. For an agent-driven tool that is workable; for an embedding
library it is thin.

The CLI encodes usage errors as 38 `return 2` sites and 42 `io.stderr` calls
in one file (`src/cli.ts`). The messages are good, but the repetition is the
main reason the function is hard to change safely.

### 2.6 Async and I/O discipline

**Verdict: pass, with ambient `cwd` as the weak spot.**

I/O is asynchronous and explicit. Inputs are read with `readFile`
(`src/input/load.ts:153`); the baseline and history readers open a
`FileHandle`, check the descriptor, cap the size and read in a loop
(`src/baseline.ts:117-154`, `src/history.ts:314-336`); writes go through a
temporary file and `rename` (`src/output.ts:75-93`); the PDF engine has
deadlines and a bounded close (`src/pdf.ts:57-87`). The email renderer is
pure and synchronous (`src/email.ts:181`).

Two weak spots:

- `process.cwd()` is read inside the Playwright adapter at four sites
  (`src/input/playwright.ts:605`, `:653`, `:941`, `:1569`) and in the PDF
  loader (`src/pdf.ts:32`). Allowed roots and module resolution therefore
  depend on ambient state. A `roots` or `cwd` option on the adapter would be
  a real seam and would let tests stop relying on the process directory.
- `renderHtml` is declared `async` but contains no `await`
  (`src/render/html.ts:48-97`). `run.render` returns its promise
  (`src/run.ts:88-104`), and the stream wraps it in `.then`
  (`src/stream.ts:27-37`). It is harmless, but it blurs "async because I/O"
  and makes synchronous callers pay a microtask for no reason.

`realpathSync` appears in `src/output.ts:43` and `src/cli.ts:768`. The first
is on the path-identity hot path, the second only in the main-module check.
Neither blocks meaningfully, but a library that otherwise uses async I/O has
two synchronous filesystem calls.

### 2.7 Dependency surface

**Verdict: pass, with one classification fix.**

Three runtime dependencies (`@cucumber/messages`, `fast-xml-parser`,
`markdown-it`), one optional peer (`playwright-core`), eight dev
dependencies (`package.json:101-123`). `fast-xml-parser` is dynamically
imported only in the XML path (`src/input/junit.ts:365`); `markdown-it` is
used only for descriptions (`src/render/markdown.ts:5`); Messages is the
model. The optional PDF engine is externalised (`esbuild.mjs:12`) and loaded
lazily (`src/pdf.ts:26`). This is a small, honest surface, and the package
test pins it (`test/package-pdf.test.ts:37-50`).

The one defect is `@cucumber/tag-expressions` in `devDependencies`
(`package.json:107`) while runtime source imports it (`src/render/search.ts:1`).
See Section 2.2. Move it to `dependencies`, or make the dependency on it
explicitly build-time only and never externalise it.

### 2.8 Duplication

**Verdict: weak.**

Some duplication is deliberate and healthy: the report model and the summary
are two projections with different policies, and
`test/model-summary-cross-check.test.ts` guards their shared facts. The
duplication that hurts is the vocabulary nobody owns:

- The status set is declared at least eight times:
  `src/report/model.ts:220-228`, `src/summary.ts:99-107`,
  `src/baseline.ts:11-19`, `src/history.ts:40-48`,
  `src/render/format.ts:16-24` and `:76-84`, `src/email.ts:31-39`,
  `src/render/trends.ts:42-49`, and `src/ci.ts:16-34`.
  `src/report/status.ts:3-20` holds the type and the severity order, but not
  the list or the label keys.
- Duration and count helpers are duplicated between the model and the
  summary: `src/report/model.ts:237-251` versus `src/summary.ts:156-170`, and
  `src/report/model.ts:400-416` versus `src/summary.ts:116-154`.
- The sidecar readers duplicate `excerpt` (`src/baseline.ts:77-91`,
  `src/history.ts:77-91`) and `readBounded` (`src/baseline.ts:93-107`,
  `src/history.ts:293-307`). More importantly, they disagree: the baseline
  reader decodes strict UTF-8 (`src/baseline.ts:109-115`), while the history
  reader calls `Buffer.toString('utf8')` (`src/history.ts:306`), which
  replaces invalid bytes. The baseline reader strips a BOM
  (`src/baseline.ts:223`); the history reader does not (`src/history.ts:360`).
  The second difference is the subject of the in-flight 0.6.1 change.
- Path containment is implemented four times: `samePath`/`canonicalPath` in
  `src/output.ts:41-73`, `canonicalPath` in `src/input/load.ts:45-51`,
  `isInside` in `src/cli.ts:170-179`, and `isInside`/`relativeFile` in
  `src/input/playwright.ts:589-617`.
- `version` is duplicated between `src/index.ts:12` and `package.json:3`; the
  locale list is duplicated between `src/cli.ts:64` and
  `src/render/i18n.ts:29`.

### 2.9 Naming

**Verdict: weak.**

Most names match the glossary and the architecture document, which is a real
strength for agents. The collisions are avoidable:

- `src/ci.ts` (workflow commands) and `src/render/ci.ts` (header markup) are
  different modules with the same name.
- `src/attachment.ts` (shared leaf) and `src/render/attachments.ts`
  (renderer) differ only by a plural.
- `src/options.ts` (public report options) and `src/render/types.ts`
  (renderer options, `DisplayStatus`, `OrderedFeature`) both own option
  types.
- `src/report/model.ts` is the report view model, while `src/summary.ts` is
  the machine model. "Model" alone does not say which contract it is.
- `src/render/details.ts` owns the Details view and `applyReportSize`, a
  whole-document post-processor called by `html.ts`
  (`src/render/details.ts:26-43`, `src/render/html.ts:97`). The name does not
  announce that second job.
- `phase` (`src/index.ts:13`) is a state name with no documented meaning for
  consumers.

### 2.10 File size and locality

**Verdict: weak.**

Twelve hand-written source files exceed 400 lines:

| File | LOC | Mixed responsibilities |
|---|---:|---|
| `src/input/playwright.ts` | 1,729 | Validation, planning, attachment I/O, path scrubbing, envelope emission |
| `src/input/legacy.ts` | 932 | Validation, AST mapping, pickle/test-case construction, attachments |
| `src/report/model.ts` | 902 | Attachment mapping, earlier attempts, per-pickle rows, run hooks, counts |
| `src/render/report.ts` | 839 | Header, toolbar, grouping, rules, scenarios, steps, search text |
| `src/cli.ts` | 779 | Parsing, path matrix, logo reading, all outputs, confirmations |
| `src/render/report-client.ts` | 694 | Tabs, filters, highlight, copy, lightbox, URL state, scroll |
| `src/baseline.ts` | 530 | Bounded reader, validator, matcher, classifier |
| `src/ci.ts` | 469 | Three CI formats and their escaping rules |
| `src/history.ts` | 466 | Reader, writer, schema choice, validation, pruning |
| `src/summary.ts` | 432 | Per-pickle loop, step rows, counts, identities |
| `src/input/junit.ts` | 429 | XML safety scan, parser, suite mapping, legacy handoff |
| `src/render/report.css` | 566 | Shell, views, print, responsive rules |

`src/render/i18n.ts` is just under the line at 399 and has the same
mixed-responsibility shape. Length alone is not a defect:
`render/report.ts` is a template file and `report-client.ts` is a browser
script; both are naturally long. The defect is mixed responsibility. `playwright.ts` is the clearest case: a validator, a
planner, an attachment reader and an envelope writer in one file, all sharing
a mutable `PlanContext` with 14 fields (`src/input/playwright.ts:180-195`).
`cli.ts` is the second: one `runCli` function spans lines 301-761 (461 lines)
and contains 38 `return 2` sites.

### 2.11 Test seams

**Verdict: pass, with a caveat.**

The suite is large and serious: 90 unit test files, 28 Playwright specs, 157
fixture files, 33,360 lines of top-level test code against 14,076 lines of
source TypeScript. There is a characterization suite with eleven hashes
(nine fixtures, two history) and two golden HTML files, a model/summary
cross-check, 11 CLI test files, and
dedicated security, i18n and PDF tests. This is the main reason a deep
refactor is feasible at all.

The caveat is where the tests cross the seam. Fifty-two test files import the
public `src/index.js`, which is good. Thirty-one import `render/html.js` and
nineteen import `report/model.js`; `test/render-helpers.ts:11-17` builds HTML
from `renderHtml(parseMessages(...))`, bypassing input resolution and the
`run` assembly. That is appropriate for renderer unit tests, but it means the
deepest module (`run.ts`) is tested mostly through the CLI and through
byte-level goldens, not through its own interface. `loadEnvelopes` is an
explicit test seam in production code (`src/input/load.ts:265-271`).

The characterization hashes are a double-edged tool: they make byte-level
regressions visible and make byte-level cleanup expensive. Any refactor that
changes whitespace must re-pin them intentionally, as the 0.6.1 design
already plans to do.

### 2.12 Generated artifacts

**Verdict: weak.**

Three generated modules are tracked: `src/i18n/catalogs.ts` (29,948 bytes),
`src/render/styles.ts` (42,259 bytes) and `src/render/client-bundle.ts`
(16,135 bytes). A fourth, `src/render/print-script.ts` (950 bytes), is a
hand-minified constant. Together they are about 89 KB, roughly 14% of the
622,178 bytes under `src`. The three generated modules carry a "do not edit" header
(`src/i18n/catalogs.ts:1`, `src/render/styles.ts:1`,
`src/render/client-bundle.ts:1`), and the build scripts enforce real
invariants: catalog key parity and non-empty translations
(`scripts/build-i18n.mjs`), and a 16,000-byte client budget
(`scripts/build-search.mjs`).

The gap is drift detection. `npm run check` regenerates the artifacts before
typecheck, build and test (`package.json:94`), so a committed generated file
that is stale or hand-edited is overwritten in CI and never compared. The
build then succeeds from the regenerated file, and the repository keeps the
wrong bytes. A `git diff --exit-code` after `npm run assets`, or a
`--check` mode in the three build scripts, would close this. The hygiene
script cannot help: it only rejects generated *directories* such as `dist`
(`scripts/check-hygiene.mjs:23`).

`src/render/print-script.ts` is a special case: a 950-byte hand-minified
string with no source file and no build step. It is reviewed as source but
maintained as minified output. It deserves either a readable source plus a
build step, like the client bundle, or a comment that states the editing
rules.

### 2.13 Build shape

**Verdict: pass, with a weak package shape.**

The build is two esbuild bundles and declaration-only `tsc`
(`package.json:80`, `esbuild.mjs:16-36`, `tsconfig.build.json:4-8`). Runtime
dependencies stay external, `playwright-core` stays external, and the compat
shim reuses `../index.js` instead of bundling a second copy
(`esbuild.mjs:31-36`). Source maps are emitted. The compat CJS wrapper is
built separately and copied by `scripts/copy-compat-cjs.mjs`.

Measured `dist/` sizes: `index.js` 349,644 bytes, `cli.js` 388,658 bytes,
with source maps of 660,972 and 728,076 bytes. Both bundles contain the
library and the 16 KB client script, so the tarball carries two copies of the
library code. For a package this size that is acceptable, and ADR 0002 chose
bundling deliberately. The weak points are downstream of that choice: no
rolled-up declaration file, no `sideEffects` declaration, and no subpath
imports for the renderer. Do not change the bundling decision without a
measured reason; just be aware that the shipped graph is not the source
graph.

### 2.14 Documentation for agents

**Verdict: pass.**

`docs/AGENT-INTERFACE.md` is 998 lines and is a real contract: CLI, exit
codes, schema 2, field-by-field rules, baseline, history, email, PDF, static,
limits and a recommended agent workflow. `llms.txt` is 75 lines of start-here
links and rules. `GLOSSARY.md` is 376 lines and keeps the model vocabulary
stable. `docs/ARCHITECTURE.md` is 604 lines and maps each component to its
module.

I checked the documented exit codes, summary fields, history schema and
baseline rules against the code and found no contradiction. The weak point is
maintenance, not content: the JSON examples and the field tables are
hand-written and not generated from `ReportSummary`, so a schema-compatible
field rename can leave the docs stale while the tests stay green. A small
test that parses the example JSON in `AGENT-INTERFACE.md` and checks its keys
against the current type would catch the common case.

### 2.15 Verdict at a glance

| Area | Verdict |
|---|---|
| Strictness and type escapes | Weak (good discipline, missing two flags and one tsconfig split) |
| ESM and module shape | Pass |
| Public API and `.d.ts` | Weak (packaging, version, internal type graph) |
| CLI/library boundary | Weak (path matrix and double sanitise) |
| Error taxonomy and exit codes | Pass for CLI, weak for library |
| Async and I/O discipline | Pass (ambient `cwd` is the weak spot) |
| Dependency surface | Pass (one dev/runtime misclassification) |
| Duplication | Weak (status, sidecar, path, duration) |
| Naming | Weak (two `ci` modules, two option modules) |
| File size and locality | Weak (12 files over 400 lines) |
| Test seams | Pass (with a public-seam caveat) |
| Generated artifacts | Weak (no drift check) |
| Build shape | Pass (weak package shape) |
| Docs for agents | Pass (hand-written examples can drift) |

Six passes, one mixed area and seven weak areas. None of the weak areas is a
correctness emergency; they are the places where a careful deepening change
buys the most leverage.

---

## 3. Deep-module candidates, ranked

The ranking is by leverage per unit of risk. Each candidate keeps its public
interface or changes it only where stated. "Effort" is S (under a day), M
(one to three days) and L (more than three days) for an implementer who knows
the gate.

### 3.1 CLI plan/execute seam

**As it is.** `src/cli.ts` is 779 lines. `runCli` spans lines 301-761. The
file returns 2 at 38 sites and writes to stderr at 42. `pathConflicts` takes
eight positional parameters, six of them optional string slots
(`src/cli.ts:194-211`). The collision checks are six top-level blocks between
lines 501 and 612, several with nested checks. `isInside` and `conflictsWithInputs` are local helpers
(`src/cli.ts:170-192`).

**What the interface leaks.** A caller must know every output slot, the order
of the positional parameters, which errors are usage errors, which checks run
before a read, and the write order (report, PDF, email, history, `--ci-out`,
stdout). Adding an output means editing several blocks and hoping the matrix
stays complete.

**Smaller interface.** Keep `runCli(argv, io)` as the only exported entry.
Inside, introduce `planCli(argv): CliPlan` (pure, throws a `UsageError` with
the message and usage text) and `executePlan(plan, io): Promise<number>`.
`CliPlan` holds a keyed `OutputPlan` (`out`, `pdf`, `email`, `ciOut`,
`history`, `baseline`) and an input list. A single internal
`assertNoCollisions(slots, inputs)` walks the keyed record. The six top-level
blocks become one loop over slots.

**What moves behind it.** `parseArgs` wiring, value parsers, usage text
pairing, path canonicalisation, logo validation, collision checks, write
order, warnings and confirmations.

**Call sites.** Only `runCli` and the `bin` entry. `src/index.ts` imports
`version` and is unchanged. The 11 CLI test files keep calling `runCli`.

**Effort: M. Risk: medium.** Exit codes and error strings are a documented
contract (`docs/AGENT-INTERFACE.md:34-38`), and the CLI tests assert bytes and
messages. A table-driven rewrite can preserve both, but it must not "improve"
a message while moving it.

**Test that pins it.** A table over every ordered pair of the six output
slots (`out`, `pdf`, `email`, `ciOut`, `history`, `baseline`), plus every
output against `logo` and each input, asserting exit 2 and no file written;
plus the existing CLI tests unchanged. Add one test that the plan has exactly
one slot per flag, so a new flag cannot be added without a slot.

### 3.2 Input pipeline

**As it is.** `src/input/detect.ts` returns nine decision kinds
(`src/input/detect.ts:12-21`), including `legacy-validation`,
`junit-validation`, `messages-validation` and `json-validation`.
`src/input/load.ts` then resolves, reads, hashes, dispatches, re-parses for
some validation-only kinds, checks duplicate ids and computes provenance
(`src/input/load.ts:54-318`). `messages-validation` calls `parseMessages`
again (`src/input/load.ts:199-202`); `junit-validation` calls
`parseJUnitXml` again (`:190-195`); `legacy-validation` calls
`parseLegacyJson` again (`:180-183`).

**What the interface leaks.** The adapter's "validate but do not add" policy,
the id-prefix convention, the `explicit` flag semantics, the sniff order, the
duplicate-content shortcut, and the fact that `ResolvedInputs` is a
single-field wrapper (`src/input/load.ts:38-41`). The renderer also imports
the sanitiser (Section 2.4), so the trust boundary is split.

**Smaller interface.** `prepareInputs(inputs): Promise<PreparedInputs>` with
three members: `files` (the resolved list), `scanBytes()` (stat only) and
`load(): Promise<LoadedRun>` (read, dedupe, parse, validate, provenance).
Each adapter exports one contract: `sniff(content, identity): boolean` and
`parse(content, file, context): Promise<ParsedInput>`, where `ParsedInput`
carries envelopes and `skippedAttachments`. The loader calls one adapter
once. "Validation-only" becomes an adapter-internal decision: parse and
discard, rather than a separate kind the loader must re-dispatch.

**What moves behind it.** The kind enum, the re-parse, the id-prefix
convention, content dedupe, the 100 MB cap, duplicate-id detection and
provenance.

**Call sites.** `src/run.ts:65`, `src/cli.ts:630`, `src/index.ts:53/61`, and
the directory collector in `src/compat/options.ts:154`. `detectInput` tests
and the loader tests change shape; the public API does not.

**Effort: L. Risk: medium-high.** The adapter error strings are heavily
asserted, the 100 MB cap and content dedupe have edge cases, and the JUnit
duplicate shortcut is deliberately narrow (`src/input/load.ts:156-164`).
Do this only with an adapter contract test written first.

**Test that pins it.** A contract table run against every adapter: same
content, explicit file versus directory scan, valid and invalid, duplicate
content under two paths, and the cap boundary; every case must produce the
same envelopes or the same error text. Plus a test that
`prepareInputs` stats each resolved path once.

### 3.3 Report pipeline seam

**As it is.** `src/run.ts` loads, sanitises, indexes, compares, summarises and
renders (`src/run.ts:61-104`). `renderHtml` accepts `RenderOptions` with 14
fields, including the internal fast-path `index` and `summary`, plus
`provenance`, `skippedAttachments`, `inputFiles` and `inputBytes`
(`src/render/types.ts:8-30`). `run.render` passes all of them
(`src/run.ts:93-103`); `stream.ts` passes only envelopes and options
(`src/stream.ts:28-33`). `renderHtml` sanitises again (`src/render/html.ts:53`).

**What the interface leaks.** The stage order, which stages are optional or
precomputed, the trust state of the envelopes, and the fact that a direct
caller gets a different (recomputed) path than the CLI. A caller can pass an
`index` built from different envelopes than the ones it also passes, and the
renderer will not notice.

**Smaller interface.** `renderRun(run: LoadedRun, options: RenderReportOptions)`
where `LoadedRun` is opaque (built only by the input pipeline) and
`renderHtml` becomes an internal function over a trusted run. The stream
builds a `LoadedRun` through the same loader. Sanitise once, at the seam.

**What moves behind it.** Sanitise, index, model, summary, comparison and
input counts. The public `renderReport` and `generateReport` keep their
signatures.

**Call sites.** `src/run.ts:88-104`, `src/stream.ts:28-33`, 31 render test
files and `test/render-helpers.ts`.

**Effort: M. Risk: medium.** The render tests call `renderHtml` directly and
the characterization hashes pin the bytes. The type change is the easy part;
keeping the direct-render path and the CLI path byte-identical is the work.

**Test that pins it.** For one fixture, `renderReport(paths, options)` and
the direct `renderRun` path must produce byte-identical HTML. A type-level
test (or a lint rule) proves that no caller passes `index` or `summary`. A
test that an unsanitised envelope with a remote attachment still throws at
the single seam.

### 3.4 Durable sidecar reader

**As it is.** `src/baseline.ts` has a 10 MiB, strict-UTF-8, pre/post-stat
reader (`src/baseline.ts:117-154`). `src/history.ts` has a 1 MiB reader that
uses `Buffer.toString('utf8')` (`src/history.ts:293-336`). Both duplicate
`excerpt` and `readBounded`, and both encode the "missing file" semantics
differently: baseline fails, history returns `[]`. The BOM and UTF-8 policies
differ (Section 2.8).

**What the interface leaks.** Open flags, the regular-file check, the cap,
the decoding policy, the BOM policy and the error prefix (`Invalid` versus
`Cannot write`). A third sidecar would copy all of it a third time.

**Smaller interface.** One internal `readCappedText(file, options)` that
returns `string | undefined` for a missing file and throws one
`SidecarError` with the file and a reason. Options: `maxBytes`,
`strictUtf8`, `stripBom`. `readHistory`, `storedSchema` and `readBaseline`
validate their JSON shapes above it.

**What moves behind it.** The descriptor, TOCTOU stat, cap, UTF-8 decoder,
BOM strip, missing-file rule and the error prefix. The schema validators stay
in their modules.

**Call sites.** `src/cli.ts:643/648`, `src/history.ts:390-418` (the writer's
peek), and the two reader test suites.

**Effort: M. Risk: medium.** This is security-sensitive input handling and
the 0.6.1 change is already touching the history BOM. Land 0.6.1 first, then
unify; do not bundle them.

**Test that pins it.** One shared contract suite run against both sidecars:
missing file, directory, symlink, device-like non-regular file, over-cap,
invalid UTF-8, one BOM, BOM plus invalid JSON. Each case asserts the same
classification and the same error category, while the module-specific
messages remain pinned by the existing tests.

### 3.5 Status vocabulary

**As it is.** The status list, order, labels and colours live in at least
eight modules (Section 2.8). `src/report/status.ts` owns the type and
severity but not the list or the label keys. Adding or renaming a status
touches all of them, and the compiler catches only some of the maps.

**What the interface leaks.** Every consumer must know the full list, the
severity order, the label key convention and whether `unknown` counts as
executed.

**Smaller interface.** `src/report/status.ts` exports the runtime tuple
`STATUSES`, `isStatus`, `statusSeverity`, `worstExecutedStatus` and
`statusLabelKey`. Presentation modules derive their colour and class maps
from `STATUSES` with exhaustive `Record<ReportStatus, ...>` types. The
`summary`, `baseline` and `history` validators call `isStatus` instead of
carrying their own sets.

**What moves behind it.** The list, the order, the validation predicate and
the label-key mapping. Colours and CSS classes stay where they are.

**Call sites.** `report/model`, `summary`, `baseline`, `history`,
`render/format`, `email`, `render/trends`, `ci`.

**Effort: S. Risk: low.** This is a mechanical change with compile-time
exhaustiveness. Do it first; it makes later changes cheaper.

**Test that pins it.** An exhaustive table over every status: `isStatus`
accepts it, `statusSeverity` orders it, `statusLabelKey` resolves in both
catalogs, and every presentation map has an entry. A `Record<ReportStatus, T>`
that omits one status is a type error.

### 3.6 Playwright adapter internal seams

**As it is.** `src/input/playwright.ts` is 1,729 lines. Validation helpers
occupy roughly lines 197-511; planning and retry evidence roughly 1141-1502;
attachment reading and path resolution roughly 879-1139; envelope emission
roughly 1535-1729. A mutable `PlanContext` with 14 fields is threaded through
almost every helper (`src/input/playwright.ts:180-195`).

**What the interface leaks.** Externally, only `parsePlaywrightJson` is
visible (`:1535`), so the external interface is already good. Internally, the
shared mutable context leaks the plan's state into validation, I/O and
emission, which makes each stage hard to test alone and makes the retry
evidence order load-bearing.

**Smaller interface.** Keep `parsePlaywrightJson` unchanged. Inside, split
into `validate` (pure), `plan` (pure except attachment reads), `attachments`
(I/O with an injected reader) and `emit` (pure envelope construction). Replace
`PlanContext` with explicit per-stage inputs and outputs. This is an internal
seam, not a new public one; the skill explicitly allows internal seams used
by a module's own tests.

**What moves behind it.** Nothing new externally. Locality improves: an
attachment reader can be tested without a valid Playwright document, and a
plan can be built from a parsed fixture.

**Call sites.** `src/input/load.ts:203-211`; the existing
`test/playwright.test.ts` (1,629 lines), retry-evidence and source-line
tests.

**Effort: L. Risk: medium.** The adapter is security-sensitive (path roots,
symlinks, caps, retry evidence) and its tests are large. Do not change
observable output; move code and keep the suite green.

**Test that pins it.** Stage contract tests: the validator accepts/rejects a
fixture table; the planner returns attempts for a parsed fixture; the emitter
turns a plan into envelopes. The existing end-to-end adapter tests stay
unchanged and act as the regression net.

### 3.7 Feature layout planner

**As it is.** `renderFeature` in `src/render/report.ts` spans lines 637-763.
It builds outline groups, rule blocks, `RenderItem` arrays and `topItems`,
then sorts them three times and interpolates HTML in the same function. The
`idIndex` map is computed from the severity order and shared with triage
anchors (`src/render/report.ts:653-711`).

**What the interface leaks.** Grouping, status ordering, rule membership and
id indexing are interleaved with markup. A reader cannot test the order
without rendering the string.

**Smaller interface.** `planFeature(feature, orderedScenarios): FeatureLayout`
as a pure function, and `renderFeature(layout, ...)` for markup. The layout
contains the top items, rule blocks and id index. `renderReportView` calls the
planner once per feature.

**What moves behind it.** Outline grouping, rule grouping, the four sorts and
the id index. No markup, CSS or class-name change.

**Call sites.** `renderReportView` only. The 31 render test files keep
asserting HTML.

**Effort: M. Risk: medium.** The HTML must stay byte-identical, and eleven
characterization hashes plus two golden files pin it. This is a separate
report-shell change; do not mix it with a UI change.

**Test that pins it.** Pure layout tests for outline grouping, rule blocks,
status order and id stability; the existing characterization and golden tests
unchanged.

### 3.8 Package surface

**As it is.** `src/index.ts` exports `version` and `phase`, hardcodes the
version, and re-exports types from internal modules. The declaration build
emits per-module `.d.ts`; the package ships `dist` and the docs
(`package.json:60-77`). The runtime dependency list is correct except for
`@cucumber/tag-expressions`.

**What the interface leaks.** The version has two sources; `phase` has no
contract; the type graph names internal modules; the runtime/browser
dependency split is implicit.

**Smaller interface.** Generate `version` from `package.json` at build time
(esbuild define or a generated constant), remove `phase`, move
`@cucumber/tag-expressions` to `dependencies`, and ship one rolled-up
`index.d.ts` (or explicitly document the per-module graph). Keep the export
names unchanged.

**What moves behind it.** Build metadata, the public export list, the
dependency classification.

**Call sites.** `src/cli.ts:16` (version), `src/index.ts`, the package tests
and consumers.

**Effort: S. Risk: low.** The only compatibility risk is a consumer that
imports `phase`, which is unlikely and should be checked in the changelog.
The declaration rollup is the only tooling work; skip it if it needs a new
dependency and do the rest.

**Test that pins it.** A package test that `version` equals
`package.json.version`, that the value exports are exactly the documented
set, and that `dist/index.d.ts` contains no `../src` path. The current
`test/package-pdf.test.ts` is the pattern.

### 3.9 Run facts projection

**As it is.** `src/report/model.ts` (902 lines) and `src/summary.ts` (432
lines) each loop over pickles, choose the latest attempt, build step rows,
compute status and duration, and count attachments. They share `RunIndex` and
`status`, but duplicate the per-pickle loop and the duration/count helpers
(Section 2.8). `test/model-summary-cross-check.test.ts` is the guard.

**What the interface leaks.** The two projections compute the same facts
independently; a change to latest-attempt selection or duration rounding must
be made twice. The cross-check test proves equality after the fact, not by
construction.

**Smaller interface.** `runFacts(index): RunFact[]` with one row per pickle
(latest attempt, results, feature, example coordinate, status, duration,
attachment references), then `toSummary(facts)` and `toModel(facts)` as thin
policies on top. The summary's `change` and the model's earlier attempts stay
policy-specific.

**What moves behind it.** Latest-attempt selection, per-step result lookup,
duration rounding, example coordinate and the attachment-count basis.

**Call sites.** `report/model`, `summary`, `scenarioIdentities`, `run`.

**Effort: L. Risk: high.** This is the contract boundary between schema 2 and
the HTML. A one-byte difference in a duration or a status changes the JSON,
the report and the history. Do it last, and only if the cross-check test has
caught real drift.

**Test that pins it.** Extend `model-summary-cross-check.test.ts` to assert
every shared fact comes from the same row, plus the existing schema and
golden tests. If the shared facts are not actually identical by policy, do
not do this refactor.

### 3.10 Path identity

**As it is.** `src/output.ts:41-73` owns `canonicalPath`/`samePath`;
`src/input/load.ts:45-51` has another `canonicalPath`;
`src/cli.ts:170-192` has `isInside`/`conflictsWithInputs`;
`src/input/playwright.ts:589-617` has `isInside`/`relativeFile`. The
implementations differ in case folding, symlink handling and missing-target
behaviour.

**What the interface leaks.** Callers must know which implementation to use
and whether it resolves symlinks, folds case or accepts a missing target.
A security check that uses the wrong one fails open or closed unpredictably.

**Smaller interface.** One `src/paths.ts` with `samePath`, `isInside`,
`canonicalPath` and `relativeDisplay`, with documented platform behaviour.
`output.ts`, `cli.ts`, `input/load.ts` and `playwright.ts` call it.

**What moves behind it.** `realpath`, nearest-existing-ancestor resolution,
case folding on Windows/macOS, `..` handling and relative display.

**Call sites.** The four current implementations and their tests.

**Effort: S. Risk: medium.** These are security checks. Do it inside the CLI
planner (3.1) or the Playwright split (3.6), not as a standalone drive-by.

**Test that pins it.** A table over symlink, junction, missing target,
case-variant path, `..` escape and a path inside/outside an input directory,
run on Windows and Linux.

---

## 4. What is good and should not be touched

- **One model, one renderer.** Every adapter converges on Cucumber Messages
  (`docs/adr/0004-normalize-to-messages.md`), and there is no second renderer.
  The legacy, JUnit and Playwright adapters all end in `Envelope[]`; the
  renderer never branches on the producer.
- **The shared `RunIndex`.** `src/report/index-run.ts` builds one projection
  and both the model and the summary read it; a second pass only preserves
  attempt order. Latest-attempt selection lives in one place
  (`src/report/index-run.ts:94-108`).
- **`src/attachment.ts` as a shared leaf.** Caps, media allowlist, byte
  accounting, fallback names and text presentation are owned once and used
  by the input layer, the model, the summary and the renderer. The
  base64-without-decoding count is a real performance decision
  (`src/attachment.ts:86-95`).
- **`src/text.ts`.** ANSI, bidi and control stripping is security-critical,
  has a measured fast path and a benchmark (`src/text.ts:128-152`,
  `npm run bench:ansi`). Do not simplify it without the benchmark.
- **CSP from actual body hashes.** `inlineScriptHashes` hashes the scripts
  that are really in the document (`src/render/html.ts:21-34`); there is no
  hand-maintained nonce or hash list to drift.
- **Layered escaping.** `escapeHtml` strips bidi and escapes five characters
  (`src/render/escape.ts:3-19`); Markdown is rendered with `html: false` and a
  link/image allowlist (`src/render/markdown.ts:5-59`); remote Markdown
  images are neutralised at the input boundary
  (`src/input/sanitize.ts:23-33`). This is a coherent defence, not a single
  filter.
- **Baseline matcher.** The two-pass identity and the explicit ambiguity rule
  are documented and tested (`src/baseline.ts:341-418`), and the maps keep it
  linear. Do not "simplify" the ambiguity rule into a best guess.
- **History sidecar.** Schema 1/2 choice, dedupe id, bounded read, atomic
  write and pruning are careful (`src/history.ts:236-466`). Keep the
  read-before-write rule.
- **Atomic output and path identity.** `writeAtomic` writes a same-directory
  temp file with mode 0600 and renames (`src/output.ts:75-93`); `samePath`
  resolves the nearest existing ancestor and folds case on case-insensitive
  filesystems (`src/output.ts:41-73`). Keep both.
- **The i18n pipeline.** `en.json` is the source with descriptions; the
  generated union is the key contract; the client bundle carries no
  non-English catalog and receives its messages as an inert JSON block
  (`src/render/i18n.ts:391-397`, `src/render/html.ts:93`). Do not move
  catalogs into the browser bundle.
- **The test suite.** 90 unit files, 28 browser specs, 157 fixtures, a
  model/summary cross-check, characterization hashes and two goldens. Any
  refactor should add tests at the new interface and keep the old net until
  the new one is proven.
- **The documentation set.** `AGENT-INTERFACE.md`, `llms.txt`, `GLOSSARY.md`
  and `ARCHITECTURE.md` are the reason an agent can work here without
  scraping the source. Keep them in sync with behaviour.
- **The dependency and performance budgets.** Three runtime dependencies, a
  16 KB client budget, a 500 ms ANSI budget, the 1 MiB history cap and the
  100 MB input cap are product requirements. A refactor must not trade them
  away for tidiness.

---

## 5. Suggested order of work and what must not be bundled

The order follows dependency and risk: vocabulary first, then the
security-sensitive reader, then the two widest seams, then the optional
splits. Every step is a separate OpenSpec change with its own proposal,
spec delta, design, TDD-Red worker, implementer and reviewers, as
`AGENTS.md` requires.

| Order | Change | Why here | Effort | Risk |
|---:|---|---|---|---|
| 0 | Finish the in-flight 0.6.1 quality pass | It touches `readHistory` and the report shell; everything below should start from a green 0.6.1 tree | S | Low |
| 1 | Status vocabulary (3.5) | Small, low risk, and later changes stop copying the list | S | Low |
| 2 | Sidecar reader (3.4) | Security-sensitive; after 0.6.1's BOM fix | M | Medium |
| 3 | CLI plan/execute (3.1) | Biggest agent-facing complexity; behaviour pinned by 11 CLI suites | M | Medium |
| 4 | Report pipeline seam (3.3) | Removes the wide `RenderOptions` and the double sanitise | M | Medium |
| 5 | Input pipeline (3.2) | Riskiest input change; benefits from 1 and 4 | L | Medium-high |
| 6 | Playwright internal seams (3.6) | Largest file; no external behaviour change | L | Medium |
| 7 | Package surface (3.8) | Release-adjacent; do it before a release, not with one | S | Low |
| 8 | Feature layout planner (3.7) | Report-shell change; coordinate with UXR/CMP | M | Medium |
| 9 | Run facts projection (3.9) | Highest risk; only if drift is observed | L | High |
| 10 | Path identity (3.10) | Fold into 3.1 or 3.6; no standalone change | S | Medium |

### What must not be bundled into one change

- **Do not bundle the 0.6.1 quality pass** with any architecture change. It
  has its own characterisation re-pin, its own browser matrix and its own
  review set.
- **Do not bundle CLI planning with CLI behaviour changes.** Exit codes,
  stderr strings and output order are a documented contract. A plan/execute
  split is a refactor; a message change is a separate, user-visible change.
- **Do not bundle the input pipeline with adapter mapping changes.** Legacy,
  JUnit and Playwright mappings have their own fixtures and parity tests.
- **Do not bundle the report pipeline with HTML, CSS or markup changes.** The
  eleven characterization hashes and two goldens are the safety net;
  changing bytes at the same time makes a regression indistinguishable from
  an intended diff.
- **Do not bundle the status vocabulary with a new status or schema change.**
  Schema 2 is a public contract; adding a status is a schema decision.
- **Do not bundle the feature layout planner with a visual or interaction
  change.** That is a report-UI decision and is explicitly out of scope here.
- **Do not bundle package/build changes with a release, tag or publish.** The
  release gate and the version decision stay separate.
- **Do not bundle the Playwright split with attachment behaviour changes**
  (roots, caps, retry evidence). Move code first; change policy later.
- **Do not bundle the run-facts projection with schema 2 or history.** It
  touches both; it needs its own approval and its own evidence.
- **Do not introduce a shared `paths` module in two refactors at once.** Pick
  the CLI or the Playwright split as the home.

---

## 6. Limits

What I did not inspect or could not judge:

- I did not run `npm run build` or `npm run check`; a benchmark was using
  `dist/`. I read `dist/index.d.ts`, the bundle sizes and the built file list
  as they were. I did not run the unit tests, the browser suite, the stress
  script or the ANSI benchmark.
- I did not read every test body. I read `test/render-helpers.ts`, the heads
  of the CLI and package tests, and counted test files, imports and lines. A
  test-quality audit per file is still open.
- I did not verify the legacy, JUnit, Playwright or Messages mappings against
  real producers; I read the adapters and the fixtures list, not the fixture
  contents in bulk.
- I did not inspect `node_modules`, the lockfile's full dependency tree or the
  published tarball; dependency sizes come from `package.json` and ADR 0007.
- I did not use the network, the issue tracker or the release history beyond
  the current commit and the local backlog files. I did not confirm whether
  an open issue already covers any candidate.
- I did not evaluate the report UI, visual design, accessibility behaviour or
  print output; that is a separate decision. The layout candidate in Section
  3.7 is an internal extraction, not a redesign.
- I did not measure runtime performance, memory or bundle parse time. The
  numbers in this report are source lines, import edges, file sizes and test
  counts, not timings.
- I did not judge release readiness, the host matrix, the trademark status or
  the 0.6.1 scope. The untracked `openspec/changes/0.6.1-quality-pass/` was
  read as context and left untouched.
- I wrote only this file. The untracked `scripts/bench-compare.mjs`,
  `docs/research/performance-2026-11.md` and the 0.6.1 change directory were
  present before or produced by another session; I did not create or edit
  them.
- LOC counts include blank lines and comments. They are not a
  code-versus-comment split. The fan-in/out counts are static, `src`-only,
  include type-only edges and dynamic imports, and exclude tests and scripts.
- The 2026 practice statements in Section 2 are criteria, not a survey. I did
  not benchmark this codebase against other projects or a style guide.

---

## Appendix A: measurement commands

Line counts (60 files, 15,733 lines; 14,076 TypeScript/CTS):

```shell
node -e "const fs=require('fs'),p=require('path');const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f);else files.push(f)}})('src');let total=0;for(const f of files.sort()){const s=fs.readFileSync(f,'utf8');const n=s.split(/\r?\n/).length-(s.endsWith('\n')?1:0);total+=n;console.log(String(n).padStart(6),f)}console.log('TOTAL',total,'files',files.length)"
```

Import fan-in and fan-out (internal edges; `.js` specifiers normalised to
`.ts`):

```shell
node -e "const fs=require('fs'),p=require('path');const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f);else if(f.endsWith('.ts')||f.endsWith('.cts'))files.push(f.replace(/\\/g,'/'))}})('src');const norm=s=>s.replace(/\.js$/,'.ts');const fanIn={},fanOut={};for(const f of files){const s=fs.readFileSync(f,'utf8');const re=/(?:import|export)\s+(?:type\s+)?(?:[^'\"`;]*?\s+from\s+)?['\"]([^'\"]+)['\"]|import\(\s*['\"]([^'\"]+)['\"]\s*\)/g;let m;const outs=[];while((m=re.exec(s))){const spec=m[1]||m[2];if(spec.startsWith('.'))outs.push(norm(p.posix.normalize(p.posix.join(p.posix.dirname(f),spec))));else outs.push('['+spec+']')}fanOut[f]=[...new Set(outs)];for(const o of fanOut[f])if(!o.startsWith('['))fanIn[o]=(fanIn[o]||0)+1}for(const f of files.sort())console.log(f,'in='+(fanIn[f]||0),'out='+fanOut[f].length)"
```

Test surface:

```shell
(Get-ChildItem test -Filter *.test.ts | Measure-Object).Count
(Get-ChildItem test\e2e -Filter *.spec.ts | Measure-Object).Count
(Get-ChildItem test\fixtures -Recurse -File | Measure-Object).Count
```

Generated and build artifacts:

```shell
node -e "for(const f of ['src/i18n/catalogs.ts','src/render/styles.ts','src/render/client-bundle.ts','src/render/print-script.ts']){const s=require('fs').readFileSync(f,'utf8');console.log(f,Buffer.byteLength(s),'bytes',s.split('\n').length-1,'lines')}"
Get-ChildItem dist -File | ForEach-Object { "{0,10} {1}" -f $_.Length, $_.Name }
```

Public exports (read-only `dist`):

```shell
node -e "const d=require('fs').readFileSync('dist/index.d.ts','utf8');console.log((d.match(/export (?:declare )?(?:const|function|class) \w+/g)||[]).length);console.log((d.match(/export \{/g)||[]).length)"
```

Status and helper duplication:

```shell
Select-String -Path src\**\*.ts -Pattern 'VALID_STATUS|STATUSES|ALL_STATUSES|STATUS_KEYS|STATUS_LABELS|STATUS_CLASSES' -AllMatches
Select-String -Path src\baseline.ts,src\history.ts -Pattern 'readBounded|excerpt|toString\(''utf8''\)|TextDecoder'
```

CLI shape:

```shell
node -e "const s=require('fs').readFileSync('src/cli.ts','utf8');console.log('return 2:',(s.match(/return 2;/g)||[]).length);console.log('io.stderr:',(s.match(/io\.stderr\(/g)||[]).length)"
```

Git state and tracked generated files:

```shell
git status --short
git log -1 --format='%H %s'
git ls-files src/i18n/catalogs.ts src/render/styles.ts src/render/client-bundle.ts src/render/print-script.ts
```

Not run, by instruction: `npm run build`, `npm run check`, `npm run test`,
`npm run test:e2e`, `npm run stress`, `npm run bench:ansi`, and any network
command.

---

## 7. Coordinator decisions (2026-11-24)

- The order in Section 5 is accepted as written. 0.6.1 finishes first and is
  not bundled with any structure work.
- `@cucumber/tag-expressions` stays a dev dependency.
  `scripts/build-search.mjs` bundles it into `client-bundle.ts` and never
  externalises it, so moving it to `dependencies` would only add install
  weight. The package-surface step makes that intent explicit and pins it.
- The client/server `tsconfig` split moves into the strictness change (B-055),
  together with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- The status vocabulary is the first structure change after 0.6.1; the CLI and
  the input pipeline are separate changes and wait until the smaller seams
  have landed.
