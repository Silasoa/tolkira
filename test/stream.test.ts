import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { Envelope } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { CucumberHtmlStream, renderReport, type RenderReportOptions } from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { messagesFixture } from './fixtures.js';

const fixture = messagesFixture('second.ndjson');

async function streamHtml(
  title?: string,
  options: Omit<RenderReportOptions, 'title'> = {},
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

  it('passes the logo to the same renderer as the API', async () => {
    const logo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const html = await streamHtml('Stream logo', { logo });

    expect(html).toBe(await renderReport(fixture, { title: 'Stream logo', logo }));
    expect(html).toContain('class="logo"');
  });

  it('forwards renderer errors without emitting partial HTML', async () => {
    const hostile = {
      get pickle(): never {
        throw new Error('stream boom');
      },
    } as unknown as Envelope;
    const stream = new CucumberHtmlStream();
    let output = '';
    stream.on('data', (chunk: string) => {
      output += chunk;
    });

    const error = await new Promise<Error>((resolve, reject) => {
      stream.once('error', resolve);
      stream.once('end', () => reject(new Error('expected a stream error')));
      stream.end(hostile);
    });

    expect(error.message).toBe('stream boom');
    expect(output).toBe('');
  });
});
