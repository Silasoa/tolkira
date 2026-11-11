import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TestStepResultStatus } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
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

    expect(attachment?.fileName).toBe('attachment-1.png');
    expect(attachment?.dataUri).toMatch(/^data:image\/png;base64,/);
    expect(attachment?.bytes).toBeGreaterThan(0);
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
    expect(model.scenarios.every((scenario) => scenario.executed === false)).toBe(
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
    expect(model.scenarios.every((scenario) => scenario.executed === true)).toBe(
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
    expect(model.scenarios.every((scenario) => scenario.executed === true)).toBe(
      true,
    );
    expect(model.counts.scenarios.total).toBe(model.scenarios.length);
  });
});
