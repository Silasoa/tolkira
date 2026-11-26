import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatCiOutput } from '../src/ci.js';
import { renderEmail } from '../src/email.js';
import { generateReport, summarizeReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import type { Envelope } from '@cucumber/messages';
import {
  buildReportModel,
  type ReportModel,
  type ReportScenario,
} from '../src/report/model.js';
import type { ReportStatus } from '../src/report/status.js';
import { renderHtml } from '../src/render/html.js';
import { createTranslator, formatMessage } from '../src/render/i18n.js';
import { REPORT_CSS } from '../src/render/styles.js';
import {
  TAG_TABLE_CSS,
  renderTagOverview,
  tagOverviewRows,
} from '../src/render/tags.js';
import { de, en } from '../src/i18n/catalogs.js';
import { fixturePath, messagesFixture } from './fixtures.js';

const english = createTranslator('en');
const german = createTranslator('de');

interface ScenarioSpec {
  tags: string[];
  status?: ReportStatus;
  executed?: boolean;
}

function statusCounts(): ReportModel['counts']['scenarios'] {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
  };
}

/** The overview reads only rendered scenario rows; other model data is inert. */
function tagModel(specs: ScenarioSpec[]): ReportModel {
  const scenarios: ReportScenario[] = specs.map((spec, index) => ({
    id: `scenario-${index}`,
    name: `Scenario ${index + 1}`,
    keyword: 'Scenario',
    description: '',
    uri: 'features/tags.feature',
    featureName: 'Tags',
    status: spec.status ?? 'passed',
    executed: spec.executed ?? true,
    durationMs: 0,
    attempt: 0,
    ownTags: [],
    tags: spec.tags,
    steps: [],
    hooks: [],
    attachments: [],
    extraAttachments: [],
  }));
  return {
    features: [],
    scenarios,
    runHooks: [],
    runAttachments: [],
    counts: {
      features: 0,
      scenarios: statusCounts(),
      steps: statusCounts(),
      hooks: statusCounts(),
      attachments: 0,
      attachmentBytes: 0,
    },
    durationMs: 0,
    source: 'Cucumber',
  };
}

function tagName(index: number): string {
  return `@tag-${String(index).padStart(2, '0')}`;
}

function catalogValue(catalog: Record<string, string>, key: string): string {
  const value = catalog[key];
  if (!value) throw new Error(`Missing catalog key: ${key}`);
  return value;
}

const englishText = (key: string): string => catalogValue(en, key);
const germanText = (key: string): string => catalogValue(de, key);

function tagTable(html: string): string {
  const start = html.indexOf('<table class="tagTable">');
  expect(start, 'tagTable').toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</table>', start));
}

function rowFor(table: string, tag: string): string {
  const marker = `<span class="tag">${tag}</span>`;
  const index = table.indexOf(marker);
  expect(index, `row for ${tag}`).toBeGreaterThan(-1);
  const start = table.lastIndexOf('<tr', index);
  return table.slice(start, table.indexOf('</tr>', index));
}

function cells(row: string): string[] {
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) =>
    (match[1] ?? '').trim(),
  );
}

function tableTags(table: string): string[] {
  return [...table.matchAll(/<span class="tag">([\s\S]*?)<\/span>/g)].map(
    (match) => match[1] ?? '',
  );
}

function filterTags(html: string): string[] {
  const start = html.indexOf('<select data-tag-filter>');
  expect(start, 'tag filter').toBeGreaterThan(-1);
  const select = html.slice(start, html.indexOf('</select>', start));
  return [...select.matchAll(/<option value="([^"]*)"/g)]
    .map((match) => match[1] ?? '')
    .filter((value) => value.length > 0);
}

function viewSlice(html: string, id: string): string {
  const marker = `id="${id}"`;
  const index = html.indexOf(marker);
  expect(index, marker).toBeGreaterThan(-1);
  const next = html.indexOf('<div class="tabPanel"', index + marker.length);
  return html.slice(index, next < 0 ? html.length : next);
}

async function messagesEnvelopes(name: string): Promise<Envelope[]> {
  const file = messagesFixture(name);
  return parseMessages(await readFile(file, 'utf8'), path.basename(file));
}

async function messagesModel(name: string): Promise<ReportModel> {
  return buildReportModel(await messagesEnvelopes(name));
}

async function legacyEnvelopes(name: string): Promise<Envelope[]> {
  const file = fixturePath('legacy', name);
  return parseLegacyJson(await readFile(file, 'utf8'), name);
}

