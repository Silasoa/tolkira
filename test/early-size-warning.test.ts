import {
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  truncate,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli.js';
import { formatCiOutput } from '../src/ci.js';
import { renderEmail } from '../src/email.js';
import { generateReport } from '../src/index.js';

const MIB = 1024 * 1024;
const THRESHOLD = 50 * MIB;

function earlyWarning(megabytes: string): string {
  return (
    `tolkira: warning: input files total ${megabytes} MB, at or above the 50 MB ` +
    'early-warning threshold; parsing and rendering may take a while.\n'
  );
}

const WARNING = earlyWarning('50.0');

const tempDirs: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-early-size-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
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

interface SummaryShape {
  schemaVersion: number;
  status: string;
  counts: { scenarios: { total: number } };
}

function parseSummary(stdout: string): SummaryShape {
  return JSON.parse(stdout) as SummaryShape;
}

const LEGACY_BASE = JSON.stringify([
  {
    uri: 'features/early.feature',
    name: 'Early warning',
    elements: [
      {
        keyword: 'Scenario',
        type: 'scenario',
        name: 'passes',
        steps: [
          {
            keyword: 'Given ',
            name: 'a step',
            result: { status: 'passed', duration: 1 },
          },
        ],
      },
    ],
  },
]);

/** A valid legacy JSON report padded with trailing whitespace to an exact size. */
function legacyDocument(bytes: number): string {
  const document =
    LEGACY_BASE + ' '.repeat(bytes - Buffer.byteLength(LEGACY_BASE));
  if (Buffer.byteLength(document) !== bytes) {
    throw new Error(`Legacy fixture is ${Buffer.byteLength(document)} bytes`);
  }
  return document;
}

async function writeLegacy(
  dir: string,
  name: string,
  bytes: number,
): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, legacyDocument(bytes), 'utf8');
  return file;
}

