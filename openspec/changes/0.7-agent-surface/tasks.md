# Tasks

## 1. Contract

- [ ] 1.1 Run PIR + DXR over this proposal, the cli-api delta, the design and
  the tasks. Fold blockers back into the contract before Red.
- [ ] 1.2 Confirm the exact capabilities shape, the manifest subset and that
  the Markdown CI body is reusable for the index; measure the CI Markdown bytes
  for a fixed fixture and the current CLI option table. Confirm the single
  source for `node`, `inputs` and the CI kinds, and the relative-path helper
  shared by the manifest and the index.

## 2. Red

- [ ] 2.1 Write `test/capabilities.test.ts`: shape and key order, value
  cross-check against `package.json`, `SUMMARY_SCHEMA_VERSION`, the locale list,
  every limit and every default, the exclusivity matrix, help/version
  precedence, the 4,096-byte bound and determinism.
- [ ] 2.2 Write `test/cli-artifacts.test.ts` from the spec: manifest kinds and
  the full order report, PDF, email, history, `ci-markdown` in both paths,
  counts/attachments equality, skipped-attachment warning count, failure cap,
  order and `example` coordinate, hook-only failure, deterministic bytes, no
  cwd/input path/timestamp, relative paths in another directory; summary-only
  with `--email`/`--ci-out` artifacts; index body, relative and encoded links
  (including an unbalanced `)`, a third directory, a link to the manifest and a
  simulated cross-volume path), empty artifact section; collision matrix, empty
  paths, manifest and index write failures with later stdout skipped,
  manifest-only and index-only runs, and the extended order.
- [ ] 2.3 Add the stdout byte-identity tests: `--json` and `--ci` output with
  and without `--manifest`/`--index`, plus the updated usage-line pins.
- [ ] 2.4 Run the new tests and confirm they fail for the intended reason.

## 3. Implement

- [ ] 3.1 Add `src/capabilities.ts` and the CLI flag with its exclusivity and
  precedence checks; add the usage line.
- [ ] 3.2 Add `src/artifacts.ts` with the manifest builder, the index builder
  and the shared artifact ledger.
- [ ] 3.3 Wire the two outputs into both CLI paths: validation, write order,
  confirmations, failure messages, the "at least one output" check, the usage
  line and the pinned help tests.
- [ ] 3.4 Export no new public API symbol; make module-private constants
  shared internally where the document needs them.

## 4. Documentation

- [ ] 4.1 Add `docs/AGENT-SNIPPET.md`; link it from `llms.txt`,
  `docs/README.md` and `docs/AGENT-INTERFACE.md`; add it to `package.json`
  `files`.
- [ ] 4.2 Document `--capabilities`, the manifest schema, the index and the
  extended order in `docs/AGENT-INTERFACE.md`; update the email/PDF order
  statements there; add `--index` to `docs/CI.md`; add both files to the
  owner-only list in `docs/LIMITATIONS.md`; add the flags to `README.md` and
  the module names to `DESIGN.md` and `docs/ARCHITECTURE.md`.
- [ ] 4.3 Update `docs/CHANGELOG.md` (Unreleased) and `docs/BACKLOG.md`
  (B-062, B-063, B-064 resolved).

## 5. Reviews

- [ ] 5.1 Run SCR, CR, DAR, PSA and SEC blind and in parallel.
- [ ] 5.2 Fix every finding with a separate fixer or record a decision with a
  trigger; re-run the gate; delta re-check the reviewers.

## 6. Gate and archive

- [ ] 6.1 `npm run hygiene` and `npm run check` are green; confirm the report,
  summary, CI and email bytes are unchanged (no report-level change, so e2e is
  not required; prove it with the characterization/bundle hash).
- [ ] 6.2 `npm run package:check` packs the snippet; record the entry count.
- [ ] 6.3 Archive the change, sync the cli-api spec, push. No version bump,
  tag, stage or publish.
