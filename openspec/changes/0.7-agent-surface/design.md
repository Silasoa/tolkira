# Design

## 1. Context

The CLI already owns the complete run: it resolves inputs once, renders,
writes report → PDF → email → history → `--ci-out`, and prints a confirmation
or the JSON/CI bytes. The summary schema 2 is the stable interface. The new
surface must not duplicate the summary or widen the API.

`--capabilities` is the discoverability door; the manifest is the run's trail.
Both are opt-in and neither changes the default one-file promise. A Markdown
index (B-077) was cut from this change after review: `--ci markdown --ci-out`
already writes the body, and the manifest already names the artifacts.

## 2. Capabilities

### 2.1 CLI

`tolkira --capabilities` is a boolean flag. It is handled after `--help` and
`--version` and before every input/output check:

- `--capabilities` alone prints the document to stdout and exits 0.
- Any positional input or any other option makes it exit 2 with
  `--capabilities takes no input and no other option; run tolkira --capabilities
  alone`, followed by the usage text; nothing is written and no input is read.
- `--help` and `--version` keep precedence.

The flag is added to the usage options and to the short option table in
`docs/AGENT-INTERFACE.md`. The backlog sketch says `capabilities --json`; the
CLI has no subcommands and adding one would restructure the parser, so the
boolean flag is the smaller change and the only new surface. Recorded decision.

### 2.2 Document, schema 1

```json
{
  "schemaVersion": 1,
  "name": "tolkira",
  "version": "0.7.0",
  "node": ">=22",
  "inputs": [
    "cucumber-legacy-json",
    "junit-xml",
    "cucumber-messages",
    "playwright-json"
  ],
  "outputs": [
    { "kind": "report", "flag": "--out" },
    { "kind": "pdf", "flag": "--pdf" },
    { "kind": "email", "flag": "--email" },
    { "kind": "json-summary", "flag": "--json" },
    { "kind": "ci-github", "flag": "--ci github" },
    { "kind": "ci-azure", "flag": "--ci azure" },
    { "kind": "ci-markdown", "flag": "--ci markdown", "fileFlag": "--ci-out" },
    { "kind": "history", "flag": "--history" },
    { "kind": "manifest", "flag": "--manifest" }
  ],
  "summarySchemaVersion": 2,
  "locales": ["en", "de"],
  "limits": {
    "inputTotalBytes": 104857600,
    "inputWarnBytes": 52428800,
    "attachmentBytes": 52428800,
    "totalAttachmentBytes": 104857600,
    "baselineBytes": 10485760,
    "historyBytes": 1048576,
    "historyLimitMax": 365
  },
  "defaults": {
    "reportWarnMb": 10,
    "pdfTimeoutMs": 300000,
    "historyLimit": 30
  },
  "exitCodes": {
    "generated": 0,
    "inputOrWriteFailure": 1,
    "usage": 2
  }
}
```

- Values come from their single source: `version` is the runtime `version`
  constant that `--version` prints, pinned to `package.json` by a test; `node`
  is pinned to `package.json#engines.node` the same way. Limits come from their
  enforcing modules: `SUMMARY_SCHEMA_VERSION`, `SUPPORTED_LOCALES`,
  `MAX_TOTAL_INPUT_BYTES`, `MAX_ATTACHMENT_BYTES`,
  `MAX_TOTAL_ATTACHMENT_BYTES`, `BASELINE_MAX_BYTES`, `HISTORY_MAX_BYTES`,
  `HISTORY_LIMIT_MAX` and `INPUT_WARN_BYTES`. `inputs` lists the four accepted
  input kinds in detection order, each proven by a `detectInput` fixture;
  `outputs` mirrors the `CiFormat` union and names `--ci-out` as the file form
  of `ci-markdown`. `defaults` is labelled separately from `limits` because
  `--max-size`, `--pdf-timeout` and `--history-limit` are overridable defaults,
  not caps. The exit codes are the documented contract, pinned by a test that
  exercises success, usage failure and input failure rather than by a constant.
- Fixed order of keys, two-space JSON, one trailing newline. No timestamp, no
  cwd, no environment, no unbounded array. The document stays under 4,096
  bytes; a test enforces the bound.
- `--static` and the other modifiers are not enumerated in schema 1; the doc
  and `--help` own them. A future additive schema can enumerate them.

## 3. Manifest

### 3.1 CLI and path rules

`--manifest <file>` needs a non-empty path. It is validated like the other
outputs: it must not name an input, the logo, `--out`, `--pdf`, `--email`,
`--history`, `--ci-out` or `--baseline`, and must not be inside an input
directory even when it does not exist. A collision or empty path exits 2 before
any write. The manifest uses the same atomic `0600` writer as every other
output.

### 3.2 Document, schema 1

```json
{
  "schemaVersion": 1,
  "tool": { "name": "tolkira", "version": "0.7.0" },
  "status": "failed",
  "counts": { "features": 1, "scenarios": {}, "steps": {} },
  "attachments": { "total": 1, "bytes": 68 },
  "warnings": { "skippedAttachments": 0 },
  "artifacts": [
    { "kind": "report", "path": "report.html" },
    { "kind": "ci-markdown", "path": "summary.md" }
  ],
  "failures": [
    {
      "feature": "Checkout",
      "name": "pays by card",
      "example": "#1.2",
      "uri": "features/checkout.feature"
    }
  ]
}
```

