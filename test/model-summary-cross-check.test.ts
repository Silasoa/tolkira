import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Envelope } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { parseJUnitXml } from '../src/input/junit.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel, type ReportModel } from '../src/report/model.js';
import { type ReportStatus, statusSeverity, worstExecutedStatus } from '../src/report/status.js';
import { displayUri, summarizeEnvelopes, type ReportSummary } from '../src/summary.js';

const fixture = (path: string): string =>
  fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));

interface CrossCheckCase {
  name: string;
  load: () => Promise<Envelope[]>;
}

const messagesCase = (name: string): CrossCheckCase => ({
  name: `messages/${name}`,
  load: async () =>
    parseMessages(
      await readFile(fixture(`messages/${name}.ndjson`), 'utf8'),
      `${name}.ndjson`,
    ),
});

const legacyCase = (name: string): CrossCheckCase => ({
  name: `legacy/${name}`,
  load: async () => {
    const file = fixture(`legacy/${name}.json`);
    return parseLegacyJson(await readFile(file, 'utf8'), file, {
      idPrefix: 'cross-check',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  },
});

const cases: CrossCheckCase[] = [
  ...[
    'screenshot',
    'examples-tables',
    'examples-tables-attachment',
    'hooks',
    'global-hooks',
    'global-hooks-attachments',
    'undefined',
    'ambiguous',
    'all-statuses',
    'rules',
    'rules-backgrounds',
    'backgrounds',
    'tags',
    'empty',
    'empty-mixed',
    'empty-all-unexecuted',
    'empty-unfinished',
    'empty-hook-only',
    'empty-retry',
    'empty-none',
    'empty-outline-mixed',
    'empty-unexecuted-attachment',
  ].map(messagesCase),
  ...['happy', 'failed', 'screenshot', 'empty', 'missing-result', 'behave'].map(
    legacyCase,
  ),
  {
    name: 'junit/basic',
    load: async () =>
      parseJUnitXml(
        await readFile(fixture('junit/basic.xml'), 'utf8'),
        'basic.xml',
      ),
  },
];

interface ScenarioFingerprint {
  name: string;
  uri: string;
  status: ReportStatus;
  executed: boolean;
  attempt: number;
  durationMs: number;
  tags: string[];
  steps: ReportStatus[];
  hooks: ReportStatus[];
}

const sorted = (rows: ScenarioFingerprint[]): ScenarioFingerprint[] =>
  [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

function modelFingerprint(model: ReportModel): ScenarioFingerprint[] {
  return sorted(
    model.scenarios.map((scenario) => ({
      name: scenario.name,
      uri: displayUri(scenario.uri),
      status: scenario.status,
      executed: scenario.executed,
      attempt: scenario.attempt,
      durationMs: scenario.durationMs,
      tags: [...scenario.tags],
      steps: scenario.steps.map((step) => step.status),
      hooks: scenario.hooks.map((hook) => hook.status),
    })),
  );
}

function summaryFingerprint(summary: ReportSummary): ScenarioFingerprint[] {
  return sorted(
    summary.scenarios.map((scenario) => ({
      name: scenario.name,
      uri: scenario.uri,
      status: scenario.status,
      executed: scenario.executed,
      attempt: scenario.attempt,
      durationMs: scenario.durationMs,
      tags: [...scenario.tags],
      steps: scenario.steps
        .filter((step) => step.keyword !== 'Hook')
        .map((step) => step.status),
      hooks: scenario.steps
        .filter((step) => step.keyword === 'Hook')
        .map((step) => step.status),
    })),
  );
}

describe('model and summary cross-check', () => {
  for (const testCase of cases) {
    it(`agrees on counts and status for ${testCase.name}`, async () => {
      const envelopes = await testCase.load();
      const model = buildReportModel(envelopes);
      const summary = summarizeEnvelopes(envelopes);

      expect(summary.counts.features, 'features').toBe(model.counts.features);
      expect(summary.counts.scenarios, 'scenarios').toEqual(
        model.counts.scenarios,
      );
      expect(summary.attachments.total, 'attachments').toBe(
        model.counts.attachments,
      );
      expect(summary.attachments.bytes, 'attachment bytes').toBe(
        model.counts.attachmentBytes,
      );
      expect(summary.durationMs, 'duration').toBe(model.durationMs);
      expect(summaryFingerprint(summary), 'scenario rows').toEqual(
        modelFingerprint(model),
      );

      const scenarioOverall = worstExecutedStatus(model.scenarios);
      if (model.runHooks.length === 0) {
        expect(summary.status, 'overall status').toBe(scenarioOverall);
      } else {
        // A failing run hook may worsen the overall status but never improve it.
        expect(
          statusSeverity(summary.status),
          'overall status',
        ).toBeGreaterThanOrEqual(statusSeverity(scenarioOverall));
      }
    });
  }
});
