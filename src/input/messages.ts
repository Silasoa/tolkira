import type { Envelope } from '@cucumber/messages';

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

export function parseMessages(content: string, source: string): Envelope[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, '').trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error(`Input is empty: ${source}`);
  }

  return lines.map((line, index) => {
    try {
      const value: unknown = JSON.parse(line);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('expected a JSON object');
      }

      const keys = Object.keys(value);
      if (keys.length !== 1 || !ENVELOPE_KEYS.has(keys[0] ?? '')) {
        throw new Error('expected a Cucumber Messages envelope with exactly one known key');
      }

      return value as Envelope;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid Cucumber Messages on line ${index + 1} of ${source}: ${detail}`);
    }
  });
}
