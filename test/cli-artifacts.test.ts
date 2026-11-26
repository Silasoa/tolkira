import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The CLI tests never launch a browser: the PDF module is replaced here.
const pdf = vi.hoisted(() => ({
  renderPdf:
    vi.fn<
      (html: string, options?: { timeoutMs?: number }) => Promise<Uint8Array>
    >(),
}));
vi.mock('../src/pdf.js', () => ({ renderPdf: pdf.renderPdf }));

import { buildRunManifest } from '../src/artifacts.js';
import { runCli } from '../src/cli.js';
import { summarizeReport, version } from '../src/index.js';
import type { ReportSummary } from '../src/summary.js';
import { writeAttachmentReport } from './attachments.js';
import { fixturePath } from './fixtures.js';

interface ManifestArtifact {
  kind: string;
  path: string;
}

interface ManifestFailure {
  feature: string;
  name: string;
  uri: string;
  example?: string;
}

interface ManifestDocument {
  schemaVersion: number;
  tool: { name: string; version: string };
  status: string;
  counts: ReportSummary['counts'];
  attachments: ReportSummary['attachments'];
  warnings: { skippedAttachments: number };
  artifacts: ManifestArtifact[];
  failures: ManifestFailure[];
}

const screenshot = fixturePath('messages', 'screenshot.ndjson');
const examples = fixturePath('messages', 'examples-tables.ndjson');
const historyFixture = fixturePath('history', 'two-runs.json');

// A 1x1 transparent PNG: the smallest logo that passes the data-URI check.
const LOGO =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Deliberately not valid UTF-8: the PDF must be written byte for byte.
const PDF_BYTES = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xff, 0xfe, 0x00,
  0x01, 0x80, 0x7f,
]);

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

beforeEach(() => {
  pdf.renderPdf.mockReset().mockResolvedValue(Buffer.from(PDF_BYTES));
});

