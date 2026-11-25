import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { generate } from '../src/compat/cucumber-html-reporter.js';

const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);

interface LegacyElement {
  id?: string;
  name?: string;
  retried?: number;
  [key: string]: unknown;
}

interface LegacyFeature {
  uri?: string;
  name?: string;
  elements: LegacyElement[];
  [key: string]: unknown;
}

const tempDirs: string[] = [];

const byCodeUnit = (a: string | undefined, b: string | undefined): number =>
  (a ?? '') < (b ?? '') ? -1 : (a ?? '') > (b ?? '') ? 1 : 0;

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-sidecar-'));
  tempDirs.push(dir);
  return dir;
}

async function happyFeatures(): Promise<[LegacyFeature, ...LegacyFeature[]]> {
  const features = JSON.parse(
    await readFile(legacy, 'utf8'),
  ) as LegacyFeature[];
  const [first] = features;
  if (first === undefined) {
    throw new Error('legacy happy fixture is empty');
  }
  return [first, ...features.slice(1)];
}

async function writeFeature(
  file: string,
  feature: LegacyFeature,
): Promise<void> {
  await writeFile(file, JSON.stringify([feature], null, 2), 'utf8');
}

async function readSidecar(file: string): Promise<LegacyFeature[]> {
  return JSON.parse(await readFile(file, 'utf8')) as LegacyFeature[];
}

async function expectNoSidecar(file: string): Promise<void> {
  await expect(readFile(file, 'utf8')).rejects.toThrow(/ENOENT/);
}

