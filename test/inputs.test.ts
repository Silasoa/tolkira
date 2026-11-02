import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

  it('detects a Messages file with a .json extension', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-sniff-'));
    tempDirs.push(dir);
    const renamed = path.join(dir, 'messages.json');
    await copyFile(messages, renamed);

    const html = await renderReport(renamed, { title: 'Sniffed messages' });
    expect(html).toContain('Screenshot attachment');
  });

  it('detects a legacy file with an .ndjson extension', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-sniff-'));
    tempDirs.push(dir);
    const renamed = path.join(dir, 'legacy.ndjson');
    await copyFile(legacy, renamed);

    const html = await renderReport(renamed, { title: 'Sniffed legacy' });
    expect(html).toContain('Happy HTML reporting');
  });

  it('skips unrelated JSON files in a directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-skip-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'messages.ndjson'));
    await writeFile(path.join(dir, 'package.json'), '{"name":"not-a-report"}\n', 'utf8');

    const html = await renderReport(dir, { title: 'Skipped' });
    expect(html).toContain('Screenshot attachment');
    expect(html).not.toContain('not-a-report');
  });
});
