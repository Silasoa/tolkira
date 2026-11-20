import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentContentEncoding } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_TEXT_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  attachmentBytes,
  attachmentMetadata,
  normalizedMediaType,
  safeMediaType,
} from '../src/attachment.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function bytes(
  body: string | undefined,
  contentEncoding: AttachmentContentEncoding,
): number {
  // The Messages type requires a body, but parsed input can omit it; the byte
  // function guards with `?? ''` for that case.
  const attachment = {
    body,
    contentEncoding,
  } as Parameters<typeof attachmentBytes>[0];
  return attachmentBytes(attachment);
}

function mediaRow(mediaType: string, fileName = '') {
  const {
    mediaType: safeType,
    fileName: safeFileName,
    kind,
    textFormat,
  } = attachmentMetadata({
    body: '',
    contentEncoding: AttachmentContentEncoding.IDENTITY,
    fileName,
    mediaType,
  });
  return {
    mediaType: safeType,
    fileName: safeFileName,
    kind,
    textFormat,
  };
}

describe('attachment bytes', () => {
  it.each<[string, string | undefined, AttachmentContentEncoding, number]>([
    ['an empty identity body', '', AttachmentContentEncoding.IDENTITY, 0],
    ['an empty base64 body', '', AttachmentContentEncoding.BASE64, 0],
    ['a missing identity body', undefined, AttachmentContentEncoding.IDENTITY, 0],
    ['a missing base64 body', undefined, AttachmentContentEncoding.BASE64, 0],
    ['a padding-only base64 body', '=', AttachmentContentEncoding.BASE64, 0],
    ['an identity ASCII body', 'abc', AttachmentContentEncoding.IDENTITY, 3],
    ['an identity two-byte UTF-8 body', 'é', AttachmentContentEncoding.IDENTITY, 2],
    ['an identity four-byte UTF-8 body', '🚀', AttachmentContentEncoding.IDENTITY, 4],
    ['a base64 body without padding', 'YWJj', AttachmentContentEncoding.BASE64, 3],
    ['a base64 body with one padding character', 'YWI=', AttachmentContentEncoding.BASE64, 2],
    ['a base64 body with two padding characters', 'YQ==', AttachmentContentEncoding.BASE64, 1],
    [
      'a canonical base64 body whose encoded length differs from its decoded length',
      'cGF5bG9hZA==',
      AttachmentContentEncoding.BASE64,
      7,
    ],
  ])('%s', (_name, body, contentEncoding, expected) => {
    expect(bytes(body, contentEncoding)).toBe(expected);
  });

  it('pins the shared attachment caps', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(50 * 1024 * 1024);
    expect(MAX_ATTACHMENT_BYTES).toBe(52_428_800);
    expect(MAX_TOTAL_ATTACHMENT_BYTES).toBe(100 * 1024 * 1024);
    expect(MAX_TOTAL_ATTACHMENT_BYTES).toBe(104_857_600);
    expect(MAX_TEXT_ATTACHMENT_BYTES).toBe(262_144);
  });
});

describe('media type normalisation', () => {
  it.each<[string, string]>([
    [' Image/PNG; charset=utf-8 ', 'image/png'],
    ['text/plain', 'text/plain'],
    ['', ''],
  ])('normalizedMediaType(%j) is %j', (mediaType, expected) => {
    expect(normalizedMediaType(mediaType)).toBe(expected);
  });

  it.each<[string, string]>([
    ['IMAGE/PNG; charset=utf-8', 'image/png'],
    ['text/markdown', 'application/octet-stream'],
    ['application/javascript', 'application/octet-stream'],
    ['constructor', 'application/octet-stream'],
  ])('safeMediaType(%j) is %j', (mediaType, expected) => {
    expect(safeMediaType(mediaType)).toBe(expected);
  });
});

