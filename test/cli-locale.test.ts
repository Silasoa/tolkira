import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const historyFixture = fileURLToPath(
  new URL('./fixtures/history/two-runs.json', import.meta.url),
);

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-locale-'));
  tempDirs.push(dir);
  return dir;
}

async function run(args: string[]): Promise<CliResult> {
  let stdout = '';
  let stderr = '';
  const code = await runCli(args, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

describe('CLI --locale', () => {
  it('writes a German report and exits 0', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'de.html');

    const result = await run([fixture, '--out', output, '--locale', 'de']);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<html lang="de" dir="ltr">');
    expect(html).toContain('>Bericht</button>');
    expect(html).toContain('aria-label="Szenarien durchsuchen"');
    expect(html).toContain('Erstellt von Tolkira. Eine Datei.');
  });

  it('keeps a regional tag in lang and uses the German catalog', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'de-at.html');

    const result = await run([fixture, '--out', output, '--locale', 'de-AT']);

    expect(result.code, result.stderr).toBe(0);
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<html lang="de-AT" dir="ltr">');
    expect(html).toContain('>Bericht</button>');
  });

  it('rejects an unsupported locale with the supported list and writes nothing', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'fr.html');

    const result = await run([fixture, '--out', output, '--locale', 'fr']);

    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/\bfr\b/);
    expect(result.stderr).toMatch(/\ben\b/);
    expect(result.stderr).toMatch(/\bde\b/);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects an empty locale with the supported list and writes nothing', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'empty.html');

    const result = await run([fixture, '--out', output, '--locale', '']);

    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/\ben\b/);
    expect(result.stderr).toMatch(/\bde\b/);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('requires --out when --locale is combined with --json only', async () => {
    const result = await run([fixture, '--json', '--locale', 'de']);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/--locale[^\n]*requires[^\n]*--out/i);
  });

  it('keeps --ci stdout byte-identical when a German report is written too', async () => {
    const dir = await tempDir();
    const english = await run([
      fixture,
      '--ci',
      'github',
      '--out',
      path.join(dir, 'ci-en.html'),
    ]);
    const german = await run([
      fixture,
      '--ci',
      'github',
      '--out',
      path.join(dir, 'ci-de.html'),
      '--locale',
      'de',
    ]);

    expect(english.code, english.stderr).toBe(0);
    expect(german.code, german.stderr).toBe(0);
    expect(german.stdout).toBe(english.stdout);
  });

  it('requires --out when --locale is combined with --ci only', async () => {
    const result = await run([fixture, '--ci', 'github', '--locale', 'de']);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/--locale[^\n]*requires[^\n]*--out/i);
  });

  it('keeps --json stdout byte-identical between English and German', async () => {
    const dir = await tempDir();
    const english = await run([
      fixture,
      '--json',
      '--out',
      path.join(dir, 'json-en.html'),
    ]);
    const german = await run([
      fixture,
      '--json',
      '--out',
      path.join(dir, 'json-de.html'),
      '--locale',
      'de',
    ]);

    expect(english.code, english.stderr).toBe(0);
    expect(german.code, german.stderr).toBe(0);
    expect(german.stdout).toBe(english.stdout);
    expect(JSON.parse(german.stdout)).toMatchObject({ schemaVersion: 2 });
  });

  it('stays English without a locale', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'en.html');

    const result = await run([fixture, '--out', output]);

    expect(result.code, result.stderr).toBe(0);
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('aria-label="Report views"');
    expect(html).toContain('>Report</button>');
    expect(html).not.toContain('>Bericht</button>');
  });

  it('keeps the default title in the report and the history', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'history.html');
    const history = path.join(dir, 'history.json');
    await copyFile(historyFixture, history);

    const result = await run([
      fixture,
      '--out',
      output,
      '--history',
      history,
      '--locale',
      'de',
    ]);

    expect(result.code, result.stderr).toBe(0);
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<title>Tolkira report</title>');
    expect(html).toContain('>Bericht</button>');
    expect(html).toContain('>Trends</button>');

    const stored = JSON.parse(await readFile(history, 'utf8')) as {
      runs: Array<{ title: string }>;
    };
    expect(stored.runs).toHaveLength(3);
    expect(stored.runs.at(-1)?.title).toBe('Tolkira report');
  });

  it('lets --title override the German report title', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'titled.html');

    const result = await run([
      fixture,
      '--out',
      output,
      '--locale',
      'de',
      '--title',
      'Monatsbericht',
    ]);

    expect(result.code, result.stderr).toBe(0);
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<title>Monatsbericht</title>');
    expect(html).toContain('>Bericht</button>');
  });
});
