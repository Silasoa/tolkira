import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CucumberHtmlStream,
  HISTORY_LIMIT,
  HISTORY_MAX_BYTES,
  HISTORY_MAX_ID,
  HISTORY_MAX_TITLE,
  appendHistory,
  generateReport,
  readHistory,
  renderReport,
  writeHistory,
  type HistoryRun,
  type StatusCounts,
} from '../src/index.js';
import { historyWindow } from '../src/history.js';
import { parseMessages } from '../src/input/messages.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/second.ndjson', import.meta.url),
);

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-history-window-'));
  dirs.push(dir);
  return dir;
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

function runs(count: number): HistoryRun[] {
  return Array.from({ length: count }, (_, index) => makeRun(index));
}

function sidecar(entries: readonly HistoryRun[], schemaVersion = 1): string {
  return JSON.stringify({ schemaVersion, runs: entries }, null, 2);
}

async function writeRaw(
  name: string,
  raw: string,
  dir?: string,
): Promise<string> {
  const target = dir ?? (await tempDir());
  const file = path.join(target, name);
  await writeFile(file, raw, 'utf8');
  return file;
}

async function schemaVersion(file: string): Promise<unknown> {
  return (JSON.parse(await readFile(file, 'utf8')) as { schemaVersion: unknown })
    .schemaVersion;
}

async function storedRuns(file: string): Promise<HistoryRun[]> {
  return (JSON.parse(await readFile(file, 'utf8')) as { runs: HistoryRun[] }).runs;
}

function ids(entries: readonly HistoryRun[]): string[] {
  return entries.map((run) => run.id);
}

function hasTrends(html: string): boolean {
  return html.includes('data-view="trends"');
}

function trendsRows(html: string): number {
  const start = html.indexOf('id="trends-view"');
  if (start === -1) return 0;
  const end = html.indexOf('<dialog', start);
  const panel = html.slice(start, end === -1 ? undefined : end);
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/.exec(panel);
  return [...(body?.[1] ?? '').matchAll(/<tr\b[\s\S]*?<\/tr>/g)].length;
}

async function streamHtml(history: HistoryRun[]): Promise<string> {
  const envelopes = parseMessages(await readFile(fixture, 'utf8'), fixture);
  const stream = Readable.from(envelopes).pipe(
    new CucumberHtmlStream({ title: 'Window', history }),
  );
  let html = '';
  for await (const chunk of stream) html += chunk;
  return html;
}

