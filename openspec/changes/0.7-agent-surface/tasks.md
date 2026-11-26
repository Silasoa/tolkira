# Tasks

## 1. Contract

- [x] 1.1 Run PIR + DXR over this proposal, the cli-api delta, the design and
  the tasks. Both passed after two rounds; `--index` was cut and deferred as
  B-077.
- [x] 1.2 Confirm the exact capabilities shape and the manifest subset; measure
  the CI Markdown bytes for a fixed fixture and the current CLI option table.
  Confirm the single source for `node`, `inputs` and the CI kinds, and the
  relative-path helper used by the manifest.

## 2. Red

- [x] 2.1 Write `test/capabilities.test.ts`: shape and key order, value
  cross-check against `package.json`, `SUMMARY_SCHEMA_VERSION`, the locale list,
  every limit and every default, `inputs` against `detectInput`, the exclusivity
  matrix, help/version precedence, the 4,096-byte bound and determinism.
- [x] 2.2 Write `test/cli-artifacts.test.ts` from the spec: manifest kinds and
  the full order report, PDF, email, history, `ci-markdown` in both paths,
  counts/attachments equality, skipped-attachment warning count, failure cap,
  order and `example` coordinate, hook-only failure, deterministic bytes, no
  cwd/input path/timestamp, relative paths in another directory; summary-only
  with `--email`/`--ci-out` artifacts; collision matrix, empty paths,
  manifest write failure with later stdout skipped, manifest-only run, and the
  extended order.
- [x] 2.3 Add the stdout byte-identity tests: `--json` and `--ci` output with
  and without `--manifest`, plus the updated usage-line pins.
- [x] 2.4 Run the new tests and confirm they fail for the intended reason.

## 3. Implement

- [x] 3.1 Add `src/capabilities.ts` and the CLI flag with its exclusivity and
  precedence checks; add the usage line.
- [x] 3.2 Add `src/artifacts.ts` with the manifest builder and the shared
  artifact ledger.
- [x] 3.3 Wire the manifest into both CLI paths: validation, write order,
  confirmation, failure message, the "at least one output" check, the usage
  line and the pinned help tests.
- [x] 3.4 Export no new public API symbol; make module-private constants
  shared internally where the document needs them.

## 4. Documentation

- [x] 4.1 Add `docs/AGENT-SNIPPET.md`; link it from `llms.txt`,
  `docs/README.md` and `docs/AGENT-INTERFACE.md`; add it to `package.json`
  `files`.
- [x] 4.2 Document `--capabilities`, the manifest schema and the extended order
  in `docs/AGENT-INTERFACE.md`; update the email/PDF order statements there;
  add the manifest to the owner-only list in `docs/LIMITATIONS.md`; add the
  flags to `README.md` and the module names to `DESIGN.md` and
  `docs/ARCHITECTURE.md`.
- [x] 4.3 Update `docs/CHANGELOG.md` (Unreleased) and `docs/BACKLOG.md`
  (B-062 and B-064 resolved, B-063 manifest half delivered, B-077 carries the
  deferred index).

## 5. Reviews

- [x] 5.1 Run SCR, CR, DAR, PSA and SEC blind and in parallel.
- [ ] 5.2 Fix every finding with a separate fixer or record a decision with a
  trigger; re-run the gate; delta re-check the reviewers.

## 6. Gate and archive

- [ ] 6.1 `npm run hygiene` and `npm run check` are green; confirm the report,
  summary, CI and email bytes are unchanged (no report-level change, so e2e is
  not required; prove it with the characterization/bundle hash).
- [x] 6.2 `npm run package:check` packs the snippet; record the entry count.
  86 entries on 2026-11-26 with `docs/AGENT-SNIPPET.md` and docs/README.md.
- [ ] 6.3 Archive the change, sync the cli-api spec, push. No version bump,
  tag, stage or publish.
