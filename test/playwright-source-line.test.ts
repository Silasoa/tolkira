import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatCiOutput } from '../src/ci.js';
import { renderEmail } from '../src/email.js';
import { renderReport, summarizeReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parsePlaywrightJson } from '../src/input/playwright.js';
import type { ReportFeature, ReportScenario } from '../src/report/model.js';
import { createTranslator } from '../src/render/i18n.js';
import { featureSourceLabel } from '../src/render/format.js';
import { renderHtml } from '../src/render/html.js';
import { REPORT_CSS } from '../src/render/styles.js';
import { summarizeEnvelopes } from '../src/summary.js';

const t = createTranslator();
const errorsFixture = fileURLToPath(
  new URL('./fixtures/playwright/errors.json', import.meta.url),
);
const junitFixture = fileURLToPath(
  new URL('./fixtures/junit/basic.xml', import.meta.url),
);

const failedTest = {
  timeout: 30000,
  annotations: [],
  expectedStatus: 'passed',
  projectId: 'chromium',
  projectName: 'chromium',
  status: 'unexpected',
  results: [
    {
      status: 'failed',
      duration: 5,
      retry: 0,
      startTime: '2026-11-19T10:00:00.000Z',
      stdout: [],
      stderr: [],
      annotations: [],
      attachments: [],
      error: { message: 'Expected 2 movies, received 1' },
    },
  ],
};

// A describe one line above its spec, as Playwright reports it.
function specSuite(
  file: string,
  title: string,
  line: number | undefined,
  id: string,
) {
  return {
    title,
    file,
    ...(line === undefined || line <= 1 ? {} : { line: line - 1 }),
    column: 0,
    specs: [
      {
        title: `${title} spec`,
        ok: false,
        tags: [],
        id,
        file,
        ...(line === undefined ? {} : { line }),
        column: 1,
        tests: [failedTest],
      },
    ],
  };
}

function playwrightReport(...suites: unknown[]): unknown {
  return {
    config: {
      version: '1.65.0',
      configFile: 'playwright.config.ts',
      rootDir: 'tests',
      projects: [{ id: 'chromium', name: 'chromium', retries: 0 }],
    },
    suites,
    errors: [],
    stats: {
      startTime: '2026-11-19T10:00:00.000Z',
      duration: 5,
      expected: 0,
      unexpected: suites.length,
      flaky: 0,
      skipped: 0,
    },
  };
}

async function movieRun() {
  // The line is Pickle metadata already; only model and label consume it.
  return parsePlaywrightJson(
    playwrightReport(
      specSuite('movie-list.spec.ts', 'movie list', 3, 'movie-list-spec-1'),
    ),
    'movie-list.json',
  );
}

function values(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => match[1] ?? '');
}

function scenarioSources(html: string): string[] {
  return values(html, /<span class="scenarioSource">(.*?)<\/span>/g);
}

function featureLabel(html: string): string | undefined {
  return /<span class="featureUri">(.*?)<\/span>/.exec(html)?.[1];
}

function scenario(uri: string, line?: number): ReportScenario {
  return {
    id: `scenario-${uri}`,
    name: 'Movie',
    keyword: 'Scenario',
    description: '',
    uri,
    featureName: 'Movie list',
    status: 'failed',
    executed: true,
    durationMs: 0,
    attempt: 0,
    ownTags: [],
    tags: [],
    steps: [],
    hooks: [],
    attachments: [],
    extraAttachments: [],
    ...(line === undefined ? {} : { line }),
  };
}

function feature(
  ...entries: Array<{ uri: string; line?: number }>
): ReportFeature {
  return {
    id: 'feature-1',
    name: 'Movie list',
    keyword: 'Feature',
    uri: entries[0]?.uri ?? '',
    description: '',
    tags: [],
    backgrounds: [],
    status: 'failed',
    durationMs: 0,
    attachments: 0,
    scenarios: entries.map((entry, index) => ({
      ...scenario(entry.uri, entry.line),
      id: `scenario-${index}`,
    })),
  };
}

