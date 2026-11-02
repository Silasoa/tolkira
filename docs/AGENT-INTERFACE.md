# Tolkira for agents

Tolkira produces two things from the same input:

- a self-contained HTML report for humans;
- a stable JSON summary for programs and AI agents.

The HTML report is the artifact. The JSON summary is the interface. Do not parse
the HTML to decide whether a test run passed.

## CLI

Generate HTML and print the JSON summary:

```shell
tolkira test-results/ --out report.html --json
```

Generate only the summary, without writing HTML:

```shell
tolkira test-results/ --json
```

`--json` writes exactly one JSON document to stdout. Warnings and errors go to
stderr. Exit codes are about report generation, not test status:

| Code | Meaning |
| ---- | ------- |
| 0    | Report or summary generated; tests may still have failed |
| 1    | Input could not be parsed or rendered |
| 2    | Invalid usage |

Always read `status` from the JSON summary for the test outcome. A failed test
suite is exit code 0 by design.

## API

```ts
import {
  generateReport,
  renderReport,
  summarizeReport,
} from 'tolkira';

const summary = await summarizeReport(['test-results/']);
const { html, summary: sameSummary } = await generateReport(inputs, {
  title: 'Nightly',
  metadata: { CI: 'true', Commit: process.env.GITHUB_SHA ?? '' },
});
const htmlOnly = await renderReport(inputs, { title: 'Nightly' });
```

The package is ESM, Node.js 22 or newer, and has no network or telemetry code.

## Summary schema, version 1

```json
{
  "schemaVersion": 1,
  "status": "failed",
  "durationMs": 12.4,
  "counts": {
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
      "total": 31,
      "passed": 30,
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
    "bytes": 68
  },
  "scenarios": [
    {
      "name": "Failing scenario",
      "uri": "features/screenshot.feature",
      "feature": "Screenshot attachment",
      "status": "failed",
      "durationMs": 10,
      "attempt": 0,
      "tags": ["@failing"],
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

Field contract:

- `schemaVersion` is `1`. A breaking change increments it.
- `status` is one of `passed`, `failed`, `skipped`, `pending`, `undefined`,
  `ambiguous`, `unknown`.
- `status` is the worst scenario status. A scenario is the worst step status,
  using the standard Cucumber severity order.
- `counts.scenarios` and `counts.steps` always contain every status key, even
  when the value is `0`. `total` is the sum.
- `durationMs` is a number of milliseconds. `steps[].durationMs` is rounded to
  three decimals.
- `scenarios` is sorted by `uri`, then `name`, so output is stable across runs.
- `attempt` is the latest Cucumber retry attempt for that scenario.
- `attachments.bytes` is the decoded size, not the base64 length.
- `steps[].message` is present only when the step result has a message. For
  hooks, `keyword` is `"Hook"` and `text` is the hook type.
- `attachments[].fileName` is not part of the summary. Attachments are linked
  to scenarios by count; open the HTML report to see the image or file.

The summary contains no absolute input paths: `uri` comes from the test report.

## Recommended agent workflow

1. Run the tests and keep the raw Cucumber JSON or Messages.
2. Run `tolkira <inputs> --out report.html --json`.
3. Parse stdout once. Use `status`, `counts` and `scenarios[].steps[].message`
   for diagnosis.
4. If you need screenshots or the full Gherkin view, open `report.html`; do not
   scrape it for pass/fail data.
5. Attach or upload the HTML report as the human-facing artifact.

## Current limits

- Remote attachments (`attachment.url`, `externalAttachment`) are rejected on
  purpose; the report must work offline. Inline the bytes.
- Markdown images with remote URLs are stripped from descriptions.
- The HTML report includes a restrictive CSP and never executes attachments.
- History, trends, retries beyond the latest attempt and JUnit/Playwright
  adapters are not part of v0.1.
- Legacy Cucumber JSON outlines arrive as expanded scenarios; the original
  outline `examples` table is not reconstructed.
