import { MAX_TEXT_ATTACHMENT_BYTES } from '../report/attachment.js';
import { isEscapeIntroducer, scanEscape } from '../text.js';
import { escapeHtml } from './escape.js';

interface AnsiStyle {
  fgClass?: string;
  bgClass?: string;
  fgColor?: string;
  bgColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function xtermColor(value: number): string {
  const index = Math.max(16, Math.min(255, Math.floor(value)));
  if (index < 232) {
    const offset = index - 16;
    const component = (step: number): string =>
      (step === 0 ? 0 : 55 + step * 40).toString(16).padStart(2, '0');
    return `#${component(Math.floor(offset / 36))}${component(
      Math.floor((offset % 36) / 6),
    )}${component(offset % 6)}`;
  }
  const grey = 8 + (index - 232) * 10;
  const hex = Math.min(255, grey).toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

function rgbColor(red: number, green: number, blue: number): string {
  const channel = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function applyIndexedColor(
  style: AnsiStyle,
  foreground: boolean,
  value: number,
): void {
  if (value < 16) {
    if (foreground) {
      style.fgClass = `ansi-fg-${value}`;
      delete style.fgColor;
    } else {
      style.bgClass = `ansi-bg-${value}`;
      delete style.bgColor;
    }
    return;
  }
  const color = xtermColor(value);
  if (foreground) {
    style.fgColor = color;
    delete style.fgClass;
  } else {
    style.bgColor = color;
    delete style.bgClass;
  }
}

function applySgr(style: AnsiStyle, raw: string): void {
  const parts = raw === '' ? ['0'] : raw.split(';');
  for (let index = 0; index < parts.length; index += 1) {
    const code = parts[index] === '' ? 0 : Number(parts[index]);
    if (!Number.isFinite(code)) continue;
    if (code === 0) {
      delete style.fgClass;
      delete style.bgClass;
      delete style.fgColor;
      delete style.bgColor;
      delete style.bold;
      delete style.dim;
      delete style.italic;
      delete style.underline;
    } else if (code === 1) {
      style.bold = true;
    } else if (code === 2) {
      style.dim = true;
    } else if (code === 3) {
      style.italic = true;
    } else if (code === 4) {
      style.underline = true;
    } else if (code === 22) {
      delete style.bold;
      delete style.dim;
    } else if (code === 23) {
      delete style.italic;
    } else if (code === 24) {
      delete style.underline;
    } else if (code >= 30 && code <= 37) {
      style.fgClass = `ansi-fg-${code - 30}`;
      delete style.fgColor;
    } else if (code === 39) {
      delete style.fgClass;
      delete style.fgColor;
    } else if (code >= 40 && code <= 47) {
      style.bgClass = `ansi-bg-${code - 40}`;
      delete style.bgColor;
    } else if (code === 49) {
      delete style.bgClass;
      delete style.bgColor;
    } else if (code >= 90 && code <= 97) {
      style.fgClass = `ansi-fg-${code - 90 + 8}`;
      delete style.fgColor;
    } else if (code >= 100 && code <= 107) {
      style.bgClass = `ansi-bg-${code - 100 + 8}`;
      delete style.bgColor;
    } else if (code === 38 || code === 48) {
      const mode = Number(parts[index + 1]);
      const foreground = code === 38;
      if (mode === 5 && index + 2 < parts.length) {
        const color = Number(parts[index + 2]);
        if (Number.isFinite(color)) {
          applyIndexedColor(style, foreground, color);
        }
        index += 2;
      } else if (mode === 2 && index + 4 < parts.length) {
        const red = Number(parts[index + 2]);
        const green = Number(parts[index + 3]);
        const blue = Number(parts[index + 4]);
        if (Number.isFinite(red) && Number.isFinite(green) && Number.isFinite(blue)) {
          const value = rgbColor(red, green, blue);
          if (foreground) {
            style.fgColor = value;
            delete style.fgClass;
          } else {
            style.bgColor = value;
            delete style.bgClass;
          }
        }
        index += 4;
      }
    }
  }
}

function hasStyle(style: AnsiStyle): boolean {
  return Boolean(
    style.fgClass ||
      style.bgClass ||
      style.fgColor ||
      style.bgColor ||
      style.bold ||
      style.dim ||
      style.italic ||
      style.underline,
  );
}

function spanMarkup(style: AnsiStyle): string {
  const classes = ['ansi'];
  if (style.fgClass) classes.push(style.fgClass);
  if (style.bgClass) classes.push(style.bgClass);
  if ((style.bgClass || style.bgColor) && !(style.fgClass || style.fgColor)) {
    classes.push('ansi-bg-only');
  }
  if (style.bold) classes.push('ansi-bold');
  if (style.dim) classes.push('ansi-dim');
  if (style.italic) classes.push('ansi-italic');
  if (style.underline) classes.push('ansi-underline');
  const css: string[] = [];
  if (style.fgColor) {
    classes.push('ansi-inline-fg');
    css.push(`--ansi-fg:${style.fgColor}`);
  }
  if (style.bgColor) {
    classes.push('ansi-inline-bg');
    css.push(`--ansi-bg:${style.bgColor}`);
  }
  const attributes = css.length ? ` style="${css.join(';')}"` : '';
  return `<span class="${classes.join(' ')}"${attributes}>`;
}

function ansiToHtml(text: string, colorize: boolean): string {
  let output = '';
  let buffer = '';
  let style: AnsiStyle = {};
  let spanOpen = false;

  const flush = (): void => {
    if (buffer) {
      output += escapeHtml(buffer);
      buffer = '';
    }
  };
  const closeSpan = (): void => {
    if (!spanOpen) return;
    flush();
    output += '</span>';
    spanOpen = false;
  };
  const openSpan = (): void => {
    closeSpan();
    if (!colorize || !hasStyle(style)) return;
    output += spanMarkup(style);
    spanOpen = true;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    const code = text.charCodeAt(index);
    if (isEscapeIntroducer(code)) {
      const scan = scanEscape(text, index);
      if (scan.sgr !== undefined) {
        flush();
        if (colorize) applySgr(style, scan.sgr);
        openSpan();
      }
      index = scan.end - 1;
      continue;
    }
    if (
      character === '\u0007' ||
      code === 0x7f ||
      (code < 0x20 && character !== '\n' && character !== '\t') ||
      (code >= 0x80 && code <= 0x9f)
    ) {
      continue;
    }
    buffer += character;
  }
  closeSpan();
  flush();
  return output;
}

/** Renders Cucumber ANSI logs as escaped HTML with safe SGR colours only. */
export function renderAnsiLog(text: string): string {
  return ansiToHtml(
    text,
    Buffer.byteLength(text, 'utf8') <= MAX_TEXT_ATTACHMENT_BYTES,
  );
}