describe('Playwright source line', () => {
  it('shows the spec line in the feature row, matrix and triage', async () => {
    const { envelopes } = await movieRun();
    const html = await renderHtml(envelopes, { title: 'Movie list' });

    expect([
      ...values(html, /<span class="featureUri">(.*?)<\/span>/g),
      ...values(html, /<span class="matrixUri">(.*?)<\/span>/g),
      ...values(html, /<a class="triageFeature"[^>]*title="([^"]*)"/g),
    ]).toEqual([
      'movie-list.spec.ts:3',
      'movie-list.spec.ts:3',
      'movie-list.spec.ts:3',
    ]);
    expect(scenarioSources(html)).toEqual(['movie-list.spec.ts:3']);
  });

  it('shows no invented line for a Playwright spec without one', async () => {
    for (const line of [undefined, 0]) {
      const { envelopes } = await parsePlaywrightJson(
        playwrightReport(
          specSuite('no-line.spec.ts', 'no line', line, 'no-line-spec-1'),
        ),
        'no-line.json',
      );
      const html = await renderHtml(envelopes, { title: 'No line' });

      expect(scenarioSources(html)).toEqual(['no-line.spec.ts']);
      expect(featureLabel(html)).toBe('no-line.spec.ts');
      expect(html).not.toMatch(/no-line\.spec\.ts:/);
      expect(html).toContain('Expected 2 movies, received 1');
    }
  });

  it('shows each scenario line for a multi-spec project feature', async () => {    const { envelopes } = await parsePlaywrightJson(
      playwrightReport(
        specSuite('movie-list.spec.ts', 'movie list', 3, 'movie-list-spec-1'),
        specSuite('details.spec.ts', 'details', 8, 'details-spec-1'),
      ),
      'project.json',
    );
    const html = await renderHtml(envelopes, { title: 'Project' });

    expect(scenarioSources(html)).toEqual([
      'movie-list.spec.ts:3',
      'details.spec.ts:8',
    ]);
    expect(featureLabel(html)).toBe('2 spec files');
    expect(values(html, /<span class="matrixUri">(.*?)<\/span>/g)).toEqual([
      '2 spec files',
    ]);
  });

  it('keeps the line out of the summary, CI text and email', async () => {
    const { envelopes } = await movieRun();
    const summary = summarizeEnvelopes(envelopes);
    const scenario = summary.scenarios[0];

    expect(scenario?.uri).toBe('movie-list.spec.ts');
    expect(Object.keys(scenario ?? {})).not.toContain('line');
    expect(summary.scenarios.map((row) => [row.name, row.status, row.uri])).toEqual([
      ['movie list spec', 'failed', 'movie-list.spec.ts'],
    ]);
    expect(summary.counts.scenarios).toMatchObject({
      total: 1,
      failed: 1,
      passed: 0,
    });
    const ci = formatCiOutput(summary, 'markdown');
    expect(ci).toContain('movie-list.spec.ts');
    expect(ci).not.toContain('movie-list.spec.ts:3');
    expect(renderEmail(summary)).not.toContain('movie-list.spec.ts:3');
  });
});

describe('adapter source lines', () => {
  it('shows no invented line for a Playwright run-error pseudo-pickle', async () => {
    const html = await renderReport(errorsFixture, { title: 'Run errors' });
    const source = scenarioSources(html)[0] ?? '';

    expect(source).toMatch(/\/errors$/);
    expect(source).not.toContain(':1');
    expect(html).not.toMatch(/errors:1/);
    expect(html).toContain('No tests found');
  });

  it('shows no invented line for a JUnit report', async () => {
    const html = await renderReport(junitFixture, { title: 'JUnit' });
    const sources = scenarioSources(html);

    expect(sources).toHaveLength(4);
    expect(
      sources.every((source) => !/:\d+$/.test(source) && !source.endsWith(':')),
    ).toBe(true);
    const summary = await summarizeReport(junitFixture);
    expect(summary.counts.features).toBe(2);
    expect(summary.counts.scenarios).toMatchObject({
      total: 4,
      passed: 2,
      failed: 1,
      skipped: 1,
    });
  });

  it('wraps the scenario source at every width', () => {
    expect(REPORT_CSS).toMatch(
      /\.scenarioSource\s*\{[^}]*overflow-wrap:\s*anywhere/,
    );
    expect(REPORT_CSS).not.toMatch(/\.scenarioSource[^}]*display:\s*none/);
  });
});

