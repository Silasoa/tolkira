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

`rules.*`, `backgrounds.*` and `rules-backgrounds.*` are copied unmodified from
the same Compatibility Kit samples on the same date. `rules` covers two rules
and a rule tag; `backgrounds` covers a feature background; `rules-backgrounds`
covers a feature background and a rule background together.

`empty-none.*`, `empty-mixed.*`, `empty-statuses.*`, `empty-all-unexecuted.*`,
`empty-unfinished.*`, `empty-hook-only.*`, `empty-retry.*`,
`empty-unexecuted-attachment.*` and `empty-outline-mixed.*` are local
compositions for unexecuted-row behaviour. They cover a feature without
scenarios, one passed plus one started-but-blank row, a passed/failed/blank
feature, an all-blank feature, a started test case without results or a finish
envelope, a hook-only result, a retry whose latest attempt has no result, a
started attempt that emitted an attachment but no result, and an outline with
one started blank example beside one never-started example. The `.feature`
files document the Gherkin source.

`ci-full.ndjson`, `ci-partial.ndjson`, `ci-unsafe.ndjson`, `ci-mixed.ndjson`,
`ci-ssh.ndjson` and `ci-url-only.ndjson` are local compositions for `meta.ci`
coverage: a full GitHub Actions block, a name-only block, a hostile block with
a `javascript:` URL, bidi controls and a non-http remote, a run with a first
full block, an empty block and a later full block, an scp-like GitHub SSH
remote, and a URL-only block without a name. The first non-empty block must
win.

`markdown-descriptions.*` is a local composition for safe GFM rendering. Its
feature, rule, background, scenario, outline and examples descriptions cover
headings, lists, tables, blockquotes, links, raw HTML and inline, reference and
linked images. The `.ndjson` file is the authoritative input; the `.feature`
file is an abridged illustration. The legacy and JUnit Markdown fixtures under
`test/fixtures/legacy/markdown-description.json` and
`test/fixtures/junit/markdown-description.xml` are local hand-written inputs
for the same renderer, not producer captures.

`attachments-naming.ndjson`, `attachments-presentation.ndjson` and
`attachments-large.ndjson` are local compositions for attachment polish.
Naming covers unnamed known, parameterised, unknown, named, path-like, hostile,
URI-list and Cucumber log media types. Presentation covers pretty, precision
and malformed JSON, a mixed URI list with bidi text, and an ANSI log with SGR,
bright, 256-colour, truecolour, background-only, OSC, non-SGR CSI, bidi and
HTML.
`attachments-large.ndjson` holds one ANSI log at exactly 262,144 UTF-8 bytes
and one at 262,145 bytes; the second must fall back to escaped text. Matching
`.feature` files document the Gherkin source.

The Compatibility Kit has no standalone tags sample. `tags.*` is a local copy
of `rules.*` with a feature tag, a second rule tag and a scenario tag added to
the AST and pickle envelopes, so tag inheritance can be tested end to end.
`rules-outline-background.*` is a local composition: the `examples-tables`
outline is wrapped in a tagged rule with a named background, and the feature
gets a named background and a feature tag. Both local fixtures are documented
by their `.feature` files; only `rules-backgrounds`, `examples-tables` and the
other listed samples are unmodified Compatibility Kit input.
