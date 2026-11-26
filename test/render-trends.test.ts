import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { HistoryRun } from '../src/history.js';
import { renderHtml } from '../src/render/html.js';
import type { RenderReportOptions } from '../src/options.js';
import type { StatusCounts } from '../src/summary.js';
import { syntheticRun } from './render-helpers.js';

const envelopes = syntheticRun([
  { name: 'Trends feature', scenarios: [{ name: 'Passes', status: 'passed' }] },
]);

function counts(overrides: Partial<StatusCounts> = {}): StatusCounts {
  return {
    total: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
    ...overrides,
  };
}

function run(overrides: Partial<HistoryRun> = {}): HistoryRun {
  return {
    id: 'run-1',
    recordedAt: '2026-01-01T00:00:00.000Z',
    title: 'Nightly',
    status: 'passed',
    counts: {
      features: 1,
      scenarios: counts(),
      steps: counts(),
    },
    durationMs: 1000,
    attachments: { total: 0, bytes: 0 },
    ...overrides,
  };
}

function renderTrends(history?: HistoryRun[]): Promise<string> {
  const options: RenderReportOptions = {
    title: 'Trends report',
    ...(history === undefined ? {} : { history }),
  };
  return renderHtml(envelopes, options);
}

function renderLocalizedTrends(
  history: HistoryRun[],
  locale: string,
): Promise<string> {
  return renderHtml(envelopes, { title: 'Trends report', history, locale });
}

async function catalogMessages(
  locale: 'en' | 'de',
): Promise<Record<string, string>> {
  const raw = JSON.parse(
    await readFile(
      new URL(`../src/i18n/locales/${locale}.json`, import.meta.url),
      'utf8',
    ),
  ) as Record<string, string | { message: string }>;
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : value.message,
    ]),
  );
}

function numericHeaders(panel: string): string[] {
  return [
    ...panel.matchAll(/<th scope="col" class="num">([\s\S]*?)<\/th>/g),
  ].map((match) => match[1] ?? '');
}

function viewTabs(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*\bdata-view="([^"]+)"/g)].map(
    (match) => match[1] ?? '',
  );
}

function openingTag(html: string, marker: string): string {
  const index = html.indexOf(marker);
  expect(index, marker).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<', index);
  return html.slice(start, html.indexOf('>', index) + 1);
}

function trendsPanel(html: string): string {
  const start = html.indexOf('id="trends-view"');
  expect(start, 'Trends panel').toBeGreaterThan(-1);
  const end = html.indexOf('<dialog', start);
  return html.slice(start, end === -1 ? undefined : end);
}

function tableRows(panel: string): string[] {
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/.exec(panel);
  expect(body, 'Trends table body').not.toBeNull();
  return [...(body?.[1] ?? '').matchAll(/<tr\b[\s\S]*?<\/tr>/g)].map(
    (match) => match[0],
  );
}

function sparkline(panel: string): string {
  const match = /<svg\b[\s\S]*?<\/svg>/.exec(panel);
  expect(match, 'sparkline').not.toBeNull();
  return match?.[0] ?? '';
}

