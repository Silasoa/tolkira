import { AttachmentContentEncoding } from '@cucumber/messages';
import { afterEach, describe, expect, it } from 'vitest';
import type { BaselineSummary } from '../src/index.js';
import { renderReport } from '../src/index.js';
import { buildLoadedRun } from '../src/loaded-run.js';
import { renderHtml, renderRun } from '../src/render/html.js';
import { cleanupTempDirs, makeTempDir, writeText } from './baseline-helpers.js';
import {
  failedIncident,
  fixtureEnvelopes,
  incidentEnvelopes,
  incidentJson,
  LOG_BODY,
  PNG_1X1,
  retryIncidentEnvelopes,
  runHookFailureEnvelopes,
  rulesOutlineEnvelopes,
  step,
  stepRun,
  WEBM_STUB,
  type IncidentRunSpec,
  type IncidentScenario,
  type IncidentStatus,
} from './render-incident-fixtures.js';
import { featureList, failPickle, sectionAt } from './render-helpers.js';

afterEach(cleanupTempDirs);

// Fixed copy the implementer and translators must add. Kept here so every
// assertion names the same string.
const HEADING = 'What happened';
const ROW_LABEL = 'Shown above';
const RUN_FAILED = 'Run failed';
const ATTENTION = 'Needs attention';
const NO_EVIDENCE = 'No evidence attached.';
const GERMAN_HEADING = 'Was passiert ist';
const GERMAN_ROW_LABEL = 'Oben angezeigt';
const GERMAN_RUN_FAILED = 'Lauf fehlgeschlagen';
const GERMAN_NO_EVIDENCE = 'Kein Nachweis angehängt.';

function moreIncidents(count: number): string {
  return count === 1
    ? '1 more incident in the list'
    : `${count} more incidents in the list`;
}

function germanMoreIncidents(count: number): string {
  return count === 1
    ? '1 weiterer Zwischenfall in der Liste'
    : `${count} weitere Zwischenfälle in der Liste`;
}

function incidentSection(html: string): string {
  const match = /<section\b[^>]*\bid="incident"[^>]*>/.exec(html);
  if (!match) return '';
  return sectionAt(html, match.index);
}

function incidentSummary(html: string): string {
  const panel = incidentSection(html);
  const detail = panel.indexOf('incidentDetail');
  return detail < 0 ? panel : panel.slice(0, detail);
}

function incidentDetail(html: string): string {
  const panel = incidentSection(html);
  const detail = panel.indexOf('incidentDetail');
  return detail < 0 ? '' : panel.slice(detail);
}

function triageSection(html: string): string {
  const start = html.indexOf('data-triage');
  if (start < 0) return '';
  const end = html.indexOf('id="feature-list"', start);
  return html.slice(start, end < 0 ? html.length : end);
}

function openingTagAt(html: string, id: string): string {
  const index = html.indexOf(`id="${id}"`);
  if (index < 0) return '';
  const start = html.lastIndexOf('<', index);
  return html.slice(start, html.indexOf('>', index) + 1);
}

function rowAround(html: string, id: string): string {
  const start = html.lastIndexOf('<', html.indexOf(`id="${id}"`));
  const next = html.indexOf('<details class="scenario"', start + 1);
  return html.slice(start, next < 0 ? html.length : next);
}

function oneScenario(
  name: string,
  status: IncidentStatus,
  message?: string,
): IncidentRunSpec {
  return {
    features: [
      {
        name: 'Incident feature',
        scenarios: [
          {
            name,
            status,
            ...(message === undefined ? {} : { message }),
          },
        ],
      },
    ],
  };
}

async function render(spec: IncidentRunSpec, locale?: string): Promise<string> {
  return renderHtml(incidentEnvelopes(spec), {
    title: 'Incident',
    ...(locale === undefined ? {} : { locale }),
  });
}

