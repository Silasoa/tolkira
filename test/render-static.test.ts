import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readHistory, type HistoryRun } from '../src/history.js';
import { renderReport } from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { parsePlaywrightJson } from '../src/input/playwright.js';
import { buildLoadedRun } from '../src/loaded-run.js';
import { renderHtml, renderRun } from '../src/render/html.js';
import type { RenderReportOptions } from '../src/options.js';
import { fixturePath, messagesFixture, playwrightFixture } from './fixtures.js';
import { scenarioOpeningTag, syntheticRun } from './render-helpers.js';

const standardFixture = messagesFixture('screenshot.ndjson');
const historyFile = fixturePath('history', 'two-runs.json');
const longHistoryFile = fixturePath('history', 'thirty-runs.json');

// The legacy fallback reads the clock; a pinned clock keeps the size seam and
// the default guard stable.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

async function messages(name: string) {
  const file = messagesFixture(name);
  return parseMessages(await readFile(file, 'utf8'), file);
}

async function history(count: number): Promise<HistoryRun[]> {
  const file = count > 2 ? longHistoryFile : historyFile;
  return (await readHistory(file)).slice(0, count);
}

/** One run carrying every disclosure kind the static form must open. */
async function richEnvelopes() {
  // Shell coverage, not a valid CLI input: all-statuses and hooks reuse gherkin
  // id "3", and the tagged case renders on its own.
  const retryFile = playwrightFixture('retry-evidence.json');
  const retry = await parsePlaywrightJson(
    JSON.parse(await readFile(retryFile, 'utf8')),
    retryFile,
  );
  return [
    ...(await messages('all-statuses.ndjson')),
    ...(await messages('hooks.ndjson')),
    ...(await messages('attachments-presentation.ndjson')),
    ...(await messages('empty.ndjson')),
    ...retry.envelopes,
    ...syntheticRun(
      Array.from({ length: 6 }, (_, index) => ({
        name: `Attention ${index + 1}`,
        scenarios: [{ name: `Failing ${index + 1}`, status: 'failed' }],
      })),
    ),
  ];
}

/** The document without the inline stylesheet, for control and markup checks. */
function markup(html: string): string {
  return html.replaceAll(/<style\b[\s\S]*?<\/style>/gi, '');
}

function openingTags(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(
    (match) => match[0],
  );
}

/** Attribute presence with quoted values removed, so scenario text cannot match. */
function hasAttribute(tag: string, name: string): boolean {
  const withoutValues = tag.replaceAll(/"[^"]*"/g, '""');
  return new RegExp(`\\s${name}(?=[\\s>=])`).test(withoutValues);
}

function tagWithId(html: string, id: string): string {
  const index = html.indexOf(`id="${id}"`);
  expect(index, `#${id}`).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<', index);
  return html.slice(start, html.indexOf('>', index) + 1);
}

function ids(html: string): Set<string> {
  return new Set(
    [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1] ?? ''),
  );
}

function hasScript(html: string): boolean {
  return /<script\b/i.test(html);
}

function danglingAria(html: string): string[] {
  const known = ids(html);
  const dangling: string[] = [];
  for (const match of html.matchAll(
    /\saria-(?:labelledby|controls)="([^"]*)"/g,
  )) {
    for (const token of (match[1] ?? '').split(/\s+/).filter(Boolean)) {
      if (!known.has(token)) dangling.push(token);
    }
  }
  return dangling;
}

function cspDirectives(html: string): Map<string, string[]> {
  const content =
    /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(
      html,
    )?.[1] ?? '';
  return new Map(
    content
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => Boolean(name))
      .map(([name, ...values]) => [name as string, values]),
  );
}

