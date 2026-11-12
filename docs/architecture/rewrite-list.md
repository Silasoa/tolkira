# Architecture rewrite list

Source: `C:\Users\YourSystem\AppData\Local\Temp\opencode\architecture-review-20261113-003825.html`
(2026-11-13, after 0.3.0). Statuses are coordinator decisions, not approved
interfaces yet.

## Do next (Strong)

- **Unified envelope index (`indexRun`).** One projection of features, latest
  attempts, results, attachments, diagnostics; model and summary both consume
  it. Add a cross-check test.
- **Deepened Attachment module.** One module owns media-type normalization,
  naming, kind, data URI and render dispatch; model and renderer stop
  re-deriving it.
- **E2E split + fixture helper.** Keep `test/fixtures.ts`; split the 2,200-line
  report spec by area and reuse clipboard/ANSI helpers.

## Explore (Worth exploring)

- **Typed DOM contract.** User-selected candidate. Define shared data-attribute
  names and a typed client boundary between `html.ts` and `report-client.js`;
  test the contract at one seam. Design in progress.
- **`html.ts` view seams.** Split the 1,200-line renderer at report, triage,
  matrix, details and attachment seams; `renderHtml` stays the only public
  entry. Extra evaluation queued.
- **Pure input detection.** Separate format detection/bytes from parsing so it
  can be tested without files. Extra evaluation queued.

## Speculative

- **Generated-assets build seam.** Move `styles.ts`/`client-bundle.ts` to a
  generated namespace and regenerate before typecheck/build. Extra evaluation
  queued.

## Not now

- Stream-adapter placement: already extracted to `src/stream.ts` in 0.3.0.
- Replacing `@cucumber/messages` parsing or Markdown/XML parsers: dependency
  surface is justified; do not add alternatives without a concrete defect.
