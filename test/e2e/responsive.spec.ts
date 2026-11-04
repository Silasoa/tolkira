import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';

const fixtures = ['failed.json', 'minimal.json', 'behave.json'].map((name) =>
  fileURLToPath(new URL(`../fixtures/legacy/${name}`, import.meta.url)),
);

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
