import { exec as execShell, execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

// Harness assumption: `npm run build` has produced dist/ before this file runs.
// `check` must build before the unit tests so the CJS fixture resolves the
// package through its published exports (tasks.md 2.3).
const fixture = fileURLToPath(
  new URL('./fixtures/cjs/compat-fixture.cjs', import.meta.url),
);
const esmFixture = fileURLToPath(
  new URL('./fixtures/esm/compat-fixture.mjs', import.meta.url),
);
const tsc = fileURLToPath(
  new URL('../node_modules/typescript/bin/tsc', import.meta.url),
);
const typesProject = fileURLToPath(
  new URL('./fixtures/cjs-types/tsconfig.json', import.meta.url),
);
const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const distIndex = path.join(repoRoot, 'dist', 'index.js');
const distShim = path.join(
  repoRoot,
  'dist',
  'compat',
  'cucumber-html-reporter.js',
);

interface FixtureError {
  name?: string;
  message?: string;
  code?: string;
  isError: boolean;
}

interface FixturePayload {
  result?: {
    output: string;
    warnings: string[];
    summary: {
      schemaVersion: number;
      counts: { steps: { total: number } };
    };
  };
  html?: string;
  generate?: string;
  default?: unknown;
  hasDefault?: boolean;
  callbacks?: number;
  callbackError?: FixtureError | null;
  resolved?: boolean;
  error?: FixtureError;
  loaded?: boolean;
  outputIsDirectory?: boolean;
  entries?: string[];
  shape?: { generate: string; hasDefault: boolean };
}

const tempDirs: string[] = [];

beforeAll(() => {
  if (!existsSync(distIndex)) {
    throw new Error(
      'dist/ is missing; run `npm run build` before `npm test`',
    );
  }
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-cjs-'));
  tempDirs.push(dir);
  return dir;
}

function exec(
  script: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [script, ...args],
      { cwd: repoRoot, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

function execCommand(
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execShell(
      command,
      { cwd: repoRoot, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

async function runFixture(args: string[]): Promise<FixturePayload> {
  const { stdout } = await exec(fixture, args);
  return JSON.parse(stdout) as FixturePayload;
}

describe('compat subpath from CommonJS', () => {
  it('requires the subpath and generates a legacy report', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'cjs.html');

    const payload = await runFixture(['success', legacy, output]);

    expect(payload.result?.output).toBe(output);
    expect(payload.result?.warnings).toEqual(expect.any(Array));
    expect(payload.result?.summary.schemaVersion).toBe(2);
    expect(payload.result?.summary.counts.steps.total).toBe(30);
    expect(payload.html).toContain('Happy HTML reporting');
    expect(payload.html).toContain('class="hook"');
  });

  it('forwards the legacy callback and still resolves the promise', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'callback.html');

    const payload = await runFixture(['callback', legacy, output]);

    expect(payload.callbacks).toBe(1);
    expect(payload.callbackError).toBeNull();
    expect(payload.result?.summary.schemaVersion).toBe(2);
    expect(payload.html).toContain('Happy HTML reporting');
  });

  it('rejects a report without inputs', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'missing.html');

    const payload = await runFixture(['reject', legacy, output]);

    expect(payload.resolved).toBe(false);
    expect(payload.error).toMatchObject({
      isError: true,
      message: 'compat: jsonFile or jsonDir is required',
    });
  });

  it('passes the same error to the callback and the promise', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'callback-error.html');

    const payload = await runFixture(['callback-error', legacy, output]);

    expect(payload.callbackError?.message).toBe(payload.error?.message);
    expect(payload.resolved).toBe(false);
    expect(payload.error).toMatchObject({
      isError: true,
      message: 'compat: jsonFile or jsonDir is required',
    });
  });

  it('does not raise an unhandled rejection for callback-only errors', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'callback-only.html');

    const { stdout, stderr } = await exec(fixture, [
      'callback-only-error',
      legacy,
      output,
    ]);
    const payload = JSON.parse(stdout) as FixturePayload;

    expect(payload.callbacks).toBe(1);
    expect(payload.callbackError?.message).toBe(
      'compat: jsonFile or jsonDir is required',
    );
    expect(stderr).not.toMatch(/unhandled/i);
  });

  it('rejects a report that cannot be written and leaves no partial file', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    await mkdir(output);

    const payload = await runFixture(['write-error', legacy, output]);

    expect(payload.resolved).toBe(false);
    expect(payload.error?.isError).toBe(true);
    expect(payload.outputIsDirectory).toBe(true);
    expect(payload.entries).toEqual(['report.html']);
  });

  it('exposes no default export', async () => {
    const payload = await runFixture(['shape']);

    expect(payload.generate).toBe('function');
    expect(payload.hasDefault).toBe(false);
    expect(payload.default).toBeUndefined();
  });

  it('keeps the package root ESM-only', async () => {
    const payload = await runFixture(['root']);

    expect(payload.loaded).toBe(false);
    expect(payload.error?.code).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });

  it('type-checks the require path with the CJS declarations under NodeNext', async () => {
    const { stdout } = await exec(tsc, [
      '--project',
      typesProject,
      '--pretty',
      'false',
      '--traceResolution',
    ]);
    const resolved = stdout
      .split(/\r?\n/)
      .find(
        (line) =>
          line.includes('cucumber-html-reporter') &&
          line.includes('successfully resolved to'),
      );

    expect(resolved).toContain('cucumber-html-reporter.d.cts');
  });
});

