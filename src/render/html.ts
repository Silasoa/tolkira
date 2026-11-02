import { CucumberHtmlStream } from '@cucumber/html-formatter';
import type { Envelope } from '@cucumber/messages';
import { createHash } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { sanitizeEnvelopes } from '../input/sanitize.js';
import type { ReportSummary } from '../summary.js';
import { summarizeEnvelopes } from '../summary.js';
import { isLogoDataUri, isValidAccent } from '../validation.js';
import { escapeHtml } from './escape.js';

export interface RenderOptions {
  title: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
  summary?: ReportSummary;
}




function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

function summaryLine(summary: ReportSummary): string {
  const { scenarios } = summary.counts;
  const parts = [
    `${scenarios.total} ${scenarios.total === 1 ? 'scenario' : 'scenarios'}`,
    `${scenarios.passed} passed`,
  ];
  if (scenarios.failed > 0) parts.push(`${scenarios.failed} failed`);
  if (scenarios.skipped > 0) parts.push(`${scenarios.skipped} skipped`);
  if (scenarios.pending > 0) parts.push(`${scenarios.pending} pending`);
  if (scenarios.undefined > 0) parts.push(`${scenarios.undefined} undefined`);
  if (scenarios.ambiguous > 0) parts.push(`${scenarios.ambiguous} ambiguous`);
  if (scenarios.unknown > 0) parts.push(`${scenarios.unknown} unknown`);
  parts.push(formatDuration(summary.durationMs));
  if (summary.attachments.total > 0) {
    parts.push(
      `${summary.attachments.total} ${summary.attachments.total === 1 ? 'attachment' : 'attachments'}`,
    );
  }
  return parts.join(' · ');
}

function metadataItems(metadata: Record<string, string> | undefined): string {
  return Object.entries(metadata ?? {})
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .map(
      ([key, value]) =>
        `<span class="tolkira-meta-item"><strong>${escapeHtml(key)}</strong>: ${escapeHtml(value)}</span>`,
    )
    .join('');
}

function reportHeader(
  title: string,
  summary: ReportSummary,
  metadata: Record<string, string> | undefined,
  logo: string | undefined,
): string {
  const items = metadataItems(metadata);
  const logoMarkup = isLogoDataUri(logo)
    ? `<img class="tolkira-logo" src="${escapeHtml(logo)}" alt="">`
    : '';
  return `<header class="tolkira-header">
<div class="tolkira-brand">${logoMarkup}<div>
<h1 class="tolkira-title">${escapeHtml(title)}</h1>
<p class="tolkira-summary tolkira-summary-${summary.status}">${escapeHtml(summaryLine(summary))}</p>
</div></div>
${items ? `<div class="tolkira-meta">${items}</div>` : ''}
</header>`;
}

const CSP = (scriptHashes: string[]): string =>
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src ${scriptHashes.join(' ') || "'none'"}; script-src-attr 'none'; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;

function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const content = match[1] ?? '';
    hashes.add(
      `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`,
    );
  }
  return [...hashes];
}

const SHELL_STYLE = `<style>
.tolkira-header{padding:18px 20px;border-top:4px solid var(--tolkira-accent,#1b5e20);border-bottom:1px solid #e5e5e5;background:#fafafa;font-family:system-ui,sans-serif;color:#222}
.tolkira-brand{display:flex;align-items:center;gap:14px}
.tolkira-logo{display:block;max-height:48px;max-width:160px;object-fit:contain}
.tolkira-title{margin:0 0 6px;font-size:22px;line-height:1.25}
.tolkira-summary{margin:0;font-size:14px;line-height:1.4;color:#444}
.tolkira-summary-failed{color:#a4161a}
.tolkira-summary-passed{color:#1b5e20}
.tolkira-meta{display:flex;flex-wrap:wrap;gap:6px 20px;margin-top:10px;font-size:13px;line-height:1.4}
.tolkira-meta-item{white-space:nowrap}
@media (prefers-color-scheme:dark){.tolkira-header{background:#1f1f1f;border-color:#333;color:#e8e8e8}.tolkira-summary{color:#bbb}.tolkira-summary-failed{color:#ff8a80}.tolkira-summary-passed{color:#8fd694}}
</style>`;

export async function renderHtml(envelopes: Envelope[], options: RenderOptions): Promise<string> {
  const safeEnvelopes = sanitizeEnvelopes(envelopes);
  const summary = options.summary ?? summarizeEnvelopes(safeEnvelopes);
  const chunks: Buffer[] = [];

  const sink = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });

  await pipeline(Readable.from(safeEnvelopes), new CucumberHtmlStream(), sink);

  let html = Buffer.concat(chunks).toString('utf8');
  html = html.replace(
    '<title>Cucumber</title>',
    () => `<title>${escapeHtml(options.title)}</title>`,
  );

  const header = reportHeader(
    options.title,
    summary,
    options.metadata,
    options.logo,
  );
  const accentStyle = isValidAccent(options.accent)
    ? `<style>:root{--tolkira-accent:${options.accent}}</style>`
    : '';
  html = html.replace(
    '</head>',
    () => `${CSP(inlineScriptHashes(html))}${SHELL_STYLE}${accentStyle}</head>`,
  );
  if (html.includes('<div id="content">')) {
    html = html.replace('<div id="content">', () => `${header}<div id="content">`);
  } else {
    html = html.replace('</body>', () => `${header}</body>`);
  }

  return html;
}
