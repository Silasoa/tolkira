import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Envelope } from '@cucumber/messages';
import { afterEach, describe, expect, it } from 'vitest';
import { recordSkippedAttachments } from '../src/attempt-diagnostics.js';
import { generateReport } from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import {
  NEUTRAL_FOOTER,
  SKIP_REASON,
  SKIP_WHERE,
  skipNotice,
  writeAttachmentReport,
} from './attachments.js';
import { messagesFixture } from './fixtures.js';

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

    expect(warningText(html)).toBe(`${skipNotice(1)} ${SKIP_WHERE}`);
    // One run-level notice in the shell, one on the affected scenario.
    expect(html.match(/class="attachmentWarning"/g)).toHaveLength(2);
    expect(shell).toBeGreaterThan(-1);
    expect(shell).toBeLessThan(html.indexOf('id="report-view"'));
    expect(shell).toBeLessThan(html.indexOf('id="analysis-view"'));
    expect(warningText(reportView)).toContain(skipNotice(1));
    expect(analysisView).not.toContain('attachmentWarning');
    // The run notice is generic; the reason lives only on the scenario list.
    expect(warningMarkup(html) ?? '').not.toContain(SKIP_REASON.outside);
    expect(html).toContain(
      `<li><code>outside</code> - ${SKIP_REASON.outside}</li>`,
    );
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

    expect(warningText(html)).toBe(`${skipNotice(2)} ${SKIP_WHERE}`);
    expect(warningMarkup(html) ?? '').not.toContain(dir);
    expect(warningMarkup(html) ?? '').not.toContain(outside);
    expect(html).toContain(
      `<li><code>first</code> - ${SKIP_REASON.outside}</li>`,
    );
    expect(html).toContain(
      `<li><code>second</code> - ${SKIP_REASON.outside}</li>`,
    );
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
    expect(html).not.toContain('class="attachmentSkipList"');
    expect(html).toContain(NEUTRAL_FOOTER);
    expect(html).not.toContain('Screenshots are embedded');
  });

  it('renders recorded entries when the count is zero', async () => {
    const envelopes = parseMessages(
      await readFile(messagesFixture('hooks.ndjson'), 'utf8'),
      'hooks.ndjson',
    );
    const started = envelopes.find((envelope) => envelope.testCaseStarted)
      ?.testCaseStarted;
    if (!started) throw new Error('missing testCaseStarted envelope');
    recordSkippedAttachments(started, 0, [
      { name: 'edge.png', reason: 'missing' },
    ]);

    const html = await renderHtml(envelopes, { title: 'Zero count' });

    expect(html).toContain(skipNotice(1));
    expect(html).not.toContain(skipNotice(0));
    expect(html).toContain('class="attachmentSkipList"');
    expect(html).toContain(
      `<li><code>edge.png</code> - ${SKIP_REASON.missing}</li>`,
    );
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
    expect(html).toContain(skipNotice(1));
    expect(html).toContain(SKIP_WHERE);
  });
});

describe('media data URIs in the report', () => {
  function mediaEnvelopes(
    body: string,
    mediaType: string,
    contentEncoding = 'IDENTITY',
  ): Envelope[] {
    return [
      {
        gherkinDocument: {
          uri: 'features/media.feature',
          comments: [],
          feature: {
            location: { line: 1, column: 1 },
            tags: [],
            language: 'en',
            keyword: 'Feature',
            name: 'Media feature',
            description: '',
            children: [
              {
                scenario: {
                  id: 'media-scenario',
                  location: { line: 3, column: 3 },
                  tags: [],
                  keyword: 'Scenario',
                  name: 'Media scenario',
                  description: '',
                  steps: [
                    {
                      id: 'media-step-def',
                      location: { line: 4, column: 5 },
                      keyword: 'Given ',
                      keywordType: 'Context',
                      text: 'a step',
                    },
                  ],
                  examples: [],
                },
              },
            ],
          },
        },
      },
      {
        pickle: {
          id: 'media-pickle',
          uri: 'features/media.feature',
          name: 'Media scenario',
          language: 'en',
          astNodeIds: ['media-scenario'],
          tags: [],
          steps: [
            { id: 'media-pickle-step', text: 'a step', astNodeIds: [] },
          ],
        },
      },
      {
        testCase: {
          id: 'media-case',
          pickleId: 'media-pickle',
          testSteps: [{ id: 'media-step', pickleStepId: 'media-pickle-step' }],
        },
      },
      {
        testCaseStarted: {
          id: 'media-start',
          testCaseId: 'media-case',
          attempt: 0,
          timestamp: { seconds: 1, nanos: 0 },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: 'media-start',
          testStepId: 'media-step',
          testStepResult: {
            status: 'PASSED',
            duration: { seconds: 0, nanos: 1 },
          },
          timestamp: { seconds: 1, nanos: 1 },
        },
      },
      {
        attachment: {
          body,
          contentEncoding,
          mediaType,
          fileName: 'media',
          testCaseStartedId: 'media-start',
        },
      },
    ] as unknown as Envelope[];
  }

  it.each([
    ['image/png', '\uD800', '<img'],
    ['image/png', '\uDC00', '<img'],
    ['video/mp4', '\uD800', '<video'],
    ['video/mp4', '\uDC00', '<video'],
  ])(
    'renders a complete report for a lone surrogate in a %s body (%j)',
    async (mediaType, body, tag) => {
      const envelopes = mediaEnvelopes(body, mediaType);
      const model = buildReportModel(envelopes);
      const html = await renderHtml(envelopes, { title: 'Lone surrogate' });
      const dataUri = model.scenarios[0]?.extraAttachments[0]?.dataUri;

      expect(dataUri).toBe(
        `data:${mediaType};base64,${Buffer.from(body, 'utf8').toString('base64')}`,
      );
      expect(html).toContain(tag);
      expect(html).toContain(`data:${mediaType};base64,`);
      expect(html).toContain('</html>');
      expect(html).not.toContain('URI malformed');
    },
  );

  it('keeps a normal UTF-8 media body readable in the report', async () => {
    const envelopes = mediaEnvelopes('hello', 'image/png');
    const html = await renderHtml(envelopes, { title: 'Readable body' });

    expect(html).toContain('data:image/png;charset=utf-8,hello');
    expect(html).not.toContain('data:image/png;base64,');
  });

  it('keeps a BASE64 media body unchanged in the report', async () => {
    const envelopes = mediaEnvelopes('AAAA', 'image/png', 'BASE64');
    const html = await renderHtml(envelopes, { title: 'Base64 body' });

    expect(html).toContain('data:image/png;base64,AAAA');
  });

  it('renders no media data URI for an empty body', async () => {
    const envelopes = mediaEnvelopes('', 'image/png');
    const model = buildReportModel(envelopes);
    const html = await renderHtml(envelopes, { title: 'Empty body' });

    expect(model.scenarios[0]?.extraAttachments[0]?.dataUri).toBeUndefined();
    expect(html).not.toContain('data:image/png');
    expect(html).toContain('</html>');
  });

  it('renders an audio media type as a binary download, not an inline player', async () => {
    const envelopes = mediaEnvelopes('YXVkaW8=', 'audio/mpeg', 'BASE64');
    const html = await renderHtml(envelopes, { title: 'Audio attachment' });

    expect(html).toContain(
      '<a class="fileLink" href="data:application/octet-stream;base64,YXVkaW8=" download="media">media (application/octet-stream, 5 bytes)</a>',
    );
    expect(html).not.toContain('<audio');
    expect(html).not.toContain('data:audio/');
    expect(html).toContain('</html>');
  });
});
