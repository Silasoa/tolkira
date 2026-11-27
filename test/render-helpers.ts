import { readFile } from 'node:fs/promises';
import { TestStepResultStatus, type Envelope } from '@cucumber/messages';
import { expect } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { legacyFixture, messagesFixture } from './fixtures.js';

export async function parseFile(file: string): Promise<Envelope[]> {
  return parseMessages(await readFile(file, 'utf8'), file);
}

/** One fixture envelope whose feature description carries a remote image. */
export async function remoteImageEnvelopes(): Promise<Envelope[]> {
  const envelopes = await parseFile(messagesFixture('screenshot.ndjson'));
  const feature = envelopes.find(
    (envelope) => envelope.gherkinDocument?.feature,
  )?.gherkinDocument?.feature;
  if (!feature) throw new Error('fixture feature missing');
  feature.description = 'Before ![logo](https://example.com/logo.png) after';
  return envelopes;
}

// Shared setup for the split render suites. The default title keeps the
// existing outline calls unchanged; other flows pass their own title.
export async function renderMessagesFile(
  file: string,
  title = 'Outlines',
): Promise<string> {
  const content = await readFile(file, 'utf8');
  return renderHtml(parseMessages(content, file), { title });
}

export async function legacyEnvelopes(name: string, idPrefix: string) {
  const content = await readFile(legacyFixture(name), 'utf8');
  return parseLegacyJson(content, name, { idPrefix });
}

export function syntheticRun(
  features: Array<{
    name: string;
    uri?: string;
    scenarios: Array<{ name: string; status: string; message?: string }>;
  }>,
) {
  return parseLegacyJson(
    JSON.stringify(
      features.map((feature) => ({
        uri: feature.uri,
        name: feature.name,
        elements: feature.scenarios.map((scenario) => ({
          keyword: 'Scenario',
          type: 'scenario',
          name: scenario.name,
          steps: [
            {
              keyword: 'Given ',
              name: 'a step',
              result: {
                status: scenario.status,
                duration: 1,
                ...(scenario.message
                  ? { error_message: scenario.message }
                  : {}),
              },
            },
          ],
        })),
      })),
    ),
    'synthetic.json',
  );
}

export function featureList(html: string): string {
  return html.slice(
    html.indexOf('id="feature-list"'),
    html.indexOf('id="empty-results"'),
  );
}

export function matrixTable(html: string): string {
  const start = html.indexOf('<table class="featureTable">');
  return html.slice(start, html.indexOf('</table>', start));
}

function scenarioRowStart(html: string, index: number): number {
  return Math.max(
    html.lastIndexOf('<details class="scenario"', index),
    html.lastIndexOf('<div class="scenario" id=', index),
  );
}

export function scenarioOpeningTag(html: string, name: string): string {
  const marker = `data-scenario-name="${name}"`;
  const index = html.indexOf(marker);
  expect(index, `scenario ${name}`).toBeGreaterThan(-1);
  const start = scenarioRowStart(html, index);
  return html.slice(start, html.indexOf('>', index) + 1);
}

export function featureOpeningTag(html: string): string {
  const start = html.indexOf('<details class="feature');
  return html.slice(start, html.indexOf('>', start) + 1);
}

export function scenarioSummary(html: string, name: string): string {
  const marker = `data-scenario-name="${name}"`;
  const index = html.indexOf(marker);
  if (index < 0) return '';
  const start = scenarioRowStart(html, index);
  const contentStart = html.indexOf(
    '>',
    html.indexOf('class="scenarioButton', start),
  );
  const ends = [
    html.indexOf('</summary>', contentStart),
    html.indexOf('</div>', contentStart),
  ].filter((position) => position >= 0);
  const end = Math.min(...ends);
  return html.slice(contentStart + 1, end);
}

export function sectionAt(html: string, start: number): string {
  let depth = 0;
  let index = start;
  while (index < html.length) {
    const open = html.indexOf('<section', index);
    const close = html.indexOf('</section>', index);
    if (close < 0) return html.slice(start);
    if (open >= 0 && open < close) {
      depth += 1;
      index = open + 8;
    } else {
      depth -= 1;
      index = close + 10;
      if (depth === 0) return html.slice(start, index);
    }
  }
  return html.slice(start);
}

export function failPickle(
  envelopes: ReturnType<typeof parseMessages>,
  name: string,
): void {
  const pickle = envelopes.find(
    (envelope) => envelope.pickle?.name === name,
  )?.pickle;
  const testCase = envelopes.find(
    (envelope) => envelope.testCase?.pickleId === pickle?.id,
  )?.testCase;
  const started = envelopes.find(
    (envelope) => envelope.testCaseStarted?.testCaseId === testCase?.id,
  )?.testCaseStarted;
  const step = testCase?.testSteps.find((entry) => entry.pickleStepId);
  const finished = envelopes.find(
    (envelope) =>
      envelope.testStepFinished?.testCaseStartedId === started?.id &&
      envelope.testStepFinished?.testStepId === step?.id,
  )?.testStepFinished;
  if (finished) finished.testStepResult.status = TestStepResultStatus.FAILED;
}
