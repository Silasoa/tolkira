# Proposal

## Why

`cucumber-html-reporter` still has roughly 2.17M npm downloads per month and 92
open issues; its last release was October 2024 and it carries a Cucumber 9
runtime dependency. Teams that already have a report script should be able to
swap the renderer without rewriting the options object. Tolkira already reads
the same legacy JSON; the missing piece is a thin compatibility layer.

This is a migration aid, not a multi-framework strategy. Tolkira stays
Cucumber-native; the shim only maps the old options shape and warns about
options it cannot honour.

## What Changes

- Add `tolkira/compat/cucumber-html-reporter` exporting
  `generate(options, callback?)` with the old option shape.
- Map inputs, output, title, metadata and logo; warn once per ignored option
  (themes, charts, external screenshots, custom CSS/JS, i18n, email, browser
  launch).
- Support `ignoreBadJsonFile` for directory inputs and reuse the recursive
  input scan and output-parent creation already in core.
- Do **not** transform the old generated HTML. The shim consumes the same
  input JSON and options and renders with Tolkira.

Out of scope for now (user decision): the
`multiple-cucumber-html-reporter` helper and a `tolkira compat` CLI
subcommand. Add them only when real demand appears; the shared options mapper
keeps that door open.

## Capabilities

### New Capabilities

- `compatibility`: drop-in option adapters for legacy Cucumber HTML reporters.

## Impact

- Adds an optional package subpath; no change to existing inputs, output or
  summary schema.
- Adds tests and a docs page; no new runtime dependency.
- Old themes and charts are not reproduced; this is documented and warned.
