// An intentional output change runs `npx vitest run -u test/render-golden.test.ts`,
// then replaces the failing hashes from the failure output.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderReport } from '../src/index.js';

// The legacy parser falls back to `new Date()` for a missing start time, so the
// clock is pinned to keep the hashes stable.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const fixtures = [
  {
    name: 'messages screenshot',
    fixture: 'messages/screenshot.ndjson',
    sha256: '9a9bf2583063e6be37e4b605cf45ecd8824946c8418b8499df00e47a178e4008',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '4de6be09e1cb3ab8474e5f09f672755979e4219e214e8b2c61ee50a0b6d3e82e',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '19cd3159b568ac30cde61a010edd0ab45970baabc647d16599c9dd3e3022b7d6',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '8e2d8ebfab048daf4323fc62ae139bad82e59f6453f010e1841a016fea15e8b6',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'b9531da3f2f74fe610f984d14058de65950f11dd132f220a780d9842be5b66e8',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '5a7ea9603de708a533ed9086fda40b9deeb48d2c354769169080b159f391b30c',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '28d32a5335ed0425d2c0bcbade93f4ba6ead919d4eb686a78e26527b9ba8c178',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '84ec14a72024e07ae6b560d088b7e866600429b50cad0a6e0eed6897fd3e5ea6',
  },
];

describe('render characterization', () => {
  it.each(fixtures)('keeps the $name HTML byte-identical', async ({
    fixture,
    sha256,
  }) => {
    const file = fileURLToPath(
      new URL(`./fixtures/${fixture}`, import.meta.url),
    );
    const html = await renderReport(file, { title: 'Characterization' });

    expect(createHash('sha256').update(html, 'utf8').digest('hex')).toBe(
      sha256,
    );
  });
});
