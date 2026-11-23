# Design

## Seam

`parseJUnitXml(content, source, options)` gains
`allowEmptyDocument?: boolean`. The parser already owns the "document has no
test cases" knowledge and the existing error text; the flag allows returning
`[]` only when the document is exactly one recognised root with no test case
anywhere, and the existing error is thrown otherwise:

```ts
const suites = collectSuites(parsed).filter(
  (suite) => asArray(suite.testcase).length > 0,
);
if (suites.length === 0) {
  if (
    options.allowEmptyDocument &&
    singleRecognizedRoot(parsed) &&
    !containsTestcase(parsed)
  ) {
    return [];
  }
  throw new Error(
    `Unsupported JUnit XML in ${source}: expected <testsuites> or <testsuite> with <testcase>.`,
  );
}
```

Two small helpers over the parsed tree keep the skip exactly "one recognised
root and no test case":

- `singleRecognizedRoot(parsed)` — the top-level element keys (ignoring the
  parser's `?xml`/`?pi` and `#...` keys) are exactly one of `testsuites`,
  `testsuite` or `testcase`. For `testsuites` the value must not be an array
  (multiple roots become one); for `testsuite`/`testcase` the value must be a
  one-item array (the parser's `isArray` wraps a single root).
- `containsTestcase(node)` — walks arrays and objects and is true when any key
  is `testcase`. An attribute named `testcase` may false-positive, which throws
  instead of skipping.

An unrecognised wrapper root, a multi-root document and a `<testcase>` under an
unrecognised element therefore still throw the existing error instead of being
silently dropped.

`src/input/load.ts` passes the flag only in the `junit` case and only for a
non-explicit file:

```ts
case 'junit':
  parsed = await parseJUnitXml(content, input.file, {
    idPrefix: `junit-${index}`,
    allowEmptyDocument: !input.explicit,
  });
  break;
```

A file that is also named explicitly is treated as explicit even when the
directory scan found it first: `add()` ORs the flag, so an explicit request
always wins. The content-dedup branch re-validates an explicit JUnit duplicate
strictly, so a byte-identical explicit copy of a skipped directory file cannot
bypass the explicit guard.

`junit-validation` stays strict. It only fires for an explicit `.xml` that does
not look like JUnit, so the explicit-file error path is unchanged.

## Why not filter in the loader

The loader would have to re-parse or pattern-match the document to know whether
it has test cases. That duplicates the adapter's suite collection (nested
suites, array normalisation) and can disagree with it. The option keeps one
source of truth.

## Why not skip every empty document

A sole explicit empty file is likely a wrong path or a wrong format; the
existing `Unsupported JUnit XML ... expected ...` error is the useful guard and
is documented. A directory is a producer dump where an empty suite is normal.
The explicit flag already distinguishes the two cases, and it is set when a
directory file is also named explicitly, so an explicit request always wins.

## Accounting

A skipped document still produces a `LoadedInput` group with zero envelopes,
exactly like an unrelated XML that `detectInput` skips. The `inputFiles` count
therefore stays honest, provenance ignores the group, and the existing
`groups.every((group) => group.envelopes.length === 0)` check turns an
all-zero-test directory into `No supported report files found.` with no report
written. A mixed Cucumber + zero-test JUnit directory still succeeds because
the Cucumber group has envelopes.

The content-dedup branch in `load.ts` re-validates only an explicit JUnit
duplicate (`detectInput(...).kind === 'junit'`), then continues. Other formats
keep the pre-existing dedup; the `shortcut:` comment records that limit and the
trigger to upgrade.

## Risks

- An all-zero-test directory now reports the generic loader error instead of the
  JUnit-specific one. The explicit-file path keeps the specific message; the
  generic message is accurate for a directory with no usable content.
- A malformed document that happens to look like JUnit still fails the whole
  directory. That is intended: the skip must not swallow a parse error.
- No change to detection, summary, renderer, history or attachments.
