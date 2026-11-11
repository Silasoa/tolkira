/** Text attachments above this size render as escaped text without parsing. */
export const MAX_TEXT_ATTACHMENT_BYTES = 262_144;

export const MEDIA_EXTENSIONS: Record<string, string> = {
  'application/json': 'json',
  'application/octet-stream': 'bin',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/plain': 'txt',
  'text/uri-list': 'txt',
  'text/x.cucumber.log+plain': 'log',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export function normalizedMediaType(mediaType: string): string {
  return mediaType.split(';')[0]?.trim().toLowerCase() ?? '';
}