describe('attachment metadata', () => {
  it.each<[string, string, string, string]>([
    ['application/json', 'attachment.json', 'text', 'json'],
    ['application/octet-stream', 'attachment.bin', 'binary', 'plain'],
    ['image/gif', 'attachment.gif', 'image', 'plain'],
    ['image/jpeg', 'attachment.jpg', 'image', 'plain'],
    ['image/png', 'attachment.png', 'image', 'plain'],
    ['image/svg+xml', 'attachment.svg', 'image', 'plain'],
    ['image/webp', 'attachment.webp', 'image', 'plain'],
    ['text/csv', 'attachment.csv', 'text', 'plain'],
    ['text/html', 'attachment.html', 'text', 'plain'],
    ['text/plain', 'attachment.txt', 'text', 'plain'],
    ['text/uri-list', 'attachment.txt', 'text', 'uri-list'],
    ['text/x.cucumber.log+plain', 'attachment.log', 'text', 'log'],
    ['video/mp4', 'attachment.mp4', 'video', 'plain'],
    ['video/webm', 'attachment.webm', 'video', 'plain'],
  ])(
    '%s maps to %s with %s kind and %s text format',
    (mediaType, fileName, kind, textFormat) => {
      expect(mediaRow(mediaType)).toEqual({
        mediaType,
        fileName,
        kind,
        textFormat,
      });
    },
  );

  it.each<[string, string, string, string]>([
    ['keeps a non-empty file name unchanged', 'image/png', 'screen.png', 'screen.png'],
    [
      'falls back to attachment.<ext> for an empty file name',
      'image/png',
      '',
      'attachment.png',
    ],
    [
      'falls back to attachment.bin for an empty file name and unknown type',
      'application/vnd.acme.widget',
      '',
      'attachment.bin',
    ],
    ['does not trim whitespace', 'text/plain', '   ', '   '],
    [
      'preserves a path-like name for the renderer to escape',
      'text/html',
      '..\\secrets\\report.html',
      '..\\secrets\\report.html',
    ],
  ])('%s', (_name, mediaType, fileName, expected) => {
    expect(mediaRow(mediaType, fileName).fileName).toBe(expected);
  });

  it.each<[string, string, string, string, string, string]>([
    [
      'application/json; charset=utf-8',
      'application/json; charset=utf-8',
      'application/json',
      'attachment.json',
      'text',
      'json',
    ],
    [
      'image/png; charset=utf-8',
      'image/png; charset=utf-8',
      'image/png',
      'attachment.png',
      'image',
      'plain',
    ],
    [
      'application/xhtml+xml',
      'application/xhtml+xml',
      'application/octet-stream',
      'attachment.bin',
      'binary',
      'plain',
    ],
    [
      'application/xml',
      'application/xml',
      'application/octet-stream',
      'attachment.bin',
      'binary',
      'plain',
    ],
    [
      'image/png, text/html',
      'image/png, text/html',
      'application/octet-stream',
      'attachment.bin',
      'binary',
      'plain',
    ],
    [
      'application/vnd.acme.widget',
      'application/vnd.acme.widget',
      'application/octet-stream',
      'attachment.bin',
      'binary',
      'plain',
    ],
    [
      'audio/mpeg',
      'audio/mpeg',
      'application/octet-stream',
      'attachment.bin',
      'binary',
      'plain',
    ],
    [
      'text/markdown',
      'text/markdown',
      'application/octet-stream',
      'attachment.bin',
      'binary',
      'plain',
    ],
    [
      'application/javascript',
      'application/javascript',
      'application/octet-stream',
      'attachment.bin',
      'binary',
      'plain',
    ],
    [
      'text/xml',
      'text/xml',
      'application/octet-stream',
      'attachment.bin',
      'binary',
      'plain',
    ],
  ])(
    '%s collapses to safe metadata',
    (
      _name,
      declaredType,
      expectedMediaType,
      expectedFileName,
      expectedKind,
      expectedTextFormat,
    ) => {
      expect(mediaRow(declaredType)).toEqual({
        mediaType: expectedMediaType,
        fileName: expectedFileName,
        kind: expectedKind,
        textFormat: expectedTextFormat,
      });
    },
  );
});

function sourceFiles(dir = SRC, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      return sourceFiles(join(dir, entry.name), `${relative}/`);
    }
    return entry.name.endsWith('.ts') ? [relative] : [];
  });
}

// Generated assets are built files, not attachment logic; only hand-written
// modules are scanned.
const GENERATED = new Set([
  'i18n/catalogs.ts',
  'render/client-bundle.ts',
  'render/styles.ts',
]);

// Read once per file. This is a coarse structural guard; the behavioural byte,
// metadata and cap tests are the real proof.
const SOURCES = new Map(
  sourceFiles()
    .filter((file) => !GENERATED.has(file))
    .map((file) => [file, readFileSync(join(SRC, file), 'utf8')] as const),
);

function filesMatching(pattern: RegExp): string[] {
  return [...SOURCES]
    .filter(([, source]) => pattern.test(source))
    .map(([file]) => file)
    .sort();
}

describe('attachment module ownership', () => {
  it('computes base64 sizes in exactly one module', () => {
    expect(filesMatching(/\*\s*3\s*\)\s*\/\s*4/)).toEqual(['attachment.ts']);
  });

  it('declares the 50 MB cap in exactly one module', () => {
    expect(filesMatching(/50\s*\*\s*1024\s*\*\s*1024/)).toEqual([
      'attachment.ts',
    ]);
  });

  it('declares the 100 MB attachment cap only in the shared module and the loader', () => {
    // src/input/load.ts keeps the separate 100 MB total-input cap, out of scope.
    expect(filesMatching(/100\s*\*\s*1024\s*\*\s*1024/)).toEqual([
      'attachment.ts',
      'input/load.ts',
    ]);
  });
});
