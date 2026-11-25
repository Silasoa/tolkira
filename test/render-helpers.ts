import { readFile } from 'node:fs/promises';
import { TestStepResultStatus } from '@cucumber/messages';
import { expect } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { legacyFixture } from './fixtures.js';

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

export function scenarioOpeningTag(html: string, name: string): string {
  const marker = `data-scenario-name="${name}"`;
  const index = html.indexOf(marker);
  expect(index, `scenario ${name}`).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<details class="scenario"', index);
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
  const start = html.lastIndexOf('<details class="scenario"', index);
  return html.slice(
    html.indexOf('>', start) + 1,
    html.indexOf('</summary>', index),
  );
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