describe('compat merged JSON sidecar', () => {
  it('writes the merged legacy array next to a jsonDir report', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'one.json'), {
      ...happy,
      uri: 'features/one.feature',
      elements: happy.elements.slice(0, 2),
    });
    await writeFeature(path.join(dir, 'two.json'), {
      ...happy,
      uri: 'features/two.feature',
      elements: happy.elements.slice(2),
    });
    const output = path.join(dir, 'reports', 'group.html');

    await generate({ jsonDir: dir, output });

    await expect(readFile(output, 'utf8')).resolves.toContain(
      'Happy HTML reporting',
    );
    const sidecarPath = `${output}.json`;
    const raw = await readFile(sidecarPath, 'utf8');
    const merged = JSON.parse(raw) as LegacyFeature[];

    expect(merged.map((feature) => feature.uri).sort(byCodeUnit)).toEqual([
      'features/one.feature',
      'features/two.feature',
    ]);
    expect(
      merged.find((feature) => feature.uri === 'features/one.feature')
        ?.elements,
    ).toHaveLength(2);
    expect(
      merged.find((feature) => feature.uri === 'features/two.feature')
        ?.elements,
    ).toHaveLength(4);
    expect(
      merged
        .flatMap((feature) => feature.elements)
        .every((element) => element.retried === 0),
    ).toBe(true);
    expect(raw).toBe(JSON.stringify(merged, null, 2));
  });

  it('concatenates elements of features with the same uri', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'first.json'), {
      ...happy,
      elements: happy.elements.slice(0, 2),
    });
    await writeFeature(path.join(dir, 'second.json'), {
      ...happy,
      elements: happy.elements.slice(2),
    });
    const output = path.join(dir, 'report.html');

    await generate({ jsonDir: dir, output });

    const merged = await readSidecar(`${output}.json`);
    expect(merged).toHaveLength(1);
    expect(
      merged[0]!.elements.map((element) => element.id).sort(byCodeUnit),
    ).toEqual(happy.elements.map((element) => element.id).sort(byCodeUnit));
    expect(merged[0]!.elements.every((element) => element.retried === 0)).toBe(
      true,
    );
  });

  it('merges features without a uri under one fallback key', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    const first = { ...happy, elements: happy.elements.slice(0, 2) };
    const second = { ...happy, elements: happy.elements.slice(2) };
    delete first.uri;
    delete second.uri;
    await writeFeature(path.join(dir, 'first.json'), first);
    await writeFeature(path.join(dir, 'second.json'), second);
    const output = path.join(dir, 'report.html');

    await generate({ jsonDir: dir, output });

    const merged = await readSidecar(`${output}.json`);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.elements).toHaveLength(happy.elements.length);
  });

  it('writes no sidecar for jsonFile, even with jsonDir', async () => {
    const dir = await tempDir();
    await copyFile(legacy, path.join(dir, 'feature.json'));
    const fileOnly = path.join(dir, 'file-only.html');
    const both = path.join(dir, 'both.html');

    await generate({ jsonFile: legacy, output: fileOnly });
    await generate({ jsonFile: legacy, jsonDir: dir, output: both });

    await expectNoSidecar(`${fileOnly}.json`);
    await expectNoSidecar(`${both}.json`);
  });

  it('refuses to overwrite an input with the sidecar', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'report.html.json');
    const [happy] = await happyFeatures();
    await writeFeature(input, happy);
    const before = await readFile(input, 'utf8');

    await expect(
      generate({ jsonDir: dir, output: path.join(dir, 'report.html') }),
    ).rejects.toThrow(/must not overwrite an input file/);

    await expect(readFile(input, 'utf8')).resolves.toBe(before);
  });

  it('leaves no sidecar when the HTML report cannot be written', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'feature.json'), happy);
    const output = path.join(dir, 'report.html');
    await mkdir(output);

    await expect(generate({ jsonDir: dir, output })).rejects.toThrow(
      /EISDIR|EPERM|EACCES|ENOENT/,
    );

    await expectNoSidecar(`${output}.json`);
  });

  it('skips and replaces a non-feature array at the reserved sidecar path', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'source.json'), {
      ...happy,
      uri: 'features/source.feature',
    });
    const output = path.join(dir, 'report.html');
    await writeFile(`${output}.json`, '[1,2,3]', 'utf8');

    const result = await generate({
      jsonDir: dir,
      output,
      ignoreBadJsonFile: true,
    });

    expect(
      result.warnings.some((line) => line.includes('report.html.json')),
    ).toBe(true);
    await expect(readFile(output, 'utf8')).resolves.toContain(
      'Happy HTML reporting',
    );
    const merged = await readSidecar(`${output}.json`);
    expect(merged.map((feature) => feature.uri)).toEqual([
      'features/source.feature',
    ]);
  });

  it('fails without the flag for a non-feature array at the reserved sidecar path', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'source.json'), {
      ...happy,
      uri: 'features/source.feature',
    });
    const output = path.join(dir, 'report.html');
    const input = `${output}.json`;
    await writeFile(input, '[1,2,3]', 'utf8');
    const before = await readFile(input, 'utf8');

    await expect(generate({ jsonDir: dir, output })).rejects.toThrow(
      `compat: ${input} is not a legacy feature array`,
    );

    await expect(readFile(input, 'utf8')).resolves.toBe(before);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('replaces a stale sidecar', async () => {
    const dir = await tempDir();
    const inputs = path.join(dir, 'features');
    await mkdir(inputs);
    const [happy] = await happyFeatures();
    await writeFeature(path.join(inputs, 'happy.json'), happy);
    const output = path.join(dir, 'reports', 'group.html');
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(`${output}.json`, '[{"uri":"stale"}]', 'utf8');

    await generate({ jsonDir: inputs, output });

    const merged = await readSidecar(`${output}.json`);
    expect(merged.map((feature) => feature.uri)).toEqual([
      'features/happy.feature',
    ]);
    expect(
      merged
        .flatMap((feature) => feature.elements)
        .every((element) => element.retried === 0),
    ).toBe(true);
  });

  it('replaces its own sidecar on a second run inside jsonDir', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'one.json'), {
      ...happy,
      uri: 'features/one.feature',
      elements: happy.elements.slice(0, 2),
    });
    await writeFeature(path.join(dir, 'two.json'), {
      ...happy,
      uri: 'features/two.feature',
      elements: happy.elements.slice(2),
    });
    const output = path.join(dir, 'group.html');

    const first = await generate({ jsonDir: dir, output });
    const firstSidecar = await readSidecar(`${output}.json`);
    const second = await generate({ jsonDir: dir, output });
    const secondSidecar = await readSidecar(`${output}.json`);

    expect(secondSidecar).toEqual(firstSidecar);
    expect(
      secondSidecar.map((feature) => feature.uri).sort(byCodeUnit),
    ).toEqual(['features/one.feature', 'features/two.feature']);
    expect(second.summary.counts.scenarios.total).toBe(
      first.summary.counts.scenarios.total,
    );
    await expect(readFile(output, 'utf8')).resolves.toContain(
      'Happy HTML reporting',
    );
  });

  it('refuses a sidecar input with a unique feature uri', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'source.json'), {
      ...happy,
      uri: 'features/source.feature',
    });
    const input = path.join(dir, 'report.html.json');
    await writeFeature(input, {
      ...happy,
      uri: 'features/unique.feature',
    });
    const before = await readFile(input, 'utf8');

    await expect(
      generate({ jsonDir: dir, output: path.join(dir, 'report.html') }),
    ).rejects.toThrow(/must not overwrite an input file/);

    await expect(readFile(input, 'utf8')).resolves.toBe(before);
  });

  it('refuses non-array JSON at the sidecar path', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'source.json'), happy);
    const input = path.join(dir, 'report.html.json');
    await writeFile(input, '{"features":[]}', 'utf8');
    const before = await readFile(input, 'utf8');
    const output = path.join(dir, 'report.html');

    await expect(generate({ jsonDir: dir, output })).rejects.toThrow(input);

    await expect(readFile(input, 'utf8')).resolves.toBe(before);
    await expect(readFile(output, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('refuses a sidecar with represented and unique uris', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'source.json'), {
      ...happy,
      uri: 'features/source.feature',
    });
    const input = path.join(dir, 'report.html.json');
    await writeFile(
      input,
      JSON.stringify(
        [
          { ...happy, uri: 'features/source.feature', elements: [] },
          { ...happy, uri: 'features/unique.feature', elements: [] },
        ],
        null,
        2,
      ),
      'utf8',
    );
    const before = await readFile(input, 'utf8');
    const output = path.join(dir, 'report.html');

    await expect(generate({ jsonDir: dir, output })).rejects.toThrow(input);

    await expect(readFile(input, 'utf8')).resolves.toBe(before);
    await expect(readFile(output, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('handles a BOM source on first and second runs', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFile(
      path.join(dir, 'happy.json'),
      `\uFEFF${JSON.stringify([happy], null, 2)}`,
      'utf8',
    );
    const output = path.join(dir, 'report.html');

    const first = await generate({ jsonDir: dir, output });
    const firstSidecar = await readSidecar(`${output}.json`);
    const second = await generate({ jsonDir: dir, output });
    const secondSidecar = await readSidecar(`${output}.json`);

    expect(secondSidecar).toEqual(firstSidecar);
    expect(second.summary.counts.scenarios.total).toBe(
      first.summary.counts.scenarios.total,
    );
    await expect(readFile(output, 'utf8')).resolves.toContain(
      'Happy HTML reporting',
    );
  });

  it('accepts a BOM source when ignoreBadJsonFile is set', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFile(
      path.join(dir, 'happy.json'),
      `\uFEFF${JSON.stringify([happy], null, 2)}`,
      'utf8',
    );
    const output = path.join(dir, 'report.html');

    const result = await generate({
      jsonDir: dir,
      output,
      ignoreBadJsonFile: true,
    });

    expect(result.warnings.some((line) => line.includes('happy.json'))).toBe(
      false,
    );
    await expect(readFile(output, 'utf8')).resolves.toContain(
      'Happy HTML reporting',
    );
    const merged = await readSidecar(`${output}.json`);
    expect(merged).toHaveLength(1);
  });

  it('replaces its own sidecar in a jsonDir subdirectory', async () => {
    const dir = await tempDir();
    const features = path.join(dir, 'features');
    await mkdir(features);
    const [happy] = await happyFeatures();
    await writeFeature(path.join(features, 'one.json'), {
      ...happy,
      uri: 'features/one.feature',
      elements: happy.elements.slice(0, 2),
    });
    await writeFeature(path.join(features, 'two.json'), {
      ...happy,
      uri: 'features/two.feature',
      elements: happy.elements.slice(2),
    });
    const output = path.join(dir, 'reports', 'group.html');

    const first = await generate({ jsonDir: dir, output });
    const firstSidecar = await readSidecar(`${output}.json`);
    const second = await generate({ jsonDir: dir, output });
    const secondSidecar = await readSidecar(`${output}.json`);

    expect(secondSidecar).toEqual(firstSidecar);
    expect(second.summary.counts.scenarios.total).toBe(
      first.summary.counts.scenarios.total,
    );
  });

  it('rejects a legacy file with a non-object feature before the HTML', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    const input = path.join(dir, 'mixed.json');
    await writeFile(
      input,
      JSON.stringify([happy, 'not-a-feature'], null, 2),
      'utf8',
    );
    const before = await readFile(input, 'utf8');
    const output = path.join(dir, 'report.html');

    await expect(generate({ jsonDir: dir, output })).rejects.toThrow(input);

    await expect(readFile(input, 'utf8')).resolves.toBe(before);
    await expect(readFile(output, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('rejects non-legacy JSON in jsonDir before the HTML', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'playwright.json');
    await writeFile(
      input,
      JSON.stringify({ config: {}, suites: [] }, null, 2),
      'utf8',
    );
    const output = path.join(dir, 'report.html');

    await expect(generate({ jsonDir: dir, output })).rejects.toThrow(input);

    await expect(readFile(output, 'utf8')).rejects.toThrow(/ENOENT/);
  });

  it('merges only valid files when ignoreBadJsonFile is set', async () => {
    const dir = await tempDir();
    const [happy] = await happyFeatures();
    await writeFeature(path.join(dir, 'good.json'), happy);
    await writeFile(path.join(dir, 'bad.json'), '{not json', 'utf8');
    const output = path.join(dir, 'report.html');

    const result = await generate({
      jsonDir: dir,
      output,
      ignoreBadJsonFile: true,
    });

    expect(result.warnings.some((line) => line.includes('bad.json'))).toBe(
      true,
    );
    await expect(readFile(output, 'utf8')).resolves.toContain(
      'Happy HTML reporting',
    );
    const merged = await readSidecar(`${output}.json`);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.elements.every((element) => element.retried === 0)).toBe(
      true,
    );
  });
});

