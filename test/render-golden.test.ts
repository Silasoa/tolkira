import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderReport } from '../src/index.js';

// Same pin as the characterization test: the legacy parser needs a fixed clock.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function fixture(relative: string): string {
  return fileURLToPath(new URL(`./fixtures/${relative}`, import.meta.url));
}

function golden(name: string): string {
  return fileURLToPath(
    new URL(`./fixtures/render-golden/${name}`, import.meta.url),
  );
}

// A 1x1 transparent PNG: the smallest logo that passes the data-URI check.
const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('render golden files', () => {
  it('keeps the minimal legacy report byte-identical', async () => {
    const html = await renderReport(fixture('legacy/minimal.json'), {
      title: 'Golden minimal',
    });

    await expect(html).toMatchFileSnapshot(golden('minimal.html'));
  });

  it('keeps the options-rich messages report byte-identical', async () => {
    const html = await renderReport(
      fixture('messages/attachments-presentation.ndjson'),
      {
        title: 'Golden options',
        metadata: { build: '1' },
        accent: '#123456',
        logo: LOGO,
      },
    );

    await expect(html).toMatchFileSnapshot(
      golden('attachments-presentation.html'),
    );
  });
});
