import { expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';

const tagFixture = fileURLToPath(
  new URL('../fixtures/legacy/tag-expressions.json', import.meta.url),
);
const markdownFixture = fileURLToPath(
  new URL('../fixtures/messages/markdown-descriptions.ndjson', import.meta.url),
);

async function writeReport(
  inputs: string[],
  title: string,
  prefix: string,
): Promise<{ dir: string; output: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const output = path.join(dir, 'report.html');
  const code = await runCli(
    [...inputs, '--out', output, '--title', title],
    { stdout: () => undefined, stderr: () => undefined },
  );
  expect(code).toBe(0);
  return { dir, output };
}

function reportUrl(output: string, search = ''): string {
  return `${pathToFileURL(output).href}${search}`;
}

test('filters by a tag expression and hides empty groups', async ({ page }) => {
  const { dir, output } = await writeReport(
    [tagFixture],
    'Tag expression',
    'tolkira-tag-expression-',
  );

  try {
    await page.goto(reportUrl(output));
    const search = page.locator('input[data-search]');
    await search.fill('@a and not @b');

    await expect(
      page.getByRole('heading', { name: 'alpha one' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'gamma three' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'beta two' }),
    ).toBeHidden();
    await expect(
      page.locator('details.feature').filter({ hasText: 'Beta feature' }),
    ).toBeHidden();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 4 scenarios visible',
    );
    await expect(page.locator('details.scenario[open]')).toHaveCount(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('treats mixed text and tag tokens as substring text', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { dir, output } = await writeReport(
    [tagFixture],
    'Mixed query',
    'tolkira-mixed-query-',
  );

  try {
    await page.goto(reportUrl(output));
    await page.locator('input[data-search]').fill('@a alpha');

    await expect(page.locator('#tolkira-live')).toHaveText(
      '0 of 4 scenarios visible',
    );
    await expect(page.locator('#empty-results')).toBeVisible();
    await expect(page.locator('#tolkira-search-note')).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('falls back to substring search for an invalid tag expression', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { dir, output } = await writeReport(
    [tagFixture],
    'Invalid expression',
    'tolkira-invalid-expression-',
  );

  try {
    await page.goto(reportUrl(output));
    const search = page.locator('input[data-search]');

    await search.fill('@a and');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '0 of 4 scenarios visible',
    );
    await expect(page.locator('#empty-results')).toBeVisible();

    await search.fill('@a');
    await expect(
      page.getByRole('heading', { name: 'alpha one' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'gamma three' }),
    ).toBeVisible();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '2 of 4 scenarios visible',
    );
    await expect(page.locator('#empty-results')).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('combines a tag expression with status and tag filters using AND', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [tagFixture],
    'Combined filters',
    'tolkira-combined-filters-',
  );

  try {
    await page.goto(reportUrl(output));
    const search = page.locator('input[data-search]');
    const passed = page.locator('button.filter[data-status="passed"]');
    const tag = page.locator('select[data-tag-filter]');

    await search.fill('@a or @b');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '3 of 4 scenarios visible',
    );

    await passed.click();
    await expect(passed).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 4 scenarios visible',
    );
    await expect(
      page.getByRole('heading', { name: 'beta two' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'alpha one' }),
    ).toBeHidden();

    await tag.selectOption('@b');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 4 scenarios visible',
    );

    await tag.selectOption('@a');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '0 of 4 scenarios visible',
    );
    await expect(page.locator('#empty-results')).toBeVisible();

    await tag.selectOption('');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 4 scenarios visible',
    );
    await passed.click();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '3 of 4 scenarios visible',
    );
    await expect(
      page.getByRole('heading', { name: 'gamma three' }),
    ).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('caps newly opened rows for a tag expression at 20', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-expression-cap-'));
  const input = path.join(dir, 'many-tagged.json');
  const output = path.join(dir, 'many-tagged.html');

  try {
    const elements = Array.from({ length: 30 }, (_, index) => ({
      keyword: 'Scenario',
      type: 'scenario',
      name: `Cap scenario ${index + 1}`,
      tags: ['@a'],
      steps: [
        {
          keyword: 'Given ',
          name: 'a passing step',
          result: { status: 'passed', duration: 1 },
        },
      ],
    }));
    await writeFile(
      input,
      JSON.stringify([{ name: 'Cap feature', elements }]),
      'utf8',
    );
    const code = await runCli(
      [input, '--out', output, '--title', 'Expression cap'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(reportUrl(output));
    const search = page.locator('input[data-search]');
    await search.fill('@a');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '30 of 30 scenarios visible',
    );
    await expect(page.locator('details.scenario[open]')).toHaveCount(20);
    await expect(page.locator('#tolkira-search-note')).toContainText(
      '20 of 30 matches expanded',
    );

    await search.fill('');
    await expect(page.locator('details.scenario[open]')).toHaveCount(0);
    await expect(page.locator('#tolkira-search-note')).toBeHidden();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('counts only newly opened rows against the search cap', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-newly-opened-cap-'));
  const input = path.join(dir, 'partly-open.json');
  const output = path.join(dir, 'partly-open.html');

  try {
    const elements = Array.from({ length: 30 }, (_, index) => ({
      keyword: 'Scenario',
      type: 'scenario',
      name: `Cap scenario ${index + 1}`,
      tags: ['@a'],
      steps: [
        {
          keyword: 'Given ',
          name: 'a step',
          result:
            index < 10
              ? {
                  status: 'failed',
                  duration: 1,
                  error_message: 'expected failure',
                }
              : { status: 'passed', duration: 1 },
        },
      ],
    }));
    await writeFile(
      input,
      JSON.stringify([{ name: 'Partly open feature', elements }]),
      'utf8',
    );
    const code = await runCli(
      [input, '--out', output, '--title', 'Newly opened cap'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(reportUrl(output));
    await expect(page.locator('details.scenario[open]')).toHaveCount(10);

    const search = page.locator('input[data-search]');
    await search.fill('@a');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '30 of 30 scenarios visible',
    );
    await expect(page.locator('details.scenario[open]')).toHaveCount(30);
    await expect(page.locator('#tolkira-search-note')).toContainText(
      '20 of 30 matches expanded',
    );

    await search.fill('');
    await expect(page.locator('details.scenario[open]')).toHaveCount(10);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('restores query, hide and tag after a reload', async ({ page }) => {
  const { dir, output } = await writeReport(
    [tagFixture],
    'Reload round-trip',
    'tolkira-reload-round-trip-',
  );

  try {
    await page.goto(reportUrl(output, '#scenario-1-1'));
    const search = page.locator('input[data-search]');
    const passed = page.locator('button.filter[data-status="passed"]');
    const tag = page.locator('select[data-tag-filter]');

    await search.fill('@a or @b');
    await passed.click();
    await tag.selectOption('@b');
    await expect
      .poll(() =>
        page.evaluate(() => new URL(location.href).searchParams.get('tag')),
      )
      .toBe('@b');

    await page.reload();

    await expect(search).toHaveValue('@a or @b');
    await expect(passed).toHaveAttribute('aria-pressed', 'false');
    await expect(tag).toHaveValue('@b');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 4 scenarios visible',
    );
    expect(new URL(page.url()).hash).toBe('#scenario-1-1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('restores query, repeated hide and tag parameters and syncs controls', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [tagFixture],
    'Restore state',
    'tolkira-restore-state-',
  );

  try {
    await page.goto(
      reportUrl(
        output,
        '?query=alpha%20one&hide=passed&hide=failed&tag=%40a#scenario-1-1',
      ),
    );

    const search = page.locator('input[data-search]');
    const passed = page.locator('button.filter[data-status="passed"]');
    const failed = page.locator('button.filter[data-status="failed"]');
    const tag = page.locator('select[data-tag-filter]');

    await expect(search).toHaveValue('alpha one');
    await expect(passed).toHaveAttribute('aria-pressed', 'false');
    await expect(failed).toHaveAttribute('aria-pressed', 'false');
    await expect(tag).toHaveValue('@a');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '0 of 4 scenarios visible',
    );
    await expect(page.locator('#empty-results')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#scenario-1-1');

    const hides = await page.evaluate(
      () => new URL(location.href).searchParams.getAll('hide'),
    );
    expect(hides).toEqual(['passed', 'failed']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('restores a plus-encoded query from the URL', async ({ page }) => {
  const { dir, output } = await writeReport(
    [tagFixture],
    'Plus query',
    'tolkira-plus-query-',
  );

  try {
    await page.goto(reportUrl(output, '?query=alpha+one'));

    await expect(page.locator('input[data-search]')).toHaveValue('alpha one');
    await expect(
      page.getByRole('heading', { name: 'alpha one' }),
    ).toBeVisible();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 4 scenarios visible',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('updates query, repeated hide and tag with replaceState and preserves the hash', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [tagFixture],
    'URL update',
    'tolkira-url-update-',
  );

  try {
    await page.goto(reportUrl(output, '?utm=mail#scenario-1-1'));
    const search = page.locator('input[data-search]');
    const passed = page.locator('button.filter[data-status="passed"]');
    const failed = page.locator('button.filter[data-status="failed"]');
    const tag = page.locator('select[data-tag-filter]');
    const historyBefore = await page.evaluate(() => history.length);

    await search.pressSequentially('alpha one');
    await expect
      .poll(() =>
        page.evaluate(() => new URL(location.href).searchParams.get('query')),
      )
      .toBe('alpha one');
    expect(new URL(page.url()).hash).toBe('#scenario-1-1');
    expect(
      await page.evaluate(() => new URL(location.href).searchParams.get('utm')),
    ).toBe('mail');

    await passed.click();
    await failed.click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          new URL(location.href).searchParams.getAll('hide').sort(),
        ),
      )
      .toEqual(['failed', 'passed']);
    await expect(tag).toHaveValue('');

    await tag.selectOption('@a');
    await expect
      .poll(() =>
        page.evaluate(() => new URL(location.href).searchParams.get('tag')),
      )
      .toBe('@a');

    expect(new URL(page.url()).hash).toBe('#scenario-1-1');
    expect(
      await page.evaluate(() => new URL(location.href).searchParams.get('utm')),
    ).toBe('mail');
    expect(await page.evaluate(() => history.length)).toBe(historyBefore);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps filtering working when replaceState throws', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(history, 'replaceState', {
      configurable: true,
      value: () => {
        throw new Error('replaceState blocked');
      },
    });
  });
  const { dir, output } = await writeReport(
    [tagFixture],
    'No replaceState',
    'tolkira-no-replacestate-',
  );

  try {
    await page.goto(reportUrl(output));
    const search = page.locator('input[data-search]');
    await search.fill('alpha one');

    await expect(
      page.getByRole('heading', { name: 'alpha one' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'beta two' }),
    ).toBeHidden();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 4 scenarios visible',
    );

    await page.locator('button.filter[data-status="passed"]').click();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '0 of 4 scenarios visible',
    );
    expect(errors).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('ignores empty, unknown and uppercase URL parameters', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { dir, output } = await writeReport(
    [tagFixture],
    'URL edges',
    'tolkira-url-edges-',
  );

  try {
    await page.goto(reportUrl(output, '?query=&hide=&hide=unknown&tag='));
    await expect(page.locator('details.scenario')).toHaveCount(4);
    await expect(page.locator('details.scenario[hidden]')).toHaveCount(0);
    await expect(page.locator('input[data-search]')).toHaveValue('');
    await expect(
      page.locator('button.filter[data-status="passed"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#empty-results')).toBeHidden();

    await page.goto(reportUrl(output, '?HIDE=passed'));
    await expect(page.locator('details.scenario[hidden]')).toHaveCount(0);
    await expect(
      page.locator('button.filter[data-status="passed"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps the static report readable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const { dir, output } = await writeReport(
    [tagFixture],
    'No JS',
    'tolkira-no-js-',
  );

  try {
    await page.goto(reportUrl(output, '?query=alpha%20one&hide=passed'));

    await expect(page.locator('details.scenario')).toHaveCount(4);
    await expect(page.locator('input[data-search]')).toHaveValue('');
    await expect(
      page.locator('button.filter[data-status="passed"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tolkira-live')).toHaveText('');
    await expect(page.locator('#empty-results')).toBeHidden();

    await page
      .locator('details.feature')
      .filter({ hasText: 'Alpha feature' })
      .locator('summary')
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'alpha one' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'beta two' }),
    ).toBeVisible();
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('renders Markdown descriptions without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const { dir, output } = await writeReport(
    [markdownFixture],
    'Markdown no JS',
    'tolkira-markdown-no-js-',
  );

  try {
    await page.goto(reportUrl(output));
    await page.locator('details.feature summary').first().click();

    await expect(
      page.getByRole('heading', { name: 'Feature guide' }),
    ).toBeVisible();
    await expect(page.getByText('nested item')).toBeVisible();
    await expect(page.getByRole('link', { name: 'HTTPS link' })).toHaveAttribute(
      'rel',
      'noopener noreferrer nofollow',
    );
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});
