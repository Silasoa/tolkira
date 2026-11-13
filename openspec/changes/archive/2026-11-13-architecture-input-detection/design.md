# Design

## Context

See `proposal.md`. `loadInputs` walks explicit files and directories, reads
content, deduplicates by SHA-256, enforces the 100 MB cap and then chooses a
legacy JSON, JUnit XML or Cucumber Messages adapter through inline `if/else`
fallbacks. The fallbacks encode both content sniffing and extension-based
validation. `src/input/legacy.ts` normalises legacy JSON to Messages per ADR
0004; the loader is the only place that knows the precedence between formats.

## Goals / Non-Goals

**Goals:**

- One pure function that maps `(content, identity)` to an adapter decision.
- Decision-table tests that need no temporary files or asynchronous setup.
- Byte-for-byte error and output compatibility for existing inputs.

**Non-Goals:**

- Changing sniffing rules, precedence, supported extensions or error text.
- Moving file reads, `stat`, directory traversal or deduplication into the
  detection module.
- Parsing legacy, JUnit or Messages content inside detection, except the legacy
  JSON probe that must parse to classify the content.

## Decisions

### Detection is a pure decision table

`src/input/detect.ts` exports `detectInput(content, identity)`, where identity
is `{ file, explicit }`. It returns a discriminated union describing the chosen
action: parse legacy, validate legacy, parse JUnit, validate JUnit, parse
Messages, validate Messages, validate JSON or skip. It performs no I/O, reads no
clock or environment and throws no validation errors.

The loader owns the mapping from decision to adapter call. Validation-only
decisions still invoke the existing adapter or `invalidJson` helper so error
messages and id prefixes stay exactly as they are. This keeps parsing and error
text at the trust boundary in the loader, while detection stays cheap to test.

Alternative considered: return parser functions from the table. Rejected as
premature indirection; a small discriminated union keeps the table inspectable
and the loader switch explicit.

### Precedence stays content first, identity second

The table applies the existing order:

1. A JSON array whose entries are feature-like is legacy JSON, including a
   parsed payload for `parseLegacyValue`.
2. A JSON array that starts legacy-like but fails to parse is legacy validation.
3. Content that looks like JUnit XML selects JUnit.
4. A first non-empty Messages envelope selects Messages.
5. An explicit `.xml` file falls back to JUnit validation.
6. An explicit Messages-extension file with empty content falls back to
   Messages validation.
7. Any other explicit file falls back to JSON validation.
8. A directory-discovered Messages-extension file falls back to Messages
   validation.
9. Everything else is skipped.

Content wins over extension so a Messages stream named `.json`, a legacy array
named `.ndjson` and Messages content named `.xml` keep working.

Alternative considered: extension-first detection. Rejected because it would
break documented content-based detection and existing fixtures.

### Tests move to the decision table when the file system adds nothing

`test/input-detect.test.ts` covers the condition/action table with inline
content, including BOM handling, malformed JSON, extension fallbacks,
explicit-versus-directory identity and precedence collisions. Temporary-file
tests in `test/inputs.test.ts` that only proved sniffing are removed. Directory
scanning, deduplication, duplicate ids, validation errors and grouping remain
loader integration tests with real files.

## Data Flow

Unchanged: inputs and directories -> loader reads and deduplicates bytes ->
`detectInput` chooses an adapter -> adapters produce Cucumber Messages ->
renderer produces one self-contained HTML file. Only the adapter choice moved
out of the loop.

## Risks / Trade-offs

- **Precedence drift** -> A decision-table suite enumerates content and
  identity combinations, including precedence collisions, and loader tests keep
  the end-to-end error surfaces green.
- **Error message drift** -> Detection never throws; validation-only decisions
  call the same adapter functions with the same source and id prefixes.
- **Legacy double parse** -> The probe still parses once for valid legacy
  arrays and passes the value to `parseLegacyValue`, exactly as before.
- **Pure module coupled to JUnit sniffing** -> It imports the existing
  `looksLikeJUnit` predicate so there is one definition of JUnit detection.

## Migration Plan

No migration. Internal module extraction only; public API and CLI behavior stay
unchanged.

## Open Questions

None.
