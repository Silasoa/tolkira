import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from '../src/attachment.js';
import type { CiFormat } from '../src/ci.js';
import { runCli } from '../src/cli.js';
import {
  HISTORY_LIMIT,
  HISTORY_LIMIT_MAX,
  HISTORY_MAX_BYTES,
} from '../src/history.js';
import { version } from '../src/index.js';
import { detectInput } from '../src/input/detect.js';
import { MAX_TOTAL_INPUT_BYTES } from '../src/input/load.js';
import { SUPPORTED_LOCALES } from '../src/render/i18n.js';
import { SUMMARY_SCHEMA_VERSION } from '../src/summary.js';
import { INPUT_WARN_BYTES } from '../src/warnings.js';
import { fixturePath } from './fixtures.js';

interface CapabilitiesDocument {
  schemaVersion: number;
  name: string;
  version: string;
  node: string;
  inputs: string[];
  outputs: Array<{ kind: string; flag: string; fileFlag?: string }>;
  summarySchemaVersion: number;
  locales: string[];
  limits: {
    inputTotalBytes: number;
    inputWarnBytes: number;
    attachmentBytes: number;
    totalAttachmentBytes: number;
    baselineBytes: number;
    historyBytes: number;
    historyLimitMax: number;
  };
  defaults: {
    reportWarnMb: number;
    pdfTimeoutMs: number;
    historyLimit: number;
  };
  exitCodes: {
    generated: number;
    inputOrWriteFailure: number;
    usage: number;
  };
}

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string; engines: { node: string } };

const fixture = fixturePath('messages', 'screenshot.ndjson');

const dirs: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-capabilities-'));
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

function parseCapabilities(stdout: string): CapabilitiesDocument {
  return JSON.parse(stdout) as CapabilitiesDocument;
}

