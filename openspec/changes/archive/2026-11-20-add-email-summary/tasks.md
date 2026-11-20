# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, spec and design; fix blockers.
- [x] 1.2 Confirm the HTML-file format, aggregate + top-five content, the
  standalone/with-`--out`/JSON/CI trigger and the locale scope with the
  practice research (MCHR/Allure/CI mail steps).
- [x] 1.3 Link #13b and record why PCA/STR are not required (size-budget test
  covers PCA; STR optional for the new module).

## 2. TDD-Red

- [ ] 2.1 Email unit tests: title/status, no-preheader heading, attempted pass
  rate incl. zero and the full pass-rate note, the empty vs all-skipped
  state, all non-zero statuses + unexecuted and the "scenarios with results"
  total, first five/further failures in summary order, no-failure runs,
  undefined/pending/unknown status, report note with/without `--out`,
  German/English labels, grouped English digits and human durations,
  dates, `lang`/`dir`, escaped title/names/report name, long-name wrap/cap, no
  scripts/remote assets/images, a hostile accent, the <100 KB standard size, a
  pinned clock and `renderEmail` API parity.
- [ ] 2.2 CLI tests: `--email` with `--out`, standalone, with `--json`/`--ci`,
  `--locale` without `--out`, empty path, collisions with inputs/logo/out/
  ci-out/history, write failure (email path is a directory; no .tmp) leaves the
  report and skips history/CI/stdout, the `Email written to` confirmation,
  no flag leaves files untouched, report/JSON bytes unchanged.
- [ ] 2.3 E2E: an email-aware helper; open the email from disk at 600 and
  320 px; assert content, failed list, report note, German labels, escaped
  names, no overflow, no request, no script, no image.
- [ ] 2.4 Catalog tests: add the email keys to en/de with descriptions; keep
  parity/placeholder/plural checks green; pin the new keys.
- [ ] 2.5 Confirm the new tests fail for the right reason; record `tdd-red.md`.

## 3. Implement

- [x] 3.1 Add `src/email.ts` with `renderEmail(summary, options)` and the
  table/inline HTML template; no logo/image, no preheader, no SMTP/network/
  scripts; validated accent; the full status counts.
- [x] 3.2 Add the email keys to the catalogs, the German copy and the
  translator use; regenerate the catalogs.
- [x] 3.3 Add `--email` parsing/usage, the locale scope, output requirement,
  path validation, the pinned write order, the confirmation line and the
  `EmailOptions` API; export it.
- [x] 3.4 Keep the report/HTML, summary schema, JSON/CI and exit codes
  unchanged; the email is an additional file only.
- [x] 3.5 Update the characterization/golden outputs only if the report bytes
  change (they should not).

## 4. Docs

- [x] 4.1 Add `docs/EMAIL.md` (CLI/API, opening/pasting the HTML, heading/
  subject caveat, report note, top-five rule, privacy/test names and no
  redaction, inline-attachment metric, locale, no SMTP/network, mail-client
  limits, `.eml`/sending/`--meta` follow-ups) and add it to `package.json`
  `files`, `docs/README.md` and `llms.txt`.
- [x] 4.2 Update `README.md`, `DESIGN.md`, `docs/AGENT-INTERFACE.md`,
  `docs/ARCHITECTURE.md`, `docs/I18N.md`, `docs/LIMITATIONS.md`,
  `docs/COMPATIBILITY.md`, `docs/PRODUCT.md`, `docs/CHANGELOG.md`,
  `docs/BACKLOG.md`.
- [x] 4.3 Align the docs with the final behavior and the review findings: empty
  vs all-skipped state, input-directory containment, system font and wrap/cap,
  recipient-facing no-report note, first-five-failed order, grouped English
  digits and human durations, `--title`/`--accent` effects, the `--ci-out`
  requirement, the CI subject from `summary.json` with a fork guard, the MCHR
  boolean/path and content differences, and `.eml` as B-023 (not a non-goal).

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 5.2 Run the review swarm: SCR, CR, DAR, UXR, ILA, CMP and a focused SEC
  pass (HTML, test data, valid options, output path). Record why PCA/STR are not
  required.
- [x] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [x] 5.4 Commit and push with #13b and the change reference.

## Gate record

- `npm run check`: 64 files, 969 passed, 4 skipped; i18n, typecheck, lint and
  build green. `npm run test:e2e`: 352 passed, 2 skipped (print PDFs are
  Chromium-only). `npm run hygiene` ok.
- Email sizes: English report + email 4,939 B; standalone 4,910 B; German 5,110
  B; true empty 4,019 B; crafted worst case 8,378 B (names capped, still under
  the 100 KB guidance).
- Reviews: SCR, CR, DAR, UXR, ILA, CMP and SEC all PASS after the fixer round.
  The German report-note test asserts the full native sentence and rejects the
  English `Full report`; the email catalog has 17 keys in en/de.
- Deferred: `.eml` draft (B-023), SMTP/sending, `--meta`/logo/metadata in the
  email and the PDF engine (B-019/#13c) remain out of this slice. #13 stays open
  for the PDF-engine decision.


