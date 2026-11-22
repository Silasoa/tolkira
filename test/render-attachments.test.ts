import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateReport } from '../src/index.js';
import {
  NEUTRAL_FOOTER,
  SINGULAR_NOTICE,
  pluralNotice,
  writeAttachmentReport,
} from './attachments.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-render-attachment-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function decodeText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function warningMarkup(html: string): string | undefined {
  return /<div[^>]*class="attachmentWarning"[^>]*>([\s\S]*?)<\/div>/.exec(
    html,
  )?.[1];
}

function warningText(html: string): string | undefined {
  const inner = warningMarkup(html);
  return inner === undefined ? undefined : decodeText(inner);
}

describe('skipped attachment notice', () => {
  it('renders the singular notice in the shared shell on both tabs', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-render-outside-');
    const secret = path.join(outside, 'secret.md');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'outside', contentType: 'text/plain', path: secret },
    ]);

    const { html } = await generateReport(input, { title: 'Singular' });
    const shell = html.indexOf('class="noticeShell"');
    const reportView = html.slice(
      html.indexOf('id="report-view"'),
      html.indexOf('id="analysis-view"'),
    );
    const analysisView = html.slice(html.indexOf('id="analysis-view"'));

    expect(warningText(html)).toBe(SINGULAR_NOTICE);
    // One run-level notice in the shell, one on the affected scenario.
    expect(html.match(/class="attachmentWarning"/g)).toHaveLength(2);
    expect(shell).toBeGreaterThan(-1);
    expect(shell).toBeLessThan(html.indexOf('id="report-view"'));
    expect(shell).toBeLessThan(html.indexOf('id="analysis-view"'));
    expect(warningText(reportView)).toBe(SINGULAR_NOTICE);
    expect(analysisView).not.toContain('attachmentWarning');
    expect(warningMarkup(html) ?? '').not.toContain(dir);
    expect(warningMarkup(reportView) ?? '').not.toContain(dir);
    expect(warningMarkup(html) ?? '').not.toContain(outside);
    expect(warningMarkup(reportView) ?? '').not.toContain(outside);
    expect(warningMarkup(html) ?? '').not.toContain(process.cwd());
    expect(warningMarkup(reportView) ?? '').not.toContain(process.cwd());
  });

  it('renders the plural notice with the summed count', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-render-outside-');
    const first = path.join(outside, 'first.md');
    const second = path.join(outside, 'second.md');
    await writeFile(first, 'first outside secret', 'utf8');
    await writeFile(second, 'second outside secret', 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'first', contentType: 'text/plain', path: first },
      { name: 'second', contentType: 'text/plain', path: second },
    ]);

    const { html } = await generateReport(input, { title: 'Plural' });

    expect(warningText(html)).toBe(pluralNotice(2));
    expect(warningMarkup(html) ?? '').not.toContain(dir);
    expect(warningMarkup(html) ?? '').not.toContain(outside);
  });

  it('keeps a clean report free of warning markup and uses the neutral footer', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'note.txt'), 'local note', 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'note', contentType: 'text/plain', path: 'note.txt' },
    ]);

    const { html } = await generateReport(input, { title: 'Clean' });

    expect(html).not.toContain('class="attachmentWarning"');
    expect(html).not.toContain('class="noticeShell"');
    expect(html).toContain(NEUTRAL_FOOTER);
    expect(html).not.toContain('Screenshots are embedded');
  });

  it('keeps the neutral footer when the notice is shown', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-render-outside-');
    const secret = path.join(outside, 'secret.md');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'outside', contentType: 'text/plain', path: secret },
    ]);

    const { html } = await generateReport(input, { title: 'Footer' });

    expect(html).toContain(NEUTRAL_FOOTER);
    expect(html).not.toContain('Screenshots are embedded');
    expect(html).toContain('1 path attachment was skipped');
  });
});
