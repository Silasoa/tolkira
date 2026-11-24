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

function view(html: string, id: string): string {
  const start = html.indexOf(`id="${id}"`);
  expect(start, id).toBeGreaterThan(-1);
  const next = ['analysis-view', 'trends-view', 'tolkira-lightbox']
    .map((other) => html.indexOf(`id="${other}"`, start + 1))
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];
  return html.slice(start, next ?? html.length);
}

describe('default report main landmark', () => {
  it('renders exactly one main inside the Report view without history', async () => {
    const html = await renderReport(fixture, { title: 'One main' });

    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    const mainStart = html.search(/<main\b/);
    const reportStart = html.indexOf('id="report-view"');
    const analysisStart = html.indexOf('id="analysis-view"');
    expect(mainStart).toBeGreaterThan(reportStart);
    expect(mainStart).toBeLessThan(analysisStart);

    expect(view(html, 'analysis-view')).not.toContain('<main');
    expect(html).not.toContain('id="trends-view"');
    expect(html.match(/\brole="tab"/g) ?? []).toHaveLength(2);
    expect(html).toContain('>Report</button>');
    expect(html).toContain('>Details</button>');
  });

  it('keeps the Details panel contract without a main', async () => {
    const html = await renderReport(fixture, { title: 'Panel contract' });
    const analysis = openingTag(html, 'id="analysis-view"');

    expect(analysis).toContain('class="tabPanel"');
    expect(analysis).toContain('role="tabpanel"');
    expect(analysis).toContain('aria-labelledby="view-analysis"');
    expect(analysis).toContain('tabindex="0"');
    expect(analysis).toContain('hidden');
    expect(view(html, 'analysis-view')).toContain('class="shell analysis"');
    expect(view(html, 'analysis-view')).not.toContain('<main');
  });

  it('renders one main, three tabpanels and the three view ids with Trends', async () => {
    const history = await readHistory(historyFile);
    const html = await renderReport(fixture, { title: 'Three views', history });

    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(html.match(/\brole="tabpanel"/g) ?? []).toHaveLength(3);
    for (const id of ['report-view', 'analysis-view', 'trends-view']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(view(html, 'analysis-view')).not.toContain('<main');
    expect(view(html, 'trends-view')).not.toContain('<main');
    const trendsPanel = openingTag(html, 'id="trends-view"');
    expect(trendsPanel).toContain('class="tabPanel"');
    expect(trendsPanel).toContain('role="tabpanel"');
    expect(trendsPanel).toContain('aria-labelledby="view-trends"');
    expect(trendsPanel).toContain('tabindex="0"');
    expect(trendsPanel).toContain('hidden');
    expect(view(html, 'trends-view')).toContain('class="shell analysis"');
    expect(html).toContain('>Trends</button>');
  });

  it('orders the main landmark and the three views', async () => {
    const history = await readHistory(historyFile);
    const html = await renderReport(fixture, { title: 'Order', history });

    const main = html.search(/<main\b/);
    const report = html.indexOf('id="report-view"');
    const analysis = html.indexOf('id="analysis-view"');
    const trends = html.indexOf('id="trends-view"');
    expect(main).toBeGreaterThan(report);
    expect(main).toBeLessThan(analysis);
    expect(analysis).toBeLessThan(trends);

    const reportHeading = html.indexOf('<h1>', report);
    const analysisHeading = html.indexOf('<h1>', analysis);
    const trendsHeading = html.indexOf('<h1>', trends);
    expect(reportHeading).toBeLessThan(analysisHeading);
    expect(analysisHeading).toBeLessThan(trendsHeading);
    expect(html.slice(report, analysis)).not.toContain('<main');
  });

  it('keeps one main and no tab roles in the static report', async () => {
    const history = await readHistory(historyFile);
    const html = await renderReport(fixture, {
      title: 'Static views',
      history,
      static: true,
    });

    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(html).not.toMatch(/\brole="tab(?:list|panel)?"/);
    for (const id of ['report-view', 'analysis-view', 'trends-view']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    for (const id of ['analysis-view', 'trends-view']) {
      expect(view(html, id)).not.toContain('<main');
    }
  });

  it('keeps the print page-break rule keyed by the view ids', () => {
    expect(REPORT_CSS).toContain(
      '#analysis-view,#trends-view{break-before:page}',
    );
  });
});
