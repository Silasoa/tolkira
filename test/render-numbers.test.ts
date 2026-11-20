import { beforeAll, describe, expect, it } from 'vitest';
import type { HistoryRun } from '../src/history.js';
import { renderHtml } from '../src/render/html.js';
import type { StatusCounts } from '../src/summary.js';
import { syntheticRun } from './render-helpers.js';

const TOTAL = 1234;
const envelopes = syntheticRun([
  {
    name: 'Großes Feature',
    scenarios: Array.from({ length: TOTAL }, (_, index) => ({
      name: `Fehler ${index + 1}`,
      status: 'failed',
    })),
  },
]);

function view(html: string, id: string, next: string): string {
  const start = html.indexOf(`id="${id}"`);
  expect(start, id).toBeGreaterThan(-1);
  const end = html.indexOf(next, start);
  return html.slice(start, end === -1 ? undefined : end);
}

function counts(overrides: Partial<StatusCounts> = {}): StatusCounts {
  return {
    total: TOTAL,
    passed: 0,
    failed: TOTAL,
    skipped: 0,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
    ...overrides,
  };
}

const largeRun = (id: string, recordedAt: string): HistoryRun => ({
  id,
  recordedAt,
  title: 'Großer Lauf',
  status: 'failed',
  counts: {
    features: 1,
    scenarios: counts({ passed: TOTAL, failed: 0 }),
    steps: counts({ passed: TOTAL, failed: 0 }),
  },
  durationMs: 1234,
  attachments: { total: 0, bytes: 0 },
});

const history: HistoryRun[] = [
  largeRun('large-run-1', '2026-01-01T00:00:00.000Z'),
  largeRun('large-run-2', '2026-01-02T00:00:00.000Z'),
];

describe('visible count formatting', () => {
  let german = '';
  let english = '';

  beforeAll(async () => {
    german = await renderHtml(envelopes, {
      title: 'Große Zahlen',
      locale: 'de',
      history,
    });
    english = await renderHtml(envelopes, {
      title: 'Large counts',
      history,
    });
  });

  it('formats German health, pills, filters and triage in the Report view', () => {
    const report = view(german, 'report-view', 'id="analysis-view"');

    expect(report).toContain('0 / 1.234 ausgeführt');
    expect(report).toContain('<b>1.234</b> fehlgeschlagen');
    expect(report).toContain('Fehlgeschlagen <b>1.234</b>');
    expect(report).toContain('0 von 1.234 bestanden');
    expect(report).toContain('1.234 fehlgeschlagen');
    expect(report).toContain(
      '1.234 von 1.234 Szenarien brauchen Aufmerksamkeit.',
    );
  });

  it('formats the German matrix, legend and run panel in Details', () => {
    const details = view(german, 'analysis-view', 'id="trends-view"');

    expect(details).toContain('<td class="num">1.234</td>');
    expect(details).toContain(
      '<div class="legendRow fail"><span class="marker fail"></span><span>Fehlgeschlagen</span><b>1.234</b></div>',
    );
    expect(details).toContain('<dt>Szenarien</dt><dd>1.234</dd>');
  });

  it('formats the German Trends count columns', () => {
    const trends = view(german, 'trends-view', '<dialog');
    const row = trends.slice(trends.indexOf('<tbody>'));

    expect(row).toContain('<td class="num">1.234</td>');
  });

  it('keeps English counts raw', () => {
    expect(english).toContain('0 / 1234 attempted');
    expect(english).toContain('<b>1234</b> failed');
    expect(english).toContain('Failed <b>1234</b>');
    expect(english).toContain('<td class="num">1234</td>');
    expect(english).toContain('1234 of 1234 scenarios need attention.');
    expect(english).not.toContain('1.234');
  });
});
