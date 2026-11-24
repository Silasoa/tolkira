import { describe, expect, it } from 'vitest';
import { summarizeReport } from '../src/index.js';
import {
  formatAzureAnnotations,
  formatCiOutput,
  formatGitHubAnnotations,
  formatMarkdownSummary,
} from '../src/ci.js';
import { legacyFixture, messagesFixture } from './fixtures.js';
import { summaryWithBaseline } from './baseline-helpers.js';

const failedInput = legacyFixture('failed.json');
const emptyInput = messagesFixture('empty-none.ndjson');
const unexecutedInput = messagesFixture('empty-all-unexecuted.ndjson');

const MIXED_LINE =
  'Baseline: 2 new failures · 1 fixed · 3 still failing · 1 not in this run';

async function markdownWith(
  counts: {
    newFailures?: number;
    fixed?: number;
    stillFailing?: number;
    notInThisRun?: number;
    added?: number;
    ambiguous?: number;
  },
): Promise<string> {
  const summary = await summarizeReport(failedInput);
  return formatCiOutput(summaryWithBaseline(summary, counts), 'markdown');
}

describe('Markdown baseline line', () => {
  it('emits the exact mixed line between the counts table and the failed list', async () => {
    const markdown = await markdownWith({
      newFailures: 2,
      fixed: 1,
      stillFailing: 3,
      notInThisRun: 1,
      added: 7,
    });
    const lines = markdown.split('\n');
    const index = lines.indexOf(MIXED_LINE);

    expect(index, MIXED_LINE).toBeGreaterThan(-1);
    expect(lines[index - 1]).toBe('');
    expect(lines[index + 1]).toBe('');
    expect(lines[index + 2]).toBe('### Failed scenarios');
    expect(markdown).not.toContain('added');
  });

  it('prints all four zero counts', async () => {
    const markdown = await markdownWith({});

    expect(markdown).toContain(
      'Baseline: 0 new failures · 0 fixed · 0 still failing · 0 not in this run',
    );
  });

  it('uses the singular for one new failure', async () => {
    const markdown = await markdownWith({ newFailures: 1 });

    expect(markdown).toContain(
      'Baseline: 1 new failure · 0 fixed · 0 still failing · 0 not in this run',
    );
  });

  it.each([
    [1, ' · 1 ambiguous group'],
    [2, ' · 2 ambiguous groups'],
  ])('appends the ambiguous suffix for %i groups', async (count, suffix) => {
    const markdown = await markdownWith({ ambiguous: count });

    expect(markdown).toContain(
      `Baseline: 0 new failures · 0 fixed · 0 still failing · 0 not in this run${suffix}`,
    );
  });

  it('omits the ambiguous suffix at zero', async () => {
    const markdown = await markdownWith({ ambiguous: 0 });

    expect(markdown).toContain(
      'Baseline: 0 new failures · 0 fixed · 0 still failing · 0 not in this run',
    );
    expect(markdown).not.toContain('ambiguous group');
  });

  it('appears before the empty-run return', async () => {
    const summary = await summarizeReport(emptyInput);
    const markdown = formatCiOutput(
      summaryWithBaseline(summary, {
        newFailures: 2,
        fixed: 1,
        stillFailing: 3,
        notInThisRun: 1,
      }),
      'markdown',
    );

    expect(markdown).toContain(`${MIXED_LINE}\n\nNo scenarios in this report.`);
  });

  it('appears before the zero-executed return', async () => {
    const summary = await summarizeReport(unexecutedInput);
    const markdown = formatCiOutput(
      summaryWithBaseline(summary, {
        newFailures: 2,
        fixed: 1,
        stillFailing: 3,
        notInThisRun: 1,
      }),
      'markdown',
    );

    expect(markdown).toContain(
      `${MIXED_LINE}\n\n0 executed scenarios; 2 unexecuted.`,
    );
  });

  it('adds no line without a baseline', async () => {
    const summary = await summarizeReport(failedInput);

    expect(formatMarkdownSummary(summary)).not.toContain('Baseline:');
  });

  it('keeps GitHub and Azure annotation bytes unchanged', async () => {
    const summary = await summarizeReport(failedInput);
    const withBlock = summaryWithBaseline(summary, {
      newFailures: 2,
      fixed: 1,
      stillFailing: 3,
      notInThisRun: 1,
      ambiguous: 1,
    });

    expect(formatGitHubAnnotations(withBlock)).toBe(
      formatGitHubAnnotations(summary),
    );
    expect(formatAzureAnnotations(withBlock)).toBe(
      formatAzureAnnotations(summary),
    );
  });
});
