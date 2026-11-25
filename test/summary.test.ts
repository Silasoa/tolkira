import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Envelope } from '@cucumber/messages';
import { TestStepResultStatus } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { summarizeReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { displayUri, summarizeEnvelopes } from '../src/summary.js';

const messages = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const failed = fileURLToPath(
  new URL('./fixtures/legacy/failed.json', import.meta.url),
);
const globalHooks = fileURLToPath(
  new URL('./fixtures/messages/global-hooks.ndjson', import.meta.url),
);
const undefinedFixture = fileURLToPath(
  new URL('./fixtures/messages/undefined.ndjson', import.meta.url),
);
const ambiguousFixture = fileURLToPath(
  new URL('./fixtures/messages/ambiguous.ndjson', import.meta.url),
);
const unhappyLegacy = fileURLToPath(
  new URL('./fixtures/legacy/unhappy.json', import.meta.url),
);
const emptyMixedFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-mixed.ndjson', import.meta.url),
);
const emptyAllUnexecutedFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-all-unexecuted.ndjson', import.meta.url),
);
const emptyUnfinishedFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-unfinished.ndjson', import.meta.url),
);
const emptyHookOnlyFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-hook-only.ndjson', import.meta.url),
);
const emptyRetryFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-retry.ndjson', import.meta.url),
);
const emptyNoneFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-none.ndjson', import.meta.url),
);
const emptyUnexecutedAttachmentFixture = fileURLToPath(
  new URL(
    './fixtures/messages/empty-unexecuted-attachment.ndjson',
    import.meta.url,
  ),
);
const legacyEmptyFixture = fileURLToPath(
  new URL('./fixtures/legacy/empty.json', import.meta.url),
);
const legacyMissingResultFixture = fileURLToPath(
  new URL('./fixtures/legacy/missing-result.json', import.meta.url),
);
const legacyScreenshotFixture = fileURLToPath(
  new URL('./fixtures/legacy/screenshot.json', import.meta.url),
);
const junitFixture = fileURLToPath(
  new URL('./fixtures/junit/basic.xml', import.meta.url),
);
const noTimingFixture = fileURLToPath(
  new URL('./fixtures/playwright/no-timing.json', import.meta.url),
);

