import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';

const fixture = fileURLToPath(
  new URL('./fixtures/junit/basic.xml', import.meta.url),
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

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-junit-'));
  tempDirs.push(dir);
  return dir;
}

describe('JUnit XML input', () => {
  it('maps suites, statuses, durations and system output', async () => {
    const summary = await summarizeReport(fixture);

    expect(summary.counts.scenarios).toMatchObject({
      total: 4,
      passed: 2,
      failed: 1,
      skipped: 1,
    });
    const failed = summary.scenarios.find(
      (scenario) => scenario.status === 'failed',
    );
    expect(failed?.name).toBe('expired coupon');
    expect(failed?.steps[0]?.message).toContain('Expected 200');
    expect(failed?.durationMs).toBeGreaterThan(0);
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBeGreaterThan(0);
  });

  it('renders JUnit XML and merges it with Cucumber input', async () => {
    const junitHtml = await renderReport(fixture, { title: 'JUnit only' });
    expect(junitHtml).toContain('JUnit XML');
    expect(junitHtml).toContain('1 step');
    expect(junitHtml).not.toContain('1 steps');

    const html = await renderReport([fixture, legacy], { title: 'Mixed' });

    expect(html).toContain('checkout');
    expect(html).toContain('expired coupon');
    expect(html).toContain('Expected 200');
    expect(html).toContain('request id: abc');
    expect(html).toContain('Happy HTML reporting');
  });

  it('rejects malformed JUnit XML', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'broken.xml');
    await writeFile(file, '<testsuites><testsuite>', 'utf8');

    await expect(renderReport(file, { title: 'Broken' })).rejects.toThrow(
      /JUnit XML/,
    );
  });

  it('ignores unrelated XML in a directory', async () => {
    const dir = await tempDir();
    await copyFile(fixture, path.join(dir, 'junit.xml'));
    await writeFile(path.join(dir, 'notes.xml'), '<notes />', 'utf8');

    const html = await renderReport(dir, { title: 'Directory' });

    expect(html).toContain('expired coupon');
  });
});
