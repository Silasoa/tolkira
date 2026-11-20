# Proposal

## Why

The full report is the right artifact for details, but it is large for a status
mail or a chat message. Users currently retype counts or paste screenshots. The
stable `ReportSummary` already carries the status, pass rate, counts, duration,
attachments and the scenarios, so a small email summary can be generated
locally without a mail server, telemetry or a new dependency. The #13 research
selected email HTML as the #13b slice after the print view. The practice
research in `docs/research/email-report-practices.md` confirms that MCHR and
the Allure mail plugin write an HTML file, do not send, and that CI mail steps
expect a subject, an HTML body and report attachments.

## What Changes

- Add `--email <file>` to write a self-contained HTML email summary. It is
  opt-in; without the flag no email is created and the one-file report default
  is unchanged.
- Build the email from the stable summary: overall status, attempted pass rate
  (percentage with a full-sentence note that skipped scenarios are not attempts),
  every non-zero scenario status plus unexecuted, the total labelled as executed
  scenarios with results, feature/step/attachment
  totals, duration, the title and the first five failed scenarios in summary
  order (feature and scenario names, status, duration; no step bodies). Add a
  note that names the full report basename when `--out` is set and a
  recipient-facing note that no full report is attached otherwise.
- Allow `--email` with `--out`, with `--json`/`--ci` only, or standalone as the
  only output, matching the composable HTML-body pattern used by MCHR and the
  Allure mail plugin and expected by CI mail steps. `--locale` applies to the
  email as it does to the report; the CLI, JSON and CI text stay English.
  `--title` sets the heading/suggested subject and `--accent` the top border.
- Keep the email one self-contained HTML file with inline styles, an inline
  system font stack, a small style block below 480 px, no scripts, no logo or
  other image, no hidden preheader in this slice (deferred), no remote images,
  fonts or links, no telemetry and no SMTP. Long text wraps and displayed names
  are capped at 200 characters. The user sends it or pastes it into a mail
  client; a standard summary stays under 100 KB.
- Validate the email path like the other outputs, reject collisions with
  inputs, the logo, `--out`, `--ci-out` and `--history` and paths inside input
  directories, write it atomically in the order report, email, history,
  `--ci-out`, stdout, and exit 1 on failure without removing the report or
  writing later outputs.
- Export `renderEmail(summary, options)` for library users (title, locale,
  report name, validated accent, generated `Date`; no logo) and document the
  CLI/API contract.
- Add the email keys to the catalogs and support the active locale, with test
  data escaped and verbatim and the German report note guarded.

Out of scope: SMTP/sending, recipients, scheduling, the report logo or any image,
`--meta` metadata in the email, embedding the full report, remote assets or
fonts, telemetry, the PDF engine (#13c), scenario-level history, and a localized
CLI/CI/JSON surface. An `.eml` draft with a real subject remains a local
follow-up (B-023), not a sending feature.

## Capabilities

### New Capabilities

- `email-summary`: the opt-in HTML summary, its content, template, report
  reference, localization and output safety.

### Modified Capabilities

- `cli-api`: the `--email` option, output requirement, locale scope, path
  safety and the `renderEmail` API.
- `localisation`: the email as a second localized surface, its catalog keys,
  formatting and the English CLI/CI boundary.

## Impact

- `src/email.ts` (new), `src/cli.ts`, `src/index.ts`, `src/i18n/locales/en.json`
  and `de.json` plus the generated catalogs, `src/render/format.ts` if the pass
  rate helper is shared, tests (unit, CLI, render/email, e2e), `README.md`,
  `DESIGN.md`, `docs/EMAIL.md` (new), `docs/AGENT-INTERFACE.md`,
  `docs/ARCHITECTURE.md`, `docs/I18N.md`, `docs/LIMITATIONS.md`,
  `docs/COMPATIBILITY.md`, `docs/PRODUCT.md`, `docs/CHANGELOG.md`,
  `docs/BACKLOG.md`.
- No new runtime dependency, no network, no SMTP, no summary schema change. The
  report/HTML output is unchanged; the email is an additional opt-in file.

## Review gate

PIR and DXR before implementation; implementation is a TDD pair; review swarm is
SCR, CR, DAR, UXR, ILA, CMP and a focused SEC pass for the email HTML, test data,
validated options and output path. PCA is not triggered because a size-budget
test (standard summary under 100 KB) covers the small static file; STR is
optional for the new module. Refs #13 (#13b).