function circles(svg: string): string[] {
  return [...svg.matchAll(/<circle\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /\bclass="[^"]*sparkPoint[^"]*"/.test(tag));
}

function lines(svg: string): string[] {
  return [...svg.matchAll(/<polyline\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /\bclass="[^"]*sparkLine[^"]*"/.test(tag));
}

describe('Trends view', () => {
  it('keeps the Report and Details tabs without history or with one entry', async () => {
    for (const history of [[], [run()]]) {
      const html = await renderTrends(history);

      expect(viewTabs(html)).toEqual(['report', 'analysis']);
      expect(html).not.toContain('data-view="trends"');
      expect(html).not.toContain('id="trends-view"');
    }
  });

  it('adds a third tab and a hidden panel with two entries', async () => {
    const html = await renderTrends([
      run({ id: 'old' }),
      run({ id: 'new', recordedAt: '2026-02-01T00:00:00.000Z' }),
    ]);

    expect(viewTabs(html)).toEqual(['report', 'analysis', 'trends']);
    const tab = openingTag(html, 'data-view="trends"');
    expect(tab).toContain('role="tab"');
    expect(tab).toContain('aria-controls="trends-view"');

    const panel = openingTag(html, 'id="trends-view"');
    expect(panel).toContain('role="tabpanel"');
    expect(panel).toContain('aria-labelledby="view-trends"');
    expect(panel).toContain('hidden');
  });

  it('lists the runs newest first', async () => {
    const oldest = run({
      id: 'old',
      recordedAt: '2026-01-01T00:00:00.000Z',
      title: 'January run',
    });
    const middle = run({
      id: 'mid',
      recordedAt: '2026-02-01T00:00:00.000Z',
      title: 'February run',
    });
    const newest = run({
      id: 'new',
      recordedAt: '2026-03-01T00:00:00.000Z',
      title: 'March run',
    });

    const rows = tableRows(
      trendsPanel(await renderTrends([middle, oldest, newest])),
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('March run');
    expect(rows[1]).toContain('February run');
    expect(rows[2]).toContain('January run');
  });

  it('renders status counts, the full-width table and the narrow-screen hint', async () => {
    const panel = trendsPanel(
      await renderTrends([
        run({ id: 'a' }),
        run({
          id: 'b',
          recordedAt: '2026-02-01T00:00:00.000Z',
          counts: {
            features: 1,
            scenarios: counts({
              total: 9,
              passed: 5,
              failed: 3,
              skipped: 1,
            }),
            steps: counts(),
          },
        }),
      ]),
    );

    expect(panel).toContain('class="trendsTable"');
    expect(panel).toMatch(
      /<td class="num">5<\/td><td class="num">3<\/td><td class="num">1<\/td><td class="num">9<\/td>/,
    );
    for (const header of [
      'Passed',
      'Failed',
      'Skipped',
      'Total',
      'Pass rate',
      'Duration',
    ]) {
      expect(panel).toContain(`<th scope="col" class="num">${header}</th>`);
    }
    expect(panel).toContain(
      'Scroll for status, counts, pass rate, flaky count, flaky share and duration.',
    );
  });

  it('captions the sparkline and marks the newest row as current', async () => {
    const panel = trendsPanel(
      await renderTrends([
        run({ id: 'old', recordedAt: '2026-01-01T00:00:00.000Z' }),
        run({ id: 'new', recordedAt: '2026-02-01T00:00:00.000Z' }),
      ]),
    );

    expect(panel).toContain(
      'Pass rate, oldest to newest. The table is newest first;',
    );
    expect(panel.match(/class="currentTag"/g)).toHaveLength(1);
    const rows = tableRows(panel);
    expect(rows[0]).toContain('Current');
    expect(rows[1]).not.toContain('Current');
  });

  it('does not trust caller-supplied history entries', async () => {
    const hostile = {
      ...run({ id: 'hostile', recordedAt: 'not-a-date', title: '<b>x</b>' }),
      status: '"><img src=x onerror="alert(1)">',
      counts: {
        features: 1,
        scenarios: {
          total: Number.NaN,
          passed: Number.POSITIVE_INFINITY,
          failed: -2,
          skipped: '1',
        },
        steps: counts(),
      },
      durationMs: Number.NaN,
    } as unknown as HistoryRun;

    const panel = trendsPanel(
      await renderTrends([
        hostile,
        run({ id: 'safe', recordedAt: '2026-02-01T00:00:00.000Z' }),
      ]),
    );

    expect(panel).not.toContain('NaN');
    expect(panel).not.toContain('Infinity');
    expect(panel).not.toContain('<b>');
    expect(panel).not.toContain('<img');
    expect(panel).not.toContain('onerror');
    expect(panel).toContain('Unknown');
    expect(panel).toContain('0 ms');
    expect(panel).toContain('—');
  });

  it('uses attempted scenarios for the pass rate and a dash for no attempt', async () => {
    const partial = run({
      id: 'partial',
      status: 'failed',
      counts: {
        features: 1,
        scenarios: counts({ total: 9, passed: 4, failed: 5 }),
        steps: counts({ total: 9, passed: 4, failed: 5 }),
      },
    });
    const attemptedAll = run({
      id: 'attempted',
      counts: {
        features: 1,
        scenarios: counts({ total: 6, passed: 5, skipped: 1 }),
        steps: counts({ total: 6, passed: 5, skipped: 1 }),
      },
    });
    const skippedOnly = run({
      id: 'skipped',
      status: 'skipped',
      counts: {
        features: 1,
        scenarios: counts({ total: 4, passed: 0, skipped: 4 }),
        steps: counts({ total: 4, passed: 0, skipped: 4 }),
      },
    });

    const panel = trendsPanel(
      await renderTrends([partial, attemptedAll, skippedOnly]),
    );

    expect(panel).toContain('44.4%');
    expect(panel).toContain('100%');
    expect(panel).not.toContain('83.3%');
    expect(panel).toContain('—');
  });

  it('draws a decorative sparkline from oldest to newest', async () => {
    const newest = run({
      id: 'new',
      recordedAt: '2026-03-01T00:00:00.000Z',
      counts: {
        features: 1,
        scenarios: counts({ total: 2, passed: 1, failed: 1 }),
        steps: counts({ total: 2, passed: 1, failed: 1 }),
      },
    });
    const oldest = run({
      id: 'old',
      recordedAt: '2026-01-01T00:00:00.000Z',
      counts: {
        features: 1,
        scenarios: counts({ total: 4, passed: 1, failed: 3 }),
        steps: counts({ total: 4, passed: 1, failed: 3 }),
      },
    });
    const middle = run({
      id: 'mid',
      recordedAt: '2026-02-01T00:00:00.000Z',
      counts: {
        features: 1,
        scenarios: counts({ total: 1, passed: 1 }),
        steps: counts({ total: 1, passed: 1 }),
      },
    });

    const svg = sparkline(
      trendsPanel(await renderTrends([newest, oldest, middle])),
    );

    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toMatch(/\bviewBox="0 0 [\d.]+ [\d.]+"/);

    const points = circles(svg);
    expect(points).toHaveLength(3);
    const xs = points.map((point) => Number(/\bcx="([^"]+)"/.exec(point)?.[1]));
    expect(xs.every((cx) => Number.isFinite(cx))).toBe(true);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));

    const drawn = lines(svg);
    expect(drawn).toHaveLength(1);
    for (const line of drawn) {
      expect(line).toContain('vector-effect="non-scaling-stroke"');
    }
  });

  it('hides the sparkline markers above the density threshold', async () => {
    const history = (count: number): HistoryRun[] =>
      Array.from({ length: count }, (_, index) =>
        run({
          id: `dense-${index}`,
          recordedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        }),
      );

    const atLimit = sparkline(trendsPanel(await renderTrends(history(60))));
    expect(circles(atLimit)).toHaveLength(60);

    const dense = sparkline(trendsPanel(await renderTrends(history(61))));
    expect(circles(dense)).toHaveLength(0);
    expect(lines(dense).length).toBeGreaterThan(0);
  });

  it('omits a run with no attempt and does not bridge the gap', async () => {
    const before = run({
      id: 'before',
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    const skipped = run({
      id: 'gap',
      recordedAt: '2026-02-01T00:00:00.000Z',
      status: 'skipped',
      counts: {
        features: 1,
        scenarios: counts({ total: 3, passed: 0, skipped: 3 }),
        steps: counts({ total: 3, passed: 0, skipped: 3 }),
      },
    });
    const after = run({ id: 'after', recordedAt: '2026-03-01T00:00:00.000Z' });

    const svg = sparkline(
      trendsPanel(await renderTrends([before, skipped, after])),
    );

    expect(circles(svg)).toHaveLength(2);
    expect(lines(svg)).toHaveLength(0);
  });

  it('labels a focusable table region and scopes its headers', async () => {
    const panel = trendsPanel(
      await renderTrends([
        run({ id: 'a' }),
        run({ id: 'b', recordedAt: '2026-02-01T00:00:00.000Z' }),
      ]),
    );

    const region = /<div\b[^>]*\bclass="[^"]*\btableWrap\b[^"]*"[^>]*>/.exec(
      panel,
    );
    expect(region, 'table region').not.toBeNull();
    expect(region?.[0]).toContain('tabindex="0"');
    expect(region?.[0]).toContain('role="region"');
    expect(region?.[0]).toMatch(/\baria-label="[^"]+"/);

    const headers = [...panel.matchAll(/<th\b[^>]*>/g)].map(
      (match) => match[0],
    );
    expect(headers.length).toBeGreaterThanOrEqual(5);
    expect(
      headers.filter((header) => header.includes('scope="col"')),
    ).toHaveLength(headers.length);
  });

  it('escapes a history title', async () => {
    const panel = trendsPanel(
      await renderTrends([
        run({ id: 'a', title: '<img src=x onerror="alert(1)">' }),
        run({ id: 'b', recordedAt: '2026-02-01T00:00:00.000Z' }),
      ]),
    );

    expect(panel).toContain('&lt;img');
    expect(panel).not.toContain('<img');
  });

  it('keeps the Report view visible without JavaScript', async () => {
    const html = await renderTrends([
      run({ id: 'a' }),
      run({ id: 'b', recordedAt: '2026-02-01T00:00:00.000Z' }),
    ]);

    expect(openingTag(html, 'id="report-view"')).not.toContain('hidden');
    expect(openingTag(html, 'id="trends-view"')).toContain('hidden');
  });
});

describe('Trends flaky columns', () => {
  it('shows the flaky count and share between pass rate and duration', async () => {
    const newest = run({
      id: 'new',
      recordedAt: '2026-03-01T00:00:00.000Z',
      flaky: 2,
      counts: {
        features: 1,
        scenarios: counts({ total: 42, passed: 38, failed: 2, skipped: 2 }),
        steps: counts(),
      },
    });
    const oldest = run({
      id: 'old',
      recordedAt: '2026-02-01T00:00:00.000Z',
      flaky: 0,
      counts: {
        features: 1,
        scenarios: counts({ total: 40, passed: 35, failed: 5 }),
        steps: counts(),
      },
    });

    const panel = trendsPanel(await renderTrends([oldest, newest]));
    const rows = tableRows(panel);

    expect(numericHeaders(panel).slice(-4)).toEqual([
      'Pass rate',
      'Flaky',
      'Flaky share',
      'Duration',
    ]);
    expect(rows[0]).toContain('<td class="num">2</td><td class="num">5%</td>');
    expect(rows[1]).toContain(
      '<td class="num">40</td><td class="num">87.5%</td><td class="num">0</td><td class="num">0%</td>',
    );
  });

  it('shows a dash for an old entry without the field', async () => {
    const old = run({
      id: 'old',
      recordedAt: '2026-02-01T00:00:00.000Z',
      counts: {
        features: 1,
        scenarios: counts({ total: 4, passed: 3, failed: 1 }),
        steps: counts(),
      },
    });
    const current = run({
      id: 'new',
      recordedAt: '2026-03-01T00:00:00.000Z',
      flaky: 2,
      counts: {
        features: 1,
        scenarios: counts({ total: 4, passed: 3, failed: 1 }),
        steps: counts(),
      },
    });

    const rows = tableRows(trendsPanel(await renderTrends([old, current])));

    expect(rows[0]).toContain(
      '<td class="num">75%</td><td class="num">2</td><td class="num">50%</td>',
    );
    expect(rows[1]).toContain(
      '<td class="num">75%</td><td class="num">—</td><td class="num">—</td>',
    );
  });

  it('shows a dash when nothing was attempted', async () => {
    const skipped = run({
      id: 'skipped',
      recordedAt: '2026-03-01T00:00:00.000Z',
      status: 'skipped',
      flaky: 0,
      counts: {
        features: 1,
        scenarios: counts({ total: 4, passed: 0, skipped: 4 }),
        steps: counts({ total: 4, passed: 0, skipped: 4 }),
      },
    });
    const empty = run({
      id: 'empty',
      recordedAt: '2026-02-01T00:00:00.000Z',
      counts: {
        features: 0,
        scenarios: counts({ total: 0, passed: 0 }),
        steps: counts({ total: 0, passed: 0 }),
      },
    });

    const rows = tableRows(trendsPanel(await renderTrends([empty, skipped])));

    expect(rows[0]).toContain('<td class="num">0</td><td class="num">—</td>');
    expect(rows[1]).toContain('<td class="num">—</td><td class="num">—</td>');
  });

  it('renders a positive share below 0.1% as a less-than boundary', async () => {
    const tiny = run({
      id: 'tiny',
      recordedAt: '2026-03-01T00:00:00.000Z',
      flaky: 1,
      counts: {
        features: 1,
        scenarios: counts({ total: 2001, passed: 2000, failed: 1 }),
        steps: counts(),
      },
    });

    const english = trendsPanel(await renderTrends([tiny, run({ id: 'b' })]));
    const englishRow = tableRows(english)[0] ?? '';
    expect(englishRow).toContain('<td class="num">1</td>');
    // Catalog messages stay HTML-free, so &lt; is the rendered < sign.
    expect(englishRow).toContain('<td class="num">&lt;0.1%</td>');
    expect(englishRow).not.toMatch(/<td class="num">0%<\/td>/);

    const german = trendsPanel(
      await renderLocalizedTrends([tiny, run({ id: 'b' })], 'de'),
    );
    const expected = new Intl.NumberFormat('de', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(0.001);
    expect(tableRows(german)[0]).toContain(
      `<td class="num">&lt;${expected}</td>`,
    );
  });

  it('renders 1 in 1001 as below the 0.1 percent boundary', async () => {
    const tiny = run({
      id: 'tiny',
      recordedAt: '2026-03-01T00:00:00.000Z',
      flaky: 1,
      counts: {
        features: 1,
        scenarios: counts({ total: 1001, passed: 1000, failed: 1 }),
        steps: counts(),
      },
    });

    const row =
      tableRows(trendsPanel(await renderTrends([tiny, run({ id: 'b' })])))[0] ??
      '';
    expect(row).toContain(
      '<td class="num">1</td><td class="num">&lt;0.1%</td>',
    );
  });

  it('renders 1 in 1000 as exactly 0.1 percent', async () => {
    const tiny = run({
      id: 'tiny',
      recordedAt: '2026-03-01T00:00:00.000Z',
      flaky: 1,
      counts: {
        features: 1,
        scenarios: counts({ total: 1000, passed: 999, failed: 1 }),
        steps: counts(),
      },
    });

    const row =
      tableRows(trendsPanel(await renderTrends([tiny, run({ id: 'b' })])))[0] ??
      '';
    expect(row).toContain('<td class="num">1</td><td class="num">0.1%</td>');
    expect(row).not.toContain('&lt;0.1%');
  });

  it('clamps an above-attempted API history count and share to attempted', async () => {
    const hostile = run({
      id: 'hostile',
      recordedAt: '2026-03-01T00:00:00.000Z',
      flaky: 5,
      counts: {
        features: 1,
        scenarios: counts({ total: 2, passed: 2 }),
        steps: counts({ total: 2, passed: 2 }),
      },
    });

    const panel = trendsPanel(
      await renderTrends([
        run({ id: 'old', recordedAt: '2026-02-01T00:00:00.000Z' }),
        hostile,
      ]),
    );

    expect(panel).toContain('<td class="num">2</td><td class="num">100%</td>');
    expect(panel).not.toContain('<td class="num">5</td>');
    expect(panel).not.toContain('250%');
  });

  it('explains the count as a proxy in English and German', async () => {
    const en = await catalogMessages('en');
    const de = await catalogMessages('de');

    const history = [
      run({ id: 'old', recordedAt: '2026-02-01T00:00:00.000Z' }),
      run({
        id: 'new',
        recordedAt: '2026-03-01T00:00:00.000Z',
        flaky: 2,
        counts: {
          features: 1,
          scenarios: counts({ total: 42, passed: 38, failed: 2, skipped: 2 }),
          steps: counts(),
        },
      }),
    ];

    const english = trendsPanel(await renderTrends(history));
    expect(english).toContain(en['trends.flakyNote']);
    expect(numericHeaders(english)).toContain(en['trends.flaky']);
    expect(numericHeaders(english)).toContain(en['trends.flakyShare']);

    const german = trendsPanel(await renderLocalizedTrends(history, 'de'));
    expect(german).toContain(de['trends.flakyNote']);
    expect(numericHeaders(german)).toContain(de['trends.flaky']);
    expect(numericHeaders(german)).toContain(de['trends.flakyShare']);
    expect(german).toContain(
      new Intl.NumberFormat('de', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(0.05),
    );
  });
});
