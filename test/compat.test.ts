import {
  copyFile,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { generate } from '../src/compat/cucumber-html-reporter.js';

const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-compat-'));
  tempDirs.push(dir);
  return dir;
}

describe('cucumber-html-reporter compat', () => {
  it('keeps legacy hooks in the compat report and summary', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'hooks.html');
    const result = await generate({ jsonFile: legacy, output });
    const html = await readFile(output, 'utf8');

    expect(html).toContain('class="hook"');
    expect(html).toContain('Before');
    expect(result.summary.schemaVersion).toBe(2);
    expect(result.summary.counts.steps.total).toBe(30);
  });

  it('maps the old options and warns about ignored ones', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'nested', 'report.html');

    const result = await generate({
      jsonFile: legacy,
      output,
      brandTitle: 'Compat report',
      metadata: { Browser: 'Chrome', Build: 42 },
      theme: 'bootstrap',
      storeScreenshots: true,
      launchReport: true,
    });

    const html = await readFile(output, 'utf8');
    expect(html).toContain('<title>Compat report</title>');
    expect(html).toContain('Happy HTML reporting');
    expect(html).toContain('Browser');
    expect(html).toContain('Chrome');
    expect(html).toContain('Build');
    expect(html).toContain('42');
    expect(result.summary.counts.scenarios.total).toBe(6);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('theme:'),
        expect.stringContaining('storeScreenshots:'),
        expect.stringContaining('launchReport:'),
      ]),
    );
  });

  it('scans jsonDir recursively and skips bad files on request', async () => {
    const dir = await tempDir();
    const nested = path.join(dir, 'nested', 'deeper');
    await mkdir(nested, { recursive: true });
    await copyFile(legacy, path.join(nested, 'happy.json'));
    await writeFile(path.join(dir, 'bad.json'), '{not json', 'utf8');
    const output = path.join(dir, 'report.html');

    const result = await generate({
      jsonDir: dir,
      output,
      ignoreBadJsonFile: true,
    });

    const html = await readFile(output, 'utf8');
    expect(html).toContain('Happy HTML reporting');
    expect(result.warnings.some((line) => line.includes('bad.json'))).toBe(true);
  });

  it('uses jsonFile when jsonDir is also set', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');

    const result = await generate({
      jsonFile: legacy,
      jsonDir: dir,
      output,
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('jsonFile and jsonDir are both set'),
      ]),
    );
    await expect(readFile(output, 'utf8')).resolves.toContain(
      'Happy HTML reporting',
    );
  });

  it('refuses to overwrite the jsonFile input', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'same.json');
    await copyFile(legacy, input);
    const before = await readFile(input, 'utf8');

    await expect(generate({ jsonFile: input, output: input })).rejects.toThrow(
      'must not overwrite an input file',
    );
    await expect(readFile(input, 'utf8')).resolves.toBe(before);
  });

  it('refuses to overwrite a file inside jsonDir', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'report.json');
    await copyFile(legacy, input);
    const before = await readFile(input, 'utf8');

    await expect(generate({ jsonDir: dir, output: input })).rejects.toThrow(
      'must not overwrite an input file',
    );
    await expect(readFile(input, 'utf8')).resolves.toBe(before);
  });

  it('skips a JSON file above the size cap before reading it', async () => {
    const dir = await tempDir();
    await copyFile(legacy, path.join(dir, 'happy.json'));
    const huge = path.join(dir, 'huge.json');
    const handle = await open(huge, 'w');
    await handle.truncate(100 * 1024 * 1024 + 1);
    await handle.close();

    const result = await generate({
      jsonDir: dir,
      output: path.join(dir, 'report.html'),
      ignoreBadJsonFile: true,
    });

    expect(result.warnings.some((line) => line.includes('huge.json'))).toBe(
      true,
    );
    await expect(
      readFile(path.join(dir, 'report.html'), 'utf8'),
    ).resolves.toContain('Happy HTML reporting');
  });

  it('enforces the total input cap before reading every file', async () => {
    const dir = await tempDir();
    for (const name of ['first.json', 'second.json']) {
      const handle = await open(path.join(dir, name), 'w');
      await handle.truncate(60 * 1024 * 1024);
      await handle.close();
    }

    await expect(
      generate({
        jsonDir: dir,
        output: path.join(dir, 'report.html'),
        ignoreBadJsonFile: true,
      }),
    ).rejects.toThrow('Inputs exceed 100 MB in total.');
  });

  it('keeps the callback signature', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'callback.html');

    await new Promise<void>((resolve, reject) => {
      void generate({ jsonFile: legacy, output }, (error) => {
        try {
          expect(error).toBeNull();
          resolve();
        } catch (assertion) {
          reject(assertion);
        }
      });
    });

    await expect(readFile(output, 'utf8')).resolves.toContain(
      'Happy HTML reporting',
    );
  });

  it('passes errors to the callback', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'missing.html');

    await new Promise<void>((resolve, reject) => {
      // Intentionally ignore the returned promise: the callback owns errors.
      generate({ output }, (error) => {
        try {
          expect(error).toBeInstanceOf(Error);
          resolve();
        } catch (assertion) {
          reject(assertion);
        }
      });
    });
  });

  it('warns on unsupported metadata values', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'metadata.html');

    const result = await generate({
      jsonFile: legacy,
      output,
      metadata: { Browser: 'Chrome', Nested: { a: 1 } },
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('metadata.Nested'),
      ]),
    );
  });
});