function tiedAttemptRun(statuses: Array<'PASSED' | 'FAILED'>): Envelope[] {
  const envelopes: Array<Record<string, unknown>> = [
    {
      pickle: {
        id: 'tie-pickle',
        uri: 'features/tie.feature',
        name: 'Tie scenario',
        language: 'en',
        astNodeIds: ['tie-scenario'],
        tags: [],
        steps: [{ id: 'tie-pickle-step', text: 'a step', astNodeIds: [] }],
      },
    },
    {
      testCase: {
        id: 'tie-case',
        pickleId: 'tie-pickle',
        testSteps: [{ id: 'tie-step', pickleStepId: 'tie-pickle-step' }],
      },
    },
  ];
  statuses.forEach((status, index) => {
    envelopes.push(
      {
        testCaseStarted: {
          id: `tie-start-${index}`,
          testCaseId: 'tie-case',
          attempt: 0,
          timestamp: { seconds: 0, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: `tie-start-${index}`,
          testStepId: 'tie-step',
          testStepResult: {
            status,
            duration: { seconds: 0, nanos: 1 },
          },
          timestamp: { seconds: 0, nanos: 0 },
        },
      },
    );
  });
  return envelopes;
}

describe('machine-readable summary', () => {
  it('summarizes a Messages report', async () => {
    const summary = await summarizeReport(messages);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('failed');
    expect(summary.counts.scenarios).toMatchObject({
      total: 2,
      passed: 1,
      failed: 1,
    });
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBeGreaterThan(0);
    const screenshot = summary.scenarios.find(
      (scenario) => scenario.name === 'Attach a screenshot',
    );
    expect(screenshot).toMatchObject({
      uri: 'features/screenshot.feature',
      status: 'passed',
      attachments: 1,
    });
    const failing = summary.scenarios.find(
      (scenario) => scenario.name === 'Failing scenario',
    );
    expect(failing?.status).toBe('failed');
    expect(failing?.tags).toContain('@failing');
    expect(failing?.steps[0]?.message).toContain('Expected 1 to equal 2');
  });

  it('summarizes legacy scenarios and steps', async () => {
    const summary = await summarizeReport(legacy);

    expect(summary.status).toBe('passed');
    expect(summary.counts.scenarios).toMatchObject({
      total: 6,
      passed: 6,
    });
    expect(summary.counts.steps.total).toBe(30);
    expect(summary.durationMs).toBeGreaterThan(0);
    expect(summary.scenarios[0]?.feature).toBe('Happy HTML reporting');
    expect(
      summary.scenarios[0]?.steps.some((step) => step.keyword === 'Given'),
    ).toBe(true);
  });

  it('reports failures with messages and worst status', async () => {
    const summary = await summarizeReport(failed);

    expect(summary.status).toBe('failed');
    expect(summary.counts.scenarios).toMatchObject({
      total: 6,
      passed: 5,
      failed: 1,
    });

    const failing = summary.scenarios.find(
      (scenario) => scenario.status === 'failed',
    );
    expect(
      failing?.steps.some((step) => step.message?.includes('-8 !== 0')),
    ).toBe(true);
  });

  it('merges Messages and legacy input into one summary', async () => {
    const summary = await summarizeReport([messages, legacy]);

    expect(summary.counts.scenarios.total).toBe(8);
    expect(summary.attachments.total).toBe(3);
    expect(summary.scenarios.map((scenario) => scenario.uri)).toContain(
      'features/screenshot.feature',
    );
    expect(summary.scenarios.map((scenario) => scenario.uri)).toContain(
      'features/happy.feature',
    );
  });

  it('counts every status from a decision table', async () => {
    const statuses = [
      'passed',
      'failed',
      'skipped',
      'pending',
      'undefined',
      'ambiguous',
    ];
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          name: 'Status feature',
          elements: statuses.map((status) => ({
            keyword: 'Scenario',
            name: `Status ${status}`,
            steps: [
              {
                keyword: 'Given ',
                name: `a ${status} step`,
                result: { status, duration: 1 },
              },
            ],
          })),
        },
      ]),
      'statuses.json',
    );

    const summary = summarizeEnvelopes(envelopes);
    expect(summary.status).toBe('failed');
    expect(summary.counts.scenarios).toMatchObject({
      total: 6,
      passed: 1,
      failed: 1,
      skipped: 1,
      pending: 1,
      undefined: 1,
      ambiguous: 1,
    });
    expect(summary.counts.steps.total).toBe(6);

    const html = await renderHtml(envelopes, { title: 'Statuses' });
    for (const status of statuses) {
      expect(html.toLowerCase()).toContain(status);
    }
  });

  it('keeps the schema stable and counts self-consistent', async () => {
    const first = await summarizeReport(messages);
    const second = await summarizeReport(messages);

    expect(first).toEqual(second);
    expect(first.counts.features).toBe(1);
    expect(Object.keys(first.counts.scenarios)).toEqual([
      'total',
      'passed',
      'failed',
      'skipped',
      'pending',
      'undefined',
      'ambiguous',
      'unknown',
    ]);
    for (const counts of [first.counts.scenarios, first.counts.steps]) {
      const { total, ...statuses } = counts;
      expect(total).toBe(
        Object.values(statuses).reduce((sum, value) => sum + value, 0),
      );
    }
    const attachmentCount = first.scenarios.reduce(
      (sum, scenario) => sum + scenario.attachments,
      0,
    );
    expect(first.attachments.total).toBe(attachmentCount);

    const keys = first.scenarios.map(
      (scenario) => `${scenario.uri}\0${scenario.name}`,
    );
    // Fixed UTF-16 code-unit order; the host locale must not participate.
    expect(keys).toEqual(
      [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  });

  it('fails the summary when a test-run hook fails', async () => {
    const envelopes = parseMessages(
      await readFile(globalHooks, 'utf8'),
      globalHooks,
    );
    for (const envelope of envelopes) {
      if (
        envelope.testStepFinished?.testStepResult.status ===
        TestStepResultStatus.FAILED
      ) {
        envelope.testStepFinished.testStepResult.status =
          TestStepResultStatus.PASSED;
      }
    }
    const runHook = envelopes.find(
      (envelope) => envelope.testRunHookFinished,
    )?.testRunHookFinished;
    expect(runHook).toBeDefined();
    if (!runHook) return;
    runHook.result.status = TestStepResultStatus.FAILED;

    const summary = summarizeEnvelopes(envelopes);
    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('failed');
  });

  it('exposes step diagnostics without changing the schema version', async () => {
    const undefinedSummary = await summarizeReport(undefinedFixture);
    expect(undefinedSummary.schemaVersion).toBe(2);
    const list = undefinedSummary.scenarios.find(
      (scenario) => scenario.name === 'Snippets reflect parameter types',
    );
    expect(list?.steps[0]?.suggestions).toEqual([
      {
        language: 'typescript',
        code: 'Given("a list of {int} things", (int: number) => {\n  return "pending"\n})',
      },
      {
        language: 'typescript',
        code: 'Given("a list of {float} things", (float: number) => {\n  return "pending"\n})',
      },
    ]);

    const passed = undefinedSummary.scenarios.find(
      (scenario) =>
        scenario.name === 'Steps before undefined steps are executed',
    )?.steps[0];
    expect(passed?.status).toBe('passed');
    expect(passed?.definitions).toBeUndefined();

    const ambiguousSummary = await summarizeReport(ambiguousFixture);
    expect(ambiguousSummary.schemaVersion).toBe(2);
    expect(ambiguousSummary.scenarios[0]?.steps[0]?.definitions).toEqual([
      {
        pattern: '^a (.*?) with (.*?)$',
        source: 'samples/ambiguous/ambiguous.ts:3',
      },
      {
        pattern: '^a step with (.*?)$',
        source: 'samples/ambiguous/ambiguous.ts:7',
      },
    ]);
  });

  it('shows a relative source path for step definitions', async () => {
    const envelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    );
    const definition = envelopes.find(
      (envelope) => envelope.stepDefinition?.id === '4',
    )?.stepDefinition;
    expect(definition).toBeDefined();
    if (!definition?.sourceReference) return;
    definition.sourceReference.uri =
      'file:///C:/Users/name/proj/features/ambiguous.ts';
    definition.sourceReference.location = { line: 3 };

    const summary = summarizeEnvelopes(envelopes);
    const definitions = summary.scenarios[0]?.steps[0]?.definitions ?? [];
    expect(definitions[0]?.source).toBe('features/ambiguous.ts:3');
    expect(JSON.stringify(summary)).not.toContain('Users');
  });

  it('reduces a plain Windows source path without the user or drive', async () => {
    const envelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    );
    const definition = envelopes.find(
      (envelope) => envelope.stepDefinition?.id === '4',
    )?.stepDefinition;
    expect(definition).toBeDefined();
    if (!definition?.sourceReference) return;
    definition.sourceReference.uri =
      'C:\\Users\\name\\proj\\features\\ambiguous.ts';
    definition.sourceReference.location = { line: 3 };

    const summary = summarizeEnvelopes(envelopes);
    const definitions = summary.scenarios[0]?.steps[0]?.definitions ?? [];
    expect(definitions[0]?.source).toBe('features/ambiguous.ts:3');
    expect(JSON.stringify(summary)).not.toContain('Users');
    expect(JSON.stringify(summary)).not.toContain('C:');
  });

  it('keeps same-named step files in different directories distinct', () => {
    const source = displayUri('C:\\Users\\name\\proj\\src\\steps\\login.ts');
    const test = displayUri('C:/Users/name/proj/test/steps/login.ts');

    expect(source).toBe('src/steps/login.ts');
    expect(test).toBe('test/steps/login.ts');
    expect(`${source} ${test}`).not.toContain('Users');
  });

  it('does not invent diagnostics for legacy input', async () => {
    const summary = await summarizeReport(unhappyLegacy);
    const steps = summary.scenarios.flatMap((scenario) => scenario.steps);

    expect(steps.some((step) => step.status === 'undefined')).toBe(true);
    expect(steps.every((step) => !step.suggestions && !step.definitions)).toBe(
      true,
    );
  });

  it('uses the Messages attempt, absent as zero and valid as given', () => {
    const lines = (attempt: string) =>
      [
        '{"meta":{"protocolVersion":"27.0.2","implementation":{},"runtime":{},"os":{},"cpu":{}}}',
        '{"pickle":{"id":"p","uri":"features/attempt.feature","language":"en","astNodeIds":["s"],"tags":[],"name":"attempt","steps":[{"id":"ps","text":"x","astNodeIds":[]}]}}',
        '{"testCase":{"id":"tc","pickleId":"p","testSteps":[{"id":"ts","pickleStepId":"ps"}]}}',
        `{"testCaseStarted":{"id":"tcs","testCaseId":"tc",${attempt}"timestamp":{"seconds":1,"nanos":0}}}`,
        '{"testStepFinished":{"testCaseStartedId":"tcs","testStepId":"ts","testStepResult":{"status":"PASSED","duration":{"seconds":0,"nanos":1}},"timestamp":{"seconds":1,"nanos":1}}}',
      ].join('\n');

    const absent = summarizeEnvelopes(
      parseMessages(lines(''), 'absent.ndjson'),
    );
    const valid = summarizeEnvelopes(
      parseMessages(lines('"attempt":2,'), 'valid.ndjson'),
    );

    expect(absent.scenarios[0]?.attempt).toBe(0);
    expect(valid.scenarios[0]?.attempt).toBe(2);
    expect(JSON.stringify(absent)).not.toContain('"attempt": null');
    expect(JSON.stringify(valid)).not.toContain('"attempt": null');
  });

  it('uses the later start on a full attempt and timestamp tie', () => {
    const two = summarizeEnvelopes(tiedAttemptRun(['FAILED', 'PASSED']));
    const three = summarizeEnvelopes(
      tiedAttemptRun(['FAILED', 'FAILED', 'PASSED']),
    );

    expect(two.scenarios[0]).toMatchObject({
      status: 'passed',
      attempt: 0,
    });
    expect(two.counts.scenarios).toMatchObject({
      total: 1,
      passed: 1,
      failed: 0,
    });
    expect(three.scenarios[0]?.status).toBe('passed');
  });

  it('keeps a no-timing run date-free in the summary', async () => {
    const summary = await summarizeReport(noTimingFixture);

    expect(summary.scenarios[0]?.status).toBe('passed');
    expect(JSON.stringify(summary)).not.toContain('1970');
    expect(Object.keys(summary.scenarios[0] ?? {})).not.toContain('startedAt');
  });

  it('carries a per-scenario hook name in the summary', async () => {
    const hookFixture = fileURLToPath(
      new URL('./fixtures/messages/hooks.ndjson', import.meta.url),
    );
    const envelopes = parseMessages(
      await readFile(hookFixture, 'utf8'),
      hookFixture,
    );
    const hook = envelopes.find((envelope) => envelope.hook)?.hook;
    expect(hook).toBeDefined();
    if (!hook) return;
    hook.name = 'seed database';

    const summary = summarizeEnvelopes(envelopes);
    expect(
      summary.scenarios
        .flatMap((scenario) => scenario.steps)
        .some(
          (step) => step.keyword === 'Hook' && step.name === 'seed database',
        ),
    ).toBe(true);
  });
});

