import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const benchScript = path.join(repoRoot, 'scripts', 'bench-ansi.mjs');
const TIMEOUT_MS = 30_000;
// Above the spawn timeout so a hung child surfaces as the spawn error.
const TEST_TIMEOUT_MS = 40_000;

interface CorpusMeasurement {
  name: string;
  messages: number;
  bytes: number;
  medianMs: number;
  mibPerSecond: number;
  scanOnlyMs: number;
  charAppendMs: number;
}

interface BenchmarkDocument {
  benchmark: string;
  mode: string;
  iterations: number;
  warmup: number;
  budgetMs: number;
  ratioFloor: number;
  corpora: CorpusMeasurement[];
  productionMedianMs: number;
  fastPathRatio: number;
  decision: string;
  slicingRatio: number;
  outputIdentical: boolean;
}

interface ScriptRun {
  status: number | null;
  stdout: string;
  stderr: string;
  error: Error | undefined;
}

function runBench(args: string[]): ScriptRun {
  const result = spawnSync(process.execPath, [benchScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function parseDocument(stdout: string): BenchmarkDocument {
  const text = stdout.trim();
  if (text.length === 0) {
    throw new Error('bench-ansi printed no JSON document on stdout');
  }
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null) {
    throw new Error(`bench-ansi printed ${typeof value}, not a JSON object`);
  }
  return value as BenchmarkDocument;
}

function runOk(args: string[]): BenchmarkDocument {
  const result = runBench(args);
  if (result.status !== 0) {
    throw new Error(
      `node scripts/bench-ansi.mjs ${args.join(' ')} exited ${result.status}: ` +
        `${result.error?.message ?? result.stderr}`,
    );
  }
  return parseDocument(result.stdout);
}

describe('bench:ansi command', () => {
  it(
    'exposes a bench:ansi npm script that runs scripts/bench-ansi.mjs',
    () => {
      const pkg = JSON.parse(
        readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
      ) as { scripts?: Record<string, string> };

      const command = pkg.scripts?.['bench:ansi'];

      expect(command).toBeTypeOf('string');
      expect(command).toContain('scripts/bench-ansi.mjs');
    },
    TEST_TIMEOUT_MS,
  );
});

describe('bench-ansi quick mode', () => {
  it(
    'exits 0 and prints one stripAnsi benchmark document',
    () => {
      const doc = runOk(['--quick']);

      expect(doc.benchmark).toBe('stripAnsi');
      expect(doc.mode).toBe('quick');
      expect(Number.isInteger(doc.iterations)).toBe(true);
      expect(doc.iterations).toBeGreaterThan(0);
      expect(Number.isInteger(doc.warmup)).toBe(true);
      expect(doc.warmup).toBeGreaterThanOrEqual(0);
      expect(doc.budgetMs).toBe(500);
      expect(doc.ratioFloor).toBe(1.5);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'reports both corpora with message counts, bytes, timing and throughput',
    () => {
      const doc = runOk(['--quick']);

      expect(doc.corpora).toHaveLength(2);
      expect(doc.corpora.map((corpus) => corpus.name).sort()).toEqual([
        'clean',
        'escaped',
      ]);
      for (const corpus of doc.corpora) {
        expect(Number.isInteger(corpus.messages)).toBe(true);
        expect(corpus.messages).toBeGreaterThan(0);
        expect(Number.isInteger(corpus.bytes)).toBe(true);
        expect(corpus.bytes).toBeGreaterThan(0);
        const timings = [
          'medianMs',
          'mibPerSecond',
          'scanOnlyMs',
          'charAppendMs',
        ] as const;
        for (const field of timings) {
          expect(typeof corpus[field]).toBe('number');
          expect(corpus[field]).toBeGreaterThan(0);
        }
      }
      expect(doc.outputIdentical).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'reports the production median and both reference ratios',
    () => {
      const doc = runOk(['--quick']);

      expect(typeof doc.productionMedianMs).toBe('number');
      expect(doc.productionMedianMs).toBeGreaterThan(0);
      expect(typeof doc.fastPathRatio).toBe('number');
      expect(Number.isFinite(doc.fastPathRatio)).toBe(true);
      expect(doc.fastPathRatio).toBeGreaterThan(0);
      expect(typeof doc.slicingRatio).toBe('number');
      expect(Number.isFinite(doc.slicingRatio)).toBe(true);
      expect(doc.slicingRatio).toBeGreaterThan(0);
      // Full-mode coherence is enforced by the script: the quick corpus is too
      // small for a stable component comparison.
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'reports a decision consistent with the printed ratio and floor',
    () => {
      const doc = runOk(['--quick']);

      expect(doc.decision).toBe(
        doc.fastPathRatio >= doc.ratioFloor ? 'keep' : 'review',
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'reports the same corpus message counts and bytes on two quick runs',
    () => {
      const sizes = (doc: BenchmarkDocument) =>
        doc.corpora
          .map((corpus) => ({
            name: corpus.name,
            messages: corpus.messages,
            bytes: corpus.bytes,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

      const first = sizes(runOk(['--quick']));
      const second = sizes(runOk(['--quick']));

      expect(second).toEqual(first);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'exits 1 and names the budget and measured time when the budget is exceeded',
    () => {
      const result = runBench(['--quick', '--budget-ms', '0']);

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/budget/i);
      expect(result.stderr).toMatch(/\d/);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'exits 0 and reports review when the ratio is below the printed floor',
    () => {
      const doc = runOk(['--quick', '--ratio-floor', '1000']);

      expect(doc.ratioFloor).toBe(1000);
      expect(doc.decision).toBe(
        doc.fastPathRatio >= doc.ratioFloor ? 'keep' : 'review',
      );
      expect(doc.decision).toBe('review');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'exits 2 and prints usage for an unknown argument',
    () => {
      const result = runBench(['--quick', '--unknown-option']);

      expect(result.status).toBe(2);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/usage/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'exits 0 and reports keep when the ratio floor is very low',
    () => {
      const doc = runOk(['--quick', '--ratio-floor', '0.001']);

      expect(doc.ratioFloor).toBe(0.001);
      expect(doc.decision).toBe('keep');
      expect(doc.fastPathRatio).toBeGreaterThanOrEqual(doc.ratioFloor);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'exits 2 and prints usage for negative, non-numeric and missing option values',
    () => {
      const cases = [
        ['--budget-ms', '-1'],
        ['--budget-ms', 'abc'],
        ['--budget-ms'],
      ];

      for (const args of cases) {
        const result = runBench(['--quick', ...args]);
        expect(result.status, args.join(' ')).toBe(2);
        expect(`${result.stdout}\n${result.stderr}`, args.join(' ')).toMatch(
          /usage/i,
        );
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'prints usage and exits 0 for --help',
    () => {
      const result = runBench(['--help']);

      expect(result.status).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/usage/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'wires the benchmark to the production src/text.ts bundle',
    () => {
      const source = readFileSync(benchScript, 'utf8');

      expect(source).toContain('../src/text.ts');
      expect(source).toContain('bundle: true');
      expect(source).toContain("format: 'esm'");
    },
    TEST_TIMEOUT_MS,
  );
});
