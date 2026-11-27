# Design

## 1. Context

`scripts/build-search.mjs` bundles `src/render/report-client.ts` with esbuild for
the browser. The client imports `@cucumber/tag-expressions` (11.2.0 in the
lockfile, MIT, Copyright (c) 2016 Cucumber Ltd and contributors) to evaluate
tag expressions. `legalComments: 'none'` strips comments, and the package
ships only Tolkira's own `LICENSE`, so neither the generated report nor the
npm tarball carries the MIT notice.

The release spec already decides that the CycloneDX SBOM covers the external
runtime tree only, not bundled code (B-075). The notice does not change that
decision.

## 2. Where the notice lives

### 2.1 Published package

`THIRD-PARTY-NOTICES.md` at the repository root, added to `package.json`
`files` and to `scripts/package-check.mjs` `requiredRootFiles`. It names
Tolkira's MIT license, lists each bundled component with its version and full
MIT text, and states that the SBOM covers external runtime dependencies.

`dist/index.js`, `dist/cli.js` and the report client all contain the bundled
code; the package-level notice covers the first two, the report comment covers
the third.

### 2.2 Report

`src/render/third-party-notice.ts` exports the notice text as explicit
`\n`-joined lines, so a CRLF save cannot change report bytes. `src/render/html.ts`
appends it as one HTML comment after the last element of `<body>` when
`clientScript` is non-empty, tying the notice to the embed it belongs to. A
static report has no client script and no notice.

A comment, not a footer: the obligation is that the notice travels with the
copy, and a footer would add visible shell content, translations and layout
work for no user value. A downstream minifier or sanitizer may strip the
comment; that is accepted, as it is for any minified bundle. The comment sits
outside every `<script>`, so the CSP hashes do not change.

Tolkira's own MIT notice stays out of the report: the report is generated
output, and Tolkira's `LICENSE` ships in the package. The third-party notice is
in the report because the bundled client code is a copy of MIT software.

## 3. Drift guard

One unit test resolves the installed package through
`createRequire().resolve('@cucumber/tag-expressions/package.json')`, reads the
installed version and license, cross-checks the version against
`package-lock.json`, and fails with the component name if they disagree. It
asserts the exact component line, the full license text, and equality between
the rendered notice block and the exported constant. Both the constant and
`THIRD-PARTY-NOTICES.md` are compared with the installed text; a dependency
bump without a notice update fails loudly.

The comparison is verbatim: the installed LICENSE ends with `SOFTWARE.\n`
(1,086 B, LF), and both project copies end with the same license text, so the
guard can use `endsWith(license)` without `trim()`. The package notice file
puts its SBOM note before the license block, so the file ends with the
license. A CRLF checkout is impossible under the repository's LF policy; the
test does not normalise silently.

## 4. Byte cost

The notice is fixed, not per scenario: one comment of about 1.1 kB in every
scripted report, zero in static reports. The client bundle, stylesheet and
markup do not change. The Details "Report HTML" label reports the real file
size, so it grows by the same amount; stripping the comment and restoring the
old label reproduces the pre-change hash. Goldens and characterization hashes
are re-pinned for the intended comment only; the static report keeps its
pre-change hash.

## 5. Risks

- A visible link to the notices file is not added; users who need the license
  text can read the page source or the package file. Accepted for 0.7.
- The notice text is duplicated between the Markdown file and the TypeScript
  constant; the drift test is the guard, and a generated module would add a
  build step for one string.
- The version in the notice follows the lockfile, not the `^11.0.1` range; the
  test makes a silent bump fail loudly.
