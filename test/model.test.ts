import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Envelope } from '@cucumber/messages';
import { TestStepResultStatus } from '@cucumber/messages';
import { describe, expect, it, vi } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { loadEnvelopes } from '../src/input/load.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';
import { worstExecutedStatus } from '../src/report/status.js';

const happy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const screenshot = fileURLToPath(
  new URL('./fixtures/legacy/screenshot.json', import.meta.url),
);
const behave = fileURLToPath(
  new URL('./fixtures/legacy/behave.json', import.meta.url),
);
const messages = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const examplesTables = fileURLToPath(
  new URL('./fixtures/messages/examples-tables.ndjson', import.meta.url),
);
const examplesAttachments = fileURLToPath(
  new URL('./fixtures/messages/examples-tables-attachment.ndjson', import.meta.url),
);
const hooksFixture = fileURLToPath(
  new URL('./fixtures/messages/hooks.ndjson', import.meta.url),
);
const globalHooksFixture = fileURLToPath(
  new URL('./fixtures/messages/global-hooks.ndjson', import.meta.url),
);
const globalHookAttachments = fileURLToPath(
  new URL('./fixtures/messages/global-hooks-attachments.ndjson', import.meta.url),
);
const undefinedFixture = fileURLToPath(
  new URL('./fixtures/messages/undefined.ndjson', import.meta.url),
);
const undefinedMultipleFixture = fileURLToPath(
  new URL('./fixtures/messages/undefined-multiple.ndjson', import.meta.url),
);
const ambiguousFixture = fileURLToPath(
  new URL('./fixtures/messages/ambiguous.ndjson', import.meta.url),
);
const allStatusesFixture = fileURLToPath(
  new URL('./fixtures/messages/all-statuses.ndjson', import.meta.url),
);
const emptyFixture = fileURLToPath(
  new URL('./fixtures/messages/empty.ndjson', import.meta.url),
);
const emptyNoneFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-none.ndjson', import.meta.url),
);
const emptyMixedFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-mixed.ndjson', import.meta.url),
);
const emptyStatusesFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-statuses.ndjson', import.meta.url),
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
const emptyUnexecutedAttachmentFixture = fileURLToPath(
  new URL(
    './fixtures/messages/empty-unexecuted-attachment.ndjson',
    import.meta.url,
  ),
);
const emptyOutlineMixedFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-outline-mixed.ndjson', import.meta.url),
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
const rulesFixture = fileURLToPath(
  new URL('./fixtures/messages/rules.ndjson', import.meta.url),
);
const backgroundsFixture = fileURLToPath(
  new URL('./fixtures/messages/backgrounds.ndjson', import.meta.url),
);
const rulesBackgroundsFixture = fileURLToPath(
  new URL('./fixtures/messages/rules-backgrounds.ndjson', import.meta.url),
);
const tagsFixture = fileURLToPath(
  new URL('./fixtures/messages/tags.ndjson', import.meta.url),
);
const noTimingFixture = fileURLToPath(
  new URL('./fixtures/playwright/no-timing.json', import.meta.url),
);
const realRunFixture = fileURLToPath(
  new URL('./fixtures/playwright/real-run.json', import.meta.url),
);
const legacyMinimalFixture = fileURLToPath(
  new URL('./fixtures/legacy/minimal.json', import.meta.url),
);

