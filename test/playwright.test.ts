import {
  copyFile,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Envelope } from '@cucumber/messages';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import { generateReport, renderReport, summarizeReport } from '../src/index.js';
import { loadEnvelopes, loadInputs } from '../src/input/load.js';
import { parsePlaywrightJson } from '../src/input/playwright.js';
import { buildReportModel } from '../src/report/model.js';
import type { ReportSummary, SummaryScenario } from '../src/summary.js';
import { attachmentTexts } from './attachments.js';
import {
  junitFixture,
  legacyFixture,
  messagesFixture,
  playwrightFixture,
} from './fixtures.js';

const realRun = playwrightFixture('real-run.json');
const nestedDescribes = playwrightFixture('nested-describes.json');
const statuses = playwrightFixture('statuses.json');
const stepsFixture = playwrightFixture('steps.json');
const outputFixture = playwrightFixture('output.json');
const errorsFixture = playwrightFixture('errors.json');
const emptyFixture = playwrightFixture('empty.json');
const skippedNoStepsFixture = playwrightFixture('skipped-no-steps.json');
const twoFilesFixture = playwrightFixture('two-files.json');
const errorLocationsFixture = playwrightFixture('error-locations.json');

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-playwright-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function scenario(
  summary: ReportSummary,
  name: string,
  feature?: string,
): SummaryScenario {
  const found = summary.scenarios.find(
    (entry) =>
      entry.name === name && (feature === undefined || entry.feature === feature),
  );
  if (!found) {
    throw new Error(
      `missing scenario ${JSON.stringify(name)}${
        feature ? ` in feature ${JSON.stringify(feature)}` : ''
      }`,
    );
  }
  return found;
}