describe('tag overview rows', () => {
  it('counts executed rows per tag and renders zeros for an unexecuted-only tag', () => {
    const model = tagModel([
      { tags: ['@smoke'], status: 'failed' },
      { tags: ['@smoke'], status: 'failed' },
      { tags: ['@smoke'], status: 'skipped' },
      { tags: ['@smoke'], status: 'passed' },
      // Executed-only: neither of these adds to @smoke or @wip.
      { tags: ['@smoke'], status: 'unknown', executed: false },
      { tags: ['@wip'], status: 'unknown', executed: false },
      { tags: ['@pending'], status: 'pending' },
    ]);

    expect(tagOverviewRows(model)).toEqual([
      { tag: '@smoke', scenarios: 4, failed: 2, skipped: 1 },
      { tag: '@pending', scenarios: 1, failed: 0, skipped: 0 },
      { tag: '@wip', scenarios: 0, failed: 0, skipped: 0 },
    ]);

    const table = tagTable(renderTagOverview(model, english));
    const head = table.slice(
      table.indexOf('<thead>'),
      table.indexOf('</thead>'),
    );
    for (const key of [
      'report.tag',
      'details.tagScenarios',
      'details.tagFailed',
      'details.tagSkipped',
    ]) {
      expect(head).toContain(englishText(key));
    }
    expect(table.match(/<th scope="col">/g) ?? []).toHaveLength(4);
    expect(table).not.toContain('<caption>');
    expect(cells(rowFor(table, '@smoke'))).toEqual(['4', '2', '1']);
    expect(cells(rowFor(table, '@pending'))).toEqual(['1', '0', '0']);
    expect(cells(rowFor(table, '@wip'))).toEqual(['0', '0', '0']);
  });

  it('counts inherited feature, rule and examples tags once per executed row', async () => {
    const tags = tagOverviewRows(await messagesModel('tags.ndjson'));
    const row = (tag: string) => tags.find((entry) => entry.tag === tag);

    expect(row('@feature-tag')).toEqual({
      tag: '@feature-tag',
      scenarios: 3,
      failed: 0,
      skipped: 0,
    });
    expect(row('@rule-tag')).toEqual({
      tag: '@rule-tag',
      scenarios: 2,
      failed: 0,
      skipped: 0,
    });
    expect(row('@scenario-tag')).toEqual({
      tag: '@scenario-tag',
      scenarios: 1,
      failed: 0,
      skipped: 0,
    });
    expect(row('@some-tag')).toEqual({
      tag: '@some-tag',
      scenarios: 1,
      failed: 0,
      skipped: 0,
    });

    const examples = tagOverviewRows(
      await messagesModel('examples-tables.ndjson'),
    );
    expect(examples.find((entry) => entry.tag === '@passing')).toEqual({
      tag: '@passing',
      scenarios: 2,
      failed: 0,
      skipped: 0,
    });
    expect(examples.find((entry) => entry.tag === '@failing')).toEqual({
      tag: '@failing',
      scenarios: 2,
      failed: 2,
      skipped: 0,
    });
  });

  it('counts a duplicate tag on one row once', () => {
    const rows = tagOverviewRows(
      tagModel([{ tags: ['@dup', '@dup'], status: 'failed' }]),
    );

    expect(rows).toEqual([
      { tag: '@dup', scenarios: 1, failed: 1, skipped: 0 },
    ]);
  });

  it('orders rows by failed count, scenario count and code-unit tag order', () => {
    const rows = tagOverviewRows(
      tagModel([
        { tags: ['@alpha'], status: 'failed' },
        { tags: ['@alpha'], status: 'passed' },
        ...Array.from({ length: 40 }, () => ({
          tags: ['@beta'],
          status: 'passed' as const,
        })),
        { tags: ['@gamma'], status: 'failed' },
        { tags: ['@gamma'], status: 'passed' },
        { tags: ['@gamma'], status: 'passed' },
        { tags: ['@delta'], status: 'failed' },
        { tags: ['@delta'], status: 'passed' },
        { tags: ['@epsilon'], status: 'failed' },
        { tags: ['@epsilon'], status: 'passed' },
      ]),
    );

    expect(rows.map((entry) => entry.tag)).toEqual([
      '@gamma',
      '@alpha',
      '@delta',
      '@epsilon',
      '@beta',
    ]);
  });
});

