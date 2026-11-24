import { afterEach, describe, expect, it } from 'vitest';
import { summarizeReport, type ReportSummary, type SummaryScenario } from '../src/index.js';
import { messagesFixture } from './fixtures.js';
import {
  baselineBlock,
  changeOf,
  cleanupTempDirs,
  makeTempDir,
  projectSummary,
  summarizeWithBaseline,
  writeLegacyRun,
  type BaselineScenario,
  type BaselineSummary,
  type SyntheticFeature,
} from './baseline-helpers.js';

afterEach(cleanupTempDirs);

const STATES = [
  'failed',
  'undefined',
  'ambiguous',
  'passed',
  'skipped',
  'pending',
  'unknown',
  'unexecuted',
] as const;

type State = (typeof STATES)[number];

const FAILING = new Set<State>(['failed', 'undefined', 'ambiguous']);

function expectedChange(baseline: State, current: State): string | undefined {
  if (current === 'unexecuted') return undefined;
  if (FAILING.has(current)) {
    return baseline !== 'unexecuted' && FAILING.has(baseline)
      ? 'still-failing'
      : 'new-failure';
  }
  if (baseline !== 'unexecuted' && FAILING.has(baseline) && current === 'passed') {
    return 'fixed';
  }
  return undefined;
}

function rowByExample(
  summary: ReportSummary,
  name: string,
  example: string,
): (SummaryScenario & { example?: string; change?: string }) | undefined {
  return (
    summary.scenarios as Array<
      SummaryScenario & { example?: string; change?: string }
    >
  ).find((row) => row.name === name && row.example === example);
}

function examplesFile(): string {
  return messagesFixture('examples-tables.ndjson');
}

describe('matcher decision table', () => {
  it('classifies every baseline and current status pair', async () => {
    const dir = await makeTempDir();
    const pairs = STATES.flatMap((baseline) =>
      STATES.map((current) => ({
        baseline,
        current,
        name: `${baseline} > ${current}`,
      })),
    );
    const file = await writeLegacyRun(dir, 'decision.json', [
      {
        name: 'Decision table',
        uri: 'features/decision.feature',
        scenarios: pairs.map((pair) => ({
          name: pair.name,
          status: pair.current,
        })),
      },
    ]);
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    for (const row of baseline.scenarios) {
      const pair = pairs.find((candidate) => candidate.name === row.name);
      expect(pair, row.name).toBeDefined();
      if (!pair) continue;
      row.status = pair.baseline === 'unexecuted' ? 'unknown' : pair.baseline;
      row.executed = pair.baseline !== 'unexecuted';
    }

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);
    const expected = {
      newFailures: 0,
      fixed: 0,
      stillFailing: 0,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    };
    for (const pair of pairs) {
      const change = expectedChange(pair.baseline, pair.current);
      if (change === 'new-failure') expected.newFailures += 1;
      if (change === 'fixed') expected.fixed += 1;
      if (change === 'still-failing') expected.stillFailing += 1;
      expect(changeOf(summary, pair.name), pair.name).toBe(change);
    }

    expect(summary.schemaVersion).toBe(2);
    expect(block.status).toBe('failed');
    expect(block.counts).toMatchObject(expected);
    expect(block.notInThisRun).toEqual([]);
    expect(expected.newFailures + expected.fixed + expected.stillFailing).toBe(
      STATES.length * STATES.length -
        pairs.filter(
          (pair) => expectedChange(pair.baseline, pair.current) === undefined,
        ).length,
    );
  });

  it('counts unmatched current rows as new failures or added, never as baseline rows', async () => {
    const dir = await makeTempDir();
    const feature: SyntheticFeature = {
      name: 'Ledger',
      uri: 'features/ledger.feature',
      scenarios: [
        { name: 'matched failing', status: 'failed' },
        { name: 'absent failing', status: 'failed' },
        { name: 'absent passing', status: 'passed' },
        { name: 'absent skipped', status: 'skipped' },
        { name: 'absent unexecuted', status: 'unexecuted' },
      ],
    };
    const file = await writeLegacyRun(dir, 'ledger.json', [feature]);
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Ledger',
          name: 'matched failing',
          uri: 'features/ledger.feature',
          status: 'failed',
          executed: true,
        },
        {
          feature: 'Ledger',
          name: 'gone failing',
          uri: 'features/ledger.feature',
          status: 'failed',
          executed: true,
        },
        {
          feature: 'Ledger',
          name: 'gone unexecuted',
          uri: 'features/ledger.feature',
          status: 'unknown',
          executed: false,
        },
      ],
    };

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 1,
      fixed: 0,
      stillFailing: 1,
      notInThisRun: 2,
      added: 2,
      ambiguous: 0,
    });
    expect(block.notInThisRun.map((row) => row.name)).toEqual([
      'gone failing',
      'gone unexecuted',
    ]);
    expect(changeOf(summary, 'matched failing')).toBe('still-failing');
    expect(changeOf(summary, 'absent failing')).toBe('new-failure');
    expect(changeOf(summary, 'absent passing')).toBe('added');
    expect(changeOf(summary, 'absent skipped')).toBe('added');
    expect(changeOf(summary, 'absent unexecuted')).toBeUndefined();
  });

  it('pins retries to one row per pickle with the latest attempt', async () => {
    const file = messagesFixture('retry-evidence.ndjson');
    const current = await summarizeReport(file);
    expect(current.scenarios).toHaveLength(1);
    expect(current.scenarios[0]?.status).toBe('passed');

    const baseline = projectSummary(current);
    expect(baseline.scenarios).toHaveLength(1);
    const [row] = baseline.scenarios;
    expect(row).toBeDefined();
    if (!row) return;
    row.status = 'failed';

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    // The earlier failed attempts must not create a second row or a second
    // classification; the latest attempt (passed) is the only one compared.
    expect(summary.scenarios).toHaveLength(1);
    expect(summary.scenarios[0]?.attempt).toBe(0);
    expect(changeOf(summary, 'Retries an upload')).toBe('fixed');
    expect(block.counts).toMatchObject({
      newFailures: 0,
      fixed: 1,
      stillFailing: 0,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    });
  });
});