/** A valid JUnit XML report padded with one large XML comment. */
function junitDocument(bytes: number, id: string): string {
  const head =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<testsuites><testsuite name="${id}" tests="1">` +
    `<testcase classname="${id}.Case" name="case" time="0.001"/>` +
    '</testsuite>';
  const tail = '</testsuites>\n';
  const overhead =
    Buffer.byteLength(head) +
    Buffer.byteLength(tail) +
    Buffer.byteLength('<!--') +
    Buffer.byteLength('-->');
  const document = `${head}<!--${'x'.repeat(bytes - overhead)}-->${tail}`;
  if (Buffer.byteLength(document) !== bytes) {
    throw new Error(`JUnit fixture is ${Buffer.byteLength(document)} bytes`);
  }
  return document;
}

async function writeJUnit(
  dir: string,
  name: string,
  bytes: number,
  id: string,
): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, junitDocument(bytes, id), 'utf8');
  return file;
}

function splitBytes(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const sizes = Array.from({ length: parts }, () => base);
  sizes[0] += total - base * parts;
  return sizes;
}

/** A file whose logical size is `bytes` but whose tail is never written. */
async function writeSparse(
  file: string,
  prefix: string,
  bytes: number,
): Promise<void> {
  const handle = await open(file, 'w');
  try {
    await handle.write(prefix);
    await handle.truncate(bytes);
  } finally {
    await handle.close();
  }
}

describe('early input size warning', () => {
  it(
    'warns at exactly 50 MiB and not one byte below',
    async () => {
      const dir = await tempDir();
      const file = await writeLegacy(dir, 'boundary.json', THRESHOLD);

      expect((await stat(file)).size).toBe(THRESHOLD);
      const at = await cli([file, '--json']);
      expect(at.code).toBe(0);
      expect(at.stderr).toBe(WARNING);
      expect(parseSummary(at.stdout).status).toBe('passed');

      await truncate(file, THRESHOLD - 1);
      expect((await stat(file)).size).toBe(THRESHOLD - 1);
      const below = await cli([file, '--json']);
      expect(below.code).toBe(0);
      expect(below.stderr).toBe('');
      expect(parseSummary(below.stdout).status).toBe('passed');
    },
    60_000,
  );

  it(
    'warns the same for one file and a directory with the same resolved total',
    async () => {
      const singleDir = await tempDir();
      const single = await writeLegacy(singleDir, 'single.json', THRESHOLD);

      const directory = await tempDir();
      const sizes = splitBytes(THRESHOLD, 4);
      for (const [index, bytes] of sizes.entries()) {
        await writeJUnit(directory, `part-${index}.xml`, bytes, `part-${index}`);
      }
      const resolved = await Promise.all(
        sizes.map((_, index) => stat(path.join(directory, `part-${index}.xml`))),
      );
      expect(resolved.reduce((sum, info) => sum + info.size, 0)).toBe(THRESHOLD);
      expect(resolved.every((info) => info.size < THRESHOLD)).toBe(true);

      const singleRun = await cli([single, '--json']);
      const directoryRun = await cli([directory, '--json']);

      expect(singleRun.code).toBe(0);
      expect(directoryRun.code).toBe(0);
      expect(singleRun.stderr).toBe(WARNING);
      expect(directoryRun.stderr).toBe(WARNING);
      expect(parseSummary(singleRun.stdout).counts.scenarios.total).toBe(1);
      expect(parseSummary(directoryRun.stdout).counts.scenarios.total).toBe(4);
    },
    60_000,
  );

  it(
    'counts a duplicated input path once',
    async () => {
      const dir = await tempDir();
      const file = await writeLegacy(dir, 'twice.json', THRESHOLD);

      const run = await cli([file, file, '--json']);

      expect(run.code).toBe(0);
      // 50.0 MB, not the doubled 100.0 MB a per-argument sum would report.
      expect(run.stderr).toBe(WARNING);
      expect(parseSummary(run.stdout).counts.scenarios.total).toBe(1);
    },
    60_000,
  );

  it(
    'warns before the parse error and leaves no output for a malformed large input',
    async () => {
      const dir = await tempDir();
      const input = path.join(dir, 'broken.xml');
      await writeSparse(input, '<testsuites><testsuite>', THRESHOLD);
      const output = path.join(dir, 'report.html');

      const run = await cli([input, '--out', output]);

      expect(run.code).toBe(1);
      expect(run.stderr.startsWith(WARNING)).toBe(true);
      expect(run.stderr).toContain('Invalid JUnit XML');
      expect(run.stderr.indexOf(WARNING)).toBeLessThan(
        run.stderr.indexOf('Invalid JUnit XML'),
      );
      await expect(readFile(output, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    },
    60_000,
  );

  it(
    'warns on stderr for a --json-only run and keeps stdout JSON-only',
    async () => {
      const dir = await tempDir();
      const file = await writeLegacy(dir, 'json.json', THRESHOLD);

      const run = await cli([file, '--json']);

      expect(run.code).toBe(0);
      expect(run.stderr).toBe(WARNING);
      expect(run.stdout).not.toContain('early-warning');
      expect(parseSummary(run.stdout).schemaVersion).toBe(2);
    },
    60_000,
  );

  it(
    'warns on stderr for a --ci-only run and keeps its stdout',
    async () => {
      const dir = await tempDir();
      const file = await writeLegacy(dir, 'ci.json', THRESHOLD);

      const run = await cli([file, '--ci', 'markdown']);

      expect(run.code).toBe(0);
      expect(run.stderr).toBe(WARNING);
      expect(run.stdout).toContain('## Tolkira report');
      expect(run.stdout).not.toContain('early-warning');
    },
    60_000,
  );

  it(
    'warns once for a normal report run and still writes the report',
    async () => {
      const dir = await tempDir();
      const file = await writeLegacy(dir, 'report.json', THRESHOLD);
      const output = path.join(dir, 'report.html');

      const run = await cli([file, '--out', output]);

      expect(run.code).toBe(0);
      expect(run.stderr).toBe(WARNING);
      expect(run.stderr.split('input files total')).toHaveLength(2);
      expect(run.stdout).toBe(`Report written to ${output}\n`);
      await expect(readFile(output, 'utf8')).resolves.toContain('<html');
    },
    60_000,
  );

  it(
    'shows the early warning and the report-size warning with different totals',
    async () => {
      const dir = await tempDir();
      const half = 25 * MIB;
      // Same content under two names: the scan counts both resolved paths while
      // the loader dedupes the content, so the two totals must differ.
      const content = junitDocument(half, 'duplicate');
      await writeFile(path.join(dir, 'a.xml'), content, 'utf8');
      await writeFile(path.join(dir, 'b.xml'), content, 'utf8');
      const output = path.join(dir, 'report.html');

      const run = await cli([dir, '--out', output, '--max-size', '0.0001']);

      expect(run.code).toBe(0);
      expect(run.stderr).toContain(WARNING);
      expect(run.stderr).toContain('input 25.0 MB');
      expect(run.stderr).toContain('above the 0.0001 MB threshold');
      expect(run.stderr.indexOf('input files total 50.0 MB')).toBeLessThan(
        run.stderr.indexOf('report HTML is'),
      );
      await expect(readFile(output, 'utf8')).resolves.toContain('<html');
    },
    60_000,
  );

  it(
    'changes no report, JSON, CI or email byte when it warns',
    async () => {
      const dir = await tempDir();
      const file = await writeLegacy(dir, 'bytes.json', THRESHOLD);
      const output = path.join(dir, 'report.html');
      const email = path.join(dir, 'email.html');
      const ciOut = path.join(dir, 'ci.md');
      const frozen = new Date('2026-01-02T03:04:05.000Z');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(frozen);

      const run = await cli([
        file,
        '--out',
        output,
        '--email',
        email,
        '--json',
        '--ci',
        'markdown',
        '--ci-out',
        ciOut,
      ]);

      expect(run.code).toBe(0);
      expect(run.stderr).toBe(WARNING);

      const generated = await generateReport(file, { metadata: {} });
      await expect(readFile(output, 'utf8')).resolves.toBe(generated.html);
      expect(run.stdout).toBe(`${JSON.stringify(generated.summary, null, 2)}\n`);
      await expect(readFile(ciOut, 'utf8')).resolves.toBe(
        formatCiOutput(generated.summary, 'markdown'),
      );
      await expect(readFile(email, 'utf8')).resolves.toBe(
        renderEmail(generated.summary, {
          reportName: path.basename(output),
          now: frozen,
        }),
      );
    },
    60_000,
  );

  it(
    'keeps usage errors at exit 2 without the early warning',
    async () => {
      const dir = await tempDir();
      const file = await writeLegacy(dir, 'usage.json', THRESHOLD);

      const warned = await cli([file, '--json']);
      expect(warned.code).toBe(0);
      expect(warned.stderr).toBe(WARNING);

      const overwrite = await cli([file, '--out', file]);
      expect(overwrite.code).toBe(2);
      expect(overwrite.stderr).toContain('must not overwrite an input file');
      expect(overwrite.stderr).not.toContain('early-warning threshold');

      const option = await cli([file, '--json', '--max-size', 'nope']);
      expect(option.code).toBe(2);
      expect(option.stderr).toContain('Invalid --max-size');
      expect(option.stderr).not.toContain('early-warning threshold');
    },
    60_000,
  );

  it(
    'reports a missing input as a loader error without the early warning',
    async () => {
      const dir = await tempDir();
      const file = await writeLegacy(dir, 'present.json', THRESHOLD);
      const missing = path.join(dir, 'missing.xml');

      const warned = await cli([file, '--json']);
      expect(warned.code).toBe(0);
      expect(warned.stderr).toBe(WARNING);

      const run = await cli([file, missing, '--json']);

      expect(run.code).toBe(1);
      expect(run.stdout).toBe('');
      expect(run.stderr).toContain('ENOENT');
      expect(run.stderr).not.toContain('early-warning threshold');
    },
    60_000,
  );

  it(
    'keeps the 100 MB cap and still shows the early warning',
    async () => {
      const dir = await tempDir();
      const input = path.join(dir, 'over-cap.xml');
      await writeSparse(input, '<testsuites>', 100 * MIB + 1);
      const output = path.join(dir, 'report.html');

      const run = await cli([input, '--out', output]);

      expect(run.code).toBe(1);
      expect(run.stderr).toContain(earlyWarning('100.0'));
      expect(run.stderr).toContain('Inputs exceed 100 MB in total.');
      expect(run.stderr.indexOf('early-warning threshold')).toBeLessThan(
        run.stderr.indexOf('Inputs exceed 100 MB'),
      );
      await expect(readFile(output, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    },
    60_000,
  );
});

// No public seam exposes the stat-only scan or the resolved-list identity, and
// an EACCES-after-resolution fixture is not portable. The duplicate-path and
// content-duplicate tests above cover the observable consequences.
