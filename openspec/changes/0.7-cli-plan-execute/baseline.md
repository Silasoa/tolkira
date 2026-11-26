# Baseline record — 0.7-cli-plan-execute (task 1.1)

Pre-refactor behaviour captured on `main` at commit
`e35454f1fe05477147b868b19d5cbc72a730497a` (2026-11-26), before any `src/cli/` module exists.
This record is the reference for the 1.1 comparison in task 4.6; it is not
regenerated after the split.

## Host and clock

| Item | Value |
| --- | --- |
| OS / arch | `win32` / `x64` |
| Node | `v26.13.1` |
| playwright-core | `1.65.1` |
| Chromium (headless shell) | `159.0.8154.6` (revision 1255) |
| Frozen clock | `2026-11-26T12:00:00.000Z` |
| Locale | `en` (`--locale en` where a locale surface exists) |

The PDF used the pinned host Chromium headless shell through the real
`renderPdf` seam, not the `cli-pdf` mock. The PDF embeds engine-owned
`/CreationDate`, `/ModDate` and `/ID` values, so its raw SHA-256 is
host- and run-specific; task 4.6 normalizes only those three fields before
comparing.

The captured command outputs name a temporary work directory. In this record
that absolute work directory is replaced by `<workdir>`; every other byte is
verbatim. The frozen `b.json` is reproduced in full below.

## Runs

Fixtures: `test/fixtures/messages/screenshot.ndjson` and
`test/fixtures/history/two-runs.json` (copied into `<workdir>/generate/history.json`
before the generate run).

### Generate: report + PDF + email + history + `--ci markdown --ci-out` + manifest

```text
Report written to <workdir>\generate\report.html
PDF written to <workdir>\generate\report.pdf
Email written to <workdir>\generate\email.html
Manifest written to <workdir>\generate\manifest.json
```

Exit code: `0`

### Summary: email + `--ci markdown --ci-out` + manifest

```text
Email written to <workdir>\summary\email.html
Manifest written to <workdir>\summary\manifest.json
```

Exit code: `0`

### `<input> --json` (stdout kept as `b.json`)

Exit code: `0`, stderr: ""

```json
{
  "schemaVersion": 2,
  "status": "failed",
  "durationMs": 11.895,
  "counts": {
    "features": 1,
    "scenarios": {
      "total": 2,
      "passed": 1,
      "failed": 1,
      "skipped": 0,
      "pending": 0,
      "undefined": 0,
      "ambiguous": 0,
      "unknown": 0
    },
    "steps": {
      "total": 2,
      "passed": 1,
      "failed": 1,
      "skipped": 0,
      "pending": 0,
      "undefined": 0,
      "ambiguous": 0,
      "unknown": 0
    }
  },
  "attachments": {
    "total": 1,
    "bytes": 8509
  },
  "scenarios": [
    {
      "name": "Attach a screenshot",
      "uri": "features/screenshot.feature",
      "feature": "Screenshot attachment",
      "status": "passed",
      "executed": true,
      "durationMs": 1.895,
      "attempt": 0,
      "tags": [],
      "attachments": 1,
      "steps": [
        {
          "keyword": "Given",
          "text": "I attach a screenshot",
          "status": "passed",
          "durationMs": 1.895
        }
      ]
    },
    {
      "name": "Failing scenario",
      "uri": "features/screenshot.feature",
      "feature": "Screenshot attachment",
      "status": "failed",
      "executed": true,
      "durationMs": 10,
      "attempt": 0,
      "tags": [
        "@failing"
      ],
      "attachments": 0,
      "steps": [
        {
          "keyword": "Then",
          "text": "the assertion fails",
          "status": "failed",
          "durationMs": 10,
          "message": "Expected 1 to equal 2"
        }
      ]
    }
  ]
}
```

## Process outputs (temporary esbuild bundle of `src/cli.ts`)

Built with the `test/render-report.test.ts` esbuild pattern, spawned with
`node <bundle> <args>` from the repository root.

### `--help`

