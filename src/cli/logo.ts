import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_MIME: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export async function readLogo(file: string): Promise<string> {
  const extension = path.extname(file).toLowerCase();
  const mime = LOGO_MIME[extension];
  if (!mime) {
    throw new Error(
      `Unsupported logo type "${extension}". Use PNG, JPEG, GIF, WebP or SVG.`,
    );
  }
  const info = await stat(file);
  if (info.size > MAX_LOGO_BYTES) {
    throw new Error('Logo is larger than 2 MB.');
  }
  const data = await readFile(file);
  let valid = false;
  switch (extension) {
    case '.png':
      valid = data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
      break;
    case '.jpg':
    case '.jpeg':
      valid = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
      break;
    case '.gif':
      valid = data.subarray(0, 4).toString('ascii') === 'GIF8';
      break;
    case '.webp':
      valid =
        data.subarray(0, 4).toString('ascii') === 'RIFF' &&
        data.subarray(8, 12).toString('ascii') === 'WEBP';
      break;
    case '.svg':
      valid =
        /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!DOCTYPE[\s\S]*?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(
          data.toString('utf8', 0, 1024),
        );
      break;
  }
  if (!valid) {
    throw new Error(
      `Logo content does not match the "${extension}" extension.`,
    );
  }
  return `data:${mime};base64,${data.toString('base64')}`;
}
