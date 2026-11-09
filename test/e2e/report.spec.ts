import { expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';

const fixture = fileURLToPath(
  new URL('../fixtures/messages/screenshot.ndjson', import.meta.url),
);
const legacyFixture = fileURLToPath(
  new URL('../fixtures/legacy/screenshot.json', import.meta.url),
);
const minimalFixture = fileURLToPath(
  new URL('../fixtures/legacy/minimal.json', import.meta.url),
);
const tableFixture = fileURLToPath(
  new URL('../fixtures/legacy/happy.json', import.meta.url),
);
const xssFixture = fileURLToPath(
  new URL('../fixtures/legacy/xss.json', import.meta.url),
);
const noMessageFixture = fileURLToPath(
  new URL('../fixtures/legacy/failed-no-message.json', import.meta.url),
);
const unhappyFixture = fileURLToPath(
  new URL('../fixtures/legacy/unhappy.json', import.meta.url),
);

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

    const failedFilter = page.locator('button.filter[data-status="failed"]');
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
    const failedFilter = page.locator('button.filter[data-status="failed"]');
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
      [legacyFixture, '--out', output, '--title', 'Legacy E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(page).toHaveTitle('Legacy E2E');
    await expect(
      page.getByRole('heading', { name: 'Happy HTML reporting' }),
    ).toBeVisible();
    await expect(page.getByText('attachment-1.png')).toBeVisible();
    await expect(page.getByText('Before hook').first()).toBeVisible();
    await expect(
      page.locator('img[src^="data:image/png"]').first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(page.getByText('attachment-1.png')).toBeHidden();
    await page.getByRole('button', { name: 'Expand all' }).click();
    await expect(page.getByText('attachment-1.png')).toBeVisible();
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
    const attachment = page.getByText(/attachment-1\.html/).first();
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

test('opens a scenario from the needs-attention index', async ({ page }) => {
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
    await expect(page.locator('[data-scenario][open]')).toHaveCount(
      openBefore + 1,
    );
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
    await search.fill('');
    await expect(page.locator('[data-scenario][open]')).toHaveCount(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test.describe('without scripting', () => {
  test.use({ javaScriptEnabled: false });

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
});
