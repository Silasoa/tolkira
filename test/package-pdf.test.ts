import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function read(file: string): string {
  return readFileSync(path.join(repoRoot, file), 'utf8');
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

interface PackageLock {
  packages: Record<
    string,
    {
      version?: string;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    }
  >;
}

describe('PDF package metadata', () => {
  it('adds playwright-core as an optional peer and playwright as a dev engine', () => {
    const pkg = JSON.parse(read('package.json')) as PackageJson;

    expect(pkg.peerDependencies?.['playwright-core']).toBe('^1.65.0');
    expect(pkg.peerDependenciesMeta?.['playwright-core']).toEqual({
      optional: true,
    });
    expect(pkg.devDependencies?.playwright).toBe('^1.65.0');
  });

  it('keeps the default runtime dependency surface at three packages', () => {
    const pkg = JSON.parse(read('package.json')) as PackageJson;

    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([
      '@cucumber/messages',
      'fast-xml-parser',
      'markdown-it',
    ]);
    expect(pkg.optionalDependencies).toBeUndefined();
  });

  it('updates the lockfile with the peer, peer metadata and aligned engines', () => {
    const lock = JSON.parse(read('package-lock.json')) as PackageLock;
    const root = lock.packages[''];

    expect(root?.peerDependencies?.['playwright-core']).toBe('^1.65.0');
    expect(root?.peerDependenciesMeta?.['playwright-core']).toEqual({
      optional: true,
    });
    expect(root?.devDependencies?.playwright).toBe('^1.65.0');

    const engine = lock.packages['node_modules/playwright']?.version;
    const core = lock.packages['node_modules/playwright-core']?.version;
    const testRunner = lock.packages['node_modules/@playwright/test']?.version;
    expect(engine).toMatch(/^1\.65\./);
    expect(core).toBe(engine);
    expect(testRunner).toBe(engine);
  });

  it('marks playwright-core external in the shared esbuild config', () => {
    const source = read('esbuild.mjs');
    const shared = source.slice(0, source.indexOf('await build'));

    expect(shared).toMatch(/['"]playwright-core['"]/);
    expect(shared).toMatch(/external/);
  });

  it('keeps the peer type out of the emitted declarations', () => {
    const declaration = read('dist/index.d.ts');

    expect(declaration).toContain('renderPdf');
    expect(declaration).not.toContain('playwright-core');
  });

  it('runs a missing-engine --pdf smoke in the package job', () => {
    const workflow = read('.github/workflows/ci.yml');
    const start = workflow.indexOf('\n  package:');
    const end = workflow.indexOf('\n  e2e:');
    expect(start, 'package job').toBeGreaterThanOrEqual(0);
    expect(end, 'package job end').toBeGreaterThan(start);
    const packageJob = workflow.slice(start, end);

    expect(packageJob).toContain('--pdf');
    expect(packageJob).toMatch(/exit 1|!\s*-[es]\s|expected/i);
  });
});
