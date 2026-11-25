import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Envelope } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { parseJUnitXml } from '../src/input/junit.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { loadEnvelopes } from '../src/input/load.js';
import { parseMessages } from '../src/input/messages.js';
import { playwrightFixture } from './fixtures.js';
import { buildReportModel, type ReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import { type ReportStatus, statusSeverity, worstExecutedStatus } from '../src/report/status.js';
import { displayUri, summarizeEnvelopes, type ReportSummary } from '../src/summary.js';

const fixture = (path: string): string =>
  fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));

interface CrossCheckCase {
  name: string;
  load: () => Promise<Envelope[]>;
}

const messagesCase = (name: string): CrossCheckCase => ({
  name: `messages/${name}`,
  load: async () =>
    parseMessages(
      await readFile(fixture(`messages/${name}.ndjson`), 'utf8'),
      `${name}.ndjson`,
    ),
});

const legacyCase = (name: string): CrossCheckCase => ({
  name: `legacy/${name}`,
  load: async () => {
    const file = fixture(`legacy/${name}.json`);
    return parseLegacyJson(await readFile(file, 'utf8'), file, {
      idPrefix: 'cross-check',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  },
});

const cases: CrossCheckCase[] = [
  ...[
    'screenshot',
    'examples-tables',
    'examples-tables-attachment',
    'hooks',
    'global-hooks',
    'global-hooks-attachments',
    'undefined',
    'ambiguous',
    'all-statuses',
    'rules',
    'rules-backgrounds',
    'backgrounds',
    'tags',
    'empty',
    'empty-mixed',
    'empty-all-unexecuted',
    'empty-unfinished',
    'empty-hook-only',
    'empty-retry',
    'empty-none',
    'empty-outline-mixed',
    'empty-unexecuted-attachment',
  ].map((entry) => messagesCase(entry)),
  ...['happy', 'failed', 'screenshot', 'empty', 'missing-result', 'behave'].map(
    (entry) => legacyCase(entry),
  ),
  {
    name: 'junit/basic',
    load: async () =>
      parseJUnitXml(
        await readFile(fixture('junit/basic.xml'), 'utf8'),
        'basic.xml',
      ),
  },
  {
    name: 'playwright/real-run',
    load: async () => loadEnvelopes(playwrightFixture('real-run.json')),
  },
  {
    name: 'playwright/statuses',
    load: async () => loadEnvelopes(playwrightFixture('statuses.json')),
  },
];

interface ScenarioFingerprint {
  name: string;
  uri: string;
  status: ReportStatus;
  executed: boolean;
  attempt: number;
  durationMs: number;
  tags: string[];
  steps: ReportStatus[];
  hooks: ReportStatus[];
  attachments: number;
}

const sorted = (rows: ScenarioFingerprint[]): ScenarioFingerprint[] =>
  [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

function modelFingerprint(model: ReportModel): ScenarioFingerprint[] {
  return sorted(
    model.scenarios.map((scenario) => ({
      name: scenario.name,
      uri: displayUri(scenario.uri),
      status: scenario.status,
      executed: scenario.executed,
      attempt: scenario.attempt,
      durationMs: scenario.durationMs,
      tags: [...scenario.tags],
      steps: scenario.steps.map((step) => step.status),
      hooks: scenario.hooks.map((hook) => hook.status),
      attachments: scenario.attachments.length,
    })),
  );
}

function summaryFingerprint(summary: ReportSummary): ScenarioFingerprint[] {
  return sorted(
    summary.scenarios.map((scenario) => ({
      name: scenario.name,
      uri: scenario.uri,
      status: scenario.status,
      executed: scenario.executed,
      attempt: scenario.attempt,
      durationMs: scenario.durationMs,
      tags: [...scenario.tags],
      steps: scenario.steps
        .filter((step) => step.keyword !== 'Hook')
        .map((step) => step.status),
      hooks: scenario.steps
        .filter((step) => step.keyword === 'Hook')
        .map((step) => step.status),
      attachments: scenario.attachments,
    })),
  );
}

interface SyntheticCase {
  secondStep?: boolean;
  finishSecondStep?: boolean;
  attachments?: Array<Record<string, unknown>>;
  runHook?: boolean;
}

/**
 * One executed scenario with ts1 passed. An optional ts2 can be present with or
 * without a result, and attachments can name any owner id.
 */
function syntheticCase(options: SyntheticCase = {}): Envelope[] {
  const testSteps: Array<Record<string, unknown>> = [
    { id: 'ts1', pickleStepId: 'ps1' },
  ];
  const pickleSteps: Array<Record<string, unknown>> = [
    { id: 'ps1', text: 'a step', astNodeIds: ['ast-1'] },
  ];
  if (options.secondStep) {
    testSteps.push({ id: 'ts2', pickleStepId: 'ps2' });
    pickleSteps.push({ id: 'ps2', text: 'another step', astNodeIds: ['ast-2'] });
  }
  const envelopes: Array<Record<string, unknown>> = [
    {
      gherkinDocument: {
        uri: 'features/audit5.feature',
        feature: {
          name: 'Audit five',
          keyword: 'Feature',
          language: 'en',
          tags: [],
          children: [
            {
              scenario: {
                id: 'scenario-1',
                keyword: 'Scenario',
                name: 'Attachment case',
                description: '',
                tags: [],
                steps: [
                  {
                    id: 'ast-1',
                    keyword: 'Given ',
                    keywordType: 'Context',
                    text: 'a step',
                    location: { line: 1, column: 1 },
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
        id: 'pickle-1',
        uri: 'features/audit5.feature',
        name: 'Attachment case',
        language: 'en',
        astNodeIds: ['scenario-1'],
        tags: [],
        steps: pickleSteps,
      },
    },
    { testCase: { id: 'tc1', pickleId: 'pickle-1', testSteps } },
    {
      testCaseStarted: {
        id: 'tcs1',
        testCaseId: 'tc1',
        attempt: 0,
        timestamp: { seconds: 1, nanos: 0 },
      },
    },
    {
      testStepFinished: {
        testCaseStartedId: 'tcs1',
        testStepId: 'ts1',
        testStepResult: {
          status: 'PASSED',
          duration: { seconds: 0, nanos: 1 },
        },
        timestamp: { seconds: 1, nanos: 1 },
      },
    },
  ];
  if (options.secondStep && options.finishSecondStep) {
    envelopes.push({
      testStepFinished: {
        testCaseStartedId: 'tcs1',
        testStepId: 'ts2',
        testStepResult: {
          status: 'PASSED',
          duration: { seconds: 0, nanos: 1 },
        },
        timestamp: { seconds: 1, nanos: 2 },
      },
    });
  }
  for (const attachment of options.attachments ?? []) {
    envelopes.push({
      attachment: {
        body: Buffer.from('attachment').toString('base64'),
        mediaType: 'text/plain',
        testCaseStartedId: 'tcs1',
        ...attachment,
      },
    });
  }
  envelopes.push({
    testCaseFinished: {
      testCaseStartedId: 'tcs1',
      timestamp: { seconds: 1, nanos: 3 },
      willBeRetried: false,
    },
  });
  if (options.runHook) {
    envelopes.push(
      {
        testRunStarted: {
          id: 'run-1',
          timestamp: { seconds: 1, nanos: 0 },
        },
      },
      {
        hook: {
          id: 'hook-1',
          type: 'BEFORE_TEST_RUN',
          sourceReference: { uri: 'hooks.ts', location: { line: 1 } },
        },
      },
      {
        testRunHookStarted: {
          id: 'hook-start',
          testRunStartedId: 'run-1',
          hookId: 'hook-1',
          timestamp: { seconds: 1, nanos: 0 },
        },
      },
      {
        testRunHookFinished: {
          testRunHookStartedId: 'hook-start',
          result: {
            status: 'PASSED',
            duration: { seconds: 0, nanos: 1 },
          },
          timestamp: { seconds: 1, nanos: 4 },
        },
      },
    );
  }
  return envelopes as unknown as Envelope[];
}

function detailsAttachmentCount(html: string): number {
  const match = /<dt>Attachments<\/dt><dd>(\d+)<\/dd>/.exec(html);
  if (!match) throw new Error('missing Details attachment count');
  return Number(match[1]);
}

describe('rendered attachment parity', () => {
  async function crossCheck(
    options: SyntheticCase,
  ): Promise<{
    model: ReportModel;
    summary: ReportSummary;
    details: number;
    html: string;
  }> {
    const envelopes = syntheticCase(options);
    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);
    const html = await renderHtml(envelopes, { title: 'Attachment parity' });
    return {
      model,
      summary,
      details: detailsAttachmentCount(html),
      html,
    };
  }

  it('does not count an attachment on an absent test step', async () => {
    const { model, summary, details, html } = await crossCheck({
      attachments: [{ testStepId: 'absent' }],
    });

    expect(html).not.toContain('class="attachment"');
    expect(summary.scenarios[0]?.attachments).toBe(0);
    expect(summary.attachments.total).toBe(0);
    expect(summary.attachments.bytes).toBe(0);
    expect(model.counts.attachments).toBe(0);
    expect(model.counts.attachmentBytes).toBe(0);
    expect(details).toBe(0);
  });

  it('does not count an attachment on a step without a result', async () => {
    const { model, summary, details, html } = await crossCheck({
      secondStep: true,
      finishSecondStep: false,
      attachments: [{ testStepId: 'ts2' }],
    });

    expect(html).not.toContain('class="attachment"');
    expect(summary.scenarios[0]?.attachments).toBe(0);
    expect(summary.attachments.total).toBe(0);
    expect(summary.attachments.bytes).toBe(0);
    expect(model.counts.attachments).toBe(0);
    expect(model.counts.attachmentBytes).toBe(0);
    expect(details).toBe(0);
  });

  it('does not count a run-hook attachment without a matching start', async () => {
    const { model, summary, details, html } = await crossCheck({
      attachments: [{ testCaseStartedId: undefined, testRunHookStartedId: 'missing' }],
    });

    expect(html).not.toContain('class="attachment"');
    expect(html).not.toContain('Run hooks');
    expect(summary.scenarios[0]?.attachments).toBe(0);
    expect(summary.attachments.total).toBe(0);
    expect(summary.attachments.bytes).toBe(0);
    expect(model.counts.attachments).toBe(0);
    expect(model.counts.attachmentBytes).toBe(0);
    expect(details).toBe(0);
  });

  it('counts an attachment once on a rendered step with a result', async () => {
    const { model, summary, details } = await crossCheck({
      attachments: [{ testStepId: 'ts1' }],
    });

    expect(summary.scenarios[0]?.attachments).toBe(1);
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBe(model.counts.attachmentBytes);
    expect(model.counts.attachments).toBe(1);
    expect(details).toBe(1);
  });

  it('counts an attachment without a test step id with its scenario', async () => {
    const { model, summary, details } = await crossCheck({
      attachments: [{ testStepId: undefined }],
    });

    expect(summary.scenarios[0]?.attachments).toBe(1);
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBe(model.counts.attachmentBytes);
    expect(model.counts.attachments).toBe(1);
    expect(details).toBe(1);
  });

  it('counts a present run hook and a run-level attachment once each', async () => {
    const { model, summary, details } = await crossCheck({
      runHook: true,
      attachments: [
        {
          testCaseStartedId: undefined,
          testRunHookStartedId: 'hook-start',
        },
        { testCaseStartedId: undefined, testStepId: undefined },
      ],
    });

    expect(summary.scenarios[0]?.attachments).toBe(0);
    expect(summary.attachments.total).toBe(2);
    expect(summary.attachments.bytes).toBe(model.counts.attachmentBytes);
    expect(model.counts.attachments).toBe(2);
    expect(details).toBe(2);
  });

  it('agrees on a run without timing', async () => {
    const envelopes = await loadEnvelopes(
      playwrightFixture('no-timing.json'),
    );
    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);

    expect(summary.counts.scenarios).toEqual(model.counts.scenarios);
    expect(summary.attachments.total).toBe(model.counts.attachments);
    expect(JSON.stringify(model)).not.toContain('1970');
  });

  it('agrees on the later start for a full attempt and timestamp tie', () => {
    const ties = ['FAILED', 'PASSED'].flatMap((status, index) => [
      {
        testCaseStarted: {
          id: `tie-${index}`,
          testCaseId: 'tie-case',
          attempt: 0,
          timestamp: { seconds: 0, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: `tie-${index}`,
          testStepId: 'tie-step',
          testStepResult: {
            status,
            duration: { seconds: 0, nanos: 1 },
          },
          timestamp: { seconds: 0, nanos: 0 },
        },
      },
    ]);
    const envelopes = [
      {
        pickle: {
          id: 'tie-pickle',
          uri: 'features/tie.feature',
          name: 'Tie scenario',
          language: 'en',
          astNodeIds: ['tie'],
          tags: [],
          steps: [{ id: 'tie-pickle-step', text: 'x', astNodeIds: [] }],
        },
      },
      {
        testCase: {
          id: 'tie-case',
          pickleId: 'tie-pickle',
          testSteps: [{ id: 'tie-step', pickleStepId: 'tie-pickle-step' }],
        },
      },
      ...ties,
    ] as unknown as Envelope[];
    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);

    expect(model.scenarios[0]?.status).toBe('passed');
    expect(summary.scenarios[0]?.status).toBe('passed');
    expect(summary.scenarios[0]?.attempt).toBe(0);
  });

  it('uses the later timestamp when the attempt is equal', async () => {
    const starts = [
      ['earlier-start', 'FAILED', 5, 5_000_000],
      ['later-start', 'PASSED', 6, 6_000_000],
    ] as const;
    const attempts = starts.flatMap(
      ([id, status, seconds, durationNanos]) => [
        {
          testCaseStarted: {
            id,
            testCaseId: 'timestamp-case',
            attempt: 0,
            timestamp: { seconds, nanos: 0 },
          },
        },
        {
          testStepFinished: {
            testCaseStartedId: id,
            testStepId: 'timestamp-step',
            testStepResult: {
              status,
              duration: { seconds: 0, nanos: durationNanos },
            },
            timestamp: { seconds, nanos: 1 },
          },
        },
      ],
    );
    const envelopes = [
      {
        gherkinDocument: {
          uri: 'features/timestamp.feature',
          feature: {
            name: 'Timestamp feature',
            keyword: 'Feature',
            language: 'en',
            tags: [],
            children: [
              {
                scenario: {
                  id: 'timestamp',
                  keyword: 'Scenario',
                  name: 'Timestamp scenario',
                  description: '',
                  tags: [],
                  steps: [
                    {
                      id: 'timestamp-ast',
                      keyword: 'Given ',
                      keywordType: 'Context',
                      text: 'x',
                      location: { line: 1, column: 1 },
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
          id: 'timestamp-pickle',
          uri: 'features/timestamp.feature',
          name: 'Timestamp scenario',
          language: 'en',
          astNodeIds: ['timestamp'],
          tags: [],
          steps: [{ id: 'timestamp-pickle-step', text: 'x', astNodeIds: [] }],
        },
      },
      {
        testCase: {
          id: 'timestamp-case',
          pickleId: 'timestamp-pickle',
          testSteps: [
            { id: 'timestamp-step', pickleStepId: 'timestamp-pickle-step' },
          ],
        },
      },
      ...attempts,
    ] as unknown as Envelope[];
    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);
    const html = await renderHtml(envelopes, { title: 'Timestamp order' });

    expect(model.scenarios[0]?.status).toBe('passed');
    expect(model.scenarios[0]?.attempt).toBe(0);
    expect(model.scenarios[0]?.startedAt).toBe('1970-01-01T00:00:06.000Z');
    expect(model.scenarios[0]?.durationMs).toBe(6);
    expect(summary.scenarios[0]?.status).toBe('passed');
    expect(summary.scenarios[0]?.attempt).toBe(0);
    expect(summary.scenarios[0]?.durationMs).toBe(6);
    expect(html).toContain('data-status="passed"');
  });

  it('keeps a higher attempt when its timestamp is earlier', () => {
    const envelopes = [
      {
        pickle: {
          id: 'attempt-pickle',
          uri: 'features/attempt.feature',
          name: 'Attempt scenario',
          language: 'en',
          astNodeIds: ['attempt'],
          tags: [],
          steps: [{ id: 'attempt-pickle-step', text: 'x', astNodeIds: [] }],
        },
      },
      {
        testCase: {
          id: 'attempt-case',
          pickleId: 'attempt-pickle',
          testSteps: [
            { id: 'attempt-step', pickleStepId: 'attempt-pickle-step' },
          ],
        },
      },
      {
        // Absent attempt is 0; its later timestamp must not beat attempt 1.
        testCaseStarted: {
          id: 'absent-attempt',
          testCaseId: 'attempt-case',
          timestamp: { seconds: 10, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: 'absent-attempt',
          testStepId: 'attempt-step',
          testStepResult: {
            status: 'FAILED',
            duration: { seconds: 0, nanos: 1 },
          },
          timestamp: { seconds: 10, nanos: 1 },
        },
      },
      {
        testCaseStarted: {
          id: 'higher-attempt',
          testCaseId: 'attempt-case',
          attempt: 1,
          timestamp: { seconds: 5, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: 'higher-attempt',
          testStepId: 'attempt-step',
          testStepResult: {
            status: 'PASSED',
            duration: { seconds: 0, nanos: 1 },
          },
          timestamp: { seconds: 5, nanos: 1 },
        },
      },
    ] as unknown as Envelope[];
    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);

    expect(model.scenarios[0]?.attempt).toBe(1);
    expect(model.scenarios[0]?.status).toBe('passed');
    expect(summary.scenarios[0]?.attempt).toBe(1);
    expect(summary.scenarios[0]?.status).toBe('passed');
  });

  it('agrees with the rendered screenshot fixture', async () => {
    const envelopes = parseMessages(
      await readFile(fixture('messages/screenshot.ndjson'), 'utf8'),
      'screenshot.ndjson',
    );
    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);
    const html = await renderHtml(envelopes, { title: 'Screenshot parity' });

    expect(summary.scenarios.map((scenario) => scenario.attachments)).toEqual([
      1, 0,
    ]);
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBe(model.counts.attachmentBytes);
    expect(model.counts.attachments).toBe(1);
    expect(detailsAttachmentCount(html)).toBe(1);
    expect(html).toContain('<img');
    expect(html).toContain('data:image/png;base64,');
  });
});

describe('model and summary cross-check', () => {
  for (const testCase of cases) {
    it(`agrees on counts and status for ${testCase.name}`, async () => {
      const envelopes = await testCase.load();
      const model = buildReportModel(envelopes);
      const summary = summarizeEnvelopes(envelopes);

      expect(summary.counts.features, 'features').toBe(model.counts.features);
      expect(summary.counts.scenarios, 'scenarios').toEqual(
        model.counts.scenarios,
      );
      expect(summary.attachments.total, 'attachments').toBe(
        model.counts.attachments,
      );
      expect(summary.attachments.bytes, 'attachment bytes').toBe(
        model.counts.attachmentBytes,
      );
      expect(summary.durationMs, 'duration').toBe(model.durationMs);
      expect(summaryFingerprint(summary), 'scenario rows').toEqual(
        modelFingerprint(model),
      );

      const scenarioOverall = worstExecutedStatus(model.scenarios);
      if (model.runHooks.length === 0) {
        expect(summary.status, 'overall status').toBe(scenarioOverall);
      } else {
        // A failing run hook may worsen the overall status but never improve it.
        expect(
          statusSeverity(summary.status),
          'overall status',
        ).toBeGreaterThanOrEqual(statusSeverity(scenarioOverall));
      }
    });
  }
});
