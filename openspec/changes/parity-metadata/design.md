# Design

## Context

See `proposal.md`. `ReportEnvironment` already carries producer/runtime/OS/CPU/
protocol from `meta`; `meta.ci` is ignored. `toAttachment` names unnamed
attachments `attachment-<n>.<ext>` and renders JSON/URI-list as plain text.
ANSI logs are escaped plain text.

## Goals / Non-Goals

**Goals:**

- Add CI metadata to header/Details.
- Deterministic `attachment.<ext>` names, pretty JSON, URI-list links, safe ANSI
  logs with copy.
- Keep counts, summary and offline behaviour unchanged.

**Non-Goals:**

- G8 Markdown, G10 tag expressions/URL state, G13 external attachments, themes,
  G14/G15.

## Decisions

### CI metadata

Extend `ReportEnvironment` with optional CI fields: name, url, remote,
revision, branch, tag. Read them from `meta.ci`. Render in the header as a link
plus short revision and in Details as metadata rows. A safe http(s) GitHub
remote plus revision links the 7-character commit; otherwise the revision is
plain text. Only http(s) URLs become anchors. Omit missing fields; escape
everything; no new request.

### Attachment naming

Centralise naming in `toAttachment` for Messages and legacy input. Use
`fileName` when present. Otherwise normalise the media type (lowercase, strip
parameters), derive a deterministic extension, and name it `attachment.<ext>`;
unknown types use `attachment`. Stop pre-naming legacy attachments
`attachment-<n>.<ext>`. Keep the per-attachment data URI. Treat names as text,
never paths.

### Presentation

- JSON: match `^application/json` including parameters; parse and pretty-print
  with `JSON.stringify`; invalid JSON renders escaped raw text in `<pre>`.
- URI-list: split lines, trim, render only http(s) as links with
  `rel="noopener noreferrer"`; `javascript:`, `data:`, `file:`, mixed-case and
  leading-whitespace cases remain escaped text; no fetch.
- ANSI logs: parse SGR including 256/truecolour into safe `<span>` classes,
  strip OSC/non-SGR CSI, escape text, add a copy button. Above 256 KB render
  escaped text without colour parsing.

### Contracts

Counts and summary stay as-is; attachments are counted before naming/
presentation. The report remains one offline file with the existing CSP.

## Risks / Trade-offs

- **ANSI parser** → support SGR only, strip other controls; XSS tests.
- **URI schemes** → only http(s) clickable; no `javascript:`/`data:` links.
- **JSON size** → pretty-print only visible text; no extra copy in summary.
- **CI URL** → escape and validate http(s); no request at render time.
- **Naming collisions** → deterministic names, not unique paths; counts stay.

## Migration Plan

No schema/CLI/API change. HTML output changes only.

## Open Questions

None.
