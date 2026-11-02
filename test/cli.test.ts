import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const legacyFixture = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);

const io = {
  stdout: () => undefined,
  stderr: () => undefined,
};

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-'));
  tempDirs.push(dir);
  return dir;
}

describe('CLI', () => {
  it('writes a report from a messages fixture', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');

    const code = await runCli(
      [fixture, '--out', output, '--title', 'CLI report'],
      io,
    );

    expect(code).toBe(0);
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<title>CLI report</title>');
    expect(html).toContain('Screenshot attachment');
  });

  it('writes a report from a legacy JSON fixture', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'legacy.html');

    const code = await runCli(
      [legacyFixture, '--out', output, '--title', 'Legacy CLI'],
      io,
    );

    expect(code).toBe(0);
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<title>Legacy CLI</title>');
    expect(html).toContain('Happy HTML reporting');
  });

  it('returns usage error without input or output', async () => {
    expect(await runCli([], io)).toBe(2);
  });

  it('returns parse error and leaves no output', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'broken.ndjson');
    const output = path.join(dir, 'report.html');
    await writeFile(input, '{"not":"an envelope"}\n', 'utf8');

    const code = await runCli([input, '--out', output], io);

    expect(code).toBe(1);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
