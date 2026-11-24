# Design

## Context

0.6.0 shipped the static form with one `<main>`. The default form kept the
pre-existing three-main markup (B-048). The Details metadata list uses a grid
whose label track shrinks under text zoom (B-039), and `readHistory` parses the
sidecar text without removing a leading UTF-8 BOM (B-049). The baseline reader
already strips one BOM (`src/baseline.ts:223`); this change gives the shared
history sidecar read the same narrow tolerance.

The change is three small seams, no new module and no new dependency.

## Seams

### B-048: one `<main>` in both report forms

- `src/render/report.ts` keeps `<main class="shell">` for the Report view.
- `src/render/details.ts` (`renderAnalysisView`) and `src/render/trends.ts`
  (`renderTrendsView`) already use `<div class="shell analysis">` in static
  mode. The default branch changes from
  `<main class="shell analysis">...</main>` to
  `<div class="shell analysis">...</div>`.
- The panel wrapper, `tabPanel` class, `analysis-view`/`trends-view` IDs,
  `role="tabpanel"`, `aria-labelledby`, `tabindex` and `hidden` stay exactly as
  today. Only the landmark element changes.
- The print rule `#analysis-view, #trends-view { break-before: page; }` is keyed
  by ID, not by `.tabPanel` or `<main>`, so it is unaffected.
- The static and default branches now share the same inner markup; the mode
  still controls only scripts, controls, `open`, `hidden` and ARIA.

The Report view is first in document order, so the one `<main>` remains the
first main landmark. Heading order and levels do not move. The only landmark
change is the removal of the two duplicate `main` landmarks, which is the
defect being fixed.

No CSS changes for B-048; `.shell` keeps its layout, max-width, padding and
container type.

### B-039: stacked metadata at the text-zoom boundary

Current rules (`src/render/report.css`):

- base at 354-356: `grid-template-columns: minmax(0, auto) minmax(0, 1fr)`,
  values right-aligned;
- at `max-width: 560px` (386): `minmax(0,2fr) minmax(0,3fr)`;
- German (`localeCss` in `src/render/html.ts`) also forces the 2fr/3fr label
  share, and `sizeMeta` already stacks at 560 px and below (B-046).

At 320 px and 200 % text the shell content is 320 - 2 × 2rem = 192 px while the
root is 32 px; a 2fr label track is about 77 px at 26 px type, so labels break
per character and right-aligned long links fragment.

The fix is one narrow container query. `.shell` is already
`container-type: inline-size` (report.css:61), so a container query can read the
shell's content width. The condition is written in `rem`: container-query
lengths follow the root font size, unlike a media query, whose `em` is fixed at
the initial size. A `max-width: 10rem` condition therefore means "narrower than
10 text-sized rems": it matches 320 px at 200 % text (192 px < 320 px) and
390 px at 200 % text (262 px < 320 px), but not 320 px at 100 % (256 px >
160 px), 390 px at 100 % (326 px > 160 px) or any wider gate viewport at 100 %.
The exact threshold is verified against the five gate widths; 10rem is the
starting value, not a contract.

```css
@container (max-width: 10rem) {
  .metaList { grid-template-columns: minmax(0, 1fr); }
  .metaList dd { text-align: left; }
}
```

- `overflow-wrap: anywhere` already exists on `dt` and `dd`; the stacked
  full-width track lets a long URL wrap instead of forming a narrow column.
- Values start-align because a right-aligned single column reads as ragged.
- German needs one extra override after the existing `:lang(de) .metaList`
  rule in `localeCss`, because that selector outranks the generic `.metaList`
  rule:
  `@container (max-width:10rem){:lang(de) .metaList{grid-template-columns:minmax(0,1fr)}}`
