import {
  AttachmentContentEncoding,
  HookType,
  TestStepResultStatus,
  version as messagesVersion,
} from '@cucumber/messages';
import type {
  Attachment,
  DataTable,
  DocString,
  Duration,
  Envelope,
  Feature,
  Hook,
  Location,
  Meta,
  Pickle,
  PickleStep,
  Scenario,
  Step,
  TableRow,
  Tag,
  TestCase,
  TestStep,
  TestStepResult,
  Timestamp,
} from '@cucumber/messages';

interface LegacyTag {
  name?: string;
  line?: number;
}

interface LegacyArgument {
  content?: string;
  line?: number;
  rows?: Array<{ cells?: string[] }>;
}

interface LegacyEmbedding {
  data?: string;
  media?: { type?: string };
}

interface LegacyResult {
  status?: string;
  duration?: number;
  error_message?: string;
}

interface LegacyStep {
  keyword?: string;
  name?: string;
  line?: number;
  hidden?: boolean;
  result?: LegacyResult;
  embeddings?: LegacyEmbedding[];
  arguments?: LegacyArgument[];
  match?: { location?: string };
}

interface LegacyElement {
  keyword?: string;
  name?: string;
  description?: string;
  line?: number;
  tags?: LegacyTag[];
  steps?: LegacyStep[];
}

interface LegacyFeature {
  uri?: string;
  keyword?: string;
  name?: string;
  description?: string;
  line?: number;
  tags?: LegacyTag[];
  elements?: LegacyElement[];
}

interface LegacyJsonOptions {
  idPrefix?: string;
  startedAt?: Date;
}

interface StepPlan {
  testStep: TestStep;
  legacyStep: LegacyStep;
}

function createIdFactory(prefix: string): (kind: string) => string {
  let counter = 0;
  return (kind: string) => `${prefix}-${kind}-${counter++}`;
}

function normalizeUri(uri: string | undefined, index: number): string {
  if (!uri) return `features/legacy-${index}.feature`;
  const normalized = uri.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const name = parts.at(-1) ?? `legacy-${index}.feature`;
  return `features/${name}`;
}

function location(line?: number, column?: number): Location {
  return column === undefined ? { line: line ?? 1 } : { line: line ?? 1, column };
}

function timestamp(seconds: number, nanos = 0): Timestamp {
  return { seconds, nanos };
}

function duration(nanoseconds?: number): Duration {
  const value = Math.max(0, nanoseconds ?? 0);
  return {
    seconds: Math.floor(value / 1_000_000_000),
    nanos: value % 1_000_000_000,
  };
}

function addDuration(base: Timestamp, value: Duration): Timestamp {
  let seconds = base.seconds + value.seconds;
  let nanos = base.nanos + value.nanos;
  if (nanos >= 1_000_000_000) {
    seconds += Math.floor(nanos / 1_000_000_000);
    nanos %= 1_000_000_000;
  }
  return { seconds, nanos };
}

function statusOf(value: string | undefined): TestStepResultStatus {
  switch ((value ?? '').toLowerCase()) {
    case 'passed':
      return TestStepResultStatus.PASSED;
    case 'failed':
      return TestStepResultStatus.FAILED;
    case 'skipped':
      return TestStepResultStatus.SKIPPED;
    case 'pending':
      return TestStepResultStatus.PENDING;
    case 'undefined':
      return TestStepResultStatus.UNDEFINED;
    case 'ambiguous':
      return TestStepResultStatus.AMBIGUOUS;
    default:
      return TestStepResultStatus.UNKNOWN;
  }
}

function isHook(step: LegacyStep): boolean {
  if (step.hidden === true) return true;
  return /^(before|after)\b/i.test((step.keyword ?? '').trim());
}

function mapTags(tags: LegacyTag[] | undefined, nextId: (kind: string) => string): Tag[] {
  return (tags ?? []).map((tag) => ({
    id: nextId('tag'),
    name: tag.name ?? '',
    location: location(tag.line),
  }));
}

function mapDataTable(
  argument: LegacyArgument,
  nextId: (kind: string) => string,
): DataTable {
  return {
    location: location(argument.line),
    rows: (argument.rows ?? []).map(
      (row): TableRow => ({
        id: nextId('row'),
        location: location(argument.line),
        cells: (row.cells ?? []).map((value) => ({
          location: location(argument.line),
          value,
        })),
      }),
    ),
  };
}

function mapDocString(argument: LegacyArgument): DocString {
  return {
    location: location(argument.line),
    content: argument.content ?? '',
    delimiter: '"""',
  };
}

