import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import { generateReport, renderReport, summarizeReport } from '../src/index.js';
import {
  MAX_TOTAL_INPUT_BYTES,
  loadInputs,
  provenanceFor,
} from '../src/input/load.js';
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

const MIB = 1024 * 1024;

function paddedLegacy(name: string, padding: number): string {
  return JSON.stringify([
    {
      uri: `features/${name}.feature`,
      name,
      description: 'x'.repeat(padding),
      elements: [
        {
          keyword: 'Scenario',
          type: 'scenario',
          name: `${name} scenario`,
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
  ]);
}

async function writePaddedLegacy(
  file: string,
  name: string,
  padding: number,
): Promise<void> {
  await writeFile(file, paddedLegacy(name, padding), 'utf8');
}

describe('input accounting', () => {
  it('counts only the supported report in a directory of unrelated JSON files', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-accounting-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'messages.ndjson'));
    await writeFile(
      path.join(dir, 'package.json'),
      '{"name":"not-a-report"}\n',
      'utf8',
    );
    await writeFile(
      path.join(dir, 'tsconfig.json'),
      '{"compilerOptions":{}}\n',
      'utf8',
    );

    const generated = await generateReport(dir, { title: 'Accounting' });
    const reportSize = (await stat(path.join(dir, 'messages.ndjson'))).size;

    expect(generated.inputFiles).toBe(1);
    expect(generated.inputBytes).toBe(reportSize);
    expect(generated.summary.counts.scenarios.total).toBe(2);
    expect(generated.html).toContain('Screenshot attachment');
    expect(generated.html).toContain('1 file');
  });

  it('loads two identical 51 MiB reports once and below the total cap', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-duplicate-large-'));
    tempDirs.push(dir);
    const first = path.join(dir, 'a.json');
    const second = path.join(dir, 'b.json');
    await writePaddedLegacy(first, 'duplicate-large', 51 * MIB);
    await copyFile(first, second);

    const groups = await loadInputs([first, second]);
    const summary = await summarizeReport([first, second]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.bytes).toBe((await stat(first)).size);
    expect(summary.counts.scenarios.total).toBe(1);
    expect((await stat(first)).size).toBeGreaterThan(50 * MIB);
  }, 120_000);

  it('loads a unique file after a skipped and a duplicate path', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-load-order-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'copy.ndjson'));
    await writeFile(
      path.join(dir, 'package.json'),
      '{"name":"not-a-report"}',
      'utf8',
    );
    const inputs = [messages, legacy, dir];
    const summary = await summarizeReport(inputs);
    const generated = await generateReport(inputs);
    const uniqueBytes = (await stat(messages)).size + (await stat(legacy)).size;

    expect(summary.counts.scenarios.total).toBe(8);
    expect(generated.inputFiles).toBe(2);
    expect(generated.inputBytes).toBe(uniqueBytes);
  });

  it('fails unique content above the total cap with the supported remedy', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-over-cap-'));
    tempDirs.push(dir);
    const first = path.join(dir, 'a.json');
    const second = path.join(dir, 'b.json');
    await writePaddedLegacy(first, 'first-over-cap', 51 * MIB);
    await writePaddedLegacy(second, 'second-over-cap', 51 * MIB);

    await expect(summarizeReport([first, second])).rejects.toThrow(
      'Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.',
    );
  }, 120_000);

  it('accepts a unique file at exactly the 100 MiB total cap', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-exact-cap-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'exact.json');
    const base = Buffer.byteLength(paddedLegacy('exact-cap', 0), 'utf8');
    await writePaddedLegacy(file, 'exact-cap', MAX_TOTAL_INPUT_BYTES - base);
    expect((await stat(file)).size).toBe(MAX_TOTAL_INPUT_BYTES);

    const groups = await loadInputs([file]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.bytes).toBe(MAX_TOTAL_INPUT_BYTES);
  }, 120_000);

  it('does not count large skipped files toward the cap or the input bytes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-skip-large-'));
    tempDirs.push(dir);
    const report = path.join(dir, 'messages.ndjson');
    await copyFile(messages, report);
    const skippedA = path.join(dir, 'unrelated.json');
    const skippedB = path.join(dir, 'unrelated2.json');
    await writeFile(
      skippedA,
      JSON.stringify({ name: 'not-a-report', padding: 'x'.repeat(51 * MIB) }),
      'utf8',
    );
    await writeFile(
      skippedB,
      JSON.stringify({
        name: 'also-not-a-report',
        padding: 'y'.repeat(51 * MIB),
      }),
      'utf8',
    );
    const skippedBytes =
      (await stat(skippedA)).size + (await stat(skippedB)).size;
    expect(skippedBytes).toBeGreaterThan(MAX_TOTAL_INPUT_BYTES);

    const groups = await loadInputs(dir);
    const summary = await summarizeReport(dir);
    const html = await renderReport(dir, { title: 'Skipped large' });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.bytes).toBe((await stat(report)).size);
    expect(summary.counts.scenarios.total).toBe(2);
    expect(html).toContain('Screenshot attachment');
    expect(html).toContain('1 file');
  }, 120_000);
});

