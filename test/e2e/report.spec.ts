import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';
import { legacyFixture, messagesFixture } from '../fixtures.js';

const fixture = messagesFixture('screenshot.ndjson');
const legacyFixturePath = legacyFixture('screenshot.json');
const minimalFixture = legacyFixture('minimal.json');
const tableFixture = legacyFixture('happy.json');
const xssFixture = legacyFixture('xss.json');
const noMessageFixture = legacyFixture('failed-no-message.json');
const unhappyFixture = legacyFixture('unhappy.json');
const examplesFixture = messagesFixture('examples-tables.ndjson');
const parametersFixture = messagesFixture('parameters.ndjson');
const examplesAttachmentFixture = messagesFixture(
  'examples-tables-attachment.ndjson',
);
const hooksFixture = messagesFixture('hooks.ndjson');
const globalHooksFixture = messagesFixture('global-hooks.ndjson');
const globalHookAttachments = messagesFixture('global-hooks-attachments.ndjson');
const undefinedFixture = messagesFixture('undefined.ndjson');
const ambiguousFixture = messagesFixture('ambiguous.ndjson');
const rulesOutlineBackgroundFixture = messagesFixture(
  'rules-outline-background.ndjson',
);
const tagsFixture = messagesFixture('tags.ndjson');
const emptyFixture = messagesFixture('empty.ndjson');
const emptyNoneFixture = messagesFixture('empty-none.ndjson');
const emptyMixedFixture = messagesFixture('empty-mixed.ndjson');
const emptyStatusesFixture = messagesFixture('empty-statuses.ndjson');

async function writeFailedTagsFixture(dir: string): Promise<string> {
  const input = path.join(dir, 'failed-tags.ndjson');
  const lines = (await readFile(tagsFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  const pickle = lines.find((line) => line.pickle?.name === 'tagged scenario')
    ?.pickle;
  const testCase = lines.find(
    (line) => line.testCase?.pickleId === pickle?.id,
  )?.testCase;
  const started = lines.find(
    (line) => line.testCaseStarted?.testCaseId === testCase?.id,
  )?.testCaseStarted;
  const step = testCase?.testSteps.find((entry: { pickleStepId?: string }) =>
    entry.pickleStepId,
  );
  const finished = lines.find(
    (line) =>
      line.testStepFinished?.testCaseStartedId === started?.id &&
      line.testStepFinished.testStepId === step?.id,
  )?.testStepFinished;
  expect(finished).toBeTruthy();
  finished.testStepResult.status = 'FAILED';
  await writeFile(
    input,
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'utf8',
  );
  return input;
}

function outlineNdjson(count: number): string {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `r${index + 1}`,
    cells: [{ value: String(index + 1) }],
  }));
  const envelopes: Array<Record<string, unknown>> = [
    { testRunStarted: { timestamp: { seconds: 1, nanos: 0 } } },
    {
      gherkinDocument: {
        uri: 'features/many-outlines.feature',
        comments: [],
        feature: {
          name: 'Many outline examples',
          keyword: 'Feature',
          language: 'en',
          description: '',
          tags: [],
          location: { line: 1, column: 1 },
          children: [
            {
              scenario: {
                id: 's1',
                keyword: 'Scenario Outline',
                name: 'Stress outline <n>',
                description: 'Outline description line.',
                tags: [],
                location: { line: 2, column: 1 },
                steps: [
                  {
                    id: 'step1',
                    keyword: 'Given ',
                    keywordType: 'CONTEXT',
                    text: 'value <n>',
                    location: { line: 3, column: 1 },
                  },
                ],
                examples: [
                  {
                    id: 'e1',
                    keyword: 'Examples',
                    name: 'Rows',
                    description: 'Examples description line.',
                    tags: [],
                    location: { line: 4, column: 1 },
                    tableHeader: {
                      id: 'h1',
                      location: { line: 5, column: 1 },
                      cells: [{ value: 'n' }],
                    },
                    tableBody: rows,
                  },
                ],
              },
            },
          ],
        },
      },
    },
  ];
  for (let index = 0; index < count; index += 1) {
    const n = index + 1;
    envelopes.push(
      {
        pickle: {
          id: `p${n}`,
          uri: 'features/many-outlines.feature',
          name: `Stress outline ${n}`,
          language: 'en',
          astNodeIds: ['s1', `r${n}`],
          tags: [],
          steps: [{ id: `ps${n}`, text: `value ${n}`, astNodeIds: ['step1'] }],
        },
      },
      {
        testCase: {
          id: `tc${n}`,
          pickleId: `p${n}`,
          testSteps: [{ id: `ts${n}`, pickleStepId: `ps${n}` }],
        },
      },
      {
        testCaseStarted: {
          id: `tcs${n}`,
          testCaseId: `tc${n}`,
          attempt: 0,
          timestamp: { seconds: 1, nanos: n },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: `tcs${n}`,
          testStepId: `ts${n}`,
          timestamp: { seconds: 1, nanos: n },
          testStepResult: {
            status: 'PASSED',
            duration: { seconds: 0, nanos: 1000000 },
          },
        },
      },
      {
        testCaseFinished: {
          testCaseStartedId: `tcs${n}`,
          timestamp: { seconds: 1, nanos: n },
          willBeRetried: false,
        },
      },
    );
  }
  envelopes.push({
    testRunFinished: { timestamp: { seconds: 2, nanos: 0 }, success: true },
  });
  return envelopes.map((envelope) => JSON.stringify(envelope)).join('\n');
}

function nonPassedNdjson(count: number): string {
  const envelopes: Array<Record<string, unknown>> = [
    { testRunStarted: { id: 'run', timestamp: { seconds: 1, nanos: 0 } } },
    {
      gherkinDocument: {
        uri: 'features/stress-non-passed.feature',
        comments: [],
        feature: {
          name: 'Stress non-passed feature',
          keyword: 'Feature',
          language: 'en',
          description: '',
          tags: [],
          location: { line: 1, column: 1 },
          children: Array.from({ length: count }, (_, index) => {
            const n = index + 1;
            return {
              scenario: {
                id: `s${n}`,
                tags: [],
                location: { line: n * 2, column: 3 },
                keyword: 'Scenario',
                name: `Non-passed scenario ${n}`,
                description: '',
                steps: [
                  {
                    id: `step${n}`,
                    location: { line: n * 2 + 1, column: 5 },
                    keyword: 'Given ',
                    keywordType: 'Context',
                    text: `an undefined step ${n}`,
                  },
                ],
                examples: [],
              },
            };
          }),
        },
      },
    },
  ];
  for (let index = 0; index < count; index += 1) {
    const n = index + 1;
    envelopes.push(
      {
        pickle: {
          id: `p${n}`,
          uri: 'features/stress-non-passed.feature',
          name: `Non-passed scenario ${n}`,
          language: 'en',
          astNodeIds: [`s${n}`],
          tags: [],
          steps: [
            {
              id: `ps${n}`,
              text: `an undefined step ${n}`,
              astNodeIds: [`step${n}`],
            },
          ],
        },
      },
      {
        testCase: {
          id: `tc${n}`,
          pickleId: `p${n}`,
          testSteps: [
            { id: `ts${n}`, pickleStepId: `ps${n}`, stepDefinitionIds: [] },
          ],
        },
      },
      {
        testCaseStarted: {
          id: `tcs${n}`,
          testCaseId: `tc${n}`,
          attempt: 0,
          timestamp: { seconds: 1, nanos: n },
        },
      },
      {
        suggestion: {
          id: `sug${n}`,
          pickleStepId: `ps${n}`,
          snippets: [
            {
              language: 'typescript',
              code: `Given("an undefined step ${n}", () => {})`,
            },
          ],
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: `tcs${n}`,
          testStepId: `ts${n}`,
          timestamp: { seconds: 1, nanos: n },
          testStepResult: {
            status: 'UNDEFINED',
            duration: { seconds: 0, nanos: 0 },
          },
        },
      },
      {
        testCaseFinished: {
          testCaseStartedId: `tcs${n}`,
          timestamp: { seconds: 1, nanos: n },
          willBeRetried: false,
        },
      },
    );
  }
  envelopes.push({
    testRunFinished: {
      testRunStartedId: 'run',
      timestamp: { seconds: 2, nanos: 0 },
      success: false,
    },
  });
  return envelopes.map((envelope) => JSON.stringify(envelope)).join('\n');
}

