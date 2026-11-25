import { afterEach, describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { renderBaselinePanel } from '../src/render/baseline.js';
import { createTranslator } from '../src/render/i18n.js';
import { BASELINE_CSS, REPORT_CSS } from '../src/render/styles.js';
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
  type BaselineCounts,
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
    expect(slice).toContain('<li><b>2</b> New failures</li>');
    expect(slice).toContain('<li><b>1</b> Fixed</li>');
    expect(slice).toContain('<li><b>3</b> Still failing</li>');
    expect(slice).toContain('<li><b>1</b> Not in this run</li>');
    expect(slice).not.toContain('Ambiguous group');
    expect(slice).not.toContain('Added');
    expect(slice).toContain(
      '<span class="baselineFeature">Checkout</span> · <span class="baselineName">gone one</span>',
    );
    expect(slice).toMatch(/statusText fail">Failed/);
    expect(slice).not.toContain('<a ');
  });

  it('shows a not-in-this-run row with its feature, name, example and status', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'example.json', mixedFeatures());
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Checkout',
          name: 'pays by card',
          uri: MIXED_URI,
          status: 'failed',
          executed: true,
          example: '#1.2',
        },
      ],
    };

    const html = await render(file, baseline);
    const slice = panelSlice(html);

    expect(slice).toContain(
      '<span class="baselineFeature">Checkout</span> · <span class="baselineName">pays by card</span> <span class="baselineExample">#1.2</span>',
    );
    expect(slice).toContain('statusText fail">Failed');
    expect(slice).toContain('<li><b>1</b> Not in this run</li>');
  });

  it('omits the heading and list when no baseline row is absent', async () => {
    const { file, baseline } = await badgeRun();
    const html = await render(file, baseline);
    const slice = panelSlice(html);

    expect(slice).toContain('<li><b>0</b> Not in this run</li>');
    expect(slice).not.toContain('<h3>');
    expect(slice).not.toContain('class="baselineList"');
    expect(slice).not.toContain('Ambiguous group');
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
    expect(slice).toContain(
      '5 more scenarios are in the JSON summary; use --json.',
    );
    expect(slice).not.toContain('<button');
    expect(slice).not.toContain('<a ');
  });

  it('states the JSON cap honestly when more than 50 rows are absent', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const absent: BaselineScenario[] = Array.from({ length: 60 }, (_, index) => ({
      feature: 'Checkout',
      name: `entry ${String(index).padStart(2, '0')}`,
      uri: MIXED_URI,
      status: 'failed',
      executed: true,
    }));

    const html = await render(file, {
      schemaVersion: 2,
      status: 'failed',
      scenarios: absent,
    });
    const slice = panelSlice(html);

    expect(slice).toContain('<li><b>60</b> Not in this run</li>');
    expect(slice).toContain(
      '40 more scenarios are in the JSON summary of 60 (up to 50); 10 are only counted. Use --json.',
    );
    expect(slice).not.toContain('entry 10');
    expect(slice).not.toContain('<a ');
  });

  it('shows the new-failure and fixed badges only on their rows', async () => {
    const { file, baseline } = await badgeRun();
    const html = await render(file, baseline);
    const uri = 'features/badges.feature';

    expect(scenarioSummaryFor(html, uri, 'turns red')).toMatch(/new failure/i);
    expect(scenarioSummaryFor(html, uri, 'turns green')).toMatch(/fixed/i);
    const stillFailing = scenarioSummaryFor(html, uri, 'stays red');
    expect(stillFailing).not.toMatch(/new failure|fixed/i);
    expect(stillFailing).not.toContain('class="changeBadge"');
    const added = scenarioSummaryFor(html, uri, 'appears');
    expect(added).not.toMatch(/new failure|fixed/i);
    expect(added).not.toContain('class="changeBadge"');
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

    expect(slice).toContain('Vergleich mit Baseline');
    expect(slice).toContain('Baseline-Status: Fehlgeschlagen');
    expect(slice).toContain('Neue Fehler');
    expect(slice).toContain('Behoben');
    expect(slice).toContain('Weiterhin fehlgeschlagen');
    expect(slice).toContain('Nicht in diesem Lauf');
    expect(slice).not.toContain('Compared with baseline');
    expect(slice).not.toContain('Baseline status:');
    expect(slice).not.toContain('New failures');
    expect(slice).not.toContain('Not in this run');
    const text = slice.replaceAll(/<[^>]*>/g, ' ').replaceAll(/\s+/g, ' ');
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

  it('renders the German capped JSON pointer after 50 absent rows', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const absent: BaselineScenario[] = Array.from({ length: 60 }, (_, index) => ({
      feature: 'Checkout',
      name: `entry ${String(index).padStart(2, '0')}`,
      uri: MIXED_URI,
      status: 'failed',
      executed: true,
    }));

    const html = await render(
      file,
      { schemaVersion: 2, status: 'failed', scenarios: absent },
      { locale: 'de' },
    );
    const slice = panelRegion(html);

    expect(slice).toContain('Vergleich mit Baseline');
    expect(slice).toContain('Baseline-Status: Fehlgeschlagen');
    expect(slice).toContain(
      '40 weitere Szenarien stehen in der JSON-Zusammenfassung von 60 (bis zu 50); 10 werden nur gezählt. Siehe --json.',
    );
    expect(slice).not.toContain('Compared with baseline');
    expect(slice).not.toContain('Baseline status:');
    expect(slice).not.toContain('New failures');
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

  function panelFor(
    locale: string,
    counts: Partial<BaselineCounts>,
  ): string {
    return renderBaselinePanel(
      {
        block: {
          status: 'failed',
          counts: {
            newFailures: 0,
            fixed: 0,
            stillFailing: 0,
            other: 0,
            notInThisRun: 0,
            added: 0,
            ambiguous: 0,
            ...counts,
          },
          notInThisRun: [],
        },
        changes: new Map(),
      },
      createTranslator(locale),
    );
  }

  it.each([
    ['en', 0, 'New failures'],
    ['en', 1, 'New failure'],
    ['en', 2, 'New failures'],
    ['de', 0, 'Neue Fehler'],
    ['de', 1, 'Neuer Fehler'],
    ['de', 2, 'Neue Fehler'],
  ])('pluralizes the new-failure count %i in %s', (locale, count, label) => {
    expect(panelFor(locale, { newFailures: count })).toContain(
      `<li><b>${count}</b> ${label}</li>`,
    );
  });

  it.each([
    ['en', 1, 'Ambiguous group'],
    ['en', 2, 'Ambiguous groups'],
    ['de', 1, 'Mehrdeutige Gruppe'],
    ['de', 2, 'Mehrdeutige Gruppen'],
  ])('pluralizes the ambiguous count %i in %s', (locale, count, label) => {
    expect(panelFor(locale, { ambiguous: count })).toContain(
      `<li><b>${count}</b> ${label}</li>`,
    );
  });

  it('hides the ambiguous count at zero in both locales', () => {
    expect(panelFor('en', { ambiguous: 0 })).not.toContain('Ambiguous');
    expect(panelFor('de', { ambiguous: 0 })).not.toContain('Mehrdeutig');
  });

  it('strips controls, ANSI and bidi marks from baseline text', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Check\u0007out',
          name: 'pays\u0000\u001b[31m by\u202E card',
          uri: 'features/control.feature',
          status: 'failed',
          executed: true,
          example: '#1.\u00002',
        },
      ],
    };

    const html = await render(file, baseline);
    const slice = panelSlice(html);

    expect(slice).toContain(
      '<span class="baselineFeature">Checkout</span> · <span class="baselineName">pays by card</span> <span class="baselineExample">#1.2</span>',
    );
    // oxlint-disable-next-line no-control-regex
    expect(slice).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202e]/);
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
    expect(style).toBe(REPORT_CSS + BASELINE_CSS);
    expect(style).toContain('.baselinePanel{');
  });

  it('keeps the baseline CSS in the first style block when an accent is set', async () => {
    const { file, baseline } = await mixedRun();
    const html = await render(file, baseline, { accent: '#123456' });
    const style = styleBlock(html);

    expect(style).toBe(`${REPORT_CSS}:root{--accent:#123456}${BASELINE_CSS}`);
    expect(html.match(/<style>/g) ?? []).toHaveLength(1);
    expect(style.endsWith(BASELINE_CSS)).toBe(true);
  });

  it('renders no panel without a baseline', async () => {
    const { file } = await mixedRun();
    const html = await render(file);

    expect(html).not.toContain('Compared with baseline');
    expect(html).not.toContain('Not in this run');
    expect(html).not.toContain('new-failure');
  });
});
