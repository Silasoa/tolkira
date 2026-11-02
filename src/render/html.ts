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
    `${summary.counts.features} ${summary.counts.features === 1 ? 'feature' : 'features'}`,
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
</div><div class="tolkira-actions">
<button type="button" class="tolkira-action" data-tolkira-action="expand">Expand all</button>
<button type="button" class="tolkira-action" data-tolkira-action="collapse">Collapse all</button>
</div></div>
<p id="tolkira-live" class="tolkira-sr" role="status" aria-live="polite" data-total="${summary.counts.scenarios.total}"></p>
${items ? `<div class="tolkira-meta">${items}</div>` : ''}
</header>`;
}

const SHELL_SCRIPT = `<script>
(function () {
  function featureButtons() {
    return Array.prototype.slice.call(
      document.querySelectorAll('button[aria-expanded]')
    ).filter(function (button) {
      return !button.hasAttribute('data-tolkira-action');
    });
  }
  function imageDetails() {
    return Array.prototype.slice.call(document.querySelectorAll('details')).filter(function (details) {
      return details.querySelector('img[src^="data:image/"]');
    });
  }
  function setAll(open) {
    featureButtons().forEach(function (button) {
      if ((button.getAttribute('aria-expanded') === 'true') !== open) button.click();
    });
    function setDetails() {
      imageDetails().forEach(function (details) {
        if (details.open !== open) {
          var summary = details.querySelector('summary');
          if (summary) summary.click();
        }
      });
    }
    if (open) setTimeout(setDetails, 100); else setDetails();
  }
  function action(name) {
    return document.querySelector('[data-tolkira-action="' + name + '"]');
  }
  function wire() {
    var expand = action('expand');
    var collapse = action('collapse');
    if (!expand || !collapse || expand.dataset.tolkiraWired) return;
    expand.dataset.tolkiraWired = 'true';
    collapse.dataset.tolkiraWired = 'true';
    expand.addEventListener('click', function () { setAll(true); });
    collapse.addEventListener('click', function () { setAll(false); });
  }
  function openImages() {
    imageDetails().forEach(function (details) {
      if (details.dataset.tolkiraAutoOpened) return;
      details.dataset.tolkiraAutoOpened = 'true';
      if (!details.open) {
        var summary = details.querySelector('summary');
        if (summary) summary.click();
      }
    });
  }
  function labelStatusIcons() {
    Array.prototype.slice.call(document.querySelectorAll('svg[data-status]')).forEach(function (icon) {
      icon.removeAttribute('aria-hidden');
      icon.setAttribute('role', 'img');
      icon.setAttribute('aria-label', 'Status: ' + String(icon.getAttribute('data-status') || 'unknown').toLowerCase());
    });
  }
  function labelLinks() {
    Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]')).forEach(function (link) {
      if (link.getAttribute('aria-label') || link.textContent.trim()) return;
      var target = document.getElementById(link.getAttribute('href').slice(1));
      var name = target && target.textContent ? target.textContent.trim().slice(0, 80) : 'section';
      link.setAttribute('aria-label', 'Link to ' + (name || 'section'));
    });
  }
  function labelImages() {
    Array.prototype.slice.call(document.querySelectorAll('details img[src^="data:image/"]')).forEach(function (image) {
      if (image.alt) return;
      var details = image.closest('details');
      var summary = details && details.querySelector('summary');
      image.alt = 'Attachment: ' + ((summary && summary.textContent.trim()) || 'image');
    });
  }
  var announceTimer;
  function announce() {
    labelStatusIcons();
    labelLinks();
    labelImages();
    openImages();
    var live = document.getElementById('tolkira-live');
    if (!live) return;
    var total = Number(live.getAttribute('data-total') || 0);
    var visible = Array.prototype.slice.call(document.querySelectorAll('#content h2')).filter(function (heading) {
      return /^Scenario:/.test(heading.textContent.trim()) && heading.offsetParent !== null;
    }).length;
    live.textContent = visible + ' of ' + total + ' scenarios visible';
  }
  function scheduleAnnounce() {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(announce, 300);
  }
  function observe() {
    var content = document.getElementById('content');
    if (!content || content.dataset.tolkiraObserved) return;
    content.dataset.tolkiraObserved = 'true';
    if (window.MutationObserver) {
      new MutationObserver(scheduleAnnounce).observe(content, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-expanded', 'hidden', 'class', 'style']
      });
    }
  }
  function boot() {
    wire();
    observe();
    labelStatusIcons();
    labelLinks();
    labelImages();
    openImages();
    scheduleAnnounce();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', boot);
  setTimeout(boot, 100);
})();
</script>`;

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
.tolkira-actions{display:flex;gap:8px;margin-left:auto}
.tolkira-action{border:1px solid #bbb;border-radius:4px;background:#fff;color:#222;padding:6px 10px;font:12px/1.2 system-ui,sans-serif;cursor:pointer}
.tolkira-action:hover,.tolkira-action:focus-visible{border-color:var(--tolkira-accent,#1b5e20);outline:2px solid var(--tolkira-accent,#1b5e20);outline-offset:1px}
.tolkira-title{margin:0 0 6px;font-size:22px;line-height:1.25}
.tolkira-summary{margin:0;font-size:14px;line-height:1.4;color:#444}
.tolkira-summary-failed{color:#a4161a}
.tolkira-summary-passed{color:#1b5e20}
.tolkira-meta{display:flex;flex-wrap:wrap;gap:6px 20px;margin-top:10px;font-size:13px;line-height:1.4}
.tolkira-meta-item{white-space:nowrap}
.tolkira-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (max-width:480px){.tolkira-brand{flex-wrap:wrap}.tolkira-actions{margin-left:0}#content{max-width:100%;box-sizing:border-box}#content *{max-width:100%;box-sizing:border-box}#content form,#content form ul,#content form div{flex-wrap:wrap}#content form input{min-width:0}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
@media (prefers-color-scheme:dark){.tolkira-header{background:#1f1f1f;border-bottom-color:#333;color:#e8e8e8}.tolkira-summary{color:#bbb}.tolkira-summary-failed{color:#ff8a80}.tolkira-summary-passed{color:#8fd694}.tolkira-action{background:#2a2a2a;border-color:#555;color:#eee}.tolkira-action:focus-visible{outline-color:#8fd694}}
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
  if (html.includes('<div id="content">')) {
    html = html.replace(
      '<div id="content">',
      () => `${header}<div id="content" role="main">`,
    );
  } else {
    html = html.replace('</body>', () => `${header}</body>`);
  }
  html = html.replace('</body>', () => `${SHELL_SCRIPT}</body>`);
  html = html.replace(
    '</head>',
    () => `${CSP(inlineScriptHashes(html))}${SHELL_STYLE}${accentStyle}</head>`,
  );

  return html;
}
