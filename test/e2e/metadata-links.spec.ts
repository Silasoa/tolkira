import { expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli.js';
import { legacyFixture } from '../fixtures.js';
import { reportUrl } from './helpers.js';

const LONG_URL =
  'https://github.com/acme/tolkira/actions/runs/9876543210/workflows/deploy-production-eu-west-1?attempt=2&branch=release%2F0.5';

test('wraps a long metadata link at 320 px and 1440 px without a request', async ({
  page,
}) => {
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
