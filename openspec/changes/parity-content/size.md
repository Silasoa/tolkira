# Size measurement

Measured 2026-11-12 before implementation, with Node.js 26.13.0 and esbuild
0.28.2. This is the baseline the implementer must keep stable; re-measure after
the slice and update this file with the delivered numbers.

## Dependency footprint

| Package | Version | Packed tarball | Unpacked package |
| --- | --- | ---: | ---: |
| `markdown-it` | 15.0.3 | 587,613 B | 2,064,760 B |
| `@cucumber/tag-expressions` | 11.0.1 | 8,692 B | 27,953 B |

`markdown-it` pulls six small packages (`argparse`, `entities`, `linkify-it`,
`mdurl`, `punycode.js`, `uc.micro`). The full temporary `node_modules` for both
packages measured 2,841,267 B. `markdown-it` stays server-side and is not
embedded in the report; it grows the installed package and `dist`, not the
generated HTML. `@cucumber/tag-expressions` is bundled into the report script.

## Bundled code

| Bundle | Minified | Gzip |
| --- | ---: | ---: |
| `markdown-it` ESM entry (platform `node`) | 100,219 B | 42,151 B |
| Tag-expression evaluator IIFE (platform `browser`) | 3,254 B | 1,190 B |

Expected HTML delta: roughly the tag-expression IIFE plus the wrapper script
tag, about 3.3 KB uncompressed and 1.2 KB gzip per report. Markdown output adds
HTML only for descriptions that carry Markdown; it does not add runtime code to
the report.

## Report baseline before the change

`renderReport` from the built `dist/index.js`, title `Size baseline`:

| Fixture | HTML | Gzip | Inline script |
| --- | ---: | ---: | ---: |
| `test/fixtures/messages/empty.ndjson` | 60,300 B | 13,254 B | 16,084 B |
| `test/fixtures/messages/markdown-descriptions.ndjson` | 69,952 B | 14,140 B | 16,084 B |
| `test/fixtures/legacy/tag-expressions.json` | 66,195 B | 13,740 B | 16,084 B |

## How to reproduce

```powershell
npm run build
# render the three fixtures above and print UTF-8 and gzip byte counts
npm install --prefix <temp> markdown-it @cucumber/tag-expressions
node_modules\.bin\esbuild <temp>\md-entry.mjs --bundle --platform=node `
  --format=esm --minify --outfile=<temp>\md.min.mjs
node_modules\.bin\esbuild <temp>\search-entry.mjs --bundle --platform=browser `
  --format=iife --global-name=TolkiraSearch --minify --outfile=<temp>\search.min.js
```

Record the delivered report size delta and dependency version here after the
implementer runs the same commands.
