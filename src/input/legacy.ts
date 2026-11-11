import {
  AttachmentContentEncoding,
  HookType,
  TestStepResultStatus,
} from '@cucumber/messages';
import { markSyntheticBackground } from './background.js';
import type {
  Attachment,
  Background,
  DataTable,
  DocString,
  Duration,
  Envelope,
  Feature,
  FeatureChild,
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

type LegacyTags = Array<LegacyTag | string> | undefined;

interface LegacyArgument {
  content?: string;
  line?: number;
  rows?: Array<{ cells?: string[] }>;
}

interface LegacyEmbedding {
  data?: string;
  media?: { type?: string };
  mime_type?: string;
}

interface LegacyResult {
  status?: string;
  duration?: number;
  error_message?: string;
}

interface LegacyDocString {
  content?: string;
  value?: string;
  line?: number;
  contentType?: string;
  content_type?: string;
}

interface LegacyStep {
  keyword?: string;
  name?: string;
  text?: string;
  line?: number;
  hidden?: boolean;
  result?: LegacyResult;
  embeddings?: LegacyEmbedding[];
  arguments?: LegacyArgument[];
  docString?: string | LegacyDocString;
  rows?: Array<{ cells?: string[] }>;
  table?:
    | { headings?: string[]; rows?: string[][] }
    | { rows?: Array<{ cells?: string[] }> }
    | Array<{ cells?: string[] }>;
  match?: { location?: string };
}

interface LegacyElement {
  keyword?: string;
  type?: string;
  name?: string;
  description?: string | string[];
  line?: number;
  location?: string;
  status?: string;
  tags?: LegacyTags;
  steps?: LegacyStep[];
  before?: LegacyStep[];
  after?: LegacyStep[];
}

interface LegacyFeature {
  uri?: string;
  location?: string;
  keyword?: string;
  name?: string;
  description?: string | string[];
  line?: number;
  tags?: LegacyTags;
  elements?: LegacyElement[];
}

interface LegacyJsonOptions {
  idPrefix?: string;
  startedAt?: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const LEGACY_STATUSES = new Set([
  'passed',
  'failed',
  'skipped',
  'pending',
  'undefined',
  'ambiguous',
  'unknown',
]);

function invalidLegacy(source: string, detail: string): Error {
  return new Error(`Invalid legacy JSON in ${source}: ${detail}`);
}

function validateStep(
  step: Record<string, unknown>,
  source: string,
  where: string,
): void {
  if (step.embeddings !== undefined && !Array.isArray(step.embeddings)) {
    throw invalidLegacy(source, `${where}.embeddings must be an array.`);
  }
  for (const embedding of step.embeddings ?? []) {
    if (
      !isRecord(embedding) ||
      (embedding.data !== undefined && typeof embedding.data !== 'string')
    ) {
      throw invalidLegacy(source, `${where}.embeddings entries must have string data.`);
    }
    if (
      embedding.media !== undefined &&
      (!isRecord(embedding.media) ||
        (embedding.media.type !== undefined &&
          typeof embedding.media.type !== 'string'))
    ) {
      throw invalidLegacy(source, `${where}.embeddings media type must be a string.`);
    }
    if (
      embedding.mime_type !== undefined &&
      typeof embedding.mime_type !== 'string'
    ) {
      throw invalidLegacy(source, `${where}.embeddings mime_type must be a string.`);
    }
  }
  if (step.arguments !== undefined && !Array.isArray(step.arguments)) {
    throw invalidLegacy(source, `${where}.arguments must be an array.`);
  }
  if (step.result !== undefined) {
    if (!isRecord(step.result)) {
      throw invalidLegacy(source, `${where}.result must be an object.`);
    }
    if (
      step.result.status !== undefined &&
      (typeof step.result.status !== 'string' ||
        !LEGACY_STATUSES.has(step.result.status.toLowerCase()))
    ) {
      throw invalidLegacy(source, `${where}.result.status must be a known status.`);
    }
  }
  if (
    step.docString !== undefined &&
    typeof step.docString !== 'string' &&
    !isRecord(step.docString)
  ) {
    throw invalidLegacy(source, `${where}.docString must be a string or object.`);
  }
  if (step.rows !== undefined && !Array.isArray(step.rows)) {
    throw invalidLegacy(source, `${where}.rows must be an array.`);
  }
}

function validateLegacyFeatures(
  values: unknown[],
  source: string,
): asserts values is LegacyFeature[] {
  for (const [featureIndex, feature] of values.entries()) {
    if (!isRecord(feature)) {
      throw invalidLegacy(source, `feature ${featureIndex + 1} must be an object.`);
    }

    if (feature.elements !== undefined && !Array.isArray(feature.elements)) {
      throw invalidLegacy(
        source,
        `feature ${featureIndex + 1}.elements must be an array.`,
      );
    }
    if (feature.uri !== undefined && typeof feature.uri !== 'string') {
      throw invalidLegacy(source, `feature ${featureIndex + 1}.uri must be a string.`);
    }
    if (feature.location !== undefined && typeof feature.location !== 'string') {
      throw invalidLegacy(
        source,
        `feature ${featureIndex + 1}.location must be a string.`,
      );
    }
    if (
      feature.description !== undefined &&
      typeof feature.description !== 'string' &&
      !Array.isArray(feature.description)
    ) {
      throw invalidLegacy(
        source,
        `feature ${featureIndex + 1}.description must be a string or array.`,
      );
    }
    if (feature.tags !== undefined && !Array.isArray(feature.tags)) {
      throw invalidLegacy(
        source,
        `feature ${featureIndex + 1}.tags must be an array.`,
      );
    }

    for (const [elementIndex, element] of (feature.elements ?? []).entries()) {
      if (!isRecord(element)) {
        throw invalidLegacy(
          source,
          `feature ${featureIndex + 1} element ${elementIndex + 1} must be an object.`,
        );
      }
      const where = `feature ${featureIndex + 1} element ${elementIndex + 1}`;
      if (element.steps !== undefined && !Array.isArray(element.steps)) {
        throw invalidLegacy(source, `${where}.steps must be an array.`);
      }
      if (element.before !== undefined && !Array.isArray(element.before)) {
        throw invalidLegacy(source, `${where}.before must be an array.`);
      }
      if (element.after !== undefined && !Array.isArray(element.after)) {
        throw invalidLegacy(source, `${where}.after must be an array.`);
      }
      if (element.tags !== undefined && !Array.isArray(element.tags)) {
        throw invalidLegacy(source, `${where}.tags must be an array.`);
      }
      if (
        element.description !== undefined &&
        typeof element.description !== 'string' &&
        !Array.isArray(element.description)
      ) {
        throw invalidLegacy(
          source,
          `${where}.description must be a string or array.`,
        );
      }
      for (const [stepIndex, step] of (element.steps ?? []).entries()) {
        if (!isRecord(step)) {
          throw invalidLegacy(
            source,
            `${where} step ${stepIndex + 1} must be an object.`,
          );
        }
        validateStep(step, source, `${where} step ${stepIndex + 1}`);
      }
      for (const [stepIndex, step] of [
        ...(element.before ?? []),
        ...(element.after ?? []),
      ].entries()) {
        if (!isRecord(step)) {
          throw invalidLegacy(source, `${where} hook ${stepIndex + 1} must be an object.`);
        }
        validateStep(step, source, `${where} hook ${stepIndex + 1}`);
      }
    }
  }
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
  const slashed = uri.replace(/\\/g, '/').replace(/^file:\/\/+/i, '');
  const normalized = slashed.replace(/^\.\//, '');
  if (/^[a-z]:\//i.test(normalized) || slashed.startsWith('/')) {
    const marker = slashed.lastIndexOf('/features/');
    if (marker >= 0) return slashed.slice(marker + 1);
    const parts = slashed.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? `features/legacy-${index}.feature`;
  }
  return normalized || `features/legacy-${index}.feature`;
}

function normalizeText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join('\n');
  return value ?? '';
}

function normalizeTags(tags: LegacyTags): LegacyTag[] {
  return (tags ?? []).map((tag) => (typeof tag === 'string' ? { name: tag } : tag));
}

function location(line?: number, column?: number): Location {
  return column === undefined ? { line: line ?? 1 } : { line: line ?? 1, column };
}

function timestamp(seconds: number, nanos = 0): Timestamp {
  return { seconds, nanos };
}

function duration(nanoseconds?: number): Duration {
  const value = Math.max(0, Math.round(nanoseconds ?? 0));
  return {
    seconds: Math.floor(value / 1_000_000_000),
    nanos: value % 1_000_000_000,
  };
}

function isBehaveFeature(feature: LegacyFeature): boolean {
  return (feature.elements ?? []).some(
    (element) =>
      typeof element.status === 'string' ||
      (typeof element.location === 'string' && element.line === undefined),
  );
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

function isBackgroundElement(element: LegacyElement): boolean {
  return (
    (element.type ?? '').toLowerCase() === 'background' ||
    /^background\b/i.test((element.keyword ?? '').trim())
  );
}

function mapTags(tags: LegacyTags, nextId: (kind: string) => string): Tag[] {
  return normalizeTags(tags).map((tag) => ({
    id: nextId('tag'),
    name: tag.name ?? '',
    location: location(tag.line),
  }));
}

function mapDataTable(
  rows: Array<{ cells?: string[] }> | undefined,
  line: number | undefined,
  nextId: (kind: string) => string,
): DataTable {
  return {
    location: location(line),
    rows: (rows ?? []).map(
      (row): TableRow => ({
        id: nextId('row'),
        location: location(line),
        cells: (row.cells ?? []).map((value) => ({
          location: location(line),
          value,
        })),
      }),
    ),
  };
}

function mapDocString(
  content: string,
  line: number | undefined,
): DocString {
  return {
    location: location(line),
    content,
    delimiter: '"""',
  };
}

function tableRows(
  table: LegacyStep['table'],
): Array<{ cells?: string[] }> | undefined {
  if (table === undefined) return undefined;
  if (Array.isArray(table)) return table;
  if ('headings' in table && table.headings && table.rows) {
    return [
      { cells: table.headings },
      ...table.rows.map((row) => ({ cells: row })),
    ];
  }
  if ('rows' in table && table.rows) {
    if (Array.isArray(table.rows[0])) {
      return (table.rows as string[][]).map((cells) => ({ cells }));
    }
    return table.rows as Array<{ cells?: string[] }>;
  }
  return undefined;
}

function stepArgument(legacyStep: LegacyStep): {
  content?: string;
  rows?: Array<{ cells?: string[] }>;
  line?: number;
} {
  const argument = legacyStep.arguments?.[0];
  if (argument) return argument;

  if (legacyStep.docString !== undefined) {
    const docString =
      typeof legacyStep.docString === 'string'
        ? { content: legacyStep.docString }
        : legacyStep.docString;
    return {
      content: docString.content ?? docString.value ?? '',
      line: docString.line ?? legacyStep.line,
    };
  }

  if (legacyStep.text !== undefined) {
    return { content: legacyStep.text, line: legacyStep.line };
  }

  const rows = tableRows(legacyStep.rows ?? legacyStep.table);
  if (rows !== undefined) {
    return { rows, line: legacyStep.line };
  }

  return {};
}

function mapStepArguments(
  legacyStep: LegacyStep,
  nextId: (kind: string) => string,
): { docString?: DocString; dataTable?: DataTable } {
  const argument = stepArgument(legacyStep);
  if (argument.rows !== undefined) {
    return {
      dataTable: mapDataTable(argument.rows, argument.line, nextId),
    };
  }
  if (argument.content !== undefined) {
    return { docString: mapDocString(argument.content, argument.line) };
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
  const argument = stepArgument(legacyStep);
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

function resultOf(legacyStep: LegacyStep, scale = 1): TestStepResult {
  const raw = legacyStep.result;
  const message = raw?.error_message;
  const result: TestStepResult = {
    status: statusOf(raw?.status),
    duration: duration((raw?.duration ?? 0) * scale),
  };
  if (message) {
    result.message = message;
    result.exception = { type: 'Error', message };
  }
  return result;
}

function isLikelyBase64(value: string): boolean {
  const compact = value.replace(/\s/g, '');
  return (
    compact.length > 0 &&
    compact.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(compact)
  );
}

export function parseLegacyJson(
  content: string,
  source: string,
  options: LegacyJsonOptions = {},
): Envelope[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid legacy JSON in ${source}: ${detail}`);
  }
  return parseLegacyValue(parsed, source, options);
}

export function parseLegacyValue(
  parsed: unknown,
  source: string,
  options: LegacyJsonOptions = {},
): Envelope[] {
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid legacy JSON in ${source}: expected an array of features.`);
  }

  validateLegacyFeatures(parsed, source);
  const features = parsed;
  const nextId = createIdFactory(options.idPrefix ?? 'legacy');
  const startedAt = Math.floor((options.startedAt ?? new Date()).getTime() / 1000);
  const runId = nextId('run');
  const envelopes: Envelope[] = [];
  const statuses: TestStepResultStatus[] = [];

  const meta: Meta = {
    protocolVersion: '',
    implementation: { name: 'tolkira-legacy-json' },
    runtime: { name: '' },
    os: { name: '' },
    cpu: { name: '' },
  };
  envelopes.push({ meta });
  envelopes.push({ testRunStarted: { id: runId, timestamp: timestamp(startedAt) } });

  let clock = timestamp(startedAt);

  for (const [featureIndex, legacyFeature] of features.entries()) {
    const uri = normalizeUri(
      legacyFeature.uri ?? legacyFeature.location?.replace(/:\d+$/, ''),
      featureIndex,
    );
    const durationScale = isBehaveFeature(legacyFeature) ? 1_000_000_000 : 1;
    const featureTags = mapTags(legacyFeature.tags, nextId);
    const featureChildren: FeatureChild[] = [];
    const scenarioEnvelopes: Envelope[] = [];
    const featureNode: Feature = {
      location: location(legacyFeature.line),
      tags: featureTags,
      language: 'en',
      keyword: 'Feature',
      name: legacyFeature.name ?? `Feature ${featureIndex + 1}`,
      description: normalizeText(legacyFeature.description),
      children: [],
    };

    const backgroundElement = (legacyFeature.elements ?? []).find(
      isBackgroundElement,
    );
    const backgroundSteps = (backgroundElement?.steps ?? []).filter(
      (step) => !isHook(step),
    );
    const backgroundNodes = backgroundSteps.map((step) => mapStep(step, nextId));

    if (backgroundElement) {
      const background: Background = {
        id: nextId('background'),
        location: location(backgroundElement.line),
        keyword: 'Background',
        name: backgroundElement.name ?? 'Background',
        description: normalizeText(backgroundElement.description),
        steps: backgroundNodes,
      };
      markSyntheticBackground(background);
      featureChildren.push({ background });
    }

    const scenarios: LegacyElement[] = (legacyFeature.elements ?? []).filter(
      (element) => !isBackgroundElement(element),
    );

    // Legacy producers repeat inherited feature tags on every element; the
    // scenario AST node keeps only its own tags so rows do not repeat them.
    const featureTagNames = new Set(featureTags.map((tag) => tag.name));

    for (const [scenarioIndex, element] of scenarios.entries()) {
      const scenarioId = nextId('scenario');
      const scenarioTags = mapTags(element.tags, nextId).filter(
        (tag) => !featureTagNames.has(tag.name),
      );
      const scenarioSteps = (element.steps ?? []).filter((step) => !isHook(step));
      const stepNodes = scenarioSteps.map((step) => mapStep(step, nextId));
      const backgroundInline =
        backgroundSteps.length > 0 &&
        backgroundSteps.every((backgroundStep) =>
          scenarioSteps.some(
            (step) =>
              step.name === backgroundStep.name &&
              (step.keyword ?? '').trim() ===
                (backgroundStep.keyword ?? '').trim(),
          ),
        );
      const executableSteps = backgroundInline
        ? scenarioSteps
        : [...backgroundSteps, ...scenarioSteps];
      const executableNodes = backgroundInline
        ? stepNodes
        : [...backgroundNodes, ...stepNodes];

      const scenario: Scenario = {
        id: scenarioId,
        location: location(element.line),
        tags: scenarioTags,
        keyword: (element.keyword ?? 'Scenario').trim() || 'Scenario',
        name: element.name ?? `Scenario ${scenarioIndex + 1}`,
        description: normalizeText(element.description),
        steps: stepNodes,
        examples: [],
      };
      featureChildren.push({ scenario });

      const pickleSteps: PickleStep[] = executableSteps.map(
        (legacyStep, index) => {
          const step = executableNodes[index] as Step;
          const pickleStep: PickleStep = {
            id: nextId('pickle-step'),
            text: step.text,
            astNodeIds: [step.id],
          };
          const argument = mapPickleArgument(legacyStep);
          if (argument) pickleStep.argument = argument;
          return pickleStep;
        },
      );

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
      const inlineHooks = (element.steps ?? []).filter((step) => isHook(step));
      const beforeHooks = [
        ...(element.before ?? []),
        ...inlineHooks.filter(
          (step) => !/^after/i.test((step.keyword ?? '').trim()),
        ),
      ];
      const afterHooks = [
        ...inlineHooks.filter((step) =>
          /^after/i.test((step.keyword ?? '').trim()),
        ),
        ...(element.after ?? []),
      ];

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
        const legacyStep = executableSteps[index] as LegacyStep;
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

        const stepResult = resultOf(plan.legacyStep, durationScale);
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

        for (const embedding of plan.legacyStep.embeddings ?? []) {
          if (!embedding.data) continue;
          const mediaType =
            embedding.media?.type ??
            embedding.mime_type ??
            'application/octet-stream';
          const attachment: Attachment = {
            body: embedding.data,
            contentEncoding: isLikelyBase64(embedding.data)
              ? AttachmentContentEncoding.BASE64
              : AttachmentContentEncoding.IDENTITY,
            mediaType,
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
    // Spread would exceed the argument limit on very large feature files.
    for (const envelope of scenarioEnvelopes) envelopes.push(envelope);
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
