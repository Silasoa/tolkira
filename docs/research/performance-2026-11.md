# Tolkira 0.6.0 performance comparison

Date: 2026-11-24. Status: research note, not a release gate. Harness:
[`scripts/bench-compare.mjs`](../../scripts/bench-compare.mjs) (new, uncommitted).
Tolkira product code and `package.json` were not changed.

## Headline

- At 5,000 scenarios / 15,000 steps, Tolkira generated a 10.82 MB report in
  **604 ms** median at **310 MiB** peak RSS. `@cucumber/html-formatter` took
  569 ms / 16.89 MB / 77 MiB; `cucumber-html-reporter` took 624 ms / 36.52 MB /
  194 MiB; `multiple-cucumber-html-reporter` took **38.6 s** / 44.49 MB /
  209 MiB.
- Tolkira produced the **smallest output at every size**: 1.56x smaller than
  the official formatter, 3.38x smaller than `cucumber-html-reporter` and
  4.11x smaller than `multiple-cucumber-html-reporter` at 5,000.
- Generation speed is a tie at 5,000: Tolkira is within 6 % of the official
  formatter and within host noise of `cucumber-html-reporter`, while being
  **64x faster** than `multiple-cucumber-html-reporter`. At 123 it is 1.5x
  slower than the official formatter and 1.5x faster than
  `cucumber-html-reporter`.
- In Chromium, Tolkira paints first content earlier than the official
  formatter (188 ms vs 684 ms at 5,000) but finishes loading later
  (1.80 s vs 0.67 s) and holds ~100x less JS heap (1.5 MB vs 163.6 MB).
  Tolkira server-renders all scenario details; the official formatter ships
  messages plus React and renders in the browser.
- Tolkira's peak RSS is the **highest** at 5,000 (310 MiB) because it holds the
  parsed input, view model and one 10.8 MB HTML string. The official formatter
  streams and stays at 77 MiB. This is a real trade-off, not a win.

## Tools

| Tool | Version | Input used | Output shape | Offline by default |
| --- | --- | --- | --- | --- |
| Tolkira | 0.6.0 (`dist/cli.js`) | Messages NDJSON and legacy JSON | One HTML file | Yes |
| `@cucumber/html-formatter` | 24.4.0 | Messages NDJSON | One HTML file | Yes |
| `cucumber-html-reporter` | 7.2.0 | Legacy JSON | One HTML file, screenshots inline | **No**: 6 external URLs |
| `multiple-cucumber-html-reporter` | 4.7.0 | Legacy JSON | Folder: `index.html`, feature pages, assets | Yes |
| Allure Report | 3.33.0 | Allure results, not Cucumber JSON | Multi-file static app | Excluded |

Notes:

- `@cucumber/html-formatter` 24.4.0 has no CLI binary. The harness uses the
  exported `CucumberHtmlStream` and feeds it the same NDJSON envelopes. That
  includes parsing the NDJSON in the measured process.
- `cucumber-html-reporter` was run through its `generate()` API with the
  default `bootstrap` theme, `storeScreenshots: false` (inline images) and
  `launchReport: false`.
- `multiple-cucumber-html-reporter` was run through its `generate()` API with
  `reportName: "Benchmark"`, no browser launch and silent logging. It writes
  one page per feature; the entry page is an overview, not the scenario list.
  Version 4.7.0 also accepts Messages NDJSON via `useCucumberMessages: true`;
  this run used its established legacy JSON path so the fixture path matches
  `cucumber-html-reporter`. The scenario content is the same.
- **Allure 3 is excluded.** Its input is an `allure-results` directory in
  Allure's own model, not Cucumber Messages or legacy Cucumber JSON. Producing
  that directory needs a Cucumber run with the `allure-cucumberjs` adapter, so
  a same-fixture "report generator only" comparison is not possible. Running
  it would measure a different pipeline.

## Fixture

