import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { Envelope } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import {
  CucumberHtmlStream,
  readHistory,
  renderReport,
  type RenderReportOptions,
} from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { createTranslator } from '../src/render/i18n.js';
import { messagesFixture } from './fixtures.js';

const fixture = messagesFixture('second.ndjson');
const en = createTranslator('en');

/**
 * The file API adds the input-size row and its own exact report size; the
 * stream has no file origin, so the input row is the documented difference and
 * the report size is normalized to a placeholder before the parity compare.
 */
function withoutFileOrigin(html: string): string {
  return html
    .replace(/<dt>(?:Input data|Eingabedaten)<\/dt><dd>[^<]*<\/dd>/, '')
    .replace(
      /(<dt>(?:Report HTML|Bericht-HTML)<\/dt>)<dd>[^<]*<\/dd>/,
      '$1<dd>[report bytes]</dd>',
    );
}

function reportRow(html: string): string | undefined {
  return /<dt>(?:Report HTML|Bericht-HTML)<\/dt><dd>([^<]*)<\/dd>/.exec(html)?.[1];
}

async function streamHtml(
  title?: string,
  options: Omit<RenderReportOptions, 'title'> = {},
): Promise<string> {
  const envelopes = parseMessages(await readFile(fixture, 'utf8'), fixture);
  const stream = Readable.from(envelopes).pipe(
    new CucumberHtmlStream({
      ...(title === undefined ? {} : { title }),
      ...options,
    }),
  );
  let html = '';
  for await (const chunk of stream) html += chunk;
  return html;
}

describe('CucumberHtmlStream', () => {
  it('renders the same HTML as renderReport from a real stream', async () => {
    const html = await streamHtml('Stream parity');
    const fileHtml = await renderReport(fixture, { title: 'Stream parity' });

    expect(withoutFileOrigin(html)).toBe(withoutFileOrigin(fileHtml));
    expect(html).not.toContain('<dt>Input data</dt>');
    expect(fileHtml).toContain('<dt>Input data</dt>');
    expect(reportRow(html)).toBe(
      en.t('format.bytes', { count: Buffer.byteLength(html, 'utf8') }),
    );
    expect(html).toContain('<title>Stream parity</title>');
  });

  it('uses the API defaults when no options are passed', async () => {
    expect(withoutFileOrigin(await streamHtml())).toBe(
      withoutFileOrigin(await renderReport(fixture)),
    );
  });

  it('passes metadata and accent to the same renderer as the API', async () => {
    const options = {
      metadata: { CI: 'true', Commit: 'abc1234' },
      accent: '#1b5e20',
    };
    const html = await streamHtml('Stream options', options);

    expect(withoutFileOrigin(html)).toBe(
      withoutFileOrigin(
        await renderReport(fixture, { title: 'Stream options', ...options }),
      ),
    );
    expect(html).toContain('CI');
    expect(html).toContain('abc1234');
  });

  it('passes the logo to the same renderer as the API', async () => {
    const logo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const html = await streamHtml('Stream logo', { logo });

    expect(withoutFileOrigin(html)).toBe(
      withoutFileOrigin(await renderReport(fixture, { title: 'Stream logo', logo })),
    );
    expect(html).toContain('class="logo"');
  });

  it('passes the locale to the renderer and rejects an invalid locale', async () => {
    const html = await streamHtml('Stream locale', { locale: 'de' });

    expect(withoutFileOrigin(html)).toBe(
      withoutFileOrigin(
        await renderReport(fixture, { title: 'Stream locale', locale: 'de' }),
      ),
    );
    expect(html).toContain('<html lang="de" dir="ltr">');
    expect(html).toContain('>Bericht</button>');
    await expect(streamHtml('Bad locale', { locale: 'fr' })).rejects.toThrow(
      /\bde\b/,
    );
  });

  it('renders the same history as renderReport without appending a run', async () => {
    const history = await readHistory(
      fileURLToPath(
        new URL('./fixtures/history/two-runs.json', import.meta.url),
      ),
    );
    const options = { history };
    const html = await streamHtml('Stream history', options);

    expect(withoutFileOrigin(html)).toBe(
      withoutFileOrigin(
        await renderReport(fixture, { title: 'Stream history', ...options }),
      ),
    );
    expect(html).toContain('data-view="trends"');
  });

  it('renders the static form through the same option', async () => {
    const html = await streamHtml('Stream static', { static: true });

    expect(html).not.toMatch(/<script\b/i);
    expect(html).toContain('id="report-view"');
    expect(withoutFileOrigin(html)).toBe(
      withoutFileOrigin(
        await renderReport(fixture, { title: 'Stream static', static: true }),
      ),
    );
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