describe('identity', () => {
  it('matches a reordered run without using order', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'order.json', [
      {
        name: 'Order',
        uri: 'features/order.feature',
        scenarios: [
          { name: 'one', status: 'passed' },
          { name: 'two', status: 'passed' },
          { name: 'three', status: 'passed' },
        ],
      },
    ]);
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    baseline.scenarios.reverse();

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 0,
      fixed: 0,
      stillFailing: 0,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    });
    for (const name of ['one', 'two', 'three']) {
      expect(changeOf(summary, name), name).toBeUndefined();
    }
  });

  it('keeps identity when a feature file is renamed and the base key is unique', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'renamed-file.json', [
      {
        name: 'Checkout',
        uri: 'features/new-checkout.feature',
        scenarios: [
          { name: 'pays by card', status: 'passed' },
          { name: 'refunds', status: 'failed' },
        ],
      },
    ]);
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    for (const row of baseline.scenarios) {
      row.uri = 'features/old-checkout.feature';
    }

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 0,
      fixed: 0,
      stillFailing: 1,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    });
    expect(changeOf(summary, 'pays by card')).toBeUndefined();
    expect(changeOf(summary, 'refunds')).toBe('still-failing');
  });

  it('reports a renamed feature and scenario as a remove plus an add, never modified', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'renamed-names.json', [
      {
        name: 'New feature',
        uri: 'features/new.feature',
        scenarios: [{ name: 'New scenario', status: 'failed' }],
      },
    ]);
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Old feature',
          name: 'Old scenario',
          uri: 'features/old.feature',
          status: 'failed',
          executed: true,
        },
      ],
    };

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 1,
      fixed: 0,
      stillFailing: 0,
      notInThisRun: 1,
      added: 0,
      ambiguous: 0,
    });
    expect(block.notInThisRun.map((row) => row.name)).toEqual(['Old scenario']);
    expect(changeOf(summary, 'New scenario')).toBe('new-failure');
    expect(changeOf(summary, 'Old scenario')).toBeUndefined();
    expect(JSON.stringify(summary)).not.toContain('modified');
  });

  it('pairs outline rows by the example coordinate, not by order', async () => {
    const file = examplesFile();
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    const baselineStatus: Record<string, string> = {
      '#1.1': 'failed',
      '#1.2': 'passed',
      '#2.1': 'passed',
      '#2.2': 'failed',
    };
    for (const row of baseline.scenarios) {
      if (row.name !== 'Eating cucumbers' || row.example === undefined) continue;
      row.status = baselineStatus[row.example] as BaselineSummary['status'];
    }
    baseline.scenarios.reverse();

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 1,
      fixed: 1,
      stillFailing: 1,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    });
    expect(rowByExample(summary, 'Eating cucumbers', '#1.1')?.change).toBe(
      'fixed',
    );
    expect(rowByExample(summary, 'Eating cucumbers', '#1.2')?.change).toBe(
      undefined,
    );
    expect(rowByExample(summary, 'Eating cucumbers', '#2.1')?.change).toBe(
      'new-failure',
    );
    expect(rowByExample(summary, 'Eating cucumbers', '#2.2')?.change).toBe(
      'still-failing',
    );
  });

  it('keeps a positional coordinate mispair as the documented limit', async () => {
    // The coordinate is positional. A baseline row that still says #2.1 is
    // compared with the current #2.1 even when the examples table row moved.
    const file = examplesFile();
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    const target = baseline.scenarios.find(
      (row) => row.name === 'Eating cucumbers' && row.example === '#2.1',
    );
    expect(target).toBeDefined();
    if (!target) return;
    target.status = 'passed';

    const summary = await summarizeWithBaseline(file, { baseline });
    expect(rowByExample(summary, 'Eating cucumbers', '#2.1')?.change).toBe(
      'new-failure',
    );
  });

  it('matches outline coordinates after a feature file rename', async () => {
    const file = examplesFile();
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    for (const row of baseline.scenarios) {
      row.uri = 'renamed/examples.feature';
    }

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 0,
      fixed: 0,
      stillFailing: 2,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    });
  });

  it('treats a 0.5 baseline without example as ambiguous for repeated names', async () => {
    const file = examplesFile();
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    for (const row of baseline.scenarios) delete row.example;

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    // The four "Eating cucumbers" rows share one URI and have no coordinate,
    // so the group is ambiguous instead of pairing by order.
    expect(block.counts).toMatchObject({
      newFailures: 0,
      fixed: 0,
      stillFailing: 0,
      notInThisRun: 0,
      added: 0,
      ambiguous: 1,
    });
    expect(block.notInThisRun).toEqual([]);
  });

  it('pairs repeated names in different URIs and refuses the same URI', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'uri-tiebreak.json', [
      {
        name: 'Shop',
        uri: 'features/a.feature',
        scenarios: [{ name: 'pays', status: 'failed' }],
      },
      {
        name: 'Shop',
        uri: 'features/b.feature',
        scenarios: [{ name: 'pays', status: 'passed' }],
      },
    ]);
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    for (const row of baseline.scenarios) {
      row.status = row.uri === 'features/a.feature' ? 'passed' : 'failed';
    }

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 1,
      fixed: 1,
      stillFailing: 0,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    });
    expect(changeOf(summary, 'pays', 'features/a.feature')).toBe(
      'new-failure',
    );
    expect(changeOf(summary, 'pays', 'features/b.feature')).toBe('fixed');

    const sameUriDir = await makeTempDir();
    const sameUriFile = await writeLegacyRun(sameUriDir, 'same-uri.json', [
      {
        name: 'Shop',
        uri: 'features/a.feature',
        scenarios: [
          { name: 'pays', status: 'failed' },
          { name: 'pays', status: 'passed' },
        ],
      },
    ]);
    const sameUriCurrent = await summarizeReport(sameUriFile);
    const sameUriBaseline = projectSummary(sameUriCurrent);
    for (const row of sameUriBaseline.scenarios) row.status = 'passed';
    const sameUriSummary = await summarizeWithBaseline(sameUriFile, {
      baseline: sameUriBaseline,
    });
    const sameUriBlock = baselineBlock(sameUriSummary);

    expect(sameUriBlock.counts).toMatchObject({
      newFailures: 0,
      fixed: 0,
      stillFailing: 0,
      notInThisRun: 0,
      added: 0,
      ambiguous: 1,
    });
    expect(sameUriBlock.notInThisRun).toEqual([]);
  });

  it('counts an ambiguous group once and excludes its rows from every tracked count', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'ambiguous.json', [
      {
        name: 'Shop',
        uri: 'features/shop.feature',
        scenarios: [
          { name: 'pays', status: 'failed' },
          { name: 'pays', status: 'passed' },
          { name: 'unique', status: 'passed' },
        ],
      },
    ]);
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    const duplicated = baseline.scenarios.filter((row) => row.name === 'pays');
    expect(duplicated).toHaveLength(2);
    baseline.scenarios.push({
      feature: 'Shop',
      name: 'pays',
      uri: 'features/shop.feature',
      status: 'failed',
      executed: true,
    });
    const unique = baseline.scenarios.find((row) => row.name === 'unique');
    expect(unique).toBeDefined();
    if (unique) unique.status = 'failed';

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 0,
      fixed: 1,
      stillFailing: 0,
      notInThisRun: 0,
      added: 0,
      ambiguous: 1,
    });
    expect(block.notInThisRun).toEqual([]);
    expect(changeOf(summary, 'unique')).toBe('fixed');
    const paysRows = summary.scenarios.filter((row) => row.name === 'pays');
    expect(paysRows).toHaveLength(2);
    for (const row of paysRows) {
      expect((row as SummaryScenario & { change?: string }).change).toBeUndefined();
    }
  });

  it('does not use a pickle id, position, line, tags, steps or status as identity', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'identity-extras.json', [
      {
        name: 'Shop',
        uri: 'features/shop.feature',
        scenarios: [{ name: 'pays', status: 'failed' }],
      },
    ]);
    const row: BaselineScenario = {
      feature: 'Shop',
      name: 'pays',
      uri: 'features/shop.feature',
      status: 'failed',
      executed: true,
    };
    const decorated = {
      ...row,
      id: 'a-different-pickle-id',
      line: 999,
      tags: ['@other'],
      steps: [{ keyword: 'Given', text: 'other', status: 'passed' }],
      durationMs: 42,
      attachments: 3,
    } as unknown as BaselineScenario;
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [decorated],
    };

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 0,
      fixed: 0,
      stillFailing: 1,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    });
    expect(changeOf(summary, 'pays')).toBe('still-failing');
  });
});