One generator in `scripts/bench-compare.mjs` produces both formats from one
model. Every scenario has the same name, tags, three steps and status in both
formats. Status mix per 20 scenarios: 16 passed, 2 failed, 1 skipped, 1
undefined. A failed scenario has step 1 passed, step 2 failed, step 3 skipped;
an undefined scenario has step 1 undefined and steps 2-3 skipped. Every 25th
scenario attaches one 1x1 PNG (70 bytes decoded) to step 1.

| Scenarios | Features | Steps | Attachments | Messages NDJSON | Legacy JSON |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 123 | 13 | 369 | 5 | 382,826 B | 180,961 B |
| 2,000 | 200 | 6,000 | 80 | 6,347,309 B | 2,954,535 B |
| 5,000 | 500 | 15,000 | 200 | 15,949,955 B | 7,396,585 B |

SHA-256 fingerprints (the script prints the same values):

```text
123  messages 8ddee12ce56b9e6f29c7ce7210a5c0794faad2f27cfcdd1fc9b1df077a3268c8
123  legacy   7aac5c2d2c49888e7d30dd3e27e00d3a5e613e5ce9bd752fc392adb3275d77bb
2000 messages 5e73c9d75273cd57cea275d2ca56453800fcebf292a06f28d0e677378f49a1ed
2000 legacy   cd4b67ec5261f3f17418932daac795170b4fa97cdf0a7e62c4d3fcd75462659b
5000 messages a5bd23bef500196eb8767badcafbf56dc0c6d73220040fd092eb061eb057e7bc
5000 legacy   056a8f816dc9be0663ef02b1c20a7386d61f1c2e5df857ed6975dbefbca7802e
```

The fixture is deliberately regular: no outlines, backgrounds, hooks, retries,
data tables, doc strings or large screenshots. It measures report-generation
and page-load scaling, not every report feature. Real screenshots will change
bytes and browser time much more than the 200 tiny PNGs here.

## Protocol

### Generation

- One warmup and five measured runs per tool and size. Output directory is
  removed before every run. Tool order is rotated per round to spread host
  drift.
- Wall time is a Windows `Stopwatch` around `Process.Start` to
  `WaitForExit`; it includes Node startup, input parsing, rendering and file
  writes. All tools use the same PowerShell wrapper, and stdout/stderr are
  piped through it for every tool.
- Peak RSS is `Process.PeakWorkingSet64`, polled every 20 ms. It is the
  process high-water mark, not private bytes. All four entry points are
  single-process Node programs; the harness disables browser launch and these
  code paths do not call `child_process`, so the process tree is one process.
  This was verified by code inspection, not by an OS process-tree monitor.
- Output bytes are the file size, or the recursive folder total for
  `multiple-cucumber-html-reporter`. Entry-page bytes are reported separately.
- Competitors are installed into a temp workdir **before** any measurement.
  Runs make no network calls, enable no telemetry (none of the four tools has
  a telemetry switch) and use `launchReport: false` / `openReportInBrowser:
  false`.

### Browser

- A local Node static server on `127.0.0.1` serves the output tree with
  `Cache-Control: no-store`; pages are never opened through `file://`.
- Playwright 1.65.1 / Chromium 159.0.8154.6, headless, 1440x900,
  deviceScaleFactor 1, `--enable-precise-memory-info`.
- One warmup load followed by five measured loads. Each load gets a fresh
  incognito context, so the HTTP cache starts empty; the browser process and
  OS file cache are warm. This is the defined "cold page cache per load,
  warm browser" protocol.
- All non-localhost requests are aborted and counted. FCP comes from the
  `first-contentful-paint` performance entry, DCL and load from Navigation
  Timing, JS heap from `performance.memory.usedJSHeapSize` after the load plus
  500 ms, and DOM nodes from `document.getElementsByTagName('*').length`.
- FCP can legitimately land after the load event for a document-heavy page;
  that is reported as measured, not clamped.

## Commands

```powershell
npm run build

node scripts/bench-compare.mjs `
  --sizes=123,2000,5000 `
  --runs=5 `
  --warmup=1 `
  --workdir="<temp>/opencode/tolkira-bench" `
  --out="<temp>/opencode/tolkira-bench/results/bench.json"