describe('empty-run summary', () => {
  it('uses schema version 2 and excludes unexecuted scenarios from counts', async () => {
    const summary = await summarizeReport(emptyMixedFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('passed');
    expect(summary.scenarios).toHaveLength(2);
    expect(summary.counts.scenarios).toMatchObject({
      total: 1,
      passed: 1,
      unknown: 0,
    });
    expect(summary.counts.scenarios.total).toBeLessThan(
      summary.scenarios.length,
    );
    expect(summary.counts.features).toBe(1);

    const blank = summary.scenarios.find(
      (scenario) => scenario.name === 'Blank started scenario',
    );
    expect(blank).toMatchObject({
      executed: false,
      status: 'unknown',
      steps: [],
      attachments: 0,
    });
    const passed = summary.scenarios.find(
      (scenario) => scenario.name === 'Passed scenario',
    );
    expect(passed).toMatchObject({ executed: true, status: 'passed' });
    expect(
      summary.scenarios.some(
        (scenario) => scenario.name === 'Never started scenario',
      ),
    ).toBe(false);
  });

  it('reports an all-unexecuted run as unknown with zero counted scenarios', async () => {
    const summary = await summarizeReport(emptyAllUnexecutedFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('unknown');
    expect(summary.counts.scenarios.total).toBe(0);
    expect(summary.counts.scenarios.unknown).toBe(0);
    expect(summary.scenarios).toHaveLength(2);
    expect(summary.scenarios.every((scenario) => !scenario.executed)).toBe(
      true,
    );
    expect(summary.counts.features).toBe(1);
  });

  it('keeps a started-but-unfinished scenario in the summary', async () => {
    const summary = await summarizeReport(emptyUnfinishedFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('unknown');
    expect(summary.scenarios).toEqual([
      expect.objectContaining({
        name: 'Unfinished scenario',
        executed: false,
        status: 'unknown',
      }),
    ]);
    expect(summary.counts.scenarios.total).toBe(0);
  });

  it('counts a hook-only result as executed', async () => {
    const summary = await summarizeReport(emptyHookOnlyFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('failed');
    expect(summary.scenarios).toEqual([
      expect.objectContaining({
        name: 'Hook-only scenario',
        executed: true,
        status: 'failed',
      }),
    ]);
    expect(summary.counts.scenarios).toMatchObject({ total: 1, failed: 1 });
    expect(summary.counts.steps).toMatchObject({ total: 1, failed: 1 });
    expect(summary.scenarios[0]?.steps[0]).toMatchObject({
      keyword: 'Hook',
      status: 'failed',
    });
  });

  it('uses the latest unexecuted retry attempt', async () => {
    const summary = await summarizeReport(emptyRetryFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('unknown');
    expect(summary.scenarios).toEqual([
      expect.objectContaining({
        name: 'Retried scenario',
        attempt: 1,
        executed: false,
        status: 'unknown',
      }),
    ]);
    expect(summary.counts.scenarios.total).toBe(0);
  });

  it('drops attachments from an unexecuted scenario', async () => {
    const summary = await summarizeReport(emptyUnexecutedAttachmentFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('unknown');
    expect(summary.scenarios).toEqual([
      expect.objectContaining({
        name: 'Unexecuted with an attachment',
        executed: false,
        status: 'unknown',
        attachments: 0,
      }),
    ]);
    expect(summary.attachments).toEqual({ total: 0, bytes: 0 });
  });

  it('reports no feature or scenario counts for a feature without rows', async () => {
    const summary = await summarizeReport(emptyNoneFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('unknown');
    expect(summary.scenarios).toEqual([]);
    expect(summary.counts.features).toBe(0);
    expect(summary.counts.scenarios.total).toBe(0);
  });

  it('keeps step and attachment totals for executed content', async () => {
    const summary = await summarizeReport(messages);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.scenarios.every((scenario) => scenario.executed)).toBe(true);
    expect(summary.counts.steps.total).toBe(
      summary.scenarios.reduce(
        (sum, scenario) => sum + scenario.steps.length,
        0,
      ),
    );
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBeGreaterThan(0);
  });

  it('treats a legacy zero-step scenario as unexecuted', async () => {
    const summary = await summarizeReport(legacyEmptyFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.status).toBe('unknown');
    expect(summary.counts.scenarios.total).toBe(0);
    expect(summary.counts.scenarios.unknown).toBe(0);
    expect(summary.scenarios).toEqual([
      expect.objectContaining({
        name: 'Legacy blank scenario',
        executed: false,
        status: 'unknown',
        steps: [],
      }),
    ]);
  });

  it('keeps JUnit test cases executed', async () => {
    const summary = await summarizeReport(junitFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.scenarios.length).toBeGreaterThan(0);
    expect(summary.scenarios.every((scenario) => scenario.executed)).toBe(true);
    expect(summary.counts.scenarios.total).toBe(summary.scenarios.length);
  });

  it('keeps a legacy step without a result executed and unknown', async () => {
    const summary = await summarizeReport(legacyMissingResultFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.counts.scenarios).toMatchObject({ total: 1, unknown: 1 });
    expect(summary.scenarios).toEqual([
      expect.objectContaining({
        name: 'Legacy unknown scenario',
        executed: true,
        status: 'unknown',
      }),
    ]);
    expect(summary.scenarios[0]?.steps).toHaveLength(1);
  });

  it('keeps legacy attachments executed and counted once', async () => {
    const summary = await summarizeReport(legacyScreenshotFixture);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.scenarios.length).toBeGreaterThan(0);
    expect(summary.scenarios.every((scenario) => scenario.executed)).toBe(true);
    expect(summary.counts.scenarios.total).toBe(summary.scenarios.length);
    expect(summary.attachments.total).toBeGreaterThan(0);
  });
});

describe('display URI privacy', () => {
  const USER = 'alice';

  it.each([
    {
      name: 'POSIX file URL',
      uri: `file:///home/${USER}/proj/features/login.feature`,
      expected: 'features/login.feature',
    },
    {
      name: 'file URL with one slash',
      uri: `file:/home/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'localhost file URL',
      uri: `file://localhost/home/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'remote file URL',
      uri: `file://server/share/home/${USER}/proj/login.feature`,
      expected: 'share/proj/login.feature',
    },
    {
      name: 'UNC path',
      uri: `//server/share/Users/${USER}/proj/login.feature`,
      expected: 'share/proj/login.feature',
    },
    {
      name: 'percent-encoded separators',
      uri: `file:///home/${USER}%2Fproj%2Flogin.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'percent-encoded Windows separators',
      uri: `file:///C:%5CUsers%5C${USER}%5Cproj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'percent-encoded leading separator',
      uri: `file:%2Fhome%2F${USER}%2Fproj%2Flogin.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'percent-encoded leading Windows separator',
      uri: `file:%5Chome%5C${USER}%5Cproj%5Clogin.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'percent-encoded home segment',
      uri: `file:///%68ome/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'percent-encoded Users segment',
      uri: `file:///%55sers/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'percent-encoded Documents and Settings segment',
      uri: `file:///C:/Documents%20and%20Settings/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'dot segment before the user name',
      uri: `file:///home/./${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'encoded dot segment before the user name',
      uri: `file:///home/%2e/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'encoded parent segment that would expose the user name',
      uri: `file:///home/${USER}/%2e%2e/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'parent segment that would expose the user name',
      uri: `file:///home/${USER}/../${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'userinfo in a localhost file URL',
      uri: `file://${USER}@localhost/home/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'home segment below another directory',
      uri: `/srv/home/${USER}/proj/login.feature`,
      expected: 'srv/proj/login.feature',
    },
    {
      name: 'drive segment before Users',
      uri: `D:/data/Users/${USER}/proj/login.feature`,
      expected: 'data/proj/login.feature',
    },
    {
      name: 'home-only two-segment path',
      uri: `/home/${USER}`,
      expected: '',
    },
    {
      name: 'trailing bare home segment',
      uri: '/srv/home',
      expected: 'srv',
    },
    {
      name: 'WSL mount path to the home directory',
      uri: `/mnt/c/Users/${USER}`,
      expected: '',
    },
    {
      name: 'features marker above the home segment',
      uri: `/srv/features/home/${USER}/proj/login.feature`,
      expected: 'features/proj/login.feature',
    },
    {
      name: 'WSL mount path',
      uri: `/mnt/c/Users/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'Windows file URL',
      uri: `file:///C:/Users/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'absolute path without a features marker',
      uri: `/home/${USER}/work/proj/login.feature`,
      expected: 'work/proj/login.feature',
    },
    {
      name: 'deeper absolute path keeps the last three segments',
      uri: `/home/${USER}/work/team/proj/login.feature`,
      expected: 'team/proj/login.feature',
    },
    {
      name: 'filename with dots inside a segment',
      uri: `file:///home/${USER}/proj/a..b.feature`,
      expected: 'proj/a..b.feature',
    },
    {
      name: 'drive form one segment before the home segment',
      uri: `C:/Users/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'WSL mount path with one segment after the home segment',
      uri: `/mnt/c/Users/${USER}/login.feature`,
      expected: 'login.feature',
    },
    {
      name: 'Documents and Settings home segment',
      uri: `C:/Documents and Settings/${USER}/proj/login.feature`,
      expected: 'proj/login.feature',
    },
    {
      name: 'features marker after an absolute home path',
      uri: `/home/${USER}/proj/features/login.feature`,
      expected: 'features/login.feature',
    },
  ])(
    'drops the local user name and is idempotent for a $name',
    ({ uri, expected }) => {
      const display = displayUri(uri);

      expect(display).toBe(expected);
      expect(display).not.toContain(USER);
      expect(display).not.toContain('/home/');
      expect(display).not.toContain('/Users/');
      expect(display).not.toMatch(/^[a-z]:\//i);
      expect(displayUri(display)).toBe(display);
    },
  );

  it('analyzes repeated home segments in linear time', () => {
    // 64k pairs took seconds with the old rescan-and-splice loop; the
    // single pass finishes in milliseconds.
    const display = displayUri(
      `/${`home/${USER}/`.repeat(64_000)}proj/login.feature`,
    );

    expect(display).toBe('proj/login.feature');
    expect(display).not.toContain(USER);
  }, 2_000);

  it.each([
    { name: 'a plain relative path', uri: 'features/login.feature' },
    {
      name: 'a relative path that starts with a home segment',
      uri: `home/${USER}/proj/login.feature`,
    },
    { name: 'a missing URI', uri: '' },
  ])('keeps $name unchanged', ({ uri }) => {
    expect(displayUri(uri)).toBe(uri);
  });

  it('removes a legacy file URL user name through the adapter', () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          uri: `file:///home/${USER}/proj/login.feature`,
          name: 'Login',
          elements: [
            {
              keyword: 'Scenario',
              name: 'signs in',
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a step',
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        },
      ]),
      'privacy.json',
    );

    const summary = summarizeEnvelopes(envelopes);
    const serialized = JSON.stringify(summary);

    expect(summary.scenarios[0]?.uri).toBe('login.feature');
    expect(serialized).not.toContain(USER);
    expect(serialized).not.toContain('/home/');
  });

  it('escapes HTML-like text in a shortened URI and makes no network request', async () => {
    const marker = '<img src=x onerror=alert(1)>.feature';
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          uri: `file:///home/${USER}/proj/${marker}`,
          name: 'Escaped URI',
          elements: [
            {
              keyword: 'Scenario',
              name: 'escapes',
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a step',
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        },
      ]),
      'escaped-uri.json',
    );

    const html = await renderHtml(envelopes, { title: 'Escaped URI' });

    expect(html).not.toContain('<img src=x onerror=alert(1)>.feature');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;.feature');
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
  });
});

describe('host-locale-independent order', () => {
  function orderedScenarios(names: string[]) {
    return parseLegacyJson(
      JSON.stringify([
        {
          uri: 'features/order.feature',
          name: 'Order',
          elements: names.map((name) => ({
            keyword: 'Scenario',
            name,
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
      'order.json',
    );
  }

  it('orders summary scenarios by UTF-16 code units, not the host locale', () => {
    const names = [
      'apple',
      'Zebra',
      'Äpfel',
      'B',
      'b',
      '😀',
      'same',
      'same',
      'a',
      'ab',
    ];

    const summary = summarizeEnvelopes(orderedScenarios(names));

    // ASCII case, non-ASCII, equal and prefix strings in one equivalence table.
    expect(summary.scenarios.map((scenario) => scenario.name)).toEqual([
      'B',
      'Zebra',
      'a',
      'ab',
      'apple',
      'b',
      'same',
      'same',
      'Äpfel',
      '😀',
    ]);
  });

  it('orders summary scenarios by URI before name', () => {
    const envelopes = parseLegacyJson(
      JSON.stringify(
        // The URIs sort opposite the names, so a name-first sort would show.
        [
          { uri: 'features/a.feature', name: 'Zulu' },
          { uri: 'features/b.feature', name: 'Alpha' },
        ].map(({ uri, name }) => ({
          uri,
          name,
          elements: [
            {
              keyword: 'Scenario',
              name: `${name} scenario`,
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a step',
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        })),
      ),
      'uri-order.json',
    );

    const summary = summarizeEnvelopes(envelopes);

    expect(summary.scenarios.map((scenario) => scenario.uri)).toEqual([
      'features/a.feature',
      'features/b.feature',
    ]);
    expect(summary.scenarios.map((scenario) => scenario.name)).toEqual([
      'Zulu scenario',
      'Alpha scenario',
    ]);
  });
});
