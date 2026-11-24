import { expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli.js';
import { legacyFixture } from '../fixtures.js';
import { reportUrl } from './helpers.js';

const LONG_URL =
  'https://github.com/acme/tolkira/actions/runs/9876543210/workflows/deploy-production-eu-west-1?attempt=2&branch=release%2F0.5';

async function metadataReport(locale?: string): Promise<{
  dir: string;
  url: string;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-metadata-layout-'));
  const output = path.join(dir, 'report.html');
  const stderr: string[] = [];
  const code = await runCli(
    [
      legacyFixture('happy.json'),
      '--out',
      output,
      '--meta',
      `CI run=${LONG_URL}`,
      ...(locale ? ['--locale', locale] : []),
    ],
    {
      stdout: () => undefined,
      stderr: (text) => {
        stderr.push(text);
      },
    },
  );
  expect(code, stderr.join('')).toBe(0);
  return { dir, url: reportUrl(output) };
}

function detailsMetadata(page: import('@playwright/test').Page) {
  const link = page.getByRole('link', { name: LONG_URL, exact: true });
  return page.locator('#analysis-view .metaList').filter({ has: link });
}

async function metadataLayout(
  page: import('@playwright/test').Page,
): Promise<{ columns: number; align: string; linkWidth: number }> {
  const meta = detailsMetadata(page);
  await expect(meta).toBeVisible();
  const layout = await meta.evaluate((element) => {
    const style = getComputedStyle(element);
    const value = element.querySelector('dd');
    const link = element.querySelector('a');
    return {
      columns: style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean)
        .length,
      align: value ? getComputedStyle(value).textAlign : '',
      linkWidth: link ? link.getBoundingClientRect().width : 0,
      metaWidth: element.getBoundingClientRect().width,
      linkRight: link ? link.getBoundingClientRect().right : 0,
      metaRight: element.getBoundingClientRect().right,
    };
  });
  expect(layout.linkRight).toBeLessThanOrEqual(layout.metaRight + 1);
  expect(layout.linkWidth).toBeLessThanOrEqual(layout.metaWidth + 1);
  return { columns: layout.columns, align: layout.align, linkWidth: layout.linkWidth };
}

test('stacks the Details metadata at 320 px with 200% text only', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const report = await metadataReport();
  try {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(report.url);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await page.getByRole('tab', { name: 'Details' }).click();

    const zoomed = await metadataLayout(page);
    expect(zoomed.columns).toBe(1);
    expect(zoomed.align).toMatch(/^(start|left)$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
      '320px at 200% overflow',
    ).toBeLessThanOrEqual(1);

    const link = page.getByRole('link', { name: LONG_URL, exact: true });
    await expect(link).toHaveAttribute('href', LONG_URL);
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  } finally {
    await rm(report.dir, { recursive: true, force: true });
  }
});

test('keeps the two-column metadata layout at normal text and wider widths', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const report = await metadataReport();
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(report.url);
      await page.getByRole('tab', { name: 'Details' }).click();
      const layout = await metadataLayout(page);

      expect(layout.columns, `${width} px tracks`).toBe(2);
      expect(layout.align, `${width} px align`).toBe('right');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
        `${width} px overflow`,
      ).toBeLessThanOrEqual(1);
    }
  } finally {
    await rm(report.dir, { recursive: true, force: true });
  }
});

test('stacks the German Details metadata at 320 px with 200% text', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const report = await metadataReport('de');
  try {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(report.url);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await page.getByRole('tab', { name: 'Details' }).click();

    const layout = await metadataLayout(page);
    expect(layout.columns).toBe(1);
    expect(layout.align).toMatch(/^(start|left)$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
      'German 320px at 200% overflow',
    ).toBeLessThanOrEqual(1);
  } finally {
    await rm(report.dir, { recursive: true, force: true });
  }
});

test('keeps the German two-column metadata layout at 320 px and 100% text', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const report = await metadataReport('de');
  try {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(report.url);
    await page.getByRole('tab', { name: 'Details' }).click();

    const layout = await metadataLayout(page);
    expect(layout.columns).toBe(2);
    expect(layout.align).toBe('right');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
      'German 320px at 100% overflow',
    ).toBeLessThanOrEqual(1);
  } finally {
    await rm(report.dir, { recursive: true, force: true });
  }
});

test('wraps a long metadata link at 320 px and 1440 px without a request', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-metadata-e2e-'));
  const output = path.join(dir, 'report.html');
  const stderr: string[] = [];
  const externalRequests: string[] = [];

  try {
    const code = await runCli(
      [legacyFixture('happy.json'), '--out', output, '--meta', `CI run=${LONG_URL}`],
      {
        stdout: () => undefined,
        stderr: (text) => {
          stderr.push(text);
        },
      },
    );
    expect(code, stderr.join('')).toBe(0);

    page.on('request', (request) => {
      if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
    });

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(reportUrl(output));
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });

    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );

    const header = page.locator('#report-view .runHead .meta');
    expect(await overflow(), 'report overflow').toBeLessThanOrEqual(1);
    const headerLink = header.getByRole('link', { name: LONG_URL, exact: true });
    await expect(headerLink).toBeVisible();
    await expect(headerLink).toHaveAttribute('href', LONG_URL);
    await expect(headerLink).toHaveAttribute('rel', 'noopener noreferrer');

    await page.getByRole('tab', { name: 'Details' }).click();
    expect(await overflow(), 'details overflow').toBeLessThanOrEqual(1);
    const details = page.locator('#analysis-view .metaList');
    const detailsLink = details.getByRole('link', {
      name: LONG_URL,
      exact: true,
    });
    await expect(detailsLink).toBeVisible();
    await expect(detailsLink).toHaveAttribute('href', LONG_URL);
    await expect(detailsLink).toHaveAttribute('rel', 'noopener noreferrer');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '16px';
    });
    await page.getByRole('tab', { name: 'Report' }).click();
    expect(await overflow(), 'report overflow at 1440').toBeLessThanOrEqual(1);
    await expect(headerLink).toBeVisible();
    await expect(headerLink).toHaveAttribute('href', LONG_URL);
    await page.getByRole('tab', { name: 'Details' }).click();
    expect(await overflow(), 'details overflow at 1440').toBeLessThanOrEqual(1);
    await expect(detailsLink).toBeVisible();
    await expect(detailsLink).toHaveAttribute('href', LONG_URL);

    expect(externalRequests, 'external requests').toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