function reportWithAttachments(
  attachments: unknown[],
  specTitle = 'uses attachments',
): unknown {
  return {
    config: {
      version: '1.65.0',
      configFile: 'playwright.config.ts',
      rootDir: 'tests',
      projects: [{ id: 'chromium', name: 'chromium', retries: 0 }],
    },
    suites: [
      {
        title: 'paths.spec.ts',
        file: 'paths.spec.ts',
        line: 0,
        column: 0,
        specs: [
          {
            title: specTitle,
            ok: true,
            tags: [],
            id: 'paths-spec-1',
            file: 'paths.spec.ts',
            line: 1,
            column: 1,
            tests: [
              {
                timeout: 30000,
                annotations: [],
                expectedStatus: 'passed',
                projectId: 'chromium',
                projectName: 'chromium',
                status: 'expected',
                results: [
                  {
                    status: 'passed',
                    duration: 1,
                    retry: 0,
                    startTime: '2026-11-18T18:30:00.000Z',
                    stdout: [],
                    stderr: [],
                    annotations: [],
                    attachments,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    errors: [],
    stats: {
      startTime: '2026-11-18T18:30:00.000Z',
      duration: 1,
      expected: 1,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    },
  };
}

function playwrightSpec(
  title: string,
  results: unknown[],
  file = 'sample.spec.ts',
  testStatus = 'expected',
): unknown {
  return {
    title,
    ok: true,
    tags: [],
    id: title,
    file,
    line: 1,
    column: 1,
    tests: [
      {
        timeout: 30000,
        annotations: [],
        expectedStatus: 'passed',
        projectId: 'chromium',
        projectName: 'chromium',
        status: testStatus,
        results,
      },
    ],
  };
}

function passedResult(extra: Record<string, unknown> = {}): unknown {
  return {
    status: 'passed',
    duration: 1,
    retry: 0,
    startTime: '2026-11-18T18:30:00.000Z',
    stdout: [],
    stderr: [],
    annotations: [],
    attachments: [],
    ...extra,
  };
}

function playwrightReport(specs: unknown[], file = 'sample.spec.ts'): unknown {
  return {
    config: {
      version: '1.65.0',
      configFile: 'playwright.config.ts',
      rootDir: 'tests',
      projects: [{ id: 'chromium', name: 'chromium', retries: 0 }],
    },
    suites: [{ title: file, file, line: 0, column: 0, specs }],
    errors: [],
    stats: {
      startTime: '2026-11-18T18:30:00.000Z',
      duration: 1,
      expected: 1,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    },
  };
}

function mutateErrors(
  value: unknown,
  update: (error: Record<string, unknown>) => void,
): void {
  if (Array.isArray(value)) {
    for (const child of value) mutateErrors(child, update);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    update(error as Record<string, unknown>);
  }
  for (const child of Object.values(record)) mutateErrors(child, update);
}

async function realRunCopy(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(realRun, 'utf8')) as Record<string, unknown>;
}

async function writeReport(
  dir: string,
  value: unknown,
  name = 'report.json',
): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

// Pins the documented return shape from the change design.
async function parsePlaywright(
  value: unknown,
  source: string,
): Promise<{ envelopes: Envelope[]; skippedAttachments: number }> {
  return (await parsePlaywrightJson(value, source)) as unknown as {
    envelopes: Envelope[];
    skippedAttachments: number;
  };
}

describe('Playwright JSON input', () => {
  it('maps projects, hierarchy, tags, statuses and attempts from a real run', async () => {
    const summary = await summarizeReport(realRun);
    const model = buildReportModel(await loadEnvelopes(realRun));

    expect(summary.counts.features).toBe(2);
    expect(summary.counts.scenarios).toMatchObject({
      total: 16,
      passed: 7,
      failed: 7,
      skipped: 2,
    });

    const features = new Set(summary.scenarios.map((entry) => entry.feature));
    expect([...features].sort()).toEqual(['alpha', 'beta']);
    expect(
      summary.scenarios.filter((entry) => entry.feature === 'alpha'),
    ).toHaveLength(8);
    expect(
      summary.scenarios.filter((entry) => entry.feature === 'beta'),
    ).toHaveLength(8);
    expect(
      summary.scenarios.every((entry) => !entry.name.includes('@')),
    ).toBe(true);

    const passes = scenario(summary, 'passes with steps', 'alpha');
    expect(passes).toMatchObject({
      status: 'passed',
      attempt: 0,
      uri: 'sample.spec.ts',
    });
    expect(passes.durationMs).toBe(8);
    expect(passes.tags).toEqual(
      expect.arrayContaining(['@checkout', '@smoke']),
    );
    expect(passes.steps.map((step) => step.durationMs)).toEqual([1, 2, 5]);
    expect(passes.steps.map((step) => step.status)).toEqual([
      'passed',
      'passed',
      'passed',
    ]);
    expect(passes.steps[0]?.text).toContain('outer step');
    expect(passes.steps[1]?.text).toContain('inner step');
    expect(passes.steps[1]?.text).toContain('›');
    expect(passes.steps[2]?.text).toBe('Playwright overhead');

    const modelPasses = model.scenarios.find(
      (entry) => entry.name === 'passes with steps' && entry.featureName === 'alpha',
    );
    if (!modelPasses) throw new Error('missing model scenario passes with steps');
    const ruleText = [
      modelPasses.ruleName,
      modelPasses.rule?.name,
      modelPasses.rule?.description,
    ]
      .filter(Boolean)
      .join(' ');
    expect(ruleText).toContain('sample.spec.ts');
    expect(ruleText).toContain('checkout');
    expect(ruleText).not.toContain('@checkout');
    expect(modelPasses.description).toContain('Annotation: issue - TOL-1');

    const fails = scenario(summary, 'fails', 'alpha');
    expect(fails.status).toBe('failed');
    expect(fails.attempt).toBe(1);
    const failure = fails.steps.find((step) => step.status === 'failed');
    expect(failure?.message).toContain('Expected: 2');
    expect(failure?.message).toContain('Received: 1');
    expect(failure?.message).toContain('sample.spec.ts:30');

    const expectedFailure = scenario(summary, 'expected failure', 'alpha');
    expect(expectedFailure.status).toBe('passed');
    expect(expectedFailure.tags).toEqual(
      expect.arrayContaining(['@expected-failure', '@fail']),
    );
    expect(expectedFailure.steps.map((step) => step.status)).toEqual([
      'passed',
    ]);
    const expectedModel = model.scenarios.find(
      (entry) =>
        entry.name === 'expected failure' && entry.featureName === 'alpha',
    );
    expect(expectedModel?.description).toContain('Expected: 2');
    expect(expectedModel?.description).toContain('Received: 1');

    const unexpectedPass = scenario(summary, 'unexpected pass', 'alpha');
    expect(unexpectedPass.status).toBe('failed');
    expect(unexpectedPass.tags).toContain('@unexpected-pass');
    expect(unexpectedPass.steps).toHaveLength(1);
    expect(unexpectedPass.steps[0]?.status).toBe('failed');
    expect(unexpectedPass.steps[0]?.message).toMatch(/unexpected pass/i);

    const flaky = scenario(summary, 'flaky', 'alpha');
    expect(flaky.status).toBe('passed');
    expect(flaky.attempt).toBe(1);
    expect(flaky.tags).toContain('@flaky');
    expect(scenario(summary, 'flaky', 'beta').status).toBe('failed');

    const timedOut = scenario(summary, 'timed out', 'alpha');
    expect(timedOut.status).toBe('failed');
    expect(timedOut.attempt).toBe(1);
    expect(
      timedOut.steps.some(
        (step) =>
          step.status === 'failed' && step.message?.includes('Test timeout'),
      ),
    ).toBe(true);

    const skipped = scenario(summary, 'skipped', 'alpha');
    expect(skipped.status).toBe('skipped');
    expect(skipped.tags).toContain('@skip');
  });

  it('lists one feature per input and project with the loader prefix', async () => {
    const documents = (await loadEnvelopes(realRun))
      .filter((envelope) => envelope.gherkinDocument)
      .map((envelope) => envelope.gherkinDocument?.uri)
      .filter((uri): uri is string => typeof uri === 'string');

    expect(documents).toHaveLength(2);
    expect(documents.every((uri) => /^playwright:\/\/[^/]+\/(alpha|beta)$/.test(uri))).toBe(
      true,
    );
    expect(
      new Set(documents.map((uri) => uri.split('/').slice(0, 3).join('/'))).size,
    ).toBe(1);
    expect(documents.map((uri) => uri.split('/').at(-1)).sort()).toEqual([
      'alpha',
      'beta',
    ]);
  });

  it('renders the Playwright producer version in the HTML', async () => {
    const html = await renderReport(realRun, { title: 'Playwright producer' });

    expect(html).toContain('<dt>Producer</dt><dd>Playwright 1.65.0</dd>');
  });

  it('keeps nested describes in the rule path and strips tags from titles', async () => {
    const summary = await summarizeReport(nestedDescribes);
    const envelopes = await loadEnvelopes(nestedDescribes);
    const model = buildReportModel(envelopes);

    expect(summary.counts.features).toBe(1);
    expect(summary.counts.scenarios.total).toBe(2);
    const documents = envelopes
      .filter((envelope) => envelope.gherkinDocument)
      .map((envelope) => envelope.gherkinDocument?.uri)
      .filter((uri): uri is string => typeof uri === 'string');
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatch(/^playwright:\/\/[^/]+\/chromium$/);

    const pays = model.scenarios.find((entry) => entry.name === 'pays');
    if (!pays) throw new Error('missing nested describe scenario');
    const ruleText = [pays.ruleName, pays.rule?.name, pays.rule?.description]
      .filter(Boolean)
      .join(' ');
    expect(ruleText).toContain('checkout.spec.ts');
    expect(ruleText).toContain('cart');
    expect(ruleText).toContain('payment');
    expect(ruleText).not.toContain('@cart');
    expect(ruleText).not.toContain('@slow');
    expect(ruleText).not.toContain('@payments');
    expect(pays.tags).toEqual(
      expect.arrayContaining(['@payments', '@cart', '@slow', '@smoke']),
    );
    expect(pays.description).toContain('Annotation: issue - TOL-9');

    const paysSummary = scenario(summary, 'pays');
    expect(paysSummary.steps.map((step) => step.status)).toEqual([
      'passed',
      'passed',
      'passed',
    ]);
    expect(paysSummary.steps[0]?.text).toContain('open cart');
    expect(paysSummary.steps[1]?.text).toContain('click pay');
    expect(paysSummary.steps[1]?.text).toContain('card');
    expect(paysSummary.steps[1]?.text).toContain('›');
  });

  it('maps status edge cases without silently passing them', async () => {
    const summary = await summarizeReport(statuses);
    const model = buildReportModel(await loadEnvelopes(statuses));
    const html = await renderReport(statuses, { title: 'Statuses' });

    const interrupted = scenario(summary, 'interrupted');
    expect(interrupted.status).toBe('failed');
    expect(
      interrupted.steps.some((step) =>
        step.message?.includes('Test interrupted by SIGINT'),
      ),
    ).toBe(true);

    const skippedWithoutResults = scenario(summary, 'skipped without results');
    expect(skippedWithoutResults.status).toBe('skipped');
    expect(skippedWithoutResults.executed).toBe(true);
    expect(skippedWithoutResults.steps).toHaveLength(1);
    expect(skippedWithoutResults.steps[0]?.status).toBe('skipped');
    expect(skippedWithoutResults.tags).toContain('@skip');
    const skippedModel = model.scenarios.find(
      (entry) => entry.name === 'skipped without results',
    );
    expect(skippedModel?.description).toContain(
      'Annotation: skip - covered by a manual check',
    );

    const unexecuted = scenario(summary, 'unexecuted without results');
    expect(unexecuted.executed).toBe(false);
    expect(unexecuted.status).not.toBe('passed');
    expect(unexecuted.steps).toEqual([]);
    expect(html).toContain('unexecuted without results');

    const failedWithoutStepError = scenario(
      summary,
      'failed without a step error',
    );
    expect(failedWithoutStepError.status).toBe('failed');
    const ordinaryStep = failedWithoutStepError.steps.find((step) =>
      step.text.includes('call the API'),
    );
    expect(ordinaryStep?.status).toBe('passed');
    const syntheticFailure = failedWithoutStepError.steps.filter(
      (step) => step.status === 'failed',
    );
    expect(syntheticFailure).toHaveLength(1);
    expect(syntheticFailure[0]?.message).toContain('assertion failed');

    const expectedTimeout = scenario(summary, 'expected timeout');
    expect(expectedTimeout.status).toBe('passed');
    expect(expectedTimeout.tags).toEqual(
      expect.arrayContaining(['@expected-failure', '@fail']),
    );
    expect(expectedTimeout.steps.map((step) => step.status)).toEqual([
      'passed',
    ]);
    const expectedTimeoutModel = model.scenarios.find(
      (entry) => entry.name === 'expected timeout',
    );
    expect(expectedTimeoutModel?.description).toContain(
      'Annotation: fail - known slow path',
    );
    expect(expectedTimeoutModel?.description).toContain(
      'Test timeout of 50ms exceeded.',
    );

    expect(summary.counts.scenarios).toMatchObject({
      total: 4,
      failed: 2,
      passed: 1,
      skipped: 1,
    });
  });

  it('counts a statically skipped test without steps as a reported skip', async () => {
    const summary = await summarizeReport(skippedNoStepsFixture);
    const html = await renderReport(skippedNoStepsFixture, {
      title: 'Skipped without steps',
    });

    const skipped = scenario(summary, 'skips without results');
    const passed = scenario(summary, 'passes');

    expect(summary.schemaVersion).toBe(2);
    expect(skipped).toMatchObject({
      status: 'skipped',
      executed: true,
      uri: 'skip.spec.ts',
    });
    expect(skipped.steps).toHaveLength(1);
    expect(skipped.steps[0]?.status).toBe('skipped');
    expect(Object.keys(skipped).sort()).toEqual(Object.keys(passed).sort());
    expect(summary.counts.scenarios).toMatchObject({
      total: 3,
      passed: 1,
      failed: 1,
      skipped: 1,
    });
    expect(html).toContain('skips without results');
    expect(html).toContain('>1</b> skipped');
  });

  it('labels a feature sourced from two spec files with a file count', async () => {
    const html = await renderReport(twoFilesFixture, { title: 'Two files' });
    const featureLabels = [...html.matchAll(/<span class="featureUri">(.*?)<\/span>/g)].map(
      (match) => match[1],
    );
    const matrixLabels = [...html.matchAll(/<span class="matrixUri">(.*?)<\/span>/g)].map(
      (match) => match[1],
    );
    const triageTitles = [
      ...html.matchAll(/<a class="triageFeature"[^>]*title="([^"]*)"/g),
    ].map((match) => match[1]);

    expect(featureLabels).toEqual(['2 spec files']);
    expect(matrixLabels).toEqual(['2 spec files']);
    expect(triageTitles).toEqual(['2 spec files']);
    expect(featureLabels.join(' ')).not.toContain('sample-a.spec.ts');
    expect(featureLabels.join(' ')).not.toContain('sample-b.spec.ts');
    expect(matrixLabels.join(' ')).not.toContain('sample-a.spec.ts');
    expect(matrixLabels.join(' ')).not.toContain('sample-b.spec.ts');
    expect(triageTitles.join(' ')).not.toContain('sample-a.spec.ts');
    expect(triageTitles.join(' ')).not.toContain('sample-b.spec.ts');

    const oneFileHtml = await renderReport(realRun, { title: 'One file' });
    const oneFileLabels = [
      ...oneFileHtml.matchAll(/<span class="featureUri">(.*?)<\/span>/g),
    ].map((match) => match[1]);
    const oneFileMatrix = [
      ...oneFileHtml.matchAll(/<span class="matrixUri">(.*?)<\/span>/g),
    ].map((match) => match[1]);
    const oneFileTriage = [
      ...oneFileHtml.matchAll(/<a class="triageFeature"[^>]*title="([^"]*)"/g),
    ].map((match) => match[1]);
    expect(oneFileLabels).toHaveLength(2);
    expect(oneFileLabels.every((label) => label === 'sample.spec.ts')).toBe(
      true,
    );
    expect(oneFileMatrix).toHaveLength(2);
    expect(oneFileMatrix.every((label) => label === 'sample.spec.ts')).toBe(
      true,
    );
    expect(oneFileTriage.length).toBeGreaterThan(0);
    expect(oneFileTriage.every((label) => label === 'sample.spec.ts')).toBe(
      true,
    );
  });

  it('includes each Playwright error location at most once', async () => {
    const summary = await summarizeReport(errorLocationsFixture);
    const model = buildReportModel(await loadEnvelopes(errorLocationsFixture));
    const description = (name: string): string =>
      model.scenarios.find((entry) => entry.name === name)?.description ?? '';
    const messages = (name: string): string =>
      (summary.scenarios.find((entry) => entry.name === name)?.steps ?? [])
        .map((step) => step.message ?? '')
        .join('\n');
    const normalized = (text: string): string => text.replace(/\\/g, '/');
    const occurrences = (text: string, token: string): number =>
      text.split(token).length - 1;

    const expectedFailure = normalized(
      description('expected failure ends with location'),
    );
    expect(occurrences(expectedFailure, 'at tests/a.spec.ts:44:81')).toBe(1);

    const midSentence = normalized(
      messages('message contains the location mid-sentence'),
    );
    expect(occurrences(midSentence, 'tests/b.spec.ts:12:4')).toBe(1);

    const backslash = normalized(messages('backslash message path'));
    expect(occurrences(backslash, 'tests/c.spec.ts:20:2')).toBe(1);

    const twoErrors = normalized(messages('two errors keep both locations'));
    expect(occurrences(twoErrors, 'at tests/d.spec.ts:10:1')).toBe(1);
    expect(occurrences(twoErrors, 'at tests/e.spec.ts:11:2')).toBe(1);

    const noColumn = normalized(messages('location without a column'));
    expect(occurrences(noColumn, 'at tests/f.spec.ts:30')).toBe(1);

    const linePrefix = normalized(messages('line prefix is not the location'));
    expect(linePrefix).toContain('tests/g.spec.ts:12');
    expect(
      linePrefix.match(/(?:^|\n)at tests\/g\.spec\.ts:1(?:\n|$)/g) ?? [],
    ).toHaveLength(1);

    const lineWithColumn = normalized(
      messages('location without a column matches a column in the message'),
    );
    expect(occurrences(lineWithColumn, 'at tests/x.spec.ts:50:12')).toBe(1);
    expect(occurrences(lineWithColumn, 'at tests/x.spec.ts:50')).toBe(1);
  });

  it('uses step errors for step status and keeps other steps passed', async () => {
    const summary = await summarizeReport(stepsFixture);
    const failed = scenario(summary, 'one step failed');

    expect(failed.status).toBe('failed');
    expect(failed.steps.map((step) => step.status)).toEqual([
      'passed',
      'failed',
      'passed',
    ]);
    expect(failed.steps.map((step) => step.durationMs)).toEqual([1, 2, 3]);
    expect(failed.steps[0]?.text).toContain('setup');
    expect(failed.steps[1]?.text).toContain('click submit');
    expect(failed.steps[1]?.text).toContain('button');
    expect(failed.steps[1]?.message).toContain('click failed');
    expect(failed.steps[2]?.text).toContain('cleanup');

    const skipped = scenario(summary, 'skipped with steps');
    expect(skipped.status).toBe('skipped');
    expect(skipped.steps.map((step) => step.status)).toEqual(['skipped']);
  });

  it('embeds inline and safe path attachments with declared content types', async () => {
    const summary = await summarizeReport(realRun);
    const html = await renderReport(realRun, { title: 'Attachments' });

    expect(scenario(summary, 'passes with steps', 'alpha').attachments).toBe(2);
    expect(scenario(summary, 'fails', 'alpha').attachments).toBe(2);
    expect(summary.attachments.bytes).toBeGreaterThan(0);

    expect(html).toContain('hello from playwright');
    expect(html).toContain('path attachment for the Playwright adapter fixture');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('(image/png)');
    expect(html).toContain('text/plain');
  });

  it('renders a markdown error context as readable plain text', async () => {
    const html = await renderReport(realRun, { title: 'Error context' });

    expect(html).toContain('Page snapshot');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('text/markdown');
    expect(html).not.toContain('<img src="x"');
  });

  it('maps stdout and stderr entries to attachments without rendering HTML', async () => {
    const summary = await summarizeReport(outputFixture);
    const html = await renderReport(outputFixture, { title: 'Output' });

    expect(summary.scenarios[0]?.attachments).toBe(4);
    expect(summary.attachments.total).toBe(4);
    expect(html).toContain('stdout line');
    expect(html).toContain('stderr line');
    expect(html.match(/\(text\/plain\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(
      html.match(/\(application\/octet-stream/g)?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<b>buffer out</b>');
  });

  it('accepts an empty Playwright run with zero scenarios', async () => {
    const summary = await summarizeReport(emptyFixture);
    const html = await renderReport(emptyFixture, { title: 'Empty' });

    expect(summary.counts.features).toBe(0);
    expect(summary.counts.scenarios.total).toBe(0);
    expect(summary.scenarios).toEqual([]);
    expect(html).toContain('No scenarios in this report.');
  });

  it('renders run-level errors as a failed Playwright feature', async () => {
    const summary = await summarizeReport(errorsFixture);
    const html = await renderReport(errorsFixture, { title: 'Run errors' });

    expect(summary.counts.features).toBe(1);
    expect(summary.counts.scenarios).toMatchObject({
      total: 1,
      failed: 1,
      passed: 0,
    });
    const failure = summary.scenarios[0];
    expect(failure?.feature).toContain('Playwright');
    expect(failure?.status).toBe('failed');
    expect(failure?.steps[0]?.message).toContain('No tests found');
    expect(failure?.steps[0]?.message).toContain('playwright.config.ts:3');
    expect(html).toContain('No tests found');
    expect(html).toContain('playwright.config.ts');
  });

  it('rejects malformed Playwright shapes with a file-specific error', async () => {
    const cases: Array<[string, RegExp]> = [
      ['malformed-suites.json', /suites/],
      ['malformed-specs.json', /suites\[0\]\.specs/],
      ['malformed-results.json', /results/],
      ['malformed-attachment.json', /attachment/i],
    ];

    for (const [name, detail] of cases) {
      const file = playwrightFixture(name);
      await expect(renderReport(file, { title: 'Broken' })).rejects.toThrow(
        new RegExp(`Invalid Playwright JSON in .*${name}`),
      );
      await expect(renderReport(file, { title: 'Broken' })).rejects.toThrow(
        detail,
      );
    }
  });

  it('normalizes absolute error locations to relative paths', async () => {
    const dir = await tempDir();
    const outside = path.join(tmpdir(), 'tolkira-outside-locations', 'sample.spec.ts');
    const report = JSON.parse(await readFile(realRun, 'utf8')) as Record<
      string,
      unknown
    >;
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      for (const [key, child] of Object.entries(record)) {
        if (key === 'location' && child && typeof child === 'object') {
          const location = child as Record<string, unknown>;
          if (typeof location.file === 'string') location.file = outside;
        } else if (key === 'errorLocation' && child && typeof child === 'object') {
          const location = child as Record<string, unknown>;
          if (typeof location.file === 'string') location.file = outside;
        } else {
          visit(child);
        }
      }
    };
    visit(report);
    const input = await writeReport(dir, report);

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Locations' });
    const fails = scenario(summary, 'fails', 'alpha');
    const message = fails.steps.find((step) => step.status === 'failed')?.message;

    expect(message).toContain('sample.spec.ts');
    expect(message).not.toContain(outside);
    expect(html).not.toContain(outside);
  });

  it('embeds an absolute attachment path inside the process working directory', async () => {
    const dir = await tempDir();
    const cwdFile = path.resolve(
      'test/fixtures/playwright/attachments/note-file.txt',
    );
    const input = await writeReport(
      dir,
      reportWithAttachments([
        { name: 'cwd-note', contentType: 'text/plain', path: cwdFile },
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'CWD attachment' });

    expect(summary.scenarios[0]?.attachments).toBe(1);
    expect(html).toContain('path attachment for the Playwright adapter fixture');
  });

  it('skips missing, outside-tree and non-regular attachment paths', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-playwright-outside-');
    const secret = path.join(outside, 'secret.md');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    await mkdir(path.join(dir, 'folder'));
    const input = await writeReport(
      dir,
      reportWithAttachments([
        {
          name: 'absolute-outside',
          contentType: 'text/plain',
          path: secret,
        },
        {
          name: 'relative-outside',
          contentType: 'text/plain',
          path: path.relative(dir, secret),
        },
        { name: 'missing', contentType: 'text/plain', path: 'missing.md' },
        { name: 'folder', contentType: 'text/plain', path: 'folder' },
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Unsafe attachments' });

    expect(summary.scenarios[0]?.attachments).toBe(0);
    expect(summary.attachments.total).toBe(0);
    expect(html).not.toContain('outside secret must not be read');
  });

  it('counts a final-attempt path attachment outside the input folder and cwd', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-playwright-outside-');
    const secret = path.join(outside, 'secret.md');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    const source = path.join(dir, 'report.json');

    const { envelopes, skippedAttachments } = await parsePlaywright(
      reportWithAttachments([
        { name: 'absolute-outside', contentType: 'text/plain', path: secret },
      ]),
      source,
    );

    expect(skippedAttachments).toBe(1);
    expect(attachmentTexts(envelopes)).toEqual([]);
  });

  it('does not count a relative attachment that resolves through the working directory', async () => {
    const dir = await tempDir();
    const source = path.join(dir, 'report.json');

    const { envelopes, skippedAttachments } = await parsePlaywright(
      reportWithAttachments([
        {
          name: 'cwd-relative',
          contentType: 'text/plain',
          path: 'test/fixtures/playwright/attachments/note-file.txt',
        },
      ]),
      source,
    );

    expect(skippedAttachments).toBe(0);
    expect(attachmentTexts(envelopes)).toEqual([
      'path attachment for the Playwright adapter fixture',
    ]);
  });

  it('does not count an outside path when an inline body is present', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-playwright-outside-');
    const secret = path.join(outside, 'secret.md');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    const source = path.join(dir, 'report.json');

    const { envelopes, skippedAttachments } = await parsePlaywright(
      reportWithAttachments([
        {
          name: 'inline-first',
          contentType: 'text/plain',
          body: Buffer.from('from the body', 'utf8').toString('base64'),
          path: secret,
        },
      ]),
      source,
    );

    expect(skippedAttachments).toBe(0);
    expect(attachmentTexts(envelopes)).toEqual(['from the body']);
  });

  it('does not count missing, directory, URL-scheme or UNC attachment paths', async () => {
    const dir = await tempDir();
    await mkdir(path.join(dir, 'folder'));
    const source = path.join(dir, 'report.json');

    const { envelopes, skippedAttachments } = await parsePlaywright(
      reportWithAttachments([
        { name: 'missing', contentType: 'text/plain', path: 'missing.md' },
        { name: 'folder', contentType: 'text/plain', path: 'folder' },
        {
          name: 'http',
          contentType: 'text/plain',
          path: 'http://example.com/secret.txt',
        },
        {
          name: 'unc',
          contentType: 'text/plain',
          path: '\\\\server\\share\\secret.md',
        },
      ]),
      source,
    );

    expect(skippedAttachments).toBe(0);
    expect(attachmentTexts(envelopes)).toEqual([]);
  });

  it.skipIf(process.platform === 'win32')(
    'does not count a symlinked attachment path',
    async () => {
      const dir = await tempDir();
      const outside = await tempDir('tolkira-playwright-outside-');
      const secret = path.join(outside, 'secret.md');
      await writeFile(secret, 'symlink secret must not be read', 'utf8');
      const link = path.join(dir, 'link.md');
      await symlink(secret, link, 'file');
      const source = path.join(dir, 'report.json');

      const { envelopes, skippedAttachments } = await parsePlaywright(
        reportWithAttachments([
          { name: 'symlink', contentType: 'text/plain', path: 'link.md' },
        ]),
        source,
      );

      expect(skippedAttachments).toBe(0);
      expect(attachmentTexts(envelopes)).toEqual([]);
    },
  );

  it('does not count trace zips or earlier-attempt attachments', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-playwright-outside-');
    const earlier = path.join(outside, 'earlier.png');
    const trace = path.join(outside, 'trace.zip');
    await writeFile(earlier, 'earlier attempt must not be read', 'utf8');
    await writeFile(trace, 'trace path marker', 'utf8');
    const source = path.join(dir, 'report.json');

    const { envelopes, skippedAttachments } = await parsePlaywright(
      playwrightReport([
        playwrightSpec(
          'retried outside attachment',
          [
            passedResult({
              retry: 0,
              attachments: [
                { name: 'earlier', contentType: 'image/png', path: earlier },
              ],
            }),
            passedResult({
              retry: 1,
              attachments: [
                {
                  name: 'trace',
                  contentType: 'application/zip',
                  path: trace,
                },
              ],
            }),
          ],
          'sample.spec.ts',
          'flaky',
        ),
      ]),
      source,
    );

    expect(skippedAttachments).toBe(0);
    expect(attachmentTexts(envelopes)).toEqual([]);
  });

  it('sums skipped attachments across inputs and counts a duplicate input once', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-playwright-outside-');
    const first = path.join(outside, 'first.md');
    const second = path.join(outside, 'second.md');
    await writeFile(first, 'first outside secret', 'utf8');
    await writeFile(second, 'second outside secret', 'utf8');
    const firstInput = await writeReport(
      dir,
      reportWithAttachments(
        [{ name: 'first', contentType: 'text/plain', path: first }],
        'first input',
      ),
      'first.json',
    );
    const secondInput = await writeReport(
      dir,
      reportWithAttachments(
        [{ name: 'second', contentType: 'text/plain', path: second }],
        'second input',
      ),
      'second.json',
    );

    const both = await generateReport([firstInput, secondInput], {
      title: 'Two inputs',
    });
    expect(both.skippedAttachments).toBe(2);
    expect(both.html).toContain('2 path attachments were skipped');

    const twice = await generateReport([firstInput, firstInput], {
      title: 'Duplicate input',
    });
    expect(twice.skippedAttachments).toBe(1);
    expect(twice.html).toContain('1 path attachment was skipped');
  });

  it('keeps source order when tests mix results and path attachments', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'note.txt'), 'order attachment', 'utf8');
    const input = await writeReport(
      dir,
      playwrightReport([
        playwrightSpec('first plain', [passedResult()]),
        playwrightSpec('second no result', []),
        playwrightSpec('third path attachment', [
          passedResult({
            attachments: [
              {
                name: 'order-note',
                contentType: 'text/plain',
                path: 'note.txt',
              },
            ],
          }),
        ]),
        playwrightSpec('fourth plain', [passedResult()]),
      ]),
    );

    const model = buildReportModel(await loadEnvelopes(input));
    const html = await renderReport(input, { title: 'Order' });
    const names = model.scenarios
      .filter((entry) => entry.featureName === 'chromium')
      .map((entry) => entry.name);

    expect(names).toEqual([
      'first plain',
      'second no result',
      'third path attachment',
      'fourth plain',
    ]);
    // The report intentionally groups rows by status, so HTML order is not
    // source order; rendering must still be deterministic.
    const again = await renderReport(input, { title: 'Order' });
    expect(again).toBe(html);
  });

  it('skips URL, device and UNC attachment paths without reading them', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'note.txt'), 'safe local attachment', 'utf8');
    const input = await writeReport(
      dir,
      reportWithAttachments([
        {
          name: 'http',
          contentType: 'text/plain',
          path: 'http://example.com/secret.txt',
        },
        {
          name: 'https',
          contentType: 'text/plain',
          path: 'https://example.com/secret.txt',
        },
        {
          name: 'file-url',
          contentType: 'text/plain',
          path: 'file:///etc/passwd',
        },
        {
          name: 'unc-backslash',
          contentType: 'text/plain',
          path: '\\\\server\\share\\UNC secret must not be read',
        },
        {
          name: 'unc-forward',
          contentType: 'text/plain',
          path: '//server/share/UNC secret must not be read',
        },
        { name: 'safe', contentType: 'text/plain', path: 'note.txt' },
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Remote paths' });

    expect(summary.scenarios[0]?.attachments).toBe(1);
    expect(html).toContain('safe local attachment');
    expect(html).not.toContain('UNC secret must not be read');
    expect(html).not.toContain('server/share');
  });

  it('resolves a relative attachment path against the input directory, then cwd', async () => {
    const dir = await tempDir();
    const input = await writeReport(
      dir,
      reportWithAttachments([
        {
          name: 'cwd-relative',
          contentType: 'text/plain',
          path: 'test/fixtures/playwright/attachments/note-file.txt',
        },
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Relative fallback' });

    expect(summary.scenarios[0]?.attachments).toBe(1);
    expect(html).toContain('path attachment for the Playwright adapter fixture');
  });

  it('embeds a non-empty inline body before reading its path', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'note.txt'), 'from the path', 'utf8');
    const input = await writeReport(
      dir,
      reportWithAttachments([
        {
          name: 'inline-first',
          contentType: 'text/plain',
          body: Buffer.from('from the body', 'utf8').toString('base64'),
          path: 'note.txt',
        },
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Body precedence' });

    expect(summary.scenarios[0]?.attachments).toBe(1);
    expect(html).toContain('from the body');
    expect(html).not.toContain('from the path');
  });

  it('falls back to a path attachment when the inline body is empty', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'note.txt'), 'from the path', 'utf8');
    const input = await writeReport(
      dir,
      reportWithAttachments([
        {
          name: 'empty-body',
          contentType: 'text/plain',
          body: '',
          path: 'note.txt',
        },
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Empty body' });

    expect(summary.scenarios[0]?.attachments).toBe(1);
    expect(html).toContain('from the path');
  });

  it('keeps multiple path attachments in declared order', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'first.txt'), 'first path attachment', 'utf8');
    await writeFile(path.join(dir, 'second.txt'), 'second path attachment', 'utf8');
    const input = await writeReport(
      dir,
      reportWithAttachments([
        { name: 'first', contentType: 'text/plain', path: 'first.txt' },
        { name: 'second', contentType: 'text/plain', path: 'second.txt' },
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Path order' });

    expect(summary.scenarios[0]?.attachments).toBe(2);
    expect(html.indexOf('first path attachment')).toBeGreaterThan(-1);
    expect(html.indexOf('first path attachment')).toBeLessThan(
      html.indexOf('second path attachment'),
    );
  });

  it('skips Playwright trace attachments and keeps ordinary zip bodies', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'trace.zip'), 'trace path marker', 'utf8');
    const input = await writeReport(
      dir,
      reportWithAttachments([
        {
          name: 'trace',
          contentType: 'application/zip',
          body: Buffer.from('trace body marker', 'utf8').toString('base64'),
        },
        {
          name: 'trace',
          contentType: 'application/zip',
          path: 'trace.zip',
        },
        {
          name: 'archive',
          contentType: 'application/zip',
          body: Buffer.from('ordinary zip marker', 'utf8').toString('base64'),
        },
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Traces' });

    expect(summary.scenarios[0]?.attachments).toBe(1);
    expect(html).not.toContain('trace body marker');
    expect(html).not.toContain('trace path marker');
  });

  it('removes absolute local paths from error messages and snippets', async () => {
    const dir = await tempDir();
    const inputDir = await realpath(dir);
    const inside = path.join(inputDir, 'tests', 'sample.spec.ts');
    const windowsOutside = 'C:\\Users\\tolkira\\private\\secret.spec.ts';
    const posixOutside = '/home/tolkira/private/secret.spec.ts';
    const report = await realRunCopy();
    mutateErrors(report, (error) => {
      error.message = `Error: expected checkout\n  at ${inside}:30:15\n  at ${windowsOutside}:3:4\n  at ${posixOutside}:5:6`;
      error.stack = `Error: expected checkout\n    at ${windowsOutside}:3:4`;
      error.snippet = `> 30 | expect(1).toBe(2)\n    at ${posixOutside}:5:6`;
    });
    const input = await writeReport(dir, report);

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Scrubbed paths' });
    const fails = scenario(summary, 'fails', 'alpha');
    const message =
      fails.steps.find((step) => step.status === 'failed')?.message ?? '';

    expect(message).toContain('expected checkout');
    expect(message).toContain('sample.spec.ts');
    expect(message).not.toContain(inputDir);
    expect(message).not.toContain(windowsOutside);
    expect(message).not.toContain(posixOutside);
    expect(html).toContain('expected checkout');
    expect(html).not.toContain(inputDir);
    expect(html).not.toContain(windowsOutside);
    expect(html).not.toContain(posixOutside);
  });

  it('strips ANSI and control codes from error text', async () => {
    const dir = await tempDir();
    const report = await realRunCopy();
    mutateErrors(report, (error) => {
      error.message = '\u001b[31mExpected 2\u001b[0m\n\u0007Received 1';
      error.stack = '\u001b[1mstack trace\u001b[0m';
      error.snippet = '\u001b[32m> 1 | expect(1).toBe(2)\u001b[0m';
    });
    const input = await writeReport(dir, report);

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'Control codes' });
    const fails = scenario(summary, 'fails', 'alpha');
    const message =
      fails.steps.find((step) => step.status === 'failed')?.message ?? '';

    expect(message).toContain('Expected 2');
    expect(message).toContain('Received 1');
    expect(message).not.toContain('\u001b');
    expect(message).not.toContain('\u0007');
    expect(html).toContain('Expected 2');
    expect(html).not.toContain('\u001b');
    expect(html).not.toContain('\u0007');
  });

  it('removes common POSIX local roots from stack text but keeps URLs', async () => {
    const dir = await tempDir();
    const tmpPath = '/tmp/secret/project/file.ts';
    const varPath = '/var/secret/file.ts';
    const buildsPath = '/builds/ci/project/file.ts';
    const url = 'https://example.com/tmp/report';
    const input = await writeReport(
      dir,
      playwrightReport([
        playwrightSpec(
          'stack only',
          [
            passedResult({
              status: 'failed',
              error: {
                stack: `Error: stack failure\n at ${tmpPath}:1:2\n at ${varPath}:3:4\n at ${buildsPath}:5:6`,
                snippet: `see ${url} for context`,
              },
            }),
          ],
          'sample.spec.ts',
          'unexpected',
        ),
      ]),
    );

    const summary = await summarizeReport(input);
    const html = await renderReport(input, { title: 'POSIX paths' });
    const message =
      summary.scenarios[0]?.steps.find((step) => step.status === 'failed')
        ?.message ?? '';

    expect(message).toContain('stack failure');
    expect(message).not.toContain(tmpPath);
    expect(message).not.toContain(varPath);
    expect(message).not.toContain(buildsPath);
    expect(html).not.toContain(tmpPath);
    expect(html).not.toContain(varPath);
    expect(html).not.toContain(buildsPath);
    expect(html).toContain(url);
  });

  it('shows a failure once when Playwright duplicates it in error and errors', async () => {
    const dir = await tempDir();
    const duplicated = 'Error: duplicate detail';
    const input = await writeReport(
      dir,
      playwrightReport([
        playwrightSpec(
          'duplicated error',
          [
            passedResult({
              status: 'failed',
              error: { message: duplicated },
              errors: [{ message: duplicated }],
            }),
          ],
          'sample.spec.ts',
          'unexpected',
        ),
      ]),
    );

    const summary = await summarizeReport(input);
    const message =
      summary.scenarios[0]?.steps.find((step) => step.status === 'failed')
        ?.message ?? '';

    expect(message).toContain('duplicate detail');
    expect(message.match(/duplicate detail/g)).toHaveLength(1);
    expect(JSON.stringify(summary).match(/duplicate detail/g)).toHaveLength(1);
  });

  it('normalizes an absolute spec file to a relative rule and URI', async () => {
    const dir = await tempDir();
    const realDir = await realpath(dir);
    const absolute = path.join(realDir, 'nested', 'abs.spec.ts');
    const input = await writeReport(
      dir,
      playwrightReport([playwrightSpec('absolute file', [passedResult()], absolute)]),
    );

    const summary = await summarizeReport(input);
    const model = buildReportModel(await loadEnvelopes(input));

    expect(summary.scenarios[0]?.uri).toBe('nested/abs.spec.ts');
    expect(model.scenarios[0]?.ruleName).toContain('nested/abs.spec.ts');
    expect(JSON.stringify(model)).not.toContain(realDir);
  });

  it('strips long trailing tag runs without backtracking', async () => {
    const tags = ' @tag'.repeat(20_000);
    const dir = await tempDir();
    const input = await writeReport(
      dir,
      reportWithAttachments([], `long title${tags}`),
    );
    expect((await summarizeReport(input)).scenarios[0]?.name).toBe('long title');

    const partialDir = await tempDir();
    const partial = `long partial${tags} @`;
    const partialInput = await writeReport(
      partialDir,
      reportWithAttachments([], partial),
    );
    expect((await summarizeReport(partialInput)).scenarios[0]?.name).toBe(partial);
  }, 2000);

  it.skipIf(process.platform === 'win32')(
    'skips symlinked attachment paths',
    async () => {
      const dir = await tempDir();
      const outside = await tempDir('tolkira-playwright-outside-');
      const secret = path.join(outside, 'secret.md');
      await writeFile(secret, 'symlink secret must not be read', 'utf8');
      const link = path.join(dir, 'link.md');
      await symlink(secret, link, 'file');
      const input = await writeReport(
        dir,
        reportWithAttachments([
          { name: 'symlink', contentType: 'text/plain', path: 'link.md' },
        ]),
      );

      const summary = await summarizeReport(input);
      const html = await renderReport(input, { title: 'Symlink attachment' });

      expect(summary.scenarios[0]?.attachments).toBe(0);
      expect(html).not.toContain('symlink secret must not be read');
    },
  );

  it('rejects a path attachment above the size limit before writing output', async () => {
    const dir = await tempDir();
    const large = path.join(dir, 'large.bin');
    const handle = await open(large, 'w');
    await handle.truncate(50 * 1024 * 1024 + 1);
    await handle.close();
    const input = await writeReport(
      dir,
      reportWithAttachments([
        { name: 'large', contentType: 'application/octet-stream', path: 'large.bin' },
      ]),
    );
    const output = path.join(dir, 'report.html');
    let stderr = '';

    const code = await runCli([input, '--out', output], {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toMatch(/50 MB/);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('deduplicates a Playwright file passed twice or through its directory', async () => {
    const dir = await tempDir();
    const copy = path.join(dir, 'real-run.json');
    await copyFile(realRun, copy);

    expect(await loadInputs([realRun, realRun])).toHaveLength(1);
    expect(await loadInputs([dir, copy])).toHaveLength(1);
    const doubled = await summarizeReport([realRun, realRun]);
    const directoryAndFile = await summarizeReport([dir, copy]);
    expect(doubled.counts.scenarios.total).toBe(16);
    expect(directoryAndFile.counts.scenarios.total).toBe(16);
  });

  it('merges Playwright with Cucumber and JUnit inputs with stable unique ids', async () => {
    const inputs = {
      playwright: realRun,
      legacy: legacyFixture('happy.json'),
      junit: junitFixture('basic.xml'),
      messages: messagesFixture('screenshot.ndjson'),
    };
    const parts = await Promise.all(
      Object.values(inputs).map((file) => summarizeReport(file)),
    );
    const mergedInputs = [
      inputs.playwright,
      inputs.legacy,
      inputs.junit,
      inputs.messages,
    ];
    const merged = await summarizeReport(mergedInputs);
    const again = await summarizeReport(mergedInputs);
    const envelopes = await loadEnvelopes(mergedInputs);
    const ids = envelopes
      .flatMap((envelope) => [
        envelope.pickle?.id,
        envelope.testCase?.id,
        envelope.testCaseStarted?.id,
      ])
      .filter((id): id is string => typeof id === 'string');

    expect(merged.counts.scenarios.total).toBe(
      parts.reduce((sum, part) => sum + part.counts.scenarios.total, 0),
    );
    expect(merged.counts.features).toBe(
      parts.reduce((sum, part) => sum + part.counts.features, 0),
    );
    expect(merged.scenarios.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'passes with steps',
        'expired coupon',
        'Attach a screenshot',
        'Fred wants to see passing scenarios in the HTML report',
      ]),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(again)).toBe(JSON.stringify(merged));
  });

  it('exits non-zero and writes no output for a malformed Playwright file', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    let stderr = '';

    const code = await runCli(
      [playwrightFixture('malformed-suites.json'), '--out', output],
      {
        stdout: () => undefined,
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(code).toBe(1);
    expect(stderr).toMatch(/Invalid Playwright JSON in .*malformed-suites\.json/);
    expect(stderr).not.toContain('Unsupported input');
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
