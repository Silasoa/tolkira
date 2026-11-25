import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  renderEmail,
  renderReport,
  summarizeReport,
} from '../src/index.js';
import { formatCiOutput } from '../src/ci.js';
import { REPORT_CSS } from '../src/render/styles.js';
import { scenarioOpeningTag, scenarioSummary } from './render-helpers.js';

const FLAKY_NAME = 'passes on retry';
const LEGACY_NAME = 'legacy tagged pass';
const MIXED_FLAKY_NAME = 'mixed flaky pass';
const MIXED_PLAIN_NAME = 'mixed plain pass';
const NOW = new Date('2026-11-22T10:00:00.000Z');

function playwrightResult(retry: number, status: string) {
  return {
    status,
    duration: 1,
    retry,
    startTime: '2026-11-22T09:00:00.000Z',
    stdout: [],
    stderr: [],
    annotations: [],
    attachments: [],
  };
}

// A final passed attempt after a failed retry; `status: expected` is the same
// run without Playwright deciding it was flaky.
function playwrightReport(
  status: 'flaky' | 'expected',
  name = FLAKY_NAME,
): unknown {
  return {
    config: {
      version: '1.65.0',
      configFile: 'playwright.config.ts',
      rootDir: 'tests',
      projects: [{ id: 'chromium', name: 'chromium', retries: 1 }],
    },
    suites: [
      {
        title: 'flaky.spec.ts',
        file: 'flaky.spec.ts',
        line: 0,
        column: 0,
        specs: [
          {
            title: name,
            ok: true,
            tags: [],
            id: 'flaky-spec-1',
            file: 'flaky.spec.ts',
            line: 7,
            column: 1,
            tests: [
              {
                timeout: 30000,
                annotations: [],
                expectedStatus: 'passed',
                projectId: 'chromium',
                projectName: 'chromium',
                status,
                results: [
                  playwrightResult(0, 'failed'),
                  playwrightResult(1, 'passed'),
                ],
              },
            ],
          },
        ],
      },
    ],
    errors: [],
    stats: {
      startTime: '2026-11-22T09:00:00.000Z',
      duration: 2,
      expected: status === 'expected' ? 1 : 0,
      unexpected: 0,
      flaky: status === 'flaky' ? 1 : 0,
      skipped: 0,
    },
  };
}

function legacyScenario(
  name: string,
  line: number,
  tags: Array<{ name: string; line: number }>,
) {
  return {
    keyword: 'Scenario',
    type: 'scenario',
    name,
    line,
    tags,
    steps: [
      {
        keyword: 'Given ',
        name: 'a passing step',
        result: { status: 'passed', duration: 1 },
      },
    ],
  };
}

function legacyReport(tags: Array<{ name: string; line: number }>): unknown {
  return [
    {
      uri: 'features/legacy-flaky.feature',
      name: 'Legacy flaky',
      keyword: 'Feature',
      elements: [legacyScenario(LEGACY_NAME, 3, tags)],
    },
  ];
}

function mixedLegacyReport(): unknown {
  return [
    {
      uri: 'features/mixed-flaky.feature',
      name: 'Mixed flaky',
      keyword: 'Feature',
      elements: [
        legacyScenario(MIXED_FLAKY_NAME, 3, [{ name: '@flaky', line: 3 }]),
        legacyScenario(MIXED_PLAIN_NAME, 8, []),
      ],
    },
  ];
}

function countsBlock(html: string): string {
  const start = html.indexOf('<div class="counts">');
  return html.slice(start, html.indexOf('</div>', start));
}

function flakyMeta(html: string): string | undefined {
  return /<span class="flakyMeta">[\s\S]*?<\/span>/.exec(html)?.[0];
}