```

If the competitor install is missing, the script runs this once before any
measurement:

```powershell
npm install --prefix "<temp>/opencode/tolkira-bench" --no-audit --no-fund `
  --no-package-lock @cucumber/html-formatter@24.4.0 `
  cucumber-html-reporter@7.2.0 multiple-cucumber-html-reporter@4.7.0
```

The effective per-tool commands the harness runs for size 5,000 are:

```powershell
node dist/cli.js <temp>/fixtures/5000/messages.ndjson `
  --out <temp>/out/tolkira-messages-5000/report.html
node dist/cli.js <temp>/fixtures/5000/legacy/legacy.json `
  --out <temp>/out/tolkira-legacy-5000/report.html
node <temp>/runners/formatter.mjs `
  <temp>/fixtures/5000/messages.ndjson <temp>/out/ochf-5000/report.html
node <temp>/runners/reporter.cjs `
  <temp>/fixtures/5000/legacy/legacy.json <temp>/out/chr-5000/report.html
node <temp>/runners/multiple.mjs `
  <temp>/fixtures/5000/legacy <temp>/out/mchr-5000
```

The two API-only runners are generated by the harness into the temp workdir;
they call the package APIs with the options listed above.

No competitor run in this note was manual: generation, output collection and
browser measurement all run from `scripts/bench-compare.mjs`. Allure is the
only listed tool that was not run, for the reason above. All 75 measured
generation runs (plus 15 warmups) and all 90 measured browser loads (plus 18
warmups) exited 0 or loaded; no tool or page failed.

Host: Windows 11 Pro 10.0.26300, x64; AMD Ryzen 5 5600 (6 cores / 12 threads);
15.9 GiB RAM; Node v26.13.1; npm 10.8.2; Playwright 1.65.1; Chromium
159.0.8154.6. The report used the built `dist` from product code at commit
`9f656a8`; only docs changed during the run.

## Generation results

Wall time is median (min-max) over five measured runs. Output MB is 10^6
bytes. Peak RSS is MiB (2^20 bytes).

### 123 scenarios

| Tool | Wall ms | Peak RSS MiB | Output MB | Files | Entry MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tolkira (Messages) | 144.6 (131.3-163.7) | 62 (61-68) | 0.34 | 1 | 0.34 |
| Tolkira (legacy JSON) | 146.3 (127.8-175.0) | 61 (61-68) | 0.34 | 1 | 0.34 |
| `@cucumber/html-formatter` | 97.7 (91.6-106.9) | 53 (52-55) | 1.32 | 1 | 1.32 |
| `cucumber-html-reporter` | 216.2 (194.6-251.3) | 61 (58-63) | 0.91 | 1 | 0.91 |
| `multiple-cucumber-html-reporter` | 1,336.7 (1,313.9-1,537.3) | 107 (107-108) | 2.82 | 31 | 0.19 |

### 2,000 scenarios

| Tool | Wall ms | Peak RSS MiB | Output MB | Files | Entry MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tolkira (Messages) | 353.8 (336.1-492.9) | 185 (183-185) | 4.37 | 1 | 4.37 |
| Tolkira (legacy JSON) | 321.1 (303.8-407.2) | 174 (137-175) | 4.44 | 1 | 4.44 |
| `@cucumber/html-formatter` | 353.7 (289.8-387.4) | 70 (68-74) | 7.29 | 1 | 7.29 |
| `cucumber-html-reporter` | 306.8 (290.2-405.6) | 88 (82-110) | 14.61 | 1 | 14.61 |
| `multiple-cucumber-html-reporter` | 16,581.8 (14,517.2-25,729.8) | 157 (154-165) | 18.84 | 218 | 2.11 |

### 5,000 scenarios

