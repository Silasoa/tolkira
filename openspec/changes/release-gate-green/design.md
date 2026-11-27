# Design

## 1. Toolbar overflow

The 2.0 incident change renamed the expand buttons from "Expand all" /
"Collapse all" to "Expand all scenarios" / "Collapse all scenarios" and kept
`.expand { display: flex; margin-left: auto; }`. A flex container without
`flex-wrap` has the sum of its items' min-content widths as its own min-content.
At 320 px / 200 % text the combined min-content of both buttons exceeds the
shell content width on Linux fonts, so the block widens the document by 12 px.

Fix: `.expand { flex-wrap: wrap; justify-content: flex-end; }`. With wrapping,
the block's min-content is one button, which fits; the buttons stack and stay
end-aligned. Measured on Windows Chromium at 320 px / 200 %
(`empty-statuses.ndjson`, the fixture the e2e test renders): the block's width
goes from 268.03 px to 241 px (the toolbar content width), with the document
scroll width at 305 px in a 320 px window and both buttons 241 px wide. The
block sits at x=32; the toolbar content box is 241 px wide while the document
is 320 px with `scrollbar-gutter: stable`, so the block's 27 px overflow was
absorbed by the shell padding on Windows but became a 12 px page overflow on
Linux fonts. The desktop line is unchanged because the two buttons fit there
without wrapping.

The e2e assertion compares the block against the toolbar, not against itself:
`expand.left >= toolbar.left - 1` and `expand.right <= toolbar.right + 1` at
320 px / 200 %, plus the existing page-overflow check. At 1440 px it asserts
both buttons share a top edge and the last one ends at the toolbar's right
edge. A regression to a longer label or an unwrapped control fails both.

## 2. Shellcheck quoting

`npm install -g --prefix /tmp/global /tmp/pack/tolkira-$TOLKIRA_VERSION.tgz`
splits on spaces if the variable ever contains them and trips shellcheck
SC2086. The path is a fixed prefix plus the version. Quote the whole path:

```
npm install -g --prefix /tmp/global "/tmp/pack/tolkira-$TOLKIRA_VERSION.tgz"
```

The same line exists in `.github/workflows/ci.yml` and the release `package`
job. The digest and stage commands already quote their paths, so no other line
needs a change. `test/workflow-config.test.ts` reads both workflow files and
forbids the bare absolute path word
`/(?:^|\s)\/tmp\/pack\/tolkira-\$TOLKIRA_VERSION\.tgz(?=\s|$)/`, so the three
quoted lookalikes (digest file, verify echo, stage command) do not false-positive.
The CI `workflows` job prints `shellcheck --version` before actionlint, so the
shellcheck integration is visible; actionlint with shellcheck in CI is the
authoritative check. The local Windows actionlint lacks shellcheck;
`CONTRIBUTING.md` says to install it and treats CI as the proof.

## 3. Bytes and tests

The CSS minifier output grows by the two declarations, so every report changes
by a few bytes. Goldens and characterization hashes are re-pinned for that
change only; the bundled license notice change (B-075) commits first, so its
notice bytes are already in the baseline and this change's CSS-only delta can
be isolated. The static report carries the inlined stylesheet too, so its hash
changes by the CSS bytes; it renders no toolbar or expand markup.

No runtime, schema, markup or API change. No host-specific rendering change
apart from the narrow toolbar wrap; row 2 (cucumber-js legacy and Messages) at
320 px / 200 % and 1440 px records the rendered result.

## 4. Risks

- The wrap increases the toolbar height at 320 px / 200 %; the page-overflow
  and visual tests allow vertical growth, and the fix is strictly narrower.
- The quoting test is a text guard; actionlint with shellcheck in CI is the
  real proof. The Windows-local actionlint gap is recorded in the gate.
- The e2e behavior is proven on Linux CI for the font metrics that caused the
  failure; wrapping removes the font-metric dependence. The full matrix runs
  there before the change is archived.