- `status`, `counts` and `attachments` are the summary values, copied as-is
  (the `scenarios` and `steps` objects keep every status key). Like the
  summary, the counts cover executed rows; unexecuted rows appear in neither.
- `warnings.skippedAttachments` is the run's skipped-attachment count, whether
  or not that CLI path prints the stderr warning; it is `0` when nothing was
  skipped. The summary-only path stays silent on stderr (pinned by
  `test/cli-edge.test.ts`) but still reports the real count in the manifest.
- `failures` is the first 10 failed scenario rows in summary order, with the
  display `uri` and the outline `example` coordinate when the row carries one;
  `counts.scenarios.failed` carries the complete number. A failed run hook
  without a failed scenario leaves `failures` empty while `status` stays
  `failed`; the status and counts are authoritative.
- `artifacts` lists only files written before the manifest, in write order:
  `report`, `pdf`, `email`, `history`, `ci-markdown`. The JSON summary on
  stdout is not an artifact. `path` is relative to the manifest file's
  directory with `/` separators (JSON needs no percent-encoding). An absolute
  artifact path is recorded as given when no relative path exists, such as
  across Windows drives; a relative artifact path that cannot be expressed
  relative to the manifest is a usage error before any write. It never
  contains the cwd and never names an input.
- No timestamp, no attachment content, no second copy of the scenario rows.
  The document is deterministic for the same run and options.

## 4. Write order and failures

The complete order becomes:

report → PDF → email → history → `--ci-out` → manifest → stdout.

This extends the order stated in the PDF and email requirements; the manifest
is always last. On a manifest write failure the CLI exits 1 with
`Cannot write manifest to <path>`, keeps earlier outputs, skips all later
stdout, including `--json`/`--ci`, and leaves no partial file.

`--manifest` alone satisfies the at-least-one-output check, so
`--manifest run.json` is a valid summary-only run; the usage sentence and the
pinned help tests (`test/cli-email.test.ts`, `test/cli-pdf.test.ts`) are
updated to name it.

`Manifest written to <path>` appears only when stdout is free, after the
report/PDF/email lines. `--json` or `--ci` stdout stays byte-identical.

## 5. Documentation

- `docs/AGENT-SNIPPET.md`: a short copy-paste block for an AGENTS.md, a skill
  or a tool description. It names `--json`, the exit-code meaning,
  `scenario.executed`, `--capabilities`, `--manifest`, `--static`, CI modes and
  the offline promise. Version-agnostic.
- `docs/AGENT-INTERFACE.md`: the flag, the capabilities shape, the manifest
  schema and the extended order; the email and PDF sections adopt the new
  order.
- `docs/LIMITATIONS.md`: the manifest joins the owner-only output files and the
  agent surface row.
- `llms.txt` and `docs/README.md` link the snippet; `README.md` lists the new
  flags; `DESIGN.md` and `docs/ARCHITECTURE.md` name the two new modules;
  `package.json` ships the snippet.
- `docs/CHANGELOG.md` records the additions under Unreleased.

## 6. Tests

Capabilities (`test/capabilities.test.ts`):

- alone exits 0, stdout parses, key set and order exact;
- version equals `package.json` and `--version`, `node` equals
  `package.json#engines.node`;
- every `inputs` kind is accepted by `detectInput` on a matching fixture and
  every `outputs` kind maps to a real flag/`CiFormat`;
- summary schema, locales and every limit equal the enforcing constants, and
  every default equals its option default;
- the documented exit codes match a real success, usage failure and input
  failure run;
- with an input, with `--out`, with `--json`: exit 2, no stdout document;
- `--help`/`--version` precedence;
- `--manifest` alone exits 0;
- document under 4,096 bytes and deterministic across two runs.

Manifest (`test/cli-artifacts.test.ts`):

- full report path: artifact kinds and order, counts/attachments deep-equal to
  the summary, failures cap, order and `example` coordinate, manifest JSON
  deterministic;
- `warnings.skippedAttachments` equals the count the stderr warning names on
  the report path, and the true count on the silent summary-only path;
- a failed run hook with no failed scenario keeps `status: failed` and an empty
  `failures` array;
- full output order with history and `--ci-out`: the manifest lists report,
  PDF, email, history and `ci-markdown` in that order (PDF mocked as in
  `test/cli-pdf.test.ts`);
- summary-only path with `--json --manifest`: empty artifacts, manifest still
  lists failures;
- summary-only path with `--email` and `--ci markdown --ci-out`: the manifest
  lists both files, then the run has no report/PDF entries;
- collision matrix and empty paths exit 2 before any write;
- manifest write failure: exit 1, earlier outputs kept, no partial file, no
  later stdout;
- `--json` stdout byte-identical with and without the flag;
- no manifest bytes contain the cwd, an input path or a timestamp.

## 7. Risks and decisions

- The manifest duplicates a projection of the summary by design; it stays a
  small, stable subset and does not replace `--json`. Its counts mirror the
  summary's executed-only counts; unexecuted rows are not added as a field.
- Paths in the manifest are made relative to the manifest file, so the document
  does not reveal the runner's directory layout and no input path is written.
  Only an absolute artifact path can still be recorded as given, when no
  relative path exists across Windows drives; a relative artifact path that
  cannot be expressed is rejected with exit 2 before any write.
- `--index` is deferred as B-077: it duplicates the Markdown CI body, and its
  relative-link edge cases were the largest review surface of this bundle.
- No new runtime dependency and no network. The capabilities document is the
  single source for machines; the doc remains the human source.