test('renders a messages report in the browser', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-e2e-'));
  const output = path.join(dir, 'report.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(page).toHaveTitle('Tolkira E2E');
    await expect(
      page.getByRole('heading', { name: 'Tolkira E2E', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Report' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
    await expect(page.getByText('1 feature')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Screenshot attachment' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeVisible();
    await expect(page.getByText('screenshot.png')).toBeVisible();
    await expect(
      page.locator('img[src^="data:image/png"]').first(),
    ).toBeVisible();
    await expect(page.locator('.scenarioButton .thumb').first()).toBeVisible();

    await page.locator('.shotButton').first().click();
    const lightbox = page.locator('#tolkira-lightbox');
    await expect(lightbox).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.style.overflow),
    ).toBe('hidden');
    await expect(lightbox.locator('img')).toHaveAttribute(
      'src',
      /^data:image\/png/,
    );
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.overflow),
      )
      .toBe('');
    await expect(page.locator('.shotButton').first()).toBeFocused();

    await page.locator('.shotButton').first().click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(lightbox).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.overflow),
      )
      .toBe('');
    await expect(page.locator('.shotButton').first()).toBeFocused();

    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    await expect(
      page.locator('.error').filter({ hasText: 'Expected 1 to equal 2' }),
    ).toBeVisible();

    const failedFilter = page.locator('button.filter[data-filter-status="failed"]');
    await page.getByRole('heading', { name: 'Failing scenario' }).click();
    await expect(failedFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();

    await page.getByRole('searchbox', { name: /Search/ }).fill('Failing');
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Details' }).click();
    await expect(
      page.getByRole('heading', { name: 'Run details', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Status distribution')).toBeVisible();
    await page.getByRole('tab', { name: 'Report' }).click();
    await expect(
      page.getByRole('heading', { name: 'Tolkira E2E', level: 1 }),
    ).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('filters by status', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-filter-e2e-'));
  const output = path.join(dir, 'filter.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira filter'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const failedFilter = page.locator('button.filter[data-filter-status="failed"]');
    await expect(failedFilter).toBeVisible();
    await expect(failedFilter).toHaveAttribute('aria-pressed', 'true');
    await failedFilter.focus();
    await page.keyboard.press('Space');
    await expect(failedFilter).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      '1 of 2 scenarios visible',
    );

    await page.setViewportSize({ width: 375, height: 800 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('filters by tag', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-tag-filter-e2e-'));
  const output = path.join(dir, 'tag-filter.html');

  try {
    const code = await runCli(
      [tableFixture, '--out', output, '--title', 'Tolkira tag filter'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const tagFilter = page.locator('select[data-tag-filter]');
    await expect(tagFilter).toBeVisible();
    await expect(tagFilter.locator('option')).toHaveCount(6);

    await tagFilter.selectOption('@testScenarioOutline');
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);
    await expect(page.getByRole('status')).toContainText(
      '2 of 6 scenarios visible',
    );
    const feature = page
      .locator('details.feature')
      .filter({ hasText: 'Happy HTML reporting' });
    await expect(feature).toHaveAttribute('open', '');
    await expect(
      page.locator('details.scenario:visible[open]'),
    ).toHaveCount(0);

    await tagFilter.selectOption('');
    await expect(page.locator('details.scenario:visible')).toHaveCount(6);
    await expect(page.getByRole('status')).toContainText(
      '6 of 6 scenarios visible',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('highlights search matches when the browser supports the Highlight API', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-highlight-e2e-'));
  const output = path.join(dir, 'highlight.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira highlight'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const search = page.getByRole('searchbox', { name: /Search/ });
    const supportsHighlight = await page.evaluate(() => {
      const css = (
        globalThis as unknown as { CSS?: { highlights?: unknown } }
      ).CSS;
      const HighlightCtor = (
        globalThis as unknown as { Highlight?: unknown }
      ).Highlight;
      return Boolean(css?.highlights) && typeof HighlightCtor === 'function';
    });

    await search.fill('Failing');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    if (!supportsHighlight) return;

    const rangeCount = await page.evaluate(() => {
      const css = (
        globalThis as unknown as {
          CSS?: { highlights?: Map<string, Set<Range>> };
        }
      ).CSS;
      return css?.highlights?.get('tolkira-search')?.size ?? 0;
    });
    expect(rangeCount).toBeGreaterThan(0);

    const rangeText = await page.evaluate(() => {
      const css = (
        globalThis as unknown as {
          CSS?: { highlights?: Map<string, Set<Range>> };
        }
      ).CSS;
      const highlight = css?.highlights?.get('tolkira-search');
      return highlight ? Array.from(highlight).map((range) => range.toString()) : [];
    });
    expect(rangeText).toContain('Failing');

    await search.fill('F');
    const hasHighlight = await page.evaluate(() => {
      const css = (
        globalThis as unknown as {
          CSS?: { highlights?: Map<string, Set<Range>> };
        }
      ).CSS;
      return Boolean(css?.highlights?.has('tolkira-search'));
    });
    expect(hasHighlight).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('copies failure details', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-copy-e2e-'));
  const output = path.join(dir, 'copy.html');

  await page.addInitScript(() => {
    (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied =
            text;
          return Promise.resolve();
        },
      },
    });
  });

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira copy'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const failed = page.locator(
      'details[data-scenario][data-status="failed"]',
    );
    const copy = failed.locator('[data-copy-failure]');
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');
    await expect(page.locator('#tolkira-copy-live')).toHaveText(
      'Failure details copied to clipboard.',
    );

    const copied = await page.evaluate(
      () =>
        (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ??
        '',
    );
    expect(copied).toContain('Feature: Screenshot attachment');
    expect(copied).toContain('Scenario: Failing scenario');
    expect(copied).toContain('URI: features/screenshot.feature');
    expect(copied).toContain('Step: Then the assertion fails');
    expect(copied).toContain('Error:\nExpected 1 to equal 2');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('copies parameterised failure details with the matched argument', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-copy-param-e2e-'));
  const input = path.join(dir, 'parameters.ndjson');
  const output = path.join(dir, 'parameters.html');

  await page.addInitScript(() => {
    (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied =
            text;
          return Promise.resolve();
        },
      },
    });
  });

  try {
    const lines = (await readFile(parametersFixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    const pickle = lines.find((line) => line.pickle?.name === 'Numbers')?.pickle;
    const testCase = lines.find(
      (line) => line.testCase?.pickleId === pickle?.id,
    )?.testCase;
    const stepIds = new Set<string>(
      (testCase?.testSteps ?? []).map((step: { id: string }) => step.id),
    );
    for (const line of lines) {
      if (
        line.testStepFinished &&
        stepIds.has(line.testStepFinished.testStepId)
      ) {
        line.testStepFinished.testStepResult.status = 'FAILED';
        line.testStepFinished.testStepResult.message = 'Expected 12 cucumbers';
      }
    }
    await writeFile(
      input,
      `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'utf8',
    );

    const code = await runCli(
      [input, '--out', output, '--title', 'Parameter copy'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const failed = page.locator(
      'details[data-scenario][data-status="failed"]',
    );
    await expect(failed.locator('.param')).toHaveText('12');
    const copy = failed.locator('[data-copy-failure]');
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');

    const copied = await page.evaluate(
      () =>
        (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ??
        '',
    );
    expect(copied).toContain('Step: Given I have 12 cucumbers');
    expect(copied).toContain('Expected 12 cucumbers');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('copies failure details without terminal escape sequences', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-copy-ansi-e2e-'));
  const input = path.join(dir, 'ansi.ndjson');
  const output = path.join(dir, 'ansi.html');
  const esc = '\u001b';
  const hostile =
    `${esc}]8;;https://evil.example/${esc}\\link${esc}]8;;${esc}\\` +
    `${esc}]52;c;cHduZWQ=\u0007clip` +
    `${esc}Pdcs payload${esc}\\` +
    `${esc}_apc payload${esc}\\` +
    `${esc}(Btwo-byte` +
    `\u009d52;c;c1\u0007c1clip` +
    `\u0090c1-dcs\u009c` +
    `\u009b31mc1-red\u009b0m` +
    `\u0000\u007f\u0085`;

  await page.addInitScript(() => {
    (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied =
            text;
          return Promise.resolve();
        },
      },
    });
  });

  try {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    const failed = lines.find(
      (line) =>
        line.testStepFinished?.testStepResult?.status === 'FAILED',
    );
    if (!failed) throw new Error('fixture has no failed test step');
    failed.testStepFinished.testStepResult.message = hostile;
    failed.testStepFinished.testStepResult.exception = {
      type: 'Error',
      message: hostile,
    };
    await writeFile(
      input,
      `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'utf8',
    );

    const code = await runCli([input, '--out', output, '--title', 'ANSI copy'], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const copy = page.locator(
      'details[data-scenario][data-status="failed"] [data-copy-failure]',
    );
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');

    const copied = await page.evaluate(
      () =>
        (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ??
        '',
    );
    expect(copied).toContain('linkcliptwo-bytec1clipc1-red');
    expect(copied).not.toContain(esc);
    expect(copied).not.toContain(']52;');
    expect(copied).not.toContain(']8;;');
    expect(copied).not.toContain('dcs payload');
    expect(copied).not.toContain('apc payload');
    // oxlint-disable-next-line no-control-regex
    expect(copied).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reports a failed clipboard copy', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-copy-fail-e2e-'));
  const output = path.join(dir, 'copy-fail.html');

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('blocked')),
      },
    });
    document.execCommand = () => false;
  });

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira copy failure'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const copy = page.locator(
      'details[data-scenario][data-status="failed"] [data-copy-failure]',
    );
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copy failed');
    await expect(page.locator('#tolkira-copy-live')).toHaveText(
      'Could not copy failure details.',
    );
    await expect(copy).toBeFocused();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('copies a failure without an error message', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-copy-empty-e2e-'));
  const output = path.join(dir, 'copy-empty.html');

  await page.addInitScript(() => {
    (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied =
            text;
          return Promise.resolve();
        },
      },
    });
  });

  try {
    const code = await runCli(
      [noMessageFixture, '--out', output, '--title', 'Tolkira empty copy'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const copy = page.locator('[data-copy-failure]');
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');

    const copied = await page.evaluate(
      () =>
        (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ??
        '',
    );
    expect(copied).toContain('Step: Given a failing step');
    expect(copied).not.toContain('Error:');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('searches by tag', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-tag-e2e-'));
  const output = path.join(dir, 'tag.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira tag'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await page.getByRole('searchbox', { name: /Search/ }).fill('@failing');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeHidden();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('renders a legacy screenshot in the browser', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-legacy-e2e-'));
  const output = path.join(dir, 'legacy.html');

  try {
    const code = await runCli(
      [legacyFixturePath, '--out', output, '--title', 'Legacy E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(page).toHaveTitle('Legacy E2E');
    await expect(
      page.getByRole('heading', { name: 'Happy HTML reporting' }),
    ).toBeVisible();
    await expect(page.getByText('attachment.png')).toBeVisible();
    const hookGroup = page.locator('details.hookGroup').first();
    await expect(hookGroup).toBeVisible();
    await hookGroup.locator('summary').click();
    await expect(hookGroup.locator('.hookLabel').first()).toContainText('Before');
    await expect(
      page.locator('img[src^="data:image/png"]').first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(page.getByText('attachment.png')).toBeHidden();
    await page.getByRole('button', { name: 'Expand all' }).click();
    await expect(page.getByText('attachment.png')).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('does not execute HTML attachments', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-xss-e2e-'));
  const output = path.join(dir, 'xss.html');
  let dialogOpened = false;
  page.on('dialog', async (dialog) => {
    dialogOpened = true;
    await dialog.dismiss();
  });

  try {
    const code = await runCli(
      [xssFixture, '--out', output, '--title', 'XSS E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await page.getByRole('button', { name: 'Expand all' }).click();
    const attachment = page.getByText(/attachment\.html/).first();
    await expect(attachment).toBeVisible();
    await attachment.click();

    const executed = await page.evaluate(
      () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
    );
    expect(executed).toBeUndefined();
    expect(dialogOpened).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('opens a collapsed feature when searching', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-search-e2e-'));
  const output = path.join(dir, 'search.html');

  try {
    const code = await runCli(
      [fixture, minimalFixture, '--out', output, '--title', 'Search E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const minimal = page.getByRole('heading', { name: 'Minimal scenario' });
    await expect(minimal).toBeHidden();

    await page.getByRole('searchbox', { name: /Search/ }).fill('Minimal scenario');
    await expect(minimal).toBeVisible();
    await expect(
      page.locator('details.scenario').filter({ hasText: 'Minimal scenario' }),
    ).toHaveAttribute('open', '');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps Details content reachable by keyboard', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-keys-e2e-'));
  const output = path.join(dir, 'keys.html');

  try {
    const code = await runCli(
      [tableFixture, '--out', output, '--title', 'Keyboard E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await page.getByRole('tab', { name: 'Details' }).click();
    await page.getByRole('tab', { name: 'Details' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#analysis-view')).toBeFocused();

    await page.keyboard.press('Tab');
    const tableWrap = page.locator('#analysis-view .tableWrap');
    await expect(tableWrap).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#analysis-view pre.json')).toBeFocused();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reflows at 200% page zoom', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-zoom-e2e-'));
  const output = path.join(dir, 'zoom.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Zoom E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto(pathToFileURL(output).href);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    expect(overflow).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole('heading', { name: 'Zoom E2E', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const textOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    expect(textOverflow).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole('heading', { name: 'Zoom E2E', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();

    await page.setViewportSize({ width: 320, height: 700 });
    const phone = await page.evaluate(() => {
      const right = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? element.getBoundingClientRect().right : 0;
      };
      const title = document.querySelector('.scenarioMain');
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: right('.runHead h1'),
        health: right('.health'),
        titleWidth: title ? title.getBoundingClientRect().width : 0,
      };
    });

    expect(phone.overflow).toBeLessThanOrEqual(1);
    expect(phone.h1).toBeLessThanOrEqual(320);
    expect(phone.health).toBeLessThanOrEqual(320);
    expect(phone.titleWidth).toBeGreaterThan(100);

    await page.locator('.shotButton').first().click();
    await expect(page.locator('#tolkira-lightbox img')).toBeVisible();
    const imageBounds = await page.evaluate(() => {
      const image = document.querySelector('#tolkira-lightbox img');
      const dialog = document.getElementById('tolkira-lightbox');
      if (!image || !dialog) return null;
      const imageRect = image.getBoundingClientRect();
      const dialogRect = dialog.getBoundingClientRect();
      return {
        left: imageRect.left,
        right: imageRect.right,
        dialogLeft: dialogRect.left,
        dialogRight: dialogRect.right,
      };
    });
    expect(imageBounds).not.toBeNull();
    expect(imageBounds!.left).toBeGreaterThanOrEqual(
      imageBounds!.dialogLeft - 0.5,
    );
    expect(imageBounds!.right).toBeLessThanOrEqual(
      imageBounds!.dialogRight + 0.5,
    );
    expect(imageBounds!.right).toBeLessThanOrEqual(320);
    await page.keyboard.press('Escape');
    await expect(page.locator('#tolkira-lightbox')).toBeHidden();

    await page.getByRole('tab', { name: 'Details' }).click();
    expect(
      await page
        .locator('#analysis-view')
        .evaluate((element) => element.getBoundingClientRect().right),
    ).toBeLessThanOrEqual(320);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const tableWrap = page.locator('#analysis-view .tableWrap');
    await expect(tableWrap).toHaveAttribute('tabindex', '0');
    expect(
      await tableWrap.evaluate((element) => element.scrollWidth > element.clientWidth),
    ).toBe(true);
    await tableWrap.focus();
    await expect(tableWrap).toBeFocused();
    await expect(page.locator('#analysis-view pre.json')).toHaveAttribute(
      'tabindex',
      '0',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function writeUnhappyReport(): Promise<{ dir: string; output: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-e2e-'));
  const output = path.join(dir, 'triage-report.html');
  const code = await runCli(
    [unhappyFixture, '--out', output, '--title', 'Triage E2E'],
    { stdout: () => undefined, stderr: () => undefined },
  );
  expect(code).toBe(0);
  return { dir, output };
}

test('focuses a scenario from the needs-attention index', async ({ page }) => {
  const { dir, output } = await writeUnhappyReport();

  try {
    await page.goto(pathToFileURL(output).href);
    const triage = page.getByRole('navigation', { name: 'Needs attention' });
    await expect(triage).toBeVisible();
    const openBefore = await page.locator('[data-scenario][open]').count();

    const link = triage.getByRole('link', { name: /steps are skipped/ });
    await link.focus();
    await expect(link).toBeFocused();
    await link.press('Enter');

    const hash = new URL(page.url()).hash;
    expect(hash).toMatch(/^#scenario-\d+-\d+$/);
    const target = page.locator(hash);
    await expect(target).toBeVisible();
    await expect(target).toHaveJSProperty('open', true);
    await expect(page.locator(`${hash} > summary`)).toBeFocused();
    expect(
      await target.evaluate(
        (element) =>
          element.closest<HTMLDetailsElement>('details[data-feature]')?.open,
      ),
    ).toBe(true);
    await expect(page.locator('[data-scenario][open]')).toHaveCount(openBefore);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator(hash)).toHaveJSProperty('open', true);

    await page.getByRole('button', { name: /^Passed/ }).click();
    await expect(triage).toBeHidden();
    await page.getByRole('button', { name: /^Passed/ }).click();
    await expect(triage).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Search scenarios' });
    await search.fill('Fred');
    await expect(triage).toBeHidden();
    await search.fill('');
    await expect(triage).toBeVisible();

    const tag = page.locator('select[data-tag-filter]');
    await tag.selectOption({ index: 1 });
    await expect(triage).toBeHidden();
    await tag.selectOption('');
    await expect(triage).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shows a source strip for multiple input files', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-e2e-'));
  const output = path.join(dir, 'sources-report.html');

  try {
    const code = await runCli(
      [unhappyFixture, tableFixture, '--out', output, '--title', 'Sources E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const sources = page.getByRole('region', { name: 'Sources' });
    await expect(sources).toBeVisible();
    await expect(sources.getByText('unhappy.json', { exact: true })).toBeVisible();
    await expect(sources.getByText('happy.json', { exact: true })).toBeVisible();
    expect(await sources.innerText()).not.toContain(
      path.dirname(unhappyFixture),
    );

    await page.getByRole('button', { name: /^Passed/ }).click();
    await expect(sources).toBeHidden();
    await page.getByRole('button', { name: /^Passed/ }).click();
    await expect(sources).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Search scenarios' });
    await search.fill('Fred');
    await expect(sources).toBeHidden();
    await search.fill('');
    await expect(sources).toBeVisible();

    const tag = page.locator('select[data-tag-filter]');
    await tag.selectOption({ index: 1 });
    await expect(sources).toBeHidden();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('survives a malformed URL hash', async ({ page }) => {
  const { dir, output } = await writeUnhappyReport();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(`${pathToFileURL(output).href}#%E0%A4%A`);
    await expect(page.locator('#report-view')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('caps search auto-open at 20 scenarios', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-search-cap-'));
  const input = path.join(dir, 'many.json');
  const output = path.join(dir, 'many.html');

  try {
    const elements = Array.from({ length: 30 }, (_, index) => ({
      keyword: 'Scenario',
      type: 'scenario',
      name: `Scenario ${index + 1}`,
      steps: [
        {
          keyword: 'Given ',
          name: 'a step',
          result: { status: 'passed', duration: 1 },
        },
      ],
    }));
    await writeFile(
      input,
      JSON.stringify([{ name: 'Many scenarios', elements }]),
      'utf8',
    );
    const code = await runCli([input, '--out', output], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const search = page.getByRole('searchbox', { name: 'Search scenarios' });
    await search.fill('Scenario');
    await expect(page.locator('[data-scenario][open]')).toHaveCount(20);
    await expect(page.locator('#tolkira-search-note')).toContainText(
      '20 of 30 matches expanded',
    );
    await search.fill('');
    await expect(page.locator('[data-scenario][open]')).toHaveCount(0);
    await expect(page.locator('#tolkira-search-note')).toBeHidden();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('groups outlines and keeps triage, search and tag filters usable', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-outline-e2e-'));
  const output = path.join(dir, 'outlines.html');

  try {
    const code = await runCli(
      [examplesFixture, '--out', output, '--title', 'Outlines'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(page.locator('section.outline')).toHaveCount(2);
    await expect(page.locator('section.examples')).toHaveCount(3);
    await expect(page.locator('.exampleNo')).toHaveCount(7);
    await expect(
      page.locator('.triageScenario').filter({ hasText: 'These are failing #2.1' }),
    ).toBeVisible();

    await page
      .locator('.triageScenario')
      .filter({ hasText: 'These are failing #2.1' })
      .click();
    const failed = page.locator('[data-scenario][data-example="#2.1"]');
    await expect(failed).toHaveAttribute('open', '');
    await expect(failed.locator('summary')).toBeFocused();

    await expect(
      page.locator('[data-example="#1.1"][data-scenario-name="Eating cucumbers"]'),
    ).not.toHaveAttribute('open', '');
    await expect(
      page.locator('[data-example="#2.1"][data-scenario-name="Eating cucumbers"]'),
    ).toHaveAttribute('open', '');

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Eating cucumbers with <friends> friends');
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(3);

    await search.fill('These are failing');
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);

    await search.fill('');
    const tagFilter = page.locator('select[data-tag-filter]');
    await tagFilter.selectOption('@passing');
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);

    await tagFilter.selectOption('@failing');
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);
    await expect(
      page.locator('details.scenario:visible .exampleNo').first(),
    ).toHaveText('#2.1');

    await tagFilter.selectOption('');
    await expect(page.locator('details.scenario:visible')).toHaveCount(7);
    await expect(
      page.locator('details.scenario:visible .exampleNo').first(),
    ).toHaveText('#1.1');

    const failedFilter = page.locator('button.filter[data-filter-status="failed"]');
    await failedFilter.click();
    await expect(page.locator('details.scenario:visible')).toHaveCount(5);
    await expect(page.locator('section.outline:visible')).toHaveCount(2);
    await expect(page.locator('section.examples:visible')).toHaveCount(2);
    await failedFilter.click();

    const passedFilter = page.locator('button.filter[data-filter-status="passed"]');
    await passedFilter.click();
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await passedFilter.click();
    await expect(page.locator('details.scenario:visible')).toHaveCount(7);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('copies a grouped failure with example context', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-outline-copy-e2e-'));
  const output = path.join(dir, 'outlines-copy.html');

  try {
    await page.addInitScript(() => {
      (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied =
              text;
            return Promise.resolve();
          },
        },
      });
    });

    const code = await runCli(
      [examplesFixture, '--out', output, '--title', 'Outlines copy'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const row = page.locator('[data-scenario][data-example="#2.1"]');
    await row.locator('[data-copy-failure]').click();
    const copied = await page.evaluate(
      () =>
        (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ?? '',
    );

    expect(copied).toContain('Scenario: Eating cucumbers');
    expect(copied).toContain('Example: #2.1 (These are failing)');
    expect(copied).toContain('URI:');
    expect(copied).toContain('Step:');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('does not duplicate a retried outline row', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-outline-retry-e2e-'));
  const input = path.join(dir, 'outline-retry.ndjson');
  const output = path.join(dir, 'outline-retry.html');

  try {
    const lines = (await readFile(examplesFixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    const pickle = lines.find((line) => line.pickle?.astNodeIds?.length === 2)
      ?.pickle;
    const testCase = lines.find(
      (line) => line.testCase?.pickleId === pickle?.id,
    )?.testCase;
    const started = lines.find(
      (line) => line.testCaseStarted?.testCaseId === testCase?.id,
    )?.testCaseStarted;
    const finished = lines.find(
      (line) => line.testCaseFinished?.testCaseStartedId === started?.id,
    )?.testCaseFinished;
    const stepFinished = lines.find(
      (line) => line.testStepFinished?.testCaseStartedId === started?.id,
    )?.testStepFinished;
    expect(pickle && started && finished && stepFinished).toBeTruthy();
    const retryId = `${started.id}-retry`;
    lines.push(
      {
        testCaseStarted: {
          ...started,
          id: retryId,
          attempt: 1,
          timestamp: { seconds: 10, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          ...stepFinished,
          testCaseStartedId: retryId,
          timestamp: { seconds: 10, nanos: 0 },
          testStepResult: {
            ...stepFinished.testStepResult,
            status: 'FAILED',
          },
        },
      },
      {
        testCaseFinished: {
          ...finished,
          testCaseStartedId: retryId,
          timestamp: { seconds: 10, nanos: 0 },
        },
      },
    );
    await writeFile(
      input,
      `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'utf8',
    );

    const code = await runCli([input, '--out', output, '--title', 'Retry'], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const retried = page.locator(
      '[data-example="#1.1"][data-scenario-name="Eating cucumbers"]',
    );
    await expect(retried).toHaveCount(1);
    await expect(retried).toHaveAttribute('data-status', 'failed');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('caps grouped outline search at 20 rows', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-outline-cap-e2e-'));
  const input = path.join(dir, 'many-outlines.ndjson');
  const output = path.join(dir, 'many-outlines.html');

  try {
    await writeFile(input, outlineNdjson(30), 'utf8');
    const code = await runCli([input, '--out', output, '--title', 'Many outlines'], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Stress outline');
    await expect(page.locator('details.scenario[open]')).toHaveCount(20);
    await expect(page.locator('#tolkira-search-note')).toContainText(
      '20 of 30 matches expanded',
    );
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);

    await search.fill('Outline description line.');
    await expect(page.locator('details.scenario[open]')).toHaveCount(20);
    await search.fill('Examples description line.');
    await expect(page.locator('details.scenario[open]')).toHaveCount(20);

    await search.fill('');
    await expect(page.locator('details.scenario[open]')).toHaveCount(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps each example attachment on its own row', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-outline-attach-e2e-'));
  const output = path.join(dir, 'outlines-attach.html');

  try {
    const code = await runCli(
      [examplesAttachmentFixture, '--out', output, '--title', 'Outlines attach'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const rows = page.locator('details.scenario');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.thumb')).toBeVisible();
    await expect(rows.nth(1).locator('.thumb')).toBeVisible();
    await expect(rows.nth(0).locator('.shot')).toHaveCount(1);
    await expect(rows.nth(1).locator('.shot')).toHaveCount(1);
    await expect(rows.nth(0).locator('.rowRight')).toContainText('1 attachment');
    await expect(rows.nth(1).locator('.rowRight')).toContainText('1 attachment');

    await rows.nth(0).locator('summary').click();
    await rows.nth(0).locator('.shotButton').click();
    await expect(page.locator('#tolkira-lightbox')).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shows per-scenario hooks separately and opens passed hooks', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-hooks-e2e-'));
  const output = path.join(dir, 'hooks.html');

  try {
    const code = await runCli([hooksFixture, '--out', output, '--title', 'Hooks'], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const group = page.locator('details.hookGroup').first();
    await expect(group).toBeVisible();
    await expect(group.locator('summary')).toContainText('hook');
    await group.locator('summary').click();
    await expect(group.locator('.hook').first()).toBeVisible();
    await expect(page.locator('.scenarioSub').first()).toContainText('hook');
    await expect(page.locator('[data-run-hooks]')).toHaveCount(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shows test-run hooks below the features', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-run-hooks-e2e-'));
  const output = path.join(dir, 'run-hooks.html');

  try {
    const code = await runCli(
      [globalHooksFixture, '--out', output, '--title', 'Run hooks'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const section = page.locator('[data-run-hooks]');
    await expect(section).toBeVisible();
    await expect(section).toContainText('BeforeAll');
    await expect(section).toContainText('AfterAll');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shows a failed run-hook error', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-run-hook-fail-e2e-'));
  const input = path.join(dir, 'failed-run-hook.ndjson');
  const output = path.join(dir, 'failed-run-hook.html');

  try {
    const lines = (await readFile(globalHooksFixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    const finished = lines.find((line) => line.testRunHookFinished)
      ?.testRunHookFinished;
    expect(finished).toBeTruthy();
    if (!finished) return;
    finished.result.status = 'FAILED';
    finished.result.message = 'run hook boom';
    await writeFile(
      input,
      `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'utf8',
    );

    const code = await runCli(
      [input, '--out', output, '--title', 'Failed run hook'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(page.locator('[data-run-hooks]')).toContainText('run hook boom');
    await expect(
      page.locator('[data-run-hooks] .hook[data-status="failed"]'),
    ).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shows run-hook attachments in the Hooks section', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-run-hook-attach-e2e-'));
  const output = path.join(dir, 'run-hook-attach.html');

  try {
    const code = await runCli(
      [globalHookAttachments, '--out', output, '--title', 'Run hook attachments'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(page.locator('[data-run-hooks]')).toContainText(
      'Attachment from BeforeAll hook',
    );
    await expect(page.locator('[data-run-hooks]')).toContainText(
      'Attachment from AfterAll hook',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('searching a hook name opens its hook group', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-hook-search-e2e-'));
  const input = path.join(dir, 'named-hooks.ndjson');
  const output = path.join(dir, 'named-hooks.html');

  try {
    const lines = (await readFile(hooksFixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    const hook = lines.find((line) => line.hook)?.hook;
    expect(hook).toBeTruthy();
    hook.name = 'seed database';
    await writeFile(
      input,
      `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'utf8',
    );

    const code = await runCli([input, '--out', output, '--title', 'Hook search'], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await page.getByRole('searchbox', { name: /Search/ }).fill('seed database');
    const group = page.locator('details.hookGroup[open]').first();
    await expect(group).toBeVisible();
    await expect(group.locator('.hookLabel').first()).toContainText(
      'Before: seed database',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shows a failed hook inline', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied =
            text;
          return Promise.resolve();
        },
      },
    });
  });
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-hook-fail-e2e-'));
  const input = path.join(dir, 'failed-hook.ndjson');
  const output = path.join(dir, 'failed-hook.html');

  try {
    const lines = (await readFile(hooksFixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    const hookStepIds = new Set<string>(
      lines.flatMap((line) =>
        (line.testCase?.testSteps ?? [])
          .filter((step: { hookId?: string }) => step.hookId)
          .map((step: { id: string }) => step.id),
      ),
    );
    for (const line of lines) {
      if (
        line.testStepFinished &&
        hookStepIds.has(line.testStepFinished.testStepId)
      ) {
        line.testStepFinished.testStepResult.status = 'FAILED';
        line.testStepFinished.testStepResult.message = 'hook boom';
      }
    }
    await writeFile(
      input,
      `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'utf8',
    );

    const code = await runCli([input, '--out', output, '--title', 'Hook failure'], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const failed = page.locator('.hook[data-status="failed"]').first();
    await expect(failed).toBeVisible();
    await expect(failed).toContainText('hook boom');
    const copy = page.locator('[data-copy-failure]').first();
    await expect(copy).toBeVisible();
    await copy.click();
    const copied = await page.evaluate(
      () =>
        (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ?? '',
    );
    expect(copied).toContain('Hook: Before');
    expect(copied).toContain('hook boom');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('operates the hooks disclosure by keyboard', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-hook-keyboard-e2e-'));
  const output = path.join(dir, 'hooks-keyboard.html');

  try {
    const code = await runCli([hooksFixture, '--out', output, '--title', 'Hook keyboard'], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const group = page.locator('details.hookGroup').first();
    await group.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(group).toHaveAttribute('open', '');
    await expect(group.locator('.hook').first()).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shows undefined-step snippets and finds them by search', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-undefined-e2e-'));
  const output = path.join(dir, 'undefined.html');

  try {
    const code = await runCli(
      [undefinedFixture, '--out', output, '--title', 'Undefined E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const feature = page.locator('details.feature').first();
    await expect(feature).toHaveAttribute('open', '');
    const scenario = page.locator(
      '[data-scenario-name="Snippets reflect parameter types"]',
    );
    await expect(scenario).toHaveAttribute('open', '');
    await expect(scenario.locator('.diagnosticLead')).toHaveText(
      'No step definition found. Implement with the snippet(s) below:',
    );
    await expect(scenario.locator('.snippet')).toHaveCount(2);
    await expect(scenario.locator('.snippetLang').first()).toHaveText(
      'typescript',
    );
    await expect(scenario.locator('.snippet').first()).toContainText(
      'Given("a list of {int} things"',
    );

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('{int}');
    await expect(scenario).toBeVisible();
    await expect(scenario).toHaveAttribute('open', '');

    await search.fill('No step definition found.');
    await expect(page.locator('details.scenario:visible')).toHaveCount(4);
    await expect(scenario).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shows ambiguous definitions with relative sources', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-ambiguous-e2e-'));
  const output = path.join(dir, 'ambiguous.html');

  try {
    const code = await runCli(
      [ambiguousFixture, '--out', output, '--title', 'Ambiguous E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const scenario = page.locator(
      '[data-scenario-name="Multiple step definitions for a step"]',
    );
    await expect(scenario).toHaveAttribute('open', '');
    await expect(scenario.locator('.diagnosticLead')).toHaveText(
      'Multiple matching step definitions found:',
    );
    await expect(scenario.locator('.definitionPattern')).toHaveCount(2);
    await expect(scenario.locator('.definitionPattern').first()).toHaveText(
      '^a (.*?) with (.*?)$',
    );
    await expect(scenario.locator('.definitionSource').first()).toHaveText(
      'samples/ambiguous/ambiguous.ts:3',
    );
    await expect(scenario.locator('.definitionSource').nth(1)).toHaveText(
      'samples/ambiguous/ambiguous.ts:7',
    );

    await page
      .getByRole('searchbox', { name: /Search/ })
      .fill('Multiple matching step definitions found:');
    await expect(page.locator('details.scenario:visible')).toHaveCount(1);
    await expect(scenario).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('does not execute markup in snippets, patterns or sources', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-diagnostic-xss-'));
  let dialogOpened = false;
  page.on('dialog', async (dialog) => {
    dialogOpened = true;
    await dialog.dismiss();
  });

  try {
    const undefinedLines = (await readFile(undefinedFixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    for (const line of undefinedLines) {
      if (line.suggestion) {
        line.suggestion.snippets[0].code =
          '<script>window.__tolkiraXss=1</script>';
      }
    }
    const undefinedInput = path.join(dir, 'undefined-xss.ndjson');
    const undefinedOutput = path.join(dir, 'undefined-xss.html');
    await writeFile(
      undefinedInput,
      `${undefinedLines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'utf8',
    );
    const undefinedCode = await runCli(
      [undefinedInput, '--out', undefinedOutput],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(undefinedCode).toBe(0);

    await page.goto(pathToFileURL(undefinedOutput).href);
    await expect(page.locator('.snippet').first()).toContainText(
      '<script>window.__tolkiraXss=1</script>',
    );
    expect(await page.locator('.diagnostic script').count()).toBe(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
      ),
    ).toBeUndefined();

    const ambiguousLines = (await readFile(ambiguousFixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    for (const line of ambiguousLines) {
      if (line.stepDefinition) {
        line.stepDefinition.pattern.source =
          '<img src=x onerror="window.__tolkiraXss=1">';
        line.stepDefinition.sourceReference.uri =
          '"><svg onload="window.__tolkiraXss=1">';
      }
    }
    const ambiguousInput = path.join(dir, 'ambiguous-xss.ndjson');
    const ambiguousOutput = path.join(dir, 'ambiguous-xss.html');
    await writeFile(
      ambiguousInput,
      `${ambiguousLines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'utf8',
    );
    const ambiguousCode = await runCli(
      [ambiguousInput, '--out', ambiguousOutput],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(ambiguousCode).toBe(0);

    await page.goto(pathToFileURL(ambiguousOutput).href);
    await expect(page.locator('.definitionPattern').first()).toContainText(
      '<img src=x onerror="window.__tolkiraXss=1">',
    );
    await expect(page.locator('.definitionSource').first()).toContainText(
      '"><svg onload="window.__tolkiraXss=1">',
    );
    expect(await page.locator('.diagnostic img').count()).toBe(0);
    expect(await page.locator('.diagnostic svg').count()).toBe(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
      ),
    ).toBeUndefined();
    expect(dialogOpened).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('caps search auto-open at 20 newly opened rows', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-search-cap-new-'));
  const input = path.join(dir, 'mixed.json');
  const output = path.join(dir, 'mixed.html');

  try {
    const elements = Array.from({ length: 30 }, (_, index) => ({
      keyword: 'Scenario',
      type: 'scenario',
      name: `Scenario ${index + 1}`,
      steps: [
        {
          keyword: 'Given ',
          name: 'a step',
          result: {
            status: index < 5 ? 'failed' : 'passed',
            duration: 1,
          },
        },
      ],
    }));
    await writeFile(
      input,
      JSON.stringify([{ name: 'Mixed scenarios', elements }]),
      'utf8',
    );
    const code = await runCli([input, '--out', output], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(page.locator('[data-scenario][open]')).toHaveCount(5);
    await page.getByRole('searchbox', { name: 'Search scenarios' }).fill(
      'Scenario',
    );
    await expect(page.locator('[data-scenario][open]')).toHaveCount(25);
    await expect(page.locator('[data-scenario]:not([open])')).toHaveCount(5);
    await expect(page.locator('#tolkira-search-note')).toHaveText(
      '20 of 30 matches expanded. Use Expand all to open the rest.',
    );
    await page.getByRole('searchbox', { name: 'Search scenarios' }).fill('');
    await expect(page.locator('[data-scenario][open]')).toHaveCount(5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loads and searches a 1,000-row non-passed report within budget', async ({
  page,
}) => {
  test.slow();
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-non-passed-e2e-'));
  const input = path.join(dir, 'non-passed.ndjson');
  const output = path.join(dir, 'non-passed.html');

  try {
    await writeFile(input, nonPassedNdjson(1000), 'utf8');
    const code = await runCli(
      [input, '--out', output, '--title', 'Stress non-passed'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    const loadStarted = Date.now();
    await page.goto(pathToFileURL(output).href);
    await expect(page.locator('details.scenario[open]')).toHaveCount(1000);
    expect(Date.now() - loadStarted).toBeLessThan(10_000);

    const searchStarted = Date.now();
    await page
      .getByRole('searchbox', { name: 'Search scenarios' })
      .fill('Non-passed scenario 1000');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 1000 scenarios visible',
    );
    expect(Date.now() - searchStarted).toBeLessThan(10_000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('renders rules, backgrounds and outlines together', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-rules-e2e-'));
  const output = path.join(dir, 'rules.html');

  try {
    const code = await runCli(
      [rulesOutlineBackgroundFixture, '--out', output, '--title', 'Rules E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const rule = page.locator('section.rule[data-rule]');
    await expect(rule).toHaveCount(1);
    await expect(
      rule.getByRole('heading', { name: /Outline rule/, level: 3 }),
    ).toBeVisible();
    await expect(rule.locator('.ruleTags')).toContainText('@rule-outline');
    await expect(
      page.getByRole('heading', { name: /Feature setup/, level: 3 }),
    ).toBeVisible();
    await expect(page.getByText('Feature background description.')).toBeVisible();
    await expect(
      rule.getByRole('heading', { name: /Rule setup/, level: 3 }),
    ).toBeVisible();
    await expect(rule.getByText('Rule background description.')).toBeVisible();
    await expect(rule.locator('section.outline')).toHaveCount(1);
    await expect(rule.locator('section.outline .outlineTitle')).toContainText(
      'Eating cucumbers',
    );
    await expect(rule.locator('section.examples')).toHaveCount(2);
    await expect(page.locator('section.outline')).toHaveCount(2);
    await expect(page.locator('.exampleNo')).toHaveCount(7);

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Rule setup');
    await expect(rule).toBeVisible();
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(4);

    await search.fill('Feature setup');
    await expect(page.locator('section.outline:visible')).toHaveCount(2);
    await expect(page.locator('details.scenario:visible')).toHaveCount(7);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('filters rules by search, status and tag', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-rule-filter-e2e-'));
  const input = await writeFailedTagsFixture(dir);
  const output = path.join(dir, 'rules-filter.html');

  try {
    const code = await runCli(
      [input, '--out', output, '--title', 'Rule filters'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const ruleOne = page
      .locator('section.rule')
      .filter({ hasText: 'tagged rule' });
    const ruleTwo = page
      .locator('section.rule')
      .filter({ hasText: 'no stock' });
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeVisible();

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('tagged rule');
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeHidden();
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);

    await search.fill('@some-tag');
    await expect(ruleTwo).toBeVisible();
    await expect(ruleOne).toBeHidden();
    await expect(page.locator('details.scenario:visible')).toHaveCount(1);

    await search.fill('');
    const tagFilter = page.locator('select[data-tag-filter]');
    await tagFilter.selectOption('@rule-tag');
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeHidden();

    await tagFilter.selectOption('@some-tag');
    await expect(ruleTwo).toBeVisible();
    await expect(ruleOne).toBeHidden();
    await expect(page.locator('section.rule:visible')).toHaveCount(1);

    await tagFilter.selectOption('');
    const passedFilter = page.locator('button.filter[data-filter-status="passed"]');
    await passedFilter.click();
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeHidden();
    await expect(page.locator('details.scenario:visible')).toHaveCount(1);
    await expect(page.locator('[data-scenario-name="tagged scenario"]')).toBeVisible();

    await passedFilter.click();
    await expect(page.locator('details.scenario:visible')).toHaveCount(3);
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('renders an empty run without outcomes or triage', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-e2e-'));
  const output = path.join(dir, 'empty.html');

  try {
    const code = await runCli(
      [emptyFixture, '--out', output, '--title', 'Empty run'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(
      page.getByRole('heading', { name: 'Empty Scenarios' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .getByText('0 / 0', { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .locator('.healthTop')
        .getByText('0 of 0 passed'),
    ).toHaveCount(0);
    await expect(
      page.getByRole('tabpanel', { name: 'Report' }).locator('.healthTop .sr'),
    ).toHaveText('0 / 0 passed');
    await expect(
      page.getByRole('tabpanel', { name: 'Report' }).getByText('0 executed scenarios'),
    ).toBeVisible();
    await expect(page.locator('details.feature')).toHaveAttribute('open', '');
    await expect(
      page.getByRole('navigation', { name: 'Needs attention' }),
    ).toHaveCount(0);
    await expect(page.locator('button.filter')).toHaveCount(0);

    const row = page.locator('[data-scenario-name="Blank Scenario"]');
    await expect(row).toBeVisible();
    expect(await row.getAttribute('data-status')).toBeNull();
    await expect(row).not.toHaveAttribute('open', '');
    await expect(row.locator('.statusText')).toHaveCount(0);
    await expect(row.locator('.statusCell .sr')).toHaveText('Not executed');
    await expect(row).not.toContainText('Unknown');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps a blank row searchable in a mixed run', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-mixed-e2e-'));
  const output = path.join(dir, 'empty-mixed.html');

  try {
    const code = await runCli(
      [emptyMixedFixture, '--out', output, '--title', 'Mixed run'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .getByText('1 / 1', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('tabpanel', { name: 'Report' }).getByText('1 executed scenario'),
    ).toBeVisible();
    const feature = page.locator('details.feature');
    await expect(feature).not.toHaveAttribute('open', '');
    await expect(
      page.getByRole('navigation', { name: 'Needs attention' }),
    ).toHaveCount(0);

    const blank = page.locator('[data-scenario-name="Blank started scenario"]');
    const passed = page.locator('[data-scenario-name="Passed scenario"]');
    await expect(blank).toBeHidden();
    await expect(passed).toBeHidden();
    await page.locator('details.feature > summary').click();
    await expect(blank).toBeVisible();
    await expect(blank).not.toHaveAttribute('open', '');
    expect(await blank.getAttribute('data-status')).toBeNull();
    await expect(blank.locator('.statusText')).toHaveCount(0);
    await expect(blank.locator('.statusCell .sr')).toHaveText('Not executed');

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Blank started');
    await expect(blank).toBeVisible();
    await expect(blank).toHaveAttribute('open', '');
    await expect(passed).toBeHidden();
    await expect(blank.locator('.statusText')).toHaveCount(0);

    await search.fill('Passed scenario');
    await expect(blank).toBeHidden();
    await expect(passed).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('counts only executed scenarios in a mixed-status run', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-statuses-e2e-'));
  const output = path.join(dir, 'empty-statuses.html');

  try {
    const code = await runCli(
      [emptyStatusesFixture, '--out', output, '--title', 'Mixed statuses'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const report = page.getByRole('tabpanel', { name: 'Report' });
    await expect(
      report.getByText('1 / 2', { exact: true }),
    ).toBeVisible();
    await expect(report.getByText('50%', { exact: true })).toBeVisible();
    await expect(report.getByText('2 executed scenarios')).toBeVisible();
    await expect(page.getByText('1 of 2 passed · 1 failed')).toBeVisible();
    await expect(page.locator('button.filter[data-filter-status="unknown"]')).toHaveCount(
      0,
    );

    const triage = page.getByRole('navigation', { name: 'Needs attention' });
    await expect(triage).toBeVisible();
    await expect(triage).toContainText('1 of 2 scenarios need attention.');
    await expect(triage).toContainText('Failed scenario');
    await expect(triage).not.toContainText('Blank unexecuted scenario');

    const blank = page.locator(
      '[data-scenario-name="Blank unexecuted scenario"]',
    );
    await expect(blank).toBeVisible();
    await expect(blank.locator('.statusText')).toHaveCount(0);
    await expect(blank.locator('.statusCell .sr')).toHaveText('Not executed');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('renders the empty state when there are no scenarios', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-none-e2e-'));
  const output = path.join(dir, 'empty-none.html');

  try {
    const code = await runCli(
      [emptyNoneFixture, '--out', output, '--title', 'No scenarios'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .getByText('0 / 0', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('No scenarios in this report.')).toBeVisible();
    await expect(
      page.getByRole('tabpanel', { name: 'Report' }).getByText('0 executed scenarios'),
    ).toBeVisible();
    await expect(page.locator('details.feature')).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: 'Needs attention' }),
    ).toHaveCount(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test.describe('without scripting', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps an empty run readable', async ({ page }) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-empty-nojs-e2e-'));
    const output = path.join(dir, 'empty-nojs.html');

    try {
      const code = await runCli(
        [emptyFixture, '--out', output, '--title', 'Empty no JS'],
        { stdout: () => undefined, stderr: () => undefined },
      );
      expect(code).toBe(0);
      await page.goto(pathToFileURL(output).href);

      await expect(
        page
          .getByRole('tabpanel', { name: 'Report' })
          .getByText('0 / 0', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Empty Scenarios' }),
      ).toBeVisible();
      await expect(page.locator('details.feature')).toHaveAttribute('open', '');
      const row = page.locator('[data-scenario-name="Blank Scenario"]');
      await expect(row).toBeVisible();
      await expect(row.locator('.statusText')).toHaveCount(0);
      await expect(row.locator('.statusCell .sr')).toHaveText('Not executed');
      await expect(
        page.getByRole('navigation', { name: 'Needs attention' }),
      ).toHaveCount(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('keeps hook disclosures readable', async ({ page }) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-hook-nojs-e2e-'));
    const output = path.join(dir, 'hooks-nojs.html');

    try {
      const code = await runCli(
        [hooksFixture, '--out', output, '--title', 'Hooks no JS'],
        { stdout: () => undefined, stderr: () => undefined },
      );
      expect(code).toBe(0);
      await page.goto(pathToFileURL(output).href);
      const group = page.locator('details.hookGroup').first();
      await expect(group).toBeVisible();
      await group.locator('summary').click();
      await expect(group.locator('.hook').first()).toBeVisible();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('keeps the triage links readable', async ({ page }) => {
    const { dir, output } = await writeUnhappyReport();

    try {
      await page.goto(pathToFileURL(output).href);
      const triage = page.getByRole('navigation', { name: 'Needs attention' });
      await expect(triage).toBeVisible();
      const link = triage.getByRole('link', { name: /steps are skipped/ });
      await expect(link).toHaveAttribute('href', /^#scenario-\d+-\d+$/);
      const href = await link.getAttribute('href');
      await expect(page.locator(href!)).toHaveCount(1);
      await expect(page.locator('#feature-1')).toBeVisible();
      await expect(page.locator('#report-view')).toBeVisible();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('keeps rule and background headings visible', async ({ page }) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-rule-nojs-e2e-'));
    const output = path.join(dir, 'rules-nojs.html');
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    try {
      const code = await runCli(
        [rulesOutlineBackgroundFixture, '--out', output, '--title', 'Rules no JS'],
        { stdout: () => undefined, stderr: () => undefined },
      );
      expect(code).toBe(0);

      await page.goto(pathToFileURL(output).href);
      await expect(page.locator('section.rule[data-rule]')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Outline rule/, level: 3 }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Feature setup/, level: 3 }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Rule setup/, level: 3 }),
      ).toBeVisible();
      await expect(page.locator('section.outline').first()).toBeVisible();
      expect(
        requests.every(
          (url) => url.startsWith('file:') || url.startsWith('data:'),
        ),
      ).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
