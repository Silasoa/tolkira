import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { afterEach, describe, expect, it } from 'vitest';
import { compareBaseline } from '../src/baseline.js';
import { formatMarkdownSummary } from '../src/ci.js';
import { renderReport, summarizeReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import {
  legacyFixture,
  messagesFixture,
  playwrightFixture,
} from './fixtures.js';

const fixture = messagesFixture('screenshot.ndjson');
const legacyTableFixture = legacyFixture('happy.json');
const passedOnlyFixture = legacyFixture('behave.json');
const minimalFixture = legacyFixture('minimal.json');

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function tagOptions(html: string): string[] {
  return [...html.matchAll(/<option value="(@[^"]*)">/g)].map(
    (match) => match[1] ?? '',
  );
}

function featureMatrixNames(html: string): string[] {
  const matrix = html.slice(html.indexOf('<table class="featureTable">'));
  return [
    ...matrix.matchAll(
      /<tr><th scope="row"><span class="matrixName">(.*?)<\/span>/g,
    ),
  ].map((match) => match[1] ?? '');
}

function markdownFailureTitles(markdown: string): string[] {
  return [
    ...markdown.matchAll(/^#### `([^`]*)` - `([^`]*)`$/gm),
  ].map((match) => match[1] ?? '');
}

function legacyOrderFeature(name: string, status: 'passed' | 'failed') {
  return {
    uri: `features/${name}.feature`,
    name,
    elements: [
      {
        keyword: 'Scenario',
        name: `${name} scenario`,
        tags: [{ name: `@${name}` }],
        steps: [
          {
            keyword: 'Given ',
            name: 'a step',
            result: { status, duration: 1 },
          },
        ],
      },
    ],
  };
}

function tiedAttempts(): ReturnType<typeof parseMessages> {
  const lines: unknown[] = [
    {
      gherkinDocument: {
        uri: 'features/tie.feature',
        comments: [],
        feature: {
          location: { line: 1, column: 1 },
          tags: [],
          language: 'en',
          keyword: 'Feature',
          name: 'Tie',
          description: '',
          children: [
            {
              scenario: {
                id: 'tie-scenario',
                location: { line: 3, column: 3 },
                tags: [],
                keyword: 'Scenario',
                name: 'Tie scenario',
                description: '',
                steps: [
                  {
                    id: 'tie-step-def',
                    location: { line: 4, column: 5 },
                    keyword: 'Given ',
                    keywordType: 'Context',
                    text: 'a step',
                  },
                ],
                examples: [],
              },
            },
          ],
        },
      },
    },
    {
      pickle: {
        id: 'tie-pickle',
        uri: 'features/tie.feature',
        name: 'Tie scenario',
        language: 'en',
        astNodeIds: ['tie-scenario'],
        tags: [],
        steps: [
          { id: 'tie-pickle-step', text: 'a step', astNodeIds: ['tie-step-def'] },
        ],
      },
    },
    {
      testCase: {
        id: 'tie-case',
        pickleId: 'tie-pickle',
        testSteps: [{ id: 'tie-step', pickleStepId: 'tie-pickle-step' }],
      },
    },
    {
      testCaseStarted: {
        id: 'tie-start-first',
        testCaseId: 'tie-case',
        attempt: 0,
        timestamp: { seconds: 0, nanos: 0 },
      },
    },
    {
      testStepFinished: {
        testCaseStartedId: 'tie-start-first',
        testStepId: 'tie-step',
        testStepResult: {
          status: 'FAILED',
          duration: { seconds: 0, nanos: 1 },
        },
        timestamp: { seconds: 0, nanos: 0 },
      },
    },
    {
      testCaseStarted: {
        id: 'tie-start-second',
        testCaseId: 'tie-case',
        attempt: 0,
        timestamp: { seconds: 0, nanos: 0 },
      },
    },
    {
      testStepFinished: {
        testCaseStartedId: 'tie-start-second',
        testStepId: 'tie-step',
        testStepResult: {
          status: 'PASSED',
          duration: { seconds: 0, nanos: 1 },
        },
        timestamp: { seconds: 0, nanos: 0 },
      },
    },
  ];
  return parseMessages(
    lines.map((line) => JSON.stringify(line)).join('\n'),
    'tie.ndjson',
  );
}

describe('messages rendering', () => {
  it('renders the simple report and analysis view', async () => {
    const html = await renderReport(fixture, { title: 'Tolkira test' });

    expect(html).toContain('<title>Tolkira test</title>');
    expect(html).toContain('<h1>Tolkira test</h1>');
    expect(html).toContain('id="report-view"');
    expect(html).toContain('id="analysis-view"');
    expect(html).toContain('id="report-view" role="tabpanel" aria-labelledby="view-report" tabindex="0"');
    expect(html).toContain('id="analysis-view" role="tabpanel" aria-labelledby="view-analysis" tabindex="0" hidden');
    expect(html).toContain('aria-label="Agent summary JSON"');
    expect(html).toContain('<p class="detailLabel">Steps</p>');
    expect(html).toContain('class="stepMarker');
    expect(html).toContain('Run environment');
    expect(html).not.toContain('Cucumber environment');
    expect(html).toContain('Producer');
    expect(html).toContain('id="view-analysis"');
    expect(html).toContain('data-view="report"');
    expect(html).toContain('data-view="analysis"');
    expect(html).toContain('1 feature');
    expect(html).toContain('2 scenarios with results');
    expect(html).toContain('Executed scenarios only.');
    expect(html).toContain('>1</b> passed');
    expect(html).toContain('>1</b> failed');
    expect(html).toContain('1 attachment');
    expect(html).toContain('Screenshot attachment');
    expect(html).toContain('screenshot.png');
    expect(html).toContain('image/png');
    expect(html).toContain('data-expand="all"');
    expect(html).toContain('data-expand="none"');
    expect(html).toContain('class="thumb"');
    expect(html).toContain('class="chev"');
    expect(html).toContain('class="shotButton"');
    expect(html).toContain('id="tolkira-lightbox"');
    expect(html).toContain('Runtime');
    expect(html).toContain('Protocol');
    expect(html.length).toBeGreaterThan(20_000);
  });

  it('renders a localized report and rejects an invalid locale', async () => {
    const html = await renderReport(fixture, {
      title: 'Lokalisierter Bericht',
      locale: 'de',
    });

    expect(html).toContain('<html lang="de" dir="ltr">');
    expect(html).toContain('>Bericht</button>');
    expect(html).toContain('aria-label="Szenarien durchsuchen"');
    await expect(
      renderReport(fixture, { title: 'Ungültig', locale: 'fr' }),
    ).rejects.toThrow(/\bde\b/);
  });

  it('opens failed and image-bearing scenarios by default', async () => {
    const html = await renderReport(fixture, { title: 'Open state' });

    expect(html).toContain('data-status="failed"');
    expect(html).toContain('data-scenario');
    expect(html).toContain('class="shot"');
    expect(html).toContain(
      'alt="Screenshot for Attach a screenshot: Given I attach a screenshot: screenshot.png (image/png)"',
    );
  });

  it('escapes the report title', async () => {
    const html = await renderReport(fixture, {
      title: '<script>alert(1)</script>',
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<title><script>');
  });

  it('injects and escapes metadata', async () => {
    const html = await renderReport(fixture, {
      title: 'Metadata',
      metadata: {
        Browser: 'Chrome',
        Evil: '<script>alert(1)</script>',
      },
    });

    expect(html).toContain('Browser');
    expect(html).toContain('Chrome');
    expect(html).toContain('Custom metadata');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('wraps data and feature tables in focusable scroll regions', async () => {
    const html = await renderReport(legacyTableFixture, { title: 'Tables' });

    expect(html).toContain('role="region" aria-label="Data table for:');
    expect(html).toContain('role="region" aria-label="Feature status matrix"');
  });

  it('renders filters only for statuses with scenarios', async () => {
    const html = await renderReport(passedOnlyFixture, { title: 'Passed only' });

    expect(html).toContain('data-filter-status="passed"');
    expect(html).not.toMatch(
      /<button class="filter"[^>]+data-filter-status="failed"/,
    );
    expect(html).not.toMatch(
      /<details class="scenario"[^>]+data-status="failed"/,
    );
  });

  it('renders a tag filter with sorted unique scenario tags', async () => {
    const html = await renderReport(fixture, { title: 'Tag filter' });
    const tableHtml = await renderReport(legacyTableFixture, {
      title: 'Tag filter table',
    });
    const options = [...tableHtml.matchAll(/<option value="(@[^"]*)">/g)].map(
      (match) => match[1],
    );

    expect(html).toContain('data-tag-filter');
    expect(html).toContain('<option value="">All tags</option>');
    expect(html).toContain('<option value="@failing">@failing</option>');
    expect(html).toContain('data-tags="@failing"');
    expect(options).toEqual([
      '@testAttachDebugData',
      '@testDataTable',
      '@testDocString',
      '@testPassing',
      '@testScenarioOutline',
    ]);
  });

  it('omits the tag filter when no scenario has tags', async () => {
    const html = await renderReport(minimalFixture, { title: 'No tags' });

    expect(html).not.toContain('<select data-tag-filter');
    expect(html).not.toContain('All tags');
  });

  it('ships the search highlight hook and styling', async () => {
    const html = await renderReport(fixture, { title: 'Highlight' });

    expect(html).toContain('CSS.highlights');
    expect(html).toMatch(/CSS\.highlights\.set\(["']tolkira-search["']/);
    expect(html).toContain('new Highlight');
    expect(html).toContain('::highlight(tolkira-search)');
  });

  it('renders a copy failure button for failed scenarios only', async () => {
    const html = await renderReport(fixture, { title: 'Copy failure' });
    const passedHtml = await renderReport(passedOnlyFixture, {
      title: 'Copy failure passed',
    });

    expect(html).toContain('data-copy-failure');
    expect(html).toContain('>Copy failure</button>');
    expect(html).toMatch(/<li class="step" data-status="failed">/);
    expect(html.match(/class="copyFailure"/g)).toHaveLength(1);
    expect(passedHtml).not.toContain('class="copyFailure"');
    expect(passedHtml).not.toContain('>Copy failure</button>');
  });

  it('does not load external scripts or stylesheets', async () => {
    const html = await renderReport(fixture, { title: 'Offline' });

    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
  });

  it('escapes untrusted feature, scenario and step names', async () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          name: '<img src=x onerror=alert(1)>',
          elements: [
            {
              keyword: 'Scenario',
              name: '<script>alert(2)</script>',
              tags: ['<img src=x onerror=5>'],
              steps: [
                {
                  keyword: 'Given ',
                  name: '<svg onload=alert(3)>',
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        },
      ]),
      'xss-names.json',
    );

    const html = await renderHtml(envelopes, { title: 'XSS names' });

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).not.toContain('<svg onload=alert(3)>');
    expect(html).not.toContain('<img src=x onerror=5>');
  });

  it('does not render a malicious attachment file name as HTML', async () => {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const attachment = lines.find((line) => line.attachment)?.attachment as
      | Record<string, unknown>
      | undefined;
    if (attachment) {
      attachment.fileName = '<img src=x onerror=alert(4)>.png';
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'malicious-name.ndjson',
    );
    const html = await renderHtml(envelopes, { title: 'Malicious name' });

    expect(html).not.toContain('<img src=x');
  });

  it('does not render a remote logo URL', async () => {
    const html = await renderReport(fixture, {
      title: 'Remote logo',
      logo: 'https://tolkira-probe.invalid/logo.png',
    });

    expect(html).not.toContain('tolkira-probe.invalid');
  });

  it('carries a restrictive content security policy', async () => {
    const html = await renderReport(fixture, { title: 'CSP' });

    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("script-src 'sha256-");
    expect(html).not.toMatch(/url\((?:https?:)?\/\//i);
  });

  it('normalizes absolute Messages URIs in the report', async () => {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map(
        (line) =>
          JSON.parse(line) as {
            gherkinDocument?: { uri?: string };
            pickle?: { uri?: string };
          },
      );
    const absolute = 'C:\\Users\\name\\proj\\features\\screenshot.feature';
    for (const line of lines) {
      if (line.gherkinDocument) line.gherkinDocument.uri = absolute;
      if (line.pickle) line.pickle.uri = absolute;
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'absolute.ndjson',
    );
    const html = await renderHtml(envelopes, { title: 'Absolute URI' });

    expect(html).not.toContain('Users');
    expect(html).toContain('features/screenshot.feature');
  });

  it('defaults a missing Messages attempt to zero', async () => {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map(
        (line) =>
          JSON.parse(line) as {
            testCaseStarted?: { attempt?: number };
          },
      );
    for (const line of lines) {
      if (line.testCaseStarted) delete line.testCaseStarted.attempt;
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'no-attempt.ndjson',
    );
    const model = buildReportModel(envelopes);
    const html = await renderHtml(envelopes, { title: 'No attempt' });

    expect(model.scenarios.every((scenario) => scenario.attempt === 0)).toBe(
      true,
    );
    expect(html).not.toContain('Attempt: NaN');
  });

  it('uses the later start on a full attempt and timestamp tie', async () => {
    const envelopes = tiedAttempts();
    const model = buildReportModel(envelopes);
    const html = await renderHtml(envelopes, { title: 'Attempt tie' });

    expect(model.scenarios[0]?.status).toBe('passed');
    expect(model.scenarios[0]?.attempt).toBe(0);
    expect(html).toContain('data-status="passed"');
    expect(html).not.toContain('data-status="failed"');
    expect(html).not.toContain('1970');
  });

  it('omits the run date when no usable timestamp exists', async () => {
    const html = await renderReport(playwrightFixture('no-timing.json'), {
      title: 'No timing',
    });

    expect(html).not.toContain('1970');
    expect(html).not.toContain('Started:');
  });

  it('renders the existing date for a real timestamp', async () => {
    const html = await renderReport(playwrightFixture('real-run.json'), {
      title: 'Real timing',
    });

    expect(html).toContain('2026-11-18');
    expect(html).not.toContain('1970');
  });

  it('clamps negative message durations in the model', async () => {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map(
        (line) =>
          JSON.parse(line) as {
            testStepFinished?: { testStepResult: { duration: unknown } };
          },
      );
    for (const line of lines) {
      if (line.testStepFinished) {
        line.testStepFinished.testStepResult.duration = { seconds: -5, nanos: 0 };
      }
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'negative-duration.ndjson',
    );
    const model = buildReportModel(envelopes);

    expect(model.durationMs).toBe(0);
    expect(model.scenarios.every((scenario) => scenario.durationMs === 0)).toBe(
      true,
    );
    expect(
      model.scenarios
        .flatMap((scenario) => scenario.steps)
        .every((step) => step.durationMs === 0),
    ).toBe(true);

    const html = await renderHtml(envelopes, { title: 'Negative duration' });
    expect(html).not.toContain('-5000');
    expect(html).toContain('0 ms');
  });
});

describe('legacy run dates', () => {
  it.each(['happy.json', 'failed.json', 'minimal.json'])(
    'omits the run date for legacy %s without a start time',
    async (name) => {
      const html = await renderReport(legacyFixture(name), {
        title: 'Legacy date',
      });

      expect(html).not.toContain('Started:');
      expect(html).not.toContain('1970');
    },
  );

  it('shows an explicit non-zero legacy start time', async () => {
    const content = await readFile(legacyFixture('minimal.json'), 'utf8');
    const envelopes = parseLegacyJson(content, 'minimal.json', {
      idPrefix: 'date',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const html = await renderHtml(envelopes, { title: 'Pinned date' });

    expect(html).toContain('Started: 2026-01-01');
    expect(html).not.toContain('1970');
  });

  it('keeps the real Messages run date unchanged', async () => {
    const html = await renderReport(messagesFixture('screenshot.ndjson'), {
      title: 'Real messages date',
    });

    expect(html).toContain('Started: 2026-11-02');
    expect(html).not.toContain('1970');
  });
});

describe('host-locale-independent report order', () => {
  async function orderInputDir(
    status: 'passed' | 'failed' = 'passed',
  ): Promise<string> {
    const dir = await tempDir('tolkira-order-input-');
    for (const name of ['Zebra', 'apple', 'Äpfel']) {
      await writeFile(
        path.join(dir, `${name}.json`),
        JSON.stringify([legacyOrderFeature(name, status)]),
        'utf8',
      );
    }
    return dir;
  }

  it('sorts the tag filter by UTF-16 code units', async () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          uri: 'features/tags.feature',
          name: 'Tags',
          elements: ['apple', 'Zebra', 'Äpfel'].map((name) => ({
            keyword: 'Scenario',
            name: `tag ${name}`,
            tags: [{ name: `@${name}` }],
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
      'tag-order.json',
    );

    const html = await renderHtml(envelopes, { title: 'Tag order' });

    expect(tagOptions(html)).toEqual(['@Zebra', '@apple', '@Äpfel']);
  });

  it('sorts report features by the fixed resolved input order', async () => {
    const dir = await orderInputDir();

    const html = await renderReport(dir, { title: 'Feature order' });

    expect(featureMatrixNames(html)).toEqual(['Zebra', 'apple', 'Äpfel']);
    expect(tagOptions(html)).toEqual(['@Zebra', '@apple', '@Äpfel']);
  });

  it('keeps every order fixed when the host localeCompare is replaced', async () => {
    const dir = await orderInputDir('failed');
    const baselineRows = ['apple', 'Zebra', 'Äpfel'].map((name) => ({
      feature: name,
      name: `${name} scenario`,
      uri: `features/${name}.feature`,
      status: 'passed' as const,
      executed: true,
    }));
    const original = String.prototype.localeCompare;
    const collator = new Intl.Collator('sv');
    String.prototype.localeCompare = function (
      this: string,
      that: string,
    ): number {
      return collator.compare(this, that);
    } as typeof String.prototype.localeCompare;

    try {
      const summary = await summarizeReport(dir);
      const markdown = formatMarkdownSummary(summary);
      const html = await renderReport(dir, { title: 'Locale stub' });
      const comparison = compareBaseline(
        { schemaVersion: 2, status: 'passed', scenarios: baselineRows },
        [],
      );

      expect(summary.scenarios.map((scenario) => scenario.uri)).toEqual([
        'features/Zebra.feature',
        'features/apple.feature',
        'features/Äpfel.feature',
      ]);
      expect(markdownFailureTitles(markdown)).toEqual([
        'Zebra',
        'apple',
        'Äpfel',
      ]);
      expect(featureMatrixNames(html)).toEqual(['Zebra', 'apple', 'Äpfel']);
      expect(tagOptions(html)).toEqual(['@Zebra', '@apple', '@Äpfel']);
      expect(comparison.block.notInThisRun.map((row) => row.feature)).toEqual([
        'Zebra',
        'apple',
        'Äpfel',
      ]);
    } finally {
      String.prototype.localeCompare = original;
    }
  });

  it(
    'produces byte-identical JSON and Markdown and one fixed report order under sv_SE and de_DE',
    async () => {
      const repoRoot = fileURLToPath(new URL('..', import.meta.url));
      const inputDir = await tempDir('tolkira-locale-input-');
      for (const name of ['Zebra', 'apple', 'Äpfel']) {
        await writeFile(
          path.join(inputDir, `${name}.json`),
          JSON.stringify([legacyOrderFeature(name, 'failed')]),
          'utf8',
        );
      }
      const outputDir = await tempDir('tolkira-locale-output-');
      await mkdir(outputDir, { recursive: true });
      const bundleDir = await tempDir('tolkira-locale-bundle-');
      const bundle = path.join(bundleDir, 'cli.mjs');

      await build({
        entryPoints: [path.join(repoRoot, 'src', 'cli.ts')],
        bundle: true,
        platform: 'node',
        target: 'node22',
        format: 'esm',
        outfile: bundle,
        logLevel: 'silent',
      });

      const run = async (locale: string) => {
        const htmlFile = path.join(outputDir, `${locale}.html`);
        const markdownFile = path.join(outputDir, `${locale}.md`);
        const result = spawnSync(
          process.execPath,
          [
            bundle,
            inputDir,
            '--json',
            '--ci',
            'markdown',
            '--ci-out',
            markdownFile,
            '--out',
            htmlFile,
          ],
          {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120_000,
            env: { ...process.env, LANG: locale, LC_ALL: locale },
          },
        );
        if (result.status !== 0) {
          throw new Error(
            `tolkira exited ${result.status} under ${locale}: ${result.stderr}`,
          );
        }
        return {
          json: result.stdout,
          markdown: await readFile(markdownFile, 'utf8'),
          html: await readFile(htmlFile, 'utf8'),
        };
      };

      const swedish = await run('sv_SE.UTF-8');
      const german = await run('de_DE.UTF-8');
      const summary = JSON.parse(swedish.json) as {
        scenarios: Array<{ uri: string }>;
      };

      expect(german.json).toBe(swedish.json);
      expect(summary.scenarios.map((scenario) => scenario.uri)).toEqual([
        'features/Zebra.feature',
        'features/apple.feature',
        'features/Äpfel.feature',
      ]);
      expect(german.markdown).toBe(swedish.markdown);
      expect(markdownFailureTitles(swedish.markdown)).toEqual([
        'Zebra',
        'apple',
        'Äpfel',
      ]);
      expect(featureMatrixNames(swedish.html)).toEqual([
        'Zebra',
        'apple',
        'Äpfel',
      ]);
      expect(tagOptions(swedish.html)).toEqual([
        '@Zebra',
        '@apple',
        '@Äpfel',
      ]);
    },
    180_000,
  );
});
