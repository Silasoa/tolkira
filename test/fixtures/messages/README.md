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