- `src/render/styles.ts` is generated from `report.css` by
  `scripts/build-styles.mjs`; edit `report.css` and run `npm run styles` (the
  gate's `npm run assets` does the same). Never hand-edit the generated string.
- No script, catalog key, DOM attribute or metadata value changes. The header
  metadata list is not a `.metaList`; it stays untouched.

### B-049: one leading BOM in the shared sidecar read

`readHistory` (`src/history.ts:344`) and `storedSchema` (`src/history.ts:390`)
both obtain their text from `readSidecar`. Insert the same one-line strip as
the baseline reader in `readSidecar`, immediately after `readBounded` returns:

```ts
const text = await readBounded(handle, info.size);
return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
```

Both callers therefore see BOM-free text through one rule in one bounded read
path. Consequences:

- A valid BOM-prefixed file returns the same runs as the same file without a
  BOM.
- The schema peek accepts the same file, so an append to a BOM-prefixed
  sidecar proceeds instead of failing with `not valid JSON`.
- A BOM-only file leaves an empty string; `JSON.parse('')` throws and the
  existing `Invalid ...: not valid JSON` and `Cannot write ...: not valid JSON`
  paths are unchanged.
- BOM plus invalid JSON behaves the same way in both callers.
- Two leading BOMs leave one; `JSON.parse` still fails with the same error. The
  "exactly one" boundary is intentional.
- A read never writes. The file bytes and mtime are untouched.
- `writeHistory` stays BOM-free: `serialize` emits `{` as the first byte, so
  the next successful append rewrites a BOM-prefixed target as BOM-free bytes
  and keeps every run the same append would keep.

## Data flow

Report: input → normalised envelopes → `ReportModel` → `renderHtml` → three
views. This change replaces two wrapper elements and adds one scoped CSS rule;
no model, count, summary or client-bundle stage changes.

History: sidecar path → `readSidecar` (regular-file check, 1 MiB cap, bounded
read, one-BOM strip) → `JSON.parse` → schema/run validation → returned list.
The writer peeks the target through the same path, serialises without a BOM and
writes atomically.

## Hard parts and risks

- **Characterization churn.** Replacing two wrappers changes all nine default
  hashes and both golden files; the narrow CSS changes them again. Re-pin once,
  after both edits, and inspect the diff: only `<main class="shell analysis">`
  → `<div class="shell analysis">` (twice), the matching closing tags, and the
  appended CSS string are allowed. Any other byte change is a bug.
- **Text-zoom detection.** The 10rem container threshold is the load-bearing
  part. Verify computed `grid-template-columns` at 320/200 (one track), 320/100
  and 390/100 (two tracks), and at 768/1024/1440. Container queries are in all
  gate engines; if one ignored the rule, the fallback is the current wrapping
  grid, not horizontal overflow.
- **German specificity.** The generic container rule loses to
  `:lang(de) .metaList`; the extra German override is required, not optional.
- **Landmark change.** Screen-reader users see one `main` instead of three. The
  tab roles, headings and reading order stay; this is the intended validity fix.
- **BOM normalisation timing.** The strip applies to reads and to the writer's
  target peek, never to the writer's output. A successful append rewrites a
  BOM-prefixed target as BOM-free bytes; a failed append leaves it untouched.
  The report is already written before the history write, as today.
- **No visual change promise.** B-048 is wrapper-only and B-039 is scoped to the
  320/200 case; CMP compares captures at the gate viewports to prove the wider
  layouts did not move.

## Tests

- Unit render: default no-history report has one `<main>` inside
  `#report-view`, `#analysis-view` has none, `#trends-view` is absent, tab
  roles unchanged; default with two history runs has one `<main>` and all three
  IDs; static still has one.
- Unit DOM contract: heading order, tabpanel roles and IDs stay; print CSS keeps
  the `#analysis-view, #trends-view` break rule.
- Unit CSS: the narrow container rule exists in `REPORT_CSS`, the German
  override exists in the locale string, and the base 2fr/3fr rule is unchanged.
- Unit history: no BOM, one BOM, two BOMs, BOM-only, BOM plus invalid JSON, a
  valid BOM file's runs and bytes; the schema peek accepts a BOM-prefixed file;
  an append to a BOM-prefixed file succeeds and its output is byte-identical to
  the same append without the BOM (no run lost); the writer's output has no BOM.
- Browser: one main and no horizontal overflow at 320, 390, 768, 1024 and
  1440 px and at 320 px / 200 % text; Details metaList stacks at 320/200 and
  keeps two tracks at 320/100 and 390/100; a long unbroken metadata URL wraps
  with no overflow; German narrow layout; visual captures at the gate viewports
  compared by CMP.
- Characterization/goldens: re-pin the nine hashes, the two-run history hash and
  the two golden HTML files; the client bundle budget stays under 16 KB.

**Visual evidence (B-054, test-only).** One e2e test renders the default and the
`--static` report from `test/fixtures/messages/screenshot.ndjson` and writes
viewport captures to `test-results/visual/<engine>/`: 1440 px and 390 px for
both forms, plus 320 px at 200 % text for both forms. Six PNGs per engine per
run land in the
existing `playwright-visual-*` artifacts; the engine folder keeps the three
parallel projects from overwriting each other. Each form asserts its title
before capture; the captures are never compared, so there is no baseline, no
committed image and no new dependency. The existing `visual.spec.ts` captures
stay as they are. B-054 is test work only and changes no report behaviour, so
it adds no requirement delta.

## ADRs

- [ADR 0005](../../../docs/adr/0005-server-rendered-shell.md): the shell is
  server-rendered; one main landmark is part of the shell contract.
- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md): no new
  dependency; the reader strip is a built-in string operation.

## Open questions

1. **Characterization re-pin approval.** All nine default hashes, the history
   hash and the two golden files change. This is the expected consequence of
   B-048 plus the new CSS. Approve the re-pin as part of this change.
