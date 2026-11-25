import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SPAWN_TIMEOUT_MS = 30_000;
// Above the spawn timeout so a hung child surfaces as the spawn error.
const TEST_TIMEOUT_MS = 40_000;

interface PackageJson {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ClientTsConfig {
  extends?: string;
  compilerOptions?: Record<string, unknown>;
  include?: string[];
}

interface LintOverride {
  files?: string[];
  rules?: Record<string, string>;
}

interface LintConfig {
  plugins?: string[];
  categories?: Record<string, string>;
  rules?: Record<string, unknown>;
  overrides?: LintOverride[];
  ignorePatterns?: string[];
}

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error: Error | undefined;
}

function readJson<T>(relativePath: string): T {
  const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');
  return JSON.parse(source) as T;
}

function readText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function packageBin(name: string, binary = name): string {
  const pkg = readJson<{ bin?: string | Record<string, string> }>(
    path.join('node_modules', name, 'package.json'),
  );
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[binary];
  if (bin === undefined) {
    throw new Error(`${name} declares no ${binary} binary`);
  }
  return path.join(repoRoot, 'node_modules', name, bin);
}

// A nested Vitest run must not inherit the parent run's worker identity.
const childEnv: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(childEnv)) {
  if (key.startsWith('VITEST_') || key === 'NODE_V8_COVERAGE') {
    delete childEnv[key];
  }
}

