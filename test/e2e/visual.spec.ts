import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';

const fixtures = ['failed.json', 'minimal.json', 'behave.json', 'screenshot.json'].map(
  (name) =>
    fileURLToPath(new URL(`../fixtures/legacy/${name}`, import.meta.url)),
);
fixtures.push(
  fileURLToPath(
    new URL('../fixtures/messages/screenshot.ndjson', import.meta.url),
  ),
);

async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) =>
        image.decode().catch(() => undefined),
      ),
    ),
  );
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await waitForImages(page);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test('captures report screenshots for visual review', async ({
  page,
}, testInfo) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-visual-'));
  const output = path.join(dir, 'report.html');

  try {
    const code = await runCli(
      [...fixtures, '--out', output, '--title', 'Tolkira visual review'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(output).href);
    await expect(
      page.getByRole('heading', { name: 'Tolkira visual review', level: 1 }),
    ).toBeVisible();
    await capture(page, testInfo, 'desktop-light');

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Failing');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    await capture(page, testInfo, 'desktop-search-copy');
    await search.fill('');

    await page.emulateMedia({ colorScheme: 'dark' });
    await capture(page, testInfo, 'desktop-dark');
    await page.emulateMedia({ colorScheme: 'light' });

    await page.getByRole('tab', { name: 'Details' }).click();
    await expect(
      page.getByRole('heading', { name: 'Run details', level: 1 }),
    ).toBeVisible();
    await capture(page, testInfo, 'desktop-details');

    await page.getByRole('tab', { name: 'Report' }).click();
    await page.locator('.shotButton').first().click();
    await expect(page.locator('#tolkira-lightbox')).toBeVisible();
    await capture(page, testInfo, 'lightbox');
    await page.keyboard.press('Escape');
    await expect(page.locator('#tolkira-lightbox')).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Report' }).click();
    await capture(page, testInfo, 'mobile-390');

    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await capture(page, testInfo, 'mobile-320-text-zoom');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
