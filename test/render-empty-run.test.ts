import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { messagesFixture } from './fixtures.js';
import {
  featureList,
  matrixTable,
  scenarioOpeningTag,
} from './render-helpers.js';

const emptyFixture = messagesFixture('empty.ndjson');
const emptyNoneFixture = messagesFixture('empty-none.ndjson');
const emptyMixedFixture = messagesFixture('empty-mixed.ndjson');
const emptyStatusesFixture = messagesFixture('empty-statuses.ndjson');
const emptyAllUnexecutedFixture = messagesFixture('empty-all-unexecuted.ndjson');
const emptyHookOnlyFixture = messagesFixture('empty-hook-only.ndjson');
const emptyRetryFixture = messagesFixture('empty-retry.ndjson');
const emptyOutlineMixedFixture = messagesFixture('empty-outline-mixed.ndjson');
const emptyUnexecutedAttachmentFixture = messagesFixture(
  'empty-unexecuted-attachment.ndjson',
);

describe('empty-run rendering', () => {
  it('renders an empty run as 0 / 0 without triage and with a blank row', async () => {
    const html = await renderReport(emptyFixture, { title: 'Empty run' });

    expect(html).toContain('0 / 0');
    const header = html.slice(
      html.indexOf('<header class="runHead">'),
      html.indexOf(
        '</header>',
        html.indexOf('<header class="runHead">'),
      ),
    );
    expect(header).not.toContain('0 of 0 passed');
    expect(header).toContain(
      '<span aria-hidden="true">0 / 0</span><span class="sr">0 / 0 passed</span>',
    );
    expect(html).toContain('<span>0 scenarios with results</span>');
    expect(html).toContain('<strong>0%</strong>');
    expect(html).not.toContain('Needs attention');

    const list = featureList(html);
    expect(list).toContain('Empty Scenarios');
    expect(list).toContain('0 of 0 passed');
    expect(list).not.toContain('· 1 unknown');
    expect(list).not.toContain('class="bar"');

    const featureTag = html.slice(
      html.indexOf('data-feature'),
      html.indexOf('>', html.indexOf('data-feature')),
    );
    expect(featureTag).toContain('open');

    const rowTag = scenarioOpeningTag(html, 'Blank Scenario');
    expect(rowTag).not.toContain('data-status');
    expect(rowTag).not.toContain(' open');
    const rowSummary = html.slice(
      html.indexOf(rowTag),
      html.indexOf('</summary>', html.indexOf(rowTag)),
    );
    expect(rowSummary).not.toContain('statusText');
    expect(rowSummary).not.toContain('Unknown');
    expect(rowSummary).toContain('<span class="sr">Not executed</span>');
  });

  it('renders 0 / 0 and the empty state when the run has no scenario rows', async () => {
    const html = await renderReport(emptyNoneFixture, { title: 'No rows' });

    expect(html).toContain('0 / 0');
    expect(html).not.toContain('0 of 0 passed');
    expect(html).toContain('No scenarios in this report.');
    expect(html).not.toContain('Needs attention');
    expect(html).not.toContain('<details class="feature"');
  });

  it('keeps a blank row visible and searchable in a mixed run', async () => {
    const html = await renderReport(emptyMixedFixture, { title: 'Mixed run' });

    expect(html).toContain('1 / 1');
    expect(html).not.toContain('1 passed of 2 attempted');
    expect(html).toContain('<strong>100%</strong>');
    expect(html).toContain('<span>1 scenario with results</span>');
    expect(html).toContain('<span>1 unexecuted</span>');
    expect(html).not.toContain('Needs attention');

    const list = featureList(html);
    expect(list).toContain('1 passed of 1 attempted');
    expect(list.match(/data-scenario-name=/g) ?? []).toHaveLength(2);
    expect(list).toContain('Blank started scenario');
    expect(list).not.toContain('Never started scenario');

    const featureTag = html.slice(
      html.indexOf('data-feature'),
      html.indexOf('>', html.indexOf('data-feature')),
    );
    expect(featureTag).not.toContain(' open');

    const rowTag = scenarioOpeningTag(html, 'Blank started scenario');
    expect(rowTag).not.toContain('data-status');
    expect(rowTag).not.toContain(' open');
    expect(rowTag).toContain('data-search=');
    expect(rowTag).toContain('data-uri="samples/empty-mixed/empty-mixed.feature"');
    const rowSummary = html.slice(
      html.indexOf(rowTag),
      html.indexOf('</summary>', html.indexOf(rowTag)),
    );
    expect(rowSummary).not.toContain('statusText');
    expect(rowSummary).toContain('<span class="sr">Not executed</span>');
  });

  it('counts only executed rows in the header, feature row, triage and bar', async () => {
    const html = await renderReport(emptyStatusesFixture, {
      title: 'Mixed statuses',
    });

    expect(html).toContain('1 / 2');
    expect(html).not.toContain('1 passed of 3 attempted');
    expect(html).toContain('<strong>50%</strong>');

    const triage = html.slice(
      html.indexOf('class="triageBox"'),
      html.indexOf('id="feature-list"'),
    );
    expect(triage).toContain('1 of 2 scenarios need attention.');
    expect(triage).toContain('Failed scenario');
    expect(triage).not.toContain('Blank unexecuted scenario');
    expect(triage).not.toContain('2 of 3 scenarios need attention.');

    const list = featureList(html);
    expect(list).toContain('1 passed of 2 attempted · 1 failed');
    expect(list).not.toContain('1 unknown');
    const featureSummary = list.slice(
      list.indexOf('Mixed statuses'),
      list.indexOf('<div class="rows">', list.indexOf('Mixed statuses')),
    );
    expect(featureSummary).toContain('class="pass"');
    expect(featureSummary).toContain('class="fail"');
    expect(featureSummary).not.toContain('class="unknown"');
    expect(html).not.toMatch(
      /<button class="filter"[^>]+data-filter-status="unknown"/,
    );
  });

  it('shows 0 scenarios and muted zero cells for an all-unexecuted source', async () => {
    const allUnexecuted = parseMessages(
      await readFile(emptyAllUnexecutedFixture, 'utf8'),
      emptyAllUnexecutedFixture,
    );
    const mixed = parseMessages(
      await readFile(emptyMixedFixture, 'utf8'),
      emptyMixedFixture,
    );
    const html = await renderHtml([...allUnexecuted, ...mixed], {
      title: 'Sources',
      provenance: new Map([
        [
          'samples/empty-all-unexecuted/empty-all-unexecuted.feature',
          'all-unexecuted.ndjson',
        ],
        ['samples/empty-mixed/empty-mixed.feature', 'mixed.ndjson'],
      ]),
    });

    const sources = html.slice(
      html.indexOf('class="sources"'),
      html.indexOf('id="feature-list"'),
    );
    const cards = sources.split('<li class="sourceItem">');
    const blankCard = cards.find((card) => card.includes('all-unexecuted.ndjson'));
    expect(blankCard).toBeDefined();
    expect(blankCard).toContain('1 feature · 0 scenarios');
    expect(blankCard).toContain('Unknown');
    expect(blankCard).not.toContain('class="bar"');

    const mixedCard = cards.find((card) => card.includes('mixed.ndjson'));
    expect(mixedCard).toBeDefined();
    expect(mixedCard).toContain('1 feature · 1 scenario');
    expect(mixedCard).toContain('class="bar"');

    const matrix = matrixTable(html);
    const headers = [...matrix.matchAll(/<th>(.*?)<\/th>/g)].map(
      (match) => match[1],
    );
    expect(headers).toEqual(['Feature', 'Total', 'Passed', 'Scenario time']);

    const blankRow = matrix.slice(
      matrix.indexOf('All unexecuted'),
      matrix.indexOf('</tr>', matrix.indexOf('All unexecuted')),
    );
    expect(blankRow).toContain('<td class="num">0</td>');
    expect(blankRow).toContain('<td class="num zero">0</td>');

    const mixedRow = matrix.slice(
      matrix.indexOf('Mixed executed and unexecuted'),
      matrix.indexOf('</tr>', matrix.indexOf('Mixed executed and unexecuted')),
    );
    expect(mixedRow).toContain('<td class="num">1</td><td class="num">1</td>');
  });

  it('renders a hook-only scenario as a failed executed row', async () => {
    const html = await renderReport(emptyHookOnlyFixture, {
      title: 'Hook only',
    });

    expect(html).toContain('0 / 1');
    expect(html).toContain('1 of 1 scenario needs attention.');
    expect(scenarioOpeningTag(html, 'Hook-only scenario')).toContain(
      'data-status="failed"',
    );
    expect(html).toContain('before hook failed');
  });

  it('keeps the latest unexecuted retry row blank and collapsed', async () => {
    const html = await renderReport(emptyRetryFixture, { title: 'Retry' });

    expect(html).toContain('0 / 0');
    expect(html).not.toContain('Needs attention');
    const rowTag = scenarioOpeningTag(html, 'Retried scenario');
    expect(rowTag).not.toContain('data-status');
    expect(rowTag).not.toContain(' open');
    expect(html.slice(html.indexOf(rowTag))).toContain('Attempt: 2');
  });

  it('renders a started outline example and prunes the never-started one', async () => {
    const html = await renderReport(emptyOutlineMixedFixture, {
      title: 'Outline mixed',
    });

    expect(html).toContain('Examples:</span> Mixed examples');
    expect(html.match(/<section class="examples" data-examples/g) ?? []).toHaveLength(1);
    const rowTag = scenarioOpeningTag(html, 'Eat 1 cucumbers');
    expect(rowTag).toContain('data-example="#1.1"');
    expect(rowTag).not.toContain('data-status');
    expect(rowTag).not.toContain(' open');
    const rowSummary = html.slice(
      html.indexOf(rowTag),
      html.indexOf('</summary>', html.indexOf(rowTag)),
    );
    expect(rowSummary).toContain('class="exampleNo" aria-hidden="true">#1.1');
    expect(rowSummary).not.toContain('statusText');
    expect(rowSummary).toContain('<span class="sr">Not executed</span>');
    expect(html).not.toContain('Eat 2 cucumbers');
  });

  it('renders no attachment for an unexecuted scenario', async () => {
    const html = await renderReport(emptyUnexecutedAttachmentFixture, {
      title: 'Unexecuted attachment',
    });

    expect(html).not.toContain('note.txt');
    expect(html).not.toContain(' class="attachment"');
  });
});
