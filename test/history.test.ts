import { execFile } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_LIMIT,
  HISTORY_MAX_BYTES,
  HISTORY_MAX_TITLE,
  HISTORY_SCHEMA_VERSION,
  appendHistory,
  buildHistoryRun,
  readHistory,
  writeHistory,
  type HistoryRun,
} from '../src/history.js';
import { summarizeReport } from '../src/index.js';
import type { ReportSummary, StatusCounts } from '../src/summary.js';

const execFileAsync = promisify(execFile);
const fixtures = fileURLToPath(new URL('./fixtures/history/', import.meta.url));
const messages = fileURLToPath(
  new URL('./fixtures/messages/second.ndjson', import.meta.url),
);

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-history-'));
  dirs.push(dir);
  return dir;
}

function fixture(name: string): string {
  return path.join(fixtures, name);
}

function counts(overrides: Partial<StatusCounts> = {}): StatusCounts {
  return {
    total: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
    ...overrides,
  };
}

function makeRun(index: number, overrides: Partial<HistoryRun> = {}): HistoryRun {
  return {
    id: `id-${String(index).padStart(4, '0')}`,
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    title: 'Nightly',
    status: 'passed',
    counts: {
      features: 1,
      scenarios: counts(),
      steps: counts(),
    },
    durationMs: 1000 + index,
    attachments: { total: 0, bytes: 0 },
    ...overrides,
  };
}

function sidecar(runs: unknown[]): string {
  return JSON.stringify({ schemaVersion: 1, runs });
}

async function writeRaw(name: string, raw: string): Promise<string> {
  const dir = await tempDir();
  const file = path.join(dir, name);
  await writeFile(file, raw, 'utf8');
  return file;
}

interface LegacyScenarioInput {
  name: string;
  status?: string;
  tags?: string[];
}

// One legacy feature; legacy JSON has no attempt data, so every attempt is 0.
async function summaryFromLegacy(
  scenarios: LegacyScenarioInput[],
): Promise<ReportSummary> {
  const dir = await tempDir();
  const file = path.join(dir, 'run.json');
  await writeFile(
    file,
    JSON.stringify([
      {
        uri: 'features/flaky.feature',
        name: 'Flaky feature',
        elements: scenarios.map((scenario) => ({
          keyword: 'Scenario',
          type: 'scenario',
          name: scenario.name,
          tags: (scenario.tags ?? []).map((name, index) => ({
            name,
            line: index + 1,
          })),
          steps: [
            {
              keyword: 'Given ',
              name: 'a step',
              result: { status: scenario.status ?? 'passed', duration: 1 },
            },
          ],
        })),
      },
    ]),
    'utf8',
  );
  return summarizeReport(file);
}

interface MessagesScenarioInput {
  name: string;
  tags?: string[];
  attempt?: number;
  status?: 'PASSED' | 'FAILED' | 'SKIPPED';
  started?: boolean;
}

// Minimal Messages run: one pickle per scenario, started at the given attempt.
async function summaryFromMessages(
  scenarios: MessagesScenarioInput[],
): Promise<ReportSummary> {
  const dir = await tempDir();
  const file = path.join(dir, 'run.ndjson');
  const lines: unknown[] = [];
  scenarios.forEach((scenario, index) => {
    const pickleId = `pickle-${index}`;
    const caseId = `case-${index}`;
    const startedId = `started-${index}`;
    lines.push({
      pickle: {
        id: pickleId,
        uri: 'features/flaky.feature',
        name: scenario.name,
        language: 'en',
        astNodeIds: [`scenario-${index}`],
        tags: (scenario.tags ?? []).map((name) => ({ name, astNodeId: 'tag' })),
        steps: [
          {
            id: `${pickleId}-step`,
            text: 'a step',
            type: 'Context',
            astNodeIds: [`step-${index}`],
          },
        ],
      },
    });
    lines.push({
      testCase: {
        id: caseId,
        pickleId,
        testSteps: [{ id: `${caseId}-step`, pickleStepId: `${pickleId}-step` }],
      },
    });
    if (scenario.started === false) return;
    lines.push({
      testCaseStarted: {
        id: startedId,
        testCaseId: caseId,
        attempt: scenario.attempt ?? 0,
        timestamp: { seconds: 0, nanos: index },
      },
    });
    lines.push({
      testStepFinished: {
        testCaseStartedId: startedId,
        testStepId: `${caseId}-step`,
        testStepResult: {
          status: scenario.status ?? 'PASSED',
          duration: { seconds: 0, nanos: 1 },
        },
        timestamp: { seconds: 1, nanos: index },
      },
    });
    lines.push({
      testCaseFinished: {
        testCaseStartedId: startedId,
        timestamp: { seconds: 2, nanos: index },
        willBeRetried: false,
      },
    });
  });
  await writeFile(
    file,
    lines.map((line) => JSON.stringify(line)).join('\n'),
    'utf8',
  );
  return summarizeReport(file);
}

