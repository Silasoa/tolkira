# Design

`scripts/build-styles.mjs` already reads `report.css` and writes
`src/render/styles.ts`. Replace the raw JSON string with an esbuild transform:

```js
import { transformSync } from 'esbuild';
const minified = transformSync(css, {
  loader: 'css',
  minify: true,
  target: 'esnext',
}).code.trimEnd();
```

esbuild is already a dev dependency used by the build, so the runtime and
dependency surface do not change. Keep the generated `// Generated ... Do not
edit.` header and write only `export const REPORT_CSS`. No source map: the
source file is the map.

The minifier may rewrite whitespace, comments, quoting and some shorthand, and
merge adjacent identical declarations; selectors and declarations remain
semantically equivalent. The exact minified-equality test and the
browser/print gate are the semantic check. The stylesheet is embedded by
`html.ts` exactly as before.

Add a `test/styles.test.ts` that imports `REPORT_CSS` and reads `report.css`.
Keep a drift guard by asserting `REPORT_CSS` equals
`transformSync(source, { loader: 'css', minify: true, target: 'esnext' }).code.trimEnd()`
(esbuild is a dev dependency and usable from tests). Also assert both are
non-empty. This is a build-shape test, not a second minifier.

Existing exact-string guards must be adapted, not deleted:

- `test/dom-contract.test.ts` currently asserts `REPORT_CSS === report.css`;
  replace that with the exact minified equality above.
- `test/render-print.test.ts` checks the exact dark-mode media string, a
  palette trailing `;` and `width: 13%`/`font-size: 7pt` spacing. Replace those
  with regex/whitespace-tolerant assertions that keep the same intent (palette
  values, 13 % width, 7 pt type, dark-mode query).

Golden HTML and characterization hashes change only through the embedded CSS.

The change is report-shell relevant, so run the Playwright 1440/390 row and the
print e2e. No host row requires a new pin; the existing Playwright row applies.
