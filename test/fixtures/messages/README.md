# Messages fixtures

`cucumber-jvm-7.22.1.ndjson`, `cucumber-ruby-12.0.1.ndjson` and
`screenshot.ndjson` are local producer fixtures. `second.ndjson` is a small
merge fixture.

`examples-tables.*` and `examples-tables-attachment.*` are copied from the
official Cucumber Compatibility Kit (`cucumber/compatibility-kit`, MIT), sample
`devkit/samples/examples-tables` and `devkit/samples/examples-tables-attachment`
on the `main` branch, fetched 2026-11-10. They are unmodified. The `.feature`
files document the Gherkin source; the `.ndjson` files are the Messages input.

`hooks.*`, `global-hooks.*` and `global-hooks-attachments.*` are copied from the
same Compatibility Kit samples on the same date. `hooks` covers per-scenario
hooks; the `global-hooks` samples cover BeforeAll/AfterAll and their
attachments.

`undefined.*`, `undefined-multiple.*`, `ambiguous.*`, `all-statuses.*` and
`empty.*` are copied unmodified from the same Compatibility Kit samples on
2026-11-10. `undefined` and `undefined-multiple` carry `suggestion` envelopes;
`ambiguous` and `all-statuses` carry `stepDefinition` envelopes. `ambiguous`
has two matching definitions; there is no separate `ambiguous-multiple` sample.
`all-statuses` covers passed, failed, pending, skipped, undefined and ambiguous.
`empty` has a scenario without steps.