function playwrightResult(retry: number, status: string) {
  return {
    status,
    duration: 1,
    retry,
    startTime: '2026-11-22T09:00:00.000Z',
    stdout: [],
    stderr: [],
    annotations: [],
    attachments: [],
  };
}

// A final passed attempt after a failed retry, or the same retries still failing.
function playwrightReport(status: 'flaky' | 'unexpected'): unknown {
  const results = [
    playwrightResult(0, 'failed'),
    playwrightResult(1, status === 'flaky' ? 'passed' : 'failed'),
  ];
  return {
    config: {
      version: '1.65.0',
      configFile: 'playwright.config.ts',
      rootDir: 'tests',
      projects: [{ id: 'chromium', name: 'chromium', retries: 1 }],
    },
    suites: [
      {
        title: 'flaky.spec.ts',
        file: 'flaky.spec.ts',
        line: 0,
        column: 0,
        specs: [
          {
            title: 'retried test',
            ok: status === 'flaky',
            tags: [],
            id: 'flaky-spec-1',
            file: 'flaky.spec.ts',
            line: 7,
            column: 1,
            tests: [
              {
                timeout: 30000,
                annotations: [],
                expectedStatus: 'passed',
                projectId: 'chromium',
                projectName: 'chromium',
                status,
                results,
              },
            ],
          },
        ],
      },
    ],
    errors: [],
    stats: {
      startTime: '2026-11-22T09:00:00.000Z',
      duration: 2,
      expected: 0,
      unexpected: status === 'unexpected' ? 1 : 0,
      flaky: status === 'flaky' ? 1 : 0,
      skipped: 0,
    },
  };
}

async function summaryFromPlaywright(report: unknown): Promise<ReportSummary> {
  const dir = await tempDir();
  const file = path.join(dir, 'playwright.json');
  await writeFile(file, JSON.stringify(report), 'utf8');
  return summarizeReport(file);
}