describe('static report shell', () => {
  it('renders without scripts, tabs, dead controls or dangling ARIA', async () => {
    const options: RenderReportOptions = {
      title: 'Static shell',
      static: true,
      history: await history(2),
    };
    const html = await renderHtml(await richEnvelopes(), options);

    expect(hasScript(html), 'static report has no <script>').toBe(false);
    expect(html).not.toContain('type="application/json"');
    expect(html).not.toContain('id="tolkira-messages"');

    const directives = cspDirectives(html);
    expect(directives.get('default-src')).toEqual(["'none'"]);
    expect(directives.get('script-src')).toEqual(["'none'"]);
    expect(directives.get('connect-src')).toEqual(["'none'"]);
    expect(directives.get('img-src')).toEqual(['data:', 'blob:']);
    expect(directives.get('media-src')).toEqual(['data:', 'blob:']);
    expect(directives.get('style-src')).toEqual(["'unsafe-inline'"]);
    expect(directives.get('font-src')).toEqual(['data:']);

    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(html).not.toContain('class="views"');
    expect(html).not.toMatch(/\brole="tab(?:list|panel)?"/);
    expect(html).not.toContain('data-view=');
    expect(html).not.toContain('id="view-report"');
    expect(html).not.toContain('id="view-analysis"');
    expect(html).not.toContain('id="view-trends"');

    for (const id of ['report-view', 'analysis-view', 'trends-view']) {
      expect(hasAttribute(tagWithId(html, id), 'hidden'), id).toBe(false);
    }

    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('data-lightbox-close');
    expect(html).not.toContain('class="shotButton"');
    const inlineImage = /<img\b[^>]*\bclass="shot"[^>]*>/.exec(html)?.[0] ?? '';
    expect(inlineImage).toContain('src="data:image/png;base64,');

    const body = markup(html);
    expect(body).not.toContain('data-copy-failure');
    expect(body).not.toContain('class="copyFailure"');
    expect(body).not.toContain('data-copy-log');
    expect(body).toContain('whoops');

    expect(/<input\b[^>]*\bdata-search/.test(body), 'no search control').toBe(
      false,
    );
    expect(
      /<select\b[^>]*\bdata-tag-filter/.test(body),
      'no tag filter control',
    ).toBe(false);
    expect(body).not.toContain('data-filter-status=');
    expect(body).not.toContain('data-filter-preset=');
    expect(body).not.toContain('data-expand=');
    expect(body).not.toContain('class="toolbar"');
    expect(body).not.toContain('class="search"');
    expect(body).not.toContain('class="tagFilter"');
    expect(body).not.toContain('class="filters"');

    expect(danglingAria(html)).toEqual([]);
    expect(html).not.toContain('<mark');
  });

  it('opens every disclosure kind without a click', async () => {
    const options: RenderReportOptions = {
      title: 'Static details',
      static: true,
      history: await history(2),
    };
    const html = await renderHtml(await richEnvelopes(), options);

    for (const kind of [
      'class="feature has-',
      'class="scenario"',
      'class="hookGroup"',
      'class="earlierAttempts"',
      'class="attachmentText"',
      'class="triageRest"',
      'class="triageBox"',
    ]) {
      expect(html, kind).toContain(kind);
    }

    const details = openingTags(html, 'details');
    expect(details.length).toBeGreaterThan(0);
    for (const tag of details) {
      expect(hasAttribute(tag, 'open'), tag.slice(0, 120)).toBe(true);
    }

    expect(hasAttribute(scenarioOpeningTag(html, 'Passing'), 'open')).toBe(
      true,
    );
    const unexecuted = scenarioOpeningTag(html, 'Blank Scenario');
    expect(hasAttribute(unexecuted, 'open')).toBe(true);
    expect(hasAttribute(unexecuted, 'data-status')).toBe(false);
  });

  it('renders tagged rows without a tag filter', async () => {
    const options: RenderReportOptions = { title: 'Static tags', static: true };
    const html = await renderHtml(await messages('tags.ndjson'), options);
    const body = markup(html);

    expect(
      /<select\b[^>]*\bdata-tag-filter/.test(body),
      'no tag filter control',
    ).toBe(false);
    expect(body).not.toContain('class="tagFilter"');
    expect(html.match(/data-scenario-name="/g) ?? []).toHaveLength(3);
  });

  it('points the skip notice at the report instead of a tab', async () => {
    const run = buildLoadedRun(await messages('empty.ndjson'), {
      skippedAttachments: 1,
    });
    const staticHtml = await renderRun(run, {
      title: 'Static skip',
      static: true,
    });
    const defaultHtml = await renderRun(run, { title: 'Default skip' });

    expect(staticHtml).toContain('See the affected scenarios in the report.');
    expect(staticHtml).not.toContain('on the Report tab');
    expect(defaultHtml).toContain(
      'See the affected scenarios on the Report tab.',
    );
  });

  it('escapes hostile text without a script or markup executing', async () => {
    const options: RenderReportOptions = {
      title: 'Hostile static',
      static: true,
    };
    const html = await renderHtml(
      syntheticRun([
        {
          name: '<script>alert(1)</script>',
          scenarios: [
            {
              name: '<img src=x onerror=alert(1)>',
              status: 'failed',
              message: '<script>alert(2)</script>',
            },
          ],
        },
      ]),
      options,
    );

    expect(hasScript(html), 'no <script> element').toBe(false);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('static views', () => {
  it('stacks Report, Details and Trends with two history runs', async () => {
    const options: RenderReportOptions = {
      title: 'Static stack',
      static: true,
      history: await history(2),
    };
    const html = await renderHtml(await richEnvelopes(), options);

    for (const id of ['report-view', 'analysis-view', 'trends-view']) {
      const tag = tagWithId(html, id);
      expect(hasAttribute(tag, 'hidden'), id).toBe(false);
      expect(hasAttribute(tag, 'role'), id).toBe(false);
    }
    expect(html).toContain('Recorded runs');
    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(/\brole="tab(?:list|panel)?"/.test(html), 'no tab roles').toBe(
      false,
    );
  });

  it.each([0, 1])(
    'omits Trends with %i history runs and keeps Report and Details',
    async (count) => {
      const options: RenderReportOptions = {
        title: `Static ${count}`,
        static: true,
        history: await history(count),
      };
      const html = await renderHtml(await richEnvelopes(), options);

      expect(html).not.toContain('id="trends-view"');
      expect(html).not.toContain('data-view="trends"');
      for (const id of ['report-view', 'analysis-view']) {
        expect(hasAttribute(tagWithId(html, id), 'hidden'), id).toBe(false);
      }
    },
  );

  it('keeps the Trends table and sparkline with many runs', async () => {
    const options: RenderReportOptions = {
      title: 'Static many',
      static: true,
      history: await history(30),
    };
    const html = await renderHtml(await richEnvelopes(), options);

    expect(html).toContain('id="trends-view"');
    expect(html.match(/class="sparkPoint"/g) ?? []).toHaveLength(30);
    expect(hasAttribute(tagWithId(html, 'trends-view'), 'hidden')).toBe(false);
  });
});

describe('default report guard', () => {
  it('keeps scripts, controls, collapsed passed rows and one main element', async () => {
    const html = await renderHtml(await richEnvelopes(), {
      title: 'Default guard',
      history: await history(2),
    });

    expect(html.match(/<script\b/g) ?? []).toHaveLength(3);
    expect(html).toContain('id="tolkira-messages"');
    const body = markup(html);
    expect(body).toContain('class="toolbar"');
    expect(body).toMatch(/<input\b[^>]*\bdata-search/);
    expect(body).toContain('data-filter-status=');
    expect(body).toContain('data-copy-failure');
    expect(body).toContain('data-copy-log');
    expect(body).toContain('class="shotButton"');
    expect(body).toContain('<dialog');
    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(html.match(/\brole="tab"/g) ?? []).toHaveLength(3);
    expect(html.match(/\brole="tabpanel"/g) ?? []).toHaveLength(3);
    for (const id of [
      'report-view',
      'analysis-view',
      'trends-view',
      'view-report',
      'view-analysis',
      'view-trends',
    ]) {
      expect(html.match(new RegExp(`id="${id}"`, 'g')) ?? [], id).toHaveLength(
        1,
      );
    }

    const script = cspDirectives(html).get('script-src') ?? [];
    expect(script).not.toEqual(["'none'"]);
    expect(script.some((value) => value.startsWith("'sha256-"))).toBe(true);

    expect(hasAttribute(scenarioOpeningTag(html, 'Failing'), 'open')).toBe(
      true,
    );
    const passed = scenarioOpeningTag(html, 'Passing');
    expect(hasAttribute(passed, 'open')).toBe(false);
    expect(hasAttribute(passed, 'data-status')).toBe(true);
    expect(hasAttribute(tagWithId(html, 'analysis-view'), 'hidden')).toBe(true);
    expect(hasAttribute(tagWithId(html, 'trends-view'), 'hidden')).toBe(true);
  });

  it('keeps the tag filter in the default report', async () => {
    const html = await renderHtml(await messages('tags.ndjson'), {
      title: 'Default tags',
    });

    expect(markup(html)).toMatch(/<select\b[^>]*\bdata-tag-filter/);
  });
});

describe('static size seam', () => {
  it('measures the static and default bytes for the standard fixture', async () => {
    const defaults = { title: 'Static size' } satisfies RenderReportOptions;
    const staticOptions: RenderReportOptions = {
      title: 'Static size',
      static: true,
    };
    const defaultHtml = await renderReport(standardFixture, defaults);
    const staticHtml = await renderReport(standardFixture, staticOptions);
    const defaultBytes = Buffer.byteLength(defaultHtml, 'utf8');
    const staticBytes = Buffer.byteLength(staticHtml, 'utf8');

    expect(defaultHtml).toContain('id="tolkira-messages"');
    expect(hasScript(staticHtml), 'static report has no <script>').toBe(false);
    expect(
      staticBytes,
      `default ${defaultBytes} bytes, static ${staticBytes} bytes`,
    ).toBeLessThan(defaultBytes);
  });
});
