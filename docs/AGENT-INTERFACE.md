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
| 1    | Input could not be parsed or rendered, or the output could not be written |
| 2    | Invalid usage, including an invalid flag value or logo file |

Always read `status` from the JSON summary for the test outcome. A failed test
suite is exit code 0 by design.

## API

```ts
import {
  generateReport,
  renderReport,
  summarizeReport,
} from 'tolkira';

const inputs = ['test-results/'];
const summary = await summarizeReport(inputs);
const { html, summary: sameSummary } = await generateReport(inputs, {
  title: 'Nightly',
  metadata: { CI: 'true', Commit: process.env.GITHUB_SHA ?? '' },
  logo: 'data:image/png;base64,...',
  accent: '#1b5e20',
});
const htmlOnly = await renderReport(inputs, { title: 'Nightly' });
```

The package is ESM, Node.js 22 or newer, and has no network or telemetry code.

| Option | CLI | API |
| ------ | --- | --- |
| title | `--title` | `title` |
| metadata | `--meta key=value` (repeatable) | `metadata` object |
| logo | `--logo <file>` reads a local image | `logo` base64 image data URI |
| accent | `--accent #rrggbb` | `accent` hex string; invalid values are ignored |
| size warning | `--max-size <mb>` (default 10) | not applicable; the API returns HTML |

The CLI validates logo bytes and rejects unsupported types or a size over
2 MB. The API only accepts a `data:image/...;base64,...` logo; anything else is
omitted.

## Summary schema, version 1

```json
{
  "schemaVersion": 1,
  "status": "failed",
  "durationMs": 12.4,
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

This example is abridged: it shows only the failing scenario, not the passing
one that carries the screenshot. The totals reflect the whole input.

Undefined and ambiguous Messages steps add optional diagnostic fields:

```json
{
  "keyword": "Given",
  "text": "a list of 8 things",
  "status": "undefined",
  "durationMs": 0,
  "suggestions": [
    {
      "language": "typescript",
      "code": "Given(\"a list of {int} things\", (int: number) => {\n  return \"pending\"\n})"
    },
    {
      "language": "typescript",
      "code": "Given(\"a list of {float} things\", (float: number) => {\n  return \"pending\"\n})"
    }
  ]
}
```

```json
{
  "keyword": "Given",
  "text": "a step with multiple definitions",
  "status": "ambiguous",
  "durationMs": 0,
  "definitions": [
    {
      "pattern": "^a (.*?) with (.*?)$",
      "source": "samples/ambiguous/ambiguous.ts:3"
    },
    {
      "pattern": "^a step with (.*?)$",
      "source": "samples/ambiguous/ambiguous.ts:7"
    }
  ]
}
```

Field contract:

- `schemaVersion` is `1`. A breaking change increments it.
- `status` is one of `passed`, `failed`, `skipped`, `pending`, `undefined`,
  `ambiguous`, `unknown`.
- `status` is the worst scenario status, or `failed` when a test-run hook
  fails. A scenario is the worst step status, using the standard Cucumber
  severity order.
- `counts.features` is the number of distinct Gherkin documents.
- `counts.scenarios` and `counts.steps` always contain every status key, even
  when the value is `0`. `total` is the sum.
- `durationMs` is a number of milliseconds and includes scenario and test-run
  hook time. `steps[].durationMs` is rounded to three decimals.
- `scenarios` is sorted by `uri`, then `name`, so output is stable across runs.
- `scenarios[].name` is the Cucumber pickle name. Examples of one scenario
  outline can share the same name; the HTML report labels rows with `#1.1` and
  shows the examples block name on the examples heading and in triage and
  copy-failure text, but the summary does not expose them yet.
- `attempt` is the latest Cucumber retry attempt for that scenario.
- `attachments.bytes` is the decoded size, not the base64 length.
- `steps[].message` is present only when the step result has a message. For
  hooks, `keyword` is `"Hook"`, `text` is the hook type and `name` is present
  when Cucumber provides one. Summary step counts include hook entries; the
  HTML report counts steps and hooks separately. A failed test-run hook makes
  the overall summary `status` failed.
- `steps[].suggestions` is present only for an undefined Messages step with
  `suggestion` envelopes. Each entry has an optional `language` and the `code`
  to implement. `steps[].definitions` is present only for an ambiguous Messages
  step with `stepDefinition` envelopes. Each entry has the `pattern` and an
  optional `source` in `uri:line` form with absolute paths reduced to a
  relative form. Both fields are additive, so `schemaVersion` stays 1;
  a passed step never carries them.
- Attachment file names are not part of the summary. `scenarios[].attachments`
  is a count; open the HTML report to see the image or file.

The summary does not expose absolute input paths: absolute `uri` values are
reduced to a relative form (`features/...`, or the last path segments for files
outside `features/`).

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
- Inputs are capped at 100 MB in total; attachments at 50 MB each and 100 MB
  total.
- The HTML report includes a hash-based CSP and never executes attachments.
- History, trends, retries beyond the latest attempt and JUnit/Playwright
  adapters are not part of v0.1.
- Legacy Cucumber JSON outlines arrive as expanded scenarios; the original
  outline `examples` table is not reconstructed. Behave-shaped durations are
  interpreted as nanoseconds, like cucumber-js.
- Legacy Cucumber JSON and JUnit have no suggestion or step-definition
  envelopes. An undefined or ambiguous legacy step still shows the status lead
  in HTML, but never invented snippets or definitions; JUnit renders no
  diagnostics.
- cucumber-js, Behave-shaped and Messages inputs are covered by fixtures;
  cucumber-jvm and cucumber-ruby fixtures are follow-ups.
