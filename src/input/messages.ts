import { TestStepResultStatus } from '@cucumber/messages';
import type { Envelope } from '@cucumber/messages';

const STATUS_VALUES = new Set(Object.values(TestStepResultStatus));

const ENVELOPE_KEYS = new Set([
  'attachment',
  'externalAttachment',
  'gherkinDocument',
  'hook',
  'meta',
  'parameterType',
  'parseError',
  'pickle',
  'source',
  'stepDefinition',
  'suggestion',
  'testCase',
  'testCaseFinished',
  'testCaseStarted',
  'testRunFinished',
  'testRunHookFinished',
  'testRunHookStarted',
  'testRunStarted',
  'testStepFinished',
  'testStepStarted',
  'undefinedParameterType',
]);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function requireString(
  payload: JsonObject,
  field: string,
  key: string,
  source: string,
  line: number,
): void {
  if (!isString(payload[field])) {
    throw new Error(
      `Invalid Cucumber Messages on line ${line} of ${source}: "${key}.${field}" must be a string.`,
    );
  }
}

function requireObject(
  payload: JsonObject,
  field: string,
  key: string,
  source: string,
  line: number,
): void {
  if (!isObject(payload[field])) {
    throw new Error(
      `Invalid Cucumber Messages on line ${line} of ${source}: "${key}.${field}" must be an object.`,
    );
  }
}

function requireArray(
  payload: JsonObject,
  field: string,
  key: string,
  source: string,
  line: number,
): void {
  if (!isArray(payload[field])) {
    throw new Error(
      `Invalid Cucumber Messages on line ${line} of ${source}: "${key}.${field}" must be an array.`,
    );
  }
}

function requireStepResult(
  payload: JsonObject,
  field: string,
  key: string,
  source: string,
  line: number,
): void {
  requireObject(payload, field, key, source, line);
  const result = payload[field] as JsonObject;
  if (!isString(result.status) || !STATUS_VALUES.has(result.status as TestStepResultStatus)) {
    throw new Error(
      `Invalid Cucumber Messages on line ${line} of ${source}: "${key}.${field}.status" must be a known Cucumber status.`,
    );
  }
  if (!isObject(result.duration)) {
    throw new Error(
      `Invalid Cucumber Messages on line ${line} of ${source}: "${key}.${field}.duration" must be an object.`,
    );
  }
  for (const part of ['seconds', 'nanos']) {
    if (typeof result.duration[part] !== 'number') {
      throw new Error(
        `Invalid Cucumber Messages on line ${line} of ${source}: "${key}.${field}.duration.${part}" must be a number.`,
      );
    }
  }
}

function validatePayload(
  key: string,
  payload: JsonObject,
  source: string,
  line: number,
): void {
  switch (key) {
    case 'meta':
      requireString(payload, 'protocolVersion', key, source, line);
      requireObject(payload, 'implementation', key, source, line);
      requireObject(payload, 'runtime', key, source, line);
      requireObject(payload, 'os', key, source, line);
      requireObject(payload, 'cpu', key, source, line);
      break;
    case 'source':
      requireString(payload, 'uri', key, source, line);
      requireString(payload, 'data', key, source, line);
      requireString(payload, 'mediaType', key, source, line);
      break;
    case 'gherkinDocument':
      requireArray(payload, 'comments', key, source, line);
      break;
    case 'pickle':
      requireString(payload, 'id', key, source, line);
      requireString(payload, 'uri', key, source, line);
      requireString(payload, 'name', key, source, line);
      requireArray(payload, 'steps', key, source, line);
      requireArray(payload, 'tags', key, source, line);
      requireArray(payload, 'astNodeIds', key, source, line);
      break;
    case 'testCase':
      requireString(payload, 'id', key, source, line);
      requireString(payload, 'pickleId', key, source, line);
      requireArray(payload, 'testSteps', key, source, line);
      break;
    case 'testCaseStarted':
      requireString(payload, 'id', key, source, line);
      requireString(payload, 'testCaseId', key, source, line);
      requireObject(payload, 'timestamp', key, source, line);
      break;
    case 'testStepStarted':
      requireString(payload, 'testCaseStartedId', key, source, line);
      requireString(payload, 'testStepId', key, source, line);
      requireObject(payload, 'timestamp', key, source, line);
      break;
    case 'testStepFinished':
      requireString(payload, 'testCaseStartedId', key, source, line);
      requireString(payload, 'testStepId', key, source, line);
      requireStepResult(payload, 'testStepResult', key, source, line);
      requireObject(payload, 'timestamp', key, source, line);
      break;
    case 'testCaseFinished':
      requireString(payload, 'testCaseStartedId', key, source, line);
      requireObject(payload, 'timestamp', key, source, line);
      break;
    case 'testRunStarted':
      requireObject(payload, 'timestamp', key, source, line);
      break;
    case 'testRunFinished':
      requireObject(payload, 'timestamp', key, source, line);
      if (typeof payload.success !== 'boolean') {
        throw new Error(
          `Invalid Cucumber Messages on line ${line} of ${source}: "testRunFinished.success" must be a boolean.`,
        );
      }
      break;
    case 'attachment':
      if (!isString(payload.body) && !isString(payload.url)) {
        throw new Error(
          `Invalid Cucumber Messages on line ${line} of ${source}: "attachment.body" or "attachment.url" is required.`,
        );
      }
      requireString(payload, 'mediaType', key, source, line);
      break;
    case 'externalAttachment':
      requireString(payload, 'url', key, source, line);
      requireString(payload, 'mediaType', key, source, line);
      break;
    case 'hook':
      requireString(payload, 'id', key, source, line);
      requireObject(payload, 'sourceReference', key, source, line);
      break;
    case 'testRunHookStarted':
      requireString(payload, 'id', key, source, line);
      requireString(payload, 'testRunStartedId', key, source, line);
      requireString(payload, 'hookId', key, source, line);
      requireObject(payload, 'timestamp', key, source, line);
      break;
    case 'testRunHookFinished':
      requireString(payload, 'testRunHookStartedId', key, source, line);
      requireStepResult(payload, 'result', key, source, line);
      requireObject(payload, 'timestamp', key, source, line);
      break;
    case 'parseError':
      requireString(payload, 'message', key, source, line);
      requireObject(payload, 'source', key, source, line);
      break;
    default:
      // Remaining known envelopes are passed to the renderer; their shape is
      // validated by the schema version that produced them.
      break;
  }
}

export function isEnvelopeLike(value: unknown): value is Envelope {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && ENVELOPE_KEYS.has(keys[0] ?? '');
}

export function parseMessages(content: string, source: string): Envelope[] {
  const lines = content
    .split(/\r?\n/)
    .map((line, index) => ({
      text: line.replace(/^\uFEFF/, '').trim(),
      number: index + 1,
    }))
    .filter((line) => line.text.length > 0);

  if (lines.length === 0) {
    throw new Error(`Input is empty: ${source}`);
  }

  return lines.map(({ text, number }) => {
    try {
      const value: unknown = JSON.parse(text);
      if (!isEnvelopeLike(value)) {
        throw new Error(
          'expected a Cucumber Messages envelope with exactly one known key',
        );
      }

      const key = Object.keys(value)[0] as string;
      const payload = (value as JsonObject)[key];
      if (!isObject(payload)) {
        throw new Error(`"${key}" must be an object`);
      }
      validatePayload(key, payload, source, number);
      return value;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const clean = detail.replace(
        /^Invalid Cucumber Messages on line \d+ of .*?: /,
        '',
      );
      throw new Error(
        `Invalid Cucumber Messages on line ${number} of ${source}: ${clean}`,
      );
    }
  });
}