describe('reading with a history window', () => {
  it('returns the newest five of seven schema-1 runs without rewriting the file', async () => {
    const base = runs(7);
    const file = await writeRaw('history.json', sidecar(base));
    const before = await readFile(file, 'utf8');

    const read = await readHistory(file, 5);

    expect(ids(read)).toEqual(ids(base.slice(2)));
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('returns all 31 runs when the window is raised to 40', async () => {
    const base = runs(31);
    const file = await writeRaw('history.json', sidecar(base));

    await expect(readHistory(file, 40)).resolves.toHaveLength(31);
  });

  it('reads a 40-run schema-2 file with the default window as the newest 30', async () => {
    const base = runs(40);
    const file = await writeRaw('history.json', sidecar(base, 2));

    const read = await readHistory(file);

    expect(read).toHaveLength(HISTORY_LIMIT);
    expect(ids(read)).toEqual(ids(base.slice(-HISTORY_LIMIT)));
  });

  it('returns one run for a window of one', async () => {
    const base = runs(7);
    const file = await writeRaw('history.json', sidecar(base));

    const read = await readHistory(file, 1);

    expect(ids(read)).toEqual([base[6]?.id]);
  });
});

describe('appending within a history window', () => {
  it('keeps the newest five of seven runs plus the current run', () => {
    const base = runs(7);
    const next = makeRun(99);

    const appended = appendHistory(base, next, 5);

    expect(ids(appended)).toEqual([...ids(base.slice(3)), next.id]);
  });

  it('keeps 40 of 41 runs and 365 of 366 runs', () => {
    const forty = runs(40);
    const fromForty = appendHistory(forty, makeRun(99), 40);
    expect(fromForty).toHaveLength(40);
    expect(ids(fromForty)).toEqual([...ids(forty.slice(1)), 'id-0099']);

    const year = runs(365);
    const fromYear = appendHistory(year, makeRun(999), 365);
    expect(fromYear).toHaveLength(365);
    expect(ids(fromYear)).toEqual([...ids(year.slice(1)), 'id-0999']);
  });

  it('appends 31 entries and a new run into 32 below the window', () => {
    const base = runs(31);
    const next = makeRun(99);

    const appended = appendHistory(base, next, 40);

    expect(appended).toHaveLength(32);
    expect(appended.at(-1)?.id).toBe(next.id);
  });

  it('keeps one run for a window of one', () => {
    const base = runs(7);

    const appended = appendHistory(base, makeRun(99), 1);

    expect(ids(appended)).toEqual(['id-0099']);
  });

  it('dedupes the last run inside a window and keeps its old timestamp', () => {
    const base = runs(31);
    const last = base.at(-1)!;
    const rerun = { ...last, recordedAt: '2026-06-01T00:00:00.000Z' };

    const raised = appendHistory(base, rerun, 40);
    expect(raised).toHaveLength(31);
    expect(raised.at(-1)?.recordedAt).toBe(last.recordedAt);

    const lowered = appendHistory(base, rerun, 5);
    expect(ids(lowered)).toEqual(ids(base.slice(-5)));
    expect(lowered.at(-1)?.recordedAt).toBe(last.recordedAt);
  });
});

describe('writing within a history window', () => {
  it('keeps the newest five of seven runs', async () => {
    const base = runs(7);
    const file = path.join(await tempDir(), 'history.json');

    await writeHistory(file, base, 5);

    expect(ids(await storedRuns(file))).toEqual(ids(base.slice(2)));
  });

  it('keeps all 31 runs below a window of 40 and one run at a window of one', async () => {
    const dir = await tempDir();
    const raised = path.join(dir, 'raised.json');
    const single = path.join(dir, 'single.json');

    await writeHistory(raised, runs(31), 40);
    await writeHistory(single, runs(3), 1);

    await expect(storedRuns(raised)).resolves.toHaveLength(31);
    expect(ids(await storedRuns(single))).toEqual(['id-0002']);
  });

  it('uses exactly 30 when the limit is omitted', async () => {
    const base = runs(40);
    const file = path.join(await tempDir(), 'history.json');

    await writeHistory(file, base);

    const stored = await storedRuns(file);
    expect(stored).toHaveLength(HISTORY_LIMIT);
    expect(ids(stored)).toEqual(ids(base.slice(-HISTORY_LIMIT)));
  });

  it.each([0, 366, 1.5, Number.NaN, -1, 30.5, '10', null])(
    'rejects the API limit %s in every history function without a write',
    async (limit) => {
      const base = runs(3);
      const file = await writeRaw('history.json', sidecar(base));
      const before = await readFile(file, 'utf8');
      const invalid = limit as unknown as number;

      await expect(readHistory(file, invalid)).rejects.toThrow(/1 to 365/);
      expect(() => appendHistory(base, makeRun(9), invalid)).toThrow(/1 to 365/);
      await expect(writeHistory(file, base, invalid)).rejects.toThrow(/1 to 365/);

      await expect(readFile(file, 'utf8')).resolves.toBe(before);
    },
  );

  it('rejects an invalid limit before creating a missing file', async () => {
    const file = path.join(await tempDir(), 'history.json');

    await expect(writeHistory(file, runs(1), 0)).rejects.toThrow(/1 to 365/);
    await expect(writeHistory(file, runs(1), 366)).rejects.toThrow(/1 to 365/);

    await expect(readFile(file, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('quotes a non-number limit and names NaN in the message', () => {
    expect(() => historyWindow('10' as unknown as number)).toThrow(
      'Invalid history limit "10". Use an integer from 1 to 365.',
    );
    expect(() => historyWindow(Number.NaN)).toThrow(
      'Invalid history limit "NaN". Use an integer from 1 to 365.',
    );
  });
});

describe('history schema versions', () => {
  it('stays schema 1 at the default and 30, and writes schema 2 above 30', async () => {
    const dir = await tempDir();
    const implicit = path.join(dir, 'implicit.json');
    const at30 = path.join(dir, 'at-30.json');
    const at31 = path.join(dir, 'at-31.json');
    const at40 = path.join(dir, 'at-40.json');
    const at365 = path.join(dir, 'at-365.json');

    await writeHistory(implicit, runs(1));
    await writeHistory(at30, runs(1), 30);
    await writeHistory(at31, runs(1), 31);
    await writeHistory(at40, runs(1), 40);
    await writeHistory(at365, runs(1), 365);

    expect(await schemaVersion(implicit)).toBe(1);
    expect(await schemaVersion(at30)).toBe(1);
    expect(await schemaVersion(at31)).toBe(2);
    expect(await schemaVersion(at40)).toBe(2);
    expect(await schemaVersion(at365)).toBe(2);
  });

  it('writes schema 2 as a version marker without changing a run field', async () => {
    const base = runs(2);
    const file = path.join(await tempDir(), 'history.json');

    await writeHistory(file, base, 40);

    const document = JSON.parse(await readFile(file, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(document).sort()).toEqual(['runs', 'schemaVersion']);
    expect(document.schemaVersion).toBe(2);
    expect(document.runs).toStrictEqual(base);
  });

  it('never downgrades a schema-2 file on a default read and write', async () => {
    const base = runs(2);
    const file = await writeRaw('history.json', sidecar(base, 2));

    const read = await readHistory(file);
    expect(read).toHaveLength(2);

    await writeHistory(file, appendHistory(read, makeRun(9)));

    expect(await schemaVersion(file)).toBe(2);
    expect(ids(await storedRuns(file))).toEqual(['id-0000', 'id-0001', 'id-0009']);
  });

  it('rejects a schema other than 1 or 2 without a rewrite', async () => {
    const file = await writeRaw('history.json', sidecar(runs(1), 3));
    const before = await readFile(file, 'utf8');

    await expect(readHistory(file, 5)).rejects.toThrow(/history\.json/);
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });
});

describe('history retention', () => {
  it('prunes to the lowered window on write and cannot restore the dropped runs', async () => {
    const base = runs(31);
    const file = await writeRaw('history.json', sidecar(base));
    const before = await readFile(file, 'utf8');

    const read = await readHistory(file, 10);
    expect(ids(read)).toEqual(ids(base.slice(-10)));
    await expect(readFile(file, 'utf8')).resolves.toBe(before);

    await writeHistory(file, appendHistory(read, makeRun(99), 10), 10);

    const pruned = await readHistory(file, 40);
    expect(ids(pruned)).toEqual([...ids(base.slice(-9)), 'id-0099']);

    await writeHistory(file, appendHistory(pruned, makeRun(100), 40), 40);

    const raised = await readHistory(file, 40);
    expect(raised).toHaveLength(11);
    expect(ids(raised)).toEqual([
      ...ids(base.slice(-9)),
      'id-0099',
      'id-0100',
    ]);
  });

  it('raises within the file: 31 entries with a window of 40 store 32', async () => {
    const base = runs(31);
    const file = await writeRaw('history.json', sidecar(base));

    const read = await readHistory(file, 40);
    expect(read).toHaveLength(31);

    await writeHistory(file, appendHistory(read, makeRun(99), 40), 40);

    const stored = await storedRuns(file);
    expect(stored).toHaveLength(32);
    expect(stored.at(-1)?.id).toBe('id-0099');
    expect(await schemaVersion(file)).toBe(2);
  });

  it('keeps 40 of 41 runs at a window of 40', async () => {
    const base = runs(40);
    const file = await writeRaw('history.json', sidecar(base, 2));

    const read = await readHistory(file, 40);
    expect(read).toHaveLength(40);

    await writeHistory(file, appendHistory(read, makeRun(99), 40), 40);

    const stored = await readHistory(file, 40);
    expect(stored).toHaveLength(40);
    expect(ids(stored)).toEqual([...ids(base.slice(1)), 'id-0099']);
  });
});

describe('history write cap', () => {
  it('writes the largest valid window whole, under the cap and without pruning', async () => {
    // The write caps (128-character id, 200-character title) keep a 365-run
    // file far below 1 MiB, so the cap prune cannot fire for accepted runs.
    const base = Array.from({ length: 365 }, (_, index) =>
      makeRun(index, {
        id: `id-${index}-${'😀'.repeat(60)}`,
        title: '😀'.repeat(HISTORY_MAX_TITLE),
      }),
    );
    const file = path.join(await tempDir(), 'history.json');

    await writeHistory(file, base, 365);

    const bytes = Buffer.byteLength(await readFile(file, 'utf8'), 'utf8');
    expect(bytes).toBeLessThanOrEqual(HISTORY_MAX_BYTES);
    expect(await schemaVersion(file)).toBe(2);

    const stored = await storedRuns(file);
    expect(stored).toHaveLength(365);
    expect(ids(stored)).toEqual(ids(base));

    const read = await readHistory(file, 365);
    expect(read).toHaveLength(365);
    expect(read.at(-1)?.id).toBe(base.at(-1)?.id);
  });

  it('accepts exactly 1,048,576 bytes and rejects one byte more', async () => {
    const dir = await tempDir();
    const document = { schemaVersion: 1, runs: [makeRun(0)], padding: '' };
    const base = JSON.stringify(document, null, 2);
    const padding = 'x'.repeat(
      HISTORY_MAX_BYTES - Buffer.byteLength(base, 'utf8'),
    );
    const text = JSON.stringify({ ...document, padding }, null, 2);
    expect(Buffer.byteLength(text, 'utf8')).toBe(HISTORY_MAX_BYTES);

    const exact = path.join(dir, 'exact.json');
    await writeFile(exact, text, 'utf8');
    await expect(readHistory(exact)).resolves.toStrictEqual([makeRun(0)]);

    const over = path.join(dir, 'over.json');
    await writeFile(over, `${text} `, 'utf8');
    await expect(readHistory(over)).rejects.toThrow(/larger than/);
  });

  it('rejects an oversized target with the cap message and leaves it untouched', async () => {
    const file = await writeRaw(
      'history.json',
      JSON.stringify({
        schemaVersion: 1,
        runs: [],
        padding: 'x'.repeat(HISTORY_MAX_BYTES),
      }),
    );
    const before = await readFile(file, 'utf8');

    await expect(writeHistory(file, runs(1))).rejects.toThrow(
      /Cannot write history file .*larger than/,
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('rejects a malformed target instead of overwriting it with schema 1', async () => {
    const file = await writeRaw('history.json', '{"schemaVersion":');
    const before = await readFile(file, 'utf8');

    await expect(writeHistory(file, runs(1))).rejects.toThrow(
      /Cannot write history file .*not valid JSON/,
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('rejects an unsupported target schema instead of overwriting it', async () => {
    const file = await writeRaw('history.json', sidecar(runs(1), 3));
    const before = await readFile(file, 'utf8');

    await expect(writeHistory(file, runs(1))).rejects.toThrow(
      /Cannot write history file .*unsupported schema version "3"/,
    );
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('rejects an over-long id without writing a new file', async () => {
    const file = path.join(await tempDir(), 'history.json');

    await expect(
      writeHistory(file, [makeRun(0, { id: 'x'.repeat(HISTORY_MAX_ID + 1) })]),
    ).rejects.toThrow(/id is longer than 128 characters/);
    await expect(readFile(file, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects an over-long id without touching an existing file', async () => {
    const file = await writeRaw('history.json', sidecar([makeRun(0)]));
    const before = await readFile(file, 'utf8');

    await expect(
      writeHistory(file, [makeRun(0, { id: 'x'.repeat(HISTORY_MAX_ID + 1) })]),
    ).rejects.toThrow(/Cannot write history file/);
    await expect(readFile(file, 'utf8')).resolves.toBe(before);
  });

  it('rejects a non-finite duration instead of writing null', async () => {
    const file = path.join(await tempDir(), 'history.json');

    await expect(
      writeHistory(file, [makeRun(0, { durationMs: Number.NaN })]),
    ).rejects.toThrow(/durationMs must be a non-negative number/);
    await expect(readFile(file, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('still reads an older file whose id is longer than the write cap', async () => {
    const long = makeRun(0, { id: 'x'.repeat(HISTORY_MAX_ID + 1) });
    const file = await writeRaw('history.json', sidecar([long]));

    await expect(readHistory(file)).resolves.toStrictEqual([long]);
  });

  it.each([
    [
      'oversized',
      async (dir: string) =>
        writeRaw(
          'history.json',
          JSON.stringify({
            schemaVersion: 1,
            runs: [],
            padding: 'x'.repeat(HISTORY_MAX_BYTES + 1),
          }),
          dir,
        ),
    ],
    [
      'malformed',
      async (dir: string) =>
        writeRaw(
          'history.json',
          sidecar([makeRun(0)]).replace('"durationMs": 1000', '"durationMs": -1'),
          dir,
        ),
    ],
  ])(
    'keeps rejecting an %s file with a limit and leaves it untouched',
    async (_, create) => {
      const file = await create(await tempDir());
      const before = await readFile(file, 'utf8');

      await expect(readHistory(file, 40)).rejects.toThrow(/history\.json/);
      await expect(readFile(file, 'utf8')).resolves.toBe(before);
    },
  );
});

describe('generateReport history window', () => {
  it('returns the newest five runs and renders five Trends rows', async () => {
    const base = runs(7);

    const generated = await generateReport(fixture, {
      title: 'Window',
      history: base,
      historyLimit: 5,
    });

    expect(generated.history).toHaveLength(5);
    expect(ids(generated.history ?? []).slice(0, 4)).toEqual(ids(base.slice(3)));
    expect(generated.history?.[4]?.title).toBe('Window');
    expect(trendsRows(generated.html)).toBe(5);
    expect(hasTrends(generated.html)).toBe(true);
  });

  it('keeps 40 of 41 runs and renders 40 Trends rows', async () => {
    const base = runs(40);

    const generated = await generateReport(fixture, {
      title: 'Window',
      history: base,
      historyLimit: 40,
    });

    expect(generated.history).toHaveLength(40);
    expect(generated.history?.[0]?.id).toBe('id-0001');
    expect(trendsRows(generated.html)).toBe(40);
  });

  it('uses exactly 30 when historyLimit is omitted', async () => {
    const generated = await generateReport(fixture, { history: runs(31) });

    expect(generated.history).toHaveLength(HISTORY_LIMIT);
    expect(trendsRows(generated.html)).toBe(HISTORY_LIMIT);
  });

  it.each([0, 366, 1.5, '10'])(
    'rejects the historyLimit %s',
    async (limit) => {
      await expect(
        generateReport(fixture, {
          history: runs(1),
          historyLimit: limit as unknown as number,
        }),
      ).rejects.toThrow(/1 to 365/);
    },
  );

  it('renders a 40-entry list as given and does not prune it', async () => {
    const html = await renderReport(fixture, { history: runs(40) });

    expect(trendsRows(html)).toBe(40);
  });

  it('streams a 40-entry list as given and does not prune it', async () => {
    const html = await streamHtml(runs(40));

    expect(trendsRows(html)).toBe(40);
  });
});
