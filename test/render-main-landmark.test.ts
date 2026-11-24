import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readHistory } from '../src/history.js';
import { renderReport } from '../src/index.js';
import { REPORT_CSS } from '../src/render/styles.js';
import { messagesFixture } from './fixtures.js';

const fixture = messagesFixture('screenshot.ndjson');
const historyFile = fileURLToPath(
  new URL('./fixtures/history/two-runs.json', import.meta.url),
);

function openingTag(html: string, marker: string): string {
  const index = html.indexOf(marker);
  expect(index, marker).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<', index);
  return html.slice(start, html.indexOf('>', index) + 1);
}

function mainBounds(html: string): {
  start: number;
  end: number;
  content: string;
} {
  const start = html.search(/<main\b/);
  expect(start, 'main start').toBeGreaterThan(-1);
  const end = html.indexOf('</main>', start);
  expect(end, 'main end').toBeGreaterThan(start);
  return { start, end, content: html.slice(start, end) };
}

function view(html: string, id: string): string {
  const start = html.indexOf(`id="${id}"`);
  expect(start, id).toBeGreaterThan(-1);
  const next = ['report-view', 'analysis-view', 'trends-view', 'tolkira-lightbox']
    .map((other) => html.indexOf(`id="${other}"`, start + 1))
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];
  return html.slice(start, next ?? html.length);
}

function runHeaders(html: string): number[] {
  return [...html.matchAll(/<header class="runHead">/g)].map(
    (match) => match.index ?? 0,
  );
}

function expectOnlySiteBanner(
  html: string,
  start: number,
  end: number,
): void {
  const outside = html.slice(0, start) + html.slice(end);
  expect(outside.match(/<header\b/g) ?? []).toHaveLength(1);
  expect(outside).toContain('<header class="topbar">');
}

