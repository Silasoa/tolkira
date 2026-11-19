import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';

const PRESET_BUTTON =
  '<button class="filter presetFilter" type="button" data-filter-preset="failed" aria-pressed="false">Failed only</button>';

const emptyStatusesFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-statuses.ndjson', import.meta.url),
);
const allStatusesFixture = fileURLToPath(
  new URL('./fixtures/messages/all-statuses.ndjson', import.meta.url),
);
const behaveFixture = fileURLToPath(
  new URL('./fixtures/legacy/behave.json', import.meta.url),
);
const failedFixture = fileURLToPath(
  new URL('./fixtures/legacy/failed.json', import.meta.url),
);

async function renderMessages(path: string): Promise<string> {
  return renderHtml(parseMessages(await readFile(path, 'utf8'), path), {
    title: 'Preset',
  });
}

async function renderLegacy(path: string): Promise<string> {
  return renderHtml(parseLegacyJson(await readFile(path, 'utf8'), path), {
    title: 'Preset',
  });
}

function filtersMarkup(html: string): string {
  const start = html.indexOf('<div class="filters">');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</div>', start));
}

interface LegacyStep {
  result?: { status?: string };
}

interface LegacyElement {
  name: string;
  steps?: LegacyStep[];
}

interface LegacyFeature {
  name: string;
  elements?: LegacyElement[];
}

async function failedOnlyLegacyEnvelopes() {
  const features = JSON.parse(
    await readFile(failedFixture, 'utf8'),
  ) as LegacyFeature[];
  // failed.json also carries passing scenarios; keep only its failed element.
  for (const feature of features) {
    feature.elements = (feature.elements ?? []).filter((element) =>
      (element.steps ?? []).some((step) => step.result?.status === 'failed'),
    );
  }
  return parseLegacyJson(JSON.stringify(features), 'failed-only.json');
}

async function failedWithUnexecutedEnvelopes() {
  return parseMessages(
    await readFile(emptyStatusesFixture, 'utf8'),
    emptyStatusesFixture,
  ).filter((envelope) => envelope.pickle?.name !== 'Passed scenario');
}

describe('failed-only preset presence', () => {
  it('renders the toggle for failed plus another present status', async () => {
    expect(await renderMessages(emptyStatusesFixture)).toContain(PRESET_BUTTON);
    expect(await renderMessages(allStatusesFixture)).toContain(PRESET_BUTTON);
    expect(await renderLegacy(failedFixture)).toContain(PRESET_BUTTON);
  });

  it('renders the toggle for failed plus an unexecuted row only', async () => {
    const html = await renderHtml(await failedWithUnexecutedEnvelopes(), {
      title: 'Failed and unexecuted',
    });

    expect(html).not.toMatch(
      /<button class="filter"[^>]*data-filter-status="passed"/,
    );
    expect(html).toContain(PRESET_BUTTON);
  });

  it('renders no toggle for a passed-only or failed-only run', async () => {
    expect(await renderLegacy(behaveFixture)).not.toContain(PRESET_BUTTON);
    expect(await renderHtml(await failedOnlyLegacyEnvelopes(), {
      title: 'Failed only',
    })).not.toContain(PRESET_BUTTON);
  });
});

describe('failed-only preset markup', () => {
  it('places the preset after the status chips without a status attribute', async () => {
    const html = await renderMessages(emptyStatusesFixture);
    const filters = filtersMarkup(html);

    expect(filters.endsWith(PRESET_BUTTON)).toBe(true);
    expect(filters).not.toMatch(
      /<button class="filter presetFilter"[^>]*data-filter-status=/,
    );
    expect(html).toMatch(
      /<button class="filter"[^>]*data-filter-status="passed"/,
    );
    expect(html).toMatch(
      /<button class="filter"[^>]*data-filter-status="failed"/,
    );
  });
});
