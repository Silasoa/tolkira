import { afterEach, describe, expect, it } from 'vitest';
import {
  renderReport,
  summarizeReport,
  type ReportSummary,
} from '../src/index.js';

const byCodeUnit = (a: string | undefined, b: string | undefined): number =>
  (a ?? '') < (b ?? '') ? -1 : (a ?? '') > (b ?? '') ? 1 : 0;
import { junitFixture, legacyFixture, messagesFixture } from './fixtures.js';
import {
  baselineBlock,
  changeOf,
  cleanupTempDirs,
  exampleOf,
  makeTempDir,
  mixedBaseline,
  mixedFeatures,
  projectSummary,
  scenarioOf,
  summarizeWithBaseline,
  writeLegacyRun,
  type BaselineScenario,
  type BaselineSummary,
} from './baseline-helpers.js';

afterEach(cleanupTempDirs);

const examplesFile = messagesFixture('examples-tables.ndjson');
const emptyFile = messagesFixture('empty-none.ndjson');
const unexecutedOutline = messagesFixture('empty-outline-mixed.ndjson');

async function mixedRun(): Promise<{
  file: string;
  baseline: BaselineSummary;
}> {
  const dir = await makeTempDir();
  return {
    file: await writeLegacyRun(dir, 'mixed.json', mixedFeatures()),
    baseline: mixedBaseline(),
  };
}

describe('baseline JSON block', () => {
  it('appears only with a baseline, stays schema 2 and keeps the block position', async () => {
    const { file, baseline } = await mixedRun();
    const without = await summarizeReport(file);
    const withBaseline = await summarizeWithBaseline(file, { baseline });

    expect(without).not.toHaveProperty('baseline');
    expect(JSON.stringify(without)).not.toContain('"change"');
    expect(JSON.stringify(without)).not.toContain('notInThisRun');

    expect(withBaseline.schemaVersion).toBe(2);
    expect(Object.keys(withBaseline)).toEqual([
      'schemaVersion',
      'status',
      'durationMs',
      'counts',
      'attachments',
      'baseline',
      'scenarios',
    ]);
    const block = baselineBlock(withBaseline);
    expect(block.status).toBe('failed');
    expect(Object.keys(block)).toEqual(['status', 'counts', 'notInThisRun']);
    expect(Object.keys(block.counts)).toEqual([
      'newFailures',
      'fixed',
      'stillFailing',
      'other',
      'notInThisRun',
      'added',
      'ambiguous',
    ]);
  });

  it('classifies every current row and omits change for no-claim rows', async () => {
    const { file, baseline } = await mixedRun();
    const summary = await summarizeWithBaseline(file, { baseline });

    expect(changeOf(summary, 'new one')).toBe('new-failure');
    expect(changeOf(summary, 'new two')).toBe('new-failure');
    expect(changeOf(summary, 'fixed one')).toBe('fixed');
    expect(changeOf(summary, 'still one')).toBe('still-failing');
    expect(changeOf(summary, 'still two')).toBe('still-failing');
    expect(changeOf(summary, 'still three')).toBe('still-failing');
    expect(changeOf(summary, 'other one')).toBeUndefined();
    expect(changeOf(summary, 'added one')).toBe('added');
    expect(changeOf(summary, 'unchanged one')).toBeUndefined();

    const changed = scenarioOf(summary, 'new one');
    expect(changed).toBeDefined();
    if (!changed) return;
    const keys = Object.keys(changed);
    expect(keys.indexOf('change')).toBeGreaterThan(keys.indexOf('executed'));
    expect(changed).not.toHaveProperty('id');

    const block = baselineBlock(summary);
    expect(block.counts).toMatchObject({
      newFailures: 2,
      fixed: 1,
      stillFailing: 3,
      notInThisRun: 1,
      added: 1,
      ambiguous: 0,
    });
    const residual =
      9 -
      (block.counts.newFailures +
        block.counts.fixed +
        block.counts.stillFailing +
        block.counts.notInThisRun);
    expect(residual).toBe(2);
    expect(block.counts.other).toBe(2);
  });

  it('takes the baseline overall status from the baseline document', async () => {
    const file = legacyFixture('minimal.json');
    const passed = projectSummary(await summarizeReport(file));
    expect(passed.status).toBe('passed');

    const summary = await summarizeWithBaseline(file, { baseline: passed });
    expect(baselineBlock(summary).status).toBe('passed');
  });
});