describe('empty Messages shards in a directory scan', () => {
  it.each([
    ['empty', ''],
    ['BOM-only', '\uFEFF'],
    ['whitespace-only', ' \r\n\t\n'],
    ['BOM and whitespace', '\uFEFF \n\t'],
  ])(
    'skips a %s shard beside a valid report without a warning or group',
    async (_, shard) => {
      const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-shard-'));
      tempDirs.push(dir);
      await copyFile(messages, path.join(dir, 'messages.ndjson'));
      await writeFile(path.join(dir, 'empty.ndjson'), shard, 'utf8');

      const generated = await generateReport(dir, { title: 'Empty shard' });

      expect(generated.inputFiles).toBe(1);
      expect(generated.inputBytes).toBe(
        (await stat(path.join(dir, 'messages.ndjson'))).size,
      );
      expect(generated.summary.counts.scenarios.total).toBe(2);
      expect(generated.html).toContain('Screenshot attachment');
      expect(generated.html).not.toContain('Input is empty');
    },
  );

  it('still rejects an explicitly named empty Messages file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-explicit-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'explicit.ndjson');
    await writeFile(file, '', 'utf8');

    await expect(
      renderReport(file, { title: 'Explicit empty' }),
    ).rejects.toThrow('Input is empty:');
    await expect(
      renderReport(file, { title: 'Explicit empty' }),
    ).rejects.toThrow(path.basename(file));
  });

  it('rejects an explicit empty file deduped behind a scanned shard', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-deduped-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'm-valid.ndjson'));
    await writeFile(path.join(dir, 'a-empty.ndjson'), '', 'utf8');
    const explicit = path.join(dir, 'z-explicit.jsonl');
    await writeFile(explicit, '', 'utf8');
    const before = (await readdir(dir)).sort();

    await expect(
      renderReport([dir, explicit], { title: 'Deduped empty' }),
    ).rejects.toThrow(/Input is empty: .*z-explicit\.jsonl/);
    expect((await readdir(dir)).sort()).toEqual(before);
  });

  it('rejects the same empty pair when the explicit file sorts first', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-order-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'm-valid.ndjson'));
    const explicit = path.join(dir, 'a-explicit.ndjson');
    await writeFile(explicit, '', 'utf8');
    await writeFile(path.join(dir, 'z-empty.ndjson'), '', 'utf8');

    await expect(
      renderReport([dir, explicit], { title: 'Empty order' }),
    ).rejects.toThrow(/Input is empty: .*a-explicit\.ndjson/);
  });

  it('skips an empty shard without a warning', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-quiet-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'messages.ndjson'));
    await writeFile(path.join(dir, 'empty.ndjson'), '', 'utf8');
    let stderr = '';

    const code = await runCli([dir, '--json'], {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });

    expect(code).toBe(0);
    expect(stderr).toBe('');
  });

  it('rejects a directory with only empty shards with the no-report error', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-only-'));
    tempDirs.push(dir);
    await writeFile(path.join(dir, 'a.ndjson'), '', 'utf8');
    await writeFile(path.join(dir, 'b.jsonl'), ' \n\t', 'utf8');

    await expect(renderReport(dir, { title: 'Empty only' })).rejects.toThrow(
      'No supported report files found.',
    );
  });

  it('still rejects a non-empty malformed shard in a directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-malformed-shard-'));
    tempDirs.push(dir);
    await copyFile(messages, path.join(dir, 'messages.ndjson'));
    await writeFile(path.join(dir, 'broken.ndjson'), '{"meta":', 'utf8');

    await expect(
      renderReport(dir, { title: 'Malformed shard' }),
    ).rejects.toThrow(
      /Invalid Cucumber Messages on line 1 of .*broken\.ndjson/,
    );
  });
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
    expect(
      summary.scenarios.filter(
        (scenario) => scenario.uri === 'features/second.feature',
      ),
    ).toHaveLength(2);
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
    await writeFile(
      path.join(dir, 'package.json'),
      '{"name":"not-a-report"}\n',
      'utf8',
    );
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

    const failure = renderReport(dir, { title: 'Broken' });
    await expect(failure).rejects.toThrow('Invalid legacy JSON');
    await expect(failure).rejects.toHaveProperty(
      'cause',
      expect.any(SyntaxError),
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

  it('rejects duplicate Messages ids across inputs', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-dup-ids-'));
    tempDirs.push(dir);
    const content = await readFile(secondMessages, 'utf8');
    const first = path.join(dir, 'a.ndjson');
    const second = path.join(dir, 'b.ndjson');
    await writeFile(first, content, 'utf8');
    await writeFile(second, content.replace('Second', 'Other'), 'utf8');

    await expect(loadInputs([first, second])).rejects.toThrow(
      /Duplicate Cucumber Messages/,
    );
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
        bytes: 0,
        skippedAttachments: 0,
      },
      {
        file: path.resolve('two.json'),
        envelopes: legacyFeature('features/shared.feature', 'two'),
        bytes: 0,
        skippedAttachments: 0,
      },
    ];

    expect(provenanceFor(groups).has('features/shared.feature')).toBe(false);
  });

  it('omits provenance when two inputs share a file name', () => {
    const groups = [
      {
        file: path.resolve('a/report.json'),
        envelopes: legacyFeature('features/a.feature', 'a'),
        bytes: 0,
        skippedAttachments: 0,
      },
      {
        file: path.resolve('b/report.json'),
        envelopes: legacyFeature('features/b.feature', 'b'),
        bytes: 0,
        skippedAttachments: 0,
      },
    ];

    expect(provenanceFor(groups).size).toBe(0);
  });

  it('ignores inputs without features when detecting duplicate names', () => {
    const provenance = provenanceFor([
      {
        file: path.resolve('a/report.json'),
        envelopes: legacyFeature('features/real.feature', 'real'),
        bytes: 0,
        skippedAttachments: 0,
      },
      {
        file: path.resolve('b/report.json'),
        envelopes: [],
        bytes: 0,
        skippedAttachments: 0,
      },
    ]);

    expect(provenance.get('features/real.feature')).toBe('report.json');
  });

  it('checks pickle URIs as well as gherkin URIs', () => {
    const one = legacyFeature('features/one.feature', 'one');
    const two = legacyFeature('features/two.feature', 'two');
    const pickle = two.find((envelope) => envelope.pickle);
    if (pickle?.pickle) pickle.pickle.uri = 'features/one.feature';

    const provenance = provenanceFor([
      {
        file: path.resolve('a.json'),
        bytes: 0,
        envelopes: one,
        skippedAttachments: 0,
      },
      {
        file: path.resolve('b.json'),
        bytes: 0,
        envelopes: two,
        skippedAttachments: 0,
      },
    ]);

    expect(provenance.has('features/one.feature')).toBe(false);
    expect(provenance.get('features/two.feature')).toBe('b.json');
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