describe('CLI --capabilities', () => {
  it('prints exactly one schema-1 JSON document in fixed key order', async () => {
    const run = await cli(['--capabilities']);

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    const document = parseCapabilities(run.stdout);
    expect(run.stdout).toBe(`${JSON.stringify(document, null, 2)}\n`);
    expect(document.schemaVersion).toBe(1);
    expect(document.name).toBe('tolkira');
    expect(Object.keys(document)).toEqual([
      'schemaVersion',
      'name',
      'version',
      'node',
      'inputs',
      'outputs',
      'summarySchemaVersion',
      'locales',
      'limits',
      'defaults',
      'exitCodes',
    ]);
    expect(Object.keys(document.limits)).toEqual([
      'inputTotalBytes',
      'inputWarnBytes',
      'attachmentBytes',
      'totalAttachmentBytes',
      'baselineBytes',
      'historyBytes',
      'historyLimitMax',
    ]);
    expect(Object.keys(document.defaults)).toEqual([
      'reportWarnMb',
      'pdfTimeoutMs',
      'historyLimit',
    ]);
    expect(Object.keys(document.exitCodes)).toEqual([
      'generated',
      'inputOrWriteFailure',
      'usage',
    ]);
    expect(document.outputs.map((output) => Object.keys(output))).toEqual([
      ['kind', 'flag'],
      ['kind', 'flag'],
      ['kind', 'flag'],
      ['kind', 'flag'],
      ['kind', 'flag'],
      ['kind', 'flag'],
      ['kind', 'flag', 'fileFlag'],
      ['kind', 'flag'],
      ['kind', 'flag'],
    ]);
  });

  it('sources version, Node range, schema, locales, limits and defaults', async () => {
    const run = await cli(['--capabilities']);

    expect(run.code, run.stderr).toBe(0);
    const document = parseCapabilities(run.stdout);
    const versionRun = await cli(['--version']);
    expect(versionRun.code, versionRun.stderr).toBe(0);
    expect(versionRun.stdout.trim()).toBe(packageJson.version);
    expect(document.version).toBe(packageJson.version);
    expect(document.version).toBe(version);
    expect(document.node).toBe(packageJson.engines.node);
    expect(document.summarySchemaVersion).toBe(SUMMARY_SCHEMA_VERSION);
    expect(document.locales).toEqual(SUPPORTED_LOCALES);
    expect(document.limits).toEqual({
      inputTotalBytes: MAX_TOTAL_INPUT_BYTES,
      inputWarnBytes: INPUT_WARN_BYTES,
      attachmentBytes: MAX_ATTACHMENT_BYTES,
      totalAttachmentBytes: MAX_TOTAL_ATTACHMENT_BYTES,
      // The baseline reader keeps its 10 MiB cap private; the reader tests pin
      // that cap through the rejection of an oversized baseline.
      baselineBytes: 10 * 1024 * 1024,
      historyBytes: HISTORY_MAX_BYTES,
      historyLimitMax: HISTORY_LIMIT_MAX,
    });
    expect(document.defaults).toEqual({
      // CLI option defaults: --max-size 10 MB and --pdf-timeout 300000 ms.
      reportWarnMb: 10,
      pdfTimeoutMs: 300_000,
      historyLimit: HISTORY_LIMIT,
    });
  });

  it('maps every input kind to detectInput and every output kind to a real flag', async () => {
    const run = await cli(['--capabilities']);

    expect(run.code, run.stderr).toBe(0);
    const document = parseCapabilities(run.stdout);
    const inputFixtures = {
      'cucumber-legacy-json': {
        file: fixturePath('legacy', 'happy.json'),
        detected: 'legacy',
      },
      'cucumber-messages': {
        file: fixturePath('messages', 'screenshot.ndjson'),
        detected: 'messages',
      },
      'junit-xml': {
        file: fixturePath('junit', 'basic.xml'),
        detected: 'junit',
      },
      'playwright-json': {
        file: fixturePath('playwright', 'output.json'),
        detected: 'playwright',
      },
    } as const;

    expect(document.inputs).toEqual(Object.keys(inputFixtures));
    for (const [kind, expected] of Object.entries(inputFixtures)) {
      const content = await readFile(expected.file, 'utf8');
      expect(
        detectInput(content, { file: expected.file, explicit: true }).kind,
        kind,
      ).toBe(expected.detected);
    }

    const ciFormats: CiFormat[] = ['github', 'azure', 'markdown'];
    expect(document.outputs).toEqual([
      { kind: 'report', flag: '--out' },
      { kind: 'pdf', flag: '--pdf' },
      { kind: 'email', flag: '--email' },
      { kind: 'json-summary', flag: '--json' },
      { kind: 'ci-github', flag: '--ci github' },
      { kind: 'ci-azure', flag: '--ci azure' },
      {
        kind: 'ci-markdown',
        flag: '--ci markdown',
        fileFlag: '--ci-out',
      },
      { kind: 'history', flag: '--history' },
      { kind: 'manifest', flag: '--manifest' },
    ]);
    expect(
      document.outputs
        .filter((output) => output.flag.startsWith('--ci '))
        .map((output) => output.flag.slice('--ci '.length)),
    ).toEqual(ciFormats);

    const help = await cli(['--help']);
    expect(help.code, help.stderr).toBe(0);
    for (const output of document.outputs) {
      const flag = output.flag.includes(' ')
        ? output.flag.slice(0, output.flag.indexOf(' '))
        : output.flag;
      expect(help.stdout, output.kind).toContain(flag);
      if (output.fileFlag !== undefined) {
        expect(help.stdout).toContain(output.fileFlag);
      }
    }
    expect(help.stdout).toContain('--capabilities');
  });

  it('proves the documented exit codes with success, usage and input failures', async () => {
    const dir = await tempDir();
    const broken = path.join(dir, 'broken.ndjson');
    await writeFile(broken, '{"not":"an envelope"}\n', 'utf8');

    const success = await cli([fixture, '--json']);
    const usage = await cli([]);
    const inputFailure = await cli([broken, '--json']);

    expect(success.code, success.stderr).toBe(0);
    expect(usage.code).toBe(2);
    expect(inputFailure.code, inputFailure.stderr).toBe(1);

    const run = await cli(['--capabilities']);
    expect(run.code, run.stderr).toBe(0);
    expect(parseCapabilities(run.stdout).exitCodes).toEqual({
      generated: success.code,
      inputOrWriteFailure: inputFailure.code,
      usage: usage.code,
    });
  });

  it('rejects every input and every other option without writing anything', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const manifest = path.join(dir, 'run.json');
    const email = path.join(dir, 'email.html');
    const pdfPath = path.join(dir, 'run.pdf');
    const history = path.join(dir, 'history.json');
    const ciOut = path.join(dir, 'summary.md');
    const baseline = path.join(dir, 'baseline.json');
    const logo = path.join(dir, 'logo.png');

    const options: Array<[string, string[]]> = [
      ['--out', ['--out', report]],
      ['--static', ['--static']],
      ['--pdf', ['--pdf', pdfPath]],
      ['--pdf-timeout', ['--pdf-timeout', '1000']],
      ['--email', ['--email', email]],
      ['--title', ['--title', 'ignored']],
      ['--locale', ['--locale', 'de']],
      ['--meta', ['--meta', 'key=value']],
      ['--logo', ['--logo', logo]],
      ['--accent', ['--accent', '#123456']],
      ['--max-size', ['--max-size', '5']],
      ['--json', ['--json']],
      ['--ci', ['--ci', 'github']],
      ['--ci-out', ['--ci-out', ciOut]],
      ['--history', ['--history', history]],
      ['--history-limit', ['--history-limit', '5']],
      ['--baseline', ['--baseline', baseline]],
      ['--manifest', ['--manifest', manifest]],
    ];
    const cases: Array<[string, string[]]> = [
      ['an input', [fixture, '--capabilities']],
      ...options.map(([label, argv]): [string, string[]] => [
        label,
        ['--capabilities', ...argv],
      ]),
      ['an input and --json', [fixture, '--capabilities', '--json']],
    ];

    for (const [label, argv] of cases) {
      const run = await cli(argv);
      expect(run.code, label).toBe(2);
      expect(run.stdout, label).toBe('');
      expect(run.stderr, label).toContain(
        '--capabilities takes no input and no other option; run tolkira --capabilities alone',
      );
      expect(run.stderr, label).toContain('Usage: tolkira');
    }

    for (const file of [
      report,
      manifest,
      email,
      pdfPath,
      history,
      ciOut,
      baseline,
      logo,
    ]) {
      await expect(exists(file), file).resolves.toBe(false);
    }
  });

  it('keeps --help and --version precedence', async () => {
    const help = await cli(['--capabilities', '--help']);
    expect(help.code, help.stderr).toBe(0);
    expect(help.stdout).toContain('Usage: tolkira');
    expect(help.stdout).toContain('--capabilities');

    const helpFirst = await cli(['--help', '--capabilities']);
    expect(helpFirst.code, helpFirst.stderr).toBe(0);
    expect(helpFirst.stdout).toContain('Usage: tolkira');

    const versionRun = await cli(['--capabilities', '--version']);
    expect(versionRun.code, versionRun.stderr).toBe(0);
    expect(versionRun.stdout).toBe(`${version}\n`);

    const versionFirst = await cli(['--version', '--capabilities']);
    expect(versionFirst.code, versionFirst.stderr).toBe(0);
    expect(versionFirst.stdout).toBe(`${version}\n`);
  });

  it('stays under 4,096 bytes, deterministic and free of timestamps, paths and environment values', async () => {
    const sentinel = 'tolkira-capabilities-sentinel-7f3a';
    vi.stubEnv('TOLKIRA_CAPABILITIES_SENTINEL', sentinel);

    const first = await cli(['--capabilities']);
    const second = await cli(['--capabilities']);

    expect(first.code, first.stderr).toBe(0);
    expect(second.code, second.stderr).toBe(0);
    expect(Buffer.byteLength(first.stdout, 'utf8')).toBeLessThan(4096);
    expect(second.stdout).toBe(first.stdout);
    expect(first.stdout).not.toContain(sentinel);
    expect(first.stdout).not.toContain(process.cwd());
    expect(first.stdout).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);

    vi.unstubAllEnvs();
  });
});
