# Tasks

## 1. Contract

- [x] 1.1 Proposal, spec delta and design written.
- [x] 1.2 PIR/DXR over the spec and design; no blockers. PIR: a valid
  directory renders the same bytes, the explicit-file error and exit code are
  unchanged, and the skipped file stays in the input list. DXR: the seam is the
  existing parser options object; the loader already knows `explicit`; the
  `junit-validation` path stays strict; the all-empty check already exists. One
  wording decision recorded: an all-empty directory uses the generic
  `No supported report files found.` error.

## 2. TDD

- [ ] 2.1 TDD-Red writes the failing acceptance and edge tests from this spec;
  prove RED and record them in `tdd-red.md`.
- [ ] 2.2 Implementer makes the Red tests green without weakening them, adds
  any missing tests, and completes the slice.

## 3. Review

- [ ] 3.1 SCR, CR, DAR and SEC (input adapter).
- [ ] 3.2 Fix findings; record deferred decisions.

## 4. Gate and release

- [ ] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [ ] 4.2 Re-pack the 0.5.1 tarball and re-run the required host rows on the
  final tree; record host, pin and result. Row 4 must render the full
  `mvn test` artifact that was red before.
- [ ] 4.3 `docs/JUNIT-XML.md` directory rule, 0.5.1 changelog bullet, B-047
  resolved, host record updated.
- [ ] 4.4 Present 0.5.1 for the user's per-version approval. Tag, stage and
  publish only after that approval.

## Gate record

(To be filled by the implementer and the release run.)
