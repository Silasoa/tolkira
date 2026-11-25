import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { renderHtml } from '../src/render/html.js';
import { junitFixture, legacyFixture, messagesFixture } from './fixtures.js';
import {
  featureOpeningTag,
  scenarioOpeningTag,
  syntheticRun,
} from './render-helpers.js';

const allStatusesFixture = messagesFixture('all-statuses.ndjson');
const minimalFixture = legacyFixture('minimal.json');
const unhappyFixture = legacyFixture('unhappy.json');
const junitBasicFixture = junitFixture('basic.xml');

describe('default open state', () => {
  it('opens non-passed features and scenarios and keeps passed ones collapsed', async () => {
    const html = await renderReport(allStatusesFixture, {
      title: 'All statuses',
    });

    expect(featureOpeningTag(html)).toContain(' open>');
    for (const name of [
      'Failing',
      'Pending',
      'Skipped',
      'Undefined',
      'Ambiguous',
    ]) {
      expect(scenarioOpeningTag(html, name), name).toContain(' open>');
    }
    expect(scenarioOpeningTag(html, 'Passing')).not.toContain(' open>');
  });

  it('opens an unknown scenario and its feature', async () => {
    const html = await renderHtml(
      syntheticRun([
        {
          name: 'Unknown feature',
          scenarios: [{ name: 'Unknown scenario', status: 'unknown' }],
        },
      ]),
      { title: 'Unknown' },
    );

    expect(featureOpeningTag(html)).toContain(' open>');
    expect(scenarioOpeningTag(html, 'Unknown scenario')).toContain(' open>');
  });

  it('keeps passed scenarios without images collapsed', async () => {
    const html = await renderReport(minimalFixture, { title: 'Passed only' });

    expect(
      html.match(/<details class="scenario"[^>]* open>/g) ?? [],
    ).toHaveLength(0);
  });

  it('opens non-passed legacy and JUnit rows without diagnostics', async () => {
    const legacyHtml = await renderReport(unhappyFixture, {
      title: 'Legacy open',
    });
    expect(
      scenarioOpeningTag(
        legacyHtml,
        'Fred wants to see if steps are undefined on the HTML report',
      ),
    ).toContain(' open>');
    expect(legacyHtml).toContain('No step definition found.');
    expect(legacyHtml).not.toContain('class="snippet"');
    expect(legacyHtml).not.toContain(
      '<div class="diagnostic" data-diagnostic="ambiguous"',
    );

    const junitHtml = await renderReport(junitBasicFixture, {
      title: 'JUnit open',
    });
    expect(scenarioOpeningTag(junitHtml, 'slow payment')).toContain(' open>');
    expect(junitHtml).not.toContain('<div class="diagnostic"');
  });

  it('renders 1000 non-passed scenarios with every row open', async () => {
    const run = syntheticRun([
      {
        name: 'Mass failure feature',
        scenarios: Array.from({ length: 1000 }, (_, index) => ({
          name: `Scenario ${index + 1}`,
          status: 'undefined',
        })),
      },
    ]);
    const html = await renderHtml(run, { title: 'Stress non-passed' });

    expect(
      html.match(/<details class="scenario"[^>]* open>/g) ?? [],
    ).toHaveLength(1000);
    expect(html.length).toBeLessThan(5 * 1024 * 1024);
  });
});
