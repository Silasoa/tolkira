# Tasks

## 1. Exception-first order

- [ ] 1.1 RED: render test with a fixture mixing failed, pending, undefined,
  skipped and passed features; assert feature and scenario order.
- [ ] 1.2 GREEN: export `statusSeverity` from the model and build the ordered
  view with `severity desc, input index asc`.
- [ ] 1.3 Test ties, all-passed input, empty feature and zero scenarios; assert
  the Details table and the JSON summary keep input order.

## 2. Needs-attention index

- [ ] 2.1 RED: tests for rows, per-status counts, links, absence when all
  passed and exclusion of features without scenarios.
- [ ] 2.2 GREEN: render the index from the ordered view above the feature list.
- [ ] 2.3 Boundary tests: exactly 3 and 4 non-passing scenarios in a feature;
  exactly 20 and 21 non-passing features.
- [ ] 2.4 Security test: script/HTML in feature and scenario names stays text;
  no new external reference or inline data store.

## 3. Anchors and reveal

- [ ] 3.1 Add deterministic anchors and the `revealHash` listener to the inline
  script; keep the computed script hash and CSP green.
- [ ] 3.2 Browser test: follow a pending scenario link, both ancestor details
  open, hash names the target, no other scenario opens.
- [ ] 3.3 Browser test: keyboard traversal of the index; report still readable
  with scripting disabled.

## 4. Layout and checks

- [ ] 4.1 Style the index with existing tokens; no fixed width, no horizontal
  scroll at 320 px or 320 px at 200 % text zoom.
- [ ] 4.2 Extend the responsive or visual spec with the index at 390, 768 and
  1440 px; confirm status is text, not colour-only.

## 5. Documentation and gate

- [ ] 5.1 Update `docs/CHANGELOG.md`, `docs/research/open-questions.md` and
  PRODUCT/README where they describe report ordering.
- [ ] 5.2 Run `npm run check`, `npm run test:e2e`, and the stress run for
  1000 scenarios; record timing and size.
- [ ] 5.3 Request SCR, CR, DAR and UXR review before handover.
