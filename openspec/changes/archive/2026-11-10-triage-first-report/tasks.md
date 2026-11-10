# Tasks

## 1. Exception-first order (slice 1)

- [x] 1.1 RED: render test with a mixed fixture; assert feature and scenario
  order.
- [x] 1.2 GREEN: export `statusSeverity` from the model and build the ordered
  view with `passed last, severity desc, input index asc`.
- [x] 1.3 Test ties, all-passed input, empty feature and zero scenarios; assert
  the Details table keeps input order and the summary keeps its documented
  order.

## 2. Needs-attention index (slice 1)

- [x] 2.1 RED: tests for rows, per-status counts, links, absence when all
  passed and exclusion of features without scenarios.
- [x] 2.2 GREEN: render the index from the ordered view above the feature list.
- [x] 2.3 Boundary tests: exactly 3 and 4 non-passing scenarios in a feature;
  exactly 20 and 21 non-passing features.
- [x] 2.4 Security test: script/HTML in feature and scenario names stays text;
  no new external reference or inline data store.

## 3. Anchors and reveal (slice 1)

- [x] 3.1 Add deterministic anchors and the `revealHash` listener to the inline
  script; keep the computed script hash and CSP green.
- [x] 3.2 Browser test: follow a pending scenario link, both ancestor details
  open, hash names the target, no other scenario opens.
- [x] 3.3 Browser test: keyboard activation of an index link; report still
  readable with scripting disabled.

## 4. Feature rows and matrix (slice 2)

- [x] 4.1 RED: feature row shows passed/total, non-passing counts and a
  proportion bar; passed features render after the attention set.
- [x] 4.2 RED: Details matrix has one column per present status, totals and
  duration; zero counts are muted but present.
- [x] 4.3 GREEN: render both from the ordered view and `ReportModel` counts.
- [x] 4.4 Test a clean run, a single-status run and a 320 px table scroll.

## 5. Source strip (slice 3)

- [x] 5.1 Add a loader-to-model provenance group and `sourceFile` on features;
  keep the flat envelopes entry point working without provenance.
- [x] 5.2 RED: two input files render two cards, sorted by worst status; a
  single file renders none.
- [x] 5.3 RED: a URI shared by two inputs or a merged stream renders no source
  strip; assert no URI-path inference.
- [x] 5.4 Browser test: the source strip is visible for two files, hides on
  filters, and does not break the feature anchors.

## 6. Layout and checks

- [x] 6.1 Style index, bars and matrix with existing tokens; no fixed width,
  no horizontal page scroll at 320 px or 320 px at 200 % text zoom.
- [x] 6.2 Extend the responsive spec at 390, 768 and 1440 px; status text is
  covered by the render tests, not by colour alone.

## 7. Documentation and release

- [x] 7.1 Update `docs/CHANGELOG.md`, `docs/research/open-questions.md` and the
  README report description.
- [x] 7.2 Run `npm run check`, `npm run test:e2e`, and the 1000-scenario stress
  run; record timing and size.
- [x] 7.3 Request SCR, CR, DAR, SEC, UXR and PCA review before handover.
- [x] 7.4 Batch the unreleased CLI edge fixes into the 0.2 changelog; tag and
  publish only after explicit per-version approval.
