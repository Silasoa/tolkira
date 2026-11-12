import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { CucumberHtmlStream, renderReport } from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { messagesFixture } from './fixtures.js';

const fixture = messagesFixture('second.ndjson');

async function streamHtml(
  title?: string,
  options: { metadata?: Record<string, string>; accent?: string } = {},
): Promise<string> {
  const envelopes = parseMessages(await readFile(fixture, 'utf8'), fixture);
  const stream = Readable.from(envelopes).pipe(
    new CucumberHtmlStream({ title, ...options }),
  );
  let html = '';
  for await (const chunk of stream) html += chunk;
  return html;
}

describe('CucumberHtmlStream', () => {
  it('renders the same HTML as renderReport from a real stream', async () => {
    const html = await streamHtml('Stream parity');

    expect(html).toBe(await renderReport(fixture, { title: 'Stream parity' }));
    expect(html).toContain('<title>Stream parity</title>');
  });

  it('uses the API defaults when no options are passed', async () => {
    expect(await streamHtml()).toBe(await renderReport(fixture));
  });

  it('passes metadata and accent to the same renderer as the API', async () => {
    const options = {
      metadata: { CI: 'true', Commit: 'abc1234' },
      accent: '#1b5e20',
    };
    const html = await streamHtml('Stream options', options);

    expect(html).toBe(
      await renderReport(fixture, { title: 'Stream options', ...options }),
    );
    expect(html).toContain('CI');
    expect(html).toContain('abc1234');
  });
});