describe('featureSourceLabel line rule', () => {
  it('shows uri:line for one scenario with a positive line', () => {
    expect(
      featureSourceLabel(
        feature({ uri: 'features/movie.feature', line: 12 }),
        t,
      ),
    ).toBe('features/movie.feature:12');
  });

  it('shows the uri only when lines are mixed', () => {
    const label = featureSourceLabel(
      feature(
        { uri: 'features/movie.feature', line: 10 },
        { uri: 'features/movie.feature', line: 12 },
      ),
      t,
    );

    expect(label).toBe('features/movie.feature');
    expect(label).not.toMatch(/:\d+$/);
  });

  it('shows the uri only when a line is absent or not positive', () => {
    expect(
      featureSourceLabel(feature({ uri: 'features/movie.feature' }), t),
    ).toBe('features/movie.feature');
    expect(
      featureSourceLabel(
        feature({ uri: 'features/movie.feature', line: 0 }),
        t,
      ),
    ).toBe('features/movie.feature');
    expect(
      featureSourceLabel(
        feature({ uri: 'features/movie.feature', line: 12.5 }),
        t,
      ),
    ).toBe('features/movie.feature');
    expect(
      featureSourceLabel(
        feature(
          { uri: 'features/movie.feature', line: 12 },
          { uri: 'features/movie.feature' },
        ),
        t,
      ),
    ).not.toMatch(/:$/);
  });

  it('keeps the file count for multiple uris', () => {
    expect(
      featureSourceLabel(
        feature(
          { uri: 'features/a.feature', line: 5 },
          { uri: 'features/b.feature', line: 5 },
        ),
        t,
      ),
    ).toBe('2 spec files');
  });

  it('shows uri:line when every scenario agrees on one line', () => {
    expect(
      featureSourceLabel(
        feature(
          { uri: 'features/movie.feature', line: 12 },
          { uri: 'features/movie.feature', line: 12 },
        ),
        t,
      ),
    ).toBe('features/movie.feature:12');
  });

  it('shows no source when the feature has no scenarios', () => {
    expect(featureSourceLabel(feature(), t)).toBe('');
  });
});

describe('legacy source line', () => {
  async function legacyHtml(lines: Array<number | undefined>): Promise<string> {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          uri: 'features/movie.feature',
          name: 'Movie list',
          elements: lines.map((line, index) => ({
            keyword: 'Scenario',
            type: 'scenario',
            name: `Scenario ${index + 1}`,
            ...(line === undefined ? {} : { line }),
            steps: [
              {
                keyword: 'Given ',
                name: 'a step',
                result: { status: 'passed', duration: 1 },
              },
            ],
          })),
        },
      ]),
      'legacy.json',
    );
    return renderHtml(envelopes, { title: 'Movie list' });
  }

  it('uses a line the input carries and never invents line 1', async () => {
    expect(featureLabel(await legacyHtml([7]))).toBe(
      'features/movie.feature:7',
    );
    expect(featureLabel(await legacyHtml([7, 9]))).toBe(
      'features/movie.feature',
    );
    expect(featureLabel(await legacyHtml([undefined]))).toBe(
      'features/movie.feature',
    );
  });

  it('shows each scenario line and keeps mixed feature labels file-only', async () => {
    expect(scenarioSources(await legacyHtml([7, 9]))).toEqual([
      'features/movie.feature:7',
      'features/movie.feature:9',
    ]);
    expect(scenarioSources(await legacyHtml([undefined]))).toEqual([
      'features/movie.feature',
    ]);
    expect(await legacyHtml([undefined])).not.toMatch(
      /scenarioSource">[^<]*:<\/span>/,
    );
  });
});
