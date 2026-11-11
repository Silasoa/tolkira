import { expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';

const ciFull = fileURLToPath(
  new URL('../fixtures/messages/ci-full.ndjson', import.meta.url),
);
const presentation = fileURLToPath(
  new URL('../fixtures/messages/attachments-presentation.ndjson', import.meta.url),
);
const large = fileURLToPath(
  new URL('../fixtures/messages/attachments-large.ndjson', import.meta.url),
);

const FULL_REVISION = 'abcdef1234567890abcdef1234567890abcdef12';
const CI_URL = 'https://github.com/acme/tolkira/actions/runs/42';
const CI_REMOTE = 'https://github.com/acme/tolkira';

async function writeReport(
  inputs: string[],
  title: string,
): Promise<{ dir: string; output: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-metadata-e2e-'));
  const output = path.join(dir, 'report.html');
  const code = await runCli([...inputs, '--out', output, '--title', title], {
    stdout: () => undefined,
    stderr: () => undefined,
  });
  expect(code).toBe(0);
  return { dir, output };
}

test('shows CI metadata and rich attachments without requests', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [ciFull, presentation],
    'Parity metadata',
  );
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

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
    await page.goto(pathToFileURL(output).href);

    const ciLink = page.getByRole('link', { name: 'GitHub Actions' }).first();
    await expect(ciLink).toBeVisible();
    await expect(ciLink).toHaveAttribute('href', CI_URL);

    const commit = page.getByRole('link', { name: 'abcdef1' }).first();
    await expect(commit).toBeVisible();
    await expect(commit).toHaveAttribute(
      'href',
      `${CI_REMOTE}/commit/${FULL_REVISION}`,
    );
    await expect(commit).toHaveAttribute('title', FULL_REVISION);
    await expect(page.getByText('v1.2.3', { exact: true }).first()).toBeVisible();

    const scenario = page.locator('[data-scenario-name="Rich attachments"]');
    await expect(scenario).toBeVisible();
    await expect(scenario).toHaveAttribute('open', '');

    const payload = page
      .locator('details.attachmentText')
      .filter({ hasText: 'payload.json' });
    await payload.locator('summary').click();
    await expect(payload.locator('pre')).toContainText('"name": "tolkira"');
    await expect(payload.locator('pre')).toContainText('<script>');

    const malformed = page
      .locator('details.attachmentText')
      .filter({ hasText: 'malformed.json' });
    await malformed.locator('summary').click();
    await expect(malformed.locator('pre')).toContainText(
      '{"broken": <not json>',
    );

    const links = page
      .locator('details.attachmentText')
      .filter({ hasText: 'links.txt' });
    await links.locator('summary').click();
    const safe = links.getByRole('link', { name: 'https://example.com/one' });
    await expect(safe).toBeVisible();
    await expect(safe).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(
      links.getByRole('link', { name: 'http://example.com/two' }),
    ).toBeVisible();
    await expect(links.getByRole('link', { name: /javascript:/ })).toHaveCount(0);

    const log = page
      .locator('details.attachmentText')
      .filter({ hasText: 'session.log' });
    await log.locator('summary').click();
    await expect(log).toContainText('ERROR');
    await expect(log).toContainText('256-colour');
    await expect(log).toContainText('truecolour');
    const spans = log.locator('pre span');
    expect(await spans.count()).toBeGreaterThanOrEqual(3);
    const colors = await spans.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).color),
    );
    expect(new Set(colors).size).toBeGreaterThan(1);

    await log.getByRole('button', { name: /copy/i }).click();
    await expect(log.getByRole('button', { name: /copied/i })).toBeVisible();
    const copied = await page.evaluate(
      () =>
        (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ??
        '',
    );
    expect(copied).toContain('ERROR');
    expect(copied).toContain('256-colour');
    expect(copied).not.toContain('\u001b');
    expect(copied).not.toContain('owned');

    expect(
      await page.evaluate(
        () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
      ),
    ).toBeUndefined();

    await page.getByRole('tab', { name: 'Details' }).click();
    const analysis = page.locator('#analysis-view');
    await expect(analysis.locator('dt').filter({ hasText: /^CI$/ })).toBeVisible();
    await expect(
      analysis.locator('dt').filter({ hasText: /^Revision$/ }),
    ).toBeVisible();
    await expect(
      analysis.locator('dt').filter({ hasText: /^Branch$/ }),
    ).toBeVisible();
    await expect(analysis.locator('dt').filter({ hasText: /^Tag$/ })).toBeVisible();

    expect(
      requests.every(
        (url) => url.startsWith('file:') || url.startsWith('data:'),
      ),
    ).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('falls back above the ANSI byte boundary', async ({ page }) => {
  const { dir, output } = await writeReport([large], 'Large logs');

  try {
    await page.goto(pathToFileURL(output).href);
    const limit = page
      .locator('details.attachmentText')
      .filter({ hasText: 'boundary-262144.log' });
    const over = page
      .locator('details.attachmentText')
      .filter({ hasText: 'boundary-262145.log' });

    await limit.locator('summary').click();
    await over.locator('summary').click();
    await expect(limit.locator('pre span').first()).toBeVisible();
    expect(await over.locator('pre span').count()).toBe(0);
    await expect(over.locator('pre')).toContainText('xxxx');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test.describe('without scripting', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps CI metadata and rich attachments readable', async ({ page }) => {
    const { dir, output } = await writeReport(
      [ciFull, presentation],
      'Parity metadata without scripting',
    );
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    try {
      await page.goto(pathToFileURL(output).href);
      const ciLink = page.getByRole('link', { name: 'GitHub Actions' }).first();
      await expect(ciLink).toBeVisible();
      await expect(ciLink).toHaveAttribute('href', CI_URL);
      await expect(
        page.getByRole('link', { name: 'abcdef1' }).first(),
      ).toBeVisible();

      const payload = page
        .locator('details.attachmentText')
        .filter({ hasText: 'payload.json' });
      await payload.locator('summary').click();
      await expect(payload.locator('pre')).toContainText('"name": "tolkira"');

      const links = page
        .locator('details.attachmentText')
        .filter({ hasText: 'links.txt' });
      await links.locator('summary').click();
      await expect(
        links.getByRole('link', { name: 'https://example.com/one' }),
      ).toBeVisible();

      const log = page
        .locator('details.attachmentText')
        .filter({ hasText: 'session.log' });
      await log.locator('summary').click();
      await expect(log).toContainText('ERROR');
      await expect(log).toContainText('256-colour');
      await expect(log).toContainText('truecolour');

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
