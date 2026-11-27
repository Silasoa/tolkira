import { MAX_TEXT_ATTACHMENT_BYTES } from '../attachment.js';
import type { ReportAttachment } from '../report/model.js';
import { renderAnsiLog } from './ansi.js';
import { escapeHtml } from './escape.js';
import { safeHttpUrl } from './format.js';
import type { Translator } from './i18n.js';

interface JsonFrame {
  opener: '{' | '[';
  hasItems: boolean;
}

// Formats valid JSON without re-serialising parsed values, so big numbers and
// duplicate keys survive unchanged.
function prettyJson(text: string): string | undefined {
  try {
    JSON.parse(text);
  } catch {
    return undefined;
  }
  const out: string[] = [];
  const stack: JsonFrame[] = [];
  let inString = false;
  let escaped = false;
  const openItem = (): void => {
    const top = stack[stack.length - 1];
    if (top && !top.hasItems) {
      out.push('\n', '  '.repeat(stack.length));
      top.hasItems = true;
    }
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (inString) {
      out.push(character);
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      openItem();
      out.push(character);
      inString = true;
      continue;
    }
    if (character === '{' || character === '[') {
      openItem();
      out.push(character);
      stack.push({ opener: character, hasItems: false });
      continue;
    }
    if (character === '}' || character === ']') {
      const frame = stack.pop();
      if (!frame) return undefined;
      if (
        (frame.opener === '{' && character !== '}') ||
        (frame.opener === '[' && character !== ']')
      ) {
        return undefined;
      }
      if (frame.hasItems) out.push('\n', '  '.repeat(stack.length));
      out.push(character);
      continue;
    }
    if (character === ',') {
      out.push(',', '\n', '  '.repeat(stack.length));
      continue;
    }
    if (character === ':') {
      out.push(': ');
      continue;
    }
    if (
      character === ' ' ||
      character === '\n' ||
      character === '\r' ||
      character === '\t'
    ) {
      continue;
    }
    let end = index;
    while (end < text.length && !/[\s,\]}:]/.test(text[end] ?? '')) {
      end += 1;
    }
    openItem();
    out.push(text.slice(index, end));
    index = end - 1;
  }
  return stack.length === 0 && !inString ? out.join('') : undefined;
}

function jsonBody(text: string): string {
  return prettyJson(text) ?? text;
}

function uriListBody(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const label = line.trim();
      const href = safeHttpUrl(label);
      return href
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
        : escapeHtml(line);
    })
    .join('\n');
}

function textAttachmentBody(
  attachment: ReportAttachment,
  t: Translator,
  staticMode: boolean,
): string {
  const text = attachment.text ?? '';
  if (attachment.textFormat === 'json') {
    const body =
      Buffer.byteLength(text, 'utf8') > MAX_TEXT_ATTACHMENT_BYTES
        ? text
        : jsonBody(text);
    return `<pre>${escapeHtml(body)}</pre>`;
  }
  if (attachment.textFormat === 'uri-list') {
    return `<pre>${uriListBody(text)}</pre>`;
  }
  if (attachment.textFormat === 'log') {
    const name = escapeHtml(attachment.fileName);
    const tools = staticMode
      ? ''
      : `<div class="logTools"><button class="copyLog" type="button" data-copy-log aria-label="${t.t('attachment.copyLogLabel', { name })}" hidden>${t.t('attachment.copyLog')}</button></div>`;
    return `${tools}<pre class="ansiLog">${renderAnsiLog(text)}</pre>`;
  }
  return `<pre>${escapeHtml(text)}</pre>`;
}

export function renderAttachment(
  attachment: ReportAttachment,
  context: string | undefined,
  t: Translator,
  staticMode = false,
  open = false,
): string {
  const name = escapeHtml(attachment.fileName);
  const media = escapeHtml(attachment.mediaType);
  const label = context
    ? t.t('attachment.screenshotFor', {
        context: escapeHtml(context),
        name,
      })
    : t.t('attachment.attachmentName', { name });
  if (attachment.kind === 'image' && attachment.dataUri) {
    const image = `<img class="shot" src="${escapeHtml(attachment.dataUri)}" alt="${label} (${media})">`;
    return `<figure class="attachment">${staticMode ? image : `<button class="shotButton" type="button" aria-label="${t.t('attachment.viewFullSize', { label })}">${image}</button>`}<figcaption>${name} (${media})</figcaption></figure>`;
  }
  if (attachment.kind === 'video' && attachment.dataUri) {
    return `<figure class="attachment"><video class="shot" controls src="${escapeHtml(attachment.dataUri)}"></video><figcaption>${name} (${media})</figcaption></figure>`;
  }
  if (attachment.kind === 'audio' && attachment.dataUri) {
    return `<figure class="attachment"><audio controls src="${escapeHtml(attachment.dataUri)}"></audio><figcaption>${name} (${media})</figcaption></figure>`;
  }
  if (attachment.kind === 'text' && attachment.text !== undefined) {
    return `<details class="attachmentText"${staticMode || open ? ' open' : ''}><summary>${name} (${media})</summary>${textAttachmentBody(attachment, t, staticMode)}</details>`;
  }
  const bytes = t.t('format.bytes', { count: attachment.bytes });
  if (attachment.dataUri) {
    return `<a class="fileLink" href="${escapeHtml(attachment.dataUri)}" download="${name}">${name} (${media}, ${bytes})</a>`;
  }
  return `<span class="fileLink">${name} (${media}, ${bytes})</span>`;
}
