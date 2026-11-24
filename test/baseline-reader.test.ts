import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { chmod, mkdir, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { legacyFixture } from './fixtures.js';
import {
  BASELINE_MAX_BYTES,
  baselineBlock,
  baselineOfSize,
  cleanupTempDirs,
  cli,
  makeTempDir,
  parsedSummary,
  validBaseline,
  writeText,
} from './baseline-helpers.js';

afterEach(cleanupTempDirs);

const input = legacyFixture('minimal.json');

// Symlinks are the only hostile shape Windows may refuse without Developer
// Mode or an elevated token. Probe the capability once and skip only that
// case, never the reader behaviour it guards.
function symlinkSupported(type: 'file' | 'dir'): boolean {
  const root = mkdtempSync(path.join(tmpdir(), 'tolkira-symlink-probe-'));
  try {
    const target = path.join(root, type === 'file' ? 'target.txt' : 'target');
    if (type === 'file') writeFileSync(target, 'x');
    else mkdirSync(target);
    symlinkSync(target, path.join(root, 'link'), type);
    return true;
  } catch {
    return false;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const FILE_SYMLINKS = symlinkSupported('file');
const DIR_SYMLINKS = symlinkSupported('dir');

type Loose = Record<string, unknown>;

function baselineDoc(): Loose {
  return JSON.parse(JSON.stringify(validBaseline())) as Loose;
}

function scenarioDoc(doc: Loose): Loose {
  const scenarios = doc.scenarios as Loose[];
  const scenario = scenarios[0];
  if (!scenario) throw new Error('the helper baseline has no scenario');
  return scenario;
}

function jsonWith(mutate: (doc: Loose, scenario: Loose) => void): string {
  const doc = baselineDoc();
  mutate(doc, scenarioDoc(doc));
  return JSON.stringify(doc, null, 2);
}

function withDocumentKey(raw: string, key: string, value: unknown): string {
  return raw.replace('{', `{"${key}":${JSON.stringify(value)},`);
}

function withScenarioKey(raw: string, key: string, value: unknown): string {
  return raw.replace(
    '"scenarios":[{',
    `"scenarios":[{${`"${key}":${JSON.stringify(value)},`}`,
  );
}

function nested(levels: number): unknown {
  let value: unknown = [];
  for (let index = 0; index < levels; index += 1) value = [value];
  return value;
}

async function expectRejected(
  content: string,
  reason?: RegExp,
): Promise<void> {
  const dir = await makeTempDir();
  const file = await writeText(dir, 'hostile-baseline.json', content);
  const output = path.join(dir, 'report.html');

  const result = await cli([
    input,
    '--baseline',
    file,
    '--out',
    output,
    '--json',
  ]);

  expect(result.code, result.stderr).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).not.toMatch(/Unknown option/i);
  expect(result.stderr).toContain('hostile-baseline.json');
  if (reason) expect(result.stderr).toMatch(reason);
  await expect(readFile(output, 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  });
}

const VALID = JSON.stringify(validBaseline());

const INVALID_CASES: Array<{
  label: string;
  content: string;
  reason?: RegExp;
}> = [
  { label: 'invalid JSON', content: '{"schemaVersion":' },
  { label: 'empty file', content: '' },
  { label: 'a document array', content: '[]' },
  { label: 'a document null', content: 'null' },
  {
    label: 'missing scenarios',
    content: JSON.stringify({ schemaVersion: 2, status: 'passed' }),
    reason: /scenarios must be an array/,
  },
  {
    label: 'non-array scenarios',
    content: JSON.stringify({
      schemaVersion: 2,
      status: 'passed',
      scenarios: {},
    }),
    reason: /scenarios must be an array/,
  },
  {
    label: 'a history sidecar (schema 1)',
    content: JSON.stringify({ schemaVersion: 1, runs: [] }),
    reason: /history sidecar|schema-2 report summary/i,
  },
  {
    label: 'a history sidecar (schema 2)',
    content: JSON.stringify({ schemaVersion: 2, runs: [] }),
    reason: /history sidecar|schema-2 report summary/i,
  },
  {
    label: 'schema version 3',
    content: jsonWith((doc) => {
      doc.schemaVersion = 3;
    }),
    reason: /schema/i,
  },
  {
    label: 'a string schema version',
    content: jsonWith((doc) => {
      doc.schemaVersion = '2';
    }),
    reason: /schema/i,
  },
  {
    label: 'a missing feature',
    content: jsonWith((doc, scenario) => {
      delete scenario.feature;
    }),
  },
  {
    label: 'a missing name',
    content: jsonWith((doc, scenario) => {
      delete scenario.name;
    }),
  },
  {
    label: 'a missing uri',
    content: jsonWith((doc, scenario) => {
      delete scenario.uri;
    }),
  },
  {
    label: 'a missing status',
    content: jsonWith((doc, scenario) => {
      delete scenario.status;
    }),
  },
  {
    label: 'a missing executed',
    content: jsonWith((doc, scenario) => {
      delete scenario.executed;
    }),
  },
  {
    label: 'a non-string feature',
    content: jsonWith((doc, scenario) => {
      scenario.feature = 7;
    }),
  },
  {
    label: 'a null name',
    content: jsonWith((doc, scenario) => {
      scenario.name = null;
    }),
  },
  {
    label: 'an array uri',
    content: jsonWith((doc, scenario) => {
      scenario.uri = [];
    }),
  },
  {
    label: 'a non-string status',
    content: jsonWith((doc, scenario) => {
      scenario.status = 2;
    }),
  },
  {
    label: 'a string executed',
    content: jsonWith((doc, scenario) => {
      scenario.executed = 'true';
    }),
  },
  {
    label: 'a numeric example',
    content: jsonWith((doc, scenario) => {
      scenario.example = 1;
    }),
  },
  {
    label: 'an unknown status',
    content: jsonWith((doc, scenario) => {
      scenario.status = 'flaky';
    }),
    reason: /status/i,
  },
  {
    label: 'a string scenario entry',
    content: jsonWith((doc) => {
      doc.scenarios = ['not an object'];
    }),
  },
  {
    label: 'a null scenario entry',
    content: jsonWith((doc) => {
      doc.scenarios = [null];
    }),
  },
  {
    label: 'an array scenario entry',
    content: jsonWith((doc) => {
      doc.scenarios = [[]];
    }),
  },
  {
    label: 'a __proto__ document key',
    content: withDocumentKey(VALID, '__proto__', { polluted: true }),
  },
  {
    label: 'a constructor document key',
    content: withDocumentKey(VALID, 'constructor', { polluted: true }),
  },
  {
    label: 'a prototype document key',
    content: withDocumentKey(VALID, 'prototype', { polluted: true }),
  },
  {
    label: 'a __proto__ scenario key',
    content: withScenarioKey(VALID, '__proto__', { polluted: true }),
  },
  {
    label: 'a constructor scenario key',
    content: withScenarioKey(VALID, 'constructor', { polluted: true }),
  },
  {
    label: 'a prototype scenario key',
    content: withScenarioKey(VALID, 'prototype', { polluted: true }),
  },
  {
    label: 'a value nested deeper than 64 levels',
    content: JSON.stringify({
      schemaVersion: 2,
      status: 'passed',
      scenarios: [],
      extra: nested(100),
    }),
    reason: /deeper than 64/,
  },
];

describe('hostile baseline shapes', () => {
  it.each(INVALID_CASES)('rejects $label with exit 1 and no write', async ({
    content,
    reason,
  }) => {
    await expectRejected(content, reason);

    expect(
      ({} as Record<string, unknown>).polluted,
      'Object.prototype pollution',
    ).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('accepts a document 64 levels deep and rejects 65', async () => {
    const dir = await makeTempDir();
    const accepted = await writeText(
      dir,
      'depth-64.json',
      JSON.stringify({
        schemaVersion: 2,
        status: 'passed',
        scenarios: [],
        extra: nested(63),
      }),
    );
    const atBoundary = await cli([input, '--baseline', accepted, '--json']);
    expect(atBoundary.code, atBoundary.stderr).toBe(0);

    const rejected = await writeText(
      dir,
      'depth-65.json',
      JSON.stringify({
        schemaVersion: 2,
        status: 'passed',
        scenarios: [],
        extra: nested(64),
      }),
    );
    const overBoundary = await cli([input, '--baseline', rejected, '--json']);
    expect(overBoundary.code).toBe(1);
    expect(overBoundary.stderr).toContain('depth-65.json');
    expect(overBoundary.stderr).toMatch(/deeper than 64/);
  });

  it('names the file when JSON.parse overflows on extreme nesting', async () => {
    // V8 parses multi-million-level arrays iteratively, so inject the RangeError
    // at the parse seam to exercise the reader's overflow branch.
    const dir = await makeTempDir();
    const file = await writeText(dir, 'range-error.json', JSON.stringify(validBaseline()));
    const parse = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
      throw new RangeError('Maximum call stack size exceeded');
    });
    try {
      const result = await cli([input, '--baseline', file, '--json']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('range-error.json');
      expect(result.stderr).toMatch(/nested too deeply/);
      expect(result.stderr).not.toMatch(/call stack|JSON\.parse/);
    } finally {
      parse.mockRestore();
    }
  });

  it('rejects invalid UTF-8 and names the file', async () => {
    const dir = await makeTempDir();
    const file = path.join(dir, 'invalid-utf8.json');
    await writeFileSync(file, Buffer.from([0x7b, 0xff, 0xfe, 0x7d]));

    const result = await cli([input, '--baseline', file, '--json']);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('invalid-utf8.json');
    expect(result.stderr).toContain('not valid UTF-8');
    expect(result.stdout).toBe('');
  });

  it('rejects a missing file, naming it, and writes nothing', async () => {
    const dir = await makeTempDir();
    const missing = path.join(dir, 'missing-baseline.json');
    const output = path.join(dir, 'report.html');

    const result = await cli([
      input,
      '--baseline',
      missing,
      '--out',
      output,
      '--json',
    ]);

    expect(result.code, result.stderr).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('missing-baseline.json');
    expect(result.stderr).not.toMatch(/Unknown option/i);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects a directory', async () => {
    const dir = await makeTempDir();
    const target = path.join(dir, 'baseline-directory');
    await mkdir(target);

    const result = await cli([
      input,
      '--baseline',
      target,
      '--out',
      path.join(dir, 'report.html'),
    ]);

    expect(result.code, result.stderr).toBe(1);
    expect(result.stderr).toContain('baseline-directory');
    expect(result.stderr).toMatch(/not a regular file/);
    await expect(
      readFile(path.join(dir, 'report.html'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'rejects an unreadable baseline and names the file',
    async () => {
      const dir = await makeTempDir();
      const file = await writeText(
        dir,
        'unreadable-baseline.json',
        JSON.stringify(validBaseline()),
      );
      await chmod(file, 0o000);
      try {
        const result = await cli([input, '--baseline', file, '--json']);

        expect(result.code, result.stderr).toBe(1);
        expect(result.stderr).toContain('unreadable-baseline.json');
        expect(result.stdout).toBe('');
      } finally {
        await chmod(file, 0o600);
      }
    },
  );

  it.skipIf(!DIR_SYMLINKS)('rejects a symlink to a directory', async () => {
    const dir = await makeTempDir();
    const target = path.join(dir, 'target-directory');
    const link = path.join(dir, 'baseline-link');
    await mkdir(target);
    await symlink(target, link, 'dir');

    const result = await cli([
      input,
      '--baseline',
      link,
      '--out',
      path.join(dir, 'report.html'),
    ]);

    expect(result.code, result.stderr).toBe(1);
    expect(result.stderr).toContain('baseline-link');
    await expect(
      readFile(path.join(dir, 'report.html'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.skipIf(!FILE_SYMLINKS)('reads a symlink to a regular file', async () => {
    const dir = await makeTempDir();
    const target = await writeText(
      dir,
      'real-baseline.json',
      JSON.stringify(validBaseline()),
    );
    const link = path.join(dir, 'baseline-link.json');
    await symlink(target, link, 'file');

    const result = await cli([input, '--baseline', link, '--json']);

    expect(result.code, result.stderr).toBe(0);
    expect(baselineBlock(parsedSummary(result.stdout)).status).toBe('passed');
  });

  it('accepts exactly 10,485,760 bytes and rejects one byte more', async () => {
    const dir = await makeTempDir();
    const atCap = await writeText(
      dir,
      'at-cap.json',
      baselineOfSize(BASELINE_MAX_BYTES),
    );
    const accepted = await cli([input, '--baseline', atCap, '--json']);

    expect(accepted.code, accepted.stderr).toBe(0);
    expect(baselineBlock(parsedSummary(accepted.stdout)).status).toBe('passed');

    const overCap = await writeText(
      dir,
      'over-cap.json',
      baselineOfSize(BASELINE_MAX_BYTES + 1),
    );
    const output = path.join(dir, 'report.html');
    const rejected = await cli([
      input,
      '--baseline',
      overCap,
      '--out',
      output,
      '--json',
    ]);

    expect(rejected.code, rejected.stderr).toBe(1);
    expect(rejected.stdout).toBe('');
    expect(rejected.stderr).toContain('over-cap.json');
    expect(rejected.stderr).toMatch(/10485760|10 MiB/);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

describe('accepted baseline shapes', () => {
  it('strips a UTF-8 BOM before parsing', async () => {
    const dir = await makeTempDir();
    const file = await writeText(
      dir,
      'bom-baseline.json',
      `\uFEFF${JSON.stringify(validBaseline())}`,
    );

    const result = await cli([input, '--baseline', file, '--json']);

    expect(result.code, result.stderr).toBe(0);
    expect(parsedSummary(result.stdout).schemaVersion).toBe(2);
    expect(baselineBlock(parsedSummary(result.stdout)).status).toBe('passed');
  });

  it('ignores a nested baseline block', async () => {
    const dir = await makeTempDir();
    const doc = baselineDoc();
    doc.baseline = {
      status: 'failed',
      counts: { newFailures: 99 },
      notInThisRun: [{ name: 'NESTED-MARKER' }],
    };
    const file = await writeText(dir, 'nested-baseline.json', JSON.stringify(doc));

    const result = await cli([input, '--baseline', file, '--json']);

    expect(result.code, result.stderr).toBe(0);
    const block = baselineBlock(parsedSummary(result.stdout));
    expect(block.counts.newFailures).toBe(0);
    expect(result.stdout).not.toContain('NESTED-MARKER');
  });

  it('reduces an absolute baseline URI and keeps a .. segment unresolved', async () => {
    const dir = await makeTempDir();
    const absolute = baselineDoc();
    scenarioDoc(absolute).uri =
      'C:\\Users\\name\\proj\\features\\secret.feature';
    const absoluteFile = await writeText(
      dir,
      'absolute-uri.json',
      JSON.stringify(absolute),
    );

    const absoluteRun = await cli([
      input,
      '--baseline',
      absoluteFile,
      '--json',
    ]);
    expect(absoluteRun.code, absoluteRun.stderr).toBe(0);
    const absoluteBlock = baselineBlock(parsedSummary(absoluteRun.stdout));
    expect(absoluteBlock.notInThisRun[0]?.uri).toBe('features/secret.feature');
    expect(absoluteRun.stdout).not.toContain('Users');
    expect(absoluteRun.stdout).not.toContain('C:');

    const dotDot = baselineDoc();
    scenarioDoc(dotDot).uri = 'features/../secret.feature';
    const dotDotFile = await writeText(
      dir,
      'dotdot-uri.json',
      JSON.stringify(dotDot),
    );
    const dotDotRun = await cli([input, '--baseline', dotDotFile, '--json']);

    expect(dotDotRun.code, dotDotRun.stderr).toBe(0);
    const dotDotBlock = baselineBlock(parsedSummary(dotDotRun.stdout));
    expect(dotDotBlock.notInThisRun[0]?.uri).toBe(
      'features/../secret.feature',
    );
  });

  it('trusts only identity and status fields', async () => {
    const dir = await makeTempDir();
    const doc = baselineDoc();
    doc.title = 'UNTRUSTED-TITLE';
    doc.counts = { scenarios: { total: 999 } };
    doc.attachments = { total: 999, bytes: 999 };
    const scenario = scenarioDoc(doc);
    scenario.steps = [{ keyword: 'Given', text: 'UNTRUSTED-STEP' }];
    scenario.tags = ['@UNTRUSTED-TAG'];
    scenario.durationMs = 999;
    scenario.attachments = 999;
    scenario.message = 'UNTRUSTED-MESSAGE';
    scenario.extra = 'UNTRUSTED-EXTRA';
    const file = await writeText(dir, 'untrusted-fields.json', JSON.stringify(doc));
    const output = path.join(dir, 'report.html');

    const result = await cli([
      input,
      '--baseline',
      file,
      '--out',
      output,
      '--json',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('UNTRUSTED');
    expect(await readFile(output, 'utf8')).not.toContain('UNTRUSTED');
  });

  it('accepts control and bidi characters in a name', async () => {
    const dir = await makeTempDir();
    const doc = baselineDoc();
    scenarioDoc(doc).name = 'pays\u202E by <script>alert(1)</script>';
    const file = await writeText(dir, 'control-name.json', JSON.stringify(doc));
    const output = path.join(dir, 'report.html');

    const result = await cli([
      input,
      '--baseline',
      file,
      '--out',
      output,
      '--json',
    ]);

    expect(result.code, result.stderr).toBe(0);
    const html = await readFile(output, 'utf8');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
