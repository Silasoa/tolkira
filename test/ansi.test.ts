import { describe, expect, it } from 'vitest';
import { renderAnsiLog } from '../src/render/ansi.js';
import { stripAnsi } from '../src/text.js';

function spanCount(html: string): number {
  return (html.match(/<span /g) ?? []).length;
}

describe('renderAnsiLog', () => {
  it('resets SGR state after a reset code', () => {
    const html = renderAnsiLog('\u001b[31mred\u001b[0m plain');

    expect(html).toBe('<span class="ansi ansi-fg-1">red</span> plain');
  });

  it('maps bright colours to the 8-15 palette', () => {
    const html = renderAnsiLog('\u001b[91mbright\u001b[0m');

    expect(html).toContain('ansi-fg-9');
    expect(html).toContain('bright');
  });

  it('maps indexed colours 0-15 to palette classes', () => {
    const html = renderAnsiLog('\u001b[38;5;1mred\u001b[48;5;12mbluebg\u001b[0m');

    expect(html).toContain('ansi-fg-1');
    expect(html).toContain('ansi-bg-12');
    expect(html).not.toContain('--ansi-fg');
    expect(html).not.toContain('--ansi-bg');
  });

  it('renders 256-colour foreground and background as inline values', () => {
    const html = renderAnsiLog(
      '\u001b[38;5;196mred\u001b[48;5;21mbluebg\u001b[0m',
    );

    expect(html).toContain('ansi-inline-fg');
    expect(html).toContain('--ansi-fg:#ff0000');
    expect(html).toContain('ansi-inline-bg');
    expect(html).toContain('--ansi-bg:#0000ff');
  });

  it('clamps truecolour channels', () => {
    const html = renderAnsiLog('\u001b[38;2;300;0;999mclamped\u001b[0m');

    expect(html).toContain('--ansi-fg:#ff00ff');
  });

  it('clamps indexed colours above 255', () => {
    const html = renderAnsiLog('\u001b[38;5;999mwhite\u001b[0m');

    expect(html).toContain('--ansi-fg:#eeeeee');
  });

  it('ignores incomplete or non-numeric 38/48 sequences', () => {
    expect(renderAnsiLog('\u001b[38mtext')).toBe('text');
    expect(renderAnsiLog('\u001b[48mtext')).toBe('text');
    expect(renderAnsiLog('\u001b[38;5mtext')).toBe('text');
    expect(renderAnsiLog('\u001b[38;5;?mtext')).toBe('text');
    expect(renderAnsiLog('\u001b[48;2;1;2mtext')).not.toContain('--ansi-bg');
  });

  it('strips truncated SGR sequences', () => {
    expect(renderAnsiLog('\u001b[31')).toBe('');
    expect(renderAnsiLog('\u001b[31;')).toBe('');
    expect(renderAnsiLog('\u001b[31truncated')).toBe('runcated');
  });

  it('treats an empty SGR parameter as reset', () => {
    expect(renderAnsiLog('\u001b[mplain')).toBe('plain');
    expect(renderAnsiLog('\u001b[1;;31mtext\u001b[0m')).toContain('ansi-fg-1');
  });

  it('strips OSC sequences terminated by BEL or ST', () => {
    expect(renderAnsiLog('\u001b]0;title\u0007visible')).toBe('visible');
    expect(
      renderAnsiLog(
        '\u001b]8;;https://example.com\u001b\\link\u001b]8;;\u001b\\',
      ),
    ).toBe('link');
  });

  it('strips OSC-52, DCS, APC and two-byte escapes from logs', () => {
    const html = renderAnsiLog(
      '\u001b]52;c;cHduZWQ=\u0007clip\u001bPdcs payload\u001b\\\u001b_apc payload\u001b\\\u001b(Btwo-byte',
    );

    expect(html).toBe('cliptwo-byte');
    expect(html).not.toContain('payload');
  });

  it('strips C0 and C1 controls but keeps newlines and tabs', () => {
    const html = renderAnsiLog(
      '\u0000\u0001\u0007\u007f\u0085\u009ftext\nnext\ttab',
    );

    expect(html).toBe('text\nnext\ttab');
  });

  it('treats 8-bit C1 CSI as a control sequence', () => {
    const html = renderAnsiLog('\u009b31mred\u009b0m plain');

    expect(html).toBe('<span class="ansi ansi-fg-1">red</span> plain');
  });

  it('marks background-only spans for contrasting text', () => {
    const html = renderAnsiLog('\u001b[44mbackground\u001b[0m');

    expect(html).toContain('ansi-bg-4 ansi-bg-only');
  });

  it('strips bidi controls and escapes HTML', () => {
    const html = renderAnsiLog(
      '\u202eevil\u2066 <script>window.x=1</script>\u202c',
    );

    expect(html).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
    expect(html).toContain('&lt;script&gt;window.x=1&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('enforces the 262,144-byte boundary', () => {
    const prefix = '\u001b[31m';
    const atLimit = renderAnsiLog(prefix + 'x'.repeat(262139));
    const overLimit = renderAnsiLog(prefix + 'x'.repeat(262140));

    expect(spanCount(atLimit)).toBe(1);
    expect(spanCount(overLimit)).toBe(0);
    expect(overLimit).toBe('x'.repeat(262140));
  });
});

describe('stripAnsi', () => {
  it('returns text without controls unchanged', () => {
    const text = 'visible text\nwith a tab\tand a newline';

    expect(stripAnsi(text)).toBe(text);
  });

  it('removes every escape family and keeps the visible text', () => {
    const text =
      '\u001b]8;;https://example.com/\u001b\\visible' +
      '\u001b]8;;\u001b\\' +
      '\u001b]52;c;cHduZWQ=\u0007clip' +
      '\u001bPdcs payload\u001b\\' +
      '\u001b_apc payload\u001b\\' +
      '\u001b(Btwo-byte' +
      '\u001b[31mred\u001b[0m';

    expect(stripAnsi(text)).toBe('visiblecliptwo-bytered');
  });

  it('removes 8-bit C1 escape families', () => {
    const text =
      '\u009d0;title\u0007osc' +
      '\u009d52;c;cHduZWQ=\u009cclip' +
      '\u0090dcs payload\u009c' +
      '\u009fapc payload\u009c' +
      '\u009b31mred\u009b0m';

    expect(stripAnsi(text)).toBe('oscclipred');
  });

  it('removes C0 and C1 controls but keeps newlines and tabs', () => {
    expect(
      stripAnsi('\u0000\u0001\u0007\u0008\u007f\u0085\u009ftext\nnext\ttab'),
    ).toBe('text\nnext\ttab');
  });

  it('drops unterminated OSC, DCS and APC payloads', () => {
    expect(stripAnsi('kept\u001b]52;c;payload')).toBe('kept');
    expect(stripAnsi('kept\u001bPpayload')).toBe('kept');
    expect(stripAnsi('kept\u001b_payload')).toBe('kept');
  });
});
