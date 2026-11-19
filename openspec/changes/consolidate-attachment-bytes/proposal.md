# Proposal

## Why

Attachment knowledge is spread across the input cap check, the report model, the
summary and the renderer. Three places count decoded attachment bytes with their
own copy of the same base64 arithmetic, and the media-type to name, kind and text
presentation lookup is split between the model and the renderer. A change to one
copy can silently drift from the others, so attachment caps, summary bytes and
the rendered report may disagree. Issue #9 (backlog B-006) asks for one owner.

The consolidation unifies the formula, not the populations: the sanitizer counts
every attachment envelope, including retries and unexecuted cases, while the
report model and summary count the attachments that render. Those numbers are
not required to become equal.

## What Changes

- One attachment module owns decoded byte size, the cap limits, fallback naming,
  kind and the text presentation lookup.
- The attachment caps, report attachment bytes and summary attachment bytes call
  the same byte function instead of repeating the formula.
- Attachment naming, kind and JSON/URI-list/ANSI/plain text presentation come from
  the same media-type table; the model and renderer no longer carry their own
  classification.
- Duplicate local helpers and constants are removed.

Out of scope:

- changing the 50 MB per-attachment cap, the 100 MB total cap or the MIME
  allowlist;
- changing attachment behaviour, naming rules, kinds, payloads or presentation;
- changing the summary schema version 2, the HTML output, public exports,
  dependencies or the CSP;
- the 100 MB total-input cap in the input loader and the `CucumberHtmlStream`
  entry point, which does not run `sanitizeEnvelopes`; both keep current
  behaviour;
- external or split assets (B-008) and any new report feature.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a behaviour-neutral refactor: no user-visible or contract
behaviour changes, so no capability delta is written and the change carries
`skip_specs: true`. The existing requirements that must stay green are:

- `input-formats` — **Preserve legacy embeddings as attachments**;
- `report-rendering` — **Render attachments safely**, **Improve attachment
  naming**, **Render JSON and URI-list attachments**, **Render Cucumber ANSI
  logs safely**, **Escape user-controlled content** and **Keep the offline and
  count contracts**;
- `cli-api` — **Provide a machine-readable summary**.

The 50 MB per-attachment and 100 MB total attachment caps are documented in
`docs/ARCHITECTURE.md` (Security) and `docs/AGENT-INTERFACE.md` (Current
limits); the decoded `attachments.bytes` field is documented in
`docs/AGENT-INTERFACE.md` (Field contract). Those documented contracts and the
MIME allowlist are pinned by tests, not by a capability requirement.

## Impact

- The attachment module, the input sanitizer and Playwright cap check, the report
  model, the summary and the attachment renderer.
- New unit tests for decoded byte counting, the full media table and sanitize cap
  boundaries; the existing model/summary cross-check, render characterization,
  goldens, `parity-metadata` (names, JSON, URI-list, ANSI, forged types),
  `model`, `summary`, legacy, sanitize, ANSI and Playwright suites stay green.
  `test/render-attachments.test.ts` covers the skipped-attachment notice only,
  not naming or media presentation.
- No public API, dependency, summary schema or HTML output change.

## Acceptance criteria

- Only the attachment module computes decoded attachment bytes. The sanitizer's
  per-attachment and total attachment caps, the report model's attachment bytes
  and the summary's `attachments.bytes` consume that function. The Playwright
  path caps share `MAX_ATTACHMENT_BYTES`/`MAX_TOTAL_ATTACHMENT_BYTES` and keep
  their pre-read `stat` check; the 100 MB total-input cap in `src/input/load.ts`
  and the `CucumberHtmlStream` path are unchanged and out of scope. No duplicate
  base64 byte formula or cap literal remains under `src/`.
- Unit tests pin base64 and identity byte counts, padding, empty bodies, the
  exact 50 MB and 100 MB boundaries with the current error messages, the
  non-empty-fileName rule including an empty string, fallback names,
  known/parameterised/forged media types, all 14 allowlisted rows, kinds and
  JSON/URI-list/ANSI/plain presentation.
- The summary schema and report output stay identical: the existing model/summary
  cross-check, the eight-fixture render characterization hashes, both golden
  snapshots and `test/parity-metadata.test.ts` pass before and after the change.
- `npm run hygiene`, `npm run check` and `npm run test:e2e` are green, including
  `test/e2e/parity-metadata.spec.ts`.

## Review gate

PIR and DXR ran over this proposal, the design and the preserved requirements on
2026-11-19. PIR found blockers on the preserved-requirement names, the
empty-`fileName` boundary, the evidence suite and the cap scope; DXR found the
missing sanitizer cap-boundary tests and the unpinned media table. All blockers
are fixed in this proposal and the design. The implementation runs as a TDD pair:
TDD-Red writes the new module and boundary tests first, then the implementer
makes them green without changing output. Review swarm: SCR, CR, DAR, STR, SEC
and PCA. SEC is triggered because attachment accounting and media-type handling
are a trust boundary. UXR and CMP are not triggered: no report shell, markup or
user-facing feature changes, and the characterization and goldens prove the
output bytes are unchanged. Refs #9 and B-006.
