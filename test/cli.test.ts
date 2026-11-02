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

  it('preserves a pre-existing output on failure', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'broken.ndjson');
    const output = path.join(dir, 'existing.html');
    await writeFile(input, '{"not":"an envelope"}\n', 'utf8');
    await writeFile(output, 'keep me', 'utf8');

    const code = await runCli([input, '--out', output], io);

    expect(code).toBe(1);
    await expect(readFile(output, 'utf8')).resolves.toBe('keep me');
  });

  it('treats invalid metadata as a usage error', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');

    const code = await runCli(
      [fixture, '--out', output, '--meta', 'not-a-pair'],
      io,
    );

    expect(code).toBe(2);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('prints a machine-readable summary with --json', async () => {
    let stdout = '';
    let stderr = '';
    const code = await runCli([legacyFixture, '--json'], {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    });

    expect(code).toBe(0);
    expect(stderr).toBe('');
    const summary = JSON.parse(stdout) as {
      schemaVersion: number;
      status: string;
      counts: { scenarios: { total: number; passed: number } };
    };
    expect(summary.schemaVersion).toBe(1);
    expect(summary.status).toBe('passed');
    expect(summary.counts.scenarios).toMatchObject({ total: 6, passed: 6 });
  });

  it('requires --out or --json', async () => {
    expect(await runCli([fixture], io)).toBe(2);
  });

  it('writes HTML and prints JSON when both are requested', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    let stdout = '';

    const code = await runCli([fixture, '--out', output, '--json'], {
      stdout: (text) => {
        stdout += text;
      },
      stderr: () => undefined,
    });

    expect(code).toBe(0);
    const summary = JSON.parse(stdout) as { status: string };
    expect(summary.status).toBe('failed');
    const html = await readFile(output, 'utf8');
    expect(html).toContain('<title>Tolkira report</title>');
  });

  it('embeds a logo and accent colour', async () => {
    const dir = await tempDir();
    const logo = path.join(dir, 'logo.png');
    const output = path.join(dir, 'branded.html');
    await writeFile(
      logo,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    );

    const code = await runCli(
      [
        legacyFixture,
        '--out',
        output,
        '--logo',
        logo,
        '--accent',
        '#123456',
      ],
      io,
    );

    expect(code).toBe(0);
    const html = await readFile(output, 'utf8');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('--tolkira-accent:#123456');
  });

  it('warns about oversized reports but still writes them', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'large.html');
    let stderr = '';

    const code = await runCli(
      [legacyFixture, '--out', output, '--max-size', '0.0001'],
      {
        stdout: () => undefined,
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(code).toBe(0);
    expect(stderr).toContain('above the 0.0001 MB threshold');
    await expect(readFile(output, 'utf8')).resolves.toContain('<html');
  });

  it('rejects invalid accent values and logo types as usage errors', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const logo = path.join(dir, 'logo.txt');
    await writeFile(logo, 'not an image', 'utf8');

    expect(
      await runCli([legacyFixture, '--out', output, '--accent', '#12345'], io),
    ).toBe(2);
    expect(
      await runCli([legacyFixture, '--out', output, '--logo', logo], io),
    ).toBe(2);
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
