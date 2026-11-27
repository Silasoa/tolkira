# Comparison raster provenance

All `new-shell-*.png` images and `tolkira-0.7-report.png` were captured on
2026-11-27 from the 0.7 Incident review development snapshot at HEAD after the
row-link and status-token fixes.

- Host: Windows, Chromium via the repository's Playwright dev dependency.
- Viewport: 1440 × 900, device scale factor 1, light colour scheme unless the
  file name says `dark`.
- `*expanded` captures click `Expand all scenarios` before the screenshot and
  use a full-page capture so the expanded rows and the row link are visible;
  the other captures are viewport-only.
- `new-shell-scenario*`: `test/fixtures/legacy/minimal.json`, title `Seed-Test`.
- `new-shell-story*`: `test/fixtures/legacy/happy.json`, title
  `Seed-Test story`; `-analysis` opens the Details tab; `-offline` uses an
  offline browser context.
- `new-shell-group*`: `happy.json`, `unhappy.json` and `minimal.json`, title
  `Seed-Test group`.
- `new-shell-failed*` and `new-shell-dark.png`: `failed.json`, title
  `Seed-Test failed`. `failed.json` carries the only real failed step in these
  fixtures.
- `new-shell-screenshot*` and `tolkira-0.7-report.png`:
  `test/fixtures/messages/screenshot.ndjson`, title `Tolkira report`, with its
  inline PNG moved from the passing scenario's step to the failing scenario's
  failed step so the incident panel shows the screenshot as evidence. The base
  fixture itself attaches the image to the passing scenario.
- `tolkira-0.7-report.png` is the byte-identical viewport capture of
  `new-shell-screenshot.png`; it is a development snapshot, not a release hero.
- `overview.png` is the 0.6-era composite from 2026-11-04. It predates the
  incident panel and is not part of the 0.7 comparison.

Reproduce with the built CLI and a Playwright Chromium page:

```sh
npm run build
node dist/cli.js test/fixtures/messages/screenshot.ndjson --out report.html --title "Tolkira report"
```

The `old-*.png` images are the unchanged `cucumber-html-reporter@7.2.0`
captures from the 0.6.0 comparison and were not regenerated.
