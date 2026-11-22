# Design

## JUnit class split

`featureFromSuite` currently maps one `<testsuite>` to one legacy feature whose
`elements` are the testcases. Change it to group the testcases by
`stringOf(testcase.classname)` and split only a nested-class shape:

- no classname, one distinct classname, or several classnames without a
  nested-class shape: return the current suite feature;
- nested-class shape (at least two distinct non-empty classnames and either a
  classname contains `$` or one classname is a dotted outer prefix of another):
  return one feature per classname, using the classname alone as the feature
  name (no suite prefix), the same `uri`, and the testcases of that class as
  `elements`. Testcases without a classname stay in a suite-named feature.

The shape check keeps producer templates such as jest-junit's
`"{classname} {title}"` from turning every testcase into a feature; those suites
keep one feature.

`parseJUnitXml` flattens the returned features. The legacy parser and report
model already support multiple features, so the JSON summary, statuses and the
source strip keep working. The JUnit nested-class distinction becomes a feature
row, matching the Surefire class rows.

## Legacy hook output

- Add optional `output?: string | string[] | null` to `LegacyStep`; validate it
  as string(s) only on hook steps, so non-hook output and `null` never regress a
  file.
- In the hook loop, after the `TestStepFinished` for a before/after hook, emit an
  `Attachment` envelope with:
  - `testStepId` of the hook, so the model attaches it to `ReportHook`;
  - `mediaType: text/plain`, `contentEncoding: IDENTITY`;
  - `body` = the output lines joined by `\n`;
  - `fileName` = `Before hook output` / `After hook output` (stable, readable).
- Empty strings, empty arrays and `null` are absent and produce no attachment.
- The existing `hookAttachments` mapping and `renderHook` show it; the scenario
  attachment count follows the existing rule.
- No JSON/schema field; the summary attachment counts include the hook output as
  a normal attachment.

## Tests

- JUnit: nested `Outer`/`Outer$Nested` and dotted prefixes split with exact
  feature names, all cases/statuses/source preserved; a classname-template suite
  stays one feature; mixed class/unclassed and two-suite classname cases stay
  separate and unmerged; a one-class suite is unchanged.
- Legacy: before/after and inline `steps` hook output string/array -> hook
  attachment body/name and rendered text; `null`, empty string/array and
  non-hook output -> no attachment; the summary attachment count is consistent.
  The real 8.1.0 fixture covers single-line hook output; the `\n` array join is
  covered by the synthetic two-line test.
- Existing JUnit/legacy/render goldens stay green except intentional feature/
  attachment changes; no new locale key.

## Risks

- Splitting a nested-class suite changes its feature count and
  `scenarios[].feature` names; this is the requested improvement and is
  documented. A classname-template suite deliberately keeps one feature.
- A hook output becomes an attachment; it counts in the existing totals. This is
  better than cucumber-html-reporter 7.2.0, which ignores hook output, not a
  parity claim. The real 8.1.0 fixture covers single-line outputs; the `\n` array
  join is unit-tested with a synthetic two-line output.
- Hook output is diagnostic text, not executed markup.
