// Synthetic Playwright JSON builders for the retry-evidence tests. The checked-in
// fixture covers the failed-then-passed case; these builders cover the variants
// (no image, five retries, two scenarios, budget) without more fixture files.

import type { ReportScenario } from '../src/report/model.js';

/** Pinned by openspec/changes/retry-evidence/design.md ("Budget and planning"). */
export const RETRY_EVIDENCE_BUDGET = 10 * 1024 * 1024;

/** The same 1x1 transparent PNG the checked-in Playwright fixture inlines. */
export const SMALL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg==';

export const SMALL_PNG_BYTES = Buffer.from(SMALL_PNG, 'base64').length;

export interface EarlierAttachment {
  fileName: string;
  mediaType: string;
  kind: string;
  bytes: number;
  dataUri?: string;
}

export interface EarlierAttempt {
  attempt: number;
  status: string;
  durationMs: number;
  message?: string;
  attachments: EarlierAttachment[];
}

// The model contract is new in this change; the local shape keeps the Red suite
// typecheckable before the implementation adds `ReportEarlierAttempt`.
export function earlierAttemptsOf(
  scenario: ReportScenario,
): EarlierAttempt[] | undefined {
  return (scenario as ReportScenario & { earlierAttempts?: EarlierAttempt[] })
    .earlierAttempts;
}

export interface AttemptOptions {
  retry: number;
  status?: string;
  duration?: number;
  message?: string;
  attachments?: unknown[];
  stepTitle?: string;
}

export function inlineImage(
  name = 'failure.png',
  body = SMALL_PNG,
  contentType = 'image/png',
): unknown {
  return { name, contentType, body };
}

export function attemptResult(options: AttemptOptions): unknown {
  const status = options.status ?? 'failed';
  const duration = options.duration ?? 1000;
  const failed =
    status === 'failed' || status === 'timedOut' || status === 'interrupted';
  return {
    status,
    duration,
    retry: options.retry,
    startTime: new Date(
      Date.parse('2026-11-19T08:00:00.000Z') + options.retry * 1000,
    ).toISOString(),
    errors: failed && options.message ? [{ message: options.message }] : [],
    steps: [
      {
        title: options.stepTitle ?? `step ${options.retry + 1}`,
        duration,
        ...(failed && options.message
          ? { error: { message: options.message } }
          : {}),
      },
    ],
    attachments: options.attachments ?? [],
    stdout: [],
    stderr: [],
  };
}

export function retrySpec(
  title: string,
  results: unknown[],
  options: {
    status?: string;
    file?: string;
    expectedStatus?: string;
  } = {},
): unknown {
  const file = options.file ?? 'retry-evidence.spec.ts';
  return {
    title,
    ok: true,
    tags: [],
    id: `spec-${title}`,
    file,
    line: 5,
    column: 1,
    tests: [
      {
        timeout: 30000,
        annotations: [],
        expectedStatus: options.expectedStatus ?? 'passed',
        projectId: 'chromium',
        projectName: 'chromium',
        status: options.status ?? 'flaky',
        results,
      },
    ],
  };
}

export function retryReport(
  specs: unknown[],
  file = 'retry-evidence.spec.ts',
): unknown {
  return {
    config: {
      version: '1.65.0',
      configFile: 'playwright.config.ts',
      rootDir: 'tests',
      projects: [{ id: 'chromium', name: 'chromium', retries: 2 }],
    },
    suites: [{ title: file, file, line: 0, column: 0, specs }],
    errors: [],
    stats: {
      startTime: '2026-11-19T08:00:00.000Z',
      duration: 1,
      expected: specs.length,
      unexpected: 0,
      flaky: specs.length,
      skipped: 0,
    },
  };
}

/** Inner HTML of each earlier-attempts disclosure, in document order. */
export function earlierBlocks(html: string): string[] {
  return [
    ...html.matchAll(
      /<details class="earlierAttempts"[^>]*>([\s\S]*?)<\/details>/g,
    ),
  ].map((match) => match[1] ?? '');
}