describe('incident panel presence', () => {
  it.each<[IncidentStatus]>([
    ['failed'],
    ['undefined'],
    ['ambiguous'],
    ['pending'],
  ])('renders for a %s scenario', async (status) => {
    const html = await render(oneScenario(`${status} scenario`, status));

    expect(incidentSection(html)).toContain(`id="incident-heading"`);
    expect(incidentSection(html)).toContain(HEADING);
    expect(incidentSummary(html)).toContain(`${status} scenario`);
  });

  it('is absent when every executed scenario passed', async () => {
    const html = await render(oneScenario('passes', 'passed'));

    expect(incidentSection(html)).toBe('');
    expect(html).not.toContain('id="incident"');
    expect(html).not.toContain(HEADING);
  });

  it('is absent for skipped only and unknown only', async () => {
    const skipped = await renderHtml(
      await fixtureEnvelopes('skipped-only.ndjson'),
      { title: 'Skipped only' },
    );
    const unknown = await render(oneScenario('unknown row', 'unknown'));

    for (const [name, html] of [
      ['skipped', skipped],
      ['unknown', unknown],
    ] as const) {
      expect(incidentSection(html), name).toBe('');
      expect(html, name).not.toContain('id="incident"');
    }
    // The triage keeps its broader attention list for skipped rows.
    expect(triageSection(skipped)).toContain('Needs attention');
    expect(triageSection(skipped)).toContain('Skipped');
  });

  it('is absent when every scenario is unexecuted', async () => {
    const html = await renderHtml(
      await fixtureEnvelopes('empty-all-unexecuted.ndjson'),
      { title: 'Unexecuted' },
    );

    expect(incidentSection(html)).toBe('');
    expect(html).not.toContain('id="incident"');
  });

  it('uses Run failed for failed and Needs attention for other incidents', async () => {
    const failed = await render(oneScenario('failed row', 'failed'));

    expect(incidentSummary(failed)).toContain(RUN_FAILED);
    expect(incidentSummary(failed)).not.toContain(ATTENTION);

    for (const status of ['undefined', 'ambiguous', 'pending'] as const) {
      const html = await render(oneScenario(`${status} row`, status));
      expect(incidentSummary(html), status).toContain(ATTENTION);
      expect(incidentSummary(html), status).not.toContain(RUN_FAILED);
    }
  });

  it('sits after the toolbar and live region and before the triage and index', async () => {
    const html = await render(oneScenario('fails', 'failed'));

    const toolbar = html.indexOf('class="toolbar"');
    const live = html.indexOf('id="tolkira-live"');
    const incident = html.indexOf('id="incident"');
    const triage = html.indexOf('data-triage');
    const list = html.indexOf('id="feature-list"');

    expect(incident).toBeGreaterThan(live);
    expect(incident).toBeGreaterThan(toolbar);
    expect(triage).toBeGreaterThan(incident);
    expect(list).toBeGreaterThan(incident);
    expect(incidentSection(html)).toContain('tabindex="-1"');
  });
});