function run(script: string, args: string[], cwd = repoRoot): RunResult {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
    env: childEnv,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function output(result: RunResult): string {
  return `${result.stdout}\n${result.stderr}`;
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

let probeRoot = '';

beforeAll(() => {
  probeRoot = mkdtempSync(path.join(os.tmpdir(), 'tolkira-tooling-'));
});

afterAll(() => {
  if (probeRoot.length > 0) {
    rmSync(probeRoot, { recursive: true, force: true });
  }
});

function makeProbeDirectory(name: string): string {
  const directory = path.join(probeRoot, name);
  mkdirSync(directory, { recursive: true });
  writeJson(path.join(directory, 'package.json'), {
    private: true,
    type: 'module',
  });
  return directory;
}

describe('strict typecheck', () => {
  it('enables strict mode and the six added flags', () => {
    const config = readJson<{ compilerOptions?: Record<string, unknown> }>(
      'tsconfig.json',
    );
    const options = config.compilerOptions ?? {};
    expect(options['strict']).toBe(true);
    for (const flag of [
      'noUncheckedIndexedAccess',
      'exactOptionalPropertyTypes',
      'noImplicitOverride',
      'noUnusedLocals',
      'noUnusedParameters',
      'noImplicitReturns',
    ]) {
      expect(options[flag]).toBe(true);
    }
  });

  it('runs the server and client typecheck programs', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    expect(scripts['typecheck']).toBe(
      'tsc --noEmit && tsc --noEmit -p tsconfig.client.json',
    );
  });

  it('defines a client program without Node types', () => {
    const config = readJson<ClientTsConfig>('tsconfig.client.json');
    expect(config.extends).toBe('./tsconfig.json');
    const options = config.compilerOptions ?? {};
    expect(options['types']).toEqual([]);
    expect(options['lib']).toEqual(['ES2022', 'DOM']);
  });

  it('lists exactly the five browser graph files', () => {
    const config = readJson<ClientTsConfig>('tsconfig.client.json');
    const expected = [
      'src/render/client-i18n.ts',
      'src/render/dom-contract.ts',
      'src/render/report-client.ts',
      'src/render/search.ts',
      'src/report/status.ts',
    ];
    expect([...(config.include ?? [])].sort()).toEqual(expected.sort());
  });
});

describe('curated lint', () => {
  it('retains and extends the ignore patterns', () => {
    const config = readJson<LintConfig>('.oxlintrc.json');
    const patterns = config.ignorePatterns ?? [];
    for (const pattern of [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.opencode/**',
      'coverage/**',
      '.openchamber/**',
    ]) {
      expect(patterns).toContain(pattern);
    }
  });

  it('loads the seven curated plugins', () => {
    const config = readJson<LintConfig>('.oxlintrc.json');
    const expected = [
      'import',
      'node',
      'oxc',
      'promise',
      'typescript',
      'unicorn',
      'vitest',
    ];
    expect([...(config.plugins ?? [])].sort()).toEqual(expected);
  });

  it('sets correctness to error and suspicious and perf to warning', () => {
    const categories =
      readJson<LintConfig>('.oxlintrc.json').categories ?? {};
    expect(categories['correctness']).toBe('error');
    expect(categories['suspicious']).toBe('warn');
    expect(categories['perf']).toBe('warn');
  });

  it('configures the documented rule exceptions', () => {
    const rules = readJson<LintConfig>('.oxlintrc.json').rules ?? {};
    expect(rules['vitest/valid-expect']).toEqual([
      'error',
      { maxArgs: 2 },
    ]);
    const expectExpect = rules['vitest/expect-expect'] as
      | [string, { assertFunctionNames?: string[] }]
      | undefined;
    expect(expectExpect?.[0]).toBe('error');
    expect(
      [...(expectExpect?.[1]?.assertFunctionNames ?? [])].sort(),
    ).toEqual([
      'expect',
      'expectNoSidecar',
      'expectRejectedTarget',
      'expectStep',
      'validatePair',
    ]);
    const underscore = rules['eslint/no-underscore-dangle'] as
      | [string, { allow?: string[] }]
      | undefined;
    expect(underscore?.[0]).toBe('warn');
    expect([...(underscore?.[1]?.allow ?? [])].sort()).toEqual([
      '__tolkiraCopied',
      '__tolkiraXss',
    ]);
    for (const rule of [
      'eslint/no-await-in-loop',
      'unicorn/no-array-sort',
      'unicorn/consistent-function-scoping',
      'unicorn/prefer-set-has',
      'oxc/no-map-spread',
      'vitest/no-conditional-expect',
    ]) {
      expect(rules[rule]).toBe('off');
    }
  });

  it('scopes the callback and shadow exceptions per file', () => {
    const overrides = readJson<LintConfig>('.oxlintrc.json').overrides ?? [];
    expect(overrides).toHaveLength(2);

    const callback = overrides.find((entry) =>
      entry.files?.includes('src/stream.ts'),
    );
    expect([...(callback?.files ?? [])].sort()).toEqual([
      'src/compat/cucumber-html-reporter.ts',
      'src/stream.ts',
    ]);
    expect(callback?.rules).toEqual({
      'promise/no-callback-in-promise': 'off',
    });

    const shadow = overrides.find((entry) =>
      entry.files?.includes('src/compat/cucumber-html-reporter.cts'),
    );
    expect(shadow?.files).toEqual(['src/compat/cucumber-html-reporter.cts']);
    expect(shadow?.rules).toEqual({ 'eslint/no-shadow': 'off' });
  });

  it('runs lint at zero warnings', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    expect(scripts['lint']).toBe('oxlint --max-warnings=0 .');
  });
});

describe('format gate', () => {
  it('pins the formatter style', () => {
    const config = readJson<Record<string, unknown>>('.prettierrc.json');
    expect(config['singleQuote']).toBe(true);
    expect(config['printWidth']).toBe(80);
  });

  it('ignores generated, golden and tool output', () => {
    const entries = readText('.prettierignore')
      .split(/\r?\n/)
      .map((entry) => entry.trim().replace(/\/$/, ''))
      .filter((entry) => entry.length > 0);
    for (const entry of [
      'node_modules',
      'dist',
      'coverage',
      'playwright-report',
      'blob-report',
      'test-results',
      'playwright/.cache',
      '.openchamber',
      '.opencode',
      '.tmp',
      '.cache',
      'openspec',
      'test/fixtures',
      'docs/comparison',
      'docs/ui-loop',
      'package-lock.json',
      '*.tgz',
      '*.png',
      '*.webm',
      'src/render/client-bundle.ts',
      'src/render/styles.ts',
      'src/i18n/catalogs.ts',
      'src/render/report.css',
      'src/render/baseline.css',
      '*.md',
    ]) {
      expect(entries).toContain(entry);
    }
  });

  it('enforces LF checkout with fixture precedence', () => {
    const lines = readText('.gitattributes')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect(lines[0]).toBe('* text=auto eol=lf');
    expect(lines).toContain('test/fixtures/** text eol=lf');
    expect(lines).toContain('test/fixtures/**/*.png binary');
    expect(lines.indexOf('test/fixtures/** text eol=lf')).toBeGreaterThan(0);
  });

  it('exposes format:check and format scripts', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    expect(scripts['format:check']).toBe('prettier --check .');
    expect(scripts['format']).toBe('prettier --write .');
  });

  it('runs format:check before build in the check gate', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    const steps = (scripts['check'] ?? '')
      .split(' && ')
      .map((step) => step.trim());
    const formatIndex = steps.indexOf('npm run format:check');
    const buildIndex = steps.indexOf('npm run build');
    expect(formatIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(formatIndex);
    expect(steps.at(-1)).toBe('npm run test:coverage');
  });
});

describe('coverage floor', () => {
  it('removes the empty-suite escape hatch', () => {
    expect(readText('vitest.config.ts')).not.toContain('passWithNoTests');
  });

  it('collects v8 coverage over the source tree', () => {
    const config = readText('vitest.config.ts');
    expect(config).toMatch(/provider:\s*['"]v8['"]/);
    expect(config).toMatch(/include:\s*\[\s*['"]src\/\*\*\/\*\.ts['"]\s*\]/);
    expect(config).toMatch(
      /exclude:\s*\[\s*['"]src\/render\/report-client\.ts['"]\s*\]/,
    );
  });

  it('enforces the 93/86/95/95 floor', () => {
    const config = readText('vitest.config.ts');
    const thresholds = [
      ['statements', 93],
      ['branches', 86],
      ['functions', 95],
      ['lines', 95],
    ] as const;
    for (const [metric, value] of thresholds) {
      expect(config).toMatch(new RegExp(`${metric}:\\s*${value}\\b`));
    }
  });

  it('runs coverage through the test:coverage script', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    expect(scripts['test:coverage']).toBe('vitest run --coverage');
  });
});

describe('dev dependency pins', () => {
  it('pins oxlint, prettier and the coverage provider exactly', () => {
    const devDependencies =
      readJson<PackageJson>('package.json').devDependencies ?? {};
    const pins = [
      ['oxlint', '1.94.0'],
      ['prettier', '3.10.1'],
      ['@vitest/coverage-v8', '5.1.1'],
    ] as const;
    for (const [name, version] of pins) {
      expect(devDependencies[name], name).toBe(version);
    }
  });
});

describe('strict typecheck probe', () => {
  it(
    'fails TS18048 on an unguarded index read and passes the guarded copy',
    () => {
      const directory = makeProbeDirectory('strict');
      writeFileSync(
        path.join(directory, 'bad.ts'),
        [
          'export function firstUpper(values: string[]): string {',
          '  const first = values[0];',
          '  return first.toUpperCase();',
          '}',
          '',
        ].join('\n'),
        'utf8',
      );
      writeFileSync(
        path.join(directory, 'good.ts'),
        [
          'export function firstUpper(values: string[]): string {',
          "  return values[0]?.toUpperCase() ?? '';",
          '}',
          '',
        ].join('\n'),
        'utf8',
      );
      const baseConfig = {
        extends: toPosix(path.join(repoRoot, 'tsconfig.json')),
        compilerOptions: { types: [], noEmit: true },
        include: [],
      };
      const badConfig = path.join(directory, 'tsconfig.bad.json');
      const goodConfig = path.join(directory, 'tsconfig.good.json');
      writeJson(badConfig, { ...baseConfig, files: ['bad.ts'] });
      writeJson(goodConfig, { ...baseConfig, files: ['good.ts'] });

      const typescript = packageBin('typescript', 'tsc');
      const bad = run(typescript, ['-p', badConfig], directory);
      expect(bad.error).toBeUndefined();
      expect(bad.status).not.toBe(0);
      expect(output(bad)).toMatch(/error TS18048/);

      const good = run(typescript, ['-p', goodConfig], directory);
      expect(good.error).toBeUndefined();
      expect(good.status).toBe(0);
      expect(output(good)).not.toMatch(/error TS/);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('client program probe', () => {
  it(
    'fails TS2591 on process and passes a DOM-only module',
    () => {
      const directory = makeProbeDirectory('client');
      writeFileSync(
        path.join(directory, 'bad.ts'),
        [
          'export function readFlag(): string {',
          "  return process.env.FLAG ?? '';",
          '}',
          '',
        ].join('\n'),
        'utf8',
      );
      writeFileSync(
        path.join(directory, 'good.ts'),
        [
          'export function readFlag(): string {',
          '  return document.documentElement.lang;',
          '}',
          '',
        ].join('\n'),
        'utf8',
      );
      const browserFiles = [
        'src/render/report-client.ts',
        'src/render/client-i18n.ts',
        'src/render/dom-contract.ts',
        'src/render/search.ts',
        'src/report/status.ts',
      ].map((file) => toPosix(path.join(repoRoot, file)));
      const baseConfig = {
        extends: toPosix(path.join(repoRoot, 'tsconfig.client.json')),
        compilerOptions: { noEmit: true },
        include: [],
      };
      const badConfig = path.join(directory, 'tsconfig.bad.json');
      const goodConfig = path.join(directory, 'tsconfig.good.json');
      writeJson(badConfig, {
        ...baseConfig,
        files: [...browserFiles, 'bad.ts'],
      });
      writeJson(goodConfig, {
        ...baseConfig,
        files: [...browserFiles, 'good.ts'],
      });

      const typescript = packageBin('typescript', 'tsc');
      const bad = run(typescript, ['-p', badConfig], directory);
      expect(bad.error).toBeUndefined();
      expect(bad.status).not.toBe(0);
      expect(output(bad)).toMatch(/error TS2591/);

      const good = run(typescript, ['-p', goodConfig], directory);
      expect(good.error).toBeUndefined();
      expect(good.status).toBe(0);
      expect(output(good)).not.toMatch(/error TS/);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('lint warning probe', () => {
  it(
    'treats one no-shadow warning as a failure only under --max-warnings=0',
    () => {
      const directory = makeProbeDirectory('lint');
      const shadow = path.join(directory, 'shadow.ts');
      const clean = path.join(directory, 'clean.ts');
      writeFileSync(
        shadow,
        [
          'export function label(value: string): string {',
          '  const items = [value];',
          "  return items.map((value) => value).join('');",
          '}',
          '',
        ].join('\n'),
        'utf8',
      );
      writeFileSync(
        clean,
        [
          'export function label(value: string): string {',
          '  const items = [value];',
          "  return items.map((item) => item).join('');",
          '}',
          '',
        ].join('\n'),
        'utf8',
      );

      const oxlint = packageBin('oxlint');
      const config = path.join(repoRoot, '.oxlintrc.json');
      const lint = (file: string, strict: boolean): RunResult => {
        const flags = strict ? ['--max-warnings=0'] : [];
        return run(oxlint, [...flags, '--config', config, file]);
      };

      const plainShadow = lint(shadow, false);
      expect(plainShadow.error).toBeUndefined();
      expect(plainShadow.status).toBe(0);
      expect(
        output(plainShadow)
          .split(/\r?\n/)
          .filter((line) => line.includes('no-shadow')),
      ).toHaveLength(1);

      const strictShadow = lint(shadow, true);
      expect(strictShadow.error).toBeUndefined();
      expect(strictShadow.status).not.toBe(0);
      expect(output(strictShadow)).toMatch(/no-shadow/);

      const plainClean = lint(clean, false);
      expect(plainClean.error).toBeUndefined();
      expect(plainClean.status).toBe(0);

      const strictClean = lint(clean, true);
      expect(strictClean.error).toBeUndefined();
      expect(strictClean.status).toBe(0);
      expect(output(strictClean)).not.toMatch(/no-shadow/);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('format check probe', () => {
  it(
    'fails an unformatted copy and passes a formatted copy',
    () => {
      const directory = makeProbeDirectory('format');
      const unformatted = path.join(directory, 'unformatted.ts');
      const formatted = path.join(directory, 'formatted.ts');
      writeFileSync(
        unformatted,
        'export const probe={alpha:1,beta:2,gamma:"short"};\n',
        'utf8',
      );
      writeFileSync(
        formatted,
        "export const probe = { alpha: 1, beta: 2, gamma: 'short' };\n",
        'utf8',
      );

      const prettier = packageBin('prettier');
      const config = path.join(repoRoot, '.prettierrc.json');
      const check = (file: string): RunResult =>
        run(prettier, ['--check', file, '--config', config], directory);

      const bad = check(unformatted);
      expect(bad.error).toBeUndefined();
      expect(bad.status).not.toBe(0);
      expect(output(bad)).toMatch(/unformatted\.ts/);

      const good = check(formatted);
      expect(good.error).toBeUndefined();
      expect(good.status).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('empty selection probe', () => {
  it(
    'fails an empty selection and passes one matching test',
    () => {
      const vitest = packageBin('vitest');
      const empty = run(
        vitest,
        ['run', 'test/__tolkira_missing_probe__.test.ts'],
        repoRoot,
      );
      expect(empty.error).toBeUndefined();
      expect(empty.status).not.toBe(0);

      const matched = run(vitest, ['run', 'test/smoke.test.ts'], repoRoot);
      expect(matched.error).toBeUndefined();
      expect(matched.status).toBe(0);
      expect(output(matched)).toMatch(/1 passed/);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('coverage threshold probe', () => {
  it(
    'fails a zero-percent control and passes a measured file at 100 lines',
    () => {
      const directory = makeProbeDirectory('coverage');
      writeFileSync(
        path.join(directory, 'measured.ts'),
        [
          'export function twice(value: number): number {',
          '  return value * 2;',
          '}',
          '',
        ].join('\n'),
        'utf8',
      );
      writeFileSync(
        path.join(directory, 'control.test.ts'),
        ["it('control', () => {", '  expect(1).toBe(1);', '});', ''].join(
          '\n',
        ),
        'utf8',
      );
      writeFileSync(
        path.join(directory, 'measured.test.ts'),
        [
          "import { twice } from './measured.ts';",
          '',
          "it('doubles', () => {",
          '  expect(twice(2)).toBe(4);',
          '});',
          '',
        ].join('\n'),
        'utf8',
      );
      const config = path.join(directory, 'vitest.config.mjs');
      writeFileSync(
        config,
        [
          'export default {',
          `  root: '${toPosix(directory)}',`,
          "  test: { include: ['*.test.ts'], environment: 'node', globals: true },",
          "  coverage: { provider: 'v8', include: ['measured.ts'], reporter: ['text-summary'] },",
          '};',
          '',
        ].join('\n'),
        'utf8',
      );

      const vitest = packageBin('vitest');
      const coverage = (testFile: string): RunResult =>
        run(
          vitest,
          [
            'run',
            '--config',
            config,
            '--coverage',
            '--coverage.thresholds.lines=100',
            testFile,
          ],
          directory,
        );

      const control = coverage('control.test.ts');
      expect(control.error).toBeUndefined();
      expect(control.status).not.toBe(0);

      const measured = coverage('measured.test.ts');
      expect(measured.error).toBeUndefined();
      expect(measured.status).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