```text
Usage: tolkira <input...> [--out <file>] [--pdf <file>] [--email <file>] [options]

Generate one self-contained HTML report from Cucumber JSON, Messages, JUnit XML or Playwright JSON.

Options:
  -o, --out <file>     Output HTML file
      --static         Script-free static report with every view and detail open; needs --out or --pdf
      --pdf <file>     Write an A4 PDF through the optional Playwright engine
      --pdf-timeout <ms> PDF render deadline in milliseconds (default 300000); needs --pdf
      --email <file>   Write an HTML email summary
      --json           Print a stable JSON summary to stdout
      --ci <format>    Print a CI summary: github, azure or markdown
      --ci-out <file>  Write the markdown CI summary to a file
      --history <file> Read and append an aggregate run history; needs --out
      --history-limit <n> Runs kept in that history (default 30, range 1 to 365); needs --history
      --baseline <file> Compare with an earlier schema-2 summary; needs --out, --pdf, --json or --ci markdown
      --manifest <file> Write a JSON manifest of the run
      --title <text>   Report title, email subject/heading and Markdown CI heading
      --locale <tag>   Report, PDF and email language: en or de (default en); needs --out, --pdf or --email
      --meta key=value Add metadata (repeatable)
      --logo <file>    Embed a PNG, JPEG, GIF, WebP or SVG logo; needs --out
      --accent <color> Header accent as a hex colour, e.g. #1b5e20
      --max-size <mb>  Warn when the report exceeds this size (default 10)
      --capabilities   Print the JSON capabilities document and exit
  -h, --help           Show this help
  -v, --version        Show the version

At least one of --out, --pdf, --json, --ci, --email or --manifest is required. --ci-out requires
--ci markdown. --history requires --out. Without --ci-out, --ci writes only the
CI summary to stdout. --json and --ci markdown share stdout only with --ci-out;
--ci github and --ci azure always own stdout. Failing tests do not change the
exit code.
```
Exit code: `0`, stderr: ""

### `--version`

```text
0.6.1
```
Exit code: `0`, stderr: ""

### `--capabilities`

```text
{
  "schemaVersion": 1,
  "name": "tolkira",
  "version": "0.6.1",
  "node": ">=22",
  "inputs": [
    "cucumber-legacy-json",
    "junit-xml",
    "cucumber-messages",
    "playwright-json"
  ],
  "outputs": [
    {
      "kind": "report",
      "flag": "--out"
    },
    {
      "kind": "pdf",
      "flag": "--pdf"
    },
    {
      "kind": "email",
      "flag": "--email"
    },
    {
      "kind": "json-summary",
      "flag": "--json"
    },
    {
      "kind": "ci-github",
      "flag": "--ci github"
    },
    {
      "kind": "ci-azure",
      "flag": "--ci azure"
    },
    {
      "kind": "ci-markdown",
      "flag": "--ci markdown",
      "fileFlag": "--ci-out"
    },
    {
      "kind": "history",
      "flag": "--history"
    },
    {
      "kind": "manifest",
      "flag": "--manifest"
    }
  ],
  "summarySchemaVersion": 2,
  "locales": [
    "en",
    "de"
  ],
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
Exit code: `0`, stderr: ""

### Row 5: no arguments (bare usage)

```text
Usage: tolkira <input...> [--out <file>] [--pdf <file>] [--email <file>] [options]

Generate one self-contained HTML report from Cucumber JSON, Messages, JUnit XML or Playwright JSON.

Options:
  -o, --out <file>     Output HTML file
      --static         Script-free static report with every view and detail open; needs --out or --pdf
      --pdf <file>     Write an A4 PDF through the optional Playwright engine
      --pdf-timeout <ms> PDF render deadline in milliseconds (default 300000); needs --pdf
      --email <file>   Write an HTML email summary
      --json           Print a stable JSON summary to stdout
      --ci <format>    Print a CI summary: github, azure or markdown
      --ci-out <file>  Write the markdown CI summary to a file
      --history <file> Read and append an aggregate run history; needs --out
      --history-limit <n> Runs kept in that history (default 30, range 1 to 365); needs --history
      --baseline <file> Compare with an earlier schema-2 summary; needs --out, --pdf, --json or --ci markdown
      --manifest <file> Write a JSON manifest of the run
      --title <text>   Report title, email subject/heading and Markdown CI heading
      --locale <tag>   Report, PDF and email language: en or de (default en); needs --out, --pdf or --email
      --meta key=value Add metadata (repeatable)
      --logo <file>    Embed a PNG, JPEG, GIF, WebP or SVG logo; needs --out
      --accent <color> Header accent as a hex colour, e.g. #1b5e20
      --max-size <mb>  Warn when the report exceeds this size (default 10)
      --capabilities   Print the JSON capabilities document and exit
  -h, --help           Show this help
  -v, --version        Show the version