describe('incident selection', () => {
  it('walks the ordered list: failed, ambiguous, undefined, pending', async () => {
    const scenarios: IncidentScenario[] = [
      { name: 'pending row', status: 'pending' },
      { name: 'undefined row', status: 'undefined' },
      { name: 'ambiguous row', status: 'ambiguous' },
      { name: 'failed row', status: 'failed' },
      { name: 'passed row', status: 'passed' },
      { name: 'skipped row', status: 'skipped' },
      { name: 'unknown row', status: 'unknown' },
    ];
    const spec = (drop: string[] = []): IncidentRunSpec => ({
      features: [
        {
          name: 'Ordered',
          scenarios: scenarios.filter(
            (scenario) => !drop.includes(scenario.name),
          ),
        },
      ],
    });

    expect(incidentSummary(await render(spec()))).toContain('failed row');
    expect(incidentSummary(await render(spec(['failed row'])))).toContain(
      'ambiguous row',
    );
    expect(
      incidentSummary(await render(spec(['failed row', 'ambiguous row']))),
    ).toContain('undefined row');
    expect(
      incidentSummary(
        await render(spec(['failed row', 'ambiguous row', 'undefined row'])),
      ),
    ).toContain('pending row');
  });

  it('selects the first incident across features in the ordered list', async () => {
    const html = await render({
      features: [
        {
          name: 'Pending feature',
          uri: 'features/pending.feature',
          scenarios: [{ name: 'pending row', status: 'pending' }],
        },
        {
          name: 'Failed feature',
          uri: 'features/failed.feature',
          scenarios: [{ name: 'failed row', status: 'failed' }],
        },
      ],
    });

    expect(incidentSummary(html)).toContain('failed row');
    expect(incidentSummary(html)).toContain('Failed feature');
  });

  it('keeps the earlier input row for equal statuses', async () => {
    const html = await render({
      features: [
        {
          name: 'Ties',
          scenarios: [
            { name: 'first failed', status: 'failed' },
            { name: 'second failed', status: 'failed' },
          ],
        },
      ],
    });

    expect(incidentSummary(html)).toContain('first failed');
    expect(incidentSummary(html)).not.toContain('second failed');
  });

  it('counts only the incident set and pluralizes 1 and 2 remaining', async () => {
    const three = await render({
      features: [
        {
          name: 'Mixed',
          scenarios: [
            { name: 'failed one', status: 'failed' },
            { name: 'failed two', status: 'failed' },
            { name: 'failed three', status: 'failed' },
            { name: 'skipped one', status: 'skipped' },
            { name: 'unknown one', status: 'unknown' },
          ],
        },
      ],
    });
    const two = await render({
      features: [
        {
          name: 'Two',
          scenarios: [
            { name: 'failed one', status: 'failed' },
            { name: 'failed two', status: 'failed' },
            { name: 'skipped one', status: 'skipped' },
          ],
        },
      ],
    });
    const one = await render(oneScenario('only failed', 'failed'));

    expect(incidentSummary(three)).toContain(moreIncidents(2));
    expect(incidentSummary(three)).not.toContain('4 more');
    expect(incidentSummary(two)).toContain(moreIncidents(1));
    expect(incidentSummary(two)).not.toContain('2 more');
    expect(incidentSummary(one)).not.toContain('more incident');
    // The triage stays broader: its counts line still lists skipped, and a
    // skipped row within the link limit stays reachable.
    const twoTriage = triageSection(two);
    expect(twoTriage).toContain('2 failed, 1 skipped');
    expect(twoTriage).toContain('href="#scenario-1-3"');
    expect(triageSection(three)).toContain('3 failed, 1 skipped, 1 unknown');
    expect(triageSection(three)).not.toContain('· Skipped');
  });
});

describe('incident summary', () => {
  it('names feature, scenario, status, steps, duration, tags, source, attempt and start', async () => {
    const html = await render({
      startedAt: new Date('2026-01-05T09:30:00.000Z'),
      features: [
        {
          name: 'Checkout',
          uri: 'features/checkout.feature',
          tags: ['@shop'],
          scenarios: [
            {
              name: 'pays an invoice',
              tags: ['@billing'],
              line: 3,
              steps: [
                step('opens the page', { durationMs: 1000 }),
                step('the payment fails', {
                  keyword: 'Then',
                  status: 'failed',
                  durationMs: 500,
                  message: 'Expected 200 but got 500\n  at checkout.ts:42',
                }),
              ],
            },
          ],
        },
      ],
    });
    const summary = incidentSummary(html);
    const detail = incidentDetail(html);

    expect(summary).toContain('Checkout');
    expect(summary).toContain('pays an invoice');
    expect(summary).toMatch(/>Failed</);
    expect(summary).toContain('2 steps');
    expect(summary).toContain('1.50 s');
    expect(summary).toContain('@billing');
    expect(summary).toContain('features/checkout.feature:3');
    expect(summary).toContain('Attempt: 1');
    expect(summary).toContain('Started: 2026-01-05 09:30 UTC');
    expect(summary).toContain('the payment fails');
    expect(summary).toContain('Expected 200 but got 500');
    expect(summary).not.toContain('at checkout.ts:42');
    expect(detail).toContain('at checkout.ts:42');
  });

  it('leads with the diagnostic for undefined and ambiguous', async () => {
    const undefinedHtml = await render(
      oneScenario('undefined row', 'undefined'),
    );
    const ambiguousHtml = await render(
      oneScenario('ambiguous row', 'ambiguous'),
    );
    const pendingHtml = await render(oneScenario('pending row', 'pending'));

    expect(incidentSummary(undefinedHtml)).toContain(
      'No step definition found.',
    );
    expect(incidentSummary(undefinedHtml)).toContain('a step');
    expect(incidentSummary(undefinedHtml)).not.toContain('First failure');
    expect(incidentDetail(undefinedHtml)).toContain(
      'data-diagnostic="undefined"',
    );
    expect(incidentSummary(ambiguousHtml)).toContain(
      'Multiple matching step definitions found',
    );
    expect(incidentSummary(ambiguousHtml)).toContain('a step');
    expect(incidentSummary(ambiguousHtml)).not.toContain('found:');
    expect(incidentSummary(ambiguousHtml)).not.toContain('First failure');
    expect(incidentDetail(ambiguousHtml)).toContain(
      'data-diagnostic="ambiguous"',
    );
    // Pending is a status incident, not a "first failure".
    expect(incidentSummary(pendingHtml)).toContain('Pending');
    expect(incidentSummary(pendingHtml)).not.toContain('First failure');
    expect(incidentSummary(pendingHtml)).toContain('Needs attention');
  });

  it('names a failed hook and keeps the first error line in the summary', async () => {
    const html = await render({
      features: [
        {
          name: 'Hooks',
          scenarios: [
            {
              name: 'before hook fails',
              before: [
                {
                  at: 'before',
                  status: 'failed',
                  message: 'Login setup failed\n  at hooks.ts:7',
                },
              ],
              steps: [step('a passed step')],
            },
          ],
        },
      ],
    });

    expect(incidentSummary(html)).toContain('Before');
    expect(incidentSummary(html)).toContain('Login setup failed');
    expect(incidentSummary(html)).not.toContain('at hooks.ts:7');
    expect(incidentDetail(html)).toContain('at hooks.ts:7');
  });

  it('shows the baseline change badge in the summary', async () => {
    const dir = await makeTempDir();
    const spec = failedIncident({ name: 'turns red' });
    const file = await writeText(dir, 'incident.json', incidentJson(spec));
    const baseline: BaselineSummary = {
      schemaVersion: 2,
      status: 'failed',
      scenarios: [
        {
          feature: 'Checkout',
          name: 'turns red',
          uri: 'features/checkout.feature',
          status: 'passed',
          executed: true,
        },
      ],
    };
    const html = await renderReport(file, { title: 'Baseline', baseline });

    expect(incidentSummary(html)).toContain('changeBadgeNewFailure');
    expect(incidentSummary(html)).toContain('New failure');
  });
});

