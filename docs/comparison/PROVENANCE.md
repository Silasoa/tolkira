# Comparison raster provenance

All `new-shell-*.png` images and `tolkira-0.7-report.png` were captured on
2026-11-27 from the 0.7 Incident review development snapshot.

- Host: Windows, Chromium via the repository's Playwright dev dependency.
- Viewport: 1440 × 900, device scale factor 1, light colour scheme unless the
  file name says `dark`.
- `new-shell-scenario*`: `test/fixtures/legacy/minimal.json`, title `Seed-Test`.
- `new-shell-story*`: `test/fixtures/legacy/happy.json`, title
  `Seed-Test story`; `-analysis` opens the Details tab.
- `new-shell-group*`: `happy.json`, `unhappy.json` and `minimal.json`, title
  `Seed-Test group`.
- `new-shell-failed*` and `new-shell-dark.png`: `unhappy.json`, title
  `Seed-Test failed`.
- `new-shell-screenshot*` and `tolkira-0.7-report.png`:
  `test/fixtures/messages/screenshot.ndjson`, title `Tolkira report`.
- `new-shell-story-offline.png`: the story report with the browser context
  offline; the single file needs no network.
- `*expanded` captures click `Expand all scenarios` before the screenshot.

Reproduce with the built CLI and a Playwright Chromium page:

```sh
npm run build
node dist/cli.js test/fixtures/messages/screenshot.ndjson --out report.html --title "Tolkira report"
```

The `old-*.png` images are the unchanged `cucumber-html-reporter@7.2.0`
captures from the 0.6.0 comparison and were not regenerated.
