import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli.js';
import { generate } from '../src/compat/cucumber-html-reporter.js';
import { renderReport } from '../src/index.js';

const legacyFixture = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const messagesFixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);

const CI_URL = 'https://github.com/acme/tolkira/actions/runs/42';

const tempDirs: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-metadata-'));
  tempDirs.push(dir);
  return dir;
}

function reportHeader(html: string): string {
  const view = html.indexOf('id="report-view"');
  const start = html.indexOf('<header class="runHead">', view);
  const end = html.indexOf('</header>', start);
  return html.slice(start, end);
}

function analysisView(html: string): string {
  const start = html.indexOf('id="analysis-view"');
  const ends = ['id="trends-view"', 'id="tolkira-lightbox"']
    .map((marker) => html.indexOf(marker, start + 1))
    .filter((index) => index > start)
    .sort((a, b) => a - b);
  return start < 0 ? '' : html.slice(start, ends[0] ?? html.length);
}

function renderWith(metadata: Record<string, string>): Promise<string> {
  return renderReport(legacyFixture, {
    title: 'Metadata links',
    metadata,
  });
}

function anchor(href: string, label: string): string {
  return `<a href="${href}" rel="noopener noreferrer">${label}</a>`;
}

describe('metadata links', () => {
  it('links a safe URL in the header and in Details', async () => {
    const html = await renderWith({ 'CI run': CI_URL });
    const link = anchor(CI_URL, CI_URL);

    expect(reportHeader(html)).toContain(`<span><b>CI run</b> ${link}</span>`);
    expect(analysisView(html)).toContain(`<dt>CI run</dt><dd>${link}</dd>`);
  });

  it('links the normalized URL forms with the trimmed input as label', async () => {
    const cases: Array<[string, string]> = [
      ['http:example.com', 'http://example.com/'],
      ['https:\\\\example.com', 'https://example.com/'],
      ['https://example.com/a b', 'https://example.com/a%20b'],
    ];

    for (const [value, href] of cases) {
      const html = await renderWith({ Probe: value });
      const link = anchor(href, value);

      expect(reportHeader(html), value).toContain(
        `<span><b>Probe</b> ${link}</span>`,
      );
      expect(analysisView(html), value).toContain(
        `<dt>Probe</dt><dd>${link}</dd>`,
      );
    }
  });

  it('strips surrounding whitespace and bidi controls from the label', async () => {
    const html = await renderWith({
      Probe: '  \u202Ehttps://example.com/wrapped\u202C  ',
    });
    const link = anchor(
      'https://example.com/wrapped',
      'https://example.com/wrapped',
    );

    expect(reportHeader(html)).toContain(`<span><b>Probe</b> ${link}</span>`);
    expect(analysisView(html)).toContain(`<dt>Probe</dt><dd>${link}</dd>`);
    expect(reportHeader(html)).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
    expect(analysisView(html)).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
  });

  it('keeps an untyped ESM numeric value as text', async () => {
    const metadata = { Build: 42 } as unknown as Record<string, string>;
    const html = await renderReport(legacyFixture, {
      title: 'Metadata links',
      metadata,
    });

    expect(reportHeader(html)).toContain('<span><b>Build</b> 42</span>');
    expect(analysisView(html)).toContain('<dt>Build</dt><dd>42</dd>');
    expect(html).not.toContain('>42</a>');
  });

  it('escapes & and quotes in both the href and the label', async () => {
    const value = 'https://example.com/a?x=1&y="2"';
    const html = await renderWith({ Escaped: value });
    const link = anchor(
      'https://example.com/a?x=1&amp;y=%222%22',
      'https://example.com/a?x=1&amp;y=&quot;2&quot;',
    );

    expect(reportHeader(html)).toContain(`<span><b>Escaped</b> ${link}</span>`);
    expect(analysisView(html)).toContain(`<dt>Escaped</dt><dd>${link}</dd>`);
    expect(html).not.toContain('href="https://example.com/a?x=1&y=');
  });

  it('keeps unsafe, scheme-less, malformed and plain values as text', async () => {
    const values: Array<[string, string, string?]> = [
      ['Js', 'javascript:alert(1)'],
      ['Js case', 'JaVaScRiPt:alert(1)'],
      ['Js control', '\u202EJaVaScRiPt:alert(1)', 'JaVaScRiPt:alert(1)'],
      ['Data', 'data:text/html;base64,PHNjcmlwdD4='],
      ['Ftp', 'ftp://example.com/file'],
      ['Host', 'www.example.com'],
      ['Malformed', 'https://'],
      ['Plain', 'Nightly build'],
    ];

    for (const [key, value, text = value] of values) {
      const html = await renderWith({ [key]: value });

      expect(reportHeader(html), value).toContain(
        `<span><b>${key}</b> ${text}</span>`,
      );
      expect(analysisView(html), value).toContain(
        `<dt>${key}</dt><dd>${text}</dd>`,
      );
      expect(html).not.toMatch(/<a[^>]*href="(?:javascript:|data:|ftp:)/i);
      expect(html, value).not.toContain(`>${value}</a>`);
    }
  });

  it('keeps internal tab, line feed and carriage return as text', async () => {
    const values: Array<[string, string]> = [
      ['Tab', 'https://example.com/a\tb'],
      ['Lf', 'https://example.com/a\nb'],
      ['Cr', 'https://example.com/a\rb'],
    ];

    for (const [key, value] of values) {
      const html = await renderWith({ [key]: value });

      expect(reportHeader(html), key).toContain(
        `<span><b>${key}</b> ${value}</span>`,
      );
      expect(analysisView(html), key).toContain(
        `<dt>${key}</dt><dd>${value}</dd>`,
      );
      expect(html, key).not.toMatch(/<a[^>]*href="https:\/\/example\.com\/a/);
    }
  });

  it('still omits empty keys and values', async () => {
    const html = await renderWith({
      '': 'https://example.com/empty-key',
      Empty: '',
    });

    expect(html).not.toContain('<dt>Empty</dt>');
    expect(html).not.toContain('https://example.com/empty-key');
    expect(html).not.toContain('<b></b>');
  });
});

describe('metadata links through the CLI', () => {
  it('links a --meta URL in the written report', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');

    const code = await runCli(
      [
        legacyFixture,
        '--out',
        output,
        '--meta',
        `CI run=${CI_URL}`,
        '--meta',
        'Build=42',
      ],
      { stdout: () => undefined, stderr: () => undefined },
    );

    expect(code).toBe(0);
    const html = await readFile(output, 'utf8');
    const link = anchor(CI_URL, CI_URL);
    expect(reportHeader(html)).toContain(`<span><b>CI run</b> ${link}</span>`);
    expect(analysisView(html)).toContain(`<dt>CI run</dt><dd>${link}</dd>`);
    expect(analysisView(html)).toContain('<dt>Build</dt><dd>42</dd>');
    expect(analysisView(html)).not.toContain('>42</a>');
  });

  it('keeps JSON, email and CI bytes unchanged by URL metadata', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const dir = await tempDir();

    const run = async (name: string, metadata: boolean) => {
      const runDir = path.join(dir, name);
      const output = path.join(runDir, 'report.html');
      const email = path.join(runDir, 'email.html');
      const ci = path.join(runDir, 'ci.md');
      let stdout = '';
      let stderr = '';
      const args = [
        messagesFixture,
        '--out',
        output,
        '--email',
        email,
        '--json',
        '--ci',
        'markdown',
        '--ci-out',
        ci,
        '--title',
        'Bytes',
      ];
      if (metadata) args.push('--meta', `CI run=${CI_URL}`);
      const code = await runCli(args, {
        stdout: (text) => {
          stdout += text;
        },
        stderr: (text) => {
          stderr += text;
        },
      });
      expect(code, stderr).toBe(0);
      return {
        html: await readFile(output, 'utf8'),
        email: await readFile(email, 'utf8'),
        ci: await readFile(ci, 'utf8'),
        stdout,
      };
    };

    const baseline = await run('baseline', false);
    const linked = await run('linked', true);

    expect(linked.stdout).toBe(baseline.stdout);
    expect(linked.email).toBe(baseline.email);
    expect(linked.ci).toBe(baseline.ci);
    expect(linked.stdout).not.toContain(CI_URL);
    expect(linked.email).not.toContain(CI_URL);
    expect(linked.ci).not.toContain(CI_URL);
  });
});

describe('metadata links through the compat shim', () => {
  it('links a URL and keeps a numeric value as text', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'compat.html');

    await generate({
      jsonFile: legacyFixture,
      output,
      metadata: { 'CI run': CI_URL, Build: 42 },
    });

    const html = await readFile(output, 'utf8');
    const link = anchor(CI_URL, CI_URL);
    expect(reportHeader(html)).toContain(`<span><b>CI run</b> ${link}</span>`);
    expect(analysisView(html)).toContain(`<dt>CI run</dt><dd>${link}</dd>`);
    expect(analysisView(html)).toContain('<dt>Build</dt><dd>42</dd>');
    expect(analysisView(html)).not.toContain('>42</a>');
  });
});
