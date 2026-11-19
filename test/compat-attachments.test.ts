import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generate } from '../src/compat/cucumber-html-reporter.js';
import {
  CLI_HINT,
  SINGULAR_NOTICE,
  writeAttachmentReport,
} from './attachments.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-compat-attachment-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('cucumber-html-reporter compat attachments', () => {
  it('adds the skipped-attachment notice to warnings', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-compat-outside-');
    const secret = path.join(outside, 'secret.md');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'outside', contentType: 'text/plain', path: secret },
    ]);
    const output = path.join(dir, 'report.html');

    const result = await generate({ jsonFile: input, output });

    expect(result.warnings).toEqual([`${SINGULAR_NOTICE} ${CLI_HINT}`]);
  });

  it('adds no attachment warning for a clean run', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'note.txt'), 'local note', 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'note', contentType: 'text/plain', path: 'note.txt' },
    ]);
    const output = path.join(dir, 'report.html');

    const result = await generate({ jsonFile: input, output });

    expect(result.warnings).toEqual([]);
  });
});