describe('report main landmark', () => {
  it('renders one plain main before the Report view without history', async () => {
    const html = await renderReport(fixture, { title: 'One main' });
    const { start, end, content } = mainBounds(html);
    const reportStart = html.indexOf('id="report-view"');
    const analysisStart = html.indexOf('id="analysis-view"');

    expect(html.match(/<main>/g) ?? []).toHaveLength(1);
    expect(html.match(/<\/main>/g) ?? []).toHaveLength(1);
    expect(start).toBeLessThan(reportStart);
    expect(end).toBeGreaterThan(analysisStart);
    expect(content).toContain('id="report-view"');
    expect(content).toContain('id="analysis-view"');
    // The wrapper closes directly after the last present panel.
    expect(content.endsWith('</div></div>')).toBe(true);

    expect(view(html, 'analysis-view')).not.toContain('<main');
    expect(html).not.toContain('id="trends-view"');
    expect(html.match(/\brole="tab"/g) ?? []).toHaveLength(2);
    expect(html).toContain('>Report</button>');
    expect(html).toContain('>Details</button>');
  });

  it('keeps the site header as the only banner without history', async () => {
    const html = await renderReport(fixture, { title: 'Banners' });
    const { start, end } = mainBounds(html);
    const headers = runHeaders(html);

    expect(headers).toHaveLength(2);
    for (const index of headers) {
      expect(index).toBeGreaterThan(start);
      expect(index).toBeLessThan(end);
    }
    expectOnlySiteBanner(html, start, end);
  });

  it('keeps the Report and Details panel contract inside main', async () => {
    const html = await renderReport(fixture, { title: 'Panel contract' });
    const report = openingTag(html, 'id="report-view"');
    const analysis = openingTag(html, 'id="analysis-view"');

    expect(report).toContain('class="tabPanel"');
    expect(report).toContain('role="tabpanel"');
    expect(report).toContain('aria-labelledby="view-report"');
    expect(report).toContain('tabindex="0"');
    expect(report).not.toContain('hidden');
    expect(view(html, 'report-view')).toContain('<div class="shell">');
    expect(view(html, 'report-view')).not.toContain('<main');

    expect(analysis).toContain('class="tabPanel"');
    expect(analysis).toContain('role="tabpanel"');
    expect(analysis).toContain('aria-labelledby="view-analysis"');
    expect(analysis).toContain('tabindex="0"');
    expect(analysis).toContain('hidden');
    expect(view(html, 'analysis-view')).toContain('class="shell analysis"');
    expect(view(html, 'analysis-view')).not.toContain('<main');
  });

  it('wraps one main around all three tabpanels with Trends', async () => {
    const history = await readHistory(historyFile);
    const html = await renderReport(fixture, { title: 'Three views', history });
    const { start, end, content } = mainBounds(html);
    const report = html.indexOf('id="report-view"');
    const analysis = html.indexOf('id="analysis-view"');
    const trends = html.indexOf('id="trends-view"');

    expect(html.match(/<main>/g) ?? []).toHaveLength(1);
    expect(html.match(/\brole="tabpanel"/g) ?? []).toHaveLength(3);
    expect(start).toBeLessThan(report);
    expect(report).toBeLessThan(analysis);
    expect(analysis).toBeLessThan(trends);
    expect(trends).toBeLessThan(end);
    expect(content).toContain('id="trends-view"');

    for (const id of ['report-view', 'analysis-view', 'trends-view']) {
      expect(view(html, id)).not.toContain('<main');
    }

    const trendsPanel = openingTag(html, 'id="trends-view"');
    expect(trendsPanel).toContain('class="tabPanel"');
    expect(trendsPanel).toContain('role="tabpanel"');
    expect(trendsPanel).toContain('aria-labelledby="view-trends"');
    expect(trendsPanel).toContain('tabindex="0"');
    expect(trendsPanel).toContain('hidden');
    expect(view(html, 'trends-view')).toContain('class="shell analysis"');
    expect(html).toContain('>Trends</button>');
  });

  it('orders the main landmark, the three views and their run headers', async () => {
    const history = await readHistory(historyFile);
    const html = await renderReport(fixture, { title: 'Order', history });
    const { start, end } = mainBounds(html);

    const report = html.indexOf('id="report-view"');
    const analysis = html.indexOf('id="analysis-view"');
    const trends = html.indexOf('id="trends-view"');
    expect(start).toBeLessThan(report);
    expect(report).toBeLessThan(analysis);
    expect(analysis).toBeLessThan(trends);
    expect(trends).toBeLessThan(end);

    const reportHeading = html.indexOf('<h1>', report);
    const analysisHeading = html.indexOf('<h1>', analysis);
    const trendsHeading = html.indexOf('<h1>', trends);
    expect(reportHeading).toBeLessThan(analysisHeading);
    expect(analysisHeading).toBeLessThan(trendsHeading);

    const headers = runHeaders(html);
    expect(headers).toHaveLength(3);
    for (const index of headers) {
      expect(index).toBeGreaterThan(start);
      expect(index).toBeLessThan(end);
    }
    expectOnlySiteBanner(html, start, end);
  });

  it('uses the same wrapper and no tab roles in the static report', async () => {
    const history = await readHistory(historyFile);
    const html = await renderReport(fixture, {
      title: 'Static views',
      history,
      static: true,
    });
    const { start, end, content } = mainBounds(html);

    expect(html.match(/<main>/g) ?? []).toHaveLength(1);
    expect(html).not.toMatch(/\brole="tab(?:list|panel)?"/);
    for (const id of ['report-view', 'analysis-view', 'trends-view']) {
      expect(html, id).toContain(`id="${id}"`);
      expect(content, `${id} in main`).toContain(`id="${id}"`);
      expect(view(html, id)).not.toContain('<main');
    }
    expect(content.indexOf('id="report-view"')).toBeLessThan(
      content.indexOf('id="analysis-view"'),
    );
    expect(content.indexOf('id="analysis-view"')).toBeLessThan(
      content.indexOf('id="trends-view"'),
    );

    expect(view(html, 'report-view')).toContain('<div class="shell">');
    expect(view(html, 'analysis-view')).toContain('class="shell analysis"');
    expect(view(html, 'trends-view')).toContain('class="shell analysis"');
    for (const id of ['report-view', 'analysis-view', 'trends-view']) {
      const tag = openingTag(html, `id="${id}"`);
      expect(tag, id).toContain('class="tabPanel"');
      expect(tag, id).not.toContain('role=');
      expect(tag, id).not.toContain('tabindex=');
      expect(tag, id).not.toContain('hidden');
    }

    const headers = runHeaders(html);
    expect(headers).toHaveLength(3);
    for (const index of headers) {
      expect(index).toBeGreaterThan(start);
      expect(index).toBeLessThan(end);
    }
    expectOnlySiteBanner(html, start, end);
  });

  it('keeps the print page-break rule keyed by the view ids', () => {
    expect(REPORT_CSS).toContain(
      '#analysis-view,#trends-view{break-before:page}',
    );
  });
});
