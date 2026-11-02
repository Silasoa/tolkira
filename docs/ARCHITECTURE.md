# Tolkira — Architecture

## Shape

```
CLI / API
   │
   ├── Messages adapter ───────────────┐
   │   (NDJSON, validated)             │
   │                                    ▼
   └── Legacy JSON adapter ───────► Cucumber Messages
       (Cucumber JSON, embeddings)      │
                                        ▼
                              Report shell + official
                              Cucumber React components
                                        │
                                        ▼
                              One self-contained HTML file
```

One package. One CLI. One HTML output. No monorepo, no server, no database.

## Components

### `src/input/messages`

- Reads NDJSON.
- Parses each line with `@cucumber/messages`.
- Rejects malformed input with a clear error and no partial output.
- Merges multiple message streams; IDs are expected to be unique per run.

### `src/input/legacy-json`

The hard part. It normalises Cucumber JSON from cucumber-js, cucumber-jvm,
cucumber-ruby and Behave into Messages:

- Gherkin documents, features, scenarios, backgrounds, rules, outlines;
- test cases, test steps, hooks, statuses, durations;
- tags, data tables, doc strings;
- **embeddings → attachments**, including base64 screenshots and MIME types.

The canonical `@cucumber/json-to-messages` converter is a useful reference but
does not preserve embeddings. We will vendor/adapt the MIT-licensed logic or
write a focused adapter, with attribution. This adapter is the main technical
risk and the main differentiator.

### `src/render`

- Uses `@cucumber/html-formatter` / `@cucumber/react-components` (MIT) as the
  rendering engine.
- Produces one HTML file with inline CSS/JS and inline attachments by default.
- Adds a small shell: title, metadata, summary, theme tokens, logo.
- No CDN, no external fonts, no network requests.
- Optional external-attachments mode is a later change.

### `src/cli`

- `tolkira <input...> --out <file> [--title <title>] [--meta key=value]`.
- Auto-detects `.ndjson`, `.json`, files and directories.
- Exit codes: 0 success, 1 parse/render error, 2 usage error.
- Failing tests do not fail report generation; malformed input does.
- `node:util parseArgs`; no CLI framework dependency.

### `src/index`

Programmatic API:

```ts
renderReport(inputs, options): Promise<string>
```

The CLI is a thin wrapper around the API.

## Security

Test names, metadata, file names and attachments are untrusted input.

- Escape all text injected into the shell.
- Do not execute HTML/SVG attachments; render them as text or in a sandboxed
  viewer.
- Validate MIME types and size limits.
- No network requests, telemetry or remote fonts.
- No path traversal when writing output or external attachments.
- A CSP/split-assets mode is planned; v0.1 defaults to inline assets.

## Performance

- Messages are streamed into the formatter; avoid building a second full model.
- Legacy JSON is parsed once; large files should fail with a useful message
  rather than exhausting memory.
- Warn when the generated file exceeds a configurable size.
- External attachments are the escape hatch for large screenshots/videos.

## Testing

- Unit tests: Vitest.
- Fixtures: small, real reports from cucumber-js, cucumber-jvm, cucumber-ruby
  and Behave; compatibility-kit messages where possible.
- Golden HTML tests for structural guarantees.
- One Playwright browser test per critical flow: render, expand a failure,
  open a screenshot, search/filter.
- Security tests: XSS payloads in names/metadata, HTML attachments, malicious
  file names.
- ISTQB-inspired edge cases: equivalence classes, boundaries, decision tables
  for statuses, state transitions for multiple runs.

## Toolchain

- Node.js 22, 24 and 26 in CI.
- TypeScript, ESM.
- esbuild for the CLI/library bundle.
- oxlint (fast, single binary, no ESLint dependency tree).
- Vitest.
- Playwright for browser-level checks.
- npm trusted publishing with provenance.

## Key decisions

- [ADR 0001](docs/adr/0001-hybrid-report-engine.md) — use official Cucumber
  components, build adapters and shell; do not fork the old reporter.
- [ADR 0002](docs/adr/0002-single-package-esm-node22.md) — one package, ESM,
  Node 22+.
- [ADR 0003](docs/adr/0003-name-tolkira.md) — name origin and preliminary
  clearance.
- [ADR 0004](docs/adr/0004-normalize-to-messages.md) — normalise legacy JSON to
  Messages instead of maintaining two renderers.

## Open questions

- Exact shell approach: `CucumberHtmlStream` + custom CSS/JS first, or a small
  React shell on `@cucumber/react-components` from day one?
- How much metadata can be injected without forking the official template?
- Attachment externalisation and CSP in v0.1 or v0.1.1?
- Which legacy implementations are v0.1 must-haves vs. fixtures-only?
