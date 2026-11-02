import { CucumberHtmlStream } from '@cucumber/html-formatter';
import type { Envelope } from '@cucumber/messages';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { escapeHtml } from './escape.js';

export interface RenderOptions {
  title: string;
  metadata?: Record<string, string>;
}

function metadataBar(metadata: Record<string, string> | undefined): string {
  const entries = Object.entries(metadata ?? {}).filter(
    ([key, value]) => key.length > 0 && value.length > 0,
  );
  if (entries.length === 0) return '';

  const items = entries
    .map(
      ([key, value]) =>
        `<span class="tolkira-meta-item"><strong>${escapeHtml(key)}</strong>: ${escapeHtml(value)}</span>`,
    )
    .join('');

  return `<div class="tolkira-meta">${items}</div>`;
}

const META_STYLE = `<style>
.tolkira-meta{display:flex;flex-wrap:wrap;gap:8px 20px;padding:12px 20px;border-bottom:1px solid #e5e5e5;font:13px/1.4 system-ui,sans-serif;color:#333;background:#fafafa}
.tolkira-meta-item{white-space:nowrap}
@media (prefers-color-scheme:dark){.tolkira-meta{background:#1f1f1f;border-color:#333;color:#ddd}}
</style>`;

export async function renderHtml(envelopes: Envelope[], options: RenderOptions): Promise<string> {
  const chunks: Buffer[] = [];

  const sink = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });

  await pipeline(Readable.from(envelopes), new CucumberHtmlStream(), sink);

  let html = Buffer.concat(chunks).toString('utf8');
  html = html.replace(
    '<title>Cucumber</title>',
    () => `<title>${escapeHtml(options.title)}</title>`,
  );

  const bar = metadataBar(options.metadata);
  if (bar) {
    html = html.replace('</head>', `${META_STYLE}</head>`);
    html = html.replace('<div id="content">', `${bar}<div id="content">`);
  }

  return html;
}
