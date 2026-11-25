interface PathAnalysis {
  absolute: boolean;
  /** The URI with backslashes normalised and the file scheme removed. */
  path: string;
  /** Absolute-path segments after the drive, mount, dot and home rules. */
  parts: string[];
}

const DRIVE = /^[a-z]:\//i;
const DRIVE_TOKEN = /^[a-z]:$/i;
// The privacy rule covers an absolute path or file URL, so a home segment is
// dropped wherever it appears, not only at the start.
const HOME_SEGMENT = /^(?:Users|home|Documents and Settings)$/i;

// Only the home comparison decodes; the displayed segment keeps its original
// encoding, and a malformed escape stays literal.
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function analyzePath(uri: string): PathAnalysis {
  let path = uri.replaceAll('\\', '/');
  if (/^file:/i.test(path)) {
    const rest = path.slice('file:'.length);
    if (rest.startsWith('//')) {
      const afterAuthority = rest.slice(2);
      const slash = afterAuthority.indexOf('/');
      let authority =
        slash === -1 ? afterAuthority : afterAuthority.slice(0, slash);
      const tail = slash === -1 ? '' : afterAuthority.slice(slash);
      // Userinfo is credentials, not a host: only the part after the last `@`
      // is compared with localhost.
      const at = authority.lastIndexOf('@');
      if (at !== -1) authority = authority.slice(at + 1);
      // localhost is the local machine; any other host is a path segment, not
      // a local user directory.
      path = /^localhost$/i.test(authority) ? tail : `/${authority}${tail}`;
    } else {
      path = rest;
    }
  }
  // The file-URL spelling of a drive path.
  path = path.replace(/^\/([a-z]:\/)/i, '$1');
  // A URL-escaped separator still separates the parts for the absolute check
  // and the home rule; the path text itself stays as written.
  const splitPath = path.replaceAll(/%2f|%5c/gi, '/');
  const absolute = DRIVE.test(splitPath) || splitPath.startsWith('/');
  if (!absolute) return { absolute, path, parts: [] };

  const segments: Array<{ raw: string; decoded: string }> = [];
  for (const part of splitPath.split('/').filter(Boolean)) {
    const decoded = decodeSegment(part);
    // Dot segments are path syntax, not names: resolve them before the home
    // rule so `/home/./<user>` and `/home/<user>/..` cannot hide a pair.
    if (decoded === '.') continue;
    if (decoded === '..') {
      segments.pop();
      continue;
    }
    segments.push({ raw: part, decoded });
  }
  if (DRIVE_TOKEN.test(segments[0]?.raw ?? '')) segments.shift();
  // /mnt/<drive> is the WSL mount form of a Windows path.
  if (
    segments.length > 1 &&
    /^mnt$/i.test(segments[0]?.raw ?? '') &&
    /^[a-z]$/i.test(segments[1]?.raw ?? '')
  ) {
    segments.splice(0, 2);
  }
  // One linear pass: a home segment consumes the next segment, which also
  // matches adjacent home segments.
  const parts: string[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    if (HOME_SEGMENT.test(segment.decoded)) {
      index += 1;
    } else {
      parts.push(segment.raw);
    }
  }
  return { absolute, path, parts };
}
