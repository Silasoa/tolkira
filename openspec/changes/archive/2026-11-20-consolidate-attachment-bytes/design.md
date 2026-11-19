# Design

## Context

Data flow today: input files → `loadInputs` → `sanitizeEnvelopes` (per-attachment
and total caps) → `indexRun` → `buildReportModel` and `summarizeIndex` → the
renderer → one HTML string. Attachments cross every step.

The duplication the issue names:

- `src/input/sanitize.ts` has `base64Bytes` and its own 50 MB/100 MB constants.
- `src/report/model.ts` computes decoded bytes inline and owns
  `attachmentFileName` and `attachmentKind`.
- `src/summary.ts` has a second `attachmentBytes` with the same formula.
- `src/render/attachments.ts` repeats the media-type switch for JSON,
  `text/uri-list`, Cucumber ANSI logs and plain text.
- `src/input/playwright.ts` keeps a third copy of the cap constants for path
  files, where the size comes from `stat` rather than a body.

`src/report/attachment.ts` already owns media-type normalisation and the safe
allowlist. It is a leaf module with no imports of its own.

## Decision: one shared attachment module

Move `src/report/attachment.ts` to `src/attachment.ts` and deepen it. The module
is a shared kernel consumed by the input layer, the report model, the summary and
the renderer. Keeping it under `report/` would make `input/sanitize.ts` and
`input/playwright.ts` import from the report layer, which reverses the documented
input → Messages → report direction. A top-level leaf avoids that and keeps the
single runtime package and ESM shape from ADR 0002.

The module imports only `@cucumber/messages` types. It imports no project module,
so no cycle is possible. The move changes import paths only; no output.

## Interface

```ts
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 100 * 1024 * 1024;
export const MAX_TEXT_ATTACHMENT_BYTES = 262_144;

export type AttachmentKind = 'image' | 'video' | 'audio' | 'text' | 'binary';
export type AttachmentTextFormat = 'json' | 'uri-list' | 'log' | 'plain';

export interface AttachmentMetadata {
  mediaType: string; // safe, allowlisted
  kind: AttachmentKind;
  fileName: string; // Cucumber name or deterministic fallback
  bytes: number; // decoded bytes
  textFormat: AttachmentTextFormat; // renderer's text presentation
}

export function attachmentBytes(
  attachment: Pick<Attachment, 'body' | 'contentEncoding'>,
): number;

export function attachmentMetadata(
  attachment: Pick<
    Attachment,
    'body' | 'contentEncoding' | 'fileName' | 'mediaType'
  >,
): AttachmentMetadata;
```

A single internal `MEDIA_TYPES` table maps each allowlisted media type to its
extension, kind and text format. `safeMediaType` keeps the current behaviour:
normalise parameters and case, then map anything outside the table to
`application/octet-stream`. The table also derives the safe set, so the extension
list and the allowlist cannot drift apart. `normalizedMediaType` and
`safeMediaType` stay exported as they are today so the allowlist contract can be
tested directly; the model calls `attachmentMetadata` and the renderer no longer
needs media-type knowledge.

`attachmentBytes` keeps the exact current arithmetic:

- `BASE64`: `max(0, floor(body.length * 3 / 4) - padding)`, where padding is 2 for
  `==`, 1 for `=`, otherwise 0;
- identity: `Buffer.byteLength(body, 'utf8')`;
- missing body counts as empty.

This is the decoded size for canonical base64, not the base64 length. The formula
avoids decoding large bodies just to count them and matches the documented
summary field. Non-canonical base64 (embedded whitespace or newlines) keeps the
current length-based arithmetic; this change does not start validating or
re-encoding bodies.

`attachmentMetadata` calls `safeMediaType` once, then returns the table entry.
Unknown, forged, comma-joined, XML and XHTML values already collapse to
`application/octet-stream`, which yields `attachment.bin`, kind `binary` and
plain text. A non-empty (truthy) Cucumber `fileName` is used unchanged; an empty
string falls back exactly as today, and whitespace is not trimmed.

