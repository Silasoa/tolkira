# TDD-Red

The approved spec is `specs/`. Red tests were written before production code:

- `test/stream.test.ts` — real `Readable.from(...).pipe(new CucumberHtmlStream(...))`
  parity with `renderReport`, including options. RED: class did not exist.
- `test/parameters.test.ts` + `test/fixtures/messages/parameters.ndjson` —
  typed spans, escaping, ambiguous/absent lists, invalid ranges, search text.
  RED: steps rendered escaped plain text with no `span.param`.
- `test/junit-producers.test.ts` + Jest/pytest/Gradle fixtures — regression
  characterisation only. The adapter already supports these shapes, so no RED
  is expected and no production change is allowed for this point.
- `test/fixtures.ts` and browser-spec imports — test-only cleanup. No runtime
  behaviour and no RED.

The implementer may add tests but may not remove, skip or weaken a Red test.