| Tool | Wall ms | Peak RSS MiB | Output MB | Files | Entry MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tolkira (Messages) | 604.4 (579.8-646.3) | 310 (307-311) | 10.82 | 1 | 10.82 |
| Tolkira (legacy JSON) | 602.2 (573.4-829.7) | 308 (307-310) | 11.00 | 1 | 11.00 |
| `@cucumber/html-formatter` | 568.9 (560.8-1,564.0) | 77 (77-78) | 16.89 | 1 | 16.89 |
| `cucumber-html-reporter` | 624.1 (491.3-12,061.1) | 194 (194-194) | 36.52 | 1 | 36.52 |
| `multiple-cucumber-html-reporter` | 38,600.1 (34,767.2-43,621.7) | 209 (183-255) | 44.49 | 518 | 5.18 |

Two host outliers are visible in the ranges: one 5,000-scenario
`cucumber-html-reporter` run took 12.1 s instead of 0.49-0.72 s, and one
official-formatter run took 1.56 s. A separate confirmation pass of the
5,000 group measured 507 ms median (476-519 ms) for
`cucumber-html-reporter` and 604 ms (545-828 ms) for the official formatter.
The table keeps the protocol run; the confirmation says the 12 s value is host
I/O noise, not tool cost.

```powershell
node scripts/bench-compare.mjs --sizes=5000 --runs=5 --warmup=1 `
  --skip-browser --only=ochf,chr `
  --workdir="<temp>/opencode/tolkira-bench" `
  --out="<temp>/opencode/tolkira-bench/results/confirm-5000.json"
