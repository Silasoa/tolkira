import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TestStepResultStatus } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { summarizeReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { summarizeEnvelopes } from '../src/summary.js';

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
