# metadata-links

## Why

Users already pass CI run URLs, commit URLs and browser/project context through
`--meta` (and the compatibility shim's `metadata` object). The report prints
those values as plain text, so a reader has to copy a URL into the browser. This
is the first slice of the user-selected 0.5 "Trust & ship" direction; the
research ranks metadata third overall, after attachment reliability and
flaky/retry visibility. It makes the context that is already in the report
actionable.

This is an improvement over cucumber-html-reporter 7.2.0 and MCHR 4.6, which
print metadata as text, and beyond the official formatter's structured CI job
and GitHub commit links and Playwright's metadata linkifier; it is not a parity
claim.

## What Changes

- In the Report header and in Details custom metadata, a safe URL (an absolute
  http(s) URL accepted by the existing `safeHttpUrl` oracle, normalized) renders
  as a link. The visible label is the metadata value trimmed and stripped of the
  report's bidi-control set (U+202A–202E, U+2066–2069), and the anchor keeps
  `rel="noopener noreferrer"`.
- The metadata rule additionally rejects a value with an internal tab, line feed
  or carriage return; `safeHttpUrl` itself stays unchanged for the CI and
  attachment links.
- Values that the metadata rule rejects, including other schemes, scheme-less
  hosts and malformed URLs, stay escaped text. Keys and empty entries keep
  today's behaviour.
- README documents the link rule and suggests `CI run`, `Commit`, `Browser` and
  `Project` keys; the normalized href and the trimmed, bidi-control-stripped
  label are stated.
- No summary schema, locale key, dependency or network request is added. The
  report, JSON summary, CI text and email keep their existing contracts; the
  report HTML changes only where a safe URL is linked.

## Impact

- Capability: `report-rendering`.
- Code: `src/render/format.ts` (shared helper), `src/render/report.ts` and
  `src/render/details.ts`. If the 320 px gate finds overflow,
  `src/render/report.css` (source) and its generated `src/render/styles.ts` gain
  a wrap rule, with intentionally updated goldens.
- Tests and README/`AGENT-INTERFACE`/`COMPATIBILITY`/research docs; the
  Seed-Test host row gets a recorded result or reason.
- The compat shim's `metadata` object already flattens to strings, so it gains
  the same links without a shim change.
- No summary schema, locale key or dependency changes. The report HTML changes
  only where a safe URL is linked, unless the measured wrap fix is needed.