function mapStepArguments(
  legacyStep: LegacyStep,
  nextId: (kind: string) => string,
): { docString?: DocString; dataTable?: DataTable } {
  const argument = legacyStep.arguments?.[0];
  if (!argument) return {};
  if (argument.rows !== undefined) {
    return { dataTable: mapDataTable(argument, nextId) };
  }
  if (argument.content !== undefined) {
    return { docString: mapDocString(argument) };
  }
  return {};
}

function mapStep(
  legacyStep: LegacyStep,
  nextId: (kind: string) => string,
): Step {
  const mapped: Step = {
    id: nextId('step'),
    location: location(legacyStep.line),
    keyword: (legacyStep.keyword ?? 'Given').trim() || 'Given',
    text: legacyStep.name ?? '',
  };
  const args = mapStepArguments(legacyStep, nextId);
  if (args.docString) mapped.docString = args.docString;
  if (args.dataTable) mapped.dataTable = args.dataTable;
  return mapped;
}

function mapPickleArgument(
  legacyStep: LegacyStep,
): PickleStep['argument'] {
  const argument = legacyStep.arguments?.[0];
  if (!argument) return undefined;
  if (argument.rows !== undefined) {
    return {
      dataTable: {
        rows: (argument.rows ?? []).map((row) => ({
          cells: (row.cells ?? []).map((value) => ({ value })),
        })),
      },
    };
  }
  if (argument.content !== undefined) {
    return { docString: { content: argument.content } };
  }
  return undefined;
}

function resultOf(legacyStep: LegacyStep): TestStepResult {
  const raw = legacyStep.result;
  const message = raw?.error_message;
  const result: TestStepResult = {
    status: statusOf(raw?.status),
    duration: duration(raw?.duration),
  };
  if (message) {
    result.message = message;
    result.exception = { type: 'Error', message };
  }
  return result;
}

function attachmentFileName(mediaType: string, index: number): string {
  const subtype = mediaType.split('/')[1]?.split(';')[0]?.trim() || 'bin';
  return `attachment-${index + 1}.${subtype}`;
}

