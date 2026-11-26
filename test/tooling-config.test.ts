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

interface FormatConfig {
  printWidth?: number;
  singleQuote?: boolean;
  sortImports?: boolean;
  sortPackageJson?: boolean;
  ignorePatterns?: string[];
}

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error: Error | undefined;
}

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- callers declare the parsed shape; the helper cannot infer it
function readJson<T>(relativePath: string): T {
  const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');
  return JSON.parse(source) as T;
}

function readText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function trackedSourceFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '-z', '--', 'src', 'test'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return (result.stdout ?? '')
    .split('\0')
    .filter((file) => /\.(?:ts|cts|mts)$/.test(file));
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

function writeProbeTsConfig(directory: string, include: string[]): void {
  writeJson(path.join(directory, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noEmit: true,
      types: [],
    },
    include,
  });
}

describe('strict typecheck', () => {
  it('enables strict mode and the eleven compiler checks', () => {
    const config = readJson<{ compilerOptions?: Record<string, unknown> }>(
      'tsconfig.json',
    );
    const options = config.compilerOptions ?? {};
    const checks = [
      ['strict', true],
      ['noUncheckedIndexedAccess', true],
      ['exactOptionalPropertyTypes', true],
      ['noImplicitOverride', true],
      ['noUnusedLocals', true],
      ['noUnusedParameters', true],
      ['noImplicitReturns', true],
      ['noUncheckedSideEffectImports', true],
      ['noFallthroughCasesInSwitch', true],
      ['allowUnreachableCode', false],
      ['allowUnusedLabels', false],
      ['isolatedModules', true],
    ] as const;
    for (const [flag, value] of checks) {
      expect(options[flag]).toBe(value);
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

  it('loads the seven plugins', () => {
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

  it('sets correctness to error and the other categories to warning', () => {
    const categories = readJson<LintConfig>('.oxlintrc.json').categories ?? {};
    expect(categories['correctness']).toBe('error');
    expect(categories['suspicious']).toBe('warn');
    expect(categories['perf']).toBe('warn');
    expect(categories['pedantic']).toBe('warn');
  });

  it('configures the documented rule exceptions', () => {
    const rules = readJson<LintConfig>('.oxlintrc.json').rules ?? {};
    expect(rules['vitest/valid-expect']).toEqual(['error', { maxArgs: 2 }]);
    const expectExpect = rules['vitest/expect-expect'] as
      | [string, { assertFunctionNames?: string[] }]
      | undefined;
    expect(expectExpect?.[0]).toBe('error');
    expect([...(expectExpect?.[1]?.assertFunctionNames ?? [])].sort()).toEqual([
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
      'eslint/no-redeclare',
      'eslint/no-promise-executor-return',
      'eslint/eqeqeq',
    ]) {
      expect(rules[rule]).toBe('warn');
    }
  });

  it('disables the documented threshold, preference and deliberate rules', () => {
    const rules = readJson<LintConfig>('.oxlintrc.json').rules ?? {};
    const offRules = [
      'eslint/max-lines',
      'eslint/max-lines-per-function',
      'eslint/max-depth',
      'eslint/max-statements',
      'import/max-dependencies',
      'eslint/require-unicode-regexp',
      'unicorn/escape-case',
      'unicorn/no-useless-undefined',
      'eslint/no-negated-condition',
      'unicorn/no-negated-condition',
      'unicorn/explicit-length-check',
      'unicorn/prefer-dom-node-dataset',
      'unicorn/prefer-query-selector',
      'unicorn/prefer-single-call',
      'unicorn/prefer-top-level-await',
      'unicorn/prefer-at',
      'unicorn/no-hex-escape',
      'unicorn/prefer-dom-node-append',
      'unicorn/prefer-import-meta-properties',
      'eslint/no-await-in-loop',
      'vitest/no-conditional-in-test',
      'unicorn/no-array-sort',
      'unicorn/consistent-function-scoping',
      'vitest/no-conditional-expect',
      'oxc/no-map-spread',
      'unicorn/prefer-set-has',
      'typescript/prefer-readonly-parameter-types',
      'typescript/strict-boolean-expressions',
      'typescript/no-unsafe-member-access',
      'typescript/no-unsafe-assignment',
      'typescript/no-unsafe-call',
      'typescript/no-unsafe-return',
      'typescript/no-unsafe-argument',
      'typescript/prefer-nullish-coalescing',
      'typescript/no-confusing-void-expression',
      'typescript/switch-exhaustiveness-check',
      'typescript/no-deprecated',
      'typescript/prefer-promise-reject-errors',
      'typescript/strict-void-return',
      'typescript/require-await',
    ];
    for (const rule of offRules) {
      expect(rules[rule], rule).toBe('off');
    }
    const configured = Object.entries(rules)
      .filter(([, value]) => value === 'off')
      .map(([rule]) => rule)
      .sort();
    expect(configured).toEqual([...offRules].sort());
    expect(rules).not.toHaveProperty('eslint/require-await');
  });

  it('scopes exactly the four documented per-file exceptions', () => {
    const overrides = readJson<LintConfig>('.oxlintrc.json').overrides ?? [];
    const expected: LintOverride[] = [
      {
        files: ['test/**'],
        rules: {
          'typescript/no-unsafe-type-assertion': 'off',
          'eslint/require-await': 'off',
        },
      },
      {
        files: ['src/stream.ts', 'src/compat/cucumber-html-reporter.ts'],
        rules: { 'promise/no-callback-in-promise': 'off' },
      },
      {
        files: ['src/compat/cucumber-html-reporter.cts'],
        rules: { 'eslint/no-shadow': 'off' },
      },
      {
        files: ['src/render/html.ts'],
        rules: { 'eslint/require-await': 'off' },
      },
    ];
    const normalize = (entries: LintOverride[]): string[] =>
      entries
        .map((entry) =>
          JSON.stringify({
            files: [...(entry.files ?? [])].sort(),
            rules: Object.entries(entry.rules ?? {})
              .sort(([left], [right]) => (left < right ? -1 : 1))
              .map(([rule, value]) => `${rule}: ${value}`),
          }),
        )
        .sort();
    expect(normalize(overrides)).toEqual(normalize(expected));
  });

  it('runs lint type-aware at zero warnings', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    expect(scripts['lint']).toBe('oxlint --type-aware --max-warnings=0 .');
  });
});

describe('lint suppressions', () => {
  it('keeps every suppression inline with a reason and pins the map', () => {
    const fileLevel = /^\s*(?:\/\/|\/\*)\s*(?:eslint|oxlint)-disable(?![-\w])/;
    const inlineDirective =
      /^\s*(?:\/\/|\/\*)\s*(?:eslint|oxlint)-disable-(?:next-line|line)\b/;
    const pinned =
      /^\s*\/\/ (?:eslint|oxlint)-disable-(?:next-line|line) (\S+) -- \S/;
    const found: string[] = [];
    for (const file of trackedSourceFiles()) {
      const lines = readText(file).split(/\r?\n/);
      lines.forEach((line, index) => {
        const where = `${file}:${index + 1}`;
        expect(line, where).not.toMatch(fileLevel);
        if (!inlineDirective.test(line)) return;
        expect(line, where).toMatch(pinned);
        const rule = pinned.exec(line)?.[1];
        if (rule !== undefined) found.push(`${file} ${rule}`);
      });
    }
    expect(found.sort()).toEqual(
      [
        'src/compat/cucumber-html-reporter.cts eslint/no-redeclare',
        'src/render/client-i18n.ts typescript/no-unnecessary-type-conversion',
        'src/render/client-i18n.ts unicorn/prefer-string-replace-all',
        'src/render/client-i18n.ts unicorn/prefer-string-replace-all',
        'src/render/client-i18n.ts unicorn/prefer-string-replace-all',
        'src/render/dom-contract.ts typescript/no-unsafe-type-assertion',
        'src/render/report-client.ts eslint/no-inner-declarations',
        'src/render/report-client.ts eslint/no-inner-declarations',
        'src/render/report-client.ts eslint/no-loop-func',
        'src/render/report-client.ts typescript/no-unsafe-type-assertion',
        'src/render/report-client.ts typescript/no-unsafe-type-assertion',
        'src/render/report-client.ts typescript/no-unsafe-type-assertion',
        'src/render/report-client.ts typescript/no-unsafe-type-assertion',
        'src/render/report-client.ts typescript/no-unsafe-type-assertion',
        'src/render/report-client.ts unicorn/prefer-string-replace-all',
        'src/text.ts no-control-regex',
        'src/text.ts no-control-regex',
        'test/ansi-stripping.test.ts no-control-regex',
        'test/e2e/attachments.spec.ts unicorn/prefer-number-coercion',
        'test/e2e/attachments.spec.ts unicorn/prefer-number-coercion',
        'test/e2e/clipboard.spec.ts no-control-regex',
        'test/e2e/helpers.ts unicorn/prefer-code-point',
        'test/e2e/size-diagnostics.spec.ts unicorn/prefer-number-coercion',
        'test/e2e/size-diagnostics.spec.ts unicorn/prefer-number-coercion',
        'test/render-baseline.test.ts no-control-regex',
        'test/tooling-config.test.ts typescript/no-unnecessary-type-parameters',
      ].sort(),
    );
  });
});

describe('format gate', () => {
  it('pins the formatter style', () => {
    const config = readJson<FormatConfig>('.oxfmtrc.json');
    expect(config.printWidth).toBe(80);
    expect(config.singleQuote).toBe(true);
    expect(config.sortImports).toBe(false);
    expect(config.sortPackageJson).toBe(false);
  });

  it('ignores exactly the generated, golden and tool output', () => {
    const config = readJson<FormatConfig>('.oxfmtrc.json');
    expect(config.ignorePatterns).toEqual([
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
    ]);
  });

  it('enforces LF checkout with fixture precedence', () => {
    const lines = readText('.gitattributes')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect(lines[0]).toBe('* text=auto eol=lf');
    expect(lines).toContain('test/fixtures/** text eol=lf');
    expect(lines).toContain('test/fixtures/**/*.png binary');
    const textIndex = lines.indexOf('test/fixtures/** text eol=lf');
    const pngIndex = lines.indexOf('test/fixtures/**/*.png binary');
    expect(textIndex).toBeGreaterThan(0);
    expect(pngIndex).toBeGreaterThan(textIndex);
  });

  it('exposes format:check and format scripts', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    expect(scripts['format:check']).toBe('oxfmt --check');
    expect(scripts['format']).toBe('oxfmt');
  });

  it('runs the exact check steps in order', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    const steps = (scripts['check'] ?? '')
      .split('&&')
      .map((step) => step.trim());
    expect(steps).toEqual([
      'npm run i18n:check',
      'npm run assets',
      'npm run typecheck',
      'npm run lint',
      'npm run lint:dead',
      'npm run format:check',
      'npm run build',
      'npm run test:coverage',
    ]);
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
  it('pins the tooling dependencies exactly', () => {
    const devDependencies =
      readJson<PackageJson>('package.json').devDependencies ?? {};
    const pins = [
      ['oxlint', '1.94.0'],
      ['oxlint-tsgolint', '7.0.2008'],
      ['oxfmt', '0.80.0'],
      ['@vitest/coverage-v8', '5.1.1'],
      ['knip', '6.48.0'],
      ['publint', '0.3.25'],
      ['@arethetypeswrong/cli', '0.18.5'],
    ] as const;
    for (const [name, version] of pins) {
      expect(devDependencies[name], name).toBe(version);
    }
    expect(devDependencies).not.toHaveProperty('prettier');
  });
});

interface AttwConfig {
  profile?: string;
  ignoreRules?: string[];
}

interface KnipConfig {
  entry?: string[];
  ignoreDependencies?: string[];
}

describe('dead code and package surface', () => {
  it('exposes the package:check and lint:dead scripts', () => {
    const scripts = readJson<PackageJson>('package.json').scripts ?? {};
    expect(scripts['package:check']).toBe(
      'npm run build && node scripts/package-check.mjs',
    );
    expect(scripts['lint:dead']).toBe('knip');
  });

  it('pins the attw node16 profile and the one ignored rule', () => {
    const config = readJson<AttwConfig>('.attw.json');
    expect(Object.keys(config).sort()).toEqual(['ignoreRules', 'profile']);
    expect(config.profile).toBe('node16');
    expect([...(config.ignoreRules ?? [])].sort()).toEqual([
      'cjs-resolves-to-esm',
    ]);
  });

  it('declares the knip entries and the one ignored dependency', () => {
    const config = readJson<KnipConfig>('knip.json');
    const entries = config.entry ?? [];
    for (const expected of [
      'src/index.ts',
      'src/cli.ts',
      'src/compat/cucumber-html-reporter.ts',
      'src/compat/cucumber-html-reporter.cts',
      'src/render/report-client.ts',
      'scripts/*.mjs',
      'test/**/*.test.ts',
      'test/e2e/**/*.spec.ts',
    ]) {
      expect(entries, expected).toContain(expected);
    }
    expect(entries).not.toContain('test/**');
    expect(entries).not.toContain('test/baseline-helpers.ts');
    expect(config.ignoreDependencies).toEqual([
      '@arethetypeswrong/cli',
      'playwright-core',
      'publint',
    ]);
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
      const browserFiles = (
        readJson<ClientTsConfig>('tsconfig.client.json').include ?? []
      ).map((file) => toPosix(path.join(repoRoot, file)));
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

      const strictClean = lint(clean, true);
      expect(strictClean.error).toBeUndefined();
      expect(strictClean.status).toBe(0);
      expect(output(strictClean)).not.toMatch(/no-shadow/);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('type-aware lint probe', () => {
  it(
    'fails a floating promise and an awaited non-thenable, passes the awaited copy',
    () => {
      const directory = makeProbeDirectory('type-aware');
      writeProbeTsConfig(directory, ['*.ts']);
      const write = (name: string, lines: string[]): string => {
        const file = path.join(directory, name);
        writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
        return file;
      };

      const floating = write('floating.ts', [
        'export async function load(): Promise<number> {',
        '  return 1;',
        '}',
        '',
        'export function run(): void {',
        '  load();',
        '}',
      ]);
      const awaited = write('awaited.ts', [
        'export async function load(): Promise<number> {',
        '  return 1;',
        '}',
        '',
        'export async function run(): Promise<void> {',
        '  await load();',
        '}',
      ]);
      const nonThenable = write('non-thenable.ts', [
        'export async function run(): Promise<void> {',
        '  await 42;',
        '}',
      ]);

      const oxlint = packageBin('oxlint');
      // The probe targets type-aware promise rules, not eslint/require-await.
      const config = path.join(directory, 'oxlintrc.probe.json');
      writeJson(config, {
        extends: [toPosix(path.join(repoRoot, '.oxlintrc.json'))],
        rules: { 'eslint/require-await': 'off' },
      });
      const lint = (file: string): RunResult =>
        run(oxlint, [
          '--type-aware',
          '--max-warnings=0',
          '--config',
          config,
          file,
        ]);

      const floatingResult = lint(floating);
      expect(output(floatingResult)).not.toMatch(
        /Failed to find type-aware linter executable/,
      );
      expect(floatingResult.error).toBeUndefined();
      expect(floatingResult.status).not.toBe(0);
      expect(output(floatingResult)).toMatch(/no-floating-promises/);

      const awaitedResult = lint(awaited);
      expect(awaitedResult.error).toBeUndefined();
      expect(awaitedResult.status).toBe(0);

      const nonThenableResult = lint(nonThenable);
      expect(nonThenableResult.error).toBeUndefined();
      expect(nonThenableResult.status).not.toBe(0);
      expect(output(nonThenableResult)).toMatch(/await-thenable/);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('assertion scope probe', () => {
  it(
    'fails an unsafe cast in src and passes it in test under the test override',
    () => {
      const directory = makeProbeDirectory('assertion-scope');
      const source = path.join(directory, 'src', 'unsafe.ts');
      const testFile = path.join(directory, 'test', 'unsafe.ts');
      mkdirSync(path.dirname(source), { recursive: true });
      mkdirSync(path.dirname(testFile), { recursive: true });
      const body = [
        'export function id(value: unknown): string {',
        '  return value as string;',
        '}',
        '',
      ].join('\n');
      writeFileSync(source, body, 'utf8');
      writeFileSync(testFile, body, 'utf8');
      writeProbeTsConfig(directory, ['src/**/*.ts', 'test/**/*.ts']);

      const config = path.join(directory, 'oxlintrc.scope.json');
      writeJson(config, {
        extends: [toPosix(path.join(repoRoot, '.oxlintrc.json'))],
        overrides: [
          {
            files: ['**/test/**'],
            rules: { 'typescript/no-unsafe-type-assertion': 'off' },
          },
        ],
      });

      const oxlint = packageBin('oxlint');
      const lint = (file: string): RunResult =>
        run(oxlint, [
          '--type-aware',
          '--max-warnings=0',
          '--config',
          config,
          file,
        ]);

      const sourceResult = lint(source);
      expect(output(sourceResult)).not.toMatch(
        /Failed to find type-aware linter executable/,
      );
      expect(sourceResult.error).toBeUndefined();
      expect(sourceResult.status).not.toBe(0);
      expect(output(sourceResult)).toMatch(/no-unsafe-type-assertion/);

      const testResult = lint(testFile);
      expect(testResult.error).toBeUndefined();
      expect(testResult.status).toBe(0);
      expect(output(testResult)).not.toMatch(/no-unsafe-type-assertion/);
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

      // Oxfmt accepts probe files outside the config directory, so the repo
      // config is used directly.
      const oxfmt = packageBin('oxfmt');
      const config = path.join(repoRoot, '.oxfmtrc.json');
      const check = (file: string): RunResult =>
        run(oxfmt, ['--check', file, '-c', config], directory);

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
      expect(output(empty)).toMatch(/No test files found/);

      const matched = run(vitest, ['run', 'test/smoke.test.ts'], repoRoot);
      expect(matched.error).toBeUndefined();
      expect(matched.status).toBe(0);
      expect(output(matched)).toMatch(/passed/);
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
        ["it('control', () => {", '  expect(1).toBe(1);', '});', ''].join('\n'),
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
          '  test: {',
          "    include: ['*.test.ts'],",
          "    environment: 'node',",
          '    globals: true,',
          "    coverage: { provider: 'v8', include: ['measured.ts'], reporter: ['text-summary'] },",
          '  },',
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
