import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import { renderReport, summarizeReport } from '../src/index.js';
import { loadEnvelopes } from '../src/input/load.js';
import { buildReportModel } from '../src/report/model.js';

const fixtures = [
  {
    name: 'cucumber-jvm 7.22.1',
    feature: 'Old cucumber-jvm compatibility',
    path: './fixtures/messages/cucumber-jvm-7.22.1.ndjson',
  },
  {
    name: 'cucumber-ruby 12.0.1',
    feature: 'Old cucumber-ruby compatibility',
    path: './fixtures/messages/cucumber-ruby-12.0.1.ndjson',
  },
];

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function attemptLine(attempt: string): string {
  return [
    '{"meta":{"protocolVersion":"27.0.2","implementation":{},"runtime":{},"os":{},"cpu":{}}}',
    '{"pickle":{"id":"p","uri":"features/attempt.feature","language":"en","astNodeIds":["s"],"tags":[],"name":"attempt scenario","steps":[{"id":"ps","text":"a step","astNodeIds":[]}]}}',
    '{"testCase":{"id":"tc","pickleId":"p","testSteps":[{"id":"ts","pickleStepId":"ps"}]}}',
    `{"testCaseStarted":{"id":"tcs","testCaseId":"tc",${attempt}"timestamp":{"seconds":1,"nanos":0}}}`,
    '{"testStepFinished":{"testCaseStartedId":"tcs","testStepId":"ts","testStepResult":{"status":"PASSED","duration":{"seconds":0,"nanos":1}},"timestamp":{"seconds":1,"nanos":1}}}',
    '{"testCaseFinished":{"testCaseStartedId":"tcs","timestamp":{"seconds":1,"nanos":2}}}',
  ].join('\n');
}

async function attemptFile(attempt: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-attempt-'));
  tempDirs.push(dir);
  const file = path.join(dir, 'attempt.ndjson');
  await writeFile(file, attemptLine(attempt), 'utf8');
  return file;
}

describe('Messages attempt validation', () => {
  it.each([
    ['non-finite', '"attempt":1e309,'],
    ['string', '"attempt":"2",'],
    ['negative', '"attempt":-1,'],
    ['fractional', '"attempt":1.5,'],
    ['above the safe integer range', `"attempt":${MAX_SAFE + 1},`],
  ])('rejects a %s attempt with the line error', async (_, attempt) => {
    const file = await attemptFile(attempt);

    await expect(summarizeReport(file)).rejects.toThrow(
      'Invalid Cucumber Messages on line 4 of',
    );
    await expect(summarizeReport(file)).rejects.toThrow(
      'testCaseStarted.attempt',
    );
    await expect(summarizeReport(file)).rejects.toThrow(
      'must be a non-negative safe integer',
    );
    await expect(summarizeReport(file)).rejects.toThrow(path.basename(file));
  });

  it.each([
    ['absent', '', 0],
    ['the maximum safe integer', `"attempt":${MAX_SAFE},`, MAX_SAFE],
    ['2', '"attempt":2,', 2],
  ])(
    'uses %s in the model and summary without a null',
    async (_, attempt, expected) => {
      const file = await attemptFile(attempt);
      const summary = await summarizeReport(file);
      const model = buildReportModel(await loadEnvelopes(file));

      expect(summary.scenarios[0]?.attempt).toBe(expected);
      expect(model.scenarios[0]?.attempt).toBe(expected);
      expect(JSON.stringify(summary)).not.toContain('"attempt": null');

      let stdout = '';
      const code = await runCli([file, '--json'], {
        stdout: (text) => {
          stdout += text;
        },
        stderr: () => undefined,
      });
      expect(code).toBe(0);
      expect(JSON.parse(stdout).scenarios[0].attempt).toBe(expected);
      expect(stdout).not.toContain('"attempt": null');
    },
  );
});

describe('Messages producers', () => {
  for (const fixture of fixtures) {
    it(`parses ${fixture.name} Messages`, async () => {
      const file = fileURLToPath(new URL(fixture.path, import.meta.url));
      const summary = await summarizeReport(file);

      expect(summary.counts.scenarios).toMatchObject({
        total: 2,
        passed: 1,
        failed: 1,
      });
      const failed = summary.scenarios.find(
        (scenario) => scenario.status === 'failed',
      );
      expect(failed?.name).toBe('fails');
      expect(failed?.steps[0]?.message).toContain('boom');
      expect(failed?.durationMs).toBeGreaterThan(0);

      const html = await renderReport(file, { title: fixture.name });
      expect(html).toContain(fixture.feature);
    });
  }
});
