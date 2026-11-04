import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';

let directory: string | undefined;

afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

async function writeLegacy(content: unknown): Promise<string> {
  directory ??= await mkdtemp(path.join(tmpdir(), 'tolkira-boundary-'));
  const file = path.join(
    directory,
    `input-${Math.random().toString(16).slice(2)}.json`,
  );
  await writeFile(file, JSON.stringify(content), 'utf8');
  return file;
}

function feature(name: string) {
  return [
    {
      uri: 'features/edge.feature',
      name,
      elements: [
        {
          keyword: 'Scenario',
          type: 'scenario',
          name: `Scenario for ${name}`,
          steps: [
            {
              keyword: 'Given ',
              name: `step for ${name}`,
              result: { status: 'passed', duration: 1 },
            },
          ],
        },
      ],
    },
  ];
}

describe('input boundaries', () => {
  it('renders an empty legacy report without throwing', async () => {
    const file = await writeLegacy([]);
    const summary = await summarizeReport(file);
    const html = await renderReport(file, { title: 'Empty' });

    expect(summary.counts.scenarios.total).toBe(0);
    expect(html).toContain('No scenarios in this report.');
  });

  it('keeps unicode names intact', async () => {
    const name = 'Zahlung prüfen – 日本語 🚀';
    const file = await writeLegacy(feature(name));
    const summary = await summarizeReport(file);
    const html = await renderReport(file, { title: 'Unicode' });

    expect(summary.counts.features).toBe(1);
    expect(summary.scenarios[0]?.feature).toBe(name);
    expect(summary.scenarios[0]?.name).toBe(`Scenario for ${name}`);
    expect(html).toContain(name);
  });

  it('handles a very long name', async () => {
    const name = 'x'.repeat(10_000);
    const file = await writeLegacy(feature(name));
    const summary = await summarizeReport(file);

    expect(summary.scenarios[0]?.feature).toHaveLength(10_000);
    await expect(renderReport(file, { title: 'Long' })).resolves.toContain(
      'Scenario for',
    );
  });

  it('accepts a feature without optional fields', async () => {
    const file = await writeLegacy([
      {
        name: 'Bare feature',
        elements: [
          {
            keyword: 'Scenario',
            type: 'scenario',
            name: 'Bare scenario',
            steps: [
              {
                keyword: 'Given ',
                name: 'a step without match or duration',
                result: { status: 'passed' },
              },
            ],
          },
        ],
      },
    ]);
    const summary = await summarizeReport(file);
    const html = await renderReport(file, { title: 'Bare' });

    expect(summary.counts.scenarios.total).toBe(1);
    expect(summary.scenarios[0]?.durationMs).toBe(0);
    expect(html).toContain('Bare feature');
  });
});