let dir = '';
let flakyFile = '';
let controlFile = '';
let legacyFlakyFile = '';
let legacyPlainFile = '';
let mixedFile = '';

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'tolkira-flaky-'));
  flakyFile = path.join(dir, 'flaky.json');
  controlFile = path.join(dir, 'control.json');
  legacyFlakyFile = path.join(dir, 'legacy-flaky.json');
  legacyPlainFile = path.join(dir, 'legacy-plain.json');
  mixedFile = path.join(dir, 'mixed.json');
  await writeFile(flakyFile, JSON.stringify(playwrightReport('flaky')), 'utf8');
  await writeFile(
    controlFile,
    JSON.stringify(playwrightReport('expected')),
    'utf8',
  );
  await writeFile(
    legacyFlakyFile,
    JSON.stringify(legacyReport([{ name: '@flaky', line: 3 }])),
    'utf8',
  );
  await writeFile(legacyPlainFile, JSON.stringify(legacyReport([])), 'utf8');
  await writeFile(mixedFile, JSON.stringify(mixedLegacyReport()), 'utf8');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('flaky visibility', () => {
  it('marks a Playwright retry pass with a badge and tagged run count', async () => {
    const html = await renderReport(flakyFile, { title: 'Flaky run' });
    const summary = scenarioSummary(html, FLAKY_NAME);

    expect(summary).toContain('class="flakyBadge"');
    expect(summary).toContain(
      '<span class="flakyBadge" aria-hidden="true">flaky</span>',
    );
    expect(summary).toContain('<span class="tag">@flaky</span>');
    expect(scenarioOpeningTag(html, FLAKY_NAME)).toContain(
      'data-status="passed"',
    );
    expect(summary).toContain('>Passed</span>');

    const counts = countsBlock(html);
    expect(counts).toContain('<b>1</b> passed');
    expect(counts).not.toContain('flaky');
    expect(flakyMeta(html)).toBe(
      '<span class="flakyMeta">1 tagged @flaky</span>',
    );
  });

  it('keeps JSON, CI and email unchanged except the existing tag', async () => {
    const flaky = await summarizeReport(flakyFile);
    const control = await summarizeReport(controlFile);

    expect(flaky.status).toBe('passed');
    expect(flaky.scenarios[0]?.status).toBe('passed');
    expect(flaky.scenarios[0]?.attempt).toBe(1);
    expect(flaky.scenarios[0]?.tags).toEqual(['@flaky']);

    const withoutFlakyTag = structuredClone(flaky);
    for (const scenario of withoutFlakyTag.scenarios) {
      scenario.tags = scenario.tags.filter((tag) => tag !== '@flaky');
    }
    expect(withoutFlakyTag).toEqual(control);

    for (const format of ['markdown', 'github'] as const) {
      expect(formatCiOutput(flaky, format)).toBe(formatCiOutput(control, format));
    }
    expect(renderEmail(flaky, { title: 'Flaky run', now: NOW })).toBe(
      renderEmail(control, { title: 'Flaky run', now: NOW }),
    );
  });

  it('shows the same badge and tagged count for a Cucumber user @flaky tag', async () => {
    const html = await renderReport(legacyFlakyFile, { title: 'Legacy flaky' });
    const summary = scenarioSummary(html, LEGACY_NAME);

    expect(summary).toContain(
      '<span class="flakyBadge" aria-hidden="true">flaky</span>',
    );
    expect(summary).toContain('<span class="tag">@flaky</span>');
    expect(scenarioOpeningTag(html, LEGACY_NAME)).toContain(
      'data-status="passed"',
    );
    expect(flakyMeta(html)).toBe(
      '<span class="flakyMeta">1 tagged @flaky</span>',
    );
  });

  it('badges only the @flaky row and counts one in a mixed run', async () => {
    const html = await renderReport(mixedFile, { title: 'Mixed flaky' });
    const flaky = scenarioSummary(html, MIXED_FLAKY_NAME);
    const plain = scenarioSummary(html, MIXED_PLAIN_NAME);
    const counts = countsBlock(html);

    expect(flaky).toContain(
      '<span class="flakyBadge" aria-hidden="true">flaky</span>',
    );
    expect(plain).not.toContain('flakyBadge');
    expect(plain).toContain('>Passed</span>');
    expect(counts).toContain('<b>2</b> passed');
    expect(counts).not.toContain('flaky');
    expect(flakyMeta(html)).toBe(
      '<span class="flakyMeta">1 tagged @flaky</span>',
    );
  });

  it('renders neither badge nor tagged count when no scenario is flaky', async () => {
    const html = await renderReport(legacyPlainFile, { title: 'No flaky' });
    const summary = scenarioSummary(html, LEGACY_NAME);

    expect(summary).not.toContain('flakyBadge');
    expect(countsBlock(html)).not.toContain('flaky');
    expect(flakyMeta(html)).toBeUndefined();
  });

  it('uses the German catalog keys and keeps test data verbatim', async () => {
    const catalog = JSON.parse(
      await readFile(
        new URL('../src/i18n/locales/de.json', import.meta.url),
        'utf8',
      ),
    ) as Record<string, string>;
    const summaryLabel = catalog['report.flakySummary'];
    const badgeLabel = catalog['report.flakyBadge'];
    expect(summaryLabel).toEqual(expect.any(String));
    expect(badgeLabel).toEqual(expect.any(String));

    const html = await renderReport(flakyFile, {
      title: 'Bericht',
      locale: 'de',
    });
    const summary = scenarioSummary(html, FLAKY_NAME);

    expect(html).toContain('<html lang="de" dir="ltr">');
    expect(summary).toContain(
      `<span class="flakyBadge" aria-hidden="true">${badgeLabel}</span>`,
    );
    expect(summary).toContain('<span class="tag">@flaky</span>');
    expect(summary).toContain('>Bestanden</span>');
    expect(summary).not.toContain('>Passed</span>');
    expect(countsBlock(html)).not.toContain('flaky');
    expect(flakyMeta(html)).toBe(
      `<span class="flakyMeta">${(summaryLabel ?? '').replace('{count}', '1')}</span>`,
    );
  });

  it('keeps the flaky additions wrapping at 320 and 1440', async () => {
    const html = await renderReport(flakyFile, { title: 'Widths' });
    const summary = scenarioSummary(html, FLAKY_NAME);

    // The run-meta count and badge sit in existing wrapping containers, and
    // both new classes wrap long text instead of forcing the row wider.
    expect(html).toContain('<span class="flakyMeta">');
    expect(summary.indexOf('class="flakyBadge"')).toBeGreaterThan(
      summary.indexOf('class="scenarioSub"'),
    );
    expect(REPORT_CSS).toMatch(/\.meta\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(REPORT_CSS).toMatch(/\.scenarioMain\s*\{[^}]*min-width:\s*0/);
    expect(REPORT_CSS).toMatch(
      /\.flakyMeta\b[^{]*\{[^}]*overflow-wrap:\s*anywhere/,
    );
    expect(REPORT_CSS).toMatch(
      /\.flakyBadge\b[^{]*\{[^}]*overflow-wrap:\s*anywhere/,
    );
    expect(REPORT_CSS).not.toMatch(/\.counts\s+\.flaky\b/);
  });
});
