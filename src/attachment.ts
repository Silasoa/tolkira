import { AttachmentContentEncoding } from '@cucumber/messages';
import type { Attachment } from '@cucumber/messages';

/** Per-attachment cap; the sanitizer checks decoded bytes, the Playwright adapter checks file size. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
/** Total attachment cap; the sanitizer applies it per report, the Playwright adapter per input. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 100 * 1024 * 1024;
/** Report-wide cap for one earlier-attempt image; never part of the final counts. */
export const MAX_RETRY_EVIDENCE_BYTES = 10 * 1024 * 1024;
/** Text attachments above this size skip JSON pretty-printing and ANSI colouring. */
export const MAX_TEXT_ATTACHMENT_BYTES = 262_144;

/** Whether one earlier-attempt image fits the evidence budget and the total cap. */
export function retryEvidenceFits(
  totalAttachmentBytes: number,
  retryEvidenceBytes: number,
  size: number,
): boolean {
  return (
    size <= MAX_RETRY_EVIDENCE_BYTES - retryEvidenceBytes &&
    totalAttachmentBytes + size <= MAX_TOTAL_ATTACHMENT_BYTES
  );
}

export type AttachmentKind = 'image' | 'video' | 'audio' | 'text' | 'binary';
export type AttachmentTextFormat = 'json' | 'uri-list' | 'log' | 'plain';

export interface AttachmentMetadata {
  /** Allowlisted media type. */
  mediaType: string;
  kind: AttachmentKind;
  /** Non-empty Cucumber file name; otherwise the deterministic fallback. */
  fileName: string;
  /** Decoded bytes, not the base64 length. */
  bytes: number;
  /** Text presentation the renderer uses. */
  textFormat: AttachmentTextFormat;
}

interface MediaTypeInfo {
  extension: string;
  kind: AttachmentKind;
  textFormat: AttachmentTextFormat;
}

const DEFAULT_MEDIA_TYPE: MediaTypeInfo = {
  extension: 'bin',
  kind: 'binary',
  textFormat: 'plain',
};

const MEDIA_TYPES: Record<string, MediaTypeInfo> = {
  'application/json': { extension: 'json', kind: 'text', textFormat: 'json' },
  'application/octet-stream': { extension: 'bin', kind: 'binary', textFormat: 'plain' },
  'image/gif': { extension: 'gif', kind: 'image', textFormat: 'plain' },
  'image/jpeg': { extension: 'jpg', kind: 'image', textFormat: 'plain' },
  'image/png': { extension: 'png', kind: 'image', textFormat: 'plain' },
  'image/svg+xml': { extension: 'svg', kind: 'image', textFormat: 'plain' },
  'image/webp': { extension: 'webp', kind: 'image', textFormat: 'plain' },
  'text/csv': { extension: 'csv', kind: 'text', textFormat: 'plain' },
  'text/html': { extension: 'html', kind: 'text', textFormat: 'plain' },
  'text/plain': { extension: 'txt', kind: 'text', textFormat: 'plain' },
  'text/uri-list': { extension: 'txt', kind: 'text', textFormat: 'uri-list' },
  'text/x.cucumber.log+plain': { extension: 'log', kind: 'text', textFormat: 'log' },
  'video/mp4': { extension: 'mp4', kind: 'video', textFormat: 'plain' },
  'video/webm': { extension: 'webm', kind: 'video', textFormat: 'plain' },
};

// `text/html` is only ever rendered as escaped text inside <pre>, never as
// markup. `image/svg+xml` is only used as an <img> data-URI source, where
// scripts do not run. Neither type reaches the document as HTML.

export function normalizedMediaType(mediaType: string): string {
  return mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
}

const SAFE_MEDIA_TYPES = new Set(Object.keys(MEDIA_TYPES));

/**
 * Normalises a declared media type and drops everything outside the report's
 * renderer list. Unknown or forged types (XHTML, XML, comma-joined values)
 * become application/octet-stream so they can never reach a data URI verbatim.
 */
export function safeMediaType(mediaType: string): string {
  const base = normalizedMediaType(mediaType || '');
  return SAFE_MEDIA_TYPES.has(base) ? base : 'application/octet-stream';
}

/**
 * Counts canonical base64 decoded bytes without decoding; non-canonical bodies
 * keep the length-based estimate. This is the summary's `attachments.bytes`.
 */
export function attachmentBytes(
  attachment: Pick<Attachment, 'body' | 'contentEncoding'>,
): number {
  const body = attachment.body ?? '';
  if (attachment.contentEncoding === AttachmentContentEncoding.BASE64) {
    const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
  }
  return Buffer.byteLength(body, 'utf8');
}

export function attachmentMetadata(
  attachment: Pick<
    Attachment,
    'body' | 'contentEncoding' | 'fileName' | 'mediaType'
  >,
): AttachmentMetadata {
  const mediaType = safeMediaType(
    attachment.mediaType || 'application/octet-stream',
  );
  const info = MEDIA_TYPES[mediaType] ?? DEFAULT_MEDIA_TYPE;
  return {
    mediaType,
    kind: info.kind,
    fileName: attachment.fileName || `attachment.${info.extension}`,
    bytes: attachmentBytes(attachment),
    textFormat: info.textFormat,
  };
}