## Consumers

- `src/input/sanitize.ts`: `attachmentBytes` for the per-attachment check and the
  running total; `MAX_ATTACHMENT_BYTES` / `MAX_TOTAL_ATTACHMENT_BYTES` from the
  module. Remove `base64Bytes` and the local constants. The checks stay in the
  same order and keep `>` (exactly 50 MB and exactly 100 MB are accepted).
- `src/report/model.ts`: `attachmentMetadata` for `fileName`, `mediaType`,
  `kind`, `bytes` and the new internal `textFormat`; remove the local naming,
  kind and byte code. `ReportAttachment.kind` and `textFormat` use the module
  types.
- `src/summary.ts`: `attachmentBytes` for `attachments.bytes`; remove the local
  function. The summary shape and values do not change.
- `src/render/attachments.ts`: switch on `attachment.textFormat`; remove the
  media-type import. `MAX_TEXT_ATTACHMENT_BYTES` remains the render-size guard
  for large JSON and ANSI text. That guard measures decoded text, not the
  attachment accounting, so it keeps its own `Buffer.byteLength` check.
- `src/input/playwright.ts`: import the two cap constants instead of declaring
  them. Path files keep their `stat`-based checks; only the constant values are
  shared. Inline bodies keep going through the sanitizer.

`MAX_TEXT_ATTACHMENT_BYTES` stays in the attachment module, where `ansi.ts`
already imports it.

## Data flow after the change

```
input files
  → loadInputs
  → sanitizeEnvelopes (attachmentBytes + shared caps)
  → indexRun
  → buildReportModel (attachmentMetadata) ─┐
  → summarizeIndex (attachmentBytes)       ├→ renderer (textFormat) → HTML
```

The model and summary still read the same `RunIndex`, and the renderer still
consumes only the report model. No new seam or data copy is introduced. The
sanitizer sees every attachment envelope, including retries and unexecuted
cases, while the model and summary count attachments that render; the
consolidation unifies the byte formula, not those populations.

## Hard parts and risks

- **Behaviour-neutral by construction.** The formulas, allowlist, fallback
  names, cap comparisons and text branches are moved, not rewritten. The render
  characterization hashes and both golden snapshots are the byte-level guard;
  the model/summary cross-check guards the two consumers' agreement.
- **Boundary semantics.** The caps use strict `>` and the base64 padding rule is
  length based. Tests pin exactly 50 MB / 50 MB + 1 and exactly 100 MB /
  100 MB + 1, including a multi-attachment total.
- **Internal field only.** `textFormat` is added to `ReportAttachment` so the
  renderer does not re-derive it. It is not written to HTML or the summary.
- **Path versus body accounting.** Playwright path caps use file size before
  base64 encoding; the sanitizer counts the decoded body. Sharing only the
  constants keeps both checks unchanged. A file accepted at the stat boundary is
  still accepted after decoding.
- **Import move.** `tsc` catches a stale path; the module has no project imports,
  so the move cannot create a cycle.
- **No performance change.** The work per attachment is the same arithmetic plus
  one table lookup; the base64 formula does not decode bodies.
- **Audio stays unreachable.** `AttachmentKind` and the renderer keep the audio
  branch, but no `audio/*` type is allowlisted today, so audio still collapses
  to `application/octet-stream`. Adding an audio MIME is a separate change.
- **Cap messages stay in place.** The module owns the numbers, not the user-facing
  wording. The sanitizer and Playwright messages stay verbatim and are pinned by
  tests instead of being centralised in this refactor.

## Relevant ADRs

- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md) — one package,
  ESM, Node 22+; a shared top-level module keeps that shape.
- [ADR 0004](../../../docs/adr/0004-normalize-to-messages.md) — normalise inputs
  to Messages; the module still operates on Messages attachments.
