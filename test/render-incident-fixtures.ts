import { readFile } from 'node:fs/promises';
import { TestStepResultStatus, type Envelope } from '@cucumber/messages';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { messagesFixture } from './fixtures.js';

/**
 * Composable incident fixtures. Legacy JSON carries the statuses, steps,
 * scenario hooks, doc strings, tables, tags and attachments the incident
 * contract needs; the Messages fixtures below carry outlines, rules and retry
 * evidence that legacy JSON cannot express.
 */

export type IncidentStatus =
  | 'passed'
  | 'failed'
  | 'pending'
  | 'undefined'
  | 'ambiguous'
  | 'skipped'
  | 'unknown';

interface IncidentAttachment {
  fileName?: string;
  mediaType: string;
  /** Plain text, or base64 for images and video; the parser detects base64. */
  body: string;
}

export interface IncidentStep {
  text: string;
  keyword?: string;
  status?: IncidentStatus;
  durationMs?: number;
  /** Two lines keep the summary at the first line; the detail keeps both. */
  message?: string;
  docString?: string;
  table?: string[][];
  attachments?: IncidentAttachment[];
}

interface IncidentHook {
  /** `Before` or `After`; legacy hooks are hidden step entries. */
  at: 'before' | 'after';
  status?: IncidentStatus;
  durationMs?: number;
  message?: string;
  attachments?: IncidentAttachment[];
}

export interface IncidentScenario {
  name: string;
  /** Shorthand for a one-step scenario when `steps` is absent. */
  status?: IncidentStatus;
  message?: string;
  tags?: string[];
  description?: string;
  line?: number;
  steps?: IncidentStep[];
  before?: IncidentHook[];
  after?: IncidentHook[];
  /** Extra (scenario-level) attachments, rendered after the steps. */
  attachments?: IncidentAttachment[];
}

interface IncidentFeature {
  name: string;
  uri?: string;
  tags?: string[];
  description?: string;
  scenarios: IncidentScenario[];
}

export interface IncidentRunSpec {
  features: IncidentFeature[];
  startedAt?: Date;
}

/** A 1x1 PNG, enough to exercise the safe image path without a file. */
export const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** A tiny WebM header; the renderer keys on the media type, not the bytes. */
export const WEBM_STUB = 'GkXfowEAAAAAAAAAAA==';

export const LOG_BODY = 'server booted\nGET /checkout -> 500';

export function step(
  text: string,
  overrides: Partial<IncidentStep> = {},
): IncidentStep {
  return { text, ...overrides };
}

/** `count` passed steps, with the last one overridable (for the 7/8 boundary). */
export function stepRun(
  count: number,
  prefix = 'step',
  last: Partial<IncidentStep> = {},
): IncidentStep[] {
  return Array.from({ length: count }, (_, index) =>
    step(`${prefix} ${index + 1}`, index === count - 1 ? last : {}),
  );
}

function legacyAttachment(attachment: IncidentAttachment) {
  return {
    data: attachment.body,
    media: { type: attachment.mediaType },
    fileName: attachment.fileName ?? 'attachment.txt',
  };
}

function legacyStep(spec: IncidentStep) {
  const durationMs = spec.durationMs ?? 1;
  return {
    keyword: `${spec.keyword ?? 'Given'} `,
    name: spec.text,
    result: {
      status: spec.status ?? 'passed',
      duration: durationMs * 1_000_000,
      ...(spec.message ? { error_message: spec.message } : {}),
    },
    ...(spec.docString === undefined ? {} : { docString: spec.docString }),
    ...(spec.table === undefined ? {} : { rows: spec.table.map(toRow) }),
    ...(spec.attachments?.length
      ? { embeddings: spec.attachments.map(legacyAttachment) }
      : {}),
  };
}

function toRow(cells: string[]) {
  return { cells };
}

function legacyHook(spec: IncidentHook) {
  const durationMs = spec.durationMs ?? 1;
  return {
    keyword: `${spec.at === 'before' ? 'Before' : 'After'} `,
    name: '',
    result: {
      status: spec.status ?? 'passed',
      duration: durationMs * 1_000_000,
      ...(spec.message ? { error_message: spec.message } : {}),
    },
    ...(spec.attachments?.length
      ? { embeddings: spec.attachments.map(legacyAttachment) }
      : {}),
  };
}