describe('compat merged sidecar argument boundary', () => {
  function backgroundFeature(
    uri: string,
    count: number,
    prefix: string,
  ): LegacyFeature {
    return {
      uri,
      name: 'Merged backgrounds',
      elements: Array.from({ length: count }, (_, index) => ({
        keyword: 'Background',
        type: 'background',
        name: `${prefix}${index}`,
      })),
    };
  }

  async function writeBoundaryFeatures(
    dir: string,
    first: number,
    second: number,
  ): Promise<string> {
    const uri = 'features/duplicate.feature';
    await writeFeature(
      path.join(dir, 'first.json'),
      backgroundFeature(uri, first, 'a'),
    );
    await writeFeature(
      path.join(dir, 'second.json'),
      backgroundFeature(uri, second, 'b'),
    );
    return path.join(dir, 'report.html');
  }

  it('merges two same-URI features with about 65,000 elements each', async () => {
    const dir = await tempDir();
    const output = await writeBoundaryFeatures(dir, 65_000, 65_000);

    await expect(generate({ jsonDir: dir, output })).resolves.toBeDefined();

    const merged = await readSidecar(`${output}.json`);
    const elements = merged[0]?.elements ?? [];
    expect(elements).toHaveLength(130_000);
    expect(elements[0]?.name).toBe('a0');
    expect(elements[64_999]?.name).toBe('a64999');
    expect(elements[65_000]?.name).toBe('b0');
    expect(elements[129_999]?.name).toBe('b64999');
    expect(elements.every((element) => element.retried === 0)).toBe(true);
  }, 60_000);

  it('merges a duplicate feature above the engine argument limit without RangeError', async () => {
    const dir = await tempDir();
    const output = await writeBoundaryFeatures(dir, 1, 200_000);

    await expect(generate({ jsonDir: dir, output })).resolves.toBeDefined();

    const merged = await readSidecar(`${output}.json`);
    const elements = merged[0]?.elements ?? [];
    expect(elements).toHaveLength(200_001);
    expect(elements[0]?.name).toBe('a0');
    expect(elements[1]?.name).toBe('b0');
    expect(elements[200_000]?.name).toBe('b199999');
    expect(elements.every((element) => element.retried === 0)).toBe(true);
  }, 120_000);

  it('merges a single element and an empty feature in input order', async () => {
    const dir = await tempDir();
    const output = await writeBoundaryFeatures(dir, 0, 1);

    await expect(generate({ jsonDir: dir, output })).resolves.toBeDefined();

    const merged = await readSidecar(`${output}.json`);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.elements.map((element) => element.name)).toEqual(['b0']);
    expect(merged[0]?.elements[0]?.retried).toBe(0);
  });
});