describe('tag overview bound', () => {
  it('renders exactly 50 tags without a remainder sentence', () => {
    const model = tagModel(
      Array.from({ length: 50 }, (_, index) => ({ tags: [tagName(index)] })),
    );
    const panel = renderTagOverview(model, english);
    const table = tagTable(panel);

    expect(table.match(/<th scope="row">/g) ?? []).toHaveLength(50);
    expect(panel).not.toContain('Showing');
  });

  it('caps at 50 rows and states the complete tag count above it', () => {
    const model = tagModel(
      Array.from({ length: 51 }, (_, index) => ({ tags: [tagName(index)] })),
    );
    const panel = renderTagOverview(model, english);
    const table = tagTable(panel);

    expect(table.match(/<th scope="row">/g) ?? []).toHaveLength(50);
    expect(panel).toContain('Showing 50 of 51 tags');
  });

  it('keeps every failing tag visible when fewer than 50 tags fail', () => {
    const model = tagModel([
      ...Array.from({ length: 10 }, (_, index) => ({
        tags: [tagName(index)],
        status: 'failed' as const,
      })),
      ...Array.from({ length: 50 }, (_, index) => ({
        tags: [tagName(index + 10)],
        status: 'passed' as const,
      })),
    ]);
    const panel = renderTagOverview(model, english);
    const table = tagTable(panel);
    const tags = tableTags(table);

    expect(tags).toHaveLength(50);
    for (let index = 0; index < 10; index += 1) {
      expect(tags, tagName(index)).toContain(tagName(index));
    }
    expect(panel).toContain('Showing 50 of 60 tags');
  });

  it('shows the 50 highest failed counts when 60 tags fail', () => {
    const specs: ScenarioSpec[] = [];
    for (let tag = 0; tag < 60; tag += 1) {
      for (let failed = 0; failed <= tag; failed += 1) {
        specs.push({ tags: [tagName(tag)], status: 'failed' });
      }
    }
    const panel = renderTagOverview(tagModel(specs), english);
    const table = tagTable(panel);
    const tags = tableTags(table);

    expect(table.match(/<th scope="row">/g) ?? []).toHaveLength(50);
    expect(tags[0]).toBe(tagName(59));
    expect(tags[49]).toBe(tagName(10));
    expect(tags).not.toContain(tagName(9));
    expect(panel).toContain('Showing 50 of 60 tags');
  });
});

describe('tag overview placement and styles', () => {
  it('renders no panel, heading or tag CSS without tags', async () => {
    const model = tagModel([{ tags: [] }]);
    expect(tagOverviewRows(model)).toEqual([]);
    expect(renderTagOverview(model, english)).toBe('');

    const html = await renderHtml(await legacyEnvelopes('minimal.json'), {
      title: 'No tags',
    });

    expect(html).not.toContain('class="tagTable"');
    expect(html).not.toContain('<h2>Tags</h2>');
    expect(html).not.toContain('aria-label="Tag overview"');
    expect(html).not.toContain(TAG_TABLE_CSS);
    expect(REPORT_CSS).not.toMatch(/\.tagTable/);
  });

  it('renders the overview in Details only, after the analysis grid', async () => {
    const html = await renderHtml(await messagesEnvelopes('tags.ndjson'), {
      title: 'Tags',
    });
    const reportView = viewSlice(html, 'report-view');
    const analysisView = viewSlice(html, 'analysis-view');

    expect(reportView).not.toContain('class="tagTable"');
    expect(analysisView).toContain('class="tagTable"');
    expect(analysisView).toContain(`<h2>${englishText('details.tags')}</h2>`);
    expect(analysisView).toContain(englishText('details.tagsNote'));
    expect(analysisView).toContain(
      `aria-label="${englishText('details.tagsLabel')}"`,
    );

    const grid = analysisView.indexOf('class="analysisGrid"');
    const table = analysisView.indexOf('class="tagTable"');
    const summary = analysisView.indexOf(englishText('details.agentSummary'));
    expect(grid).toBeGreaterThan(-1);
    expect(table).toBeGreaterThan(grid);
    expect(summary).toBeGreaterThan(table);
  });

  it('injects TAG_TABLE_CSS only into a tagged report', async () => {
    const tagged = await renderHtml(await messagesEnvelopes('tags.ndjson'), {
      title: 'Tags',
    });
    const untagged = await renderHtml(await legacyEnvelopes('minimal.json'), {
      title: 'No tags',
    });

    expect(tagged).toContain(TAG_TABLE_CSS);
    expect(untagged).not.toContain(TAG_TABLE_CSS);
    expect(TAG_TABLE_CSS).toMatch(
      /\.tagTable\s+thead\s*\{[^}]*display:\s*table-header-group/,
    );
    expect(TAG_TABLE_CSS).toMatch(
      /\.tagTable\s+tr\s*\{[^}]*break-inside:\s*avoid/,
    );
  });

  it('uses the tag filter option set, including an unexecuted-only tag', async () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          uri: 'features/unexecuted-tags.feature',
          name: 'Unexecuted tags',
          elements: [
            {
              keyword: 'Scenario',
              type: 'scenario',
              name: 'Executed row',
              tags: [{ name: '@smoke', line: 3 }],
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a step',
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
            {
              keyword: 'Scenario',
              type: 'scenario',
              name: 'Unexecuted row',
              tags: [{ name: '@wip', line: 9 }],
              steps: [],
            },
          ],
        },
      ]),
      'unexecuted-tags.json',
    );
    const html = await renderHtml(envelopes, { title: 'Filter set' });
    const table = tagTable(html);

    expect(filterTags(html)).toContain('@wip');
    expect([...tableTags(table)].sort()).toEqual([...filterTags(html)].sort());
    expect(cells(rowFor(table, '@wip'))).toEqual(['0', '0', '0']);
  });

  it('escapes tag text and never builds an attribute from a tag', () => {
    const evil = `@evil"><script>alert(1)</script>&'`;
    const panel = renderTagOverview(
      tagModel([{ tags: [evil], status: 'failed' }]),
      english,
    );
    const table = tagTable(panel);
    const row = table.slice(table.indexOf('<tbody>'));

    expect(panel).not.toContain('<script>');
    expect(table).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(table).toContain('&quot;');
    expect(table).toContain('&amp;');
    expect(table).toContain('&#39;');
    expect(row).not.toMatch(/\s[\w-]+="[^"]*@evil/);
  });
});

