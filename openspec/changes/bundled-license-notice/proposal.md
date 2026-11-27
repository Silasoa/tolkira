# Proposal

## Why

B-075. The report client bundles `@cucumber/tag-expressions` 11.2.0 (MIT,
Copyright (c) 2016 Cucumber Ltd and contributors) so the tag-expression filter
works in the browser. The esbuild step sets `legalComments: 'none'`, the
package has no third-party notice, and the CycloneDX SBOM covers only external
runtime dependencies. A distributed report and the published package therefore
carry MIT code without its copyright and permission notice.

## What Changes

- Add `THIRD-PARTY-NOTICES.md` to the published package with the full MIT
  notice of every third-party component bundled into `dist`.
- Add the same notice as an HTML comment to a scripted report, next to the
  inline client script it belongs to. A static report carries no client script
  and gets no notice.
- List the file in `package.json` `files` and in the package check, so a
  tarball without it fails.
- Keep the CycloneDX SBOM as the external runtime dependency tree, as the
  release spec already states (B-075); the notices file is the record of
  bundled components.
- Guard the three copies (installed license, report constant, notice file)
  against drift in one unit test.

## Capabilities

### Modified Capabilities

- `report-rendering`: a scripted report carries the full MIT notice of the
  third-party code bundled into its client script.
- `release`: the published package carries `THIRD-PARTY-NOTICES.md`.

## Impact

- Report bytes grow by one fixed comment (about 1.1 kB) and the Details
  "Report HTML" size label grows with it, because it reports the real file
  size. Stripping the comment and restoring the old label reproduces the
  pre-change hash; no other rendered path changes. Static reports, the client
  script, the stylesheet and the package's runtime surface are otherwise
  unchanged. The package gains the notice file and the module's declaration.
- No runtime dependency, public API, CLI option or version change. No tag,
  stage or publish in this change.

## Out of scope

- Tolkira's own `LICENSE`, the dependency version, a visible footer link or a
  new SBOM format.
- A general license-header system for future dependencies; the drift test and
  the notices file are the mechanism until a second bundled component exists.
