import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import { summarizeReport, type ReportSummary } from '../src/index.js';

const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const messages = fileURLToPath(
  new URL('./fixtures/messages/second.ndjson', import.meta.url),
);
const junit = fileURLToPath(
  new URL('./fixtures/junit/basic.xml', import.meta.url),
);

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-cli-edge-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

async function cli(argv: string[]) {
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

function parseSummary(stdout: string): ReportSummary {
  return JSON.parse(stdout) as ReportSummary;
}

async function writeLegacy(
  dir: string,
  name: string,
  features: unknown[],
): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, JSON.stringify(features), 'utf8');
  return file;
}

function minimalMessages(testStepFinished: string): string {
  return [
    '{"meta":{"protocolVersion":"27.0.2","implementation":{},"runtime":{},"os":{},"cpu":{}}}',
    '{"pickle":{"id":"p","uri":"features/x.feature","astNodeIds":[],"tags":[],"name":"duration","language":"en","steps":[{"id":"ps","text":"x","astNodeIds":[]}]}}',
    '{"testCase":{"id":"tc","pickleId":"p","testSteps":[{"id":"ts","pickleStepId":"ps"}]}}',
    '{"testCaseStarted":{"id":"tcs","testCaseId":"tc","attempt":0,"timestamp":{"seconds":1,"nanos":0}}}',
    testStepFinished,
    '{"testCaseFinished":{"testCaseStartedId":"tcs","timestamp":{"seconds":1,"nanos":0}}}',
  ].join('\n');
}