export function parseLegacyJson(
  content: string,
  source: string,
  options: LegacyJsonOptions = {},
): Envelope[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid legacy JSON in ${source}: ${detail}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid legacy JSON in ${source}: expected an array of features.`);
  }

  const features = parsed as LegacyFeature[];
  const nextId = createIdFactory(options.idPrefix ?? 'legacy');
  const startedAt = Math.floor((options.startedAt ?? new Date()).getTime() / 1000);
  const runId = nextId('run');
  const envelopes: Envelope[] = [];
  const statuses: TestStepResultStatus[] = [];

  const meta: Meta = {
    protocolVersion: messagesVersion,
    implementation: { name: 'tolkira-legacy-json' },
    runtime: { name: 'node.js', version: process.versions.node },
    os: { name: process.platform },
    cpu: { name: process.arch },
  };
  envelopes.push({ meta });
  envelopes.push({ testRunStarted: { id: runId, timestamp: timestamp(startedAt) } });

  let clock = timestamp(startedAt);

  for (const [featureIndex, legacyFeature] of features.entries()) {
    const uri = normalizeUri(legacyFeature.uri, featureIndex);
    const featureTags = mapTags(legacyFeature.tags, nextId);
    const featureChildren: Array<{ scenario: Scenario }> = [];
    const scenarioEnvelopes: Envelope[] = [];
    const featureNode: Feature = {
      location: location(legacyFeature.line),
      tags: featureTags,
      language: 'en',
      keyword: 'Feature',
      name: legacyFeature.name ?? `Feature ${featureIndex + 1}`,
      description: legacyFeature.description ?? '',
      children: [],
    };

    const scenarios: LegacyElement[] = legacyFeature.elements ?? [];

    for (const [scenarioIndex, element] of scenarios.entries()) {
      const scenarioId = nextId('scenario');
      const scenarioTags = mapTags(element.tags, nextId);
      const scenarioSteps = (element.steps ?? []).filter((step) => !isHook(step));
      const stepNodes = scenarioSteps.map((step) => mapStep(step, nextId));

      const scenario: Scenario = {
        id: scenarioId,
        location: location(element.line),
        tags: scenarioTags,
        keyword: (element.keyword ?? 'Scenario').trim() || 'Scenario',
        name: element.name ?? `Scenario ${scenarioIndex + 1}`,
        description: element.description ?? '',
        steps: stepNodes,
        examples: [],
      };
      featureChildren.push({ scenario });

      const pickleSteps: PickleStep[] = scenarioSteps.map((legacyStep, index) => {
        const step = stepNodes[index] as Step;
        const pickleStep: PickleStep = {
          id: nextId('pickle-step'),
          text: step.text,
          astNodeIds: [step.id],
        };
        const argument = mapPickleArgument(legacyStep);
        if (argument) pickleStep.argument = argument;
        return pickleStep;
      });

      const pickle: Pickle = {
        id: nextId('pickle'),
        uri,
        location: location(element.line),
        name: scenario.name,
        language: 'en',
        steps: pickleSteps,
        tags: [...featureTags, ...scenarioTags].map((tag) => ({
          name: tag.name,
          astNodeId: tag.id,
        })),
        astNodeIds: [scenario.id],
      };

      const plans: StepPlan[] = [];
      const hooks: Envelope[] = [];
      const hookSteps = (element.steps ?? []).filter((step) => isHook(step));
      const beforeHooks = hookSteps.filter(
        (step) => !/^after/i.test((step.keyword ?? '').trim()),
      );
      const afterHooks = hookSteps.filter((step) =>
        /^after/i.test((step.keyword ?? '').trim()),
      );

      for (const hookStep of beforeHooks) {
        const hookId = nextId('hook');
        const hook: Hook = {
          id: hookId,
          sourceReference: {
            uri,
            location: location(hookStep.line),
          },
          type: HookType.BEFORE_TEST_CASE,
        };
        hooks.push({ hook });
        plans.push({
          testStep: { id: nextId('test-step'), hookId },
          legacyStep: hookStep,
        });
      }

      for (const [index, pickleStep] of pickleSteps.entries()) {
        const legacyStep = scenarioSteps[index] as LegacyStep;
        plans.push({
          testStep: { id: nextId('test-step'), pickleStepId: pickleStep.id },
          legacyStep,
        });
      }

      for (const hookStep of afterHooks) {
        const hookId = nextId('hook');
        const hook: Hook = {
          id: hookId,
          sourceReference: {
            uri,
            location: location(hookStep.line),
          },
          type: HookType.AFTER_TEST_CASE,
        };
        hooks.push({ hook });
        plans.push({
          testStep: { id: nextId('test-step'), hookId },
          legacyStep: hookStep,
        });
      }

      const testCase: TestCase = {
        id: nextId('test-case'),
        pickleId: pickle.id,
        testSteps: plans.map((plan) => plan.testStep),
        testRunStartedId: runId,
      };
      const testCaseStartedId = nextId('test-case-started');

      scenarioEnvelopes.push({ pickle });
      scenarioEnvelopes.push(...hooks);
      scenarioEnvelopes.push({ testCase });
      scenarioEnvelopes.push({
        testCaseStarted: {
          id: testCaseStartedId,
          testCaseId: testCase.id,
          attempt: 0,
          timestamp: clock,
        },
      });

      for (const plan of plans) {
        scenarioEnvelopes.push({
          testStepStarted: {
            testCaseStartedId,
            testStepId: plan.testStep.id,
            timestamp: clock,
          },
        });

        const stepResult = resultOf(plan.legacyStep);
        statuses.push(stepResult.status);
        const finishedAt = addDuration(clock, stepResult.duration);
        scenarioEnvelopes.push({
          testStepFinished: {
            testCaseStartedId,
            testStepId: plan.testStep.id,
            testStepResult: stepResult,
            timestamp: finishedAt,
          },
        });

        for (const [embeddingIndex, embedding] of (
          plan.legacyStep.embeddings ?? []
        ).entries()) {
          if (!embedding.data) continue;
          const mediaType = embedding.media?.type ?? 'application/octet-stream';
          const attachment: Attachment = {
            body: embedding.data,
            contentEncoding: AttachmentContentEncoding.BASE64,
            mediaType,
            fileName: attachmentFileName(mediaType, embeddingIndex),
            testCaseStartedId,
            testStepId: plan.testStep.id,
            timestamp: finishedAt,
          };
          scenarioEnvelopes.push({ attachment });
        }

        clock = finishedAt;
      }

      scenarioEnvelopes.push({
        testCaseFinished: {
          testCaseStartedId,
          timestamp: clock,
          willBeRetried: false,
        },
      });
    }

    // Emit the document before its pickles and test events so the renderer can
    // resolve the feature/scenario tree while consuming the stream.
    featureNode.children = featureChildren;
    envelopes.push({
      gherkinDocument: { uri, feature: featureNode, comments: [] },
    });
    envelopes.push(...scenarioEnvelopes);
  }

  const success = !statuses.some(
    (status) =>
      status === TestStepResultStatus.FAILED ||
      status === TestStepResultStatus.AMBIGUOUS ||
      status === TestStepResultStatus.UNDEFINED,
  );

  envelopes.push({
    testRunFinished: {
      testRunStartedId: runId,
      success,
      timestamp: clock,
    },
  });

  return envelopes;
}
