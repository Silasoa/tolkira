# Outline stress results

Date: 2026-11-10. Harness: `node scripts/stress.mjs <count> outlines` on the
local Windows machine, Node 26, against the built `dist/cli.js`. The synthetic
Messages input has one outline with one examples block and one step per row.

| Rows | Elapsed | HTML |
| ---: | ---: | ---: |
| 1,000 | 118 ms | 1.47 MB |
| 5,000 | 273 ms | 7.22 MB |

The regular legacy stress mode stayed at 158 ms / 1.57 MB for 1,000 scenarios.
Both modes pass the existing 1 s / 5 MB and 3 s / 20 MB budgets. The outline
mode does not exercise multiple examples blocks or the browser filter pass;
those are covered by the CCK fixture and the Playwright outline tests.
