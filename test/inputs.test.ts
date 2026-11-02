import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';

const messages = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('input merging', () => {
  it('merges Messages and legacy JSON into one report', async () => {
    const html = await renderReport([messages, legacy], { title: 'Mixed' });

    expect(html).toContain('Screenshot attachment');
    expect(html).toContain('Happy HTML reporting');
  });

  it('reads a directory of supported reports', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-inputs-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'messages.ndjson'));
    await copyFile(legacy, path.join(dir, 'legacy.json'));

    const html = await renderReport(dir, { title: 'Directory' });

    expect(html).toContain('Screenshot attachment');
    expect(html).toContain('Happy HTML reporting');
  });
});
