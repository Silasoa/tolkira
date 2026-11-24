import { afterEach, describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { REPORT_CSS } from '../src/render/styles.js';
import {
  cleanupTempDirs,
  makeTempDir,
  mixedBaseline,
  mixedFeatures,
  panelRegion,
  panelSlice,
  scenarioSummaryFor,
  styleBlock,
  writeLegacyRun,
  type BaselineRenderOptions,
  type BaselineScenario,
  type BaselineSummary,
} from './baseline-helpers.js';

afterEach(cleanupTempDirs);

const MIXED_URI = 'features/checkout.feature';

async function mixedRun(): Promise<{ file: string; baseline: BaselineSummary }> {
  const dir = await makeTempDir();
  return {
    file: await writeLegacyRun(dir, 'mixed.json', mixedFeatures()),
    baseline: mixedBaseline(),
  };
}

async function render(
  file: string,
  baseline?: BaselineSummary,
  extra: Partial<BaselineRenderOptions> = {},
): Promise<string> {
  const options: BaselineRenderOptions = { title: 'Baseline', ...extra };
  if (baseline) options.baseline = baseline;
  return renderReport(file, options);
}

async function badgeRun(): Promise<{ file: string; baseline: BaselineSummary }> {
  const dir = await makeTempDir();
  const file = await writeLegacyRun(dir, 'badges.json', [
    {
      name: 'Badges',
      uri: 'features/badges.feature',
      scenarios: [
        { name: 'turns red', status: 'failed' },
        { name: 'turns green', status: 'passed' },
        { name: 'stays red', status: 'failed' },
        { name: 'appears', status: 'passed' },
      ],
    },
  ]);
  const baseline: BaselineSummary = {
    schemaVersion: 2,
    status: 'failed',
    scenarios: [
      {
        feature: 'Badges',
        name: 'turns red',
        uri: 'features/badges.feature',
        status: 'passed',
        executed: true,
      },
      {
        feature: 'Badges',
        name: 'turns green',
        uri: 'features/badges.feature',
        status: 'failed',
        executed: true,
      },
      {
        feature: 'Badges',
        name: 'stays red',
        uri: 'features/badges.feature',
        status: 'failed',
        executed: true,
      },
    ],
  };
  return { file, baseline };
}

describe('baseline report panel', () => {
  it('sits after the toolbar and live region and before needs attention', async () => {
    const { file, baseline } = await mixedRun();
    const html = await render(file, baseline);

    const toolbar = html.indexOf('class="toolbar"');
    const live = html.indexOf('id="tolkira-live"');
    const panel = html.indexOf('Compared with baseline');
    const triage = html.indexOf('data-triage');

    expect(toolbar).toBeGreaterThan(-1);
    expect(live).toBeGreaterThan(toolbar);
    expect(panel, 'panel').toBeGreaterThan(live);
    expect(triage, 'triage').toBeGreaterThan(panel);

    const slice = panelSlice(html);
    expect(slice).toContain('Failed');
    expect(slice).toContain('Not in this run');
    expect(slice).toContain('gone one');
    expect(slice).not.toContain('<a ');
  });

  it('lists at most ten not-in-this-run rows and points to --json for the rest', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const letters = 'abcdefghijklmno';
    const absent: BaselineScenario[] = Array.from({ length: 15 }, (_, index) => ({
      feature: 'Checkout',
      name: `entry ${letters[index]}`,
      uri: MIXED_URI,
      status: 'failed',
      executed: true,
    }));
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: absent,
    };

    const html = await render(file, baseline);
    const slice = panelSlice(html);

    for (let index = 0; index < 10; index += 1) {
      expect(slice, `row ${letters[index]}`).toContain(`entry ${letters[index]}`);
    }
    expect(slice).not.toContain('entry k');
    expect(slice).toContain('15');
    // The complete count is 15; the standalone 5 is the remainder line.
    expect(slice).toMatch(/(?<!1)5/);
    expect(slice).toContain('--json');
    expect(slice).not.toContain('<button');
    expect(slice).not.toContain('<a ');
  });

  it('shows the new-failure and fixed badges only on their rows', async () => {
    const { file, baseline } = await badgeRun();
    const html = await render(file, baseline);
    const uri = 'features/badges.feature';

    expect(scenarioSummaryFor(html, uri, 'turns red')).toMatch(/new failure/i);
    expect(scenarioSummaryFor(html, uri, 'turns green')).toMatch(/fixed/i);
    expect(scenarioSummaryFor(html, uri, 'stays red')).not.toMatch(
      /new failure|fixed/i,
    );
    expect(scenarioSummaryFor(html, uri, 'appears')).not.toMatch(
      /new failure|fixed/i,
    );
  });

  it('joins rows by the pickle id, not by a repeated name', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'duplicates.json', [
      {
        name: 'Duplicates',
        uri: 'features/a.feature',
        scenarios: [{ name: 'pays', status: 'failed' }],
      },
      {
        name: 'Duplicates',
        uri: 'features/b.feature',
        scenarios: [{ name: 'pays', status: 'failed' }],
      },
    ]);
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Duplicates',
          name: 'pays',
          uri: 'features/a.feature',
          status: 'passed',
          executed: true,
        },
        {
          feature: 'Duplicates',
          name: 'pays',
          uri: 'features/b.feature',
          status: 'failed',
          executed: true,
        },
      ],
    };

    const html = await render(file, baseline);

    expect(
      scenarioSummaryFor(html, 'features/a.feature', 'pays'),
    ).toMatch(/new failure/i);
    expect(
      scenarioSummaryFor(html, 'features/b.feature', 'pays'),
    ).not.toMatch(/new failure|fixed/i);
  });

  it('localizes the panel and the badges in German', async () => {
    const { file, baseline } = await mixedRun();
    const html = await render(file, baseline, { locale: 'de' });
    const slice = panelRegion(html);

    expect(slice).toContain('Baseline');
    expect(slice).toContain('Neuer Fehler');
    expect(slice).toContain('Behoben');
    expect(slice).toContain('Weiterhin fehlgeschlagen');
    expect(slice).toContain('Nicht in diesem Lauf');
    const text = slice.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    for (const count of ['2', '1', '3', '1']) {
      expect(text, `panel count ${count}`).toContain(count);
    }

    const badges = await badgeRun();
    const badgeHtml = await render(badges.file, badges.baseline, {
      locale: 'de',
    });
    expect(
      scenarioSummaryFor(badgeHtml, 'features/badges.feature', 'turns red'),
    ).toContain('Neuer Fehler');
    expect(
      scenarioSummaryFor(badgeHtml, 'features/badges.feature', 'turns green'),
    ).toContain('Behoben');
  });

  it('shows the German ambiguous group label only when a group is ambiguous', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'ambiguous.json', [
      {
        name: 'Doppelt',
        uri: 'features/dup.feature',
        scenarios: [
          { name: 'pays', status: 'failed' },
          { name: 'pays', status: 'passed' },
        ],
      },
    ]);
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Doppelt',
          name: 'pays',
          uri: 'features/dup.feature',
          status: 'failed',
          executed: true,
        },
        {
          feature: 'Doppelt',
          name: 'pays',
          uri: 'features/dup.feature',
          status: 'passed',
          executed: true,
        },
      ],
    };

    const html = await render(file, baseline, { locale: 'de' });
    const slice = panelRegion(html);

    expect(slice).toContain('Mehrdeutige Gruppe');
    expect(slice).toMatch(/1/);
  });

  it('escapes hostile baseline text and adds no link', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: '"><img src=x onerror=alert(1)>',
          name: '<script>alert(1)</script>',
          uri: 'features/hostile.feature',
          status: 'failed',
          executed: true,
        },
      ],
    };

    const html = await render(file, baseline);
    const slice = panelSlice(html);

    expect(slice).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(slice).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(slice).not.toContain('<script>alert(1)</script>');
    expect(slice).not.toContain('<img src=x');
    expect(slice).not.toContain('<a ');
  });

  it('keeps the panel in the static no-script form', async () => {
    const { file, baseline } = await mixedRun();
    const html = await render(file, baseline, { static: true });

    expect(/<script\b/i.test(html)).toBe(false);
    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(panelSlice(html)).toContain('Not in this run');
  });

  it('appends the baseline CSS only when a baseline is supplied', async () => {
    const { file, baseline } = await mixedRun();
    const plain = await render(file);
    const compared = await render(file, baseline);

    expect(styleBlock(plain)).toBe(REPORT_CSS);
    const style = styleBlock(compared);
    expect(style.startsWith(REPORT_CSS)).toBe(true);
    expect(style.length).toBeGreaterThan(REPORT_CSS.length);
  });

  it('renders no panel without a baseline', async () => {
    const { file } = await mixedRun();
    const html = await render(file);

    expect(html).not.toContain('Compared with baseline');
    expect(html).not.toContain('Not in this run');
    expect(html).not.toContain('new-failure');
  });
});
