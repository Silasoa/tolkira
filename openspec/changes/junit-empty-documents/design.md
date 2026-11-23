# Design

## Seam

`parseJUnitXml(content, source, options)` gains
`allowEmptyDocument?: boolean`. The parser already owns the "document has no
test cases" knowledge and the existing error text; the flag only chooses
between returning `[]` and throwing:

```ts
const suites = collectSuites(parsed).filter(
  (suite) => asArray(suite.testcase).length > 0,
);
if (suites.length === 0) {
  if (options.allowEmptyDocument) return [];
  throw new Error(
    `Unsupported JUnit XML in ${source}: expected <testsuites> or <testsuite> with <testcase>.`,
  );
}
```

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
exactly like an unrelated XML that `detectInput` skips. The input-file list
therefore stays honest, provenance ignores the group, and the existing
`groups.every((group) => group.envelopes.length === 0)` check turns an
all-empty directory into `No supported report files found.` with no report
written.

## Risks

- An all-empty directory now reports the generic loader error instead of the
  JUnit-specific one. The explicit-file path keeps the specific message; the
  generic message is accurate for a directory with no usable content.
- A malformed document that happens to look like JUnit still fails the whole
  directory. That is intended: the skip must not swallow a parse error.
- No change to detection, summary, renderer, history or attachments.