describe('incident evidence reuse', () => {
  it('keeps chronological steps and a failed After hook after them', async () => {
    const html = await render({
      features: [
        {
          name: 'Chronology',
          scenarios: [
            {
              name: 'orders evidence',
              before: [{ at: 'before' }],
              steps: [
                step('opens the page'),
                step('submits the order', {
                  status: 'failed',
                  message: 'boom',
                }),
              ],
              after: [
                { at: 'after', status: 'failed', message: 'cleanup failed' },
              ],
            },
          ],
        },
      ],
    });
    const detail = incidentDetail(html);

    const group =
      /<details class="hookGroup".*?<\/details>/s.exec(detail)?.[0] ?? '';
    expect(group).toContain('<details class="hookGroup"');
    expect(group).toContain('Before');
    expect(group).not.toContain(' open');
    expect(detail).toContain('Before');
    expect(detail.indexOf('opens the page')).toBeGreaterThan(-1);
    expect(detail.indexOf('opens the page')).toBeLessThan(
      detail.indexOf('submits the order'),
    );
    expect(detail.indexOf('submits the order')).toBeLessThan(
      detail.indexOf('<li class="hook" data-status="failed"'),
    );
    expect(detail).toContain('cleanup failed');
    expect(detail).toContain('<li class="step" data-status="failed"');
  });

  it('names a failed After hook when every step passed', async () => {
    const html = await render({
      features: [
        {
          name: 'Hooks',
          scenarios: [
            {
              name: 'after hook fails',
              steps: [step('a passed step')],
              after: [
                {
                  at: 'after',
                  status: 'failed',
                  message: 'Browser cleanup failed\n  at hooks.ts:9',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(incidentSummary(html)).toContain('After');
    expect(incidentSummary(html)).toContain('Browser cleanup failed');
    expect(incidentSummary(html)).not.toContain('at hooks.ts:9');
    expect(incidentDetail(html)).toContain('at hooks.ts:9');
  });

  it('keeps doc strings and data tables in the reused detail', async () => {
    const html = await render({
      features: [
        {
          name: 'Evidence',
          scenarios: [
            {
              name: 'rich detail',
              steps: [
                step('a doc string', { docString: 'payload = {"ok":true}' }),
                step('a table', {
                  table: [
                    ['name', 'value'],
                    ['amount', '42'],
                  ],
                }),
                step('fails', { status: 'failed', message: 'nope' }),
              ],
            },
          ],
        },
      ],
    });
    const detail = incidentDetail(html);

    expect(detail).toContain('class="docString"');
    expect(detail).toContain('payload = {&quot;ok&quot;:true}');
    expect(detail).toContain('class="dataTable"');
    expect(detail).toContain('<td>42</td>');
  });

  it('renders image, text and video attachments and the log copy target', async () => {
    const envelopes = incidentEnvelopes({
      features: [
        {
          name: 'Attachments',
          scenarios: [
            {
              name: 'has evidence',
              before: [
                {
                  at: 'before',
                  attachments: [
                    {
                      fileName: 'hook.log',
                      mediaType: 'text/plain',
                      body: 'hook log',
                    },
                  ],
                },
              ],
              steps: [
                step('fails with evidence', {
                  status: 'failed',
                  message: 'assertion failed',
                  attachments: [
                    {
                      fileName: 'failure.png',
                      mediaType: 'image/png',
                      body: PNG_1X1,
                    },
                    {
                      fileName: 'server.log',
                      mediaType: 'text/x.cucumber.log+plain',
                      body: LOG_BODY,
                    },
                    {
                      fileName: 'session.webm',
                      mediaType: 'video/webm',
                      body: WEBM_STUB,
                    },
                  ],
                }),
              ],
            },
          ],
        },
      ],
    });
    const startedId = envelopes.find((envelope) => envelope.testCaseStarted)
      ?.testCaseStarted?.id;
    if (!startedId) throw new Error('fixture has no testCaseStarted');
    envelopes.push({
      attachment: {
        body: 'extra log',
        mediaType: 'text/plain',
        contentEncoding: AttachmentContentEncoding.IDENTITY,
        testCaseStartedId: startedId,
        fileName: 'extra.log',
      },
    });
    const html = await renderHtml(envelopes, { title: 'Attachments' });
    const detail = incidentDetail(html);

    expect(detail).toContain('<img class="shot" src="data:image/png;base64,');
    expect(detail).toContain('data-copy-log');
    expect(detail).toContain(LOG_BODY.split('\n')[0]);
    expect(detail).toContain('<video class="shot"');
    expect(detail).toContain('class="attachmentText"');
    expect(detail).toContain('hook.log');
    expect(detail).toContain('hook log');
    expect(detail).toContain('extra.log');
    expect(detail).toContain('extra log');
    expect(detail.match(/class="attachmentText" open/g) ?? []).toHaveLength(3);
  });

  it('shows the no-evidence line above the detail and no empty attachment block', async () => {
    const html = await render(oneScenario('no evidence', 'failed'));
    const panel = incidentSection(html);

    expect(panel).toContain(NO_EVIDENCE);
    expect(panel.indexOf(NO_EVIDENCE)).toBeLessThan(
      panel.indexOf('incidentDetail'),
    );
    expect(panel).not.toContain('<figure class="attachment"');
    expect(panel).not.toContain('class="attachmentEmpty"');
  });

  it('keeps the skipped path attachment notice while the panel renders', async () => {
    const envelopes = incidentEnvelopes(oneScenario('failed', 'failed'));
    const html = await renderRun(
      buildLoadedRun(envelopes, { skippedAttachments: 1 }),
      { title: 'Skipped attachment' },
    );

    expect(incidentSection(html)).not.toBe('');
    expect(html).toContain('1 path attachment was skipped.');
    expect(html).toContain('See the affected scenarios on the Report tab.');
  });

  it('carries earlier attempts, metadata and both copy actions', async () => {
    const html = await renderHtml(await retryIncidentEnvelopes(), {
      title: 'Retries',
    });
    const detail = incidentDetail(html);

    expect(detail).toContain('class="earlierAttempts"');
    expect(detail).toContain('Earlier attempts (2)');
    expect(detail).toContain('Attempt 1');
    expect(detail).toContain('&lt;b&gt;first&lt;/b&gt; attempt');
    expect(detail).toContain('Feature: Retry evidence');
    expect(detail).toContain('Attempt: 1');
    expect(detail).toContain('data-copy-failure');
    expect(incidentSection(html)).toContain('data-copy-scope');
  });

  it('shows a failed step without a message and no empty error block', async () => {
    const html = await render({
      features: [
        {
          name: 'Empty error',
          scenarios: [
            {
              name: 'fails silently',
              steps: [
                step('a passed step'),
                step('the failing step', { status: 'failed' }),
              ],
            },
          ],
        },
      ],
    });
    const panel = incidentSection(html);

    expect(incidentSummary(html)).toContain('the failing step');
    expect(incidentSummary(html)).toMatch(/>Failed</);
    expect(panel).not.toContain('<pre class="error">');
  });

  it('keeps a long error to its first line in the summary and full text in detail', async () => {
    const message = `AssertionError: expected the request to settle\n${'stack frame\n'.repeat(40)}`;
    const html = await render({
      features: [
        {
          name: 'Long error',
          scenarios: [
            {
              name: 'fails long',
              steps: [step('the check', { status: 'failed', message })],
            },
          ],
        },
      ],
    });

    expect(incidentSummary(html)).toContain(
      'AssertionError: expected the request to settle',
    );
    expect(incidentSummary(html)).not.toContain('stack frame');
    expect(incidentDetail(html)).toContain('stack frame');
    expect(incidentDetail(html)).toContain('<pre class="error">');
  });

  it.each([7, 8])(
    'keeps every one of %i steps and collapses passed hooks',
    async (count) => {
      const html = await render({
        features: [
          {
            name: 'Long scenario',
            scenarios: [
              {
                name: 'many steps',
                before: [{ at: 'before' }],
                steps: [
                  ...stepRun(count - 1),
                  step(`step ${count}`, {
                    status: 'failed',
                    message: 'last step failed',
                  }),
                ],
              },
            ],
          },
        ],
      });
      const detail = incidentDetail(html);

      for (let index = 1; index <= count; index += 1) {
        expect(detail, `step ${index}`).toContain(`step ${index}`);
      }
      expect(incidentSummary(html)).toContain(`${count} steps`);
      expect(detail).toContain('<details class="hookGroup"');
      expect(detail).not.toContain('more steps');
    },
  );

  it('escapes every user-controlled summary and detail field', async () => {
    const html = await render({
      features: [
        {
          name: '<script>alert(1)</script>',
          uri: 'features/<img src=x onerror=alert(1)>.feature',
          tags: ['@<b>shop</b>'],
          scenarios: [
            {
              name: '<img src=x onerror=alert(2)>',
              tags: ['@<i>row</i>'],
              steps: [
                step('<svg onload=alert(3)>', {
                  status: 'failed',
                  message: '<script>alert(4)</script>',
                }),
              ],
            },
          ],
        },
      ],
    });
    const panel = incidentSection(html);

    expect(panel).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(panel).toContain('&lt;img src=x onerror=alert(2)&gt;');
    expect(panel).toContain('&lt;svg onload=alert(3)&gt;');
    expect(panel).toContain('&lt;script&gt;alert(4)&lt;/script&gt;');
    expect(panel).toContain('@&lt;i&gt;row&lt;/i&gt;');
    expect(panel).not.toContain('<script>alert');
    expect(panel).not.toContain('<img src=x');
    expect(panel).not.toContain('<svg onload');

    // The outline name and examples name ride in attributes; quote and tag
    // characters must be entity-escaped there too.
    const hostile = 'x"><img src=x onerror=alert(1)>';
    const envelopes = await rulesOutlineEnvelopes();
    for (const envelope of envelopes) {
      if (envelope.pickle) envelope.pickle.name = hostile;
      const feature = envelope.gherkinDocument?.feature;
      for (const child of feature?.children ?? []) {
        for (const ruleChild of child.rule?.children ?? []) {
          for (const examples of ruleChild.scenario?.examples ?? []) {
            examples.name = hostile;
          }
        }
      }
    }
    const outlinePanel = incidentSection(
      await renderHtml(envelopes, { title: 'Outline escape' }),
    );

    expect(outlinePanel).toContain('&quot;&gt;');
    expect(outlinePanel).toContain(
      'data-copy-examples-name="x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"',
    );
    expect(outlinePanel).not.toContain('"><img');
    expect(outlinePanel).not.toContain('x"><');
  });
});

describe('incident row link', () => {
  it('replaces the incident disclosure with a link and keeps its anchor', async () => {
    const html = await render({
      features: [
        {
          name: 'Rows',
          scenarios: [
            { name: 'first failed', status: 'failed' },
            { name: 'passes', status: 'passed' },
          ],
        },
      ],
    });
    const list = featureList(html);
    const incidentTag = openingTagAt(list, 'scenario-1-1');
    const passedTag = openingTagAt(list, 'scenario-1-2');
    const row = rowAround(list, 'scenario-1-1');

    expect(incidentTag).toContain('data-scenario');
    expect(incidentTag).toContain('class="scenario"');
    expect(incidentTag).not.toContain('scenarioRowLink');
    expect(incidentTag).not.toMatch(/^<details\b/);
    expect(row).toContain('class="scenarioButton scenarioRowLink"');
    expect(row).toContain('href="#incident"');
    expect(row).toContain(ROW_LABEL);
    expect(row).toContain('aria-label="first failed — Shown above"');
    expect(row).not.toContain('class="chev"');
    expect(row).not.toContain('detailInline');
    expect(row).not.toContain('data-copy-failure');

    // The passed row keeps its native disclosure and inline body.
    expect(passedTag).toMatch(/^<details class="scenario"/);
    expect(rowAround(list, 'scenario-1-2')).toContain('detailInline');
  });

  it('leaves other non-passing rows their disclosure and one detail each', async () => {
    const html = await render({
      features: [
        {
          name: 'Rows',
          scenarios: [
            { name: 'first failed', status: 'failed' },
            { name: 'second failed', status: 'failed' },
            { name: 'passes', status: 'passed' },
          ],
        },
      ],
    });
    const list = featureList(html);

    expect(openingTagAt(list, 'scenario-1-1')).not.toMatch(/^<details\b/);
    expect(openingTagAt(list, 'scenario-1-2')).toMatch(
      /^<details class="scenario"/,
    );
    expect(rowAround(list, 'scenario-1-2')).toContain('data-copy-failure');
    expect(rowAround(list, 'scenario-1-2')).toContain('detailInline');
    expect(list.match(/data-copy-failure/g) ?? []).toHaveLength(1);
    const disclosureRows = list.match(/<details class="scenario"/g) ?? [];
    expect(disclosureRows).toHaveLength(2);
    expect(list.match(/class="detailInline"/g) ?? []).toHaveLength(
      disclosureRows.length,
    );
    expect(list.match(/href="#incident"/g) ?? []).toHaveLength(1);
  });

  it('links a scenario row inside a rule', async () => {
    const envelopes = await fixtureEnvelopes('rules.ndjson');
    failPickle(envelopes, 'Not enough money');
    const html = await renderHtml(envelopes, { title: 'Rule row' });
    const list = featureList(html);
    const tag = openingTagAt(list, 'scenario-1-1');

    expect(incidentSection(html)).not.toBe('');
    expect(tag).toContain('data-scenario');
    expect(tag).not.toMatch(/^<details\b/);
    expect(list).toContain('class="rule"');
    const row = rowAround(list, 'scenario-1-1');
    expect(row).toContain('href="#incident"');
    expect(row).toContain(ROW_LABEL);
    expect(row).not.toContain('detailInline');
    expect(list.indexOf('class="rule"')).toBeLessThan(
      list.indexOf('href="#incident"'),
    );
  });

  it('links a rule-nested outline example and keeps the anchor', async () => {
    const html = await renderHtml(await rulesOutlineEnvelopes(), {
      title: 'Outlines',
    });
    const list = featureList(html);
    const tag = openingTagAt(list, 'scenario-1-1');

    expect(tag).toContain('data-scenario');
    expect(tag).toContain('data-example="#2.1"');
    expect(tag).not.toMatch(/^<details\b/);
    const row = rowAround(list, 'scenario-1-1');
    expect(row).toContain('href="#incident"');
    expect(row).toContain(ROW_LABEL);
    expect(list.indexOf('class="rule"')).toBeLessThan(
      list.indexOf('href="#incident"'),
    );
    // The linked row carries no second detail; every non-incident row keeps
    // its server-rendered inline body for the no-JS form.
    expect(row).not.toContain('detailInline');
    expect(rowAround(list, 'scenario-1-2')).toContain('detailInline');
    expect(rowAround(list, 'scenario-1-2')).toContain('data-copy-failure');
    const disclosureRows = list.match(/<details class="scenario"/g) ?? [];
    expect(disclosureRows).toHaveLength(6);
    expect(list.match(/class="detailInline"/g) ?? []).toHaveLength(
      disclosureRows.length,
    );
    expect(incidentSummary(html)).toContain(
      'These are failing #2.1 · Eating cucumbers',
    );
  });

  it('points the triage incident link at the panel and the rest at rows', async () => {
    const html = await render({
      features: [
        {
          name: 'Triage order',
          scenarios: [
            { name: 'first failed', status: 'failed' },
            { name: 'second failed', status: 'failed' },
            { name: 'skipped row', status: 'skipped' },
          ],
        },
      ],
    });
    const triage = triageSection(html);

    expect(triage.match(/href="#incident"/g) ?? []).toHaveLength(1);
    const incidentLink =
      /<a class="triageScenario" href="#incident">(.*?)<\/a>/.exec(triage);
    expect(incidentLink?.[1]).toContain('first failed');
    expect(triage).toContain('href="#scenario-1-2"');
    expect(triage).toContain('Skipped');
    expect(openingTagAt(featureList(html), 'scenario-1-1')).toContain(
      'data-scenario',
    );
  });

  it('keeps the panel free of links into the filtered index', async () => {
    const html = await render({
      features: [
        {
          name: 'Filtered',
          scenarios: [{ name: 'fails', status: 'failed', tags: ['@filtered'] }],
        },
      ],
    });
    const panel = incidentSection(html);

    expect(panel).not.toBe('');
    expect(panel).not.toContain('href="#scenario-');
    expect(panel).not.toContain('href="#feature-');
    expect(html).toContain('data-search');
    expect(html).toContain('data-filter-status="failed"');
    expect(html).toContain('data-tag-filter');
  });

  it('scopes expand and collapse copy and the empty copy to the list', async () => {
    const html = await render(oneScenario('fails', 'failed'));

    expect(html).toContain('>Expand all scenarios</button>');
    expect(html).toContain('>Collapse all scenarios</button>');
    expect(html).not.toContain('>Expand all</button>');
    expect(html).not.toContain('>Collapse all</button>');
    expect(html).toContain(
      'No scenarios in the list match the current search or filters.',
    );
    expect(html).not.toContain(
      'No scenarios match the current search or filters.',
    );
  });
});

describe('incident locale and run-level failures', () => {
  it('localizes the heading, badges, row label, no-evidence and plural', async () => {
    const html = await render(
      {
        features: [
          {
            name: 'Kasse',
            scenarios: [
              { name: 'erste Zahlung', status: 'failed' },
              { name: 'zweite Zahlung', status: 'failed' },
            ],
          },
        ],
      },
      'de',
    );

    expect(incidentSection(html)).toContain(GERMAN_HEADING);
    expect(incidentSummary(html)).toContain(GERMAN_RUN_FAILED);
    expect(incidentSummary(html)).toContain(germanMoreIncidents(1));
    expect(incidentSection(html)).toContain(GERMAN_NO_EVIDENCE);
    expect(featureList(html)).toContain(GERMAN_ROW_LABEL);
    // Test data stays verbatim.
    expect(incidentSummary(html)).toContain('erste Zahlung');
    expect(incidentSummary(html)).toContain('Fehlgeschlagen');
    expect(incidentSummary(html)).not.toContain(HEADING);
    expect(incidentSummary(html)).not.toContain(ROW_LABEL);

    const pending = await render(oneScenario('wartet', 'pending'), 'de');
    expect(incidentSummary(pending)).toContain('Aufmerksamkeit erforderlich');
  });

  it('renders a run-level hook failure without an incident panel', async () => {
    const html = await renderHtml(await runHookFailureEnvelopes(), {
      title: 'Run hook',
    });

    expect(incidentSection(html)).toBe('');
    expect(html).not.toContain('id="incident"');
    expect(html).toContain('class="runHooks"');
    expect(html).toContain('AfterAll could not close the browser');
  });
});