async function tempDir(prefix = 'tolkira-cli-artifacts-'): Promise<string> {
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

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

async function readManifest(file: string): Promise<ManifestDocument> {
  return JSON.parse(await readFile(file, 'utf8')) as ManifestDocument;
}

function relativeTo(directory: string, file: string): string {
  return path.relative(directory, file).split(path.sep).join('/');
}

function expectedFailures(summary: ReportSummary): ManifestFailure[] {
  return summary.scenarios
    .filter((scenario) => scenario.executed && scenario.status === 'failed')
    .slice(0, 10)
    .map((scenario) => ({
      feature: scenario.feature,
      name: scenario.name,
      ...(scenario.example === undefined ? {} : { example: scenario.example }),
      uri: scenario.uri,
    }));
}

function manyFailures(count: number): unknown[] {
  return [
    {
      uri: 'features/many.feature',
      name: 'Many failures',
      keyword: 'Feature',
      elements: Array.from({ length: count }, (_, index) => ({
        keyword: 'Scenario',
        type: 'scenario',
        name: `Failure ${String(index + 1).padStart(2, '0')}`,
        steps: [
          {
            keyword: 'Given ',
            name: 'a step',
            result: { status: 'failed', duration: 1 },
          },
        ],
      })),
    },
  ];
}

async function runManyFailures(count: number): Promise<{
  summary: ReportSummary;
  manifest: ManifestDocument;
}> {
  const dir = await tempDir();
  const input = path.join(dir, 'many.json');
  await writeFile(input, JSON.stringify(manyFailures(count)), 'utf8');
  const manifestFile = path.join(dir, 'run.json');

  const run = await cli([input, '--json', '--manifest', manifestFile]);

  expect(run.code, run.stderr).toBe(0);
  return {
    summary: JSON.parse(run.stdout) as ReportSummary,
    manifest: await readManifest(manifestFile),
  };
}

// A passing scenario plus a failed run-level hook: the run fails without a
// failed scenario row.
const hookOnlyMessages = [
  '{"pickle":{"id":"p","uri":"features/x.feature","astNodeIds":[],"tags":[],"name":"passes","language":"en","steps":[{"id":"ps","text":"x","astNodeIds":[]}]}}',
  '{"testCase":{"id":"tc","pickleId":"p","testSteps":[{"id":"ts","pickleStepId":"ps"}]}}',
  '{"testRunStarted":{"id":"run","timestamp":{"seconds":0,"nanos":0}}}',
  '{"testCaseStarted":{"id":"tcs","testCaseId":"tc","attempt":0,"timestamp":{"seconds":0,"nanos":1000000}}}',
  '{"testStepStarted":{"testCaseStartedId":"tcs","testStepId":"ts","timestamp":{"seconds":0,"nanos":2000000}}}',
  '{"testStepFinished":{"testCaseStartedId":"tcs","testStepId":"ts","testStepResult":{"status":"PASSED","duration":{"seconds":0,"nanos":1000000}},"timestamp":{"seconds":0,"nanos":3000000}}}',
  '{"testCaseFinished":{"testCaseStartedId":"tcs","timestamp":{"seconds":0,"nanos":4000000},"willBeRetried":false}}',
  '{"testRunFinished":{"testRunStartedId":"run","timestamp":{"seconds":0,"nanos":5000000},"success":true}}',
  '{"testRunHookStarted":{"testRunStartedId":"run","id":"hook-start","hookId":"hook-def","timestamp":{"seconds":0,"nanos":6000000}}}',
  '{"testRunHookFinished":{"testRunHookStartedId":"hook-start","timestamp":{"seconds":0,"nanos":7000000},"result":{"status":"FAILED","message":"after-all failed","duration":{"seconds":0,"nanos":1000000}}}}',
].join('\n');

describe('CLI --manifest', () => {
  it('lists report, PDF, email, history and ci-markdown in write order', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'input.ndjson');
    await copyFile(screenshot, input);
    const report = path.join(dir, 'report.html');
    const pdfPath = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    const history = path.join(dir, 'history.json');
    await copyFile(historyFixture, history);
    const ciOut = path.join(dir, 'summary.md');
    const manifestDir = path.join(dir, 'manifests');
    const manifestFile = path.join(manifestDir, 'run.json');

    const reference = await cli([input, '--json']);
    expect(reference.code, reference.stderr).toBe(0);
    const summary = JSON.parse(reference.stdout) as ReportSummary;

    const run = await cli([
      input,
      '--out',
      report,
      '--pdf',
      pdfPath,
      '--email',
      email,
      '--history',
      history,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--manifest',
      manifestFile,
    ]);

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    const lines = run.stdout.trimEnd().split('\n');
    const reportLine = lines.findIndex((line) =>
      line.startsWith('Report written'),
    );
    const pdfLine = lines.findIndex((line) => line.startsWith('PDF written'));
    const emailLine = lines.findIndex((line) =>
      line.startsWith('Email written'),
    );
    const manifestLine = lines.findIndex((line) =>
      line.startsWith('Manifest written'),
    );
    expect(reportLine).toBeGreaterThanOrEqual(0);
    expect(pdfLine).toBeGreaterThan(reportLine);
    expect(emailLine).toBeGreaterThan(pdfLine);
    expect(manifestLine).toBeGreaterThan(emailLine);
    expect(lines[manifestLine]).toBe(`Manifest written to ${manifestFile}`);

    const manifest = await readManifest(manifestFile);
    expect(Object.keys(manifest)).toEqual([
      'schemaVersion',
      'tool',
      'status',
      'counts',
      'attachments',
      'warnings',
      'artifacts',
      'failures',
    ]);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.tool).toEqual({ name: 'tolkira', version });
    expect(manifest.status).toBe(summary.status);
    expect(manifest.counts).toEqual(summary.counts);
    expect(manifest.attachments).toEqual(summary.attachments);
    expect(manifest.warnings).toEqual({ skippedAttachments: 0 });
    expect(manifest.artifacts).toEqual([
      { kind: 'report', path: relativeTo(manifestDir, report) },
      { kind: 'pdf', path: relativeTo(manifestDir, pdfPath) },
      { kind: 'email', path: relativeTo(manifestDir, email) },
      { kind: 'history', path: relativeTo(manifestDir, history) },
      { kind: 'ci-markdown', path: relativeTo(manifestDir, ciOut) },
    ]);
    expect(manifest.failures).toEqual(expectedFailures(summary));
    expect((await readFile(pdfPath)).equals(PDF_BYTES)).toBe(true);
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
    await expect(readFile(email, 'utf8')).resolves.toContain('<html');
    await expect(readFile(ciOut, 'utf8')).resolves.toContain('Screenshot');
    const stored = JSON.parse(await readFile(history, 'utf8')) as {
      runs: unknown[];
    };
    expect(stored.runs).toHaveLength(3);
  });

  it('caps failures at ten in summary order', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'many.json');
    await writeFile(input, JSON.stringify(manyFailures(12)), 'utf8');
    const manifestFile = path.join(dir, 'run.json');

    const run = await cli([input, '--json', '--manifest', manifestFile]);

    expect(run.code, run.stderr).toBe(0);
    const summary = JSON.parse(run.stdout) as ReportSummary;
    const manifest = await readManifest(manifestFile);
    expect(summary.counts.scenarios.failed).toBe(12);
    expect(manifest.artifacts).toEqual([]);
    expect(manifest.counts.scenarios.failed).toBe(12);
    expect(manifest.failures).toHaveLength(10);
    expect(manifest.failures).toEqual(expectedFailures(summary));
    expect(manifest.failures.map((failure) => failure.name)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `Failure ${String(index + 1).padStart(2, '0')}`,
      ),
    );
  });

  it('keeps all ten failures when the run has exactly ten', async () => {
    const { summary, manifest } = await runManyFailures(10);

    expect(summary.counts.scenarios.failed).toBe(10);
    expect(manifest.counts.scenarios.failed).toBe(10);
    expect(manifest.failures).toHaveLength(10);
    expect(manifest.failures).toEqual(expectedFailures(summary));
    expect(manifest.failures.map((failure) => failure.name)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `Failure ${String(index + 1).padStart(2, '0')}`,
      ),
    );
  });

  it('keeps ten and omits the eleventh when the run has eleven', async () => {
    const { summary, manifest } = await runManyFailures(11);

    expect(summary.counts.scenarios.failed).toBe(11);
    expect(manifest.counts.scenarios.failed).toBe(11);
    expect(manifest.failures).toHaveLength(10);
    expect(manifest.failures).toEqual(expectedFailures(summary));
    expect(manifest.failures.map((failure) => failure.name)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `Failure ${String(index + 1).padStart(2, '0')}`,
      ),
    );
    expect(manifest.failures.map((failure) => failure.name)).not.toContain(
      'Failure 11',
    );
  });

  it('omits an unexecuted failed-status row', async () => {
    const summary = await summarizeReport(fixturePath('legacy', 'happy.json'));
    const [first] = summary.scenarios;
    if (!first) throw new Error('fixture must contain a scenario');
    summary.scenarios.push({
      ...first,
      name: 'Unexecuted failure',
      status: 'failed',
      executed: false,
    });

    const manifest = buildRunManifest(
      summary,
      0,
      [],
      path.join(tmpdir(), 'run.json'),
    );

    expect(manifest.failures).toEqual([]);
  });

  it('carries the outline example coordinate', async () => {
    const dir = await tempDir();
    const manifestFile = path.join(dir, 'run.json');

    const run = await cli([examples, '--json', '--manifest', manifestFile]);

    expect(run.code, run.stderr).toBe(0);
    const summary = JSON.parse(run.stdout) as ReportSummary;
    const manifest = await readManifest(manifestFile);
    expect(manifest.failures).toEqual([
      {
        feature: 'Examples Tables',
        name: 'Eating cucumbers',
        example: '#2.1',
        uri: 'samples/examples-tables/examples-tables.feature',
      },
      {
        feature: 'Examples Tables',
        name: 'Eating cucumbers',
        example: '#2.2',
        uri: 'samples/examples-tables/examples-tables.feature',
      },
    ]);
    expect(manifest.failures.map((failure) => Object.keys(failure))).toEqual([
      ['feature', 'name', 'example', 'uri'],
      ['feature', 'name', 'example', 'uri'],
    ]);
    expect(manifest.failures).toEqual(expectedFailures(summary));
  });

  it('reports the skipped-attachment count the stderr warning names', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-cli-artifacts-outside-');
    const secret = path.join(outside, 'secret.png');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'secret', contentType: 'image/png', path: secret },
    ]);
    const report = path.join(dir, 'report.html');
    const manifestFile = path.join(dir, 'run.json');

    const run = await cli([
      input,
      '--out',
      report,
      '--json',
      '--manifest',
      manifestFile,
    ]);

    expect(run.code, run.stderr).toBe(0);
    const warning = /(\d+) path attachments? (?:was|were) skipped/.exec(
      run.stderr,
    );
    expect(warning).not.toBeNull();
    const manifest = await readManifest(manifestFile);
    expect(manifest.warnings.skippedAttachments).toBe(Number(warning?.[1]));
    expect(manifest.warnings.skippedAttachments).toBe(1);
  });

  it('reports the skipped-attachment count on a summary-only run', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-cli-artifacts-outside-');
    const secret = path.join(outside, 'secret.png');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'secret', contentType: 'image/png', path: secret },
    ]);
    const manifestFile = path.join(dir, 'run.json');

    const run = await cli([input, '--json', '--manifest', manifestFile]);

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    const manifest = await readManifest(manifestFile);
    expect(manifest.warnings.skippedAttachments).toBe(1);
  });

  it('keeps a failed run hook at status failed with empty failures', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'hook-only.ndjson');
    await writeFile(input, `${hookOnlyMessages}\n`, 'utf8');
    const manifestFile = path.join(dir, 'run.json');

    const run = await cli([input, '--json', '--manifest', manifestFile]);

    expect(run.code, run.stderr).toBe(0);
    const summary = JSON.parse(run.stdout) as ReportSummary;
    expect(summary.status).toBe('failed');
    expect(summary.counts.scenarios.failed).toBe(0);
    const manifest = await readManifest(manifestFile);
    expect(manifest.status).toBe('failed');
    expect(manifest.counts).toEqual(summary.counts);
    expect(manifest.failures).toEqual([]);
    expect(manifest.artifacts).toEqual([]);
  });

  it('lists email and ci-markdown artifacts in a summary-only run', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');
    const ciOut = path.join(dir, 'summary.md');
    const manifestFile = path.join(dir, 'run.json');

    const run = await cli([
      screenshot,
      '--email',
      email,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--manifest',
      manifestFile,
    ]);

    expect(run.code, run.stderr).toBe(0);
    const lines = run.stdout.trimEnd().split('\n');
    expect(lines[0]).toBe(`Email written to ${email}`);
    expect(lines[1]).toBe(`Manifest written to ${manifestFile}`);
    const manifest = await readManifest(manifestFile);
    expect(manifest.artifacts).toEqual([
      { kind: 'email', path: relativeTo(dir, email) },
      { kind: 'ci-markdown', path: relativeTo(dir, ciOut) },
    ]);
    expect(
      manifest.artifacts.some(
        (artifact) => artifact.kind === 'report' || artifact.kind === 'pdf',
      ),
    ).toBe(false);
  });

  it('keeps artifacts empty but failures present with --json', async () => {
    const dir = await tempDir();
    const manifestFile = path.join(dir, 'run.json');

    const run = await cli([screenshot, '--json', '--manifest', manifestFile]);

    expect(run.code, run.stderr).toBe(0);
    const summary = JSON.parse(run.stdout) as ReportSummary;
    const manifest = await readManifest(manifestFile);
    expect(manifest.artifacts).toEqual([]);
    expect(manifest.failures).toEqual(expectedFailures(summary));
    expect(manifest.failures.length).toBeGreaterThan(0);
    expect(Object.keys(manifest.failures[0] ?? {})).toEqual([
      'feature',
      'name',
      'uri',
    ]);
    expect(run.stdout).not.toContain('Manifest written');
  });

  it('satisfies the output requirement with --manifest alone', async () => {
    const dir = await tempDir();
    const manifestFile = path.join(dir, 'run.json');

    const run = await cli([screenshot, '--manifest', manifestFile]);

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout).toBe(`Manifest written to ${manifestFile}\n`);
    const manifest = await readManifest(manifestFile);
    expect(manifest.artifacts).toEqual([]);
    expect(manifest.status).toBe('failed');
  });

  it('rejects every collision and an empty path before writing', async () => {
    const dir = await tempDir();
    const inputDir = path.join(dir, 'results');
    await mkdir(inputDir);
    const input = path.join(inputDir, 'run.ndjson');
    await copyFile(screenshot, input);
    const inputBefore = await readFile(input);
    const logo = path.join(dir, 'logo.png');
    await writeFile(logo, Buffer.from(LOGO, 'base64'));
    const logoBefore = await readFile(logo);
    const history = path.join(dir, 'history.json');
    await copyFile(historyFixture, history);
    const historyBefore = await readFile(history, 'utf8');
    const baseline = path.join(dir, 'baseline.json');
    await writeFile(
      baseline,
      JSON.stringify({ schemaVersion: 2, status: 'passed', scenarios: [] }),
      'utf8',
    );
    const baselineBefore = await readFile(baseline, 'utf8');
    const report = path.join(dir, 'report.html');
    const pdfPath = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    const ciOut = path.join(dir, 'summary.md');
    const manifest = path.join(dir, 'run.json');
    const insideInput = path.join(inputDir, 'new-run.json');

    const cases: Array<[string, string[]]> = [
      ['an input file', [input, '--out', report, '--manifest', input]],
      [
        'the logo',
        [input, '--out', report, '--logo', logo, '--manifest', logo],
      ],
      ['--out', [input, '--out', report, '--manifest', report]],
      ['--pdf', [input, '--pdf', pdfPath, '--manifest', pdfPath]],
      ['--email', [input, '--email', email, '--manifest', email]],
      [
        '--history',
        [input, '--out', report, '--history', history, '--manifest', history],
      ],
      [
        '--ci-out',
        [
          input,
          '--out',
          report,
          '--ci',
          'markdown',
          '--ci-out',
          ciOut,
          '--manifest',
          ciOut,
        ],
      ],
      [
        '--baseline',
        [
          input,
          '--out',
          report,
          '--baseline',
          baseline,
          '--manifest',
          baseline,
        ],
      ],
      [
        'the input directory',
        [inputDir, '--out', report, '--manifest', inputDir],
      ],
      [
        'inside the input directory',
        [inputDir, '--out', report, '--manifest', insideInput],
      ],
      ['an empty path', [input, '--out', report, '--manifest', '']],
    ];

    for (const [label, argv] of cases) {
      const run = await cli(argv);
      expect(run.code, label).toBe(2);
      expect(run.stdout, label).toBe('');
      expect(run.stderr, label).toMatch(/--manifest/);
      expect(run.stderr, label).not.toMatch(/Unknown option/i);
      expect(run.stderr, label).toContain('Usage: tolkira');
    }

    expect(pdf.renderPdf).not.toHaveBeenCalled();
    await expect(readFile(input)).resolves.toEqual(inputBefore);
    await expect(readFile(logo)).resolves.toEqual(logoBefore);
    await expect(readFile(history, 'utf8')).resolves.toBe(historyBefore);
    await expect(readFile(baseline, 'utf8')).resolves.toBe(baselineBefore);
    expect(await readdir(inputDir)).toEqual(['run.ndjson']);
    for (const file of [report, pdfPath, email, ciOut, manifest, insideInput]) {
      await expect(exists(file), file).resolves.toBe(false);
    }
    expect(
      (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });

  it.skipIf(process.platform !== 'win32')(
    'rejects a relative --out that has no path from the manifest drive',
    async () => {
      const currentDrive = path.parse(process.cwd()).root.toLowerCase();
      const otherDrive = currentDrive === 'z:\\' ? 'Y:\\' : 'Z:\\';
      const manifestFile = path.join(
        otherDrive,
        'tolkira-manifest',
        'run.json',
      );
      const report = 'tolkira-cross-drive-report.html';

      const run = await cli([
        screenshot,
        '--out',
        report,
        '--manifest',
        manifestFile,
      ]);

      expect(run.code).toBe(2);
      expect(run.stdout).toBe('');
      expect(run.stderr).toContain(
        'tolkira: --out tolkira-cross-drive-report.html cannot be expressed ' +
          'relative to --manifest; pass an absolute --out path',
      );
      expect(pdf.renderPdf).not.toHaveBeenCalled();
      await expect(exists(path.resolve(report))).resolves.toBe(false);
      await expect(exists(manifestFile)).resolves.toBe(false);
    },
  );

  it('fails on a manifest write error, keeps earlier outputs and skips stdout', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const ciOut = path.join(dir, 'summary.md');
    const target = path.join(dir, 'manifest-target');
    await mkdir(target);

    const withJson = await cli([
      screenshot,
      '--out',
      report,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--json',
      '--manifest',
      target,
    ]);

    expect(withJson.code).toBe(1);
    expect(withJson.stdout).toBe('');
    expect(withJson.stderr).toContain(`Cannot write manifest to ${target}`);
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
    await expect(readFile(ciOut, 'utf8')).resolves.toContain('Screenshot');
    expect((await stat(target)).isDirectory()).toBe(true);
    expect(
      (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);

    const ciDir = await tempDir();
    const ciReport = path.join(ciDir, 'report.html');
    const ciTarget = path.join(ciDir, 'manifest-target');
    await mkdir(ciTarget);

    const withCi = await cli([
      screenshot,
      '--out',
      ciReport,
      '--ci',
      'markdown',
      '--manifest',
      ciTarget,
    ]);

    expect(withCi.code).toBe(1);
    expect(withCi.stdout).toBe('');
    expect(withCi.stderr).toContain(`Cannot write manifest to ${ciTarget}`);
    await expect(readFile(ciReport, 'utf8')).resolves.toContain('<html');
    expect(
      (await readdir(ciDir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });

  it('keeps --json and --ci stdout byte-identical with the manifest', async () => {
    const dir = await tempDir();

    const jsonBaseline = await cli([screenshot, '--json']);
    const jsonWithManifest = await cli([
      screenshot,
      '--json',
      '--manifest',
      path.join(dir, 'json-run.json'),
    ]);

    expect(jsonBaseline.code, jsonBaseline.stderr).toBe(0);
    expect(jsonWithManifest.code, jsonWithManifest.stderr).toBe(0);
    expect(jsonWithManifest.stdout).toBe(jsonBaseline.stdout);
    expect(jsonWithManifest.stdout).not.toContain('Manifest written');

    const ciBaseline = await cli([screenshot, '--ci', 'markdown']);
    const ciWithManifest = await cli([
      screenshot,
      '--ci',
      'markdown',
      '--manifest',
      path.join(dir, 'ci-run.json'),
    ]);

    expect(ciBaseline.code, ciBaseline.stderr).toBe(0);
    expect(ciWithManifest.code, ciWithManifest.stderr).toBe(0);
    expect(ciWithManifest.stdout).toBe(ciBaseline.stdout);
    expect(ciWithManifest.stdout).not.toContain('Manifest written');
  });

  it('is deterministic and carries no cwd, input path or timestamp', async () => {
    const firstDir = await tempDir();
    const secondDir = await tempDir();
    const firstInput = path.join(firstDir, 'input.ndjson');
    const secondInput = path.join(secondDir, 'input.ndjson');
    await copyFile(screenshot, firstInput);
    await copyFile(screenshot, secondInput);
    const firstManifest = path.join(firstDir, 'run.json');
    const secondManifest = path.join(secondDir, 'run.json');

    const first = await cli([
      firstInput,
      '--out',
      path.join(firstDir, 'report.html'),
      '--manifest',
      firstManifest,
    ]);
    const second = await cli([
      secondInput,
      '--out',
      path.join(secondDir, 'report.html'),
      '--manifest',
      secondManifest,
    ]);

    expect(first.code, first.stderr).toBe(0);
    expect(second.code, second.stderr).toBe(0);
    const firstText = await readFile(firstManifest, 'utf8');
    const secondText = await readFile(secondManifest, 'utf8');
    expect(firstText).toBe(secondText);
    expect(firstText).not.toContain(firstDir);
    expect(firstText).not.toContain(secondDir);
    expect(firstText).not.toContain(process.cwd());
    expect(firstText).not.toContain('input.ndjson');
    expect(firstText).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});
