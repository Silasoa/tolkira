# TDD Red — metadata-links

New files only: `test/metadata-links.test.ts`, `test/e2e/metadata-links.spec.ts`.

## Red: 6 unit failures

`npx vitest run test/metadata-links.test.ts` → 6 failed, 4 passed.

All six fail at the same cause: received header/details contain the escaped
value as text, not an anchor. Representative assertion:

`AssertionError: expected '<header class="runHead"><div><p class…' to contain
'<span><b>CI run</b> <a href="https://…'`

- header + Details safe URL
- normalized forms (`http:example.com` first, then backslash and space forms)
- padded/bidi-wrapped label
- `&`/quote escaping
- CLI `--meta`
- compat-shim `metadata`

Correct: the current HTML marks no safe metadata value as a link, so the
expected literals encode the whole contract — normalized href, trimmed
bidi-stripped escaped label, `rel="noopener noreferrer"` — and cannot pass by
accident.

## Red: e2e

`npx playwright test test/e2e/metadata-links.spec.ts --project=chromium`
fails because `getByRole('link')` finds no header anchor at 320 px / 32 px.
The preceding overflow guard passed: the plain long URL already wraps.

## Green guards (kept green)

- unsafe, scheme-less, malformed and plain values stay escaped text, no anchor
- internal tab/LF/CR stay text, no anchor
- empty key/value entries stay omitted
- CLI JSON stdout, email and CI Markdown bytes are identical with and without
  URL metadata
- existing `parity-metadata`, render-report, render-golden, compat, CLI, email
  and CI suites: 117 passed, 1 skipped
- `npx tsc --noEmit` clean

Not checked: Firefox/WebKit e2e locally.
