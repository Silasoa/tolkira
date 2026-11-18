import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';

const runRatioFixture = fileURLToPath(
  new URL('./fixtures/messages/run-ratio.ndjson', import.meta.url),
);
const skippedOnlyFixture = fileURLToPath(
  new URL('./fixtures/messages/skipped-only.ndjson', import.meta.url),
);
const emptyFixture = fileURLToPath(
  new URL('./fixtures/messages/empty.ndjson', import.meta.url),
);
const emptyStatusesFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-statuses.ndjson', import.meta.url),
);
const screenshotFixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);

function reportMeta(html: string): string {
  const start = html.indexOf('<p class="meta">');
  return html.slice(start, html.indexOf('</p>', start));
}

function healthTops(html: string): string[] {
  return [...html.matchAll(/<div class="healthTop">([\s\S]*?)<\/div>/g)].map(
    (match) => match[1] ?? '',
  );
}

function featureList(html: string): string {
  return html.slice(
    html.indexOf('id="feature-list"'),
    html.indexOf('id="empty-results"'),
  );
}

function analysisView(html: string): string {
  return html.slice(html.indexOf('id="analysis-view"'));
}

describe('run presentation counts', () => {
  it('computes the pass ratio over attempted scenarios', async () => {
    const html = await renderReport(runRatioFixture, { title: 'Run ratio' });
    const meta = reportMeta(html);
    const [reportHealth, detailsHealth] = healthTops(html);

    expect(meta).toContain('3 scenarios with results');
    expect(reportHealth).toContain('<strong>50%</strong>');
    expect(reportHealth).toContain('1 / 2 attempted');
    expect(reportHealth).toContain('1 of 2 attempted scenarios passed');
    expect(detailsHealth).toContain('<strong>50%</strong>');
    expect(detailsHealth).toContain('1 / 2 attempted');
    expect(html).toContain('1 passed of 2 attempted · 1 failed, 1 skipped');
    expect(html).toContain('<b>1</b> skipped');

    const list = featureList(html);
    expect(list).toContain('<i class="skipped"');
    expect(html).toContain(
      'Pass rate counts attempted (non-skipped) scenarios; counts and bars include skipped.',
    );
  });

  it('shows no ratio when every reported scenario is skipped', async () => {
    const html = await renderReport(skippedOnlyFixture, {
      title: 'Skipped only',
    });
    const [reportHealth, detailsHealth] = healthTops(html);

    for (const health of [reportHealth, detailsHealth]) {
      expect(health).toContain('No scenarios attempted');
      expect(health).not.toContain('%');
      expect(health).not.toMatch(/\d+ \/ \d+/);
    }
    expect(html).toMatch(/skipped[^.]*not pass attempts/i);
    expect(html).toContain('<b>1</b> skipped');
    expect(featureList(html)).toContain('0 of 0 passed');
  });

  it('keeps 0% and 0 / 0 for an empty run', async () => {
    const html = await renderReport(emptyFixture, { title: 'Empty run' });
    const [reportHealth] = healthTops(html);

    expect(reportHealth).toBeDefined();
    expect(reportHealth).toContain('<strong>0%</strong>');
    expect(reportHealth).toContain('0 / 0');
  });

  it('names reported results and unexecuted rows in the header', async () => {
    const mixed = await renderReport(emptyStatusesFixture, {
      title: 'Mixed statuses',
    });
    const mixedMeta = reportMeta(mixed);

    expect(mixedMeta).toContain('2 scenarios with results');
    expect(mixedMeta).toContain('1 unexecuted');
    expect(mixedMeta).not.toContain('executed scenario');

    const all = await renderReport(screenshotFixture, { title: 'All results' });
    const allMeta = reportMeta(all);

    expect(allMeta).toContain('2 scenarios with results');
    expect(allMeta).not.toContain('unexecuted');
  });

  it('labels the environment, run time and scenario time', async () => {
    const html = await renderReport(screenshotFixture, { title: 'Labels' });
    const details = analysisView(html);
    const meta = reportMeta(html);

    expect(details).toContain('Run environment');
    expect(details).not.toContain('Cucumber environment');
    expect(details).toContain('<dt>Test time</dt>');
    expect(details).toContain('<th>Scenario time</th>');
    expect(details).toContain(
      'Test time sums the final attempt per scenario and test-run hooks; Scenario time sums the final attempt per scenario. Neither is wall-clock time.',
    );
    expect(meta).toContain('Test time');
    expect(meta).toContain(
      'title="Sum of the final attempt per scenario and run hooks"',
    );
  });
});
