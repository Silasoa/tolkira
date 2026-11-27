import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRunManifest, serializeRunManifest } from '../src/artifacts.js';
import { formatMarkdownSummary } from '../src/ci.js';
import { renderEmail } from '../src/email.js';
import {
  appendHistory,
  buildHistoryRun,
  writeHistory,
} from '../src/history.js';
import { summarizeReport } from '../src/index.js';
import { CLIENT_SCRIPT } from '../src/render/client-bundle.js';
import { renderHtml } from '../src/render/html.js';
import { REPORT_CSS } from '../src/render/styles.js';
import { messagesFixture } from './fixtures.js';
import {
  incidentEnvelopes,
  LOG_BODY,
  step,
} from './render-incident-fixtures.js';

const fixture = messagesFixture('screenshot.ndjson');

function incidentSection(html: string): string {
  const match = /<section\b[^>]*\bid="incident"[^>]*>/.exec(html);
  if (!match) return '';
  const start = match.index;
  let depth = 0;
  let index = start;
  while (index < html.length) {
    const open = html.indexOf('<section', index);
    const close = html.indexOf('</section>', index);
    if (close < 0) return html.slice(start);
    if (open >= 0 && open < close) {
      depth += 1;
      index = open + 8;
    } else {
      depth -= 1;
      index = close + 10;
      if (depth === 0) return html.slice(start, index);
    }
  }
  return html.slice(start);
}

function reportCss(): string {
  return REPORT_CSS;
}

function rootBlock(css: string, header: RegExp): string {
  const match = header.exec(css);
  if (!match) return '';
  const start = (match.index ?? 0) + match[0].lastIndexOf('{') + 1;
  let depth = 1;
  for (let index = start; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, index);
    }
  }
  return '';
}

