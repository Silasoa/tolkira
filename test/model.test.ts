import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TestStepResultStatus } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';

const happy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const screenshot = fileURLToPath(
  new URL('./fixtures/legacy/screenshot.json', import.meta.url),
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
