import { expect, test, type Locator, type Page } from '@playwright/test';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';
import { legacyFixture, messagesFixture } from '../fixtures.js';

const fixtures = ['failed.json', 'minimal.json', 'behave.json'].map((name) =>
  legacyFixture(name),
);
const unhappy = legacyFixture('unhappy.json');
const outlineFixture = messagesFixture('examples-tables.ndjson');
const allStatusesFixture = messagesFixture('all-statuses.ndjson');
const rulesOutlineBackgroundFixture = messagesFixture(
  'rules-outline-background.ndjson',
);
const ciFullFixture = messagesFixture('ci-full.ndjson');
const presentationFixture = messagesFixture('attachments-presentation.ndjson');

const viewports = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
];

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

async function expectWithinViewport(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  await expect(locator, label).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} has a box`).not.toBeNull();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(box!.x, `${label} left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width, `${label} right edge`).toBeLessThanOrEqual(
    viewportWidth + 1,
  );
}

test('stays usable across viewports', async ({ page }) => {
  test.setTimeout(60_000);
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-responsive-'));
  const output = path.join(dir, 'responsive.html');
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    const code = await runCli(
      [...fixtures, '--out', output, '--title', 'Responsive review'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);
    const url = pathToFileURL(output).href;

    for (const viewport of viewports) {
      const label = `${viewport.width}x${viewport.height}`;
      errors.length = 0;
      await page.setViewportSize(viewport);
      await page.goto(url);

      expect(await pageOverflow(page), `${label} overflow`).toBeLessThanOrEqual(
        1,
      );
      await expectWithinViewport(
        page,
        page.getByRole('heading', { name: 'Responsive review', level: 1 }),
        `${label} h1`,
      );
      await expectWithinViewport(
        page,
        page.getByRole('tab', { name: 'Report' }),
        `${label} Report tab`,
      );
      await expectWithinViewport(
        page,
        page.getByRole('tab', { name: 'Details' }),
        `${label} Details tab`,
      );
      await expectWithinViewport(
        page,
        page.locator('#report-view .health'),
        `${label} health block`,
      );
      await expectWithinViewport(
        page,
        page.locator('[data-triage]'),
        `${label} triage index`,
      );
      const triageOpen = await page
        .locator('[data-triage]')
        .evaluate((element) => (element as HTMLDetailsElement).open);
      expect(triageOpen, `${label} triage open`).toBe(viewport.width > 560);
      if (viewport.width <= 560) {
        await expect(page.locator('.triageSummary')).toBeVisible();
        await expect(page.locator('[data-sources]')).toBeHidden();
      } else {
        await expect(page.locator('[data-sources]')).toBeVisible();
      }
      await expectWithinViewport(
        page,
        page.getByRole('searchbox', { name: 'Search scenarios' }),
        `${label} search`,
      );
      await expectWithinViewport(
        page,
        page.locator('select[data-tag-filter]'),
        `${label} tag filter`,
      );
      await expect(
        page.locator('details.feature[open] h2').first(),
        `${label} open feature heading`,
      ).toBeVisible();
      await expect(
        page.locator('details.scenario[open] .scenarioName').first(),
        `${label} open scenario heading`,
      ).toBeVisible();
      expect(errors, `${label} console errors`).toEqual([]);
    }

    errors.length = 0;
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(url);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });

    expect(await pageOverflow(page), '320x700 at 200% text').toBeLessThanOrEqual(
      1,
    );
    await expectWithinViewport(
      page,
      page.locator('[data-triage]'),
      '320x700 at 200% triage index',
    );
    const triageName = page
      .locator('.triageScenarios a span:last-child')
      .first();
    await page.locator('[data-triage]').evaluate((element) => {
      (element as HTMLDetailsElement).open = true;
    });
    const triageNameBox = await triageName.boundingBox();
    expect(triageNameBox, 'zoomed triage name has a box').not.toBeNull();
    expect(
      triageNameBox!.width,
      'zoomed triage name width',
    ).toBeGreaterThan(96);
    const scenarioTitle = page.locator('.scenarioName').first();
    await expect(scenarioTitle, 'zoomed scenario title').toBeVisible();
    const titleBox = await scenarioTitle.boundingBox();
    expect(titleBox, 'zoomed scenario title has a box').not.toBeNull();
    expect(titleBox!.width, 'zoomed scenario title width').toBeGreaterThan(100);
    expect(errors, '320x700 at 200% text console errors').toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps long unbroken text inside 320px', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-long-text-'));
  const input = path.join(dir, 'long-text.json');
  const output = path.join(dir, 'long-text.html');
  const long = 'x'.repeat(120);

  try {
    await writeFile(
      input,
      JSON.stringify([
        {
          name: `Feature ${long}`,
          description: long,
          elements: [
            {
              keyword: 'Scenario',
              type: 'scenario',
              name: `Scenario ${long}`,
              steps: [
                {
                  keyword: 'Given ',
                  name: long,
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        },
      ]),
      'utf8',
    );
    const code = await runCli(
      [input, '--out', output, '--title', `Long ${long}`],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(pathToFileURL(output).href);
    expect(await pageOverflow(page), 'long text overflow').toBeLessThanOrEqual(
      1,
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      'long text 200% overflow',
    ).toBeLessThanOrEqual(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps a wide Markdown table inside 320px and 200% zoom', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-wide-table-'));
  const input = path.join(dir, 'wide-table.json');
  const output = path.join(dir, 'wide-table.html');
  const headers = Array.from({ length: 20 }, (_, index) => `Column ${index + 1}`);
  const description = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    `| ${headers.map((_, index) => `Value ${index + 1}`).join(' | ')} |`,
  ].join('\n');

  try {
    await writeFile(
      input,
      JSON.stringify([
        {
          name: 'Wide table feature',
          description,
          elements: [
            {
              keyword: 'Scenario',
              type: 'scenario',
              name: 'Wide table scenario',
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a failing step',
                  result: {
                    status: 'failed',
                    duration: 1,
                    error_message: 'expected failure',
                  },
                },
              ],
            },
          ],
        },
      ]),
      'utf8',
    );
    const code = await runCli(
      [input, '--out', output, '--title', 'Wide table'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(pathToFileURL(output).href);
    const table = page.locator('.description .tableWrap').first();
    await expectWithinViewport(page, table, 'wide table at 320');
    expect(
      await table.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
      'wide table scrolls at 320',
    ).toBe(true);
    expect(await pageOverflow(page), 'wide table 320 overflow').toBeLessThanOrEqual(
      1,
    );

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await expectWithinViewport(page, table, 'wide table at 200%');
    expect(
      await table.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
      'wide table scrolls at 200%',
    ).toBe(true);
    expect(
      await pageOverflow(page),
      'wide table 200% overflow',
    ).toBeLessThanOrEqual(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps a long source name inside 320px', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-long-source-'));
  const longName = `report_${'a'.repeat(60)}.json`;
  const longFile = path.join(dir, longName);
  const output = path.join(dir, 'long-source.html');

  try {
    await copyFile(fixtures[0], longFile);
    const code = await runCli(
      [unhappy, longFile, '--out', output, '--title', 'Long source'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(pathToFileURL(output).href);
    expect(await pageOverflow(page), 'long source overflow').toBeLessThanOrEqual(
      1,
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      'long source 200% overflow',
    ).toBeLessThanOrEqual(1);
    const sourceName = page
      .locator('.featureSource')
      .filter({ hasText: 'from report_' });
    await expect(sourceName).toBeVisible();
    await expect(page.locator('[data-sources]')).toBeHidden();
    const box = await sourceName.boundingBox();
    expect(box, 'long source name has a box').not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(320);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps CI metadata, JSON and ANSI logs inside 320px and 200% zoom', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-metadata-responsive-'));
  const output = path.join(dir, 'metadata-responsive.html');

  try {
    const code = await runCli(
      [
        ciFullFixture,
        presentationFixture,
        '--out',
        output,
        '--title',
        'Metadata responsive',
      ],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(pathToFileURL(output).href);
    expect(
      await pageOverflow(page),
      'metadata 320 overflow',
    ).toBeLessThanOrEqual(1);

    const ci = page.locator('#report-view .ci');
    await expectWithinViewport(page, ci, 'CI metadata at 320');
    const payload = page
      .locator('details.attachmentText')
      .filter({ hasText: 'payload.json' });
    const log = page
      .locator('details.attachmentText')
      .filter({ hasText: 'session.log' });
    await payload.locator('summary').click();
    await log.locator('summary').click();
    await expectWithinViewport(page, payload.locator('pre'), 'JSON at 320');
    await expectWithinViewport(page, log.locator('pre'), 'ANSI log at 320');

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      'metadata 200% overflow',
    ).toBeLessThanOrEqual(1);
    await expectWithinViewport(page, ci, 'CI metadata at 200%');
    await expectWithinViewport(page, payload.locator('pre'), 'JSON at 200%');
    await expectWithinViewport(page, log.locator('pre'), 'ANSI log at 200%');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps hooks readable at 320px and 200% zoom', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-hooks-responsive-'));
  const output = path.join(dir, 'hooks-responsive.html');
  const hooks = messagesFixture('hooks.ndjson');

  try {
    const code = await runCli(
      [hooks, '--out', output, '--title', 'Hooks responsive'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(pathToFileURL(output).href);
    expect(await pageOverflow(page), 'hooks 320 overflow').toBeLessThanOrEqual(1);
    await expect(page.locator('details.hookGroup').first()).toBeVisible();

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      'hooks 200% overflow',
    ).toBeLessThanOrEqual(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps diagnostics readable at 320px and 200% zoom', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-diagnostics-responsive-'));
  const output = path.join(dir, 'diagnostics-responsive.html');

  try {
    const code = await runCli(
      [allStatusesFixture, '--out', output, '--title', 'Diagnostics responsive'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(pathToFileURL(output).href);
    expect(await pageOverflow(page), 'diagnostics 320 overflow').toBeLessThanOrEqual(
      1,
    );

    const undefinedScenario = page.locator('[data-scenario-name="Undefined"]');
    const ambiguousScenario = page.locator('[data-scenario-name="Ambiguous"]');
    await expect(undefinedScenario).toHaveAttribute('open', '');
    await expect(ambiguousScenario).toHaveAttribute('open', '');
    await expectWithinViewport(
      page,
      undefinedScenario.locator('.diagnostic'),
      'undefined diagnostic at 320',
    );
    await expectWithinViewport(
      page,
      ambiguousScenario.locator('.diagnostic'),
      'ambiguous diagnostic at 320',
    );
    const snippet = undefinedScenario.locator('.snippet pre');
    expect(
      await snippet.evaluate((element) => element.scrollWidth - element.clientWidth),
      'snippet clipped at 320',
    ).toBeLessThanOrEqual(1);

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      'diagnostics 200% overflow',
    ).toBeLessThanOrEqual(1);
    await expectWithinViewport(
      page,
      undefinedScenario.locator('.diagnostic'),
      'undefined diagnostic at 200%',
    );
    await expectWithinViewport(
      page,
      ambiguousScenario.locator('.diagnostic'),
      'ambiguous diagnostic at 200%',
    );
    expect(
      await snippet.evaluate((element) => element.scrollWidth - element.clientWidth),
      'snippet clipped at 200%',
    ).toBeLessThanOrEqual(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps grouped outlines readable at 320px and 200% zoom', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-outline-responsive-'));
  const output = path.join(dir, 'outline-responsive.html');

  try {
    const code = await runCli(
      [outlineFixture, '--out', output, '--title', 'Outline responsive'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(pathToFileURL(output).href);
    expect(await pageOverflow(page), 'outline 320 overflow').toBeLessThanOrEqual(
      1,
    );
    await expectWithinViewport(
      page,
      page.locator('.outlineTitle').first(),
      'outline title at 320',
    );
    await expectWithinViewport(
      page,
      page.locator('.examplesTitle').first(),
      'examples title at 320',
    );

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      'outline 200% overflow',
    ).toBeLessThanOrEqual(1);
    await expectWithinViewport(
      page,
      page.locator('.outlineTitle').first(),
      'outline title at 200%',
    );
    await expectWithinViewport(
      page,
      page.locator('.examplesTitle').first(),
      'examples title at 200%',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps rule and background headings readable at 320px and 200% zoom', async ({
  page,
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-rules-responsive-'));
  const output = path.join(dir, 'rules-responsive.html');

  try {
    const code = await runCli(
      [rulesOutlineBackgroundFixture, '--out', output, '--title', 'Rules responsive'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(pathToFileURL(output).href);
    expect(await pageOverflow(page), 'rules 320 overflow').toBeLessThanOrEqual(1);
    await expectWithinViewport(
      page,
      page.locator('.ruleTitle').first(),
      'rule title at 320',
    );
    await expectWithinViewport(
      page,
      page.locator('.backgroundTitle').first(),
      'feature background title at 320',
    );
    await expectWithinViewport(
      page,
      page.locator('section.rule .backgroundTitle').first(),
      'rule background title at 320',
    );
    await expectWithinViewport(
      page,
      page.locator('.outlineTitle').first(),
      'rule outline title at 320',
    );

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      'rules 200% overflow',
    ).toBeLessThanOrEqual(1);
    await expectWithinViewport(
      page,
      page.locator('.ruleTitle').first(),
      'rule title at 200%',
    );
    await expectWithinViewport(
      page,
      page.locator('.backgroundTitle').first(),
      'feature background title at 200%',
    );
    await expectWithinViewport(
      page,
      page.locator('section.rule .backgroundTitle').first(),
      'rule background title at 200%',
    );
    await expectWithinViewport(
      page,
      page.locator('.outlineTitle').first(),
      'rule outline title at 200%',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
