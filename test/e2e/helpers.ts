import { expect, type Page } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';

export interface ReportFile {
  dir: string;
  output: string;
}

export async function writeInput(
  name: string,
  content: string,
  prefix = 'tolkira-input-',
): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const file = path.join(dir, name);
  try {
    await writeFile(file, content, 'utf8');
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, file };
}

export async function writeReport(
  inputs: string[],
  title = '',
  prefix = 'tolkira-e2e-',
): Promise<ReportFile> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const output = path.join(dir, 'report.html');
  const args = [...inputs, '--out', output];
  if (title) args.push('--title', title);
  let stderr = '';
  try {
    const code = await runCli(args, {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });
    expect(code, stderr).toBe(0);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, output };
}

export async function removeReport(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export function reportUrl(output: string, search = ''): string {
  return `${pathToFileURL(output).href}${search}`;
}

export async function stubClipboard(page: Page): Promise<void> {
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
}

export async function stubClipboardFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('blocked')),
      },
    });
    document.execCommand = () => false;
  });
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ?? '',
  );
}
