# Architecture rewrite list

Source: architecture review artifact from 2026-11-13 (local, not committed).
Statuses are coordinator decisions, not approved interfaces yet.

## Do next (Strong)

- **Unified envelope index (`indexRun`).** One projection of features, latest
  attempts, results, attachments, diagnostics; model and summary both consume
  it. Add a cross-check test.
- **Deepened Attachment module.** Rescoped to the real duplication: byte
  counting and media presentation lookup. `attachment.ts` already owns
  normalization and the safe-type allowlist.
- **Pure input detection.** Promote sniffing out of the async file loop into a
  pure decision table over `(content, identity)`; keep the 100 MB cap and
  content-hash dedupe in the loader.
- **Test split + fixture helper.** Widen the scope to `test/render.test.ts`
  (2,286 lines / 92 tests) as well as the 2,400-line e2e spec; reuse
  clipboard/ANSI/fixture helpers.

## Explore (Worth exploring)

- **Typed DOM contract.** User-selected. Design brief recommends a browser-safe
  `dom-contract.ts` with `encodeScenario`/`decodeScenario` (not a constants
  bag), covering data attributes, IDs and text hooks. Run slices 1+3 first:
  convert the client to TS/direct imports, then a Node round-trip test plus pure
  visibility decisions. Promote to Strong only if the 16,000-byte bundle does
  not grow (current headroom 854 B). `data-status` is overloaded; resolve it.
- **`html.ts` view seams.** Keep exploring, but first reflow the four 4–8 KB
  single-line template returns; then re-judge a split. The split alone is
  relocation, not depth, unless view ownership becomes real.
- **Pure input detection.** Separate format detection/bytes from parsing so it
  can be tested without files. Extra evaluation queued.

## Deferred

- **Generated-assets build seam.** Drop as speculative. The build scripts
  already regenerate before typecheck; revisit only if a second consumer needs
  the assets or a stale-output incident occurs.

## Not now

- Stream-adapter placement: already extracted to `src/stream.ts` in 0.3.0.
- Replacing `@cucumber/messages` parsing or Markdown/XML parsers: dependency
  surface is justified; do not add alternatives without a concrete defect.
