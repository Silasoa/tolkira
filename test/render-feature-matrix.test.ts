import { describe, expect, it } from 'vitest';
import { renderHtml } from '../src/render/html.js';
import {
  featureList,
  legacyEnvelopes,
  matrixTable,
  syntheticRun,
} from './render-helpers.js';

describe('feature overview and matrix', () => {
  async function mixedReport(): Promise<string> {
    return renderHtml(
      [
        ...(await legacyEnvelopes('behave.json', 'behave')),
        ...(await legacyEnvelopes('unhappy.json', 'unhappy')),
        ...(await legacyEnvelopes('failed.json', 'failed')),
      ],
      { title: 'Feature overview' },
    );
  }

  it('names every non-passing status in a feature row', async () => {
    const html = await renderHtml(
      syntheticRun([
        {
          name: 'Mixed row',
          scenarios: [
            { name: 'passes', status: 'passed' },
            { name: 'fails', status: 'failed' },
            { name: 'waits', status: 'pending' },
          ],
        },
      ]),
      { title: 'Mixed row' },
    );
    const list = featureList(html);

    expect(list).toContain('1 passed of 3 attempted · 1 failed, 1 pending');
    const bar = list.slice(list.indexOf('class="bar"'));
    expect(bar.indexOf('class="pass"')).toBeLessThan(
      bar.indexOf('class="fail"'),
    );
    expect(bar.indexOf('class="fail"')).toBeLessThan(
      bar.indexOf('class="pending"'),
    );
  });

  it('shows counts and a proportion bar on each feature row', async () => {
    const list = featureList(await mixedReport());

    const happy = list.slice(
      list.indexOf('Happy HTML reporting'),
      list.indexOf('Unhappy HTML reporting'),
    );
    expect(happy).toContain('5 passed of 6 attempted · 1 failed');
    expect(happy.match(/<i class="(pass|fail)"/g) ?? []).toHaveLength(2);
    const bar = happy.slice(happy.indexOf('class="bar"'));
    expect(bar.indexOf('class="pass"')).toBeLessThan(
      bar.indexOf('class="fail"'),
    );
    expect(happy).toContain('class="featureUri"');

    const behave = list.slice(list.indexOf('Behave feature'));
    expect(behave).toContain('1 passed of 1 attempted');
    expect(behave.match(/<i class="pass"/g) ?? []).toHaveLength(1);
    expect(behave).not.toContain('passed ·');
  });

  it('renders a feature by status matrix in Details', async () => {
    const matrix = matrixTable(await mixedReport());
    const headers = [...matrix.matchAll(/<th>(.*?)<\/th>/g)].map(
      (match) => match[1],
    );
    expect(headers).toEqual([
      'Feature',
      'Total',
      'Failed',
      'Undefined',
      'Pending',
      'Passed',
      'Scenario time',
    ]);

    const names = [
      ...matrix.matchAll(
        /<tr><th scope="row"><span class="matrixName">(.*?)<\/span>/g,
      ),
    ].map((match) => match[1]);
    expect(names).toEqual([
      'Behave feature',
      'Unhappy HTML reporting',
      'Happy HTML reporting',
    ]);

    const row = matrix.match(
      /<tr><th scope="row"><span class="matrixName">Happy HTML reporting<\/span>.*?<\/tr>/,
    )?.[0];
    expect(row).toBeDefined();
    const cells = [...row!.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(
      (match) => match[1],
    );
    expect(cells.slice(0, 5)).toEqual(['6', '1', '0', '0', '5']);
    expect(cells[5]).toMatch(/^\d+(\.\d+)? (ms|s)$/);
    expect(matrix).toContain('class="num zero"');
  });

  it('shows only present status columns in the matrix', async () => {
    const html = await renderHtml(
      await legacyEnvelopes('behave.json', 'behave'),
      { title: 'Clean matrix' },
    );
    const headers = [...matrixTable(html).matchAll(/<th>(.*?)<\/th>/g)].map(
      (match) => match[1],
    );
    expect(headers).toEqual(['Feature', 'Total', 'Passed', 'Scenario time']);
  });
});
