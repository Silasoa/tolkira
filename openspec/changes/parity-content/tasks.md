# Tasks

## 1. TDD-Red

- [ ] 1.1 Add Markdown fixtures for headings/lists/tables/blockquotes/links,
  raw HTML, inline/reference/linked images, legacy and JUnit descriptions.
- [ ] 1.2 Write failing render/security tests for the safe GFM subset, block
  container, heading levels, link policy and image-as-alt.
- [ ] 1.3 Add browser tests for `@a and not @b`, mixed text, invalid
  expressions, combined filters, 20-newly-opened cap, URL restore controls,
  repeated lowercase `hide`, hash preservation, `file://` failure and no-JS.
- [ ] 1.4 Cover ISTQB edge classes: empty description, plain text, nested
  emphasis, malformed Markdown, `javascript:`/`data:` links, images, invalid
  tag syntax, empty URL params and repeated `hide`.
- [ ] 1.5 Measure and record the packed size delta of `markdown-it` and the
  search bundle.

## 2. Implementer

- [ ] 2.1 Add `markdown-it` and the safe renderer; verify 1.2 green.
- [ ] 2.2 Implement the tag-expression parser with substring fallback and cap;
  verify 1.3 green.
- [ ] 2.3 Implement URL state (`query`, repeated `hide`, `tag`) with
  `replaceState`/`popstate`.
- [ ] 2.4 Keep counts/summary unchanged; run `npm run check` and
  `npm run test:e2e`.

## 3. Documentation and review

- [ ] 3.1 Update `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/AGENT-INTERFACE.md` and `GLOSSARY.md`.
- [ ] 3.2 Run SCR, CR, DAR, SEC, UXR, PCA, CMP, STR and MKT; fix every blocker.
- [ ] 3.3 Re-run the gate and archive after user approval.

## Workflow follow-up

- Archive after the review set and user approval.