describe('tag overview localisation', () => {
  it('defines the contract English catalog text', () => {
    expect(englishText('details.tags')).toBe('Tags');
    expect(englishText('details.tagsNote')).toBe(
      'Counts cover executed scenario rows; failed and skipped count only those statuses.',
    );
    expect(englishText('details.tagsLabel')).toBe('Tag overview');
    expect(englishText('details.tagScenarios')).toBe('Scenarios');
    expect(englishText('details.tagFailed')).toBe('Failed');
    expect(englishText('details.tagSkipped')).toBe('Skipped');
    expect(englishText('details.tagsRemaining')).toBe(
      'Showing {shown} of {total} tags',
    );
  });

  it('renders the panel in German with locale counts and verbatim tags', async () => {
    const model = tagModel([{ tags: ['@konto'] }]);
    const panel = renderTagOverview(model, german);

    expect(panel).toContain(`<h2>${germanText('details.tags')}</h2>`);
    expect(panel).toContain(`aria-label="${germanText('details.tagsLabel')}"`);
    expect(panel).toContain(germanText('details.tagsNote'));
    for (const key of [
      'details.tagScenarios',
      'details.tagFailed',
      'details.tagSkipped',
    ]) {
      expect(panel).toContain(`>${germanText(key)}</th>`);
    }
    expect(panel).toContain('<span class="tag">@konto</span>');
    for (const key of [
      'details.tagsNote',
      'details.tagsLabel',
      'details.tagScenarios',
      'details.tagFailed',
      'details.tagSkipped',
      'details.tagsRemaining',
    ]) {
      expect(germanText(key), key).not.toBe(englishText(key));
    }

    const many = tagModel(
      Array.from({ length: 1234 }, () => ({ tags: ['@bulk'] })),
    );
    expect(
      cells(rowFor(tagTable(renderTagOverview(many, german)), '@bulk')),
    ).toEqual(['1.234', '0', '0']);
    expect(
      cells(rowFor(tagTable(renderTagOverview(many, english)), '@bulk')),
    ).toEqual(['1234', '0', '0']);

    const capped = tagModel(
      Array.from({ length: 51 }, (_, index) => ({ tags: [tagName(index)] })),
    );
    const cappedPanel = renderTagOverview(capped, german);
    const remainder = formatMessage(
      germanText('details.tagsRemaining'),
      { shown: 50, total: 51 },
      'de',
    );
    expect(cappedPanel).toContain(remainder);

    const germanFile = fixturePath('i18n', 'german-testdata.json');
    const html = await renderHtml(
      parseLegacyJson(
        await readFile(germanFile, 'utf8'),
        'german-testdata.json',
      ),
      { title: 'Bericht', locale: 'de' },
    );
    expect(viewSlice(html, 'analysis-view')).toContain(
      `<h2>${germanText('details.tags')}</h2>`,
    );
  });
});

describe('tag overview output boundaries', () => {
  it('keeps summary, CI and email output free of tag data', async () => {
    const file = messagesFixture('tags.ndjson');
    const generated = await generateReport(file, { title: 'Tags' });
    const summary = await summarizeReport(file);
    const generatedJson = JSON.stringify(generated.summary, null, 2);

    expect(generatedJson).toBe(JSON.stringify(summary, null, 2));

    const now = new Date('2026-11-26T00:00:00.000Z');
    const email = renderEmail(generated.summary, { now });
    expect(email).toBe(renderEmail(summary, { now }));
    expect(email).not.toContain('@feature-tag');
    expect(email).not.toContain('tagTable');

    for (const format of ['markdown', 'github'] as const) {
      const ci = formatCiOutput(generated.summary, format);
      expect(ci).toBe(formatCiOutput(summary, format));
      expect(ci).not.toContain('@feature-tag');
    }
  });
});