describe('outline example coordinate', () => {
  it('labels every Messages outline row and agrees with the report', async () => {
    const summary = await summarizeReport(examplesFile);
    const rows = summary.scenarios as Array<
      ReportSummary['scenarios'][number] & { example?: string }
    >;
    const examples = rows.map((row) => row.example);
    expect([...examples].sort(byCodeUnit)).toEqual(
      ['#1.1', '#1.2', '#2.1', '#2.2', '#1.1', '#1.2', '#1.3'].sort(byCodeUnit),
    );

    const keys = Object.keys(rows[0] ?? {});
    expect(keys.indexOf('example')).toBeGreaterThan(keys.indexOf('attempt'));

    const html = await renderReport(examplesFile, { title: 'Labels' });
    const reportLabels = [...html.matchAll(/data-example="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(reportLabels.sort(byCodeUnit)).toEqual(
      examples
        .filter((value): value is string => value !== undefined)
        .sort(byCodeUnit),
    );
  });

  it('labels a started but unexecuted outline row', async () => {
    const summary = await summarizeReport(unexecutedOutline);
    expect(summary.scenarios).toHaveLength(1);
    expect(summary.scenarios[0]).toMatchObject({ executed: false });
    expect(exampleOf(summary, 'Eat 1 cucumbers')).toBe('#1.1');
  });

  it('omits example from plain, legacy and JUnit rows', async () => {
    const plain = await summarizeReport(messagesFixture('screenshot.ndjson'));
    const legacy = await summarizeReport(legacyFixture('happy.json'));
    const junit = await summarizeReport(junitFixture('basic.xml'));

    for (const summary of [plain, legacy, junit]) {
      for (const row of summary.scenarios) {
        expect(row).not.toHaveProperty('example');
      }
    }
  });
});

describe('notInThisRun', () => {
  it('carries executed, sorts numerically and puts rows without example last', async () => {
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Alpha',
          name: 'one',
          uri: 'features/alpha.feature',
          status: 'failed',
          executed: true,
          example: '#1.10',
        },
        {
          feature: 'Alpha',
          name: 'one',
          uri: 'features/alpha.feature',
          status: 'passed',
          executed: true,
          example: '#1.2',
        },
        {
          feature: 'Alpha',
          name: 'one',
          uri: 'features/alpha.feature',
          status: 'unknown',
          executed: false,
        },
        {
          feature: 'Beta',
          name: 'one',
          uri: 'features/beta.feature',
          status: 'failed',
          executed: true,
          example: '#1.1',
        },
      ],
    };

    const summary = await summarizeWithBaseline(emptyFile, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts.notInThisRun).toBe(4);
    expect(block.notInThisRun.map((row) => row.example ?? 'none')).toEqual([
      '#1.2',
      '#1.10',
      'none',
      '#1.1',
    ]);
    expect(block.notInThisRun[2]).toMatchObject({
      feature: 'Alpha',
      name: 'one',
      uri: 'features/alpha.feature',
      status: 'unknown',
      executed: false,
    });
    expect(Object.keys(block.notInThisRun[0] ?? {})).toEqual([
      'feature',
      'name',
      'uri',
      'status',
      'executed',
      'example',
    ]);
    expect(Object.keys(block.notInThisRun[2] ?? {})).toEqual([
      'feature',
      'name',
      'uri',
      'status',
      'executed',
    ]);
    for (const row of block.notInThisRun) {
      expect(row).not.toHaveProperty('id');
    }
  });

  it('breaks a full tie by URI', async () => {
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'passed',
      scenarios: [
        {
          feature: 'Alpha',
          name: 'one',
          uri: 'features/b.feature',
          status: 'passed',
          executed: true,
          example: '#1.1',
        },
        {
          feature: 'Alpha',
          name: 'one',
          uri: 'features/a.feature',
          status: 'passed',
          executed: true,
          example: '#1.1',
        },
      ],
    };

    const summary = await summarizeWithBaseline(emptyFile, { baseline });
    expect(baselineBlock(summary).notInThisRun.map((row) => row.uri)).toEqual([
      'features/a.feature',
      'features/b.feature',
    ]);
  });

  it('caps the list at 50 while the count stays complete', async () => {
    const scenarios: BaselineScenario[] = Array.from(
      { length: 60 },
      (_, index) => ({
        feature: 'Cap',
        name: `s${String(index).padStart(2, '0')}`,
        uri: 'features/cap.feature',
        status: 'failed',
        executed: true,
      }),
    );
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios,
    };

    const summary = await summarizeWithBaseline(emptyFile, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts.notInThisRun).toBe(60);
    expect(block.notInThisRun).toHaveLength(50);
    expect(block.notInThisRun[0]?.name).toBe('s00');
    expect(block.notInThisRun[49]?.name).toBe('s49');
  });

  it('never embeds an absolute path and keeps .. unresolved', async () => {
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Path',
          name: 'absolute',
          uri: 'C:\\Users\\name\\proj\\features\\secret.feature',
          status: 'failed',
          executed: true,
        },
        {
          feature: 'Path',
          name: 'dotdot',
          uri: 'features/../secret.feature',
          status: 'failed',
          executed: true,
        },
      ],
    };

    const summary = await summarizeWithBaseline(emptyFile, { baseline });
    const block = baselineBlock(summary);
    const uris = block.notInThisRun.map((row) => row.uri);

    expect(uris).toContain('features/secret.feature');
    expect(uris).toContain('features/../secret.feature');
    const json = JSON.stringify(summary);
    expect(json).not.toContain('Users');
    expect(json).not.toContain('C:');
  });

  it('adds no id field anywhere in the summary', async () => {
    const { file, baseline } = await mixedRun();
    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);
    expect(block.notInThisRun.length).toBeGreaterThan(0);
    const json = JSON.stringify(summary);

    expect(json).not.toContain('"id"');
    expect(json).not.toContain('pickleId');
    for (const scenario of summary.scenarios) {
      expect(scenario).not.toHaveProperty('id');
    }
  });
});
