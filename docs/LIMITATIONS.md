# Limitations

Last verified: **2026-11-18**. "Verified" means the repository state on that
date: the cited fixture or test exists and passes. It does not mean every
producer was re-run on that date.

| Area | Status | Last verified | What it means |
| --- | --- | --- | --- |
| Behave 1.3.3 | Partial | 2026-11-13 | The real JSON run (`behave-real.json`) covers pass/fail statuses, errors and seconds-based durations. A real Behave run with attachments and doc strings is still outstanding; the synthetic `behave.json` covers those shapes. |
| JUnit XML | Basic | 2026-11-13 | Suites, test cases, statuses, durations, failures, skipped cases and `system-out`/`system-err`. No Gherkin steps, screenshots, traces or arbitrary attachments. JUnit XML is not a replacement for a native Playwright report; Playwright projects should use the Playwright JSON adapter. |
| Legacy JSON outlines | Flat | 2026-11-13 | Examples arrive expanded. Tolkira keeps those rows flat and does not reconstruct the original outline table. Messages outlines are grouped. |
| Rules and backgrounds in the summary | HTML only | 2026-11-13 | The version-2 JSON summary exposes a flat scenario list and inherited tags. Rules and backgrounds are an HTML presentation feature. |
| Themes and charts | Not supported | 2026-11-13 | Branding is title, metadata, logo, accent colour and dark mode. The old cucumber-html-reporter themes and charts are not reproduced. |
| External attachments | Not supported | 2026-11-13 | Output stays one file. Current limits: 100 MB total input, 50 MB per attachment, 100 MB total attachments, with a warning above 10 MB. |
| History, trends and multi-run dashboards | Not supported | 2026-11-13 | One run per report. Use multiple-cucumber-html-reporter if you need its dashboard and multi-run grouping. |
| Native Playwright adapter | Basic | 2026-11-18 | The Playwright JSON reporter is read natively: projects, file/describe rules, retries, nested steps, expected/unexpected outcomes, tags, annotations, inline and in-tree path attachments, `stdout`/`stderr` and run-level errors. The final attempt is the visible one. No trace viewer or HTML-report replay is claimed; trace zip attachments are skipped. Path attachments outside the input file's directory and the process working directory are skipped. |
| Browser and accessibility coverage | Ongoing | 2026-11-13 | Chromium, Firefox and WebKit at 320, 390, 768, 1024 and 1440 px, plus 320 px at 200 % text zoom. This is not a formal WCAG audit. |
