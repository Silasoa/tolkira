# TDD-Red record — compat-merged-json

## Files

- Added: `test/compat-sidecar.test.ts` (7 Red tests).
- Implementer additions: 10 further acceptance tests, 17 sidecar tests in total.
- No production code, config, docs or existing tests changed by TDD-Red.

## Command

```
npx vitest run test/compat-sidecar.test.ts
```

Result: **5 failed, 2 passed** (exit 1). Correct Red.

## Failing tests (missing behavior)

1. `writes the merged legacy array next to a jsonDir report`
   - `ENOENT ... reports/group.html.json`: no sidecar is written; the HTML
     itself is generated.
2. `concatenates elements of features with the same uri`
   - `ENOENT ... report.html.json`: no sidecar; merge by `uri` cannot be
     observed.
3. `merges features without a uri under one fallback key`
   - `ENOENT ... report.html.json`: no sidecar; fallback key untested by
     implementation.
4. `refuses to overwrite an input with the sidecar`
   - `AssertionError: promise resolved ... instead of rejecting`: the shim
     writes the HTML and leaves `report.html.json` untouched instead of
     refusing when `<output>.json` is an input.
5. `merges only valid files when ignoreBadJsonFile is set`
   - `ENOENT ... report.html.json`: no sidecar, although the report renders
     and the malformed file is warned about.

All five fail because the sidecar step does not exist yet, not because of a
test bug or fixture problem. Each test first proves the report path works
(HTML assertions, warnings), so the missing file is the only failure.

## Passing guards (must stay green)

- `writes no sidecar for jsonFile, even with jsonDir`: both calls resolve and
  no `<output>.json` exists. Passes before and must pass after.
- `leaves no sidecar when the HTML report cannot be written`: `output` is a
  directory, `generate` rejects and no sidecar exists. Passes before and must
  pass after; it pins the design order "HTML first, sidecar second".

## Implementer additions (post-Red)

- `replaces a stale sidecar`: an earlier `<output>.json` outside `jsonDir` is
  replaced atomically.
- `replaces its own sidecar on a second run inside jsonDir`: the previous
  sidecar is excluded from the inputs, the reports do not duplicate features and
  the sidecar is rewritten.
- `refuses a sidecar input with a unique feature uri`: a source file at the
  reserved path with an unrepresented URI rejects and stays byte-identical.
- `refuses non-array JSON at the sidecar path`: shape-invalid JSON is never
  treated as a vacuous previous sidecar; it rejects before the HTML.
- `refuses a sidecar with represented and unique uris`: one represented key does
  not hide another unique key.
- `handles a BOM source on first and second runs`: one leading UTF-8 BOM is
  accepted by both the report and the sidecar parse.
- `accepts a BOM source when ignoreBadJsonFile is set`: the validation path
  strips the BOM too, so the file is neither skipped nor warned about.
- `replaces its own sidecar in a jsonDir subdirectory`: recursive scan plus the
  reserved-path exclusion works below the input root.
- `rejects a legacy file with a non-object feature before the HTML`: shape
  validation runs before the report, not after.
- `rejects non-legacy JSON in jsonDir before the HTML`: a Playwright-style
  object is not a compat input on the sidecar path.

## Coverage rationale

- Equivalence classes: `jsonDir` vs `jsonFile` vs both; valid vs malformed
  directory input; file output vs directory output.
- Boundaries: collision where the sidecar path equals the single input; a
  valid previous sidecar on the second same-directory run; non-array and mixed
  represented/unique files at the reserved path; nested output directory
  (`reports/group.html`) exercises parent creation.
- Merge rules: distinct `uri`, duplicate `uri`, absent `uri`; element order is
  not asserted across filesystem order, counts and the id set are.
- Shape: both features present, elements concatenated, `retried: 0` on every
  element, and raw text equals `JSON.stringify(merged, null, 2)` to pin the
  two-space pretty print. One leading UTF-8 BOM is accepted on every compat
  parse path; non-array and non-object feature content is rejected before the
  HTML.
- Safety: input bytes are compared before/after every collision; sidecar absence
  is checked after a failed HTML write; reserved-path refusals leave no HTML.
