import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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

describe('machine-readable summary', () => {
  it('summarizes a Messages report', async () => {
    const summary = await summarizeReport(messages);

    expect(summary.schemaVersion).toBe(1);
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
    expect(failing?.steps.some((step) => step.message?.includes('-8 !== 0'))).toBe(
      true,
    );
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

    const keys = first.scenarios.map((scenario) => `${scenario.uri}\0${scenario.name}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
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
    expect(summary.schemaVersion).toBe(1);
    expect(summary.status).toBe('failed');
  });

  it('exposes step diagnostics without changing the schema version', async () => {
    const undefinedSummary = await summarizeReport(undefinedFixture);
    expect(undefinedSummary.schemaVersion).toBe(1);
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
      (scenario) => scenario.name === 'Steps before undefined steps are executed',
    )?.steps[0];
    expect(passed?.status).toBe('passed');
    expect(passed?.definitions).toBeUndefined();

    const ambiguousSummary = await summarizeReport(ambiguousFixture);
    expect(ambiguousSummary.schemaVersion).toBe(1);
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
    expect(
      steps.every((step) => !step.suggestions && !step.definitions),
    ).toBe(true);
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
        .some((step) => step.keyword === 'Hook' && step.name === 'seed database'),
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
    expect(summary.scenarios.every((scenario) => scenario.executed === false)).toBe(
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

  it('keeps step and attachment totals for executed content', async () => {
    const summary = await summarizeReport(messages);

    expect(summary.schemaVersion).toBe(2);
    expect(summary.scenarios.every((scenario) => scenario.executed === true)).toBe(
      true,
    );
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
    expect(summary.scenarios.every((scenario) => scenario.executed === true)).toBe(
      true,
    );
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
    expect(summary.scenarios.every((scenario) => scenario.executed === true)).toBe(
      true,
    );
    expect(summary.counts.scenarios.total).toBe(summary.scenarios.length);
    expect(summary.attachments.total).toBeGreaterThan(0);
  });
});
