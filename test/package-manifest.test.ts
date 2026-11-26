import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { packEntries, verifyPackList } from '../scripts/package-check.mjs';

const rootFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'llms.txt',
  'DESIGN.md',
  'SECURITY.md',
  'GLOSSARY.md',
];

const docsFiles = [
  'docs/README.md',
  'docs/AGENT-INTERFACE.md',
  'docs/CI.md',
  'docs/COMPATIBILITY.md',
];

const distFiles = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/cli.js',
  'dist/compat/cucumber-html-reporter.js',
  'dist/compat/cucumber-html-reporter.cjs',
  'dist/compat/cucumber-html-reporter.d.ts',
  'dist/compat/cucumber-html-reporter.d.cts',
];

const packedPaths = [...rootFiles, ...docsFiles, ...distFiles].map(
  (file) => `package/${file}`,
);

const packageJson = {
  files: [
    'dist',
    'README.md',
    'llms.txt',
    'DESIGN.md',
    'LICENSE',
    'SECURITY.md',
    ...docsFiles,
    'GLOSSARY.md',
  ],
};

function packedFiles(paths: string[]): { path: string }[] {
  return paths.map((entry) => ({ path: entry }));
}

function npm10Shape(paths: string[]): { files: { path: string }[] }[] {
  return [{ files: packedFiles(paths) }];
}

function npm12Shape(paths: string[]): {
  tolkira: { files: { path: string }[] };
} {
  return { tolkira: { files: packedFiles(paths) } };
}

describe('pack entries', () => {
  it('reads the npm 10 array shape', () => {
    expect(packEntries(npm10Shape(packedPaths))).toEqual(packedPaths);
  });

  it('reads the npm 12 object shape', () => {
    expect(packEntries(npm12Shape(packedPaths))).toEqual(packedPaths);
  });
});

describe('packed manifest', () => {
  it('accepts a complete tarball list', () => {
    expect(verifyPackList(packedPaths, packageJson)).toEqual([]);
  });

  it('accepts a pack list without the package/ prefix', () => {
    const barePaths = packedPaths.map((entry) =>
      entry.slice('package/'.length),
    );
    expect(verifyPackList(barePaths, packageJson)).toEqual([]);
  });

  it('lists docs/README.md in the real package files', () => {
    const real = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { files?: string[] };
    expect(real.files).toContain('docs/README.md');
  });

  it('fails the npm 12 80-entry list without docs/README.md', () => {
    const fillers = Array.from(
      { length: 63 },
      (_, index) =>
        `package/dist/assets/chunk-${String(index).padStart(2, '0')}.js`,
    );
    const npm12List = [
      ...packedPaths.filter((entry) => entry !== 'package/docs/README.md'),
      ...fillers,
    ];
    expect(npm12List).toHaveLength(80);

    const errors = verifyPackList(
      packEntries(npm12Shape(npm12List)),
      packageJson,
    );

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.includes('docs/README.md'))).toBe(true);
  });

  it('rejects forbidden source, test, script and dependency paths', () => {
    const forbiddenPaths = [
      'package/src/index.ts',
      'package/test/foo.ts',
      'package/openspec/change/proposal.md',
      'package/scripts/x.mjs',
      'package/node_modules/x',
      'package/.github/workflows/ci.yml',
    ];
    for (const forbidden of forbiddenPaths) {
      const relative = forbidden.slice('package/'.length);
      const errors = verifyPackList([...packedPaths, forbidden], packageJson);
      expect(errors.length, forbidden).toBeGreaterThan(0);
      expect(
        errors.some((error) => error.includes(relative)),
        forbidden,
      ).toBe(true);
    }
  });

  it('rejects unexpected paths outside the allowed set', () => {
    const unexpectedPaths = [
      'package/stray.txt',
      'package/coverage/index.html',
      'package/docs/OTHER.md',
    ];
    for (const unexpected of unexpectedPaths) {
      const relative = unexpected.slice('package/'.length);
      const errors = verifyPackList([...packedPaths, unexpected], packageJson);
      expect(
        errors.some(
          (error) =>
            error.includes('unexpected path in tarball') &&
            error.includes(relative),
        ),
        unexpected,
      ).toBe(true);
    }
  });

  it('rejects unsafe tarball paths', () => {
    const unsafePaths = [
      'package/../src/index.ts',
      '../src/index.ts',
      'package/src/../index.ts',
      '/etc/passwd',
      'package//etc/passwd',
      'C:\\temp\\x',
      'package\\src\\index.ts',
    ];
    for (const unsafe of unsafePaths) {
      const errors = verifyPackList([...packedPaths, unsafe], packageJson);
      const named = errors.find((error) => error.includes(unsafe));
      expect(named, unsafe).toBeDefined();
      expect(named, unsafe).toContain('unsafe path in tarball');
    }
  });

  it('does not require a glob entry as a literal path', () => {
    const withGlob = {
      files: ['dist', 'docs/*.md', ...docsFiles, ...rootFiles],
    };
    const errors = verifyPackList(packedPaths, withGlob);
    expect(errors.some((error) => error.includes('docs/*.md'))).toBe(false);
  });

  it('rejects an empty pack list', () => {
    expect(verifyPackList([], packageJson).length).toBeGreaterThan(0);
  });
});
