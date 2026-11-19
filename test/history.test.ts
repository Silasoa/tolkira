import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_LIMIT,
  HISTORY_MAX_BYTES,
  HISTORY_SCHEMA_VERSION,
  appendHistory,
  buildHistoryRun,
  readHistory,
  writeHistory,
  type HistoryRun,
} from '../src/history.js';
import { summarizeReport } from '../src/index.js';
import type { StatusCounts } from '../src/summary.js';

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
    await writeFile(file, 'stale content', 'utf8');

    await writeHistory(file, runs);

    const text = await readFile(file, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toEqual({
      schemaVersion: HISTORY_SCHEMA_VERSION,
      runs,
    });
    expect(await readdir(dir)).toEqual(['history.json']);
  });
});