At least one of --out, --pdf, --json, --ci, --email or --manifest is required. --ci-out requires
--ci markdown. --history requires --out. Without --ci-out, --ci writes only the
CI summary to stdout. --json and --ci markdown share stdout only with --ci-out;
--ci github and --ci azure always own stdout. Failing tests do not change the
exit code.
```
Stdout: "", exit code: `2`

The fenced blocks above show the bytes verbatim; `USAGE` has no trailing
newline. Byte sizes and SHA-256 of the process streams:

| Probe | Stream | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `--help` | stdout | 2044 | `0debb225b3d6e9b98bd966671925f55cd9f574eba65bd35a4b92ef75c6ee4574` |
| `--help` | stderr | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `--version` | stdout | 6 | `87b241b275c591694846560e9879f50c9da3150f854efdabd782c539772f3033` |
| `--version` | stderr | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `--capabilities` | stdout | 1318 | `013d180c59d64916fffdd92643fafae8ff5e478b2e6bb2b599b9d1fc41df647c` |
| `--capabilities` | stderr | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| row 5 (no args) | stdout | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| row 5 (no args) | stderr | 2044 | `0debb225b3d6e9b98bd966671925f55cd9f574eba65bd35a4b92ef75c6ee4574` |

`--help` and row 5 write the same 2044-byte `USAGE` bytes.

## Artifact hashes and sizes

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `generate/report.html` | 98930 | `35f601978e270c87f8df113728d3b7e73c3a4b8dfe916f8c92bafc355e61180c` |
| `generate/report.pdf` | 145116 | `8ce09da081c1db9080cc0e244d9747f5655ceb1518f7e7d7f4414eddb1001fa0` |
| `generate/email.html` | 4951 | `6d01fc31b2dcdf782542db4c31bc5d7da4ca3058858aa0d6bf8ebcb2fab620aa` |
| `generate/history.json` | 2450 | `7cf2d838d03dddf7b8408f65d78b820e641234b15fc4b0c5e29ee2201d4f0fb5` |
| `generate/summary.md` | 480 | `640af92da29ec892697d3eb3326ac54abfd17e14e37719b19d76a4e821ea3524` |
| `generate/manifest.json` | 1118 | `1ae0d2fc438e7733dda23676566da6c277d7a7f2c8512e5e5db9b493b0ff7ce3` |
| `summary/email.html` | 4922 | `9e98e79d669257e68e201b00a00c4a17ea7ea106a1532a2d235c2cfd6173aca1` |
| `summary/summary.md` | 480 | `640af92da29ec892697d3eb3326ac54abfd17e14e37719b19d76a4e821ea3524` |
| `summary/manifest.json` | 925 | `43cc61c9683bd20f360bf7f73d88815b56325fe9557a482ababb6c1dd5333a69` |
| `b.json` | 1519 | `09c4be0d7b20f5f9981521956e94d3b7cffc7a932856850090d49c3cce9b2da8` |

The generate run's `history.json` starts from `two-runs.json` and appends the
current run; the summary run records no history. `summary.md` is byte-identical
in the generate and summary runs because the same fixture and clock produce the
same summary.

## Baseline suite (task 1.2)

Command at `e35454f1fe05477147b868b19d5cbc72a730497a`:

```text
npx vitest run test/cli*.test.ts test/capabilities.test.ts test/inputs.test.ts
```

The Windows host expanded the glob to the 12 `test/cli*.test.ts` files plus
`test/capabilities.test.ts` and `test/inputs.test.ts`.

Result: **14 test files passed, 269 tests passed, 3 skipped, 0 failed.**
Duration 4.19 s on the host above.
