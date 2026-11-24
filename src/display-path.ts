export interface PathAnalysis {
  absolute: boolean;
  /** The URI with backslashes normalised and the file scheme removed. */
  path: string;
  /** Absolute-path segments after the drive, mount and home rules. */
  parts: string[];
}

const DRIVE = /^[a-z]:\//i;
const DRIVE_TOKEN = /^[a-z]:$/i;
// The privacy rule covers an absolute path or file URL, so a home segment is
// dropped wherever it appears, not only at the start.
const HOME_SEGMENT = /^(?:Users|home|Documents and Settings)$/i;

export function analyzePath(uri: string): PathAnalysis {
  let path = uri.replace(/\\/g, '/');
  if (/^file:/i.test(path)) {
    const rest = path.slice('file:'.length);
    if (rest.startsWith('//')) {
      const afterAuthority = rest.slice(2);
      const slash = afterAuthority.indexOf('/');
      const authority =
        slash === -1 ? afterAuthority : afterAuthority.slice(0, slash);
      const tail = slash === -1 ? '' : afterAuthority.slice(slash);
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
  const splitPath = path.replace(/%2f|%5c/gi, '/');
  const absolute = DRIVE.test(splitPath) || path.startsWith('/');
  if (!absolute) return { absolute, path, parts: [] };

  const parts = splitPath.split('/').filter(Boolean);
  if (DRIVE_TOKEN.test(parts[0] ?? '')) parts.shift();
  // /mnt/<drive> is the WSL mount form of a Windows path.
  if (
    parts.length > 1 &&
    /^mnt$/i.test(parts[0] ?? '') &&
    /^[a-z]$/i.test(parts[1] ?? '')
  ) {
    parts.splice(0, 2);
  }
  let home = parts.findIndex((part) => HOME_SEGMENT.test(part));
  while (home !== -1 && home + 1 < parts.length) {
    parts.splice(home, 2);
    home = parts.findIndex((part) => HOME_SEGMENT.test(part));
  }
  return { absolute, path, parts };
}