describe('reconciliation', () => {
  it('splits ten baseline rows into two new failures, one fixed, three still failing, three other and one not in this run', async () => {
    const dir = await makeTempDir();
    const file = await writeLegacyRun(dir, 'reconcile.json', [
      {
        name: 'Reconcile',
        uri: 'features/reconcile.feature',
        scenarios: [
          { name: 'new one', status: 'failed' },
          { name: 'new two', status: 'failed' },
          { name: 'fixed one', status: 'passed' },
          { name: 'still one', status: 'failed' },
          { name: 'still two', status: 'ambiguous' },
          { name: 'still three', status: 'undefined' },
          { name: 'other one', status: 'skipped' },
          { name: 'other two', status: 'passed' },
          { name: 'other three', status: 'unexecuted' },
        ],
      },
    ]);
    const current = await summarizeReport(file);
    const baseline = projectSummary(current);
    const status: Record<string, string> = {
      'new one': 'passed',
      'new two': 'unknown',
      'fixed one': 'failed',
      'still one': 'failed',
      'still two': 'undefined',
      'still three': 'failed',
      'other one': 'failed',
      'other two': 'passed',
      'other three': 'passed',
    };
    for (const row of baseline.scenarios) {
      row.status = status[row.name] as BaselineSummary['status'];
      row.executed = row.name !== 'new two';
    }
    baseline.scenarios.push({
      feature: 'Reconcile',
      name: 'gone one',
      uri: 'features/reconcile.feature',
      status: 'failed',
      executed: true,
    });

    const summary = await summarizeWithBaseline(file, { baseline });
    const block = baselineBlock(summary);

    expect(block.counts).toMatchObject({
      newFailures: 2,
      fixed: 1,
      stillFailing: 3,
      other: 3,
      notInThisRun: 1,
      added: 0,
      ambiguous: 0,
    });
    const residual = 10 - (2 + 1 + 3 + 1);
    expect(residual).toBe(3);
    expect(block.counts.other).toBe(3);
    expect(2 + 1 + 3 + 3 + 1).toBe(10);
    expect(block.notInThisRun.map((row) => row.name)).toEqual(['gone one']);
  });
});