describe('reading the history sidecar', () => {
  it('reads the documented entries from a valid file', async () => {
    const runs = await readHistory(fixture('two-runs.json'));
    const expected = JSON.parse(
      await readFile(fixture('two-runs.json'), 'utf8'),
    ) as { runs: HistoryRun[] };

    expect(runs).toStrictEqual(expected.runs);
    expect(runs).toHaveLength(2);
  });

  it('starts empty when the file is missing', async () => {
    await expect(
      readHistory(path.join(await tempDir(), 'missing.json')),
    ).resolves.toEqual([]);
  });

  it('ignores unknown fields inside schema version 1', async () => {
    const clean = JSON.parse(
      await readFile(fixture('two-runs.json'), 'utf8'),
    ) as { runs: HistoryRun[] };
    const noisy = {
      schemaVersion: HISTORY_SCHEMA_VERSION,
      future: { note: 'ignore me' },
      runs: clean.runs.map((run) => ({
        ...run,
        revision: 'abc123',
        counts: { ...run.counts, scenarios: { ...run.counts.scenarios, extra: 9 } },
      })),
    };
    const file = await writeRaw('noisy.json', JSON.stringify(noisy));

    await expect(readHistory(file)).resolves.toStrictEqual(clean.runs);
  });

  it('ignores prototype-shaped keys without polluting Object.prototype', async () => {
    const raw = sidecar([makeRun(0)])
      .replace('{"schemaVersion":1,', '{"__proto__":{"polluted":true},"schemaVersion":1,')
      .replace('"features":1,', '"features":1,"__proto__":{"polluted":true},');
    const file = await writeRaw('prototype.json', raw);

    await expect(readHistory(file)).resolves.toStrictEqual([makeRun(0)]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  // A FIFO is cheap on POSIX; Windows has no equivalent worth the setup.
  it.skipIf(process.platform === 'win32')(
    'rejects a non-regular file without reading it',
    async () => {
      const dir = await tempDir();
      const fifo = path.join(dir, 'history.fifo');
      await execFileAsync('mkfifo', [fifo]);

      await expect(readHistory(fifo)).rejects.toThrow(/not a regular file/);
    },
  );

  it.each([
    ['invalid JSON', async () => fixture('corrupt.json')],
    ['a wrong schema version', async () => fixture('wrong-schema.json')],
  ])('rejects %s and leaves the file untouched', async (_, resolveFile) => {
    const file = await resolveFile();
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file)).rejects.toThrow(
      new RegExp(path.basename(file).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('rejects a file above the size cap without touching it', async () => {
    // A valid sidecar with an unknown field: only the size cap can reject it.
    const file = await writeRaw(
      'oversized.json',
      JSON.stringify({
        schemaVersion: 1,
        runs: [],
        padding: 'x'.repeat(HISTORY_MAX_BYTES + 1),
      }),
    );
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file)).rejects.toThrow(/oversized\.json/);
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it.each([
    ['a bad ISO time', async () => fixture('malformed-entry.json')],
    [
      'a year-only time',
      async () =>
        writeRaw(
          'year-only.json',
          sidecar([makeRun(0, { recordedAt: '2026' })]),
        ),
    ],
    [
      'a local date time',
      async () =>
        writeRaw(
          'local-date.json',
          sidecar([makeRun(0, { recordedAt: '01/02/2026' })]),
        ),
    ],
    [
      'a prototype-shaped status',
      async () =>
        writeRaw(
          'proto-status.json',
          sidecar([makeRun(0)]).replace(
            '"status":"passed"',
            '"status":"__proto__"',
          ),
        ),
    ],
    [
      'an inconsistent scenario total',
      async () =>
        writeRaw(
          'inconsistent-total.json',
          sidecar([makeRun(0)]).replace('"total":1', '"total":2'),
        ),
    ],
    [
      'a scenario bucket above total',
      async () =>
        writeRaw(
          'bucket-above-total.json',
          sidecar([makeRun(0)]).replace('"passed":1', '"passed":2'),
        ),
    ],
    [
      'a non-finite attachment size',
      async () =>
        writeRaw(
          'non-finite-attachment.json',
          sidecar([makeRun(0)]).replace('"bytes":0', '"bytes":1e999'),
        ),
    ],
    [
      'a non-finite duration',
      async () =>
        writeRaw(
          'non-finite-duration.json',
          sidecar([{ ...makeRun(0), durationMs: 0 }]).replace(
            '"durationMs":0',
            '"durationMs":1e999',
          ),
        ),
    ],
    [
      'a non-finite count',
      async () =>
        writeRaw(
          'non-finite-count.json',
          sidecar([makeRun(0)]).replace('"total":1', '"total":1e999'),
        ),
    ],
    [
      'a negative count',
      async () =>
        writeRaw(
          'negative-count.json',
          sidecar([makeRun(0)]).replace('"total":1', '"total":-1'),
        ),
    ],
    [
      'a wrong field type',
      async () =>
        writeRaw(
          'wrong-type.json',
          sidecar([makeRun(0)]).replace('"title":"Nightly"', '"title":42'),
        ),
    ],
  ])('rejects a malformed entry with %s', async (_, resolveFile) => {
    const file = await resolveFile();
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file)).rejects.toThrow(
      new RegExp(path.basename(file).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('keeps exactly the newest 30 entries from a longer file', async () => {
    const thirty = JSON.parse(
      await readFile(fixture('thirty-runs.json'), 'utf8'),
    ) as { runs: HistoryRun[] };
    expect(await readHistory(fixture('thirty-runs.json'))).toHaveLength(
      HISTORY_LIMIT,
    );

    const file = await writeRaw(
      'thirty-one.json',
      sidecar([makeRun(31), ...thirty.runs]),
    );
    const runs = await readHistory(file);

    expect(runs).toHaveLength(HISTORY_LIMIT);
    expect(runs[0]?.id).toBe(thirty.runs[0]?.id);
    expect(runs.at(-1)?.id).toBe(thirty.runs.at(-1)?.id);
  });
});

describe('reading a BOM-prefixed history sidecar', () => {
  async function writeBom(name: string, raw: string): Promise<string> {
    return writeRaw(name, `\uFEFF${raw}`);
  }

  it('reads a valid BOM-prefixed file exactly like the file without a BOM', async () => {
    const runs = [makeRun(0), makeRun(1)];
    const plain = await writeRaw('plain.json', sidecar(runs));
    const bom = await writeBom('bom.json', sidecar(runs));
    const before = await readFile(bom, 'utf8');
    const beforeStat = await stat(bom);

    await expect(readHistory(bom)).resolves.toStrictEqual(runs);
    await expect(readHistory(plain)).resolves.toStrictEqual(runs);
    await expect(readFile(bom, 'utf8')).resolves.toBe(before);
    expect((await stat(bom)).mtimeMs).toBe(beforeStat.mtimeMs);
  });

  it('rejects a BOM-only file with the existing not-valid-JSON error', async () => {
    const file = await writeRaw('bom-only.json', '\uFEFF');
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file)).rejects.toThrow(
      `Invalid history file ${file}: not valid JSON`,
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('rejects a BOM followed by invalid JSON without rewriting the file', async () => {
    const file = await writeBom('bom-invalid.json', '{not json');
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file)).rejects.toThrow(
      `Invalid history file ${file}: not valid JSON`,
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('strips exactly one BOM so a second one stays invalid JSON', async () => {
    const file = await writeRaw(
      'double-bom.json',
      `\uFEFF\uFEFF${sidecar([makeRun(0)])}`,
    );
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file)).rejects.toThrow(
      `Invalid history file ${file}: not valid JSON`,
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('accepts a BOM-prefixed target in the schema peek and writes BOM-free bytes', async () => {
    const runs = [makeRun(0), makeRun(1)];
    const plain = await writeRaw(
      'plain-target.json',
      JSON.stringify({ schemaVersion: 2, runs }),
    );
    const bom = await writeBom(
      'bom-target.json',
      JSON.stringify({ schemaVersion: 2, runs }),
    );
    const next = makeRun(9);
    const appended = appendHistory(runs, next);

    await writeHistory(plain, appended);
    await writeHistory(bom, appended);

    const plainBytes = await readFile(plain, 'utf8');
    const bomBytes = await readFile(bom, 'utf8');
    expect(bomBytes).toBe(plainBytes);
    expect(bomBytes.charCodeAt(0)).toBe('{'.charCodeAt(0));
    expect(bomBytes).not.toContain('\uFEFF');
    expect(JSON.parse(bomBytes)).toMatchObject({ schemaVersion: 2 });
    const written = JSON.parse(bomBytes) as { runs: HistoryRun[] };
    expect(written.runs.map((run) => run.id)).toEqual([
      ...runs.map((run) => run.id),
      next.id,
    ]);
  });

  it('writes a schema-1 sidecar without a BOM', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'history.json');

    await writeHistory(file, [makeRun(0)]);

    const bytes = await readFile(file, 'utf8');
    expect(bytes.startsWith('{')).toBe(true);
    expect(bytes.includes('\uFEFF')).toBe(false);
    expect(JSON.parse(bytes)).toMatchObject({ schemaVersion: 1 });
  });
});

describe('building history runs', () => {
  it('keeps the aggregate id across recorded times and stores the aggregate only', async () => {
    const summary = await summarizeReport(messages);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const first = buildHistoryRun(summary, 'Nightly build');
      vi.setSystemTime(new Date('2026-03-04T05:06:07.000Z'));
      const second = buildHistoryRun(summary, 'Nightly build');

      expect(first.id).toBe(second.id);
      expect(first.recordedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(second.recordedAt).toBe('2026-03-04T05:06:07.000Z');
      expect(first.title).toBe('Nightly build');
      expect(Object.keys(first).sort()).toEqual([
        'attachments',
        'counts',
        'durationMs',
        'flaky',
        'id',
        'recordedAt',
        'status',
        'title',
      ]);
      expect(first.counts.features).toBe(summary.counts.features);
      expect(first.counts.scenarios).toEqual(summary.counts.scenarios);
      expect(first.counts.steps).toEqual(summary.counts.steps);
      expect(first.durationMs).toBe(summary.durationMs);
      expect(first.attachments).toEqual(summary.attachments);
      expect(first.status).toBe(summary.status);

      const serialized = JSON.stringify(first);
      for (const secret of ['Second scenario', '@failing', 'features/']) {
        expect(serialized, secret).not.toContain(secret);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps a long title at 200 characters with an ellipsis', async () => {
    const summary = await summarizeReport(messages);
    const run = buildHistoryRun(summary, 'x'.repeat(500));

    expect(Array.from(run.title)).toHaveLength(HISTORY_MAX_TITLE);
    expect(run.title.endsWith('…')).toBe(true);
  });

  it('changes the aggregate id when an aggregate or the title changes', async () => {
    const summary = await summarizeReport(messages);
    const base = buildHistoryRun(summary, 'Nightly build');

    expect(
      buildHistoryRun({ ...summary, durationMs: summary.durationMs + 1 }, 'Nightly build').id,
    ).not.toBe(base.id);
    expect(
      buildHistoryRun(
        summary,
        'Release build',
      ).id,
    ).not.toBe(base.id);
  });
});

describe('appending to the history', () => {
  it('appends a different run after the last entry', () => {
    const base = Array.from({ length: 2 }, (_, index) => makeRun(index));
    const next = makeRun(9);

    const runs = appendHistory(base, next);

    expect(runs.map((run) => run.id)).toEqual([...base.map((run) => run.id), next.id]);
  });

  it('keeps one copy of an identical last run and its old timestamp', () => {
    const original = makeRun(0, {
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    const rerun = { ...original, recordedAt: '2026-06-01T00:00:00.000Z' };

    const runs = appendHistory([original], rerun);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.recordedAt).toBe(original.recordedAt);
  });

  it('appends a run whose id matches an earlier but not the last entry', () => {
    const first = makeRun(0);
    const second = makeRun(1);

    const runs = appendHistory([first, second], { ...first, recordedAt: '2026-07-01T00:00:00.000Z' });

    expect(runs).toHaveLength(3);
    expect(runs.at(-1)?.id).toBe(first.id);
  });

  it('keeps the newest 30 runs for 29, 30 and 31 existing entries', () => {
    const base = Array.from({ length: 31 }, (_, index) => makeRun(index));
    const next = makeRun(99);

    const from29 = appendHistory(base.slice(0, 29), next);
    expect(from29).toHaveLength(HISTORY_LIMIT);
    expect(from29[0]?.id).toBe(base[0]?.id);
    expect(from29.at(-1)?.id).toBe(next.id);

    const from30 = appendHistory(base.slice(0, 30), next);
    expect(from30).toHaveLength(HISTORY_LIMIT);
    expect(from30[0]?.id).toBe(base[1]?.id);
    expect(from30.at(-1)?.id).toBe(next.id);

    const from31 = appendHistory(base, next);
    expect(from31).toHaveLength(HISTORY_LIMIT);
    expect(from31[0]?.id).toBe(base[2]?.id);
    expect(from31.at(-1)?.id).toBe(next.id);
  });
});

describe('writing the history sidecar', () => {
  it('writes schema version 1 JSON atomically and leaves no temp file', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'history.json');
    const runs = [makeRun(0), makeRun(1)];
    // A valid older sidecar is replaced; a malformed target is rejected now.
    await writeFile(file, sidecar([makeRun(9)]), 'utf8');

    await writeHistory(file, runs);

    const text = await readFile(file, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toEqual({
      schemaVersion: HISTORY_SCHEMA_VERSION,
      runs,
    });
    expect(await readdir(dir)).toEqual(['history.json']);
  });

  it('keeps the newest 30 runs and caps titles on write', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'history.json');
    const runs = Array.from({ length: 31 }, (_, index) =>
      makeRun(index, { title: 'y'.repeat(500) }),
    );

    await writeHistory(file, runs);

    const written = JSON.parse(await readFile(file, 'utf8')) as {
      runs: HistoryRun[];
    };
    expect(written.runs).toHaveLength(HISTORY_LIMIT);
    expect(written.runs[0]?.id).toBe(runs[1]?.id);
    expect(Array.from(written.runs[0]?.title ?? '')).toHaveLength(
      HISTORY_MAX_TITLE,
    );
  });
});

describe('validating the history target before writing', () => {
  async function expectRejectedTarget(
    file: string,
    prefix: string,
  ): Promise<void> {
    const dir = path.dirname(file);
    const before = await readFile(file, 'utf8');
    const beforeStat = await stat(file);

    await expect(writeHistory(file, [makeRun(9)])).rejects.toThrow(prefix);

    await expect(readFile(file, 'utf8')).resolves.toBe(before);
    expect((await stat(file)).mtimeMs).toBe(beforeStat.mtimeMs);
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual(
      [],
    );
  }

  it('rejects a schema-1 target whose runs are not an array', async () => {
    const file = await writeRaw(
      'runs-not-array.json',
      JSON.stringify({ schemaVersion: 1, runs: 'not-an-array' }),
    );

    await expectRejectedTarget(
      file,
      `Cannot write history file ${path.basename(file)}:`,
    );
  });

  it('rejects a schema-2 target with one bad run entry', async () => {
    const file = await writeRaw(
      'bad-entry.json',
      JSON.stringify({
        schemaVersion: 2,
        runs: [makeRun(0), { ...makeRun(1), recordedAt: '2026' }],
      }),
    );

    await expectRejectedTarget(
      file,
      `Cannot write history file ${path.basename(file)}:`,
    );
    await expect(writeHistory(file, [makeRun(9)])).rejects.toThrow(/runs\[1\]/);
  });

  it('still writes a missing target with schema 1', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'missing.json');

    await writeHistory(file, [makeRun(0)]);

    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      schemaVersion: 1,
      runs: [makeRun(0)],
    });
  });

  it('appends to a valid target and keeps its stored schema', async () => {
    const existing = makeRun(0);
    const file = await writeRaw(
      'schema-two.json',
      JSON.stringify({ schemaVersion: 2, runs: [existing] }),
    );

    await writeHistory(file, [existing, makeRun(1)]);

    const written = JSON.parse(await readFile(file, 'utf8')) as {
      schemaVersion: number;
      runs: HistoryRun[];
    };
    expect(written.schemaVersion).toBe(2);
    expect(written.runs.map((run) => run.id)).toEqual([
      existing.id,
      makeRun(1).id,
    ]);
  });

  it('moves from a rejected target to a valid write once the bytes are repaired', async () => {
    const file = await writeRaw(
      'repair.json',
      JSON.stringify({ schemaVersion: 1, runs: 'not-an-array' }),
    );
    await expect(writeHistory(file, [makeRun(0)])).rejects.toThrow(
      'Cannot write history file',
    );

    const repaired = sidecar([makeRun(0)]);
    await writeFile(file, repaired, 'utf8');
    await writeHistory(file, [makeRun(0), makeRun(1)]);

    const written = await readHistory(file);
    expect(written.map((run) => run.id)).toEqual([
      makeRun(0).id,
      makeRun(1).id,
    ]);
  });
});

describe('counting flaky scenarios', () => {
  it('counts an executed tagged scenario once, including a final failure', async () => {
    const summary = await summaryFromLegacy([
      { name: 'tagged pass', tags: ['@flaky'] },
      { name: 'tagged fail', status: 'failed', tags: ['@flaky'] },
      { name: 'plain pass' },
    ]);

    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );
    // Legacy JSON is tag-only: every attempt stays 0.
    expect(byName.get('tagged pass')?.attempt).toBe(0);
    expect(byName.get('tagged fail')?.status).toBe('failed');
    expect(buildHistoryRun(summary, 'Nightly build').flaky).toBe(2);
  });

  it('counts a retry pass and both branches once, but not a retry failure', async () => {
    const summary = await summaryFromMessages([
      { name: 'retried pass', attempt: 1 },
      { name: 'retried fail', attempt: 1, status: 'FAILED' },
      { name: 'tagged and retried', attempt: 2, tags: ['@flaky'] },
    ]);

    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );
    expect(byName.get('retried pass')?.status).toBe('passed');
    expect(byName.get('retried pass')?.attempt).toBe(1);
    expect(byName.get('retried pass')?.tags).toEqual([]);
    expect(byName.get('retried fail')?.status).toBe('failed');
    expect(byName.get('tagged and retried')?.tags).toEqual(['@flaky']);
    expect(buildHistoryRun(summary, 'Nightly build').flaky).toBe(2);
  });

  // Tag and retry are independent branches: the final status only matters to
  // the retry branch.
  it.each([
    { tagged: true, attempt: 1, status: 'FAILED' as const, expected: 1 },
    { tagged: true, attempt: 1, status: 'PASSED' as const, expected: 1 },
    { tagged: false, attempt: 1, status: 'PASSED' as const, expected: 1 },
    { tagged: false, attempt: 1, status: 'FAILED' as const, expected: 0 },
    { tagged: true, attempt: 0, status: 'FAILED' as const, expected: 1 },
    { tagged: false, attempt: 0, status: 'PASSED' as const, expected: 0 },
  ])(
    'counts tagged=$tagged attempt=$attempt final=$status as $expected',
    async ({ tagged, attempt, status, expected }) => {
      const summary = await summaryFromMessages([
        {
          name: 'decision case',
          attempt,
          status,
          ...(tagged ? { tags: ['@flaky'] } : {}),
        },
      ]);

      expect(summary.scenarios[0]?.status).toBe(
        status === 'PASSED' ? 'passed' : 'failed',
      );
      expect(buildHistoryRun(summary, 'Nightly build').flaky).toBe(expected);
    },
  );

  it('excludes a skipped and an unexecuted tagged scenario', async () => {
    const summary = await summaryFromMessages([
      { name: 'tagged skipped', tags: ['@flaky'], status: 'SKIPPED' },
      { name: 'tagged unstarted', tags: ['@flaky'], started: false },
    ]);

    expect(summary.scenarios.map((scenario) => scenario.name)).toEqual([
      'tagged skipped',
    ]);
    expect(summary.scenarios[0]?.executed).toBe(true);
    expect(summary.scenarios[0]?.status).toBe('skipped');
    expect(buildHistoryRun(summary, 'Nightly build').flaky).toBe(0);
  });

  it('counts a Playwright retry pass and not a retry failure', async () => {
    const retried = await summaryFromPlaywright(playwrightReport('flaky'));
    expect(retried.scenarios[0]?.attempt).toBe(1);
    expect(retried.scenarios[0]?.tags).toEqual(['@flaky']);
    expect(buildHistoryRun(retried, 'Nightly build').flaky).toBe(1);

    const failed = await summaryFromPlaywright(playwrightReport('unexpected'));
    expect(failed.scenarios[0]?.status).toBe('failed');
    expect(failed.scenarios[0]?.attempt).toBe(1);
    expect(failed.scenarios[0]?.tags).toEqual([]);
    expect(buildHistoryRun(failed, 'Nightly build').flaky).toBe(0);
  });

  it('keeps the summary schema free of a flaky field', async () => {
    const summary = await summaryFromLegacy([
      { name: 'tagged', tags: ['@flaky'] },
    ]);

    expect(summary.schemaVersion).toBe(2);
    expect(Object.hasOwn(summary, 'flaky')).toBe(false);
  });
});

describe('flaky in the history sidecar', () => {
  it('leaves old entries field-less on read and append', async () => {
    const old = await readHistory(fixture('two-runs.json'));
    expect(old.every((run) => !Object.hasOwn(run, 'flaky'))).toBe(true);

    const summary = await summaryFromLegacy([
      { name: 'tagged', tags: ['@flaky'] },
    ]);
    const next = buildHistoryRun(summary, 'Nightly build');
    const dir = await tempDir();
    const file = path.join(dir, 'history.json');
    await writeHistory(file, appendHistory(old, next));

    const runs = await readHistory(file);
    expect(runs).toHaveLength(3);
    for (const run of runs.slice(0, 2)) {
      expect(Object.hasOwn(run, 'flaky')).toBe(false);
    }
    expect(runs[2]?.flaky).toBe(1);
  });

  it('round-trips a present count, including the lower and attempted bounds', async () => {
    const exact = makeRun(0, {
      flaky: 1,
      counts: {
        features: 1,
        scenarios: counts({ total: 2, passed: 1, skipped: 1 }),
        steps: counts({ total: 2, passed: 1, skipped: 1 }),
      },
    });
    const lower = makeRun(1, { flaky: 0 });

    const rawFile = await writeRaw('flaky.json', sidecar([lower, exact]));
    await expect(readHistory(rawFile)).resolves.toStrictEqual([lower, exact]);

    const dir = await tempDir();
    const file = path.join(dir, 'history.json');
    await writeHistory(file, [lower, exact]);
    await expect(readHistory(file)).resolves.toStrictEqual([lower, exact]);
    expect(lower.flaky).toBe(0);
  });

  it.each([
    ['a negative', -1],
    ['a fractional', 0.5],
    ['an above-attempted', 2],
  ])('rejects %s flaky count without a rewrite', async (_, flaky) => {
    const file = await writeRaw('invalid-flaky.json', sidecar([
      makeRun(0, { flaky }),
    ]));
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file)).rejects.toThrow(/invalid-flaky\.json/);
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('rejects a count above attempted when skipped scenarios reduce the bound', async () => {
    const file = await writeRaw(
      'skipped-boundary.json',
      sidecar([
        makeRun(0, {
          flaky: 1,
          counts: {
            features: 1,
            scenarios: counts({ total: 1, passed: 0, skipped: 1 }),
            steps: counts({ total: 1, passed: 0, skipped: 1 }),
          },
        }),
      ]),
    );
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file)).rejects.toThrow(/skipped-boundary\.json/);
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('changes the aggregate id with the flaky count', async () => {
    const tagged = await summaryFromLegacy([
      { name: 'retried', tags: ['@flaky'] },
    ]);
    const plain = await summaryFromLegacy([{ name: 'retried' }]);
    expect(plain.counts).toEqual(tagged.counts);

    const withFlaky = buildHistoryRun(tagged, 'Nightly build');
    const without = buildHistoryRun(plain, 'Nightly build');
    expect(withFlaky.flaky).toBe(1);
    expect(without.flaky).toBe(0);
    expect(withFlaky.id).not.toBe(without.id);
  });

  it('appends an unchanged run once after an old entry, then dedupes', async () => {
    const summary = await summaryFromLegacy([
      { name: 'tagged', tags: ['@flaky'] },
    ]);
    const next = buildHistoryRun(summary, 'Nightly');
    const old = makeRun(0);

    const once = appendHistory([old], next);
    expect(once).toHaveLength(2);
    expect(once[1]?.flaky).toBe(1);

    const twice = appendHistory(once, {
      ...next,
      recordedAt: '2026-12-01T00:00:00.000Z',
    });
    expect(twice).toHaveLength(2);
    expect(twice[1]?.recordedAt).toBe(next.recordedAt);
  });
});