async function modelFor(file: string) {
  const content = await readFile(file, 'utf8');
  return buildReportModel(
    parseLegacyJson(content, file, {
      idPrefix: 'model',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );
}

async function messagesModelFor(file: string) {
  const content = await readFile(file, 'utf8');
  return buildReportModel(parseMessages(content, file));
}

describe('report model', () => {
  it('groups scenarios, features and steps', async () => {
    const model = await modelFor(happy);

    expect(model.counts.features).toBe(1);
    expect(model.counts.scenarios.total).toBe(6);
    expect(model.counts.steps.total).toBe(24);
    expect(model.counts.hooks.total).toBe(6);
    expect(model.features[0]?.name).toBe('Happy HTML reporting');
    expect(model.features[0]?.description).toContain('cucumber reports');
    expect(model.scenarios[0]?.status).toBe('passed');
    expect(model.scenarios[0]?.hooks[0]?.type).toBe('Before');
    expect(model.scenarios[0]?.steps.some((step) => step.keyword === 'Given')).toBe(true);
    expect(model.scenarios[0]?.steps.some((step) => step.keyword === 'Hook')).toBe(false);
  });

  it('keeps doc strings, tables and errors', async () => {
    const model = await modelFor(happy);

    expect(
      model.scenarios.some((scenario) =>
        scenario.steps.some((step) => step.docString?.includes('Doc String')),
      ),
    ).toBe(true);
    expect(
      model.scenarios.some((scenario) =>
        scenario.steps.some((step) => (step.dataTable?.length ?? 0) > 0),
      ),
    ).toBe(true);
  });

  it('maps image attachments to data URIs', async () => {
    const model = await modelFor(screenshot);
    const attachment = model.scenarios
      .flatMap((scenario) => scenario.attachments)
      .find((entry) => entry.kind === 'image');

    expect(attachment?.fileName).toBe('attachment.png');
    expect(attachment?.dataUri).toMatch(/^data:image\/png;base64,/);
    expect(attachment?.bytes).toBeGreaterThan(0);
  });

  it('falls back to attachment.png when the Cucumber file name is empty', async () => {
    const lines = (await readFile(messages, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const started = lines.find((line) => line.testCaseStarted)?.testCaseStarted as
      | { id: string }
      | undefined;
    expect(started).toBeDefined();

    lines.push({
      attachment: {
        body: 'cGF5bG9hZA==',
        contentEncoding: 'BASE64',
        fileName: '',
        mediaType: 'image/png',
        testCaseStartedId: started?.id,
      },
    });

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'empty-file-name.ndjson',
    );
    const model = buildReportModel(envelopes);
    const attachment = model.scenarios[0]?.extraAttachments.find(
      (entry) => entry.mediaType === 'image/png',
    );

    expect(attachment?.fileName).toBe('attachment.png');
  });

  it('normalises and allowlists attachment media types', async () => {
    const lines = (await readFile(messages, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const started = lines.find((line) => line.testCaseStarted)?.testCaseStarted as
      | { id: string }
      | undefined;
    expect(started).toBeDefined();

    const mediaTypes = [
      'application/xhtml+xml',
      'application/xml',
      'image/png, text/html',
      'application/json; charset=utf-8',
      'image/png; charset=utf-8',
      'text/html',
    ];
    for (const mediaType of mediaTypes) {
      lines.push({
        attachment: {
          body: 'cGF5bG9hZA==',
          contentEncoding: 'BASE64',
          mediaType,
          testCaseStartedId: started?.id,
        },
      });
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'media-types.ndjson',
    );
    const model = buildReportModel(envelopes);
    const extra = model.scenarios[0]?.extraAttachments ?? [];

    expect(extra.map((attachment) => attachment.mediaType)).toEqual([
      'application/octet-stream',
      'application/octet-stream',
      'application/octet-stream',
      'application/json',
      'image/png',
      'text/html',
    ]);
    expect(extra[0]?.dataUri).toMatch(/^data:application\/octet-stream;/);
    expect(extra[1]?.dataUri).toMatch(/^data:application\/octet-stream;/);
    expect(extra[2]?.dataUri).toMatch(/^data:application\/octet-stream;/);
    expect(extra[0]?.dataUri).not.toContain('xhtml');
    expect(extra[1]?.dataUri).not.toContain('xml');
    expect(extra[2]?.dataUri).not.toContain('text/html');
  });

  it('uses the latest finished attempt for a scenario', async () => {
    const model = await modelFor(happy);
    expect(model.scenarios.every((scenario) => scenario.attempt === 0)).toBe(true);
  });

  it('keeps case-level and run-level attachments', async () => {
    const lines = (await readFile(messages, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const started = lines.find((line) => line.testCaseStarted)?.testCaseStarted as
      | { id: string }
      | undefined;
    expect(started).toBeDefined();

    lines.push({
      attachment: {
        body: Buffer.from('case-level log').toString('base64'),
        contentEncoding: 'BASE64',
        mediaType: 'text/plain',
        testCaseStartedId: started?.id,
      },
    });
    lines.push({
      attachment: {
        body: Buffer.from('run-level log').toString('base64'),
        contentEncoding: 'BASE64',
        mediaType: 'text/plain',
      },
    });

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'attachments.ndjson',
    );
    const model = buildReportModel(envelopes);

    expect(model.scenarios[0]?.extraAttachments).toHaveLength(1);
    expect(model.scenarios[0]?.extraAttachments[0]?.text).toBe('case-level log');
    expect(model.runAttachments).toHaveLength(1);
    expect(model.runAttachments[0]?.text).toBe('run-level log');
    expect(model.counts.attachments).toBe(3);
  });

  it('groups executed examples under their outline and examples block', async () => {
    const model = await messagesModelFor(examplesTables);

    expect(model.counts.scenarios.total).toBe(7);
    expect(model.counts.scenarios.passed).toBe(5);
    expect(model.counts.scenarios.failed).toBe(2);

    const outlines = new Map(
      model.scenarios
        .filter((scenario) => scenario.outline)
        .map((scenario) => [scenario.outline?.id, scenario.outline]),
    );
    expect(outlines.size).toBe(2);

    const first = model.scenarios.filter(
      (scenario) => scenario.outline?.name === 'Eating cucumbers',
    );
    expect(first).toHaveLength(4);
    expect(first.map((scenario) => scenario.name)).toEqual([
      'Eating cucumbers',
      'Eating cucumbers',
      'Eating cucumbers',
      'Eating cucumbers',
    ]);
    expect(
      first.map((scenario) => [
        scenario.outline?.examplesName,
        scenario.outline?.examplesIndex,
        scenario.outline?.exampleIndex,
      ]),
    ).toEqual([
      ['These are passing', 0, 0],
      ['These are passing', 0, 1],
      ['These are failing', 1, 0],
      ['These are failing', 1, 1],
    ]);

    const second = model.scenarios.filter(
      (scenario) => scenario.outline?.name === 'Eating cucumbers with <friends> friends',
    );
    expect(second).toHaveLength(3);
    expect(second.map((scenario) => scenario.outline?.examplesName)).toEqual([
      '',
      '',
      '',
    ]);
    expect(second.map((scenario) => scenario.outline?.examplesIndex)).toEqual([
      0, 0, 0,
    ]);
    expect(second.map((scenario) => scenario.outline?.exampleIndex)).toEqual([
      0, 1, 2,
    ]);
    expect(second[0]?.name).toBe('Eating cucumbers with 11 friends');
  });

  it('uses the deepest AST id and tolerates a missing examples row', async () => {
    const source = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(source, examplesTables);
    const pickle = envelopes.find(
      (envelope) => envelope.pickle?.astNodeIds.length === 2,
    )?.pickle;
    expect(pickle).toBeDefined();
    if (!pickle) return;

    pickle.astNodeIds = [pickle.astNodeIds[0] ?? '', 'extra-ast-id', pickle.astNodeIds[1] ?? ''];
    const grouped = buildReportModel(envelopes).scenarios.find(
      (scenario) => scenario.id === pickle.id,
    );
    expect(grouped?.outline).toBeDefined();

    pickle.astNodeIds = [pickle.astNodeIds[0] ?? '', 'missing-row'];
    const flat = buildReportModel(envelopes).scenarios.find(
      (scenario) => scenario.id === pickle.id,
    );
    expect(flat?.outline).toBeUndefined();
  });

  it('keeps each example attachment on its own row', async () => {
    const model = await messagesModelFor(examplesAttachments);
    const rows = model.scenarios.filter((scenario) => scenario.outline);

    expect(rows.length).toBeGreaterThan(1);
    const withImages = rows.filter((scenario) =>
      scenario.attachments.some((attachment) => attachment.kind === 'image'),
    );
    expect(withImages.length).toBeGreaterThan(1);
    expect(new Set(withImages.map((scenario) => scenario.id)).size).toBe(
      withImages.length,
    );
    expect(model.features[0]?.attachments).toBe(2);
    expect(rows.every((scenario) => scenario.attachments.length === 1)).toBe(
      true,
    );
  });

  it('keeps legacy scenarios flat', async () => {
    const model = await modelFor(happy);
    expect(model.scenarios.every((scenario) => !scenario.outline)).toBe(true);
  });

  it('falls back flat when a pickle cannot be linked to an examples row', async () => {
    const lines = (await readFile(examplesTables, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .filter((line) => !line.includes('"gherkinDocument"'));
    const model = buildReportModel(
      parseMessages(lines.join('\n'), 'unlinked.ndjson'),
    );

    expect(model.scenarios).toHaveLength(7);
    expect(model.scenarios.every((scenario) => !scenario.outline)).toBe(true);
  });

  it('tolerates omitted repeated fields in a valid Gherkin document', async () => {
    const source = await readFile(examplesTables, 'utf8');
    const cases: Array<(envelopes: ReturnType<typeof parseMessages>) => void> = [
      (envelopes) => {
        const document = envelopes.find((envelope) => envelope.gherkinDocument)
          ?.gherkinDocument;
        const scenario = document?.feature?.children.find((child) => child.scenario)
          ?.scenario;
        if (!scenario) return;
        delete (scenario as unknown as { tags?: unknown }).tags;
        delete (scenario as unknown as { examples?: unknown }).examples;
      },
      (envelopes) => {
        const document = envelopes.find((envelope) => envelope.gherkinDocument)
          ?.gherkinDocument;
        const scenario = document?.feature?.children.find((child) => child.scenario)
          ?.scenario;
        const examples = scenario?.examples?.[0];
        if (!examples) return;
        delete (examples as unknown as { tableBody?: unknown }).tableBody;
        delete (examples as unknown as { tags?: unknown }).tags;
        delete (scenario as unknown as { tags?: unknown }).tags;
      },
      (envelopes) => {
        const document = envelopes.find((envelope) => envelope.gherkinDocument)
          ?.gherkinDocument;
        if (!document?.feature) return;
        delete (document.feature as unknown as { tags?: unknown }).tags;
        for (const envelope of envelopes) {
          if (envelope.pickle) {
            delete (envelope.pickle as unknown as { tags?: unknown }).tags;
          }
        }
      },
    ];

    for (const mutate of cases) {
      const envelopes = parseMessages(source, examplesTables);
      mutate(envelopes);
      expect(() => buildReportModel(envelopes)).not.toThrow();
      expect(buildReportModel(envelopes).scenarios).toHaveLength(7);
    }
  });

  it('keeps one row for a retried outline example', async () => {
    const envelopes = parseMessages(
      await readFile(examplesTables, 'utf8'),
      examplesTables,
    );
    const pickle = envelopes.find(
      (envelope) => envelope.pickle?.astNodeIds.length === 2,
    )?.pickle;
    expect(pickle).toBeDefined();
    if (!pickle) return;
    const testCase = envelopes.find(
      (envelope) => envelope.testCase?.pickleId === pickle.id,
    )?.testCase;
    const started = envelopes.find(
      (envelope) => envelope.testCaseStarted?.testCaseId === testCase?.id,
    )?.testCaseStarted;
    const finished = envelopes.find(
      (envelope) =>
        envelope.testCaseFinished?.testCaseStartedId === started?.id,
    )?.testCaseFinished;
    const stepFinished = envelopes.find(
      (envelope) =>
        envelope.testStepFinished?.testCaseStartedId === started?.id,
    )?.testStepFinished;
    expect(testCase).toBeDefined();
    expect(started).toBeDefined();
    expect(finished).toBeDefined();
    expect(stepFinished).toBeDefined();
    if (!testCase || !started || !finished || !stepFinished) return;

    const retryId = `${started.id}-retry`;
    envelopes.push(
      {
        testCaseStarted: {
          ...started,
          id: retryId,
          attempt: 1,
          timestamp: { seconds: 10, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          ...stepFinished,
          testCaseStartedId: retryId,
          timestamp: { seconds: 10, nanos: 0 },
          testStepResult: {
            ...stepFinished.testStepResult,
            status: TestStepResultStatus.FAILED,
          },
        },
      },
      {
        testCaseFinished: {
          ...finished,
          testCaseStartedId: retryId,
          timestamp: { seconds: 10, nanos: 0 },
        },
      },
    );

    const model = buildReportModel(envelopes);
    const rows = model.scenarios.filter((scenario) => scenario.id === pickle.id);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.attempt).toBe(1);
    expect(rows[0]?.status).toBe('failed');
    expect(rows[0]?.outline?.exampleIndex).toBe(0);
  });

  it('separates per-scenario hooks from steps', async () => {
    const model = await messagesModelFor(hooksFixture);
    const hooks = model.scenarios.flatMap((scenario) => scenario.hooks);

    expect(hooks.length).toBeGreaterThan(0);
    expect(model.counts.hooks.total).toBe(hooks.length);
    expect(
      model.scenarios.every((scenario) =>
        scenario.steps.every((step) => step.keyword !== 'Hook'),
      ),
    ).toBe(true);
    expect(hooks[0]?.type).toBe('Before');
  });

  it('collects test-run hooks and their attachments', async () => {
    const model = await messagesModelFor(globalHooksFixture);
    expect(model.runHooks.map((hook) => hook.type)).toEqual([
      'BeforeAll',
      'BeforeAll',
      'AfterAll',
      'AfterAll',
    ]);
    expect(model.counts.hooks.total).toBe(4);

    const withAttachments = await messagesModelFor(globalHookAttachments);
    expect(
      withAttachments.runHooks.some((hook) => hook.attachments.length > 0),
    ).toBe(true);
    expect(withAttachments.runAttachments).toHaveLength(0);
    expect(withAttachments.counts.attachments).toBeGreaterThan(0);
  });

  it('keeps a started run hook without a finish as unknown', async () => {
    const envelopes = parseMessages(
      await readFile(globalHooksFixture, 'utf8'),
      globalHooksFixture,
    );
    const started = envelopes.find(
      (envelope) => envelope.testRunHookStarted,
    )?.testRunHookStarted;
    expect(started).toBeDefined();
    if (!started) return;
    const filtered = envelopes.filter(
      (envelope) =>
        envelope.testRunHookFinished?.testRunHookStartedId !== started.id,
    );
    const model = buildReportModel(filtered);
    const hook = model.runHooks.find((entry) => entry.id === started.id);
    expect(hook?.status).toBe('unknown');
  });

  it('keeps legacy hooks out of steps', async () => {
    const model = await modelFor(happy);
    expect(
      model.scenarios.every((scenario) =>
        scenario.steps.every((step) => step.keyword !== 'Hook'),
      ),
    ).toBe(true);
    expect(model.scenarios.some((scenario) => scenario.hooks.length > 0)).toBe(
      true,
    );
  });
});

describe('parity diagnostics model', () => {
  it('parses the CCK parity fixtures with their expected statuses', async () => {
    const undefinedModel = await messagesModelFor(undefinedFixture);
    expect(undefinedModel.counts.scenarios).toMatchObject({
      total: 4,
      undefined: 4,
    });
    expect(undefinedModel.counts.steps).toMatchObject({
      total: 6,
      passed: 1,
      undefined: 4,
      skipped: 1,
    });

    const multipleModel = await messagesModelFor(undefinedMultipleFixture);
    expect(multipleModel.counts.scenarios).toMatchObject({
      total: 7,
      undefined: 7,
    });
    expect(multipleModel.counts.steps).toMatchObject({
      total: 22,
      passed: 4,
      undefined: 14,
      skipped: 4,
    });

    const ambiguousModel = await messagesModelFor(ambiguousFixture);
    expect(ambiguousModel.counts.scenarios).toMatchObject({
      total: 1,
      ambiguous: 1,
    });
    expect(ambiguousModel.counts.steps).toMatchObject({
      total: 1,
      ambiguous: 1,
    });

    const allStatusesModel = await messagesModelFor(allStatusesFixture);
    expect(allStatusesModel.counts.scenarios).toMatchObject({
      total: 6,
      passed: 1,
      failed: 1,
      pending: 1,
      skipped: 1,
      undefined: 1,
      ambiguous: 1,
    });
    expect(allStatusesModel.counts.steps).toMatchObject({
      total: 18,
      passed: 8,
      failed: 1,
      pending: 1,
      skipped: 6,
      undefined: 1,
      ambiguous: 1,
    });

    const emptyModel = await messagesModelFor(emptyFixture);
    expect(emptyModel.counts.scenarios).toMatchObject({
      total: 0,
      unknown: 0,
    });
    expect(emptyModel.counts.steps.total).toBe(0);
  });

  it('attaches suggestion snippets to undefined steps', async () => {
    const model = await messagesModelFor(undefinedFixture);
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'Snippets reflect parameter types',
    );
    const step = scenario?.steps[0];

    expect(step?.status).toBe('undefined');
    expect(step?.suggestions).toEqual([
      {
        language: 'typescript',
        code: 'Given("a list of {int} things", (int: number) => {\n  return "pending"\n})',
      },
      {
        language: 'typescript',
        code: 'Given("a list of {float} things", (float: number) => {\n  return "pending"\n})',
      },
    ]);
  });

  it('attaches matching definitions to ambiguous and passed steps', async () => {
    const ambiguousModel = await messagesModelFor(ambiguousFixture);
    const ambiguousStep = ambiguousModel.scenarios[0]?.steps[0];

    expect(ambiguousStep?.status).toBe('ambiguous');
    expect(ambiguousStep?.definitions).toEqual([
      {
        pattern: '^a (.*?) with (.*?)$',
        source: 'samples/ambiguous/ambiguous.ts:3',
      },
      {
        pattern: '^a step with (.*?)$',
        source: 'samples/ambiguous/ambiguous.ts:7',
      },
    ]);

    const undefinedModel = await messagesModelFor(undefinedFixture);
    const passedStep = undefinedModel.scenarios.find(
      (entry) => entry.name === 'Steps before undefined steps are executed',
    )?.steps[0];

    expect(passedStep?.status).toBe('passed');
    expect(passedStep?.definitions).toEqual([
      { pattern: 'an implemented step', source: 'samples/undefined/undefined.ts:3' },
    ]);
  });

  it('guards omitted or malformed suggestion and definition fields', async () => {
    const source = await readFile(undefinedFixture, 'utf8');
    const cases: Array<{
      name: string;
      mutate: (envelopes: ReturnType<typeof parseMessages>) => void;
      hasSuggestions: boolean;
      hasDefinitions: boolean;
    }> = [
      {
        name: 'omitted snippets',
        mutate: (envelopes) => {
          for (const envelope of envelopes) {
            if (envelope.suggestion) {
              delete (envelope.suggestion as unknown as { snippets?: unknown })
                .snippets;
            }
          }
        },
        hasSuggestions: false,
        hasDefinitions: true,
      },
      {
        name: 'malformed snippets',
        mutate: (envelopes) => {
          for (const envelope of envelopes) {
            if (envelope.suggestion) {
              (envelope.suggestion as unknown as { snippets: unknown }).snippets =
                'not-an-array';
            }
          }
        },
        hasSuggestions: false,
        hasDefinitions: true,
      },
      {
        name: 'omitted pattern and source',
        mutate: (envelopes) => {
          for (const envelope of envelopes) {
            if (envelope.stepDefinition) {
              delete (
                envelope.stepDefinition as unknown as { pattern?: unknown }
              ).pattern;
              delete (
                envelope.stepDefinition as unknown as { sourceReference?: unknown }
              ).sourceReference;
            }
          }
        },
        hasSuggestions: true,
        hasDefinitions: false,
      },
      {
        name: 'omitted step definition ids',
        mutate: (envelopes) => {
          for (const envelope of envelopes) {
            for (const step of envelope.testCase?.testSteps ?? []) {
              delete (step as unknown as { stepDefinitionIds?: unknown })
                .stepDefinitionIds;
            }
          }
        },
        hasSuggestions: true,
        hasDefinitions: false,
      },
    ];

    for (const testCase of cases) {
      const envelopes = parseMessages(source, undefinedFixture);
      testCase.mutate(envelopes);
      const model = buildReportModel(envelopes);
      const steps = model.scenarios.flatMap((scenario) => scenario.steps);
      expect(steps.length, testCase.name).toBe(6);
      expect(
        steps.some((step) => Boolean(step.suggestions)),
        `${testCase.name} suggestions`,
      ).toBe(testCase.hasSuggestions);
      expect(
        steps.some((step) => Boolean(step.definitions)),
        `${testCase.name} definitions`,
      ).toBe(testCase.hasDefinitions);
    }
  });
});

describe('parity rules model', () => {
  it('attaches rule metadata and keeps the scenario list flat', async () => {
    const model = await messagesModelFor(rulesFixture);

    expect(model.counts.scenarios.total).toBe(3);
    expect(model.features).toHaveLength(1);
    expect(model.features[0]?.scenarios).toHaveLength(3);
    expect(model.features[0]?.backgrounds).toEqual([]);

    const first = model.scenarios.find(
      (scenario) => scenario.name === 'Not enough money',
    );
    expect(first?.rule).toEqual({
      id: expect.any(String),
      keyword: 'Rule',
      name: 'A sale cannot happen if the customer does not have enough money',
      description: '',
      tags: [],
      backgrounds: [],
    });
    expect(first?.ruleName).toBe(first?.rule?.name);

    const tagged = model.scenarios.find(
      (scenario) => scenario.name === 'No chocolates left',
    );
    expect(tagged?.rule?.name).toBe(
      'a sale cannot happen if there is no stock',
    );
    expect(tagged?.rule?.tags).toEqual(['@some-tag']);
    expect(tagged?.tags).toEqual(['@some-tag']);
    expect(tagged?.ownTags).toEqual([]);
  });

  it('separates own tags from inherited pickle tags', async () => {
    const model = await messagesModelFor(tagsFixture);

    const scenario = model.scenarios.find(
      (entry) => entry.name === 'tagged scenario',
    );
    expect(scenario?.ownTags).toEqual(['@scenario-tag']);
    expect(scenario?.tags).toEqual(
      expect.arrayContaining(['@feature-tag', '@rule-tag', '@scenario-tag']),
    );

    const inheritedOnly = model.scenarios.find(
      (entry) => entry.name === 'Enough money',
    );
    expect(inheritedOnly?.ownTags).toEqual([]);
    expect(inheritedOnly?.tags).toEqual(
      expect.arrayContaining(['@feature-tag', '@rule-tag']),
    );
    expect(inheritedOnly?.tags).not.toContain('@scenario-tag');

    const feature = model.features[0];
    expect(feature?.tags).toEqual(['@feature-tag']);
  });

  it('uses examples tags as own tags for outline rows', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const scenario = envelopes
      .find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature?.children.find((child) => child.scenario)
      ?.scenario;
    expect(scenario).toBeDefined();
    if (!scenario) return;
    scenario.tags = [
      { id: 'outline-tag', name: '@outline', location: { line: 1, column: 1 } },
    ];
    const examples = scenario.examples?.[0];
    expect(examples).toBeDefined();
    if (!examples) return;
    examples.tags = [
      { id: 'examples-tag', name: '@examples', location: { line: 1, column: 1 } },
    ];
    for (const envelope of envelopes) {
      if (envelope.pickle?.astNodeIds[0] !== scenario.id) continue;
      envelope.pickle.tags = [
        ...(envelope.pickle.tags ?? []),
        { name: '@outline', astNodeId: 'outline-tag' },
        { name: '@examples', astNodeId: 'examples-tag' },
      ];
    }

    const model = buildReportModel(envelopes);
    const rows = model.scenarios.filter(
      (entry) =>
        entry.outline?.id === scenario.id && entry.outline.examplesIndex === 0,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.ownTags.includes('@examples'))).toBe(true);
    expect(rows.every((row) => !row.ownTags.includes('@outline'))).toBe(true);
    expect(rows.every((row) => row.tags.includes('@outline'))).toBe(true);
  });

  it('collects feature and rule background metadata', async () => {
    const backgrounds = await messagesModelFor(backgroundsFixture);
    expect(backgrounds.features[0]?.backgrounds).toEqual([
      {
        id: expect.any(String),
        keyword: 'Background',
        name: '',
        description: '',
      },
    ]);
    expect(backgrounds.counts.scenarios.total).toBe(2);
    expect(backgrounds.counts.steps.total).toBe(10);

    const nested = await messagesModelFor(rulesBackgroundsFixture);
    expect(nested.features[0]?.backgrounds).toHaveLength(1);
    const scenarios = nested.scenarios;
    expect(scenarios).toHaveLength(2);
    expect(
      scenarios.every(
        (scenario) =>
          scenario.rule?.backgrounds.length === 1 &&
          scenario.rule.name === '' &&
          scenario.rule.keyword === 'Rule',
      ),
    ).toBe(true);
    expect(nested.counts.steps.total).toBe(14);
  });

  it('skips synthetic legacy backgrounds and invents no rules', async () => {
    const model = await modelFor(behave);
    expect(model.features[0]?.backgrounds).toEqual([]);
    expect(model.scenarios.every((scenario) => !scenario.rule)).toBe(true);
    expect(model.scenarios.every((scenario) => !scenario.ruleName)).toBe(true);
    expect(
      model.scenarios.every((scenario) => Array.isArray(scenario.ownTags)),
    ).toBe(true);
  });

  it('keeps legacy scenario tags own and inherited ones on the pickle', async () => {
    const model = await modelFor(behave);
    const scenario = model.scenarios[0];
    expect(scenario?.ownTags).toEqual(['@scenario']);
    expect(scenario?.tags).toEqual(['@behave', '@scenario']);
  });

  it('adds no rules or backgrounds for JUnit input', async () => {
    const content = await readFile(
      fileURLToPath(new URL('./fixtures/junit/basic.xml', import.meta.url)),
      'utf8',
    );
    const { parseJUnitXml } = await import('../src/input/junit.js');
    const model = buildReportModel(await parseJUnitXml(content, 'basic.xml'));
    expect(model.features[0]?.backgrounds).toEqual([]);
    expect(model.scenarios.every((scenario) => !scenario.rule)).toBe(true);
    expect(model.scenarios.every((scenario) => scenario.ownTags.length === 0)).toBe(
      true,
    );
  });
});

describe('empty-run model', () => {
  it('marks the CCK blank scenario unexecuted and leaves the counts', async () => {
    const model = await messagesModelFor(emptyFixture);

    expect(model.scenarios).toHaveLength(1);
    expect(model.scenarios[0]).toMatchObject({
      name: 'Blank Scenario',
      executed: false,
      status: 'unknown',
      steps: [],
    });
    expect(model.counts.scenarios.total).toBe(0);
    expect(model.counts.scenarios.unknown).toBe(0);
    expect(model.counts.features).toBe(1);
    expect(model.features[0]?.status).toBe('unknown');
    expect(model.features[0]?.scenarios).toHaveLength(1);
  });

  it('keeps a started-but-unfinished scenario as an unexecuted row', async () => {
    const model = await messagesModelFor(emptyUnfinishedFixture);

    expect(model.scenarios).toHaveLength(1);
    expect(model.scenarios[0]).toMatchObject({
      name: 'Unfinished scenario',
      executed: false,
      status: 'unknown',
    });
    expect(model.counts.scenarios.total).toBe(0);
    expect(model.features[0]?.status).toBe('unknown');
  });

  it('excludes unexecuted rows from a mixed feature and prunes never-started pickles', async () => {
    const model = await messagesModelFor(emptyMixedFixture);

    expect(model.scenarios.map((scenario) => scenario.name)).toEqual([
      'Passed scenario',
      'Blank started scenario',
    ]);
    expect(model.scenarios.map((scenario) => scenario.executed)).toEqual([
      true,
      false,
    ]);
    expect(model.scenarios[1]?.status).toBe('unknown');
    expect(model.counts.scenarios).toMatchObject({
      total: 1,
      passed: 1,
      unknown: 0,
    });
    expect(model.features[0]?.status).toBe('passed');
  });

  it('counts a hook-only result as executed and failed', async () => {
    const model = await messagesModelFor(emptyHookOnlyFixture);

    expect(model.scenarios).toHaveLength(1);
    expect(model.scenarios[0]).toMatchObject({
      executed: true,
      status: 'failed',
      steps: [],
    });
    expect(model.scenarios[0]?.hooks).toHaveLength(1);
    expect(model.scenarios[0]?.hooks[0]?.status).toBe('failed');
    expect(model.counts.scenarios).toMatchObject({ total: 1, failed: 1 });
    expect(model.counts.steps.total).toBe(0);
    expect(model.counts.hooks.total).toBe(1);
  });

  it('selects the latest started attempt even when it has no result', async () => {
    const model = await messagesModelFor(emptyRetryFixture);

    expect(model.scenarios).toHaveLength(1);
    expect(model.scenarios[0]).toMatchObject({
      attempt: 1,
      executed: false,
      status: 'unknown',
    });
    expect(model.counts.scenarios.total).toBe(0);
  });

  it('drops attachments from an unexecuted scenario', async () => {
    const model = await messagesModelFor(emptyUnexecutedAttachmentFixture);

    expect(model.scenarios).toHaveLength(1);
    expect(model.scenarios[0]).toMatchObject({
      name: 'Unexecuted with an attachment',
      executed: false,
      attachments: [],
      extraAttachments: [],
    });
    expect(model.counts.attachments).toBe(0);
    expect(model.counts.attachmentBytes).toBe(0);
  });

  it('keeps only the started example of a mixed outline', async () => {
    const model = await messagesModelFor(emptyOutlineMixedFixture);

    expect(model.scenarios).toHaveLength(1);
    expect(model.scenarios[0]).toMatchObject({
      name: 'Eat 1 cucumbers',
      executed: false,
      status: 'unknown',
    });
    expect(model.scenarios[0]?.outline).toMatchObject({
      examplesName: 'Mixed examples',
      examplesIndex: 0,
      exampleIndex: 0,
    });
    expect(model.features[0]?.scenarios).toHaveLength(1);
  });

  it('keeps an all-unexecuted feature visible with status unknown', async () => {
    const model = await messagesModelFor(emptyAllUnexecutedFixture);

    expect(model.scenarios).toHaveLength(2);
    expect(model.scenarios.every((scenario) => !scenario.executed)).toBe(
      true,
    );
    expect(model.counts.scenarios.total).toBe(0);
    expect(model.counts.scenarios.unknown).toBe(0);
    expect(model.features).toHaveLength(1);
    expect(model.features[0]?.status).toBe('unknown');
    expect(model.features[0]?.scenarios).toHaveLength(2);
  });

  it('derives a mixed feature status from executed rows only', async () => {
    const model = await messagesModelFor(emptyStatusesFixture);

    expect(model.scenarios.map((scenario) => scenario.name)).toEqual([
      'Passed scenario',
      'Failed scenario',
      'Blank unexecuted scenario',
    ]);
    expect(model.counts.scenarios).toMatchObject({
      total: 2,
      passed: 1,
      failed: 1,
      unknown: 0,
    });
    expect(model.features[0]?.status).toBe('failed');
  });

  it.each<[string, string, string]>([
    ['empty-mixed.ndjson', emptyMixedFixture, 'passed'],
    ['empty-statuses.ndjson', emptyStatusesFixture, 'failed'],
    ['empty-all-unexecuted.ndjson', emptyAllUnexecutedFixture, 'unknown'],
    ['empty-unfinished.ndjson', emptyUnfinishedFixture, 'unknown'],
    ['empty-hook-only.ndjson', emptyHookOnlyFixture, 'failed'],
    ['empty-retry.ndjson', emptyRetryFixture, 'unknown'],
    ['empty-outline-mixed.ndjson', emptyOutlineMixedFixture, 'unknown'],
    ['empty-none.ndjson', emptyNoneFixture, 'unknown'],
  ])(
    'derives the executed worst status for %s',
    async (_name, fixture, expected) => {
      const model = await messagesModelFor(fixture);

      expect(worstExecutedStatus(model.scenarios)).toBe(expected);
    },
  );

  it('produces no rows or counts when the run has no scenarios', async () => {
    const model = await messagesModelFor(emptyNoneFixture);

    expect(model.scenarios).toEqual([]);
    expect(model.features).toEqual([]);
    expect(model.counts.features).toBe(0);
    expect(model.counts.scenarios.total).toBe(0);
  });

  it('treats a legacy zero-step scenario as unexecuted', async () => {
    const model = await modelFor(legacyEmptyFixture);

    expect(model.scenarios).toHaveLength(1);
    expect(model.scenarios[0]).toMatchObject({
      name: 'Legacy blank scenario',
      executed: false,
      status: 'unknown',
    });
    expect(model.counts.scenarios.total).toBe(0);
    expect(model.counts.scenarios.unknown).toBe(0);
  });

  it('keeps a legacy step without a result executed and unknown', async () => {
    const model = await modelFor(legacyMissingResultFixture);

    expect(model.scenarios).toHaveLength(1);
    expect(model.scenarios[0]).toMatchObject({
      name: 'Legacy unknown scenario',
      executed: true,
      status: 'unknown',
    });
    expect(model.scenarios[0]?.steps).toHaveLength(1);
    expect(model.counts.scenarios).toMatchObject({ total: 1, unknown: 1 });
  });

  it('keeps legacy attachments executed and counted once', async () => {
    const model = await modelFor(legacyScreenshotFixture);

    expect(model.scenarios.length).toBeGreaterThan(0);
    expect(model.scenarios.every((scenario) => scenario.executed)).toBe(
      true,
    );
    expect(model.counts.scenarios.total).toBe(model.scenarios.length);
    expect(model.counts.attachments).toBe(
      model.scenarios.reduce(
        (sum, scenario) => sum + scenario.attachments.length,
        0,
      ),
    );
  });

  it('keeps JUnit test cases executed', async () => {
    const content = await readFile(
      fileURLToPath(new URL('./fixtures/junit/basic.xml', import.meta.url)),
      'utf8',
    );
    const { parseJUnitXml } = await import('../src/input/junit.js');
    const model = buildReportModel(await parseJUnitXml(content, 'basic.xml'));

    expect(model.scenarios.length).toBeGreaterThan(0);
    expect(model.scenarios.every((scenario) => scenario.executed)).toBe(
      true,
    );
    expect(model.counts.scenarios.total).toBe(model.scenarios.length);
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

    const absent = buildReportModel(
      parseMessages(lines(''), 'absent.ndjson'),
    );
    const valid = buildReportModel(
      parseMessages(lines('"attempt":2,'), 'valid.ndjson'),
    );

    expect(absent.scenarios[0]?.attempt).toBe(0);
    expect(valid.scenarios[0]?.attempt).toBe(2);
  });

  it('treats a zero run and scenario timestamp as unknown', async () => {
    const model = buildReportModel(await loadEnvelopes(noTimingFixture));

    expect(model.startedAt).toBeUndefined();
    expect(model.finishedAt).toBeUndefined();
    expect(model.scenarios[0]?.startedAt).toBeUndefined();
    expect(JSON.stringify(model)).not.toContain('1970');
  });

  it('keeps a real run and scenario timestamp', async () => {
    const model = buildReportModel(await loadEnvelopes(realRunFixture));

    expect(model.startedAt).toMatch(/^2026-11-18/);
    expect(model.finishedAt).toBeDefined();
    expect(model.scenarios[0]?.startedAt).toMatch(/^2026-11-18/);
  });
});

describe('display URI model fallback', () => {
  const USER = 'alice';

  function featurelessModel(uri: string) {
    const envelopes = [
      {
        pickle: {
          id: 'uri-pickle',
          uri,
          name: 'Orphan scenario',
          language: 'en',
          astNodeIds: ['uri-scenario'],
          tags: [],
          steps: [{ id: 'uri-pickle-step', text: 'a step', astNodeIds: [] }],
        },
      },
      {
        testCase: {
          id: 'uri-case',
          pickleId: 'uri-pickle',
          testSteps: [
            { id: 'uri-step', pickleStepId: 'uri-pickle-step' },
          ],
        },
      },
      {
        testCaseStarted: {
          id: 'uri-start',
          testCaseId: 'uri-case',
          attempt: 0,
          timestamp: { seconds: 1, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: 'uri-start',
          testStepId: 'uri-step',
          testStepResult: {
            status: 'PASSED',
            duration: { seconds: 0, nanos: 1 },
          },
          timestamp: { seconds: 1, nanos: 1 },
        },
      },
    ];
    return buildReportModel(envelopes as unknown as Envelope[]);
  }

  it.each([
    {
      name: 'POSIX file URL',
      uri: `file:///home/${USER}/proj/features/login.feature`,
      expected: 'features/login.feature',
    },
    {
      name: 'POSIX file URL without a features marker',
      uri: `file:///home/${USER}/proj/login.feature`,
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
      uri: `file:%2Fhome%2F${USER}%2Fproj%2Ffeatures%2Flogin.feature`,
      expected: 'features/login.feature',
    },
    {
      name: 'percent-encoded leading Windows separator',
      uri: `file:%5Chome%5C${USER}%5Cproj%5Cfeatures%5Clogin.feature`,
      expected: 'features/login.feature',
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
  ])('uses the display URI for a feature without an AST name: $name', ({
    uri,
    expected,
  }) => {
    const model = featurelessModel(uri);

    expect(model.scenarios[0]?.featureName).toBe(expected);
    expect(model.scenarios[0]?.featureName).not.toContain(USER);
    expect(model.scenarios[0]?.featureName).not.toContain('/Users/');
    expect(model.scenarios[0]?.featureName).not.toMatch(/^[a-z]:\//i);
    // The model keeps the raw URI for provenance lookup; the report, JSON
    // summary and copied text apply displayUri and are asserted separately.
    expect(model.scenarios[0]?.uri).toBe(uri);
  });

  it('keeps a relative feature fallback unchanged', () => {
    const model = featurelessModel(`home/${USER}/proj/login.feature`);

    expect(model.scenarios[0]?.featureName).toBe(
      `home/${USER}/proj/login.feature`,
    );
  });

  it('keeps an empty URI fallback empty', () => {
    const model = featurelessModel('');

    expect(model.scenarios[0]?.featureName).toBe('');
  });

  it('normalises a legacy file URL before the model fallback', async () => {
    const content = await readFile(legacyMinimalFixture, 'utf8');
    const envelopes = parseLegacyJson(
      content.replace('features/minimal.feature', `file:///home/${USER}/proj/login.feature`),
      'legacy-uri.json',
      { idPrefix: 'uri' },
    );
    const model = buildReportModel(envelopes);

    expect(model.scenarios[0]?.uri).toBe('login.feature');
    expect(model.scenarios[0]?.uri).not.toContain(USER);
    expect(JSON.stringify(model)).not.toContain(USER);
  });
});

describe('legacy run time', () => {
  async function legacyEnvelopesWithoutPin() {
    const content = await readFile(legacyMinimalFixture, 'utf8');
    return parseLegacyJson(content, 'minimal.json', { idPrefix: 'clock' });
  }

  it('emits zero start timestamps and never reads the clock without a pin', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-07-08T09:10:11.000Z'));
    try {
      const envelopes = await legacyEnvelopesWithoutPin();
      const runStart = envelopes.find(
        (envelope) => envelope.testRunStarted,
      )?.testRunStarted;
      const scenarioStarts = envelopes.flatMap((envelope) =>
        envelope.testCaseStarted ? [envelope.testCaseStarted.timestamp] : [],
      );

      expect(runStart?.timestamp).toEqual({ seconds: 0, nanos: 0 });
      expect(scenarioStarts.length).toBeGreaterThan(0);
      expect(
        scenarioStarts.every(
          (timestamp) => timestamp?.seconds === 0 && timestamp?.nanos === 0,
        ),
      ).toBe(true);

      const model = buildReportModel(envelopes);
      expect(model.startedAt).toBeUndefined();
      expect(model.scenarios[0]?.startedAt).toBeUndefined();
      expect(JSON.stringify(model)).not.toContain('1970');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps scenario starts at zero for zero and non-zero durations', async () => {
    const content = JSON.stringify([
      {
        uri: 'features/durations.feature',
        name: 'Durations',
        elements: [
          {
            keyword: 'Scenario',
            name: 'zero duration',
            steps: [
              {
                keyword: 'Given ',
                name: 'a zero step',
                result: { status: 'passed', duration: 0 },
              },
            ],
          },
          {
            keyword: 'Scenario',
            name: 'non-zero duration',
            steps: [
              {
                keyword: 'Given ',
                name: 'a slow step',
                result: { status: 'passed', duration: 2_000_000_000 },
              },
            ],
          },
        ],
      },
    ]);
    const envelopes = parseLegacyJson(content, 'durations.json', {
      idPrefix: 'durations',
    });
    const starts = envelopes.flatMap((envelope) =>
      envelope.testCaseStarted ? [envelope.testCaseStarted.timestamp] : [],
    );

    expect(starts).toEqual([
      { seconds: 0, nanos: 0 },
      { seconds: 0, nanos: 0 },
    ]);
  });

  it('pins an explicit non-zero start time and keeps the advancing clock', async () => {
    const content = await readFile(legacyMinimalFixture, 'utf8');
    const pin = new Date('2026-01-01T00:00:00.000Z');
    const envelopes = parseLegacyJson(content, 'minimal.json', {
      idPrefix: 'pin',
      startedAt: pin,
    });
    const runStart = envelopes.find(
      (envelope) => envelope.testRunStarted,
    )?.testRunStarted;
    const model = buildReportModel(envelopes);

    expect(runStart?.timestamp.seconds).toBe(pin.getTime() / 1000);
    expect(model.startedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(model.scenarios[0]?.startedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('treats an explicit epoch pin as zero and unknown', async () => {
    const content = await readFile(legacyMinimalFixture, 'utf8');
    const envelopes = parseLegacyJson(content, 'minimal.json', {
      idPrefix: 'epoch',
      startedAt: new Date(0),
    });
    const model = buildReportModel(envelopes);

    expect(
      envelopes.find((envelope) => envelope.testRunStarted)?.testRunStarted
        ?.timestamp,
    ).toEqual({ seconds: 0, nanos: 0 });
    expect(model.startedAt).toBeUndefined();
    expect(JSON.stringify(model)).not.toContain('1970');
  });

  it('keeps the summary date-free and shape-stable without a pin', async () => {
    const { summarizeEnvelopes } = await import('../src/summary.js');
    const envelopes = await legacyEnvelopesWithoutPin();
    const summary = summarizeEnvelopes(envelopes);

    expect(Object.hasOwn(summary, 'date')).toBe(false);
    expect(Object.hasOwn(summary, 'startedAt')).toBe(false);
    expect(summary.schemaVersion).toBe(2);
    expect(JSON.stringify(summary)).not.toContain('1970');
  });
});

describe('media attachment data URIs', () => {
  function mediaModel(
    body: string,
    mediaType: string,
    contentEncoding = 'IDENTITY',
  ) {
    const envelopes = [
      {
        pickle: {
          id: 'media-pickle',
          uri: 'features/media.feature',
          name: 'Media scenario',
          language: 'en',
          astNodeIds: ['media-scenario'],
          tags: [],
          steps: [{ id: 'media-pickle-step', text: 'a step', astNodeIds: [] }],
        },
      },
      {
        testCase: {
          id: 'media-case',
          pickleId: 'media-pickle',
          testSteps: [
            { id: 'media-step', pickleStepId: 'media-pickle-step' },
          ],
        },
      },
      {
        testCaseStarted: {
          id: 'media-start',
          testCaseId: 'media-case',
          attempt: 0,
          timestamp: { seconds: 1, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: 'media-start',
          testStepId: 'media-step',
          testStepResult: {
            status: 'PASSED',
            duration: { seconds: 0, nanos: 1 },
          },
          timestamp: { seconds: 1, nanos: 1 },
        },
      },
      {
        attachment: {
          body,
          contentEncoding,
          mediaType,
          fileName: 'media',
          testCaseStartedId: 'media-start',
        },
      },
    ];
    return buildReportModel(envelopes as unknown as Envelope[]);
  }

  function dataUriOf(model: ReturnType<typeof buildReportModel>) {
    return model.scenarios[0]?.extraAttachments[0]?.dataUri;
  }

  const fallback = (mediaType: string, body: string) =>
    `data:${mediaType};base64,${Buffer.from(body, 'utf8').toString('base64')}`;

  it.each([
    ['image/png', '\uD800'],
    ['image/png', '\uDC00'],
    ['video/mp4', '\uD800'],
    ['video/mp4', '\uDC00'],
  ])(
    'falls back to base64 for a lone surrogate in a %s body (%j)',
    (mediaType, body) => {
      const model = mediaModel(body, mediaType);
      const dataUri = dataUriOf(model);

      expect(dataUri).toBe(fallback(mediaType, body));
      expect(dataUri ?? '').toMatch(/;base64,/);
    },
  );

  it('treats an audio media type as a binary attachment without throwing', () => {
    const body = 'audio \uD800 body';
    let model: ReturnType<typeof buildReportModel> | undefined;
    expect(() => {
      model = mediaModel(body, 'audio/mpeg');
    }).not.toThrow();

    const attachment = model?.scenarios[0]?.extraAttachments[0];
    expect(attachment).toMatchObject({
      fileName: 'media',
      mediaType: 'application/octet-stream',
      kind: 'binary',
    });
    expect(attachment?.dataUri).toBeUndefined();
    // The model keeps the body for the text presentation; the binary report
    // row shows the file, not an inline media source.
    expect(attachment?.text).toBe(body);
    expect(model?.scenarios).toHaveLength(1);
  });

  it('keeps a readable data URI for a normal UTF-8 body', () => {
    const model = mediaModel('hello', 'image/png');

    expect(dataUriOf(model)).toBe('data:image/png;charset=utf-8,hello');
  });

  it('keeps a valid surrogate pair readable', () => {
    const model = mediaModel('\uD83D\uDE00', 'image/png');
    const dataUri = dataUriOf(model);

    expect(dataUri).toBe('data:image/png;charset=utf-8,%F0%9F%98%80');
    expect(dataUri ?? '').not.toContain(';base64,');
  });

  it('keeps a BASE64 media body byte-identical and un-re-encoded', () => {
    const model = mediaModel('AAAA', 'image/png', 'BASE64');

    expect(dataUriOf(model)).toBe('data:image/png;base64,AAAA');
  });

  it('renders no data URI for an empty media body', () => {
    const model = mediaModel('', 'image/png');

    expect(dataUriOf(model)).toBeUndefined();
  });
});