describe('CLI input edge cases', () => {
  it('requires at least one input', async () => {
    const none = await cli([]);
    expect(none.code).toBe(2);
    expect(none.stderr).toContain('Usage: tolkira');

    expect((await cli(['--json'])).code).toBe(2);
    await expect(summarizeReport([])).rejects.toThrow('No input files provided.');
  });

  it('rejects an empty directory and a directory with only unsupported files', async () => {
    const empty = await tempDir();
    const emptyRun = await cli([empty, '--json']);
    expect(emptyRun.code).toBe(1);
    expect(emptyRun.stderr).toContain('No supported report files found.');

    const unsupported = await tempDir();
    await writeFile(path.join(unsupported, 'notes.txt'), 'notes', 'utf8');
    await writeFile(
      path.join(unsupported, 'package.json'),
      '{"name":"not-a-report"}',
      'utf8',
    );
    const unsupportedRun = await cli([unsupported, '--json']);
    expect(unsupportedRun.code).toBe(1);
    expect(unsupportedRun.stderr).toContain('No supported report files found.');
  });

  it('names the file for malformed legacy, Messages and JUnit input', async () => {
    const dir = await tempDir();
    const cases = [
      {
        name: 'broken-legacy.json',
        content: '[{"name":"Broken","elements":[',
        marker: 'Invalid legacy JSON in',
      },
      {
        name: 'broken-messages.ndjson',
        content:
          '{"meta":{"protocolVersion":"27.0.2","implementation":{},"runtime":{},"os":{},"cpu":{}}}\n{"pickle":',
        marker: 'Invalid Cucumber Messages on line 2 of',
      },
      {
        name: 'broken-junit.xml',
        content: '<testsuites><testsuite>',
        marker: 'Invalid JUnit XML in',
      },
    ];

    for (const testCase of cases) {
      const file = path.join(dir, testCase.name);
      await writeFile(file, testCase.content, 'utf8');
      const run = await cli([file, '--json']);

      expect(run.code, testCase.name).toBe(1);
      expect(run.stdout, testCase.name).toBe('');
      expect(run.stderr, testCase.name).toContain(testCase.marker);
      expect(run.stderr, testCase.name).toContain(testCase.name);
    }
  });

  it('accepts an empty legacy array but rejects empty Messages files', async () => {
    const dir = await tempDir();
    const emptyLegacy = await writeLegacy(dir, 'empty-legacy.json', []);
    const emptyLegacyRun = await cli([emptyLegacy, '--json']);

    expect(emptyLegacyRun.code).toBe(0);
    const summary = parseSummary(emptyLegacyRun.stdout);
    expect(summary.status).toBe('unknown');
    expect(summary.counts.scenarios.total).toBe(0);
    expect(summary.scenarios).toEqual([]);

    const emptyMessages = path.join(dir, 'empty-messages.ndjson');
    await writeFile(emptyMessages, '', 'utf8');
    const emptyRun = await cli([emptyMessages, '--json']);
    expect(emptyRun.code).toBe(1);
    expect(emptyRun.stdout).toBe('');
    expect(emptyRun.stderr).toContain('Input is empty');
    expect(emptyRun.stderr).toContain('empty-messages.ndjson');

    const whitespaceMessages = path.join(dir, 'whitespace-messages.ndjson');
    await writeFile(whitespaceMessages, '  \r\n\t\n', 'utf8');
    const whitespaceRun = await cli([whitespaceMessages, '--json']);
    expect(whitespaceRun.code).toBe(1);
    expect(whitespaceRun.stderr).toContain('whitespace-messages.ndjson');

    const whitespaceDir = await tempDir();
    await writeFile(
      path.join(whitespaceDir, 'whitespace-in-dir.ndjson'),
      ' \n\t\n',
      'utf8',
    );
    const inDirRun = await cli([whitespaceDir, '--json']);
    expect(inDirRun.code).toBe(1);
    expect(inDirRun.stderr).toContain('Input is empty');
    expect(inDirRun.stderr).toContain('whitespace-in-dir.ndjson');
  });

  it('deduplicates a repeated file and a directory plus the same file', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'results.ndjson');
    await copyFile(messages, file);

    const once = await cli([file, '--json']);
    const twice = await cli([file, file, '--json']);
    const dirAndFile = await cli([dir, file, '--json']);

    expect(once.code).toBe(0);
    expect(twice.code).toBe(0);
    expect(dirAndFile.code).toBe(0);

    const baseline = parseSummary(once.stdout);
    expect(baseline.counts.scenarios.total).toBe(2);
    expect(parseSummary(twice.stdout)).toEqual(baseline);
    expect(parseSummary(dirAndFile.stdout)).toEqual(baseline);
  });

  it('merges legacy, Messages and JUnit input in one run', async () => {
    const run = await cli([legacy, messages, junit, '--json']);

    expect(run.code).toBe(0);
    const summary = parseSummary(run.stdout);
    expect(summary.status).toBe('failed');
    expect(summary.counts.features).toBe(4);
    expect(summary.counts.scenarios).toMatchObject({
      total: 12,
      passed: 9,
      failed: 2,
      skipped: 1,
    });
    expect(summary.scenarios.map((scenario) => scenario.feature)).toEqual(
      expect.arrayContaining([
        'Happy HTML reporting',
        'Second feature',
        'checkout',
        'profile',
      ]),
    );
  });

  it('keeps unicode and long names and falls back only when names are missing', async () => {
    const dir = await tempDir();
    const featureName = `Zahlung prüfen – 日本語 🚀 ${'x'.repeat(10_000)}`;
    const file = await writeLegacy(dir, 'weird-names.json', [
      {
        uri: 'features/weird.feature',
        name: featureName,
        elements: [
          {
            keyword: 'Scenario',
            type: 'scenario',
            name: '',
            steps: [{ keyword: 'Given', name: 'a step without a result' }],
          },
          {
            keyword: 'Scenario',
            type: 'scenario',
            steps: [
              {
                keyword: 'Given',
                name: 'an unnamed scenario',
                result: { status: 'passed' },
              },
            ],
          },
        ],
      },
    ]);

    const summary = parseSummary((await cli([file, '--json'])).stdout);
    expect(summary.scenarios[0]?.feature).toBe(featureName);
    expect(summary.scenarios.map((scenario) => scenario.name)).toEqual([
      '',
      'Scenario 2',
    ]);
    expect(summary.scenarios[0]?.status).toBe('unknown');
    expect(summary.scenarios[0]?.durationMs).toBe(0);
    expect(summary.scenarios[1]?.steps[0]?.durationMs).toBe(0);
  });

  it('rejects unknown statuses in legacy and Messages input', async () => {
    const dir = await tempDir();
    const legacyFile = await writeLegacy(dir, 'broken-status.json', [
      {
        name: 'Invalid status',
        elements: [
          {
            keyword: 'Scenario',
            type: 'scenario',
            name: 'explodes',
            steps: [
              {
                keyword: 'Given',
                name: 'x',
                result: { status: 'exploded' },
              },
            ],
          },
        ],
      },
    ]);
    const legacyRun = await cli([legacyFile, '--json']);
    expect(legacyRun.code).toBe(1);
    expect(legacyRun.stderr).toContain('Invalid legacy JSON in');
    expect(legacyRun.stderr).toContain('broken-status.json');
    expect(legacyRun.stderr).toContain('known status');

    const messagesFile = path.join(dir, 'broken-status.ndjson');
    await writeFile(
      messagesFile,
      '{"testStepFinished":{"testCaseStartedId":"a","testStepId":"b","testStepResult":{"status":"EXPLODED","duration":{"seconds":0,"nanos":0}},"timestamp":{"seconds":1,"nanos":0}}}\n',
      'utf8',
    );
    const messagesRun = await cli([messagesFile, '--json']);
    expect(messagesRun.code).toBe(1);
    expect(messagesRun.stderr).toContain('Invalid Cucumber Messages on line 1 of');
    expect(messagesRun.stderr).toContain('broken-status.ndjson');
    expect(messagesRun.stderr).toContain('known Cucumber status');
  });

  it('defaults missing and negative legacy durations to zero, rejects missing Messages durations', async () => {
    const dir = await tempDir();
    const durations = await writeLegacy(dir, 'durations.json', [
      {
        name: 'Durations',
        elements: [
          {
            keyword: 'Scenario',
            type: 'scenario',
            name: 'missing',
            steps: [{ keyword: 'Given', name: 'x', result: { status: 'passed' } }],
          },
          {
            keyword: 'Scenario',
            type: 'scenario',
            name: 'negative',
            steps: [
              {
                keyword: 'Given',
                name: 'x',
                result: { status: 'passed', duration: -500 },
              },
            ],
          },
          {
            keyword: 'Scenario',
            type: 'scenario',
            name: 'enormous',
            steps: [
              {
                keyword: 'Given',
                name: 'x',
                result: { status: 'passed', duration: 1e18 },
              },
            ],
          },
        ],
      },
    ]);

    const summary = parseSummary((await cli([durations, '--json'])).stdout);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );
    expect(byName.get('missing')?.durationMs).toBe(0);
    expect(byName.get('negative')?.durationMs).toBe(0);
    expect(byName.get('enormous')?.durationMs).toBe(1e12);
    expect(summary.durationMs).toBe(1e12);
    expect(Number.isFinite(summary.durationMs)).toBe(true);

    const missingDuration = path.join(dir, 'missing-duration.ndjson');
    await writeFile(
      missingDuration,
      minimalMessages(
        '{"testStepFinished":{"testCaseStartedId":"tcs","testStepId":"ts","testStepResult":{"status":"PASSED"},"timestamp":{"seconds":1,"nanos":0}}}',
      ),
      'utf8',
    );
    const missingRun = await cli([missingDuration, '--json']);
    expect(missingRun.code).toBe(1);
    expect(missingRun.stderr).toContain('missing-duration.ndjson');
    expect(missingRun.stderr).toContain('testStepResult.duration');
    expect(missingRun.stderr).toContain('must be an object');
  });

  it('sanitizes non-finite and negative Messages durations', async () => {
    const dir = await tempDir();
    const huge = path.join(dir, 'huge-duration.ndjson');
    const negative = path.join(dir, 'negative-duration.ndjson');
    await writeFile(
      huge,
      minimalMessages(
        '{"testStepFinished":{"testCaseStartedId":"tcs","testStepId":"ts","testStepResult":{"status":"PASSED","duration":{"seconds":1e308,"nanos":0}},"timestamp":{"seconds":1,"nanos":0}}}',
      ),
      'utf8',
    );
    await writeFile(
      negative,
      minimalMessages(
        '{"testStepFinished":{"testCaseStartedId":"tcs","testStepId":"ts","testStepResult":{"status":"PASSED","duration":{"seconds":-5,"nanos":0}},"timestamp":{"seconds":1,"nanos":0}}}',
      ),
      'utf8',
    );

    for (const file of [huge, negative]) {
      const run = await cli([file, '--json']);
      expect(run.code, file).toBe(0);
      const summary = parseSummary(run.stdout);
      expect(summary.durationMs, file).toBe(0);
      expect(summary.scenarios[0]?.durationMs, file).toBe(0);
      expect(summary.scenarios[0]?.steps[0]?.durationMs, file).toBe(0);
    }
  });

  it('writes reports from and to paths with spaces and parentheses', async () => {
    const dir = await tempDir('tolkira edge (cli) ');
    const input = path.join(dir, 'my report (raw).ndjson');
    await copyFile(messages, input);
    const output = path.join(dir, 'report (final).html');

    const run = await cli([input, '--out', output]);

    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout).toContain('Report written to');
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<html');
    expect(html).toContain('Second scenario');
  });

  it('creates missing output parents but fails cleanly on an existing directory target', async () => {
    const dir = await tempDir();
    const nested = path.join(dir, 'nested', 'deep', 'report.html');
    expect((await cli([legacy, '--out', nested])).code).toBe(0);
    await expect(readFile(nested, 'utf8')).resolves.toContain('<html');

    const target = path.join(dir, 'outdir');
    await mkdir(target);
    const failed = await cli([legacy, '--out', target]);

    expect(failed.code).toBe(1);
    expect(failed.stderr).toContain('tolkira:');
    expect((await readdir(dir)).sort()).toEqual(['nested', 'outdir']);
  });

  it('refuses to overwrite an input file', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'same.json');
    await copyFile(legacy, input);
    const before = await readFile(input, 'utf8');

    const run = await cli([input, '--out', input]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('must not overwrite');
    await expect(readFile(input, 'utf8')).resolves.toBe(before);
  });

  it('refuses to overwrite the logo file', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'same.png');
    await writeFile(file, 'logo bytes', 'utf8');

    const run = await cli([legacy, '--out', file, '--logo', file]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('must not overwrite');
    await expect(readFile(file, 'utf8')).resolves.toBe('logo bytes');
  });

  it('allows rerunning a report into an input directory', async () => {
    const dir = await tempDir();
    await copyFile(legacy, path.join(dir, 'input.json'));
    const output = path.join(dir, 'report.html');

    expect((await cli([dir, '--out', output])).code).toBe(0);
    expect((await cli([dir, '--out', output])).code).toBe(0);
  });

  it('rejects empty --out and --logo values', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');

    const emptyOut = await cli([legacy, '--out=', '--json']);
    expect(emptyOut.code).toBe(2);
    expect(emptyOut.stderr).toContain('--out requires a file path');

    const emptyLogo = await cli([legacy, '--out', output, '--logo=']);
    expect(emptyLogo.code).toBe(2);
    expect(emptyLogo.stderr).toContain('--logo requires a file path');
  });

  it('rejects invalid logo files and accent values as usage errors', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const missingLogo = path.join(dir, 'missing.png');
    const textLogo = path.join(dir, 'logo.txt');
    const badPng = path.join(dir, 'logo.png');
    await writeFile(textLogo, 'not an image', 'utf8');
    await writeFile(badPng, 'not a png', 'utf8');

    const withoutOut = await cli([legacy, '--json', '--logo', missingLogo]);
    expect(withoutOut.code).toBe(2);
    expect(withoutOut.stderr).toContain('--logo requires --out');

    for (const logo of [missingLogo, textLogo, badPng]) {
      const run = await cli([legacy, '--out', output, '--logo', logo]);
      expect(run.code, logo).toBe(2);
      expect(run.stderr, logo).toContain('Usage: tolkira');
    }

    const accent = await cli([legacy, '--out', output, '--accent', 'red']);
    expect(accent.code).toBe(2);
    expect(accent.stderr).toContain('Invalid --accent');
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('prints one JSON summary and exits 0 for a failing run, with or without --out', async () => {
    const onlyJson = await cli([messages, '--json']);
    expect(onlyJson.code).toBe(0);
    expect(onlyJson.stderr).toBe('');
    expect(onlyJson.stdout.startsWith('{')).toBe(true);
    expect(parseSummary(onlyJson.stdout).status).toBe('failed');

    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const withHtml = await cli([messages, '--out', output, '--json']);
    expect(withHtml.code).toBe(0);
    expect(withHtml.stderr).toBe('');
    expect(parseSummary(withHtml.stdout).status).toBe('failed');
    await expect(readFile(output, 'utf8')).resolves.toContain('<html');
  });

  it(
    'summarizes 1000 synthetic scenarios',
    async () => {
      const dir = await tempDir();
      const elements = Array.from({ length: 1000 }, (_, index) => ({
        keyword: 'Scenario',
        type: 'scenario',
        name: `Scenario ${String(index).padStart(4, '0')}`,
        steps: [
          {
            keyword: 'Given ',
            name: 'a step',
            result: { status: 'passed', duration: 1 },
          },
        ],
      }));
      const file = await writeLegacy(dir, 'big.json', [
        { uri: 'features/big.feature', name: 'Big', elements },
      ]);

      const run = await cli([file, '--json']);
      expect(run.code).toBe(0);
      const summary = parseSummary(run.stdout);
      expect(summary.counts.scenarios.total).toBe(1000);
      expect(summary.counts.steps.total).toBe(1000);
      expect(summary.status).toBe('passed');
      expect(summary.scenarios[0]?.name).toBe('Scenario 0000');
      expect(summary.scenarios.at(-1)?.name).toBe('Scenario 0999');
    },
    20_000,
  );
});
