# Tasks

## 1. TDD-Red

- [x] 1.1 Add fixtures for `meta.ci` (full/partial), unnamed/JSON/URI-list/ANSI
  attachments and malicious control sequences.
- [x] 1.2 Write failing model tests for CI metadata and deterministic
  attachment names.
- [x] 1.3 Write failing render/browser tests for CI link/short revision,
  URL-only CI fallback, JSON, URI-list, ANSI colours/copy (all 16 foreground
  classes and 256-white), missing fields and offline/no-JS.
- [x] 1.4 Cover ISTQB edge classes: no/partial CI, mixed-input CI retention,
  GitHub commit link, unsafe CI URL, unknown/parameterised media type, legacy
  attachment naming, path-like file name, invalid/mixed-case URI schemes,
  malformed JSON, SGR/256/truecolour (all 16 foreground classes and
  256-white), non-SGR control sequences and the 262,144-byte fallback.

## 2. Implementer

- [x] 2.1 Read `meta.ci` into the model, keep the first non-empty CI block in
  mixed runs, and render header/Details rows including the URL-only fallback;
  normalise scp-like and `ssh://` GitHub remotes for commit links; verify
  1.2/1.3 green and that `--json` stays CI-free with schema v2.
- [x] 2.2 Implement deterministic `attachment.<ext>` naming in `toAttachment`
  and `src/input/legacy.ts`; update legacy/e2e baselines (`attachment-1.*`) and
  verify model tests.
- [x] 2.3 Implement JSON pretty-print that preserves big numbers and duplicate
  keys, URI-list links and safe ANSI log rendering with copy; verify
  render/browser tests.
- [x] 2.4 Keep scenario/attachment counts and summary unchanged; verify the
  documented HTML-step (excl. hooks) vs summary baseline and offline tests.
- [x] 2.5 Run `npm run check` and `npm run test:e2e`; verify the gate.

## 3. Documentation and review

- [x] 3.1 Update `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/COMPATIBILITY.md`, `docs/AGENT-INTERFACE.md` and `GLOSSARY.md`; state
  CI metadata is Messages-only and the legacy path is `metadata`.
- [ ] 3.2 Run SCR, CR, DAR, SEC, UXR, PCA, CMP, STR and MKT; fix every blocker.
- [ ] 3.3 Re-run the gate and archive after user approval.

## Workflow follow-up

- Archive after the review set and user approval.