function declaration(block: string, property: string): string | undefined {
  const match = new RegExp(
    `(?:^|[;{])\\s*${property}\\s*:\\s*([^;{}]+)(?=[;}]|$)`,
  ).exec(block);
  return match?.[1]?.trim();
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseColor(value: string): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const number = Number.parseInt(hex[1], 16);
    return {
      r: ((number >> 16) & 0xff) / 255,
      g: ((number >> 8) & 0xff) / 255,
      b: (number & 0xff) / 255,
    };
  }
  const oklch = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(value);
  if (!oklch) throw new Error(`Unsupported colour token: ${value}`);
  const lightness = Number(oklch[1]) / 100;
  const chroma = Number(oklch[2]);
  const hue = (Number(oklch[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const encode = (channel: number): number => {
    const clipped = Math.min(1, Math.max(0, channel));
    return clipped <= 0.0031308
      ? 12.92 * clipped
      : 1.055 * clipped ** (1 / 2.4) - 0.055;
  };
  const [r, g, blue] = linear.map((channel) => encode(channel)) as [
    number,
    number,
    number,
  ];
  return { r, g, b: blue };
}

function luminance(color: Rgb): number {
  const channel = (value: number): number =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

function contrast(first: string, second: string): number {
  const a = luminance(parseColor(first));
  const b = luminance(parseColor(second));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function token(block: string, name: string): string {
  const value = declaration(block, name);
  if (!value) throw new Error(`Missing CSS token ${name}`);
  return value;
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('incident panel in the report forms', () => {
  const failed = (): ReturnType<typeof incidentEnvelopes> =>
    incidentEnvelopes({
      features: [
        {
          name: 'Forms',
          scenarios: [
            {
              name: 'fails with a log',
              tags: ['@forms'],
              steps: [
                step('the check', {
                  status: 'failed',
                  message: 'Expected 200 but got 500',
                  attachments: [
                    {
                      fileName: 'server.log',
                      mediaType: 'text/x.cucumber.log+plain',
                      body: LOG_BODY,
                    },
                  ],
                }),
              ],
            },
          ],
        },
      ],
    });

  it('renders in the default, static and print forms without controls in static', async () => {
    const defaultHtml = await renderHtml(failed(), { title: 'Default' });
    const staticHtml = await renderHtml(failed(), {
      title: 'Static',
      static: true,
    });

    for (const [name, html] of [
      ['default', defaultHtml],
      ['static', staticHtml],
    ] as const) {
      const panel = incidentSection(html);
      expect(panel, name).not.toBe('');
      expect(panel, name).toContain('id="incident-heading"');
      expect(panel, name).toContain('Expected 200 but got 500');
    }
    expect(defaultHtml.match(/<script\b/g) ?? []).toHaveLength(3);

    // Print uses the default document; the print block must keep the panel.
    const print = reportCss().slice(reportCss().indexOf('@media print'));
    expect(print).not.toContain('.incident{display:none');
    expect(print).not.toContain('.incidentDetail{display:none');

    expect(incidentSection(staticHtml)).toContain(
      'class="attachmentText" open',
    );
    expect(staticHtml).toContain('class="triageScenario" href="#incident"');
    expect(staticHtml).not.toContain('data-copy-failure');
    expect(staticHtml).not.toContain('data-copy-log');
    expect(staticHtml).not.toContain('id="tolkira-lightbox"');
    expect(staticHtml).not.toContain('class="shotButton"');
  });

  it('keeps the panel outside the filtered index', async () => {
    const html = await renderHtml(failed(), { title: 'Filters' });
    const panel = incidentSection(html);

    expect(panel).not.toBe('');
    expect(html).toContain('data-search');
    expect(html).toContain('data-filter-status="failed"');
    expect(html).toContain('data-tag-filter');
    expect(panel).not.toContain('data-scenario');
    expect(panel).not.toContain('href="#scenario-');
    expect(html).toContain(
      'No scenarios in the list match the current search or filters.',
    );
  });

  it('carries the Incident review tokens and no elevated container', () => {
    const css = reportCss();
    const light = rootBlock(css, /:root\s*\{/);

    expect(token(light, '--paper')).toBe('#f5f3ec');
    expect(token(light, '--muted')).toBe('#625e53');
    expect(token(light, '--pending')).toBe('#7a5318');
    expect(token(light, '--radius')).toBe('6px');
    expect(token(light, '--shadow')).toBe('none');

    const print = rootBlock(css, /@media\s+print\s*\{\s*:root\s*\{/);
    expect(token(print, '--radius')).toBe('6px');
    expect(token(print, '--shadow')).toBe('none');

    for (const match of css.matchAll(/box-shadow\s*:\s*([^;}]+)/g)) {
      expect(match[1]?.trim(), 'box-shadow').toBe('none');
    }
  });

  it('maps the incident badge, cause and lead to the status token', () => {
    const css = reportCss();
    const roles: Array<[string, RegExp, string]> = [
      ['.incidentBadge.fail', /\.incidentBadge\.fail\s*\{/, '--fail'],
      ['.incidentBadge.pending', /\.incidentBadge\.pending\s*\{/, '--pending'],
      [
        '.incidentBadge.undefined',
        /\.incidentBadge\.undefined\s*\{/,
        '--undefined',
      ],
      [
        '.incidentBadge.ambiguous',
        /\.incidentBadge\.ambiguous\s*\{/,
        '--ambiguous',
      ],
    ];
    for (const [name, header, roleToken] of roles) {
      expect(declaration(rootBlock(css, header), 'color'), name).toBe(
        `var(${roleToken})`,
      );
    }
    for (const [name, status, causeToken] of [
      ['fail', 'fail', '--fail'],
      ['pending', 'pending', '--pending'],
      ['undefined', 'undefined', '--undefined'],
      ['ambiguous', 'ambiguous', '--ambiguous'],
    ] as const) {
      const cause = rootBlock(
        css,
        new RegExp(`\\.incident\\.${status} \\.incidentCause\\s*\\{`),
      );
      expect(
        declaration(cause, 'border-color'),
        `${name} cause border`,
      ).toContain(`var(${causeToken})`);
      const lead = rootBlock(
        css,
        new RegExp(`\\.incident\\.${status} \\.incidentErrorLead\\s*\\{`),
      );
      expect(declaration(lead, 'color'), `${name} lead`).toBe(
        name === 'ambiguous' ? 'var(--ink-2)' : `var(${causeToken})`,
      );
    }
  });

  it('keeps the incident bordered and tinted and the shared panels bordered', () => {
    const css = reportCss();
    const incident = rootBlock(css, /\.incident\s*\{/);
    const fail = rootBlock(css, /\.incident\.fail\s*\{/);
    const undefinedIncident = rootBlock(css, /\.incident\.undefined\s*\{/);
    const ambiguousIncident = rootBlock(css, /\.incident\.ambiguous\s*\{/);
    const panel = rootBlock(css, /\.panel\s*\{/);
    const source = rootBlock(css, /\.sourceItem\s*\{/);
    const meta = rootBlock(css, /\.incidentMeta\s*\{/);

    expect(declaration(incident, 'border')).toContain('1px solid');
    expect(declaration(incident, 'background')).toBe('var(--surface-2)');
    expect(declaration(fail, 'background')).toBe('var(--fail-soft)');
    expect(declaration(undefinedIncident, 'background')).toBe(
      'var(--undefined-soft)',
    );
    expect(declaration(ambiguousIncident, 'background')).toBe(
      'var(--ambiguous-soft)',
    );
    expect(declaration(panel, 'border')).toBe('1px solid var(--line-strong)');
    expect(declaration(panel, 'border-radius')).toBe('var(--radius)');
    expect(declaration(source, 'border')).toBe('1px solid var(--line)');
    expect(declaration(source, 'border-radius')).toBe('var(--radius-control)');
    expect(declaration(meta, 'font-family')).toBe('var(--font-mono)');
  });

  it('keeps every incident lead at 4.5:1 on its panel background', () => {
    const css = reportCss();
    const light = rootBlock(css, /:root\s*\{/);
    const dark = rootBlock(
      css,
      /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{\s*:root\s*\{/,
    );
    const print = rootBlock(css, /@media\s+print\s*\{\s*:root\s*\{/);
    const leads = [
      ['fail', '--fail', '--fail-soft'],
      ['pending', '--pending', '--pending-soft'],
      ['undefined', '--undefined', '--undefined-soft'],
      ['ambiguous', '--ink-2', '--ambiguous-soft'],
    ] as const;

    for (const [mode, block] of [
      ['light', light],
      ['dark', dark],
      ['print', print],
    ] as const) {
      expect(block, mode).not.toBe('');
      for (const [name, text, background] of leads) {
        expect(
          contrast(token(block, text), token(block, background)),
          `${mode} ${name} lead`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps text and status contrast at 4.5:1 on paper, surface-2 and surface-3', () => {
    const css = reportCss();
    const light = rootBlock(css, /:root\s*\{/);
    const dark = rootBlock(
      css,
      /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{\s*:root\s*\{/,
    );
    const print = rootBlock(css, /@media\s+print\s*\{\s*:root\s*\{/);
    const modes = [
      ['light', light],
      ['dark', dark],
      ['print', print],
    ] as const;
    const backgrounds = ['--paper', '--surface-2', '--surface-3'];
    const texts = [
      '--ink',
      '--ink-2',
      '--muted',
      '--accent-text',
      '--pass',
      '--fail',
      '--pending',
      '--undefined',
    ];

    for (const [mode, block] of modes) {
      expect(block, mode).not.toBe('');
      for (const background of backgrounds) {
        const backgroundValue = token(block, background);
        for (const text of texts) {
          const ratio = contrast(token(block, text), backgroundValue);
          expect(
            ratio,
            `${mode} ${text} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe('unchanged artifacts', () => {
  it('keeps summary JSON, CI, email, manifest and history bytes unchanged', async () => {
    const summary = await summarizeReport(fixture);
    const json = `${JSON.stringify(summary, null, 2)}\n`;
    const ci = formatMarkdownSummary(summary);
    const email = renderEmail(summary, {
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    const manifest = serializeRunManifest(
      buildRunManifest(summary, 0, [], 'run.json'),
    );
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-incident-parity-'));
    try {
      const historyFile = path.join(dir, 'history.json');
      await writeHistory(
        historyFile,
        appendHistory(
          [],
          buildHistoryRun(
            summary,
            'Parity',
            new Date('2026-01-01T00:00:00.000Z'),
          ),
        ),
      );
      const history = await readFile(historyFile, 'utf8');

      expect(Buffer.byteLength(json, 'utf8')).toBe(1519);
      expect(hash(json)).toBe(
        '09c4be0d7b20f5f9981521956e94d3b7cffc7a932856850090d49c3cce9b2da8',
      );
      expect(hash(ci)).toBe(
        '640af92da29ec892697d3eb3326ac54abfd17e14e37719b19d76a4e821ea3524',
      );
      expect(hash(email)).toBe(
        '181a24b5bd5e9a79360c586000eceb5ac3b030786a82439669344c73cc3f0f17',
      );
      expect(hash(manifest)).toBe(
        '711d5d8bd6c565c8a4ba49651646fe63fd77cb2a30079f558d886256649ebdfb',
      );
      expect(hash(history)).toBe(
        '25b0d65a4d88d4b72086ddc602ecab4855919a2dd4a94f25dc4179950e6c3416',
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('pins the client bundle for the copy scope, scenario controls, list empty copy and row highlight guard', () => {
    expect(CLIENT_SCRIPT).toContain('data-copy-scope');
    expect(CLIENT_SCRIPT).toContain('client.empty');
    expect(CLIENT_SCRIPT).toContain('data-expand');
    expect(hash(CLIENT_SCRIPT)).toBe(
      '3dbc7eba926ebb4201d1953ad050be8afa6ca9f50ee3eec8377411ee3020e75b',
    );
  });
});