describe('compat subpath from ESM', () => {
  it('loads through the package self-reference', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'esm.html');

    const { stdout } = await exec(esmFixture, [legacy, output]);
    const payload = JSON.parse(stdout) as FixturePayload;

    expect(payload.shape).toEqual({ generate: 'function', hasDefault: false });
    expect(payload.result?.output).toBe(output);
    expect(payload.result?.summary.schemaVersion).toBe(2);
    expect(payload.result?.summary.counts.steps.total).toBe(30);
    expect(payload.html).toContain('Happy HTML reporting');
  });
});

describe('compat package build', () => {
  it('keeps the esbuild bundles in dist', async () => {
    expect(statSync(distIndex).size).toBeGreaterThan(50_000);
    expect(statSync(distShim).size).toBeGreaterThan(3_000);

    const indexSource = await readFile(distIndex, 'utf8');
    expect(indexSource).not.toContain("from './summary.js'");
    expect(indexSource).not.toContain('from "./summary.js"');
    expect(indexSource).not.toContain("from './input/load.js'");
    expect(indexSource).not.toContain('from "./input/load.js"');

    const shimSource = await readFile(distShim, 'utf8');
    expect(shimSource).not.toContain("from './options.js'");
    expect(shimSource).not.toContain('from "./options.js"');
  });

  it('packs the CJS wrapper, declarations and bundles', async () => {
    const packDir = await mkdtemp(path.join(tmpdir(), 'tolkira-pack-'));
    try {
      const { stdout } = await execCommand(
        `npm pack --json --pack-destination "${packDir}"`,
      );
      const parsed = JSON.parse(stdout) as
        | Array<{ filename?: string }>
        | { filename?: string };
      const packed = Array.isArray(parsed) ? parsed[0] : parsed;
      expect(packed?.filename).toBeTruthy();
      if (!packed?.filename) return;

      const { stdout: listing } = await execCommand(
        `tar -tf "${path.join(packDir, packed.filename)}"`,
      );
      const files = listing
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^package\//, ''))
        .filter(Boolean);

      expect(files).toEqual(
        expect.arrayContaining([
          'dist/index.js',
          'dist/compat/cucumber-html-reporter.js',
          'dist/compat/cucumber-html-reporter.cjs',
          'dist/compat/cucumber-html-reporter.d.cts',
        ]),
      );
      expect(files.some((file) => file.startsWith('src/'))).toBe(false);
    } finally {
      await rm(packDir, { recursive: true, force: true });
    }
  });
});