/** The legacy JSON document for a composed run. */
export function incidentJson(spec: IncidentRunSpec): string {
  return JSON.stringify(
    spec.features.map((feature) => ({
      uri: feature.uri ?? 'features/incident.feature',
      name: feature.name,
      ...(feature.description === undefined
        ? {}
        : { description: feature.description }),
      ...(feature.tags === undefined ? {} : { tags: feature.tags }),
      elements: feature.scenarios.map((scenario, index) => {
        const steps = scenario.steps ?? [
          step('a step', {
            status: scenario.status ?? 'passed',
            ...(scenario.message === undefined
              ? {}
              : { message: scenario.message }),
          }),
        ];
        // Legacy elements have no scenario-level attachment field, so the
        // extras ride on an explicit trailing step.
        const allSteps = scenario.attachments?.length
          ? [
              ...steps,
              step('extra evidence', { attachments: scenario.attachments }),
            ]
          : steps;
        return {
          keyword: 'Scenario',
          type: 'scenario',
          name: scenario.name,
          line: scenario.line ?? 3 + index * 10,
          ...(scenario.description === undefined
            ? {}
            : { description: scenario.description }),
          ...(scenario.tags === undefined ? {} : { tags: scenario.tags }),
          ...(scenario.before === undefined
            ? {}
            : { before: scenario.before.map(legacyHook) }),
          ...(scenario.after === undefined
            ? {}
            : { after: scenario.after.map(legacyHook) }),
          steps: allSteps.map((entry) => legacyStep(entry)),
        };
      }),
    })),
  );
}

export function incidentEnvelopes(
  spec: IncidentRunSpec,
  options: { idPrefix?: string } = {},
): Envelope[] {
  return parseLegacyJson(incidentJson(spec), 'incident.json', {
    idPrefix: options.idPrefix ?? 'incident',
    ...(spec.startedAt === undefined ? {} : { startedAt: spec.startedAt }),
  });
}

/** One failed scenario with a two-line error and a named tag. */
export function failedIncident(
  overrides: Partial<IncidentScenario> = {},
): IncidentRunSpec {
  return {
    features: [
      {
        name: 'Checkout',
        uri: 'features/checkout.feature',
        tags: ['@shop'],
        scenarios: [
          {
            name: 'pays an invoice',
            status: 'failed',
            message: 'Expected 200 but got 500\n  at checkout.ts:42',
            tags: ['@billing'],
            ...overrides,
          },
        ],
      },
    ],
  };
}

export async function fixtureEnvelopes(name: string): Promise<Envelope[]> {
  const file = messagesFixture(name);
  return parseMessages(await readFile(file, 'utf8'), file);
}

function lastMatch<T>(
  items: T[],
  matches: (item: T) => boolean,
): T | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && matches(item)) return item;
  }
  return undefined;
}

/** The rule-nested outline fixture; its first two rows fail. */
export function rulesOutlineEnvelopes(): Promise<Envelope[]> {
  return fixtureEnvelopes('rules-outline-background.ndjson');
}

/** Retry evidence whose final attempt fails, so the panel carries it. */
export async function retryIncidentEnvelopes(): Promise<Envelope[]> {
  const envelopes = await fixtureEnvelopes('retry-evidence.ndjson');
  const finalStart = lastMatch(
    envelopes,
    (envelope) => envelope.testCaseFinished?.willBeRetried === false,
  )?.testCaseFinished?.testCaseStartedId;
  if (!finalStart) throw new Error('retry fixture has no final attempt');
  const finalResult = envelopes.find(
    (envelope) => envelope.testStepFinished?.testCaseStartedId === finalStart,
  )?.testStepFinished;
  if (!finalResult) throw new Error('retry fixture has no final result');
  finalResult.testStepResult.status = TestStepResultStatus.FAILED;
  finalResult.testStepResult.message = 'Error: upload failed';
  const finished = envelopes.find(
    (envelope) => envelope.testRunFinished,
  )?.testRunFinished;
  if (finished) finished.success = false;
  return envelopes;
}

/** A run-level AfterAll failure with every scenario passed. */
export async function runHookFailureEnvelopes(): Promise<Envelope[]> {
  const envelopes = await fixtureEnvelopes('global-hooks.ndjson');
  for (const envelope of envelopes) {
    if (!envelope.testStepFinished) continue;
    envelope.testStepFinished.testStepResult.status =
      TestStepResultStatus.PASSED;
    delete envelope.testStepFinished.testStepResult.message;
    delete envelope.testStepFinished.testStepResult.exception;
  }
  const hookFinish = lastMatch(envelopes, (envelope) =>
    Boolean(envelope.testRunHookFinished),
  )?.testRunHookFinished;
  if (!hookFinish) throw new Error('global fixture has no run hook');
  hookFinish.result.status = TestStepResultStatus.FAILED;
  hookFinish.result.message = 'AfterAll could not close the browser';
  hookFinish.result.exception = {
    type: 'Error',
    message: 'AfterAll could not close the browser',
  };
  const finished = envelopes.find(
    (envelope) => envelope.testRunFinished,
  )?.testRunFinished;
  if (finished) finished.success = false;
  return envelopes;
}
