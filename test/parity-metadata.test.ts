import { AttachmentContentEncoding } from '@cucumber/messages';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import { summarizeReport } from '../src/index.js';
import { parseJUnitXml } from '../src/input/junit.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';

const messageFixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/messages/${name}`, import.meta.url));
const legacyScreenshot = fileURLToPath(
  new URL('./fixtures/legacy/screenshot.json', import.meta.url),
);
const junitBasic = fileURLToPath(
  new URL('./fixtures/junit/basic.xml', import.meta.url),
);

const FULL_REVISION = 'abcdef1234567890abcdef1234567890abcdef12';
const SHORT_REVISION = 'abcdef1';
const CI_URL = 'https://github.com/acme/tolkira/actions/runs/42';
const CI_REMOTE = 'https://github.com/acme/tolkira';

async function messagesModelFor(name: string) {
  const file = messageFixture(name);
  return buildReportModel(parseMessages(await readFile(file, 'utf8'), file));
}

async function renderMessages(name: string): Promise<string> {
  const file = messageFixture(name);
  return renderHtml(parseMessages(await readFile(file, 'utf8'), file), {
    title: 'Parity metadata',
  });
}

function reportHeader(html: string): string {
  const view = html.indexOf('id="report-view"');
  const start = html.indexOf('<header class="runHead">', view);
  const end = html.indexOf('</header>', start);
  return html.slice(start, end);
}

function analysisView(html: string): string {
  const start = html.indexOf('id="analysis-view"');
  const end = html.indexOf('</main>', start);
  return html.slice(start, end);
}

function attachmentBlock(
  html: string,
  name: string,
  nextName?: string,
): string {
  const start = html.indexOf(name);
  const end = nextName ? html.indexOf(nextName, start + name.length) : html.length;
  return start < 0 ? '' : html.slice(start, end < 0 ? html.length : end);
}

function ciKeys(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      ciKeys(entry, `${path}[${index}]`),
    );
  }
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    const next = path ? `${path}.${key}` : key;
    return key.toLowerCase() === 'ci' ? [next] : ciKeys(entry, next);
  });
}

function ciOf(model: { environment?: object }): unknown {
  return (model.environment as { ci?: unknown } | undefined)?.ci;
}

describe('parity metadata model', () => {
  it('reads the full meta.ci block into the environment', async () => {
    const model = await messagesModelFor('ci-full.ndjson');

    expect(ciOf(model)).toEqual({
      name: 'GitHub Actions',
      url: CI_URL,
      remote: CI_REMOTE,
      revision: FULL_REVISION,
      branch: 'main',
      tag: 'v1.2.3',
    });
  });

  it('keeps only the present CI fields', async () => {
    const model = await messagesModelFor('ci-partial.ndjson');

    expect(ciOf(model)).toEqual({ name: 'Local CI' });
  });

  it('keeps the first non-empty CI block in a mixed run', async () => {
    const model = await messagesModelFor('ci-mixed.ndjson');

    expect(ciOf(model)).toEqual({
      name: 'First CI',
      url: 'https://first.example.com/job/1',
      remote: CI_REMOTE,
      revision: '111111122222222333333334444444455555555',
      branch: 'first-branch',
      tag: 'first-tag',
    });
  });

  it('does not let legacy-synthesized meta erase a CI block', async () => {
    const messageFile = messageFixture('ci-full.ndjson');
    const messages = parseMessages(
      await readFile(messageFile, 'utf8'),
      messageFile,
    );
    const legacy = parseLegacyJson(
      await readFile(legacyScreenshot, 'utf8'),
      legacyScreenshot,
    );
    const model = buildReportModel([...messages, ...legacy]);

    expect(ciOf(model)).toMatchObject({
      name: 'GitHub Actions',
      revision: FULL_REVISION,
    });
  });

  it('invents no CI metadata for legacy or JUnit input', async () => {
    const legacy = buildReportModel(
      parseLegacyJson(
        await readFile(legacyScreenshot, 'utf8'),
        legacyScreenshot,
      ),
    );
    expect(ciOf(legacy)).toBeUndefined();

    const junit = buildReportModel(
      await parseJUnitXml(await readFile(junitBasic, 'utf8'), 'basic.xml'),
    );
    expect(ciOf(junit)).toBeUndefined();
  });

  it('names unnamed attachments deterministically', async () => {
    const first = await messagesModelFor('attachments-naming.ndjson');
    const second = await messagesModelFor('attachments-naming.ndjson');
    const attachments = first.scenarios[0]?.attachments ?? [];

    expect(attachments.map((attachment) => attachment.fileName)).toEqual([
      'attachment.png',
      'attachment.png',
      'attachment.json',
      'attachment.txt',
      'attachment.bin',
      '..\\secrets\\report.html',
      'screenshot.png',
      'attachment.txt',
      'attachment.log',
      '"><svg onload=alert(1)>.txt',
    ]);
    expect(
      second.scenarios[0]?.attachments.map((attachment) => attachment.fileName),
    ).toEqual(attachments.map((attachment) => attachment.fileName));
    expect(first.counts.attachments).toBe(10);
  });

  it('normalises parameterised media types before naming files', async () => {
    const model = await messagesModelFor('attachments-naming.ndjson');
    const json = model.scenarios[0]?.attachments.find(
      (attachment) => attachment.mediaType === 'application/json',
    );
    const text = model.scenarios[0]?.attachments.find(
      (attachment) => attachment.mediaType === 'text/plain',
    );

    expect(json?.fileName).toBe('attachment.json');
    expect(text?.fileName).toBe('attachment.txt');
  });

  it('maps unknown and mixed-case media types to octet-stream', async () => {
    const model = await messagesModelFor('attachments-naming.ndjson');
    const unknown = model.scenarios[0]?.attachments.find(
      (attachment) => attachment.mediaType === 'application/octet-stream',
    );

    expect(unknown?.fileName).toBe('attachment.bin');
    expect(unknown?.dataUri).toBeUndefined();
  });

  it('treats names as text and never rewrites named files', async () => {
    const model = await messagesModelFor('attachments-naming.ndjson');
    const pathLike = model.scenarios[0]?.attachments.find(
      (attachment) => attachment.mediaType === 'text/html',
    );
    const named = model.scenarios[0]?.attachments.find(
      (attachment) => attachment.fileName === 'screenshot.png',
    );

    expect(pathLike?.fileName).toBe('..\\secrets\\report.html');
    expect(named?.fileName).toBe('screenshot.png');
  });

  it('maps URI-list and Cucumber log media types to deterministic extensions', async () => {
    const model = await messagesModelFor('attachments-naming.ndjson');
    const attachments = model.scenarios[0]?.attachments ?? [];

    expect(
      attachments.find((attachment) => attachment.mediaType === 'text/uri-list')
        ?.fileName,
    ).toBe('attachment.txt');
    expect(
      attachments.find(
        (attachment) => attachment.mediaType === 'text/x.cucumber.log+plain',
      )?.fileName,
    ).toBe('attachment.log');
  });

  it('renders hostile attachment names as escaped text', async () => {
    const html = await renderMessages('attachments-naming.ndjson');

    expect(html).toContain('&quot;&gt;&lt;svg onload=alert(1)&gt;.txt');
    expect(html).not.toContain('<svg onload=alert(1)>');
    expect(html).toContain('..\\secrets\\report.html');
    expect(html).not.toContain('href="..\\secrets');
  });

  it('names legacy attachments with the shared fallback', async () => {
    const model = buildReportModel(
      parseLegacyJson(
        await readFile(legacyScreenshot, 'utf8'),
        legacyScreenshot,
      ),
    );
    const image = model.scenarios
      .flatMap((scenario) => scenario.attachments)
      .find((attachment) => attachment.kind === 'image');

    expect(image?.fileName).toBe('attachment.png');
  });
});

describe('parity metadata summary', () => {
  it('keeps --json CI-free with schema version 2', async () => {
    let stdout = '';
    const file = messageFixture('ci-full.ndjson');
    const code = await runCli([file, '--json'], {
      stdout: (text) => {
        stdout += text;
      },
      stderr: () => undefined,
    });

    expect(code).toBe(0);
    const summary = JSON.parse(stdout) as Record<string, unknown>;
    expect(summary.schemaVersion).toBe(2);
    expect(ciKeys(summary)).toEqual([]);
    expect(stdout).not.toContain('GitHub Actions');
    expect(stdout).not.toContain(FULL_REVISION);
    expect(stdout).not.toContain(CI_URL);
  });

  it('summarizes a CI report without CI fields', async () => {
    const summary = await summarizeReport(messageFixture('ci-full.ndjson'));

    expect(summary.schemaVersion).toBe(2);
    expect(ciKeys(summary)).toEqual([]);
    expect(JSON.stringify(summary)).not.toContain('GitHub Actions');
  });
});

describe('parity metadata rendering', () => {
  it('shows the CI link, short revision, branch and tag', async () => {
    const html = await renderMessages('ci-full.ndjson');
    const header = reportHeader(html);

    expect(header).toMatch(
      /<a (?=[^>]*href="https:\/\/github\.com\/acme\/tolkira\/actions\/runs\/42")[^>]*>GitHub Actions<\/a>/,
    );
    expect(header).toContain(SHORT_REVISION);
    expect(header).toContain('main');
    expect(header).toContain('v1.2.3');
    expect(header).toMatch(
      new RegExp(`title="${FULL_REVISION}"`),
    );

    const details = analysisView(html);
    expect(details).toMatch(
      /<dt>CI<\/dt><dd><a [^>]*href="https:\/\/github\.com\/acme\/tolkira\/actions\/runs\/42"[^>]*>GitHub Actions<\/a><\/dd>/,
    );
    expect(details).toContain('<dt>Branch</dt><dd>main</dd>');
    expect(details).toContain('<dt>Tag</dt><dd>v1.2.3</dd>');
  });

  it('links the 7-character revision to the GitHub commit', async () => {
    const html = await renderMessages('ci-full.ndjson');
    const header = reportHeader(html);

    expect(header).toMatch(
      new RegExp(
        `<a (?=[^>]*href="${CI_REMOTE}/commit/${FULL_REVISION}")(?=[^>]*title="${FULL_REVISION}")[^>]*>${SHORT_REVISION}</a>`,
      ),
    );
    expect(analysisView(html)).toMatch(
      new RegExp(
        `<dt>Revision<\\/dt><dd><a (?=[^>]*href="${CI_REMOTE}/commit/${FULL_REVISION}")(?=[^>]*title="${FULL_REVISION}")[^>]*>${SHORT_REVISION}</a><\\/dd>`,
      ),
    );
  });

  it('links the GitHub commit for scp-like and ssh:// remotes', async () => {
    const file = messageFixture('ci-full.ndjson');
    for (const remote of [
      'git@github.com:acme/tolkira.git',
      'ssh://git@github.com/acme/tolkira.git',
      'ssh://git@github.com:22/acme/tolkira.git',
    ]) {
      const envelopes = parseMessages(await readFile(file, 'utf8'), file);
      const ci = envelopes.find((envelope) => envelope.meta?.ci)?.meta?.ci;
      expect(ci?.git).toBeDefined();
      if (!ci?.git) continue;
      ci.git.remote = remote;

      const html = await renderHtml(envelopes, { title: 'Parity metadata' });
      expect(reportHeader(html)).toMatch(
        new RegExp(`href="${CI_REMOTE}/commit/${FULL_REVISION}"`),
      );
      expect(reportHeader(html)).toContain(
        `title="${FULL_REVISION}"`,
      );
    }
  });

  it('uses the SSH GitHub fixture for the commit link', async () => {
    const html = await renderMessages('ci-ssh.ndjson');

    expect(reportHeader(html)).toContain('SSH CI');
    expect(reportHeader(html)).toMatch(
      new RegExp(`href="${CI_REMOTE}/commit/${FULL_REVISION}"`),
    );
  });

  it('renders a non-GitHub or hostile remote revision as plain text', async () => {
    const file = messageFixture('ci-full.ndjson');
    for (const remote of [
      'https://gitlab.com/acme/tolkira',
      'https://github.com/acme/tolkira/tree/main',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'ssh://git@evil.example/acme/tolkira.git',
    ]) {
      const envelopes = parseMessages(await readFile(file, 'utf8'), file);
      const ci = envelopes.find((envelope) => envelope.meta?.ci)?.meta?.ci;
      expect(ci?.git).toBeDefined();
      if (!ci?.git) continue;
      ci.git.remote = remote;

      const html = await renderHtml(envelopes, { title: 'Parity metadata' });
      expect(reportHeader(html)).toContain(SHORT_REVISION);
      expect(html).not.toContain(`/commit/${FULL_REVISION}`);
    }
  });

  it('links the CI URL when the CI name is missing', async () => {
    const html = await renderMessages('ci-url-only.ndjson');
    const header = reportHeader(html);
    const details = analysisView(html);

    expect(header).toMatch(
      new RegExp(
        `<a (?=[^>]*href="https://ci\\.example\\.com/runs/7")[^>]*>https://ci\\.example\\.com/runs/7</a>`,
      ),
    );
    expect(details).toMatch(
      /<dt>CI<\/dt><dd><a [^>]*href="https:\/\/ci\.example\.com\/runs\/7"[^>]*>https:\/\/ci\.example\.com\/runs\/7<\/a><\/dd>/,
    );
    expect(header).toContain(SHORT_REVISION);
  });

  it('omits empty CI fields instead of placeholders', async () => {
    const html = await renderMessages('ci-partial.ndjson');
    const header = reportHeader(html);
    const details = analysisView(html);

    expect(header).toContain('Local CI');
    expect(header).not.toMatch(/<a[^>]*>Local CI<\/a>/);
    expect(details).toMatch(/<dt>CI<\/dt><dd>Local CI<\/dd>/);
    expect(details).not.toContain('<dt>Revision</dt>');
    expect(details).not.toContain('<dt>Branch</dt>');
    expect(details).not.toContain('<dt>Tag</dt>');
    expect(html).not.toContain('href=""');
    expect(html).not.toContain('>undefined<');
    expect(html).not.toContain('>null<');
  });

  it('does not link an unsafe CI URL or remote', async () => {
    const html = await renderMessages('ci-unsafe.ndjson');
    const header = reportHeader(html);

    expect(header).toContain('Unsafe CI');
    expect(html.toLowerCase()).not.toContain('href="javascript:');
    expect(html).not.toMatch(/<a[^>]*>Unsafe CI<\/a>/);
    expect(header).toContain('1234567');
    expect(html).not.toContain('/commit/1234567890');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
  });

  it('pretty-prints and escapes JSON attachments', async () => {
    const html = await renderMessages('attachments-presentation.ndjson');
    const block = attachmentBlock(html, 'payload.json', 'malformed.json');

    expect(block).toContain('&quot;name&quot;: &quot;tolkira&quot;');
    expect(block).toMatch(/\n\s{2}&quot;name&quot;/);
    expect(block).toContain(
      '&lt;script&gt;window.__tolkiraXss=1&lt;/script&gt;',
    );
    expect(block).not.toContain('<script>window.__tolkiraXss=1</script>');
  });

  it('preserves big numbers and duplicate keys when pretty-printing JSON', async () => {
    const html = await renderMessages('attachments-presentation.ndjson');
    const block = attachmentBlock(html, 'precision.json', 'malformed.json');

    expect(block).toContain('&quot;big&quot;: 12345678901234567890');
    expect((block.match(/&quot;dup&quot;/g) ?? []).length).toBe(2);
    expect(block).toMatch(/\n\s{4}&quot;ok&quot;/);
  });

  it('renders JSON above 262,144 bytes as escaped raw text', async () => {
    const file = messageFixture('attachments-presentation.ndjson');
    const envelopes = parseMessages(await readFile(file, 'utf8'), file);
    const startedId = envelopes.find(
      (envelope) => envelope.testCaseStarted,
    )?.testCaseStarted?.id;
    const testStepId = envelopes.find((envelope) => envelope.testCase)?.testCase
      ?.testSteps[0]?.id;
    expect(startedId).toBeDefined();
    expect(testStepId).toBeDefined();
    if (!startedId || !testStepId) return;
    envelopes.push({
      attachment: {
        body: `{"padding":"${'a'.repeat(262150)}"}`,
        contentEncoding: AttachmentContentEncoding.IDENTITY,
        fileName: 'oversized.json',
        mediaType: 'application/json',
        testCaseStartedId: startedId,
        testStepId,
      },
    });

    const html = await renderHtml(envelopes, { title: 'Large JSON' });
    const block = attachmentBlock(html, 'oversized.json', '</details>');

    expect(block).toContain('{&quot;padding&quot;:&quot;aaaa');
    expect(block).not.toContain('\n  &quot;padding&quot;');
  });

  it('falls back to escaped raw text for malformed JSON', async () => {
    const html = await renderMessages('attachments-presentation.ndjson');
    const block = attachmentBlock(html, 'malformed.json', 'links.txt');

    expect(block).toContain('{&quot;broken&quot;: &lt;not json&gt;');
    expect(block).not.toContain('<not json>');
    expect(html).toContain('Rich attachments');
  });

  it('renders only http(s) URI-list entries as links', async () => {
    const html = await renderMessages('attachments-presentation.ndjson');
    const block = attachmentBlock(html, 'links.txt', 'session.log');

    for (const url of [
      'https://example.com/one',
      'http://example.com/two',
    ]) {
      expect(block).toMatch(
        new RegExp(
          `<a (?=[^>]*href="${url}")(?=[^>]*rel="noopener noreferrer")[^>]*>`,
        ),
      );
    }
    // Leading whitespace is either trimmed or left as text; both are safe.
    expect(block).toContain('padded.example/three');
    for (const unsafe of [
      'javascript:alert(1)',
      'JavaScript:alert(2)',
      'data:text/html',
      'file:///etc/passwd',
      'ftp://example.com/file',
      'mailto:team@example.com',
      '//example.com/protocol-relative',
    ]) {
      expect(block.toLowerCase()).not.toContain(
        `href="${unsafe.toLowerCase()}"`,
      );
    }
    expect(block).toContain('&lt;script&gt;alert(3)&lt;/script&gt;');
    expect(block).not.toContain('<script>alert(3)</script>');
    expect(block).toContain('comments only');
    expect(block).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
  });

  it('renders ANSI SGR, 256 and truecolour safely with a copy action', async () => {
    const html = await renderMessages('attachments-presentation.ndjson');
    const block = attachmentBlock(html, 'session.log', '</details>');

    expect(block).not.toContain('\u001b');
    expect(block).not.toContain('\u0007');
    expect(block).toContain('ERROR');
    expect(block).toContain('256-colour');
    expect(block).toContain('truecolour');
    expect((block.match(/<span class="[^"]*ansi/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(block).toContain(
      '&lt;script&gt;window.__tolkiraXss=1&lt;/script&gt;',
    );
    expect(block).not.toContain('<script>window.__tolkiraXss=1</script>');
    expect(block).not.toContain('owned');
    expect(block).not.toContain('2J');
    expect(block).toContain('bright red');
    expect(block).toContain('background only');
    expect(block).toContain('bidi hidden');
    expect(block).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
    expect(block).toContain('ansi-fg-9');
    expect(block).toContain('ansi-bg-only');
    expect(block).toMatch(
      /<button[^>]*aria-label="Copy log session\.log"[^>]*hidden[^>]*>[^<]*[Cc]opy/,
    );
  });

  it('falls back to escaped text above 262,144 UTF-8 bytes', async () => {
    const html = await renderMessages('attachments-large.ndjson');
    const limitStart = html.indexOf('boundary-262144.log');
    const overStart = html.indexOf('boundary-262145.log');

    expect(limitStart).toBeGreaterThan(-1);
    expect(overStart).toBeGreaterThan(limitStart);
    const limitBlock = html.slice(limitStart, overStart);
    const overBlock = html.slice(overStart);

    expect((limitBlock.match(/<span class="[^"]*ansi/g) ?? []).length).toBeGreaterThan(0);
    expect((overBlock.match(/<span class="[^"]*ansi/g) ?? []).length).toBe(0);
    expect(overBlock.includes('x'.repeat(64))).toBe(true);
  });

  it('keeps HTML counts aligned with the summary baseline', async () => {
    const file = messageFixture('hooks.ndjson');
    const envelopes = parseMessages(await readFile(file, 'utf8'), file);
    const model = buildReportModel(envelopes);
    const summary = await summarizeReport(file);
    const html = await renderHtml(envelopes, { title: 'Counts', summary });

    expect(model.counts.scenarios).toEqual(summary.counts.scenarios);
    expect(model.counts.steps.total).toBe(
      summary.counts.steps.total - model.counts.hooks.total,
    );
    expect(analysisView(html)).toContain(
      `<dt>Steps (excl. hooks)</dt><dd>${model.counts.steps.total}</dd>`,
    );
    expect(analysisView(html)).toContain(
      `<dt>Hooks</dt><dd>${model.counts.hooks.total}</dd>`,
    );

    const presentationFile = messageFixture('attachments-presentation.ndjson');
    const presentation = buildReportModel(
      parseMessages(
        await readFile(presentationFile, 'utf8'),
        presentationFile,
      ),
    );
    const presentationSummary = await summarizeReport(presentationFile);
    expect(presentation.counts.attachments).toBe(
      presentationSummary.attachments.total,
    );
  });

  it('makes no network request when the report opens', async () => {
    const html = await renderMessages('attachments-presentation.ndjson');

    expect(html).toContain("connect-src 'none'");
    expect(html).not.toMatch(/<(?:img|script|iframe|audio|video)[^>]+src="https?:/);
    expect(html).not.toContain('fetch(');
  });

  it('adds no CI metadata for legacy input', async () => {
    const html = await renderHtml(
      parseLegacyJson(
        await readFile(legacyScreenshot, 'utf8'),
        legacyScreenshot,
      ),
      { title: 'Legacy metadata' },
    );

    expect(html).not.toContain('<dt>CI</dt>');
  });
});