```

### Relative view

| Size | Fastest generator | Tolkira vs fastest | Tolkira output vs next smallest | Tolkira peak RSS |
| ---: | --- | ---: | ---: | --- |
| 123 | official formatter, 97.7 ms | 1.48x slower | 2.72x smaller than CHR | 62 MiB (2nd highest) |
| 2,000 | `cucumber-html-reporter`, 306.8 ms | 1.15x slower | 3.34x smaller than CHR | 185 MiB (highest) |
| 5,000 | official formatter, 568.9 ms | 1.06x slower | 1.56x smaller than official | 310 MiB (highest) |

## Browser results

Median over five measured loads; fresh incognito context per load. JS heap MB
is 10^6 bytes. Requests counts the document plus resource-timing entries. CHR
(`cucumber-html-reporter`)
is marked with a dagger: its default HTML references six external URLs, all
blocked in this offline protocol (Chromium attempted five per load; it did not
request the favicon), so its page is unstyled and its scripts do not run. Its
generation time and bytes are valid; its browser numbers are a degraded-page
lower bound, not a fair client-side comparison. FCP and load show
median (min-max); DCL and heap are medians only. Per-run values are in the
results JSON.

### 123 scenarios

| Page | FCP ms | DCL ms | Load ms | JS heap MB | Requests | DOM nodes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tolkira (Messages) | 132 (124-140) | 112 | 116 (112-130) | 1.3 | 1 | 6,289 |
| Tolkira (legacy) | 128 (124-128) | 100 | 112 (110-114) | 1.3 | 1 | 6,287 |
| `@cucumber/html-formatter` | 172 (168-220) | 144 | 151 (146-193) | 15.9 | 1 | 3,421 |
| `cucumber-html-reporter` † | 108 (100-144) | 26 | 34 (32-130) | 1.1 | 6 | 6,674 |
| `multiple-cucumber-html-reporter` entry | 108 (108-116) | 179 | 190 (182-201) | 4.7 | 13 | 2,109 |
| `multiple-cucumber-html-reporter` feature page | 168 (116-172) | 150 | 162 (160-171) | 4.2 | 13 | 1,528 |

### 2,000 scenarios

| Page | FCP ms | DCL ms | Load ms | JS heap MB | Requests | DOM nodes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tolkira (Messages) | 212 (200-232) | 751 | 752 (743-790) | 1.2 | 1 | 97,095 |
| Tolkira (legacy) | 220 (212-224) | 706 | 707 (698-795) | 1.2 | 1 | 97,093 |
| `@cucumber/html-formatter` | 636 (428-700) | 584 | 595 (343-693) | 97.8 | 1 | 55,151 |
| `cucumber-html-reporter` † | 176 (68-196) | 984 | 984 (946-1,211) | 0.9 | 6 | 107,330 |
| `multiple-cucumber-html-reporter` entry | 124 (112-132) | 995 | 1,013 (905-1,210) | 10.1 | 13 | 7,368 |
| `multiple-cucumber-html-reporter` feature page | 108 (104-176) | 154 | 165 (155-170) | 4.1 | 13 | 1,528 |

### 5,000 scenarios

| Page | FCP ms | DCL ms | Load ms | JS heap MB | Requests | DOM nodes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tolkira (Messages) | 188 (108-220) | 1,800 | 1,803 (1,714-2,329) | 1.5 | 1 | 241,785 |
| Tolkira (legacy) | 196 (168-208) | 1,782 | 1,785 (1,683-1,833) | 1.5 | 1 | 241,783 |
| `@cucumber/html-formatter` | 684 (668-708) | 657 | 669 (663-705) | 163.6 | 1 | 137,711 |
| `cucumber-html-reporter` † | 184 (156-192) | 2,885 | 2,885 (2,738-2,903) | 0.9 | 6 | 268,220 |
| `multiple-cucumber-html-reporter` entry | 128 (128-136) | 3,554 | 3,576 (3,505-3,702) | 22.0 | 13 | 15,780 |
| `multiple-cucumber-html-reporter` feature page | 120 (104-188) | 161 | 168 (158-205) | 4.1 | 13 | 1,528 |

## Observations

### Output size follows architecture

Tolkira renders only the view data it needs and drops the Gherkin AST, test
cases and source text; at 123 its report is 335 KB from 383 KB of Messages
input (88 %). The official formatter embeds the whole message stream plus its
React bundle (346 % of input at 123, 106 % at 5,000). `cucumber-html-reporter`
expands the 7.4 MB legacy fixture into 36.5 MB at 5,000 (494 %), and
`multiple-cucumber-html-reporter` into 44.5 MB (601 %) across 518 files. At
123, `multiple-cucumber-html-reporter`'s 2.82 MB is dominated by fixed assets
(a 580 KB logo, fonts and scripts); at 5,000, its per-feature pages dominate.

### Generation scales differently

From 123 to 5,000 scenarios (40.7x scenarios), wall time grew 4.2x for Tolkira,
5.8x for the official formatter, 2.9x for `cucumber-html-reporter` and 28.9x
for `multiple-cucumber-html-reporter`. The small run is dominated by process
startup and fixed template work, so these ratios are not per-scenario costs.
The clear separation is `multiple-cucumber-html-reporter`: one page per
feature plus asset copying makes it 47-68x slower than the single-file tools
at 2,000-5,000, and its 5,000-scenario output is the largest.

### Browser trade-off: first paint vs finished load

At 5,000, Tolkira's first content appears at 188 ms, versus 684 ms for the
official formatter. But Tolkira's load event is 1.80 s versus 0.67 s: it parses
and lays out a 10.8 MB document with 241,785 DOM nodes, while the official
formatter ships 16.9 MB of mostly JSON and React renders a smaller DOM
(137,711 nodes) on the client. The official formatter's JS heap is 163.6 MB
against Tolkira's 1.5 MB. In short: Tolkira pays at generation and ships a
larger DOM; the official formatter pays in the browser and holds the message
store in JS.

`multiple-cucumber-html-reporter`'s entry page is not the report a user reads:
it is a 5.18 MB overview at 5,000. Its largest feature page loads in 168 ms
with 4.1 MB heap, but it contains only 10 scenarios, and reaching another
feature is a new navigation. Comparing that 168 ms with Tolkira's 1.80 s
full-report load would be misleading.

### Memory

Tolkira's peak RSS is the price of its single-string renderer: it holds the
parsed input, the view model and the final HTML, reaching 310 MiB at 5,000
versus 77 MiB for the streaming official formatter. The output itself is 10.8
MB, so the working set is not just the string. This is the clearest case where
Tolkira is worse and where a future streaming render would help; it is not a
reason to change the current one-file contract by itself.

### Input format

Tolkira's legacy path is not slower than its Messages path in this fixture
(602 ms vs 604 ms at 5,000; 321 ms vs 354 ms at 2,000). The legacy file is
less than half the bytes of the Messages file for the same content, which
offsets the adapter work. Output differs by at most 2 % (11.00 MB vs 10.82 MB
at 5,000). The comparison is semantic, not byte-identical input.

### Offline and CDN behaviour

`cucumber-html-reporter` 7.2.0 is not offline by default: the bootstrap theme
references Bootstrap 3.4.1 CSS/JS, jQuery 1.12.4, moment 2.5.1, Google
Charts (`google.com/jsapi`) and a LambdaTest favicon. With network blocked,
five requests per load (30 across the six loads per size) were aborted. Its browser
numbers therefore describe an unstyled, partially scripted page. Tolkira, the
official formatter and `multiple-cucumber-html-reporter` made zero external
requests in this run.

## Caveats

- Single Windows desktop, no CPU pinning, no controlled background load.
  Windows Defender/indexing likely caused the 12.1 s `cucumber-html-reporter`
  outlier and the 25.7 s `multiple-cucumber-html-reporter` outlier at 2,000.
  Medians and ranges are reported together; five runs do not support
  confidence intervals.
- The fixture is synthetic and regular: no outlines, backgrounds, hooks,
  retries, data tables, doc strings or large screenshots. Large inline images
  can dominate both output bytes and browser time; this run only has 200 x
  70-byte PNGs at 5,000.
- Generation time includes Node startup and, for the API-only tools, the
  harness runner's process startup. This matches the Tolkira CLI path but not
  an in-process Cucumber formatter plugin.
- Peak RSS is the process working set, not private bytes. The process tree is
  one process for all four entries (code inspection); an OS-level tree monitor
  was not used.
- The browser protocol is warm-browser/cold-HTTP-cache. The OS file cache is
  warm. `Cache-Control: no-store` deliberately prevents a single-file tool's
  one large response from being cached, but it also forces every folder asset
  to be re-read on each load; that is part of the architecture difference.
- `cucumber-html-reporter` browser numbers are degraded (see dagger). Its
  generation and bytes remain comparable.
- `multiple-cucumber-html-reporter` entry and feature-page numbers measure
  different content. Neither alone is the whole report.
- Tolkira's 5,000-scenario report is 10.82 MB, above the 10 MB size-warning
  threshold, so the CLI prints its size warning on that run. It does not fail.
- Tolkira's own stress baseline (`docs/ARCHITECTURE.md`, `docs/COMPARISON.md`)
  cites about 0.4-0.5 s and 7.0 MB for 5,000 scenarios. This fixture is
  heavier (tags, failures, undefined steps, attachments, longer names) and
  measured 0.60 s / 10.82 MB; the two numbers are not directly comparable.
- Allure 3.33.0 was not run; see the tools section.

## Conclusion

Tolkira is the smallest report at every tested size and is competitive on
generation time at 2,000-5,000 scenarios. At 5,000 it is within 6 % of the
official formatter, effectively tied with `cucumber-html-reporter`, and 64x
faster than `multiple-cucumber-html-reporter`. At 123 it loses to the official
formatter (145 ms vs 98 ms) because fixed CLI/process and template costs
dominate, but beats `cucumber-html-reporter` and
`multiple-cucumber-html-reporter`.

The browser result is a trade-off, not a clean win. Tolkira shows content
sooner and uses almost no JS heap, but its full load is slower than the
official formatter's at 2,000-5,000 because it server-renders every scenario
and step into one large DOM. The official formatter shifts that work to React
in the browser. `multiple-cucumber-html-reporter` avoids one huge document by
splitting features into pages, but pays for it in generation time, file count
and total bytes; its entry page is only an overview.

The main cost Tolkira pays is peak memory at 5,000 (310 MiB). A streaming
renderer or a lower-copy string assembly would be the relevant follow-up if
that matters for the target CI hosts. Nothing in this run justifies weakening
the single-file, offline default.
