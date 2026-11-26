# Design

## 1. Context

The Details view already renders a feature-by-status matrix, a status
distribution, run/environment metadata and a JSON preview. Tags appear on
feature, rule, outline, example and scenario rows and drive the toolbar filter
and the tag-expression search, but there is no aggregate view.

The report is one self-contained HTML file with no network and no CDN. The
tag overview is server-rendered, so it works in the default, static and print
forms and adds no client script, no DOM contract and no JSON block.

## 2. Data and counting

All counts come from the flat rendered rows (`model.scenarios`):

- `scenarios`: executed rendered rows (`scenario.executed`) whose `tags`
  contains the tag. The `tags` field is the inherited pickle tag set, so a
  feature, rule, scenario or examples tag already reaches every affected row.
  This matches the executed-only rule every other scenario count in the report
  follows.
- `failed`: executed rows in that set with final status `failed`.
- `skipped`: executed rows in that set with final status `skipped`.
- Other executed statuses (pending, undefined, ambiguous, unknown) count as
  scenarios only; the note says so.
- A tag that appears only on unexecuted rows still gets a row with zeros, so
  the overview's tag set equals the tag filter's option set.
- A row that carries the same tag twice counts once. Deduplicate per row.

No model field and no summary field is added: the helper walks
`model.scenarios` once. The work is O(rows x tags per row), linear in the
rendered data.

## 3. Placement and markup

The table is a full-width panel after the analysis grid and before the run
attachments:

```html
<section class="panel" style="margin-top:16px">
  <h2>Tags</h2>
  <p>...counting note...</p>
  <div class="tableWrap" tabindex="0" role="region" aria-label="Tag overview">
    <table class="tagTable">...</table>
  </div>
  <p>Showing 50 of 60 tags</p>
</section>
```

The toolbar is already tight at 320 px; a table beside the tag filter would
overflow or wrap the toolbar. The Details panel uses the existing `.panel`,
`.tableWrap` and focus conventions, so it scrolls horizontally at 320 px and
gets the print table rules for free. The tag filter stays where it is.

Columns: `Tag`, `Scenarios`, `Failed`, `Skipped`. The tag cell uses
`<th scope="row">` and the existing `.tag` mono style; numeric cells use the
existing right-aligned mono `num` treatment. Headers are
`<th scope="col">`. The table caption is not rendered as a visible element; the
region carries the aria-label.

## 4. Order, cap and empty states

- Sort: failed count descending, then scenario count descending, then tag in
  the fixed UTF-16 code-unit order (`compareText`), so a failing tag survives
  the cap and output stays stable across hosts and locales.
- Cap: 50 rows. When more tags exist, one sentence states
  `Showing 50 of <total> tags`; `<total>` is the complete distinct tag count.
  Hidden rows contribute no partial aggregate. With more than 50 failing tags
  the cap still applies; the sort only guarantees visibility while the failing
  tags fit.
- No tag on any rendered row: no panel, no heading, no empty state.
- The table is not filtered by the toolbar. A reader who applies a filter keeps
  the full overview as the reference.

## 5. Styles

Export one `TAG_TABLE_CSS` string from `src/render/tags.ts`, following the
existing `TRENDS_SHELL_CSS` seam in `src/render/trends.ts`, and inject it into
the `<style>` block in `src/render/html.ts` only when the overview renders
(decided by the same builder that renders the panel). `REPORT_CSS` stays
untouched, so a report without tags keeps byte-identical output and no dead
CSS. Reuse `.featureTable` numeric, header and border conventions, but give the
tag column a mono tag style and let it wrap anywhere; the panel spans the grid,
so no new breakpoint is needed. The table SHALL use `<thead>`, and
`TAG_TABLE_CSS` SHALL carry `.tagTable thead { display: table-header-group }`
and `.tagTable tr { break-inside: avoid }`, so print repeats the header and
keeps rows whole; the existing print rules for `.tableWrap table` and `.panel`
apply on top.

## 6. Localisation

New keys in both catalogs (English carries descriptions):

| Key | English |
| --- | --- |
| `details.tags` | Tags |
| `details.tagsNote` | Counts cover executed scenario rows; failed and skipped count only those statuses. |
| `details.tagsLabel` | Tag overview |
| `details.tagScenarios` | Scenarios |
| `details.tagFailed` | Failed |
| `details.tagSkipped` | Skipped |
| `details.tagsRemaining` | Showing {shown} of {total} tags |

The tag column header reuses `report.tag` ("Tag"), the existing filter label;
no new key is needed for it. All counts render through `t.number`, matching the
matrix and the status distribution. German values are agreed with the ILA
reviewer and recorded in `docs/I18N.md` only when the glossary needs a new term.
Tag names are test data and render verbatim; status labels are not reused
because the columns are counts, not badges.

## 7. Tests

Unit (`test/render-tags.test.ts`, importing the pure row builder and
`renderHtml`):

- counts per tag on a mixed executed fixture (2 failed, 1 skipped, 1 passed) and
  the exact cells, plus a tag only on an unexecuted row with three zeros;
- inherited feature/rule/examples tags reach every row and count once;
- a row with a duplicate tag counts once;
- sort by failed count, then scenario count, then code-unit order;
- 60 tags with fewer than 50 failing: 50 rows, `Showing 50 of 60 tags`,
  complete total, every failing tag visible;
- 60 failing tags: 50 rows in failed-count, scenario-count, code-unit order;
- no tags: panel absent;
- HTML escaping of a tag with `<`, `&` and quotes;
- the tag set equals the tag filter's option set;
- `REPORT_CSS` contains no tag rule and an untagged report contains neither the
  panel nor `TAG_TABLE_CSS`;
- summary, CI and email bytes unchanged.

Browser (`test/e2e/tags.spec.ts`):

- the panel is visible in Details, not on the Report tab, and the table scrolls
  inside the panel at 320 px and 200 % text without page overflow;
- applying a toolbar search, status filter or tag filter hides scenarios on the
  Report tab but leaves every overview count unchanged;
- the static report shows the panel open and script-free;
- print repeats the header row and keeps each row whole;
- German report shows the German heading and column labels.

## 8. Host validation

The change touches the report shell, so the report-shell rows in
`docs/DROP-IN-VALIDATION.md` run before merge: rows 1-5 on their recorded pins,
checking the tag panel (legacy JSON maps feature and scenario tags, so rows 1-2
show it; JUnit in row 4 is tagless and shows none), the 320/1440 px layout,
200 % text and print. Record host, pin and result in the change tasks;
a red host blocks or needs a written, user-approved exception.

## 9. Risks and decisions

- Report bytes grow for tagged runs only (panel plus its conditional CSS); an
  untagged report keeps its exact bytes, and the summary, CI, email and history
  bytes are unchanged.
- A run with thousands of distinct tags renders at most 50 rows; counts are
  computed over all rows, and failing tags sort first, so the cap hides a
  failing tag only when more than 50 tags have a failed row.
- XSS: tags are escaped with the existing `escapeHtml`; no attribute is built
  from a tag.
- The table is an overview, not a second filter; it deliberately does not react
  to the toolbar. Recorded decision.
- JUnit has no tags in its normal output, so the panel is absent there; legacy
  JSON maps feature and scenario tags, and Messages/Playwright carry pickle
  tags, so those runs show the panel. That is the empty state, not a producer
  gap.