- [ADR 0005](../../../docs/adr/0005-server-rendered-shell.md) — server-rendered
  view model; `textFormat` stays an internal view-model detail.

## Verification

1. **Baseline before touching `src/`:** run
   `npx vitest run test/render-characterization.test.ts test/render-golden.test.ts test/model-summary-cross-check.test.ts test/parity-metadata.test.ts test/model.test.ts test/summary.test.ts`
   and record that the eight hashes, two goldens, all cross-check fixtures and
   the naming/JSON/URI/ANSI suite are green. The committed constants are the
   before/after proof; no baseline file is regenerated.
2. **TDD-Red:** add `test/attachment.test.ts` covering:
   - `attachmentBytes` for empty, identity ASCII, identity multi-byte UTF-8,
     base64 with zero, one and two padding characters, and a body whose base64
     length differs from its decoded length;
   - `attachmentMetadata` table-driven over all 14 current allowlisted media
     types, asserting the exact `{ mediaType, fileName, kind, textFormat }` row
     for each, including `text/csv`, `text/html`, `video/mp4` and `video/webm`;
     a named file; an empty `fileName` with a known type (expect
     `attachment.<ext>`) and an unknown type (expect `attachment.bin`);
     parameterised, unknown, XML, XHTML and comma-joined values; and a negative
     case that `audio/mpeg` still normalises to `application/octet-stream` and
     did not enter the allowlist;
   - a source guard that the base64 byte formula and the 50 MB literal appear
     only in `src/attachment.ts`; the 100 MB attachment literal is also there,
     and the separate `src/input/load.ts` total-input cap is explicitly
     excluded. It is a cheap structural check; the behavioural unit tests and
     the cross-check are the real proof.
   Add a model-level empty-fileName assertion to `test/model.test.ts`.
   Add `sanitizeEnvelopes` cap tests to `test/sanitize.test.ts`: exactly 50 MB
   accepted and 50 MB + 1 rejected with the exact current message; an identity
   body at the same boundary; exactly 100 MB total accepted and 100 MB + 1
   rejected across attachments with the exact total message; and the
   per-attachment error winning when both limits are exceeded. Reuse one large
   body where possible and avoid parallel allocation spikes. This pins the
   consumer that applies `>` and accumulates the total, not only the byte helper.
   Both files must fail before the module exists (or for the missing shared
   constants), then pass without weakening.
3. **Existing suites:** `test/model-summary-cross-check.test.ts`,
   `test/render-characterization.test.ts`, `test/render-golden.test.ts`,
   `test/parity-metadata.test.ts` (names, JSON, URI-list, ANSI, forged media
   types), `test/model.test.ts`, `test/summary.test.ts`, `test/render.test.ts`,
   `test/ansi.test.ts`, `test/legacy.test.ts`, `test/sanitize.test.ts`,
   `test/playwright.test.ts` and `test/compat.test.ts`.
   `test/render-attachments.test.ts` is the skipped-attachment notice suite, not
   presentation coverage.
4. **Gate:** `npm run hygiene`, `npm run check`, `npm run test:e2e` including
   `test/e2e/parity-metadata.spec.ts`.
5. **Review:** SCR, CR, DAR, STR, SEC, PCA over the spec intent and the diff.
   Findings are fixed by a separate fixer, then re-checked. UXR and CMP are not
   triggered: no shell/markup/feature change, and the byte-identical proof is the
   parity check.

## Security

The trust boundary does not move. Attachment bodies, file names and media types
remain untrusted. `safeMediaType` stays the only allowlist and now also drives
the kind and text format, so a forged type cannot pick a renderer branch through
a separate lookup. HTML/SVG still render as escaped text or an `<img>` data URI
as before; JSON pretty-printing and URI-list link filtering keep their existing
escaping. Caps are unchanged. The tests that pin forged media types, XSS payloads
and the offline baseline stay green.
