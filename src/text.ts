const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;
// ESC, C0 controls other than tab/newline, DEL and C1 controls.
// oxlint-disable-next-line no-control-regex
const ANSI_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const STRING_INTRODUCERS = new Set([0x90, 0x98, 0x9d, 0x9e, 0x9f]);

export function stripBidiControls(value: string): string {
  return value.replace(BIDI_CONTROLS, '');
}

// Returns the index just past the CSI sequence that starts at `start`, where
// `start` is ESC + '[' or a single C1 CSI byte.
function csiEnd(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length && text.charCodeAt(index) >= 0x30 && text.charCodeAt(index) <= 0x3f) {
    index += 1;
  }
  while (index < text.length && text.charCodeAt(index) >= 0x20 && text.charCodeAt(index) <= 0x2f) {
    index += 1;
  }
  return index < text.length ? index + 1 : index;
}

// Returns the index just past an OSC/DCS/APC/PM/SOS payload, or undefined when
// the payload is unterminated.
function stringEnd(
  text: string,
  start: number,
  allowBel: boolean,
): number | undefined {
  let end = start;
  while (end < text.length) {
    if (allowBel && text[end] === '\u0007') return end + 1;
    if (text[end] === '\u009c') return end + 1;
    if (text[end] === '\u001b' && text[end + 1] === '\\') return end + 2;
    end += 1;
  }
  return undefined;
}

export interface EscapeScan {
  /** Index just past the escape sequence. */
  end: number;
  /** SGR parameters when the sequence is a Select Graphic Rendition. */
  sgr?: string;
}

export function isEscapeIntroducer(code: number): boolean {
  return code === 0x1b || code === 0x9b || STRING_INTRODUCERS.has(code);
}

// Scans one escape sequence starting at ESC or a C1 introducer. Handles CSI,
// OSC, DCS, APC, PM and SOS, all terminated by ST, plus two-byte designators
// with intermediates.
export function scanEscape(text: string, start: number): EscapeScan {
  const first = text.charCodeAt(start);

  if (first === 0x9b) {
    const end = csiEnd(text, start);
    const final = end > start + 1 ? text[end - 1] : '';
    return final === 'm'
      ? { end, sgr: text.slice(start + 1, end - 1) }
      : { end };
  }

  if (STRING_INTRODUCERS.has(first)) {
    // A stray 8-bit control without a terminator loses only the byte; the
    // following text is not swallowed.
    return {
      end: stringEnd(text, start + 1, first === 0x9d) ?? start + 1,
    };
  }

  let index = start + 1;
  if (index >= text.length) return { end: index };
  const introducer = text[index] as string;

  if (introducer === '[') {
    const end = csiEnd(text, index);
    const final = end > index + 1 ? text[end - 1] : '';
    return final === 'm'
      ? { end, sgr: text.slice(index + 1, end - 1) }
      : { end };
  }

  if (
    introducer === ']' ||
    introducer === 'P' ||
    introducer === '_' ||
    introducer === '^' ||
    introducer === 'X'
  ) {
    return { end: stringEnd(text, index + 1, introducer === ']') ?? text.length };
  }

  let end = index;
  while (
    end < text.length &&
    text.charCodeAt(end) >= 0x20 &&
    text.charCodeAt(end) <= 0x2f
  ) {
    end += 1;
  }
  if (
    end < text.length &&
    text.charCodeAt(end) >= 0x30 &&
    text.charCodeAt(end) <= 0x7e
  ) {
    end += 1;
  }
  return { end };
}

function isControl(code: number): boolean {
  return (
    code === 0x7f ||
    (code >= 0x80 && code <= 0x9f) ||
    (code < 0x20 && code !== 0x09 && code !== 0x0a)
  );
}

/**
 * Removes ANSI escape sequences, including 8-bit C1 escapes, and other terminal
 * controls. Newlines and tabs are kept so copied and summarised text stays
 * readable.
 */
export function stripAnsi(text: string): string {
  if (!ANSI_CONTROLS.test(text)) return text;

  let output = '';
  let chunkStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const escape = isEscapeIntroducer(code);
    if (escape || isControl(code)) {
      if (index > chunkStart) output += text.slice(chunkStart, index);
      if (escape) index = scanEscape(text, index).end - 1;
      chunkStart = index + 1;
    }
  }
  return output + text.slice(chunkStart);
}
