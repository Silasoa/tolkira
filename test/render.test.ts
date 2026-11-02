import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);

describe('messages rendering', () => {
  it('renders a single self-contained report', async () => {
    const html = await renderReport(fixture, { title: 'Tolkira test' });

    expect(html).toContain('<title>Tolkira test</title>');
    expect(html).toContain('Screenshot attachment');
    expect(html).toContain('screenshot.png');
    expect(html).toContain('image/png');
    expect(html.length).toBeGreaterThan(500_000);
  });

  it('escapes the report title', async () => {
    const html = await renderReport(fixture, {
      title: '<script>alert(1)</script>',
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<title><script>');
  });

  it('injects and escapes metadata', async () => {
    const html = await renderReport(fixture, {
      title: 'Metadata',
      metadata: {
        Browser: 'Chrome',
        Evil: '<script>alert(1)</script>',
      },
    });

    expect(html).toContain('tolkira-meta');
    expect(html).toContain('Browser');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<strong>Evil</strong>: <script>');
  });

  it('does not load external scripts or stylesheets', async () => {
    const html = await renderReport(fixture, { title: 'Offline' });

    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
  });
});
