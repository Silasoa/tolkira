import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';
import { loadInputs, provenanceFor } from '../src/input/load.js';
import { parseLegacyJson } from '../src/input/legacy.js';

const messages = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const secondMessages = fileURLToPath(
  new URL('./fixtures/messages/second.ndjson', import.meta.url),
);

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('input merging', () => {
  it('merges two Messages inputs with stable order', async () => {
    const summary = await summarizeReport([messages, secondMessages]);

    expect(summary.counts.scenarios.total).toBe(4);
    expect(summary.scenarios.map((scenario) => scenario.uri)).toEqual(
      expect.arrayContaining([
        'features/screenshot.feature',
        'features/second.feature',
      ]),
    );
    expect(summary.scenarios.filter((scenario) => scenario.uri === 'features/second.feature'))
      .toHaveLength(2);
  });

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

  it('reads supported reports from nested directories', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-nested-'));
    tempDirs.push(dir);
    const nested = path.join(dir, 'sub', 'deeper');
    await mkdir(nested, { recursive: true });
    await copyFile(messages, path.join(nested, 'messages.ndjson'));

    const html = await renderReport(dir, { title: 'Nested' });

    expect(html).toContain('Screenshot attachment');
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
    await writeFile(path.join(dir, 'numbers.json'), '[1,2,3]\n', 'utf8');

    const html = await renderReport(dir, { title: 'Skipped' });
    expect(html).toContain('Screenshot attachment');
    expect(html).not.toContain('not-a-report');
  });

  it('rejects an explicit array that is not a legacy report', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-invalid-'));
    tempDirs.push(dir);
    const numbers = path.join(dir, 'numbers.json');
    await writeFile(numbers, '[1,2,3]\n', 'utf8');

    await expect(renderReport(numbers, { title: 'Nope' })).rejects.toThrow(
      'Unsupported input',
    );
  });

  it('rejects a malformed report inside a directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-broken-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'messages.ndjson'));
    await writeFile(
      path.join(dir, 'broken.json'),
      '[{"name":"Broken","elements":[',
      'utf8',
    );

    await expect(renderReport(dir, { title: 'Broken' })).rejects.toThrow(
      'Invalid legacy JSON',
    );
  });

  it('rejects a truncated Messages file inside a directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-broken-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'messages.ndjson'));
    await writeFile(path.join(dir, 'broken.ndjson'), '{"meta":', 'utf8');

    await expect(renderReport(dir, { title: 'Broken' })).rejects.toThrow(
      'Invalid Cucumber Messages',
    );
  });

  it('deduplicates identical content under different names', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-copy-'));
    tempDirs.push(dir);
    const copy = path.join(dir, 'copy.ndjson');
    await copyFile(messages, copy);

    const summary = await summarizeReport([messages, copy]);
    expect(summary.counts.scenarios.total).toBe(2);
    expect(summary.attachments.total).toBe(1);

    const single = await renderReport(messages, { title: 'Copy' });
    const doubled = await renderReport([messages, copy], { title: 'Copy' });
    expect(doubled).toBe(single);
  });

  it('deduplicates the same file passed twice', async () => {
    const summary = await summarizeReport([messages, messages]);

    expect(summary.counts.scenarios.total).toBe(2);
    expect(summary.attachments.total).toBe(1);
  });

  it('deduplicates a file and its containing directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-dedupe-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'messages.ndjson');
    await copyFile(messages, file);

    const summary = await summarizeReport([dir, file]);
    expect(summary.counts.scenarios.total).toBe(2);
  });

  it('groups inputs and maps unique feature URIs to file names', async () => {
    const groups = await loadInputs([messages, legacy]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => path.basename(group.file))).toEqual(
      expect.arrayContaining(['screenshot.ndjson', 'happy.json']),
    );

    const provenance = provenanceFor(groups);
    expect(provenance.get('features/screenshot.feature')).toBe(
      'screenshot.ndjson',
    );
    expect(provenance.get('features/happy.feature')).toBe('happy.json');
  });

  it('omits provenance for a URI shared by two inputs', () => {
    const groups = [
      {
        file: path.resolve('one.json'),
        envelopes: legacyFeature('features/shared.feature', 'one'),
      },
      {
        file: path.resolve('two.json'),
        envelopes: legacyFeature('features/shared.feature', 'two'),
      },
    ];

    expect(provenanceFor(groups).has('features/shared.feature')).toBe(false);
  });

  it('omits provenance when two inputs share a file name', () => {
    const groups = [
      {
        file: path.resolve('a/report.json'),
        envelopes: legacyFeature('features/a.feature', 'a'),
      },
      {
        file: path.resolve('b/report.json'),
        envelopes: legacyFeature('features/b.feature', 'b'),
      },
    ];

    expect(provenanceFor(groups).size).toBe(0);
  });
});

function legacyFeature(uri: string, scenario: string) {
  return parseLegacyJson(
    JSON.stringify([
      {
        uri,
        name: uri,
        elements: [
          {
            keyword: 'Scenario',
            type: 'scenario',
            name: scenario,
            steps: [
              {
                keyword: 'Given ',
                name: 'a step',
                result: { status: 'passed', duration: 1 },
              },
            ],
          },
        ],
      },
    ]),
    `${scenario}.json`,
  );
}
